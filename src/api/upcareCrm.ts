/** Upcare CRM employee/MKT API. Authentication runs only in the server-side proxy. */

import type { Employee } from '../types';

export type UpcareMktEmployeeRow = {
  id: number;
  /** Mã nhân sự/biệt danh, ví dụ: FBC.DucNT */
  code?: string | number;
  name: string;
  avatar: string | null;
  amount: number;
  count?: number;
};

export type UpcareMktSnapshotResponse = {
  dateFrom: string;
  dateTo: string;
  employees: UpcareMktEmployeeRow[];
  lastSyncedAt: string | null;
};

export type UpcareSaleSnapshotResponse = UpcareMktSnapshotResponse;

/** Khoảng ngày mặc định cho BXH (7 ngày gần nhất theo lịch Việt Nam). */
export function defaultUpcareMktDateRange(): { dateFrom: string; dateTo: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateTo = `${values.year}-${values.month}-${values.day}`;
  const from = new Date(`${dateTo}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 6);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo };
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

export const mapUpcareSaleRowsToLeaderboardEmployees = mapUpcareMktRowsToLeaderboardEmployees;

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
  if (!Array.isArray(data)) throw new Error('API kh\u00f4ng tr\u1ea3 v\u1ec1 m\u1ea3ng JSON.');
  return data as UpcareMktEmployeeRow[];
}

/** Read the last hourly snapshot from the app database; no Odoo credentials reach the browser. */
export async function fetchUpcareMktSnapshot(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<UpcareMktSnapshotResponse> {
  const qs = new URLSearchParams({ date_from: params.dateFrom, date_to: params.dateTo });
  const response = await fetch(`/api/upcare-mkt-leaderboard?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Odoo snapshot API trả dữ liệu không hợp lệ (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload as { message?: unknown } : {};
    throw new Error(typeof error.message === 'string' ? error.message : `Không tải được snapshot Odoo (HTTP ${response.status}).`);
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as UpcareMktSnapshotResponse).employees)) {
    throw new Error('Odoo snapshot API không đúng định dạng.');
  }
  return payload as UpcareMktSnapshotResponse;
}

/** Read the hourly Odoo Sale employee snapshot from the app database. */
export async function fetchUpcareSaleSnapshot(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<UpcareSaleSnapshotResponse> {
  const qs = new URLSearchParams({ date_from: params.dateFrom, date_to: params.dateTo });
  const response = await fetch(`/api/upcare-sale-leaderboard?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Odoo Sale API trả dữ liệu không hợp lệ (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload as { message?: unknown } : {};
    throw new Error(typeof error.message === 'string' ? error.message : `Không tải được snapshot Odoo Sale (HTTP ${response.status}).`);
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as UpcareSaleSnapshotResponse).employees)) {
    throw new Error('Odoo Sale leaderboard không đúng định dạng.');
  }
  return payload as UpcareSaleSnapshotResponse;
}
