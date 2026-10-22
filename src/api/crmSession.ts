import type { AuthUser } from '../types';

export class CrmSessionClientError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export type CrmSupabaseSession = { access_token: string; refresh_token: string };
export type CrmLoginResult = { user: AuthUser; session: CrmSupabaseSession };

async function request(method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<AuthUser | null> {
  const response = await fetch('/api/crm-session', {
    method,
    credentials: 'same-origin',
    headers: {
      'X-CRM-Request': '1',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({})) as { user?: AuthUser; message?: string };
  if (!response.ok) throw new CrmSessionClientError(response.status, result.message || 'Không xác thực được tài khoản CRM.');
  return result.user || null;
}

export async function loginCrmSession(email: string, password: string): Promise<CrmLoginResult> {
  const response = await fetch('/api/crm-session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CRM-Request': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({})) as { user?: AuthUser; session?: CrmSupabaseSession; message?: string };
  if (!response.ok) throw new CrmSessionClientError(response.status, result.message || 'Không xác thực được tài khoản CRM.');
  if (!result.user || !result.session?.access_token || !result.session.refresh_token) {
    throw new CrmSessionClientError(502, 'Máy chủ không trả đủ thông tin phiên đăng nhập.');
  }
  return { user: result.user, session: result.session };
}

export const restoreCrmSession = () => request('GET');
export const logoutCrmSession = () => request('DELETE');

export async function setCrmEmployeePasswords(updates: Array<{ employeeId: string; password: string }>): Promise<{ updated: number; outcomes: Array<{ employeeId: string; ok: boolean; message?: string }> }> {
  const outcomes: Array<{ employeeId: string; ok: boolean; message?: string }> = [];
  for (let offset = 0; offset < updates.length; offset += 100) {
    const response = await fetch('/api/crm-staff-password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CRM-Request': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: updates.slice(offset, offset + 100) }),
      signal: AbortSignal.timeout(60000),
    });
    const result = await response.json().catch(() => ({})) as { updated?: number; outcomes?: Array<{ employeeId: string; ok: boolean; message?: string }>; message?: string };
    if (!response.ok) throw new CrmSessionClientError(response.status, result.message || 'Không cập nhật được mật khẩu nhân sự.');
    outcomes.push(...(result.outcomes || []));
  }
  return { updated: outcomes.filter((outcome) => outcome.ok).length, outcomes };
}

export type HeatmapApiRow = {
  date: string;
  email: string;
  code: string | null;
  name: string;
  teamId: string | null;
  teamName: string;
  avatarUrl: string | null;
  position: string | null;
  adCost: number;
  revenueVnd: number;
  hasReport: boolean;
};

export type HeatmapApiResult = {
  range: { from: string; to: string };
  scope: 'all' | 'team' | 'project';
  teams: { id: string; name: string }[];
  rows: HeatmapApiRow[];
  warnings: string[];
  scopeWarning: string | null;
};

export async function fetchHeatmap(from: string, to: string): Promise<HeatmapApiResult> {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(`/api/heatmap?${query}`, {
    credentials: 'same-origin',
    headers: { 'X-CRM-Request': '1' },
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json().catch(() => ({})) as HeatmapApiResult & { message?: string };
  if (!response.ok) throw new CrmSessionClientError(response.status, result.message || 'Không tải được Heatmap.');
  return result;
}
