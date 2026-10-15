import { createClient } from '@supabase/supabase-js';
import type { MetaProjectQcRow, MetaProjectQcResult } from './metaProjectQc.js';

type SyncEnv = Record<string, string | undefined>;
type SyncOptions = { fetch?: typeof fetch; now?: () => Date };

type StagedMetaRow = {
  account_id: string;
  report_date: string;
  employee_code: string | null;
  campaign_name: string;
  spend_vnd: number | string;
  conversations: number | string;
};

type StaffRow = { ma_ns?: string | null; id_ns?: string | null; name?: string | null; email?: string | null; team?: string | null };
type StaffProfile = { code: string; name: string; email: string; team: string | null };

export class MetaDetailReportSyncError extends Error {
  constructor(message: string, readonly statusCode = 502, readonly errorCode = 'meta_detail_sync_failed') {
    super(message);
    this.name = 'MetaDetailReportSyncError';
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

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function makeDatabase(env: SyncEnv, options: SyncOptions) {
  const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new MetaDetailReportSyncError(
      'Chưa cấu hình Supabase service role trên server.', 503, 'meta_storage_not_configured'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: options.fetch ? { fetch: options.fetch } : undefined,
  });
}

async function fetchAll<T>(makeQuery: (from: number, to: number) => any, label: string, signal: AbortSignal): Promise<T[]> {
  const result: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery(offset, offset + pageSize - 1).abortSignal(signal);
    if (error) throw new MetaDetailReportSyncError(`Không đọc được ${label} từ Supabase.`);
    const page = Array.isArray(data) ? data as T[] : [];
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}

function aggregateByEmployeeDay(rows: StagedMetaRow[]) {
  type Aggregate = {
    report_date: string;
    code: string;
    normalizedCode: string;
    spend: number;
    conversations: number;
    accounts: Set<string>;
  };
  const grouped = new Map<string, Aggregate>();
  const incompleteDates = new Set<string>();

  for (const row of rows) {
    const date = String(row.report_date || '').slice(0, 10);
    const code = String(row.employee_code || '').trim();
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) {
      if (date) incompleteDates.add(date);
      continue;
    }
    const key = `${date}\0${normalizedCode}`;
    const aggregate = grouped.get(key) || {
      report_date: date,
      code,
      normalizedCode,
      spend: 0,
      conversations: 0,
      accounts: new Set<string>(),
    };
    aggregate.spend += Number(row.spend_vnd) || 0;
    aggregate.conversations += Number(row.conversations) || 0;
    aggregate.accounts.add(row.account_id);
    grouped.set(key, aggregate);
  }
  return { grouped: [...grouped.values()], incompleteDates };
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  while (cursor.getTime() <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Snapshot Meta's employee/day/campaign rows in a server-only Supabase table,
 * read that persisted snapshot back, then merge its totals into detail_reports.
 */
export async function syncMetaProjectQcToDetailReports(
  env: SyncEnv,
  result: MetaProjectQcResult,
  dateFrom: string,
  dateTo: string,
  options: SyncOptions = {}
) {
  const db = makeDatabase(env, options);
  const signal = AbortSignal.timeout(45000);
  const fetchedAt = (options.now?.() || new Date()).toISOString();
  const sourceRows = result.rows.map((row: MetaProjectQcRow) => ({
    account_id: row.accountId,
    report_date: row.date,
    employee_code: row.employeeCode,
    campaign_name: row.campaignName,
    spend_vnd: roundMoney(Number(row.spendVnd) || 0),
    conversations: Number(row.conversations) || 0,
  }));

  const { data: savedRows, error: saveError } = await db.rpc('replace_meta_project_qc_insights', {
    p_since: dateFrom,
    p_until: dateTo,
    p_fetched_at: fetchedAt,
    p_rows: sourceRows,
  }).abortSignal(signal);
  if (saveError) {
    throw new MetaDetailReportSyncError(
      'Không lưu được snapshot Meta vào Supabase. Kiểm tra migration meta detail report sync.',
      502,
      'meta_storage_failed'
    );
  }

  const persisted: StagedMetaRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('meta_project_qc_insights')
      .select('account_id,report_date,employee_code,campaign_name,spend_vnd,conversations')
      .gte('report_date', dateFrom)
      .lte('report_date', dateTo)
      .order('report_date', { ascending: true })
      .order('account_id', { ascending: true })
      .order('campaign_name', { ascending: true })
      .range(offset, offset + 999)
      .abortSignal(signal);
    if (error) throw new MetaDetailReportSyncError('Không đọc lại được snapshot Meta đã lưu trong Supabase.');
    const page = Array.isArray(data) ? data as StagedMetaRow[] : [];
    persisted.push(...page);
    if (page.length < 1000) break;
  }

  const { grouped, incompleteDates } = aggregateByEmployeeDay(persisted);
  const employeeTable = env.SUPABASE_EMPLOYEES_TABLE?.trim() || env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
  const employeeRows = await fetchAll<StaffRow>(
    (from, to) => db.from(employeeTable).select('ma_ns,name,email,team').not('ma_ns', 'is', null)
      .order('ma_ns', { ascending: true }).range(from, to),
    'nhân sự CRM', signal
  );
  const staffByCode = new Map<string, StaffProfile>();
  for (const row of employeeRows) {
    const code = String(row.ma_ns || '').trim();
    const normalized = normalizeCode(code);
    if (!normalized || staffByCode.has(normalized)) continue;
    staffByCode.set(normalized, {
      code,
      name: String(row.name || '').trim(),
      email: String(row.email || '').trim().toLowerCase(),
      team: row.team == null ? null : String(row.team).trim() || null,
    });
  }

  // marketing_staff is a legacy roster fallback for codes not yet populated on employees.ma_ns.
  const { data: marketingStaff, error: marketingStaffError } = await db.from('marketing_staff')
    .select('id_ns,name,email,team')
    .not('id_ns', 'is', null)
    .abortSignal(signal);
  if (!marketingStaffError && Array.isArray(marketingStaff)) {
    for (const row of marketingStaff as StaffRow[]) {
      const code = String(row.id_ns || '').trim();
      const normalized = normalizeCode(code);
      if (!normalized) continue;
      const existing = staffByCode.get(normalized);
      if (existing) {
        if (!existing.name) existing.name = String(row.name || '').trim();
        if (!existing.email) existing.email = String(row.email || '').trim().toLowerCase();
        if (!existing.team) existing.team = row.team == null ? null : String(row.team).trim() || null;
      } else {
        staffByCode.set(normalized, {
          code,
          name: String(row.name || '').trim(),
          email: String(row.email || '').trim().toLowerCase(),
          team: row.team == null ? null : String(row.team).trim() || null,
        });
      }
    }
  }

  const missingCodes = new Set<string>();
  let rowsWithoutCode = 0;
  const detailRows: {
    report_date: string;
    code: string;
    name: string;
    email: string;
    team: string | null;
    ad_account: string;
    ad_cost: number;
    mess_comment_count: number;
  }[] = [];
  for (const row of grouped) {
    const staff = staffByCode.get(row.normalizedCode);
    if (!staff?.email || !staff.name) {
      missingCodes.add(row.code);
      incompleteDates.add(row.report_date);
      continue;
    }
    detailRows.push({
      report_date: row.report_date,
      code: staff.code,
      name: staff.name,
      email: staff.email,
      team: staff.team,
      ad_account: [...row.accounts].sort().map(id => `act_${id}`).join(', '),
      ad_cost: roundMoney(row.spend),
      mess_comment_count: Math.round(row.conversations),
    });
  }
  for (const row of persisted) if (!String(row.employee_code || '').trim()) rowsWithoutCode += 1;

  const resetDates = result.skippedCurrencies.length
    ? []
    : enumerateDates(dateFrom, dateTo).filter(date => !incompleteDates.has(date));
  const { data: detailRowsSynced, error: mergeError } = await db.rpc('sync_meta_qc_to_detail_reports', {
    p_since: dateFrom,
    p_until: dateTo,
    p_rows: detailRows,
    p_reset_dates: resetDates,
  }).abortSignal(signal);
  if (mergeError) {
    throw new MetaDetailReportSyncError(
      'Meta đã được lưu ở Supabase, nhưng detail_reports chưa đồng bộ. Kiểm tra migration detail_reports và thử lại.',
      502,
      'detail_reports_sync_failed'
    );
  }

  return {
    range: { since: dateFrom, until: dateTo },
    sourceRowsSaved: Number(savedRows) || 0,
    sourceRowsRead: persisted.length,
    detailRowsSynced: Number(detailRowsSynced) || 0,
    unmatchedEmployeeCodes: [...missingCodes].sort().slice(0, 50),
    rowsWithoutEmployeeCode: rowsWithoutCode,
    datesNotReset: [...incompleteDates].sort(),
    skippedCurrencies: result.skippedCurrencies,
    accountIds: result.accountIds,
  };
}
