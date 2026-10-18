/** Upcare CRM employee/MKT API. Authentication runs only in the server-side proxy. */

import type { Employee } from '../types';

export type UpcareMktEmployeeRow = {
  id: number;
  /** Mã nhân sự/biệt danh, ví dụ: FBC.DucNT */
  code?: string | number;
  name: string;
  avatar: string | null;
  amount: number;
  dataCount?: number;
  count?: number;
};

export type UpcareMktEmployeeDayRow = UpcareMktEmployeeRow & { date: string };

export type UpcareMktEmployeeRange = {
  employees: UpcareMktEmployeeRow[];
  dailyRows: UpcareMktEmployeeDayRow[];
  hasDailyBreakdown: boolean;
};

type RawUpcareMktRow = Record<string, unknown>;
type PublicEnv = Record<string, string | undefined>;

function viteEnv(): PublicEnv {
  return (import.meta as ImportMeta & { env?: PublicEnv }).env ?? {};
}

function toUpcareMktRow(raw: RawUpcareMktRow): UpcareMktEmployeeRow | null {
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;
  const total = Number(raw.amount ?? raw.total);
  const dataCount = Number(raw.dataCount ?? raw.data_count);
  const saleCount = Number(raw.count ?? raw.sale_count);
  const code = raw.code ?? raw.f99_uid;
  return {
    id,
    code: typeof code === 'string' || typeof code === 'number' ? code : undefined,
    name: typeof raw.name === 'string' ? raw.name : '',
    avatar: typeof raw.avatar === 'string' ? raw.avatar : null,
    amount: Number.isFinite(total) ? total : 0,
    dataCount: Number.isFinite(dataCount) ? dataCount : 0,
    count: Number.isFinite(saleCount) ? saleCount : 0,
  };
}

/** Accept a flat array or Fabico's `{ "YYYY-MM-DD": [...] }` response. */
function normalizeUpcareMktResponse(data: unknown): UpcareMktEmployeeRow[] {
  if (Array.isArray(data)) {
    return data
      .filter((row): row is RawUpcareMktRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
      .map(toUpcareMktRow)
      .filter((row): row is UpcareMktEmployeeRow => row !== null);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('API Fabico không trả về mảng nhân viên hoặc object ngày → mảng nhân viên.');
  }

  const dailyBuckets = Object.values(data as Record<string, unknown>);
  if (!dailyBuckets.every(Array.isArray)) {
    throw new Error('Cấu trúc API Fabico không hợp lệ: mong đợi object ngày → mảng nhân viên.');
  }

  // Range queries return one employee list per date. Sum each employee across dates
  // so range callers such as the 7-day leaderboard receive period totals.
  const byId = new Map<number, UpcareMktEmployeeRow>();
  for (const bucket of dailyBuckets as unknown[][]) {
    for (const raw of bucket) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const row = toUpcareMktRow(raw as RawUpcareMktRow);
      if (!row) continue;
      const previous = byId.get(row.id);
      if (previous) {
        previous.amount += row.amount;
        previous.dataCount = (previous.dataCount || 0) + (row.dataCount || 0);
        previous.count = (previous.count || 0) + (row.count || 0);
        if (!previous.code && row.code) previous.code = row.code;
        if (!previous.name && row.name) previous.name = row.name;
        if (!previous.avatar && row.avatar) previous.avatar = row.avatar;
      } else {
        byId.set(row.id, row);
      }
    }
  }
  return Array.from(byId.values());
}

async function requestUpcareMktPayload(url: string, request: typeof fetch): Promise<unknown> {
  const res = await request(url, { headers: { Accept: 'application/json' } });
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text().catch(() => '');
  if (!res.ok) {
    let proxyError: { error?: string; message?: string } = {};
    try { proxyError = JSON.parse(rawText); } catch { /* Non-JSON failures may be plain text. */ }
    if (proxyError?.error === 'upcare_auth_failed' && typeof proxyError.message === 'string') {
      throw new Error(proxyError.message);
    }
    const snippet = rawText.replace(/\s+/g, ' ').slice(0, 280);
    if (res.status === 401) {
      throw new Error('Upcare từ chối xác thực. Vui lòng kiểm tra cấu hình đăng nhập và quyền truy cập của tài khoản.');
    }
    throw new Error(`Upcare API ${res.status}: ${snippet || res.statusText}`);
  }
  if (!contentType.includes('application/json')) {
    throw new Error(`Upcare API không trả JSON: ${rawText.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error('Không parse được JSON từ Upcare API.');
  }
}

/** Khoảng ngày mặc định cho BXH / employee mkt (7 ngày gần nhất, local date). */
export function defaultUpcareMktDateRange(): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: iso(from), dateTo: iso(to) };
}

/** Map API /api/employee/mkt → Employee (score = amount). Team sẽ được gán từ bảng employees. */
export function mapUpcareMktRowsToLeaderboardEmployees(rows: UpcareMktEmployeeRow[]): Employee[] {
  const sorted = [...rows].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
  return sorted.map((r, index) => ({
    id: `upcare-mkt-${r.id}`,
    name: r.name,
    code: r.code != null ? String(r.code) : undefined,
    team: null,
    score: Number(r.amount) || 0,
    avatar_url: r.avatar,
    rank: index + 1,
  }));
}

function upcareApiRoot(): string {
  return '/api/upcare-crm';
}

function upcareProxyEnabled(): boolean {
  return viteEnv().VITE_UPCARE_CRM_ENABLED !== 'false';
}

export function isUpcareLeaderboardEnabled(): boolean {
  return upcareProxyEnabled();
}

export function isUpcareOauthRefreshConfigured(): boolean {
  return viteEnv().VITE_UPCARE_CRM_OAUTH_ENABLED === 'true';
}

export const UPCARE_DEFAULT_PROJECT_UUID = '';

function appendProjectScope(qs: URLSearchParams): void {
  const env = viteEnv();
  const raw = env.VITE_UPCARE_CRM_PROJECT_UUID?.trim();
  const id =
    raw === undefined || raw === ''
      ? UPCARE_DEFAULT_PROJECT_UUID
      : raw.toLowerCase() === 'none'
        ? null
        : raw;
  if (!id) return;
  const param = env.VITE_UPCARE_CRM_PROJECT_PARAM?.trim() || 'project_id';
  qs.set(param, id);
}

export function getUpcareProjectScopeForUi(): { param: string; uuid: string | null } {
  const env = viteEnv();
  const raw = env.VITE_UPCARE_CRM_PROJECT_UUID?.trim();
  let uuid: string | null;
  if (raw === undefined || raw === '') {
    uuid = UPCARE_DEFAULT_PROJECT_UUID || null;
  } else if (raw.toLowerCase() === 'none') {
    uuid = null;
  } else {
    uuid = raw;
  }
  const param = env.VITE_UPCARE_CRM_PROJECT_PARAM?.trim() || 'project_id';
  return { param, uuid };
}

export function isUpcareMktConfigured(): boolean {
  return upcareProxyEnabled();
}

function inclusiveUtcDates(dateFrom: string, dateTo: string): string[] {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  };
  if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo) {
    throw new Error('Khoảng ngày Upcare không hợp lệ.');
  }

  const dates: string[] = [];
  const cursor = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`).getTime();
  while (cursor.getTime() <= end && dates.length < 370) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (cursor.getTime() <= end) throw new Error('Khoảng ngày Upcare không được vượt quá 370 ngày.');
  return dates;
}

function employeeKey(row: UpcareMktEmployeeRow): string {
  const code = String(row.code ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return code || `id:${row.id}`;
}

function addEmployeeMetrics(map: Map<string, UpcareMktEmployeeRow>, row: UpcareMktEmployeeRow): void {
  const key = employeeKey(row);
  const previous = map.get(key);
  if (!previous) {
    map.set(key, { ...row });
    return;
  }
  previous.amount += row.amount;
  previous.dataCount = (previous.dataCount || 0) + (row.dataCount || 0);
  previous.count = (previous.count || 0) + (row.count || 0);
  if (!previous.code && row.code) previous.code = row.code;
  if (!previous.name && row.name) previous.name = row.name;
  if (!previous.avatar && row.avatar) previous.avatar = row.avatar;
}

/** Fetch one Odoo range response, retaining its date buckets for the personal dashboard. */
export async function fetchUpcareMktEmployeesForRange(params: {
  dateFrom: string;
  dateTo: string;
}, request: typeof fetch = fetch): Promise<UpcareMktEmployeeRange> {
  if (!isUpcareMktConfigured()) {
    throw new Error('Upcare API proxy đang tắt trong cấu hình.');
  }

  const dates = inclusiveUtcDates(params.dateFrom, params.dateTo);
  const qs = new URLSearchParams({ date_from: params.dateFrom, date_to: params.dateTo });
  appendProjectScope(qs);
  const payload = await requestUpcareMktPayload(`${upcareApiRoot()}?${qs.toString()}`, request);

  if (Array.isArray(payload)) {
    const rows = normalizeUpcareMktResponse(payload);
    const employees = new Map<string, UpcareMktEmployeeRow>();
    rows.forEach((row) => addEmployeeMetrics(employees, row));
    return {
      employees: Array.from(employees.values()),
      dailyRows: params.dateFrom === params.dateTo
        ? rows.map((row) => ({ ...row, date: params.dateFrom }))
        : [],
      hasDailyBreakdown: params.dateFrom === params.dateTo,
    };
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('API Fabico không trả về dữ liệu theo ngày hoặc danh sách nhân viên.');
  }

  const buckets = payload as Record<string, unknown>;
  const dateKeys = Object.keys(buckets).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
  if (!dateKeys.length || dateKeys.some((date) => !dates.includes(date) || !Array.isArray(buckets[date]))) {
    throw new Error('Cấu trúc API Fabico không hợp lệ: mong đợi object ngày → mảng nhân viên trong khoảng đã chọn.');
  }

  const daily = new Map<string, UpcareMktEmployeeDayRow>();
  for (const date of dateKeys.sort()) {
    for (const row of normalizeUpcareMktResponse(buckets[date])) {
      const key = `${date}\0${employeeKey(row)}`;
      const previous = daily.get(key);
      if (previous) {
        previous.amount += row.amount;
        previous.dataCount = (previous.dataCount || 0) + (row.dataCount || 0);
        previous.count = (previous.count || 0) + (row.count || 0);
      } else {
        daily.set(key, { ...row, date });
      }
    }
  }

  const employees = new Map<string, UpcareMktEmployeeRow>();
  const dailyRows = Array.from(daily.values());
  dailyRows.forEach((row) => addEmployeeMetrics(employees, row));
  return {
    employees: Array.from(employees.values()),
    dailyRows,
    hasDailyBreakdown: dates.every((date) => dateKeys.includes(date)),
  };
}

export async function fetchUpcareMktEmployees(params: {
  dateFrom: string;
  dateTo: string;
}, request: typeof fetch = fetch): Promise<UpcareMktEmployeeRow[]> {
  if (!isUpcareMktConfigured()) {
    throw new Error('Upcare API proxy đang tắt trong cấu hình.');
  }

  const dates = inclusiveUtcDates(params.dateFrom, params.dateTo);
  const byEmployee = new Map<string, UpcareMktEmployeeRow>();
  const fetchDay = async (date: string) => {
    const qs = new URLSearchParams({ date_from: date, date_to: date });
    appendProjectScope(qs);
    const url = `${upcareApiRoot()}?${qs.toString()}`;
    return normalizeUpcareMktResponse(await requestUpcareMktPayload(url, request));
  };

  // Odoo's multi-day endpoint undercounts order_count. Match detail_reports
  // and the hourly sync by querying each day before summing the period.
  for (let index = 0; index < dates.length; index += 4) {
    const batch = await Promise.all(dates.slice(index, index + 4).map(async (date) => {
      try {
        return await fetchDay(date);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Không tải được dữ liệu.';
        throw new Error(`Không tải được dữ liệu Upcare ngày ${date}: ${reason}`);
      }
    }));
    for (const row of batch.flat()) {
      const key = employeeKey(row);
      const previous = byEmployee.get(key);
      if (previous) {
        previous.amount += row.amount;
        previous.dataCount = (previous.dataCount || 0) + (row.dataCount || 0);
        previous.count = (previous.count || 0) + (row.count || 0);
        if (!previous.code && row.code) previous.code = row.code;
        if (!previous.name && row.name) previous.name = row.name;
        if (!previous.avatar && row.avatar) previous.avatar = row.avatar;
      } else {
        byEmployee.set(key, { ...row });
      }
    }
  }
  return Array.from(byEmployee.values());
}
