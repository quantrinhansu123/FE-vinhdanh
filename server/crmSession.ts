import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { IncomingMessage } from 'node:http';

const COOKIE_NAME = 'crm_session';
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const failedLogins = new Map<string, { count: number; until: number }>();

export class CrmSessionError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export type CrmEmployee = {
  id: string;
  email: string;
  name: string;
  team: string | null;
  avatar_url: string | null;
  vi_tri: string | null;
  ma_ns: string | null;
  auth_user_id?: string | null;
};

export type CrmSupabaseSession = {
  access_token: string;
  refresh_token: string;
};

function sessionSecret(env: Record<string, string | undefined>): string {
  const secret = (env.CRM_SESSION_SECRET || env.META_SYNC_SECRET || '').trim();
  if (secret.length < 32) {
    throw new CrmSessionError(503, 'crm_auth_not_configured', 'Chưa cấu hình khóa phiên đăng nhập CRM trên server.');
  }
  return secret;
}

export function createCrmDatabase(env: Record<string, string | undefined>): SupabaseClient {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) {
    throw new CrmSessionError(503, 'crm_auth_not_configured', 'Chưa cấu hình kết nối Supabase server-side.');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function createCrmAuthClient(env: Record<string, string | undefined>): SupabaseClient {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) {
    throw new CrmSessionError(503, 'crm_auth_not_configured', 'Chưa cấu hình Supabase Auth phía server.');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signCrmSession(employeeId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ id: employeeId, exp: Math.floor(now / 1000) + SESSION_LIFETIME_SECONDS })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function readCrmSession(cookieHeader: string, secret: string, now = Date.now()): string | null {
  try {
    const raw = cookieHeader.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    const [payload, supplied, extra] = (raw || '').split('.');
    if (!payload || !supplied || extra || !secureEqual(supplied, signature(payload, secret))) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { id?: unknown; exp?: unknown };
    return typeof decoded.id === 'string' && decoded.id && Number.isInteger(decoded.exp) && Number(decoded.exp) > now / 1000
      ? decoded.id
      : null;
  } catch {
    return null;
  }
}

export function crmSessionCookie(employeeId: string, env: Record<string, string | undefined>): string {
  const secret = sessionSecret(env);
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${signCrmSession(employeeId, secret)}; HttpOnly; SameSite=Strict; Path=/api/; Max-Age=${SESSION_LIFETIME_SECONDS}${secure}`;
}

export function clearedCrmSessionCookie(env: Record<string, string | undefined>): string {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/api/; Max-Age=0${secure}`;
}

export function requireSameOriginCrmRequest(req: IncomingMessage): void {
  if (req.headers['x-crm-request'] !== '1' ||
      ['cross-site', 'same-site'].includes(String(req.headers['sec-fetch-site'] || ''))) {
    throw new CrmSessionError(403, 'forbidden', 'Yêu cầu CRM không hợp lệ.');
  }
}

export function resolveCrmSessionId(req: IncomingMessage, env: Record<string, string | undefined>): string {
  const id = readCrmSession(req.headers.cookie || '', sessionSecret(env));
  if (!id) throw new CrmSessionError(401, 'session_required', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  return id;
}

export async function readCrmEmployee(db: SupabaseClient, env: Record<string, string | undefined>, id: string): Promise<CrmEmployee> {
  const table = env.SUPABASE_EMPLOYEES_TABLE?.trim() || env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
  const { data, error } = await db.from(table)
    .select('id,email,name,team,avatar_url,vi_tri,ma_ns')
    .eq('id', id)
    .abortSignal(AbortSignal.timeout(10000))
    .maybeSingle();
  if (error) throw new CrmSessionError(502, 'crm_auth_failed', 'Không xác thực được tài khoản CRM.');
  if (!data?.email) throw new CrmSessionError(401, 'session_required', 'Tài khoản không còn hoạt động. Vui lòng đăng nhập lại.');
  return {
    id: String(data.id),
    email: String(data.email),
    name: String(data.name || ''),
    team: data.team == null ? null : String(data.team),
    avatar_url: data.avatar_url == null ? null : String(data.avatar_url),
    vi_tri: data.vi_tri == null ? null : String(data.vi_tri),
    ma_ns: data.ma_ns == null ? null : String(data.ma_ns),
  };
}

function employeeTable(env: Record<string, string | undefined>): string {
  return env.SUPABASE_EMPLOYEES_TABLE?.trim() || env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
}

async function findAuthUserIdByEmail(db: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new CrmSessionError(502, 'crm_auth_failed', 'Không thể tra cứu tài khoản Supabase Auth.');
    const users = data.users as Array<{ id: string; email?: string }>;
    const user = users.find((candidate) => candidate.email?.trim().toLowerCase() === email);
    if (user) return user.id;
    if (users.length < 1000) return null;
  }
  throw new CrmSessionError(503, 'crm_auth_not_configured', 'Danh sách tài khoản Auth vượt giới hạn tra cứu an toàn.');
}

async function ensureEmployeeAuthUser(
  db: SupabaseClient,
  env: Record<string, string | undefined>,
  employee: { id: string; email: string; auth_user_id?: string | null },
  password: string,
): Promise<string> {
  const email = employee.email.trim().toLowerCase();
  let authUserId = employee.auth_user_id || null;
  if (authUserId) {
    const { error } = await db.auth.admin.updateUserById(authUserId, { email, password, email_confirm: true });
    if (error) throw new CrmSessionError(502, 'crm_auth_failed', 'Không thể cập nhật mật khẩu Supabase Auth.');
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { employee_id: String(employee.id) },
    });
    if (!error && data.user) {
      authUserId = data.user.id;
    } else {
      authUserId = await findAuthUserIdByEmail(db, email);
      if (!authUserId) throw new CrmSessionError(502, 'crm_auth_failed', 'Không thể tạo tài khoản Supabase Auth.');
      const { error: updateError } = await db.auth.admin.updateUserById(authUserId, { email, password, email_confirm: true });
      if (updateError) throw new CrmSessionError(502, 'crm_auth_failed', 'Không thể liên kết tài khoản Supabase Auth đã có.');
    }
  }

  const { error: linkError } = await db.from(employeeTable(env))
    .update({ auth_user_id: authUserId, pass: null })
    .eq('id', employee.id);
  if (linkError) throw new CrmSessionError(502, 'crm_auth_failed', 'Không thể liên kết nhân sự với tài khoản đăng nhập.');
  return authUserId;
}

export async function setCrmEmployeePassword(
  db: SupabaseClient,
  env: Record<string, string | undefined>,
  employeeId: string,
  password: string,
): Promise<void> {
  if (!employeeId || !password || password.length < 8 || password.length > 1024) {
    throw new CrmSessionError(400, 'invalid_password', 'Mật khẩu mới phải có ít nhất 8 ký tự.');
  }
  const { data, error } = await db.from(employeeTable(env))
    .select('id,email,auth_user_id')
    .eq('id', employeeId)
    .maybeSingle();
  if (error) throw new CrmSessionError(502, 'crm_auth_failed', 'Không tải được hồ sơ nhân sự để cập nhật mật khẩu.');
  if (!data?.email) throw new CrmSessionError(404, 'employee_not_found', 'Không tìm thấy nhân sự có email đăng nhập.');
  await ensureEmployeeAuthUser(db, env, {
    id: String(data.id),
    email: String(data.email),
    auth_user_id: data.auth_user_id == null ? null : String(data.auth_user_id),
  }, password);
}

export async function authenticateCrmEmployee(
  db: SupabaseClient,
  env: Record<string, string | undefined>,
  emailInput: string,
  password: string,
  ip: string,
): Promise<{ employee: CrmEmployee; session: CrmSupabaseSession }> {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 1024) {
    throw new CrmSessionError(401, 'invalid_credentials', 'Sai email hoặc mật khẩu.');
  }
  const key = `${ip.slice(0, 80)}:${email}`;
  const previous = failedLogins.get(key);
  if (previous && previous.until > Date.now() && previous.count >= 10) {
    throw new CrmSessionError(429, 'login_rate_limited', 'Đăng nhập sai quá nhiều lần. Hãy thử lại sau vài phút.');
  }
  const escapedEmail = email.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await db.from(employeeTable(env))
    .select('id,email,name,team,avatar_url,vi_tri,ma_ns,pass,auth_user_id')
    .ilike('email', escapedEmail)
    .limit(2)
    .abortSignal(AbortSignal.timeout(10000));
  if (error) throw new CrmSessionError(502, 'crm_auth_failed', 'Không xác thực được tài khoản CRM.');
  const employee = data?.length === 1 ? data[0] : null;
  if (!employee) {
    if (failedLogins.size > 1000) failedLogins.clear();
    failedLogins.set(key, { count: previous && previous.until > Date.now() ? previous.count + 1 : 1, until: Date.now() + 600000 });
    throw new CrmSessionError(401, 'invalid_credentials', 'Sai email hoặc mật khẩu.');
  }

  const authClient = createCrmAuthClient(env);
  let authUserId = typeof employee.auth_user_id === 'string' ? employee.auth_user_id : null;
  const legacyPasswordMatches = typeof employee.pass === 'string' && secureEqual(employee.pass, password);
  if (!authUserId && legacyPasswordMatches) {
    authUserId = await ensureEmployeeAuthUser(db, env, {
      id: String(employee.id),
      email: String(employee.email),
    }, password);
  }

  if (!authUserId) authUserId = await findAuthUserIdByEmail(db, email);
  let signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error && authUserId && legacyPasswordMatches) {
    authUserId = await ensureEmployeeAuthUser(db, env, {
      id: String(employee.id),
      email: String(employee.email),
      auth_user_id: authUserId,
    }, password);
    signedIn = await authClient.auth.signInWithPassword({ email, password });
  }
  if (signedIn.error || !signedIn.data.session || signedIn.data.user.id !== authUserId) {
    if (failedLogins.size > 1000) failedLogins.clear();
    failedLogins.set(key, { count: previous && previous.until > Date.now() ? previous.count + 1 : 1, until: Date.now() + 600000 });
    throw new CrmSessionError(401, 'invalid_credentials', 'Sai email hoặc mật khẩu.');
  }

  if (!employee.auth_user_id && authUserId) {
    const { error: linkError } = await db.from(employeeTable(env))
      .update({ auth_user_id: authUserId, pass: null })
      .eq('id', employee.id);
    if (linkError) throw new CrmSessionError(502, 'crm_auth_failed', 'Không thể liên kết nhân sự với tài khoản Supabase Auth.');
  }

  if (employee.pass) {
    const { error: clearPassError } = await db.from(employeeTable(env)).update({ pass: null }).eq('id', employee.id);
    if (clearPassError) throw new CrmSessionError(502, 'crm_auth_failed', 'Đăng nhập được nhưng chưa thể xóa mật khẩu cũ khỏi hồ sơ.');
  }
  failedLogins.delete(key);
  return {
    employee: {
      id: String(employee.id),
      email: String(employee.email),
      name: String(employee.name || ''),
      team: employee.team == null ? null : String(employee.team),
      avatar_url: employee.avatar_url == null ? null : String(employee.avatar_url),
      vi_tri: employee.vi_tri == null ? null : String(employee.vi_tri),
      ma_ns: employee.ma_ns == null ? null : String(employee.ma_ns),
    },
    session: {
      access_token: signedIn.data.session.access_token,
      refresh_token: signedIn.data.session.refresh_token,
    },
  };
}

export function publicCrmUser(employee: CrmEmployee) {
  return {
    id: employee.id,
    email: employee.email,
    role: employee.email.trim().toLowerCase() === 'upedu2024@gmail.com' ? 'admin' as const : 'user' as const,
    name: employee.name,
    team: employee.team || '',
    avatar_url: employee.avatar_url,
    vi_tri: employee.vi_tri,
    ma_ns: employee.ma_ns,
  };
}

export function crmErrorResponse(error: unknown) {
  return error instanceof CrmSessionError
    ? { status: error.status, body: { error: error.code, message: error.message } }
    : { status: 502, body: { error: 'crm_request_failed', message: 'Không xử lý được yêu cầu CRM.' } };
}

export function sessionLifetimeSeconds(): number {
  return SESSION_LIFETIME_SECONDS;
}
