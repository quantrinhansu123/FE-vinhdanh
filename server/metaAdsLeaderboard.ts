import { createClient } from '@supabase/supabase-js';
import { readMetaAccountLeaderboard } from './metaAdsSync';
import { createSupabaseAdminClient, SupabaseServerConfigError } from './supabaseAdmin';

export class SupabaseAuthConfigError extends Error {}
export class SupabaseAuthenticationError extends Error {}
export class SupabaseAuthorizationError extends Error {}

function createSupabasePublicClient(env: Record<string, string | undefined>) {
  const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || '';
  const key = env.SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim() || '';
  if (!url || !key) {
    throw new SupabaseAuthConfigError('Thiếu Supabase URL hoặc publishable/anon key phía client để xác minh phiên đăng nhập.');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function defaultMetaLeaderboardRange(env: Record<string, string | undefined>, now = new Date()) {
  const timezone = env.META_REPORTING_TIMEZONE?.trim() || 'Asia/Ho_Chi_Minh';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const end = new Date(`${today}T12:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() - 6);
  return { dateFrom: end.toISOString().slice(0, 10), dateTo: today };
}

export async function getSupabaseUserFromAccessToken(env: Record<string, string | undefined>, accessToken: string) {
  const authClient = createSupabasePublicClient(env);
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) throw new SupabaseAuthenticationError('Phiên đăng nhập hết hạn hoặc không hợp lệ.');
  return data.user;
}

export async function requireSupabaseAdmin(env: Record<string, string | undefined>, accessToken: string) {
  const user = await getSupabaseUserFromAccessToken(env, accessToken);
  if (user.app_metadata?.role !== 'admin') {
    throw new SupabaseAuthorizationError('Chỉ quản trị viên mới được quản lý tài khoản đăng nhập nhân sự.');
  }
  return user;
}

export async function readMetaLeaderboardForUser(
  env: Record<string, string | undefined>,
  accessToken: string,
  dateFrom: string,
  dateTo: string,
) {
  await getSupabaseUserFromAccessToken(env, accessToken);

  const adminClient = createSupabaseAdminClient(env);
  return readMetaAccountLeaderboard(env, dateFrom, dateTo, adminClient);
}

export function isMetaLeaderboardConfigError(error: unknown): boolean {
  return error instanceof SupabaseAuthConfigError || error instanceof SupabaseServerConfigError;
}
