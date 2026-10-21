import type { IncomingMessage, ServerResponse } from 'node:http';
import { createUpcareClient, UpcareAuthError } from '../server/upcareClient.js';
import { requestUpcareSaleOnlyPayload, UpcareSaleRequestError } from '../server/upcareSales.js';

export function createUpcareSaleHandler(env: Record<string, string | undefined>) {
  let client: ReturnType<typeof createUpcareClient> | undefined;
  return async function handler(req: IncomingMessage, res: ServerResponse) {
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
    if (url.pathname !== '/api/upcare-crm-sale') return json(404, { error: 'not_found' });
    try {
      client ??= createUpcareClient(env);
      const payload = await requestUpcareSaleOnlyPayload(client, url.searchParams, env);
      return json(200, payload);
    } catch (error) {
      if (error instanceof UpcareAuthError) {
        return json(502, { error: 'upcare_auth_failed', message: error.message });
      }
      if (error instanceof UpcareSaleRequestError) {
        return json(error.status, { error: 'upcare_sale_source_failed', message: error.message });
      }
      return json(502, { error: 'upcare_proxy_failed', message: 'Upcare connection failed. Please try again.' });
    }
  };
}

let defaultHandler: ReturnType<typeof createUpcareSaleHandler> | undefined;
export default function handler(req: IncomingMessage, res: ServerResponse) {
  defaultHandler ??= createUpcareSaleHandler(process.env);
  return defaultHandler(req, res);
}
