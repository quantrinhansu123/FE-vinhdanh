import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadMetaProjectQcRows } from './metaProjectQc.js';
import { MetaDetailReportSyncError, syncMetaProjectQcToDetailReports } from './metaDetailReportSync.js';
import { MetaError } from './metaClient.js';
import { MetaProjectQcError } from './metaProjectQc.js';
import { syncUpcareMktToDetailReports, UpcareDetailReportSyncError } from './upcareDetailReportSync.js';

type CronEnv = Record<string, string | undefined>;

function localDate(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return day.toISOString().slice(0, 10);
}

function dateRange(req: IncomingMessage, env: CronEnv): { from: string; to: string } {
  const url = new URL(req.url || '/', 'http://localhost');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if ((from && !to) || (!from && to)) throw new MetaError(400, 'invalid_date_range', 'Cần truyền đủ from và to.');
  if (from && to) return { from, to };

  const parsedLookback = Number(env.MARKETING_SYNC_LOOKBACK_DAYS || 3);
  const lookback = Number.isInteger(parsedLookback) ? Math.min(6, Math.max(1, parsedLookback)) : 3;
  // Refresh today plus the configured number of prior days, using Vietnam local dates.
  return { from: localDate(-lookback), to: localDate(0) };
}

function validateRange(from: string, to: string): void {
  const valid = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const length = Math.floor((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000) + 1;
  if (!valid(from) || !valid(to) || from > to || length > 7) {
    throw new MetaError(400, 'invalid_date_range', 'Khoảng ngày cần hợp lệ và tối đa 7 ngày.');
  }
}

function authorized(req: IncomingMessage, env: CronEnv): boolean {
  const expected = env.CRON_SECRET?.trim() || '';
  const header = req.headers.authorization;
  const authorization = Array.isArray(header) ? header[0] : header || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function errorMessage(error: unknown): string {
  if (error instanceof MetaError || error instanceof MetaProjectQcError || error instanceof MetaDetailReportSyncError || error instanceof UpcareDetailReportSyncError) {
    return error.message;
  }
  return 'Đồng bộ thất bại do lỗi nội bộ.';
}

export function createMarketingDetailReportCronHandler(env: CronEnv) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    };
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return json(405, { error: 'method_not_allowed' });
    }
    if (env.VERCEL_ENV !== 'production' && env.MARKETING_SYNC_ALLOW_LOCAL !== 'true') {
      return json(403, { error: 'environment_not_enabled', message: 'Marketing sync only writes from production unless local writes are explicitly enabled.' });
    }
    if (!env.CRON_SECRET?.trim()) {
      return json(503, { error: 'cron_not_configured', message: 'Thêm CRON_SECRET vào cấu hình server để bật đồng bộ tự động.' });
    }
    if (!authorized(req, env)) return json(401, { error: 'unauthorized' });

    let range: { from: string; to: string };
    try {
      range = dateRange(req, env);
      validateRange(range.from, range.to);
    } catch (error) {
      return json(error instanceof MetaError ? error.status : 400, {
        error: error instanceof MetaError ? error.code : 'invalid_date_range',
        message: errorMessage(error),
      });
    }

    const result: {
      range: { from: string; to: string };
      meta: Record<string, unknown> | null;
      odoo: Record<string, unknown> | null;
      errors: { source: 'meta' | 'odoo'; message: string }[];
    } = { range, meta: null, odoo: null, errors: [] };

    // Keep the requested order: persist and merge Meta first, then add Odoo fields.
    try {
      const metaRows = await loadMetaProjectQcRows(env, range.from, range.to);
      result.meta = await syncMetaProjectQcToDetailReports(env, metaRows, range.from, range.to);
    } catch (error) {
      result.errors.push({ source: 'meta', message: errorMessage(error) });
    }

    // Odoo uses a separate column set, so a temporary Meta outage must not block sales ingestion.
    try {
      result.odoo = await syncUpcareMktToDetailReports(env, range.from, range.to);
    } catch (error) {
      result.errors.push({ source: 'odoo', message: errorMessage(error) });
    }

    const summary = {
      range,
      metaRowsSynced: Number(result.meta?.detailRowsSynced) || 0,
      odooRowsSynced: Number(result.odoo?.employeeDayRowsSynced) || 0,
      failedSources: result.errors.map((item) => item.source),
    };
    if (result.errors.length) {
      console.error('[marketing-detail-report-cron]', JSON.stringify(summary));
      return json(502, { ...result, status: 'partial_failure' });
    }
    console.info('[marketing-detail-report-cron]', JSON.stringify(summary));
    return json(200, { ...result, status: 'ok' });
  };
}
