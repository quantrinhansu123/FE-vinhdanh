import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { metaAccountIds, MetaError } from './metaClient.js';
import { requireMetaQcAdminSession } from './metaQcHandler.js';

type Env = Record<string, string | undefined>;
type CampaignRow = {
  account_id: string;
  campaign_key: string;
  campaign_id: string | null;
  report_date: string;
  account_name: string;
  campaign_name: string;
  currency: string | null;
  spend: number;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
};

const maxBodyBytes = 1_500_000;
const maxRows = 2500;

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (Buffer.byteLength(JSON.stringify(parsed)) > maxBodyBytes) {
      throw new MetaError(413, 'request_too_large', 'Dữ liệu nhập vượt quá giới hạn.');
    }
    return parsed as Record<string, unknown>;
  }
  let raw = typeof parsed === 'string' ? parsed : '';
  if (parsed === undefined) {
    for await (const chunk of req) {
      raw += chunk.toString();
      if (Buffer.byteLength(raw) > maxBodyBytes) {
        throw new MetaError(413, 'request_too_large', 'Dữ liệu nhập vượt quá giới hạn.');
      }
    }
  }
  if (Buffer.byteLength(raw) > maxBodyBytes) {
    throw new MetaError(413, 'request_too_large', 'Dữ liệu nhập vượt quá giới hạn.');
  }
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new MetaError(400, 'invalid_request', 'Dữ liệu nhập không hợp lệ.');
  }
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function metric(value: unknown, integer = false): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isSafeInteger(parsed))) return null;
  return parsed;
}

function normalizeRows(body: Record<string, unknown>, allowedAccounts: string[]) {
  const accountId = typeof body.account_id === 'string' ? body.account_id.replace(/^act_/, '') : '';
  if (!/^\d+$/.test(accountId) || !allowedAccounts.includes(accountId)) {
    throw new MetaError(403, 'account_not_allowed', 'Tài khoản quảng cáo không nằm trong danh sách được cấu hình.');
  }
  const since = body.since;
  const until = body.until;
  if (!validDate(since) || !validDate(until) || since > until ||
      Date.parse(until) - Date.parse(since) > 30 * 86400000) {
    throw new MetaError(400, 'invalid_date_range', 'Khoảng ngày không hợp lệ hoặc vượt quá 31 ngày.');
  }
  if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > maxRows) {
    throw new MetaError(400, 'invalid_rows', 'Không có dòng dữ liệu hợp lệ hoặc vượt giới hạn 2.500 dòng.');
  }
  const accountName = text(body.account_name, 160) || '';
  const currencyRaw = text(body.currency, 3)?.toUpperCase() || null;
  const currency = currencyRaw && /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : null;
  const rows = new Map<string, CampaignRow>();
  for (const raw of body.rows) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new MetaError(400, 'invalid_rows', 'Có dòng dữ liệu sai định dạng.');
    }
    const row = raw as Record<string, unknown>;
    const reportDate = row.report_date;
    const campaignKey = text(row.campaign_key, 180);
    const campaignName = text(row.campaign_name, 500);
    const spend = metric(row.spend);
    const impressions = row.impressions == null ? null : metric(row.impressions, true);
    const reach = row.reach == null ? null : metric(row.reach, true);
    const clicks = row.clicks == null ? null : metric(row.clicks, true);
    const campaignId = text(row.campaign_id, 80);
    const cpc = row.cpc == null ? null : metric(row.cpc);
    const cpm = row.cpm == null ? null : metric(row.cpm);
    const ctr = row.ctr == null ? null : metric(row.ctr);
    if (!validDate(reportDate) || reportDate < since || reportDate > until || !campaignKey || !campaignName ||
        spend === null || (row.impressions != null && impressions === null) ||
        (row.reach != null && reach === null) || (row.clicks != null && clicks === null) ||
        (row.cpc != null && cpc === null) || (row.cpm != null && cpm === null) || (row.ctr != null && ctr === null)) {
      throw new MetaError(400, 'invalid_rows', 'Có dòng thiếu ngày, chiến dịch hoặc chỉ số hợp lệ.');
    }
    const rowCurrency = text(row.currency, 3)?.toUpperCase() || currency;
    if (rowCurrency && !/^[A-Z]{3}$/.test(rowCurrency)) {
      throw new MetaError(400, 'invalid_currency', 'Mã tiền tệ không hợp lệ.');
    }
    const normalized: CampaignRow = {
      account_id: accountId,
      campaign_key: campaignKey,
      campaign_id: campaignId,
      report_date: reportDate,
      account_name: text(row.account_name, 160) || accountName,
      campaign_name: campaignName,
      currency: rowCurrency,
      spend,
      impressions,
      reach,
      clicks,
      cpc,
      cpm,
      ctr,
    };
    rows.set(`${campaignKey}\u0000${reportDate}`, normalized);
  }
  return { accountId, since, until, rows: [...rows.values()] };
}

export function createMetaCampaignImportHandler(env: Env, options: { fetch?: typeof fetch } = {}) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    };
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Allow', 'POST, OPTIONS');
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return json(405, { error: 'method_not_allowed' });
    }
    try {
      await requireMetaQcAdminSession(req, env, options);
      const configuredAccounts = metaAccountIds(env);
      const body = await readBody(req);
      const normalized = normalizeRows(body, configuredAccounts);
      const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim();
      const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!url || !key) throw new MetaError(503, 'meta_storage_not_configured', 'Chưa cấu hình lưu trữ Meta trên server.');
      const db = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: options.fetch ? { fetch: options.fetch } : undefined,
      });
      const fetchedAt = new Date().toISOString();
      const { data, error } = await db.rpc('upsert_meta_campaign_daily_insights', {
        p_account_id: normalized.accountId,
        p_since: normalized.since,
        p_until: normalized.until,
        p_fetched_at: fetchedAt,
        p_rows: normalized.rows,
      }).abortSignal(AbortSignal.timeout(20000));
      if (error) throw new MetaError(502, 'meta_import_storage_failed', 'Không ghi được dữ liệu Meta vào database.');
      return json(200, {
        status: 'ok', account_id: normalized.accountId, range: { since: normalized.since, until: normalized.until },
        rows_saved: Number(data) || 0, fetched_at: fetchedAt,
      });
    } catch (error) {
      if (error instanceof MetaError) return json(error.status, { error: error.code, message: error.message });
      return json(502, { error: 'meta_import_failed', message: 'Không nhập được dữ liệu Meta.' });
    }
  };
}
