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

type RawUpcareMktRow = Record<string, unknown>;

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
  return import.meta.env.VITE_UPCARE_CRM_ENABLED !== 'false';
}

export function isUpcareLeaderboardEnabled(): boolean {
  return upcareProxyEnabled();
}

export function isUpcareOauthRefreshConfigured(): boolean {
  return import.meta.env.VITE_UPCARE_CRM_OAUTH_ENABLED === 'true';
}

export const UPCARE_DEFAULT_PROJECT_UUID = '';

function appendProjectScope(qs: URLSearchParams): void {
  const raw = import.meta.env.VITE_UPCARE_CRM_PROJECT_UUID?.trim();
  const id =
    raw === undefined || raw === ''
      ? UPCARE_DEFAULT_PROJECT_UUID
      : raw.toLowerCase() === 'none'
        ? null
        : raw;
  if (!id) return;
  const param = import.meta.env.VITE_UPCARE_CRM_PROJECT_PARAM?.trim() || 'project_id';
  qs.set(param, id);
}

export function getUpcareProjectScopeForUi(): { param: string; uuid: string | null } {
  const raw = import.meta.env.VITE_UPCARE_CRM_PROJECT_UUID?.trim();
  let uuid: string | null;
  if (raw === undefined || raw === '') {
    uuid = UPCARE_DEFAULT_PROJECT_UUID || null;
  } else if (raw.toLowerCase() === 'none') {
    uuid = null;
  } else {
    uuid = raw;
  }
  const param = import.meta.env.VITE_UPCARE_CRM_PROJECT_PARAM?.trim() || 'project_id';
  return { param, uuid };
}

export function isUpcareMktConfigured(): boolean {
  return upcareProxyEnabled();
}

export async function fetchUpcareMktEmployees(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<UpcareMktEmployeeRow[]> {
  if (!isUpcareMktConfigured()) {
    throw new Error('Upcare API proxy \u0111ang t\u1eaft trong c\u1ea5u h\u00ecnh.');
  }

  const qs = new URLSearchParams({
    date_from: params.dateFrom,
    date_to: params.dateTo,
  });
  appendProjectScope(qs);
  const url = `${upcareApiRoot()}?${qs.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text().catch(() => '');
  if (!res.ok) {
    let proxyError: { error?: string; message?: string } = {};
    try { proxyError = JSON.parse(rawText); } catch { /* Upstream errors may be plain text. */ }
    if (proxyError?.error === 'upcare_auth_failed' && typeof proxyError.message === 'string') {
      throw new Error(proxyError.message);
    }
    const snippet = rawText.replace(/\s+/g, ' ').slice(0, 280);
    if (res.status === 401) {
      throw new Error(
        'Upcare từ chối xác thực. Vui lòng kiểm tra cấu hình đăng nhập và quyền truy cập của tài khoản.'
      );
    }
    throw new Error(`Upcare API ${res.status}: ${snippet || res.statusText}`);
  }
  if (!contentType.includes('application/json')) {
    throw new Error(`Upcare API kh\u00f4ng tr\u1ea3 JSON: ${rawText.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error('Kh\u00f4ng parse \u0111\u01b0\u1ee3c JSON t\u1eeb Upcare API.');
  }
  return normalizeUpcareMktResponse(data);
}
