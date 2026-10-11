import { createClient } from '@supabase/supabase-js';
import { MetaError, type MetaReport } from './metaClient';

/** Service credentials stay in the server module; browser roles have no table access. */
export function createMetaStore(env: Record<string, string | undefined>, options: { fetch?: typeof fetch } = {}) {
  const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new MetaError(503, 'meta_storage_not_configured',
    'Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: options.fetch ? { fetch: options.fetch } : undefined,
  });
  return async (report: MetaReport, signal?: AbortSignal) => {
    // One transaction replaces the complete account/date slice, including empty
    // reports. Interrupted pagination must never overwrite previously saved data.
    const query = db.rpc('replace_meta_ads_insights', {
      p_account_id: report.account_id, p_since: report.range.since, p_until: report.range.until,
      p_timezone: report.account_timezone, p_fetched_at: report.fetched_at, p_rows: report.data,
    });
    const { error } = await query.abortSignal(signal || AbortSignal.timeout(30000));
    if (error) throw new MetaError(502, 'meta_storage_failed',
      'Cannot save Meta data. Check the Supabase migration and server service-role key.');
    return { account_id: report.account_id, range: report.range,
      account_timezone: report.account_timezone, rows_saved: report.data.length, fetched_at: report.fetched_at };
  };
}
