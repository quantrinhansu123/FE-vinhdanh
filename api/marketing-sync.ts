import type { IncomingMessage, ServerResponse } from 'node:http';
import { isCronAuthorized } from '../server/cronAuth';
import { syncMarketingSources } from '../server/marketingSync';
import { MetaAdsConfigError } from '../server/metaAdsClient';
import { SupabaseServerConfigError } from '../server/supabaseAdmin';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }
  if (!isCronAuthorized(req)) {
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
    const result = await syncMarketingSources(process.env, { dateFrom, dateTo });
    res.statusCode = result.ok ? 200 : 207;
    res.end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof MetaAdsConfigError || error instanceof SupabaseServerConfigError) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'configuration_error', message: error.message }));
      return;
    }
    console.error('[marketing-sync] Sync failed:', error instanceof Error ? error.message : 'unknown error');
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'marketing_sync_failed', message: 'Marketing data sync failed. Check server logs.' }));
  }
}
