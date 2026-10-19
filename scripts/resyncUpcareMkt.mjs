import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createUpcareClient } from '../server/upcareClient.ts';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const dateFrom = process.argv[2];
const dateTo = process.argv[3];
const apply = process.argv.includes('--apply');
const retiredCodes = new Set(['fbc.linhnpt', 'fbc.linhntp']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function normalizeCode(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function datesInRange(from, to) {
  const valid = (value) => datePattern.test(value)
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to) || from > to) throw new Error('Cần khoảng ngày hợp lệ YYYY-MM-DD.');
  const dates = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  while (cursor.getTime() <= end && dates.length < 31) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (cursor.getTime() <= end) throw new Error('Backfill mỗi lần tối đa 31 ngày.');
  return dates;
}

function numeric(...values) {
  const value = values.find((item) => item !== null && item !== undefined);
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function flattenRows(payload) {
  if (Array.isArray(payload)) return payload.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  if (!payload || typeof payload !== 'object') throw new Error('Odoo MKT API không trả danh sách hợp lệ.');
  const buckets = Object.values(payload);
  if (!buckets.every(Array.isArray)) throw new Error('Odoo MKT API trả cấu trúc không hợp lệ.');
  return buckets.flat().filter((row) => row && typeof row === 'object' && !Array.isArray(row));
}

async function mapConcurrent(items, limit, callback) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await callback(items[index]);
    }
  }));
  return output;
}

function metricKey(row) {
  return [
    Number(row.revenue) || 0,
    Number(row.order_count) || 0,
    Number(row.tong_data_nhan) || 0,
  ].join('|');
}

async function fetchAllRows(db, table, from, to) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from(table)
      .select('id,report_date,code,name,email,team,revenue,tien_viet,order_count,tong_data_nhan,ad_cost,mess_comment_count,meta_synced_at,created_at')
      .gte('report_date', from)
      .lte('report_date', to)
      .range(offset, offset + 999);
    if (error) throw new Error(`Không đọc được ${table} (${error.code}).`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

async function main() {
  const dates = datesInRange(dateFrom, dateTo);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) throw new Error('Thiếu cấu hình Supabase server trong .env.');

  const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const employeeTable = process.env.SUPABASE_EMPLOYEES_TABLE || process.env.VITE_SUPABASE_EMPLOYEES_TABLE || 'employees';
  const reportTable = process.env.SUPABASE_REPORTS_TABLE || process.env.VITE_SUPABASE_REPORTS_TABLE || 'detail_reports';
  const { data: roster, error: rosterError } = await db.from(employeeTable)
    .select('ma_ns,name,email,team,vi_tri,trang_thai');
  if (rosterError) throw new Error(`Không đọc được danh sách nhân sự (${rosterError.code}).`);

  const activeMkt = (roster || []).filter((row) => {
    const position = String(row.vi_tri || '').trim().toLowerCase();
    const isMkt = position.includes('mkt')
      || (position === 'leader' && String(row.team || '').startsWith('FBC - Team '));
    return isMkt && String(row.trang_thai || '').trim().toLowerCase() === 'dang_lam';
  });
  const staffByCode = new Map();
  for (const row of activeMkt) {
    const code = String(row.ma_ns || '').trim();
    const key = normalizeCode(code);
    if (!key || retiredCodes.has(key)) continue;
    if (staffByCode.has(key)) throw new Error(`Danh sách employees có mã nhân viên trùng chuẩn hóa: ${code}`);
    if (!row.name?.trim() || !row.email?.trim()) throw new Error(`Thiếu tên/email để đồng bộ mã ${code}.`);
    staffByCode.set(key, {
      code,
      name: row.name.trim(),
      email: row.email.trim().toLowerCase(),
      team: row.team == null ? null : String(row.team).trim() || null,
    });
  }

  const api = createUpcareClient(process.env);
  const projectUuid = (process.env.UPCARE_CRM_PROJECT_UUID || process.env.VITE_UPCARE_CRM_PROJECT_UUID || '').trim();
  const projectParam = (process.env.UPCARE_CRM_PROJECT_PARAM || process.env.VITE_UPCARE_CRM_PROJECT_PARAM || 'project_id').trim();
  const dailyPayloads = await mapConcurrent(dates, 4, async (date) => {
    const query = new URLSearchParams({ date_from: date, date_to: date });
    if (projectUuid && projectUuid.toLowerCase() !== 'none') query.set(projectParam, projectUuid);
    const response = await api.request(`/api/employee/mkt?${query.toString()}`);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Odoo MKT API trả HTTP ${response.status} ngày ${date}.`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      await response.body?.cancel();
      throw new Error(`Odoo MKT API không trả JSON ngày ${date}.`);
    }
    const sourceRows = flattenRows(await response.json());
    const byCode = new Map();
    for (const source of sourceRows) {
      const sourceCode = source.code ?? source.f99_uid;
      const key = normalizeCode(sourceCode);
      const employee = staffByCode.get(key);
      if (!employee) continue;
      const current = byCode.get(key) || {
        report_date: date,
        code: employee.code,
        name: employee.name,
        email: employee.email,
        team: employee.team,
        revenue: 0,
        order_count: 0,
        tong_data_nhan: 0,
      };
      current.revenue += numeric(source.amount, source.total);
      current.order_count += numeric(source.count, source.sale_count);
      current.tong_data_nhan += numeric(source.dataCount, source.data_count);
      byCode.set(key, current);
    }
    return [...byCode.values()].map((row) => ({
      ...row,
      revenue: Math.round((row.revenue + Number.EPSILON) * 100) / 100,
      tien_viet: Math.round(row.revenue * 25000),
      order_count: Math.round(row.order_count),
      tong_data_nhan: Math.round(row.tong_data_nhan),
    }));
  });
  const payload = dailyPayloads.flat();
  if (!payload.length) throw new Error('Odoo không trả dòng nào khớp roster MKT; dừng, chưa ghi dữ liệu.');

  const codeKeys = new Set(staffByCode.keys());
  const currentRows = await fetchAllRows(db, reportTable, dateFrom, dateTo);
  const backupRows = currentRows.filter((row) => codeKeys.has(normalizeCode(row.code)));

  const sourceByKey = new Map(payload.map((row) => [`${row.report_date}\0${normalizeCode(row.code)}`, row]));
  const rowsByEmployeeDay = new Map();
  for (const row of currentRows) {
    const codeKey = normalizeCode(row.code);
    if (!codeKeys.has(codeKey)) continue;
    const key = `${String(row.report_date).slice(0, 10)}\0${codeKey}`;
    const rows = rowsByEmployeeDay.get(key) || [];
    rows.push(row);
    rowsByEmployeeDay.set(key, rows);
  }
  const duplicateRowsToRemove = [];
  for (const [key, rows] of rowsByEmployeeDay) {
    if (rows.length < 2) continue;
    const employee = staffByCode.get(normalizeCode(rows[0].code));
    const canonicalRows = rows.filter((row) => row.code === employee?.code);
    const source = sourceByKey.get(key);
    if (canonicalRows.length !== 1 || !source) {
      throw new Error(`Dòng trùng ${key.replace('\0', ' + ')} không có duy nhất một mã chuẩn hoặc dữ liệu Odoo; dừng để tránh xóa nhầm.`);
    }
    const canonical = canonicalRows[0];
    for (const duplicate of rows.filter((row) => row.id !== canonical.id)) {
      const hasMetaValues = numeric(duplicate.ad_cost) !== 0 || numeric(duplicate.mess_comment_count) !== 0;
      if (duplicate.code === employee.code
        || metricKey(duplicate) !== metricKey(canonical)
        || metricKey(source) !== metricKey(canonical)
        || hasMetaValues) {
        throw new Error(`Dòng trùng ${key.replace('\0', ' + ')} khác số Odoo/Meta hoặc trùng mã chuẩn; dừng để đối soát thủ công.`);
      }
      duplicateRowsToRemove.push(duplicate.id);
    }
  }

  const plan = {
    readOnly: !apply,
    range: { from: dateFrom, to: dateTo },
    excludedRetiredCodes: [...retiredCodes],
    activeMktCodes: staffByCode.size,
    odooDailyRowsMatchedToRoster: payload.length,
    verifiedCaseVariantDuplicateRowsToRemove: duplicateRowsToRemove.length,
  };
  if (!apply) {
    console.log(JSON.stringify(plan, null, 2));
    console.log('Dry run only. Add --apply to back up and write the Odoo daily metrics.');
    return;
  }

  const repairRoot = process.env.MKT_RESYNC_BACKUP_DIR
    || path.join(process.env.USERPROFILE || process.cwd(), '.codex', 'repairs', 'FE-vinhdanh');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(repairRoot, `mkt-resync-${dateFrom}-${dateTo}-${stamp}`);
  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(path.join(backupDir, 'detail-reports-before.json'), JSON.stringify({
    range: { from: dateFrom, to: dateTo },
    rows: backupRows,
  }, null, 2), 'utf8');

  for (const duplicateId of duplicateRowsToRemove) {
    const { data: deleted, error } = await db.from(reportTable).delete()
      .eq('id', duplicateId)
      .select('id');
    if (error || deleted?.length !== 1) {
      throw new Error(`Không dọn được duy nhất dòng code biến thể đã xác minh (${error?.code || 'row_count'}). Backup: ${backupDir}`);
    }
  }

  // The database RPC deliberately limits each write to seven days. Keep each
  // chunk bounded and idempotent so the one-time backfill uses the same contract.
  let syncedCount = 0;
  for (let start = 0; start < dates.length; start += 7) {
    const chunkDates = new Set(dates.slice(start, start + 7));
    const chunkRows = payload.filter((row) => chunkDates.has(row.report_date));
    const { data, error } = await db.rpc('sync_upcare_mkt_to_detail_reports', {
      p_since: dates[start],
      p_until: dates[Math.min(start + 6, dates.length - 1)],
      p_rows: chunkRows,
    });
    if (error) throw new Error(`Không ghi được đồng bộ Upcare từ ${dates[start]} (${error.code}). Bản sao lưu: ${backupDir}`);
    syncedCount += Number(data) || 0;
  }

  const rowsAfter = await fetchAllRows(db, reportTable, dateFrom, dateTo);
  const afterByKey = new Map();
  for (const row of rowsAfter) {
    const key = `${row.report_date}\0${normalizeCode(row.code)}`;
    if (!codeKeys.has(normalizeCode(row.code))) continue;
    const list = afterByKey.get(key) || [];
    list.push(row);
    afterByKey.set(key, list);
  }
  const mismatches = [];
  for (const [key, expected] of sourceByKey) {
    const rows = afterByKey.get(key) || [];
    if (rows.length !== 1 || metricKey(rows[0] || {}) !== metricKey(expected)) {
      mismatches.push({ date: expected.report_date, code: expected.code, rows: rows.length });
    }
  }
  const result = {
    ...plan,
    readOnly: false,
    rowsUpserted: Number(syncedCount) || 0,
    duplicateRowsRemoved: duplicateRowsToRemove.length,
    verifiedEmployeeDayRows: sourceByKey.size - mismatches.length,
    verificationMismatches: mismatches,
    backupDir,
  };
  console.log(JSON.stringify(result, null, 2));
  if (mismatches.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'MKT resync failed.');
  process.exitCode = 1;
});
