import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { syncMetaAds } from '../server/metaAdsSync';
import { MetaAdsConfigError } from '../server/metaAdsClient';
import { SupabaseServerConfigError } from '../server/supabaseAdmin';

function isAuthorized(req: IncomingMessage): boolean {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const rawHeader = req.headers.authorization;
  const authorization = Array.isArray(rawHeader) ? rawHeader[0] || '' : rawHeader || '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(authorization);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }
  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');
  if (Boolean(dateFrom) !== Boolean(dateTo)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'date_range_requires_both_dates' }));
    return;
  }

  try {
    const result = await syncMetaAds(process.env, { dateFrom, dateTo });
    // Mark partial account failures as an unsuccessful cron invocation so they
    // are visible in Vercel's cron logs and can be retried on the next hour.
    res.statusCode = result.ok ? 200 : 502;
    res.end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof MetaAdsConfigError || error instanceof SupabaseServerConfigError) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'configuration_error', message: error.message }));
      return;
    }
    console.error('[meta-ads-sync] Sync failed:', error instanceof Error ? error.message : 'unknown error');
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'meta_ads_sync_failed', message: 'Facebook Ads sync failed. Check server logs.' }));
  }
}
