import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createMetaAdsClient,
  MetaAdsConfigError,
  parseMetaAdAccountIds,
  type MetaActionValue,
  type MetaAdInsight,
  type MetaAdAccountMetadata,
  type MetaEnvironment,
} from './metaAdsClient';
import { createSupabaseAdminClient } from './supabaseAdmin';

const INSIGHTS_TABLE = 'facebook_ad_insights_daily';
const ACCOUNT_DAILY_TABLE = 'facebook_ad_account_daily';
const DB_CHUNK_SIZE = 500;

type DailyInsightRecord = Record<string, unknown> & {
  ad_account_id: string;
  ad_id: string;
  date_start: string;
};

type AccountDayRecord = Record<string, unknown> & {
  ad_account_id: string;
  date_start: string;
};

export type MetaSyncOptions = { dateFrom?: string | null; dateTo?: string | null };

function validDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function defaultDateRange(days: number, timezone: string): { dateFrom: string; dateTo: string } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
  } catch {
    throw new MetaAdsConfigError('META_REPORTING_TIMEZONE không hợp lệ.');
  }
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const from = new Date(`${today}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: today };
}

function dateList(from: string, to: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function asNumber(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function purchaseMetric(items: MetaActionValue[] | undefined): number {
  if (!Array.isArray(items)) return 0;
  const actions = items.filter((item) => typeof item?.action_type === 'string');
  const priorities = [
    'omni_purchase',
    'purchase',
    'offsite_conversion.fb_pixel_purchase',
    'offsite_conversion.purchase',
    'onsite_web_purchase',
    'web_purchase',
  ];
  for (const actionType of priorities) {
    const match = actions.find((item) => item.action_type?.toLowerCase() === actionType);
    if (match) return asNumber(match.value);
  }
  // Preserve one purchase action as a fallback. Summing all variants can double-count
  // the same conversion when Meta reports both omni and channel-specific action types.
  const fallback = actions.find((item) => item.action_type?.toLowerCase().includes('purchase'));
  return asNumber(fallback?.value);
}

function optionalNumber(value: string | number | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function insightsToDb(accountId: string, insight: MetaAdInsight, metadata: MetaAdAccountMetadata, syncedAt: string): DailyInsightRecord | null {
  const adId = String(insight.ad_id || '').trim();
  const date = String(insight.date_start || '').trim();
  if (!adId || !validDate(date)) return null;
  return {
    ad_account_id: String(insight.account_id || accountId).replace(/^act_/i, ''),
    ad_account_name: insight.account_name || metadata.name || null,
    account_currency: insight.account_currency || metadata.currency || null,
    campaign_id: insight.campaign_id || null,
    campaign_name: insight.campaign_name || null,
    adset_id: insight.adset_id || null,
    adset_name: insight.adset_name || null,
    ad_id: adId,
    ad_name: insight.ad_name || null,
    date_start: date,
    date_stop: validDate(insight.date_stop) ? insight.date_stop : date,
    spend: optionalNumber(insight.spend),
    impressions: optionalNumber(insight.impressions),
    reach: optionalNumber(insight.reach),
    clicks: optionalNumber(insight.clicks),
    ctr: optionalNumber(insight.ctr),
    cpc: optionalNumber(insight.cpc),
    cpm: optionalNumber(insight.cpm),
    purchase_count: purchaseMetric(insight.actions),
    purchase_value: purchaseMetric(insight.action_values),
    actions: Array.isArray(insight.actions) ? insight.actions : [],
    action_values: Array.isArray(insight.action_values) ? insight.action_values : [],
    purchase_roas: Array.isArray(insight.purchase_roas) ? insight.purchase_roas : [],
    synced_at: syncedAt,
    updated_at: syncedAt,
  };
}

async function upsertInChunks(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += DB_CHUNK_SIZE) {
    const { error } = await client.from(table).upsert(rows.slice(offset, offset + DB_CHUNK_SIZE), { onConflict });
    if (error) throw new Error(`Supabase ghi ${table} thất bại (${error.code || 'unknown'}).`);
  }
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function getMetaDateRange(env: MetaEnvironment, options: MetaSyncOptions = {}) {
  const daysRaw = Number(env.META_SYNC_LOOKBACK_DAYS);
  const days = Number.isInteger(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 90) : 7;
  const defaults = defaultDateRange(days, env.META_REPORTING_TIMEZONE?.trim() || 'Asia/Ho_Chi_Minh');
  const dateFrom = options.dateFrom || defaults.dateFrom;
  const dateTo = options.dateTo || defaults.dateTo;
  if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo) {
    throw new MetaAdsConfigError('Khoảng ngày không hợp lệ; dùng định dạng YYYY-MM-DD.');
  }
  const rangeDays = dateList(dateFrom, dateTo).length;
  if (rangeDays > 90) throw new MetaAdsConfigError('Mỗi lần đồng bộ chỉ nhận tối đa 90 ngày.');
  return { dateFrom, dateTo, dates: dateList(dateFrom, dateTo) };
}

export async function syncMetaAds(
  env: MetaEnvironment,
  options: MetaSyncOptions = {},
  adminClient = createSupabaseAdminClient(env)
) {
  const accountIds = parseMetaAdAccountIds(env.META_AD_ACCOUNT_IDS);
  if (accountIds.length === 0) throw new MetaAdsConfigError('Thiếu META_AD_ACCOUNT_IDS (danh sách ID, phân tách bằng dấu phẩy).');
  const ids = accountIds;
  const meta = createMetaAdsClient(env);
  const { dateFrom, dateTo, dates } = getMetaDateRange(env, options);
  const startedAt = Date.now();

  const accounts = await mapConcurrent(ids, 3, async (accountId) => {
    try {
      if (!/^\d+$/.test(accountId)) {
        throw new MetaAdsConfigError('META_AD_ACCOUNT_IDS có ID sai định dạng.');
      }
      const metadata = await meta.fetchAdAccountMetadata(accountId);
      const insights = await meta.fetchAdInsights(accountId, dateFrom, dateTo);
      const syncedAt = new Date().toISOString();
      const rawRows = insights
        .map((row) => insightsToDb(accountId, row, metadata, syncedAt))
        .filter((row): row is DailyInsightRecord => row !== null)
        .filter((row) => row.date_start >= dateFrom && row.date_start <= dateTo);

      const first = insights.find((row) => row.account_name || row.account_currency);
      const summaries = new Map<string, AccountDayRecord>(dates.map((date) => [date, {
        ad_account_id: accountId,
        ad_account_name: first?.account_name || metadata.name || null,
        account_currency: first?.account_currency || metadata.currency || null,
        date_start: date,
        spend: 0,
        impressions: 0,
        clicks: 0,
        purchase_count: 0,
        purchase_value: 0,
        synced_at: syncedAt,
        updated_at: syncedAt,
      }]));

      for (const row of rawRows) {
        const summary = summaries.get(row.date_start);
        if (!summary) continue;
        summary.ad_account_name ||= row.ad_account_name as string | null;
        summary.account_currency ||= row.account_currency as string | null;
        summary.spend = asNumber(summary.spend as number) + asNumber(row.spend as number | null);
        summary.impressions = asNumber(summary.impressions as number) + asNumber(row.impressions as number | null);
        summary.clicks = asNumber(summary.clicks as number) + asNumber(row.clicks as number | null);
        summary.purchase_count = asNumber(summary.purchase_count as number) + asNumber(row.purchase_count as number);
        summary.purchase_value = asNumber(summary.purchase_value as number) + asNumber(row.purchase_value as number);
      }

      await upsertInChunks(adminClient, INSIGHTS_TABLE, rawRows, 'ad_account_id,ad_id,date_start');
      await upsertInChunks(adminClient, ACCOUNT_DAILY_TABLE, [...summaries.values()], 'ad_account_id,date_start');
      return { accountId, ok: true, fetched: insights.length, saved: rawRows.length, days: summaries.size };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định.';
      return { accountId, ok: false, fetched: 0, saved: 0, days: 0, error: message };
    }
  });

  const successful = accounts.filter((account) => account.ok).length;
  const failed = accounts.length - successful;
  return {
    ok: failed === 0,
    dateFrom,
    dateTo,
    configuredAccounts: ids.length,
    successfulAccounts: successful,
    failedAccounts: failed,
    fetchedRows: accounts.reduce((total, account) => total + account.fetched, 0),
    savedRows: accounts.reduce((total, account) => total + account.saved, 0),
    durationMs: Date.now() - startedAt,
    accounts,
  };
}

export type MetaAccountLeaderboardRow = {
  account_id: string;
  account_name: string | null;
  currency: string | null;
  purchase_value: number;
  purchase_count: number;
  last_synced_at: string | null;
};

export async function readMetaAccountLeaderboard(
  env: MetaEnvironment,
  dateFrom: string,
  dateTo: string,
  adminClient = createSupabaseAdminClient(env)
): Promise<{ accounts: MetaAccountLeaderboardRow[]; currencies: string[]; lastSyncedAt: string | null }> {
  if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo || dateList(dateFrom, dateTo).length > 366) {
    throw new MetaAdsConfigError('Khoảng ngày không hợp lệ hoặc vượt quá 366 ngày.');
  }

  const allRows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await adminClient
      .from(ACCOUNT_DAILY_TABLE)
      .select('ad_account_id, ad_account_name, account_currency, date_start, purchase_value, purchase_count, synced_at')
      .gte('date_start', dateFrom)
      .lte('date_start', dateTo)
      .order('date_start', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Supabase đọc ${ACCOUNT_DAILY_TABLE} thất bại (${error.code || 'unknown'}).`);
    allRows.push(...(data || []) as Record<string, unknown>[]);
    if (!data || data.length < pageSize) break;
    if (allRows.length >= 20000) throw new Error('Khoảng thời gian trả quá nhiều bản ghi; hãy chọn tối đa 366 ngày.');
  }

  const grouped = new Map<string, {
    account_id: string;
    account_name: string | null;
    currency: string | null;
    purchase_value: number;
    purchase_count: number;
    last_synced_at: string | null;
  }>();
  let lastSyncedAt: string | null = null;
  for (const row of allRows) {
    const id = String(row.ad_account_id || '');
    if (!id) continue;
    const currency = typeof row.account_currency === 'string' && row.account_currency.trim()
      ? row.account_currency.trim().toUpperCase()
      : null;
    const groupKey = `${id}::${currency || 'UNKNOWN'}`;
    let item = grouped.get(groupKey);
    if (!item) {
      item = { account_id: id, account_name: (row.ad_account_name as string | null) || null, currency, purchase_value: 0, purchase_count: 0, last_synced_at: null };
      grouped.set(groupKey, item);
    }
    if (!item.account_name && typeof row.ad_account_name === 'string') item.account_name = row.ad_account_name;
    item.purchase_value += asNumber(row.purchase_value as string | number | null);
    item.purchase_count += asNumber(row.purchase_count as string | number | null);
    if (typeof row.synced_at === 'string' && (!item.last_synced_at || row.synced_at > item.last_synced_at)) item.last_synced_at = row.synced_at;
    if (typeof row.synced_at === 'string' && (!lastSyncedAt || row.synced_at > lastSyncedAt)) lastSyncedAt = row.synced_at;
  }

  const accounts = [...grouped.values()].map((item) => ({
    account_id: item.account_id,
    account_name: item.account_name,
    currency: item.currency,
    purchase_value: item.purchase_value,
    purchase_count: item.purchase_count,
    last_synced_at: item.last_synced_at,
  }));
  const currencies = [...new Set(accounts.map((account) => account.currency).filter((currency): currency is string => Boolean(currency)))].sort();
  return { accounts, currencies, lastSyncedAt };
}
