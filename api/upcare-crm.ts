import type { IncomingMessage, ServerResponse } from 'node:http';
import { createUpcareClient, UpcareAuthError } from '../server/upcareClient';

// Reuse the renewed token across requests within a running serverless instance.
let client: ReturnType<typeof createUpcareClient> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const json = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return json(405, { error: 'method_not_allowed' });
  }
  const url = new URL(req.url || '/', 'http://localhost');
  if (!['/api/upcare-crm', '/api/upcare-crm/api/employee/mkt'].includes(url.pathname)) {
    return json(404, { error: 'not_found' });
  }
  const pathAndQuery = `/api/employee/mkt${url.search}`;
  try {
    client ??= createUpcareClient(process.env);
    const response = await client.request(pathAndQuery);
    res.statusCode = response.status;
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    res.end(await response.text());
  } catch (error) {
    if (error instanceof UpcareAuthError) {
      return json(502, { error: 'upcare_auth_failed', message: error.message });
    }
    return json(502, { error: 'upcare_proxy_failed', message: 'Upcare connection failed. Please try again.' });
  }
}
