import { createClient } from '@supabase/supabase-js';

export class SupabaseServerConfigError extends Error {}

export function createSupabaseAdminClient(env: Record<string, string | undefined>) {
  const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || '';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  if (!url || !serviceRoleKey) {
    throw new SupabaseServerConfigError('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong environment server.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
