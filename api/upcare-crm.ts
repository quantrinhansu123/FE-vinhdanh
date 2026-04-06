import type { VercelRequest, VercelResponse } from '@vercel/node';

function allowCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const upstreamBase = process.env.UPCARE_CRM_API_BASE?.trim() || 'https://crm.upcare.asia';
    let bearer = (process.env.UPCARE_CRM_BEARER_TOKEN || '').trim();
    let cookie = (process.env.UPCARE_CRM_COOKIE || '').trim();

    // Build upstream URL by stripping the function base (/api/upcare-crm)
    const originalUrl = req.url || '/';
    const pathAndQuery = originalUrl.replace(/^\/api\/upcare-crm/, '') || '/';
    const upstreamUrl = `${upstreamBase.replace(/\/$/, '')}${pathAndQuery}`;

    async function doProxy(currentBearer: string, currentCookie: string) {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (currentBearer) {
        headers.Authorization = `Bearer ${currentBearer}`;
      }
      if (currentCookie) {
        headers.Cookie = currentCookie;
      }

      const init: RequestInit = {
        method: req.method,
        headers,
      };
      if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
      return fetch(upstreamUrl, init as any);
    }

    let upstreamRes = await doProxy(bearer, cookie);

    // On 401, try OAuth refresh if configured
    if (upstreamRes.status === 401) {
      const db = (process.env.UPCARE_CRM_OAUTH_DB || '').trim();
      const login = (process.env.UPCARE_CRM_OAUTH_LOGIN || '').trim();
      const password = (process.env.UPCARE_CRM_OAUTH_PASSWORD || '').trim();
      const oauthUrl = `${upstreamBase.replace(/\/$/, '')}/api/oauth/token`;
      if (db && login && password && cookie) {
        const form = new FormData();
        form.append('db', db);
        form.append('login', login);
        form.append('password', password);
        const r = await fetch(oauthUrl, {
          method: 'POST',
          headers: { Cookie: cookie, Accept: 'application/json' },
          body: form as any,
        });
        const txt = await r.text().catch(() => '');
        const jwtMatch =
          txt.match(/\b(eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2})\b/) ||
          (() => {
            try {
              const obj = JSON.parse(txt);
              const k = ['access_token', 'token', 'authorization', 'accessToken'];
              for (const key of k) {
                if (typeof obj[key] === 'string' && obj[key].startsWith('eyJ')) return [{ 0: obj[key] } as any];
              }
              if (obj?.data && typeof obj.data === 'object') {
                for (const key of k) {
                  if (typeof obj.data[key] === 'string' && obj.data[key].startsWith('eyJ')) return [{ 0: obj.data[key] } as any];
                }
              }
            } catch {}
            return null;
          })();
        if (jwtMatch && jwtMatch[0]) {
          bearer = String(jwtMatch[0]).trim();
          // Keep same cookie; if bạn muốn đồng bộ authorization=… trong cookie:
          if (/authorization=/.test(cookie)) {
            cookie = cookie.replace(/authorization=[^;]*/i, `authorization=${bearer}`);
          }
          upstreamRes = await doProxy(bearer, cookie);
        }
      }
    }

    const text = await upstreamRes.text().catch(() => '');
    // Proxy status and content-type
    const ct = upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8';
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', ct);
    // Simple passthrough
    return res.send(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: 'proxy_failed', message: msg });
  }
}

