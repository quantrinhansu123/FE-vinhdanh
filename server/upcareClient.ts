type UpcareEnv = Record<string, string | undefined>;
type ClientOptions = { fetch?: typeof fetch; now?: () => number };

export class UpcareAuthError extends Error {}

function normalizeToken(value: string): string {
  return value.trim().replace(/^Bearer\s+/i, '');
}

function tokenExpiry(token: string): number | null {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof claims.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

function parseToken(text: string): string | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(text.trim()) ? text.trim() : null;
  }
  const queue: unknown[] = [data];
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    for (const key of ['access_token', 'accessToken', 'token', 'authorization']) {
      const value = record[key];
      if (typeof value === 'string' && normalizeToken(value)) return normalizeToken(value);
    }
    queue.push(...Object.values(record).filter(value => value && typeof value === 'object'));
  }
  return null;
}

function updateCookies(current: string, token: string, setCookies: string[] = []): string {
  const cookies = new Map<string, string>();
  for (const raw of current.split(';')) {
    const index = raw.indexOf('=');
    if (index > 0) cookies.set(raw.slice(0, index).trim(), raw.slice(index + 1).trim());
  }
  for (const raw of setCookies) {
    const pair = raw.split(';')[0];
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const name = pair.slice(0, index).trim();
    if (/;\s*max-age=0(?:;|$)/i.test(raw)) cookies.delete(name);
    else cookies.set(name, pair.slice(index + 1));
  }
  cookies.set('authorization', token);
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

function loginFailure(status: number, text: string): UpcareAuthError {
  // Only expose known error codes, never an upstream response containing credentials.
  let reason = '';
  try {
    const data = JSON.parse(text);
    if (['invalid_database', 'invalid_credentials', 'access_denied'].includes(data?.message)) {
      reason = `: ${data.message}`;
    }
  } catch { /* Non-JSON failures still get their HTTP status. */ }
  return new UpcareAuthError(`Đăng nhập Upcare thất bại (HTTP ${status})${reason}.`);
}

/** Server-only client. Each running instance caches its token and shares one pending login. */
export function createUpcareClient(env: UpcareEnv, options: ClientOptions = {}) {
  const request = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const base = (env.UPCARE_CRM_API_BASE?.trim() || 'https://crm.upcare.cloud').replace(/\/$/, '');
  const db = env.UPCARE_CRM_OAUTH_DB?.trim() || '';
  const login = env.UPCARE_CRM_OAUTH_LOGIN?.trim() || '';
  const password = env.UPCARE_CRM_OAUTH_PASSWORD || '';
  const canLogin = Boolean(db && login && password);
  let bearer = normalizeToken(env.UPCARE_CRM_BEARER_TOKEN || '');
  let cookie = env.UPCARE_CRM_COOKIE?.trim() || '';
  if (bearer) cookie = updateCookies(cookie, bearer);
  let expiresAt = tokenExpiry(bearer);
  let version = 0;
  let pendingLogin: Promise<void> | null = null;

  async function loginWithCredentials(): Promise<void> {
    if (!canLogin) throw new UpcareAuthError('Chưa cấu hình tài khoản đăng nhập Upcare trên server.');
    const form = new FormData();
    // Multipart string fields, not JSON objects from the documentation's type examples.
    form.append('db', db);
    form.append('login', login);
    form.append('password', password);
    const response = await request(`${base}/api/oauth/token`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form,
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    if (!response.ok) throw loginFailure(response.status, text);
    const token = parseToken(text);
    if (!token) throw new UpcareAuthError('Đăng nhập Upcare thành công nhưng phản hồi thiếu access_token.');
    bearer = token;
    cookie = updateCookies(cookie, token, response.headers.getSetCookie());
    expiresAt = tokenExpiry(token);
    version += 1;
  }

  async function refresh(): Promise<void> {
    if (!pendingLogin) {
      pendingLogin = loginWithCredentials().finally(() => { pendingLogin = null; });
    }
    return pendingLogin;
  }

  return {
    async request(pathAndQuery: string, init: RequestInit = {}): Promise<Response> {
      const url = new URL(`${base}${pathAndQuery}`);
      // Expose only MKT data to the browser, never credential/token endpoints.
      if (url.origin !== new URL(base).origin || url.pathname !== '/api/employee/mkt' || (init.method && init.method !== 'GET')) {
        throw new Error('Unsupported Upcare request');
      }
      if (pendingLogin) await pendingLogin;
      else if (canLogin && (!bearer || (expiresAt !== null && expiresAt <= now() + 60000))) await refresh();
      else if (!bearer && !canLogin) throw new UpcareAuthError('Chưa cấu hình tài khoản đăng nhập Upcare trên server.');

      const send = () => {
        const headers = new Headers(init.headers);
        headers.set('Accept', 'application/json');
        if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
        if (cookie) headers.set('Cookie', cookie);
        return request(url, { ...init, headers, redirect: 'error', signal: init.signal ?? AbortSignal.timeout(30000) });
      };
      const usedVersion = version;
      const response = await send();
      if (response.status !== 401 || !canLogin) return response;
      await response.body?.cancel();
      // A concurrent request may already have replaced the rejected token.
      if (version === usedVersion) await refresh();
      return send(); // Retry once; a repeated 401 is returned to the caller.
    },
  };
}
