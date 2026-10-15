import { createClient } from '@supabase/supabase-js';
import { createUpcareClient } from './upcareClient.js';

type SyncEnv = Record<string, string | undefined>;
type RawRow = Record<string, unknown>;
type StaffRow = {
  ma_ns?: string | null;
  id_ns?: string | null;
  name?: string | null;
  email?: string | null;
  team?: string | null;
};
type StaffProfile = { code: string; name: string; email: string; team: string | null };
type UpcareAggregate = {
  reportDate: string;
  codeKey: string;
  code: string;
  apiName: string;
  amount: number;
  dataCount: number;
  orderCount: number;
};

export class UpcareDetailReportSyncError extends Error {
  constructor(message: string, readonly statusCode = 502, readonly errorCode = 'upcare_detail_sync_failed') {
    super(message);
    this.name = 'UpcareDetailReportSyncError';
  }
}

function normalizeCode(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function makeDatabase(env: SyncEnv) {
  const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new UpcareDetailReportSyncError('Chưa cấu hình Supabase service role trên server.', 503, 'supabase_not_configured');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchAll<T>(makeQuery: (from: number, to: number) => any, label: string, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery(offset, offset + pageSize - 1).abortSignal(signal);
    if (error) throw new UpcareDetailReportSyncError(`Không đọc được danh sách ${label} từ Supabase.`);
    const page = Array.isArray(data) ? data as T[] : [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function asRawRows(payload: unknown): RawRow[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is RawRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
  }
  if (!payload || typeof payload !== 'object') {
    throw new UpcareDetailReportSyncError('Odoo không trả về danh sách nhân viên hợp lệ.');
  }
  const buckets = Object.values(payload as Record<string, unknown>);
  if (!buckets.every(Array.isArray)) {
    throw new UpcareDetailReportSyncError('Odoo trả cấu trúc dữ liệu không hợp lệ.');
  }
  return buckets.flatMap((bucket) => (bucket as unknown[]).filter(
    (row): row is RawRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row)
  ));
}

function projectScope(env: SyncEnv): { param: string; value: string } | null {
  const value = (env.UPCARE_CRM_PROJECT_UUID || env.VITE_UPCARE_CRM_PROJECT_UUID || '').trim();
  if (!value || value.toLowerCase() === 'none') return null;
  return { param: env.UPCARE_CRM_PROJECT_PARAM?.trim() || env.VITE_UPCARE_CRM_PROJECT_PARAM?.trim() || 'project_id', value };
}

async function loadOdooDay(
  env: SyncEnv,
  client: ReturnType<typeof createUpcareClient>,
  reportDate: string,
  signal: AbortSignal
): Promise<RawRow[]> {
  const query = new URLSearchParams({ date_from: reportDate, date_to: reportDate });
  const scope = projectScope(env);
  if (scope) query.set(scope.param, scope.value);
  let response: Response;
  try {
    response = await client.request(`/api/employee/mkt?${query.toString()}`, { signal });
  } catch (error) {
    throw new UpcareDetailReportSyncError(error instanceof Error ? error.message : 'Không kết nối được Odoo.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new UpcareDetailReportSyncError(`Odoo API trả HTTP ${response.status}.`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    await response.body?.cancel();
    throw new UpcareDetailReportSyncError('Odoo API không trả JSON.');
  }
  const payload = await response.json().catch(() => null);
  return asRawRows(payload);
}

export async function syncUpcareMktToDetailReports(
  env: SyncEnv,
  dateFrom: string,
  dateTo: string
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateFrom > dateTo) {
    throw new UpcareDetailReportSyncError('Khoảng ngày Odoo không hợp lệ.', 400, 'invalid_date_range');
  }

  const db = makeDatabase(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Odoo sync timeout')), 50000);
  const signal = controller.signal;
  const client = createUpcareClient(env);
  try {
    const employeeTable = env.SUPABASE_EMPLOYEES_TABLE?.trim() || env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
    const employees = await fetchAll<StaffRow>(
      (from, to) => db.from(employeeTable).select('ma_ns,name,email,team').not('ma_ns', 'is', null)
        .order('ma_ns', { ascending: true }).range(from, to),
      'nhân sự', signal
    );

    const staffByCode = new Map<string, StaffProfile>();
    for (const row of employees) {
      const code = String(row.ma_ns || '').trim();
      const key = normalizeCode(code);
      if (!key || staffByCode.has(key)) continue;
      staffByCode.set(key, {
        code,
        name: String(row.name || '').trim(),
        email: String(row.email || '').trim().toLowerCase(),
        team: row.team == null ? null : String(row.team).trim() || null,
      });
    }

    const staffTable = env.SUPABASE_MARKETING_STAFF_TABLE?.trim() || env.VITE_SUPABASE_MARKETING_STAFF_TABLE?.trim() || 'marketing_staff';
    const { data: legacyStaff, error: legacyError } = await db.from(staffTable)
      .select('id_ns,name,email,team').not('id_ns', 'is', null).abortSignal(signal);
    if (!legacyError && Array.isArray(legacyStaff)) {
      for (const row of legacyStaff as StaffRow[]) {
        const code = String(row.id_ns || '').trim();
        const key = normalizeCode(code);
        if (!key) continue;
        const profile = staffByCode.get(key);
        if (profile) {
          if (!profile.name) profile.name = String(row.name || '').trim();
          if (!profile.email) profile.email = String(row.email || '').trim().toLowerCase();
          if (!profile.team) profile.team = row.team == null ? null : String(row.team).trim() || null;
        } else {
          staffByCode.set(key, {
            code,
            name: String(row.name || '').trim(),
            email: String(row.email || '').trim().toLowerCase(),
            team: row.team == null ? null : String(row.team).trim() || null,
          });
        }
      }
    }

    const aggregates = new Map<string, UpcareAggregate>();
    let rowsRead = 0;
    let rowsWithoutCode = 0;
    const dates: string[] = [];
    const cursor = new Date(`${dateFrom}T00:00:00.000Z`);
    const last = new Date(`${dateTo}T00:00:00.000Z`).getTime();
    while (cursor.getTime() <= last) {
      const reportDate = cursor.toISOString().slice(0, 10);
      dates.push(reportDate);
      const rows = await loadOdooDay(env, client, reportDate, signal);
      rowsRead += rows.length;
      for (const row of rows) {
        const rawCode = row.code ?? row.f99_uid;
        const code = rawCode == null ? '' : String(rawCode).trim();
        const codeKey = normalizeCode(code);
        if (!codeKey) {
          rowsWithoutCode += 1;
          continue;
        }
        const key = `${reportDate}\0${codeKey}`;
        const current = aggregates.get(key) || {
          reportDate,
          codeKey,
          code,
          apiName: String(row.name || '').trim(),
          amount: 0,
          dataCount: 0,
          orderCount: 0,
        };
        current.amount += asNumber(row.amount ?? row.total);
        current.dataCount += asNumber(row.dataCount ?? row.data_count);
        current.orderCount += asNumber(row.count ?? row.sale_count);
        if (!current.apiName && typeof row.name === 'string') current.apiName = row.name.trim();
        aggregates.set(key, current);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const unmatchedCodes = new Set<string>();
    const payload = [] as {
      report_date: string;
      code: string;
      name: string;
      email: string;
      team: string | null;
      revenue: number;
      tien_viet: number;
      order_count: number;
      tong_data_nhan: number;
    }[];
    for (const aggregate of aggregates.values()) {
      const staff = staffByCode.get(aggregate.codeKey);
      const name = staff?.name || aggregate.apiName;
      if (!staff?.email || !name) {
        unmatchedCodes.add(aggregate.code);
        continue;
      }
      const revenue = Math.round((aggregate.amount + Number.EPSILON) * 100) / 100;
      payload.push({
        report_date: aggregate.reportDate,
        code: staff.code,
        name,
        email: staff.email,
        team: staff.team,
        revenue,
        tien_viet: Math.round(revenue * 25000),
        order_count: Math.round(aggregate.orderCount),
        tong_data_nhan: Math.round(aggregate.dataCount),
      });
    }

    const { data: syncedRows, error } = await db.rpc('sync_upcare_mkt_to_detail_reports', {
      p_since: dateFrom,
      p_until: dateTo,
      p_rows: payload,
    }).abortSignal(signal);
    if (error) {
      throw new UpcareDetailReportSyncError(
        'Odoo đã tải được nhưng chưa ghi vào detail_reports. Kiểm tra migration tự đồng bộ Meta/Odoo và các cột MKT.'
      );
    }
    return {
      range: { since: dateFrom, until: dateTo },
      dates,
      sourceRowsRead: rowsRead,
      employeeDayRowsSynced: Number(syncedRows) || 0,
      rowsWithoutEmployeeCode: rowsWithoutCode,
      unmatchedEmployeeCodes: [...unmatchedCodes].sort().slice(0, 100),
    };
  } catch (error) {
    if (error instanceof UpcareDetailReportSyncError) throw error;
    throw new UpcareDetailReportSyncError(error instanceof Error ? error.message : 'Không đồng bộ được Odoo vào detail_reports.');
  } finally {
    clearTimeout(timeout);
  }
}
