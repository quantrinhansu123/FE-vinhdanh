import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { isAdminViTriPosition } from '../src/utils/crmNavAccess';
import { createMetaClient, metaAccountIds, metaDateRange, MetaError } from './metaClient';
import { metaReportToQcRows } from './metaQc';

const cookieName = 'meta_qc_session';
const lifetime = 3600;
const failures = new Map<string, { count: number; until: number }>();
const forbidden = () => new MetaError(403, 'forbidden', 'Tài khoản CRM không có quyền nhập dữ liệu QC.');

function equal(a: string, b: string) {
  return Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function signMetaQcSession(id: string, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ id, exp: Math.floor(now / 1000) + lifetime })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function readMetaQcSession(cookie: string, secret: string, now = Date.now()): string | null {
  try {
    const value = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const [payload, signature, extra] = (value || '').split('.');
    if (!payload || !signature || extra || !equal(signature, createHmac('sha256', secret).update(payload).digest('base64url'))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.id === 'string' && data.id && Number.isInteger(data.exp) && data.exp > now / 1000 ? data.id : null;
  } catch { return null; }
}

async function requestBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  // Vercel may parse JSON before calling the handler; Vite leaves a stream.
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
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new MetaError(400, 'invalid_request', 'Yêu cầu không hợp lệ.'); }
}

export function createMetaQcHandler(env: Record<string, string | undefined>, options: { fetch?: typeof fetch } = {}) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const json = (status: number, data: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
    };
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!['GET', 'POST'].includes(req.method || '')) {
        res.setHeader('Allow', 'GET, POST');
        throw new MetaError(405, 'method_not_allowed', 'Phương thức không hợp lệ.');
      }
      // A non-simple header and same-site cookies block cross-site form calls.
      if (req.headers['x-meta-qc-request'] !== '1' ||
          ['cross-site', 'same-site'].includes(String(req.headers['sec-fetch-site'] || ''))) throw forbidden();
      const secret = env.META_SYNC_SECRET?.trim();
      const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim();
      const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!secret || secret.length < 32 || !url || !key) throw new MetaError(503, 'meta_qc_not_configured',
        'Chưa cấu hình Meta và khóa Supabase trên server.');
      const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
        global: options.fetch ? { fetch: options.fetch } : undefined });
      const table = env.SUPABASE_EMPLOYEES_TABLE?.trim() || env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
      const route = new URL(req.url || '/', 'http://localhost');
      const action = route.searchParams.get('action');
      const isAdmin = (employee: { email?: string; vi_tri?: string }) =>
        employee.email?.trim().toLowerCase() === 'upedu2024@gmail.com' || isAdminViTriPosition(employee.vi_tri);
      if (req.method === 'POST' && action === 'login') {
        const body = await requestBody(req);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 1024) {
          throw new MetaError(401, 'invalid_credentials', 'Sai email hoặc mật khẩu.');
        }
        const failed = failures.get(email);
        if (failed && failed.until > Date.now() && failed.count >= 10) throw new MetaError(429, 'login_rate_limited', 'Thử lại sau vài phút.');
        const { data, error } = await db.from(table).select('id,email,pass,vi_tri').ilike('email', email.replace(/[\\%_]/g, '\\$&')).limit(2)
          .abortSignal(AbortSignal.timeout(10000));
        if (error) throw new MetaError(502, 'crm_auth_failed', 'Không xác thực được tài khoản CRM.');
        const employee = data?.length === 1 ? data[0] : undefined;
        if (!employee || typeof employee.pass !== 'string' || !equal(employee.pass, password)) {
          if (failures.size > 1000) failures.clear();
          failures.set(email, { count: failed && failed.until > Date.now() ? failed.count + 1 : 1, until: Date.now() + 600000 });
          throw new MetaError(401, 'invalid_credentials', 'Sai email hoặc mật khẩu.');
        }
        if (!isAdmin(employee)) throw forbidden();
        failures.delete(email);
        const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
        res.setHeader('Set-Cookie', `${cookieName}=${signMetaQcSession(employee.id, secret)}; HttpOnly; SameSite=Strict; Path=/api/meta-qc; Max-Age=${lifetime}${secure}`);
        return json(200, { accounts: metaAccountIds(env) });
      }
      const id = readMetaQcSession(req.headers.cookie || '', secret);
      if (!id) throw new MetaError(401, 'session_required', 'Xác nhận tài khoản CRM để lấy dữ liệu Meta.');
      const { data: employee, error: authError } = await db.from(table).select('email,vi_tri').eq('id', id)
        .abortSignal(AbortSignal.timeout(10000)).maybeSingle();
      if (authError) throw new MetaError(502, 'crm_auth_failed', 'Không xác thực được tài khoản CRM.');
      if (!employee || !isAdmin(employee)) throw forbidden();
      if (req.method === 'GET') return json(200, { accounts: metaAccountIds(env) });
      const body = await requestBody(req);
      const account = typeof body.account_id === 'string' ? body.account_id : '';
      if (!/^(act_)?\d+$/.test(account) || typeof body.since !== 'string' || typeof body.until !== 'string') {
        throw new MetaError(400, 'invalid_request', 'Chọn tài khoản và khoảng ngày hợp lệ.');
      }
      const range = metaDateRange(env, body.since, body.until);
      const signal = AbortSignal.timeout(45000);
      const report = await createMetaClient(env, options).insights(account, range, signal);
      const rows = metaReportToQcRows(report);
      const { data: count, error } = await db.rpc('replace_meta_qc_excel', {
        p_account_id: report.account_id, p_since: range.since, p_until: range.until, p_rows: rows,
      }).abortSignal(AbortSignal.timeout(10000));
      if (error) throw new MetaError(502, 'meta_qc_storage_failed',
        'Không lưu được dữ liệu. Kiểm tra migration supabase/create_meta_qc_import.sql và quyền server.');
      return json(200, { account_id: report.account_id, rows_saved: Number(count) || 0,
        missing_employee_code: rows.filter(row => !row.ma_nv).length, account_timezone: report.account_timezone });
    } catch (error) {
      if (error instanceof MetaError) return json(error.status, { error: error.code, message: error.message });
      return json(502, { error: 'meta_qc_failed', message: 'Không lấy được dữ liệu Meta. Hãy thử lại với khoảng ngày ngắn hơn.' });
    }
  };
}
