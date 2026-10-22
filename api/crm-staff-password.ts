import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createCrmDatabase,
  crmErrorResponse,
  readCrmEmployee,
  requireSameOriginCrmRequest,
  resolveCrmSessionId,
  setCrmEmployeePassword,
} from '../server/crmSession.js';
import { isAdminViTriPosition } from '../src/utils/crmNavAccess.js';

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  let raw = typeof parsed === 'string' ? parsed : '';
  if (parsed === undefined) {
    for await (const chunk of req) {
      raw += chunk.toString();
      if (Buffer.byteLength(raw) > 64_000) throw new Error('request_too_large');
    }
  }
  if (Buffer.byteLength(raw) > 64_000) throw new Error('request_too_large');
  const body = JSON.parse(raw) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_request');
  return body as Record<string, unknown>;
}

export function createCrmStaffPasswordHandler(env: Record<string, string | undefined>) {
  return async function handler(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'method_not_allowed' }));
      return;
    }
    try {
      requireSameOriginCrmRequest(req);
      const db = createCrmDatabase(env);
      const viewer = await readCrmEmployee(db, env, resolveCrmSessionId(req, env));
      const isAdmin = viewer.email.trim().toLowerCase() === 'upedu2024@gmail.com' || isAdminViTriPosition(viewer.vi_tri);
      if (!isAdmin) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: 'admin_required', message: 'Chỉ quản trị viên mới được đặt mật khẩu nhân sự.' }));
        return;
      }
      const body = await readBody(req);
      const updates = Array.isArray(body.updates)
        ? body.updates
        : [{ employeeId: body.employeeId, password: body.password }];
      if (!updates.length || updates.length > 100) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'invalid_request', message: 'Mỗi lần chỉ cập nhật tối đa 100 mật khẩu.' }));
        return;
      }
      const outcomes: { employeeId: string; ok: boolean; message?: string }[] = [];
      for (let index = 0; index < updates.length; index += 10) {
        const batch = updates.slice(index, index + 10);
        const batchResults = await Promise.all(batch.map(async (item) => {
          if (!item || typeof item !== 'object') return { employeeId: '', ok: false, message: 'Dữ liệu không hợp lệ.' };
          const row = item as Record<string, unknown>;
          const employeeId = typeof row.employeeId === 'string' ? row.employeeId : '';
          const password = typeof row.password === 'string' ? row.password : '';
          try {
            await setCrmEmployeePassword(db, env, employeeId, password);
            return { employeeId, ok: true };
          } catch (error) {
            const response = crmErrorResponse(error);
            return { employeeId, ok: false, message: response.body.message };
          }
        }));
        outcomes.push(...batchResults);
      }
      res.statusCode = outcomes.every((row) => row.ok) ? 200 : 207;
      res.end(JSON.stringify({ updated: outcomes.filter((row) => row.ok).length, outcomes }));
    } catch (error) {
      const response = crmErrorResponse(error);
      const status = error instanceof Error && ['request_too_large', 'invalid_request'].includes(error.message) ? 400 : response.status;
      res.statusCode = status;
      res.end(JSON.stringify(status === response.status ? response.body : { error: error instanceof Error ? error.message : 'invalid_request', message: 'Dữ liệu cập nhật không hợp lệ.' }));
    }
  };
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return createCrmStaffPasswordHandler(process.env)(req, res);
}
