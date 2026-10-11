import type { IncomingMessage, ServerResponse } from 'node:http';
import { MetaAdsConfigError } from '../server/metaAdsClient';
import {
  defaultMetaLeaderboardRange,
  isMetaLeaderboardConfigError,
  readMetaLeaderboardForUser,
  SupabaseAuthenticationError,
} from '../server/metaAdsLeaderboard';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

  const url = new URL(req.url || '/', 'http://localhost');
  const defaults = defaultMetaLeaderboardRange(process.env);
  const dateFrom = url.searchParams.get('date_from') || defaults.dateFrom;
  const dateTo = url.searchParams.get('date_to') || defaults.dateTo;

  try {
    const result = await readMetaLeaderboardForUser(process.env, match[1], dateFrom, dateTo);
    res.statusCode = 200;
    res.end(JSON.stringify({ ...result, dateFrom, dateTo }));
  } catch (error) {
    if (error instanceof SupabaseAuthenticationError) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'authentication_required', message: error.message }));
      return;
    }
    if (error instanceof MetaAdsConfigError) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'invalid_date_range', message: error.message }));
      return;
    }
    if (isMetaLeaderboardConfigError(error)) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'configuration_error', message: (error as Error).message }));
      return;
    }
    console.error('[meta-ads-leaderboard] Read failed:', error instanceof Error ? error.message : 'unknown error');
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'meta_leaderboard_unavailable', message: 'Không đọc được bảng Meta từ Supabase.' }));
  }
}
