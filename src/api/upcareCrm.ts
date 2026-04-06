/**
 * CRM Upcare (crm.upcare.asia) — API employee/mkt
 * Token: VITE_UPCARE_CRM_BEARER_TOKEN (không commit vào git).
 * Dev CORS: đặt VITE_UPCARE_CRM_USE_PROXY=true và dùng proxy Vite /upcare-crm → crm.upcare.asia
 *
 * 401: có thể gọi POST /api/oauth/token (db, login, password + Cookie) để lấy JWT mới — xem env OAUTH_*.
 * Cảnh báo: mật khẩu trong biến VITE_ sẽ lộ trong bundle frontend; production nên proxy qua server.
 */

import type { Employee } from '../types';

export type UpcareMktEmployeeRow = {
  id: number;
  /** Mã nhân sự/biệt danh, ví dụ: FBC.DucNT */
  code?: string | number;
  name: string;
  avatar: string | null;
  amount: number;
};

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
  // Prod (Vercel): luôn dùng serverless function để tránh CORS
  if (!import.meta.env.DEV) {
    return '/api/upcare-crm';
  }
  // Dev: cho phép bật Vite proxy, mặc định gọi thẳng (ai cần thì set VITE_UPCARE_CRM_USE_PROXY=true)
  const useProxy = import.meta.env.VITE_UPCARE_CRM_USE_PROXY === 'true';
  if (useProxy) return '/upcare-crm';
  return (import.meta.env.VITE_UPCARE_CRM_API_BASE?.trim() || 'https://crm.upcare.asia').replace(/\/$/, '');
}

/** Chuẩn hoá JWT: trim, bỏ ngoặc, bỏ tiền tố "Bearer " nếu user dán cả cụm */
function normalizeBearerRaw(raw: string | undefined): string {
  if (raw == null) return '';
  let t = String(raw).trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(t)) {
    t = t.replace(/^bearer\s+/i, '').trim();
  }
  return t;
}

function bearerToken(): string {
  const primary = normalizeBearerRaw(import.meta.env.VITE_UPCARE_CRM_BEARER_TOKEN);
  if (primary) return primary;
  return normalizeBearerRaw(import.meta.env.VITE_UPCARE_API_TOKEN);
}

/** BXH trang chủ lấy từ Upcare khi có token; tắt: VITE_UPCARE_CRM_LEADERBOARD=false */
export function isUpcareLeaderboardEnabled(): boolean {
  if (import.meta.env.VITE_UPCARE_CRM_LEADERBOARD === 'false') return false;
  return bearerToken().length > 0;
}

/** JWT sau khi refresh OAuth (ưu tiên hơn env) */
let memoryBearerOverride: string | null = null;
/** Cookie đầy chuỗi sau refresh (cập nhật authorization=) */
let memoryCookieOverride: string | null = null;

function getEffectiveBearer(): string {
  return memoryBearerOverride ?? bearerToken();
}

function replaceAuthorizationInCookie(cookie: string, jwt: string): string {
  const trimmed = cookie.trim();
  if (/authorization=/i.test(trimmed)) {
    return trimmed.replace(/authorization=[^;]*/i, `authorization=${jwt}`);
  }
  const sep = trimmed.length ? '; ' : '';
  return `${trimmed}${sep}authorization=${jwt}`;
}

/**
 * Chuỗi Cookie gửi kèm request Upcare.
 * Nếu có VITE_UPCARE_CRM_COOKIE, luôn đồng bộ authorization= với JWT hiện dùng.
 */
function cookieStringForUpcare(bearerJwt: string): string | undefined {
  if (memoryCookieOverride) return memoryCookieOverride;

  const fullCookieOverride = import.meta.env.VITE_UPCARE_CRM_COOKIE?.trim();
  if (fullCookieOverride) {
    return replaceAuthorizationInCookie(fullCookieOverride, bearerJwt);
  }

  const sendAuthCookie = import.meta.env.VITE_UPCARE_CRM_AUTHORIZATION_COOKIE !== 'false';
  const parts: string[] = [];
  if (sendAuthCookie) {
    parts.push(`authorization=${bearerJwt}`);
  }
  const extra = import.meta.env.VITE_UPCARE_CRM_COOKIE_EXTRA?.trim();
  if (extra) {
    parts.push(extra);
  }
  if (parts.length) {
    return parts.join('; ');
  }
  return undefined;
}

function buildUpcareHeaders(): HeadersInit {
  const bearerJwt = getEffectiveBearer();
  const h: Record<string, string> = {
    Authorization: `Bearer ${bearerJwt}`,
    Accept: 'application/json',
  };
  const cookie = cookieStringForUpcare(bearerJwt);
  if (cookie) {
    h.Cookie = cookie;
  }
  return h;
}

function oauthRefreshConfigured(): boolean {
  const db = import.meta.env.VITE_UPCARE_CRM_OAUTH_DB?.trim();
  const login = import.meta.env.VITE_UPCARE_CRM_OAUTH_LOGIN?.trim();
  const password = import.meta.env.VITE_UPCARE_CRM_OAUTH_PASSWORD?.trim();
  return Boolean(db && login && password);
}

function parseOAuthTokenResponse(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const jwtRe = /\b(eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2})\b/;
  if (trimmed.startsWith('eyJ')) {
    const m = trimmed.match(jwtRe);
    if (m) return m[1];
  }

  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>;
    const keys = ['access_token', 'token', 'authorization', 'accessToken'];
    for (const k of keys) {
      const v = o[k];
      if (typeof v === 'string' && v.startsWith('eyJ')) return normalizeBearerRaw(v);
    }
    const data = o.data;
    if (data && typeof data === 'object' && data !== null) {
      const d = data as Record<string, unknown>;
      for (const k of keys) {
        const v = d[k];
        if (typeof v === 'string' && v.startsWith('eyJ')) return normalizeBearerRaw(v);
      }
    }
  } catch {
    /* không phải JSON */
  }

  const fm = trimmed.match(jwtRe);
  return fm ? fm[1] : null;
}

/**
 * POST /api/oauth/token (multipart: db, login, password) + Cookie hiện tại.
 * Trả true nếu lấy được JWT mới và đã ghi vào bộ nhớ.
 */
async function refreshUpcareTokenViaOAuth(): Promise<boolean> {
  if (!oauthRefreshConfigured()) return false;

  const root = upcareApiRoot();
  const bearerForCookie = getEffectiveBearer();
  const cookie = cookieStringForUpcare(bearerForCookie);
  if (!cookie) return false;

  const db = import.meta.env.VITE_UPCARE_CRM_OAUTH_DB?.trim() ?? '';
  const login = import.meta.env.VITE_UPCARE_CRM_OAUTH_LOGIN?.trim() ?? '';
  const password = import.meta.env.VITE_UPCARE_CRM_OAUTH_PASSWORD?.trim() ?? '';

  const form = new FormData();
  form.append('db', db);
  form.append('login', login);
  form.append('password', password);

  const res = await fetch(`${root}/api/oauth/token`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Accept: 'application/json',
    },
    body: form,
  });

  if (!res.ok) return false;

  const text = await res.text().catch(() => '');
  const newJwt = parseOAuthTokenResponse(text);
  if (!newJwt) return false;

  memoryBearerOverride = newJwt;
  const base = memoryCookieOverride ?? import.meta.env.VITE_UPCARE_CRM_COOKIE?.trim();
  memoryCookieOverride = base ? replaceAuthorizationInCookie(base, newJwt) : null;

  return true;
}

/** Gợi ý lỗi cấu hình (không lộ token) */
export function upcareBearerStatus():
  | { ok: true; length: number }
  | { ok: false; hint: 'missing' | 'empty' } {
  const p = import.meta.env.VITE_UPCARE_CRM_BEARER_TOKEN;
  const a = import.meta.env.VITE_UPCARE_API_TOKEN;
  const hasKey = p !== undefined || a !== undefined;
  const t = getEffectiveBearer();
  if (t.length > 0) return { ok: true, length: t.length };
  if (!hasKey) return { ok: false, hint: 'missing' };
  return { ok: false, hint: 'empty' };
}

/** Đã khai báo db + login + password để tự refresh khi 401 */
export function isUpcareOauthRefreshConfigured(): boolean {
  return oauthRefreshConfigured();
}

/** Mặc định — ghi đè bằng VITE_UPCARE_CRM_PROJECT_UUID; tắt scope: env = none */
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
  return bearerToken().length > 0;
}

export async function fetchUpcareMktEmployees(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<UpcareMktEmployeeRow[]> {
  if (!bearerToken()) {
    throw new Error('Chưa cấu hình VITE_UPCARE_CRM_BEARER_TOKEN trong .env.local');
  }

  const root = upcareApiRoot();
  const qs = new URLSearchParams({
    date_from: params.dateFrom,
    date_to: params.dateTo,
  });
  appendProjectScope(qs);
  const url = `${root}/api/employee/mkt?${qs.toString()}`;

  const doFetch = () =>
    fetch(url, {
      headers: buildUpcareHeaders(),
    });

  let res = await doFetch();
  if (res.status === 401 && (await refreshUpcareTokenViaOAuth())) {
    res = await doFetch();
  }

  const ctype = res.headers.get('content-type') || '';
  const rawText = await res.text().catch(() => '');
  if (!res.ok) {
    const text = rawText;
    const snippet = text.replace(/\s+/g, ' ').slice(0, 280);
    if (res.status === 401) {
      const oauthHint = oauthRefreshConfigured()
        ? ' Đã thử OAuth refresh nhưng vẫn 401 — kiểm tra mật khẩu/db hoặc Cookie (session_id).'
        : ' Có thể cấu hình VITE_UPCARE_CRM_OAUTH_DB / LOGIN / PASSWORD để tự lấy token mới khi hết hạn.';
      throw new Error(
        'Upcare 401 Unauthorized — JWT có thể hết hạn hoặc thiếu cookie phiên. ' +
          'Đăng nhập crm.upcare.asia → DevTools → Network → copy Cookie của request thành công → ' +
          'dán vào VITE_UPCARE_CRM_COOKIE trong .env.local, hoặc lấy JWT mới.' +
          oauthHint +
          ` Chi tiết: ${snippet || res.statusText}`
      );
    }
    if (res.status === 500) {
      throw new Error(
        'Upcare 500 Internal Server Error — lỗi phía server CRM (không phải lỗi build app). ' +
          'Thử: đặt VITE_UPCARE_CRM_PROJECT_UUID=none nếu backend không hỗ trợ project_id; ' +
          'thu hẹp khoảng ngày; so sánh query string với request thành công trên crm.upcare.asia (DevTools). ' +
          `Chi tiết: ${snippet || res.statusText}`
      );
    }
    throw new Error(`Upcare API ${res.status}: ${snippet || res.statusText}`);
  }

  // Một số môi trường (sai proxy/rewrite) trả về HTML 200 OK → phát hiện sớm
  if (/^\s*</.test(rawText) && /<!doctype html|<html/i.test(rawText)) {
    throw new Error(
      'Upcare API trả về HTML thay vì JSON — khả năng cao do cấu hình proxy/rewrite. ' +
        'Production phải đặt VITE_UPCARE_CRM_USE_PROXY=false và VITE_UPCARE_CRM_API_BASE=https://crm.upcare.asia. ' +
        'Chi tiết: ' +
        rawText.replace(/\s+/g, ' ').slice(0, 160)
    );
  }
  let data: unknown;
  try {
    data = ctype.includes('application/json') ? JSON.parse(rawText) : JSON.parse(rawText);
  } catch {
    throw new Error(
      'Không parse được JSON từ Upcare API. Có thể backend trả HTML (rewrite) hoặc text khác. ' +
        'Kiểm tra VITE_UPCARE_CRM_USE_PROXY và base URL. ' +
        `Độ dài phản hồi: ${rawText.length} — snippet: ${rawText.replace(/\s+/g, ' ').slice(0, 160)}`
    );
  }
  if (!Array.isArray(data)) {
    throw new Error('API không trả về mảng JSON');
  }

  return data as UpcareMktEmployeeRow[];
}
