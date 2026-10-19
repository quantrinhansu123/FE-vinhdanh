import type { IncomingMessage, ServerResponse } from 'node:http';
import { MetaError } from './metaClient.js';
import { MetaDetailReportSyncError, syncMetaProjectQcToDetailReports } from './metaDetailReportSync.js';
import { loadMetaProjectQcRows, MetaProjectQcError } from './metaProjectQc.js';
import { requireMetaQcAdminSession } from './metaQcHandler.js';

async function readRequestBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  let raw = typeof parsed === 'string' ? parsed : '';
  if (parsed === undefined) {
    for await (const chunk of req) {
      raw += chunk.toString();
      if (Buffer.byteLength(raw) > 4096) throw new MetaError(413, 'request_too_large', 'Yêu cầu quá lớn.');
    }
  }
  if (Buffer.byteLength(raw) > 4096) throw new MetaError(413, 'request_too_large', 'Yêu cầu quá lớn.');
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new MetaError(400, 'invalid_request', 'Yêu cầu không hợp lệ.');
  }
}

function errorResponse(error: unknown) {
  if (error instanceof MetaError) return { status: error.status, body: { error: error.code, message: error.message } };
  if (error instanceof MetaProjectQcError) return {
    status: error.statusCode,
    body: { error: error.errorCode, message: error.message },
  };
  if (error instanceof MetaDetailReportSyncError) return {
    status: error.statusCode,
    body: { error: error.errorCode, message: error.message },
  };
  return { status: 502, body: { error: 'meta_project_qc_failed', message: 'Không tải hoặc đồng bộ được dữ liệu Meta.' } };
}

export function createMetaProjectQcHandler(
  env: Record<string, string | undefined>,
  options: { allowLocalReadWithoutSession?: boolean } = {}
) {
  return async (req: IncomingMessage, res: ServerResponse) => {
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
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      return json(405, { error: 'method_not_allowed' });
    }

    try {
      if (!(options.allowLocalReadWithoutSession && req.method === 'GET')) {
        await requireMetaQcAdminSession(req, env);
      }
      const url = new URL(req.url || '/', 'http://localhost');
      let dateFrom: string;
      let dateTo: string;
      let action = '';
      if (req.method === 'GET') {
        dateFrom = url.searchParams.get('from') || '';
        dateTo = url.searchParams.get('to') || '';
      } else {
        action = url.searchParams.get('action') || '';
        if (action !== 'sync-detail-reports') {
          throw new MetaError(400, 'invalid_action', 'Yêu cầu đồng bộ Meta không hợp lệ.');
        }
        const body = await readRequestBody(req);
        dateFrom = typeof body.from === 'string' ? body.from : '';
        dateTo = typeof body.to === 'string' ? body.to : '';
      }

      const result = await loadMetaProjectQcRows(env, dateFrom, dateTo);
      if (req.method === 'GET') return json(200, result);
      const synced = await syncMetaProjectQcToDetailReports(env, result, dateFrom, dateTo);
      return json(200, synced);
    } catch (error) {
      const response = errorResponse(error);
      return json(response.status, response.body);
    }
  };
}
