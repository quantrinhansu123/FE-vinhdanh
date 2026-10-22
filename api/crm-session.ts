import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  authenticateCrmEmployee,
  clearedCrmSessionCookie,
  createCrmDatabase,
  crmErrorResponse,
  crmSessionCookie,
  publicCrmUser,
  readCrmEmployee,
  requireSameOriginCrmRequest,
  resolveCrmSessionId,
} from '../server/crmSession.js';

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  let raw = typeof parsed === 'string' ? parsed : '';
  if (parsed === undefined) {
    for await (const chunk of req) {
      raw += chunk.toString();
      if (Buffer.byteLength(raw) > 4096) throw new Error('request_too_large');
    }
  }
  if (Buffer.byteLength(raw) > 4096) throw new Error('request_too_large');
  const body = JSON.parse(raw) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_request');
  return body as Record<string, unknown>;
}

export function createCrmSessionHandler(env: Record<string, string | undefined>) {
  return async function handler(req: IncomingMessage, res: ServerResponse) {
  const json = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return json(405, { error: 'method_not_allowed' });
    }
    requireSameOriginCrmRequest(req);
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', clearedCrmSessionCookie(env));
      return json(200, { ok: true });
    }
    const db = createCrmDatabase(env);
    if (req.method === 'POST') {
      const body = await readBody(req);
      const employee = await authenticateCrmEmployee(
        db,
        env,
        typeof body.email === 'string' ? body.email : '',
        typeof body.password === 'string' ? body.password : '',
        req.socket.remoteAddress || 'unknown',
      );
      res.setHeader('Set-Cookie', crmSessionCookie(employee.employee.id, env));
      return json(200, { user: publicCrmUser(employee.employee), session: employee.session });
    }
    const id = resolveCrmSessionId(req, env);
    const employee = await readCrmEmployee(db, env, id);
    return json(200, { user: publicCrmUser(employee) });
  } catch (error) {
    const response = crmErrorResponse(error);
    const status = error instanceof Error && ['request_too_large', 'invalid_request'].includes(error.message) ? 400 : response.status;
    return json(status, status === response.status ? response.body : { error: error instanceof Error ? error.message : 'invalid_request', message: 'Dữ liệu đăng nhập không hợp lệ.' });
  }
  };
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return createCrmSessionHandler(process.env)(req, res);
}
