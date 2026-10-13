import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadMetaProjectQcRows, MetaProjectQcError } from '../server/metaProjectQc';
import { requireMetaQcAdminSession } from '../server/metaQcHandler';

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
  const dateFrom = url.searchParams.get('from') || '';
  const dateTo = url.searchParams.get('to') || '';
  try {
    await requireMetaQcAdminSession(req, process.env);
    const result = await loadMetaProjectQcRows(process.env, dateFrom, dateTo);
    return json(200, result);
  } catch (error) {
    if (error instanceof Error && 'status' in error && typeof error.status === 'number' &&
        'code' in error && typeof error.code === 'string') {
      return json(error.status, { error: error.code, message: error.message });
    }
    if (error instanceof MetaProjectQcError) {
      return json(error.statusCode, { error: error.errorCode, message: error.message });
    }
    return json(502, { error: 'meta_project_qc_failed', message: 'Không tải được dữ liệu từ Meta. Hãy thử lại sau.' });
  }
}
