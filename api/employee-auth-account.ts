import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  EmployeeAuthAccountError,
  syncEmployeeAuthAccounts,
  type EmployeeAuthAccountInput,
} from '../server/employeeAuthAccounts';
import {
  isMetaLeaderboardConfigError,
  SupabaseAuthenticationError,
  SupabaseAuthorizationError,
} from '../server/metaAdsLeaderboard';

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const parsedBody = (req as IncomingMessage & { body?: unknown }).body;
  if (parsedBody !== undefined) {
    const size = Buffer.byteLength(typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody));
    if (size > 128 * 1024) throw new EmployeeAuthAccountError('Nội dung yêu cầu vượt quá giới hạn.');
    if (typeof parsedBody === 'string') {
      try { return JSON.parse(parsedBody); } catch { throw new EmployeeAuthAccountError('Nội dung JSON không hợp lệ.'); }
    }
    return parsedBody;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > 128 * 1024) throw new EmployeeAuthAccountError('Nội dung yêu cầu vượt quá giới hạn.');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new EmployeeAuthAccountError('Nội dung JSON không hợp lệ.');
  }
}

export async function handleEmployeeAuthAccount(req: IncomingMessage, res: ServerResponse, env = process.env) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  const rawAuthorization = req.headers.authorization;
  const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] || '' : rawAuthorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'authentication_required' }));
    return;
  }

  try {
    const rawBody = await readJsonBody(req);
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      throw new EmployeeAuthAccountError('Nội dung yêu cầu phải là một object JSON.');
    }
    const body = rawBody as { accounts?: unknown; account?: unknown };
    const items = Array.isArray(body.accounts) ? body.accounts : [body.account ?? body];
    if (!items.length || items.length > 100) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'invalid_account_count', message: 'Gửi từ 1 đến 100 tài khoản mỗi lần.' }));
      return;
    }

    const accounts = items.map((item) => item && typeof item === 'object'
      ? item as EmployeeAuthAccountInput
      : {} as EmployeeAuthAccountInput);
    const results = await syncEmployeeAuthAccounts(env, match[1], accounts);
    const failed = results.filter((result) => !result.ok).length;
    res.statusCode = failed ? 207 : 200;
    res.end(JSON.stringify({ ok: failed === 0, updated: results.length - failed, failed, results }));
  } catch (error) {
    if (error instanceof SupabaseAuthenticationError) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'authentication_required', message: error.message }));
      return;
    }
    if (error instanceof SupabaseAuthorizationError) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'admin_required', message: error.message }));
      return;
    }
    if (error instanceof EmployeeAuthAccountError) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'invalid_request', message: error.message }));
      return;
    }
    if (isMetaLeaderboardConfigError(error)) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'configuration_error', message: (error as Error).message }));
      return;
    }
    console.error('[employee-auth-account] Request failed:', error instanceof Error ? error.message : 'unknown error');
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'employee_auth_sync_failed', message: 'Không thể đồng bộ tài khoản đăng nhập.' }));
  }
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleEmployeeAuthAccount(req, res);
}
