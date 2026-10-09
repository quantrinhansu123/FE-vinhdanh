import type { IncomingMessage, ServerResponse } from 'node:http';
import { getMetaDateRange, readMetaAccountLeaderboard } from '../server/metaAdsSync';
import { MetaAdsConfigError } from '../server/metaAdsClient';
import { SupabaseServerConfigError } from '../server/supabaseAdmin';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
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
    const range = getMetaDateRange(process.env, { dateFrom, dateTo });
    const result = await readMetaAccountLeaderboard(process.env, range.dateFrom, range.dateTo);
    res.statusCode = 200;
    res.end(JSON.stringify({ dateFrom: range.dateFrom, dateTo: range.dateTo, ...result }));
  } catch (error) {
    if (error instanceof MetaAdsConfigError || error instanceof SupabaseServerConfigError) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'configuration_error', message: error.message }));
      return;
    }
    console.error('[meta-ads-leaderboard] Read failed:', error instanceof Error ? error.message : 'unknown error');
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'leaderboard_read_failed', message: 'Không tải được bảng xếp hạng Ads.' }));
  }
}
