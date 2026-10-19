import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMetaClient, MetaError, metaDateRange } from './metaClient.js';
import { createMetaStore } from './metaSync.js';

export function createMetaHandler(env: Record<string, string | undefined>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    };
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return json(405, { error: 'method_not_allowed' });
    }
    const secret = env.META_SYNC_SECRET?.trim();
    if (!secret || secret.length < 32) return json(503, { error: 'meta_not_configured',
      message: 'Configure META_SYNC_SECRET with at least 32 characters on the server.' });
    const supplied = req.headers.authorization || '';
    const expected = `Bearer ${secret}`;
    if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return json(401, { error: 'unauthorized' });
    }
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname !== '/api/meta-ads') return json(404, { error: 'not_found' });
      const account = url.searchParams.get('account_id');
      if (!account || !/^(act_)?\d+$/.test(account)) {
        throw new MetaError(400, 'invalid_account', 'Provide one configured account_id per request.');
      }
      const range = metaDateRange(env, url.searchParams.get('since'), url.searchParams.get('until'));
      // Fail missing storage config before spending requests on Meta.
      const save = req.method === 'POST' ? createMetaStore(env) : undefined;
      const signal = AbortSignal.timeout(55000);
      const report = await createMetaClient(env).insights(account, range, signal);
      return json(200, save ? await save(report, signal) : report);
    } catch (error) {
      if (error instanceof MetaError) return json(error.status, { error: error.code, message: error.message });
      return json(502, { error: 'meta_operation_failed', message: 'Meta operation failed. Please retry with a smaller date range.' });
    }
  };
}
