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
    const bearer = (process.env.UPCARE_CRM_BEARER_TOKEN || '').trim();
    const cookie = (process.env.UPCARE_CRM_COOKIE || '').trim();

    // Build upstream URL by stripping the function base (/api/upcare-crm)
    const originalUrl = req.url || '/';
    const pathAndQuery = originalUrl.replace(/^\/api\/upcare-crm/, '') || '/';
    const upstreamUrl = `${upstreamBase.replace(/\/$/, '')}${pathAndQuery}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    }
    if (cookie) {
      headers.Cookie = cookie;
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

    const upstreamRes = await fetch(upstreamUrl, init as any);
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

