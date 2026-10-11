type Env = Record<string, string | undefined>;

export class MetaError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export type MetaRange = { since: string; until: string };
export type MetaInsight = {
  account_id: string; account_name: string; account_currency: string;
  campaign_id: string; campaign_name: string; adset_id: string; adset_name: string;
  ad_id: string; ad_name: string; date_start: string; date_stop: string;
  spend: string; impressions: string; clicks: string; reach: string;
  cpc: string; cpm: string; ctr: string;
  actions: { action_type: string; value: string }[];
  action_values: { action_type: string; value: string }[];
};
export type MetaReport = {
  account_id: string; account_timezone: string; range: MetaRange;
  fetched_at: string; data: MetaInsight[];
};

function setting(env: Env, name: string, fallback: number, max: number) {
  const value = Number(env[name]?.trim() || fallback);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new MetaError(503, 'meta_config_invalid', `${name} must be between 1 and ${max}.`);
  }
  return value;
}

export function metaAccountIds(env: Env): string[] {
  const ids = [...new Set((env.META_AD_ACCOUNT_IDS || '').split(/[\s,]+/)
    .filter(Boolean).map(id => id.replace(/^act_/, '')))];
  if (!ids.length || ids.some(id => !/^\d+$/.test(id))) {
    throw new MetaError(503, 'meta_config_invalid', 'Configure META_AD_ACCOUNT_IDS on the server.');
  }
  return ids;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function metaDateRange(env: Env, since?: string | null, until?: string | null, now = new Date()): MetaRange {
  if (!since && !until) {
    let today: string;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: env.META_REPORTING_TIMEZONE?.trim() || 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(now);
      const part = (type: string) => parts.find(item => item.type === type)!.value;
      today = `${part('year')}-${part('month')}-${part('day')}`;
    } catch {
      throw new MetaError(503, 'meta_config_invalid', 'META_REPORTING_TIMEZONE is invalid.');
    }
    const days = setting(env, 'META_SYNC_LOOKBACK_DAYS', 7, 31);
    until = today;
    since = new Date(Date.parse(today) - (days - 1) * 86400000).toISOString().slice(0, 10);
  }
  if (!since || !until || !validDate(since) || !validDate(until) || since > until ||
      Date.parse(until) - Date.parse(since) > 30 * 86400000) {
    throw new MetaError(400, 'invalid_date_range', 'Provide since and until as YYYY-MM-DD, at most 31 days apart (inclusive).');
  }
  return { since, until };
}

const fields = 'account_id,account_name,account_currency,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,date_stop,spend,impressions,clicks,reach,cpc,cpm,ctr,actions,action_values';

// Pick known fields only. Never relay upstream error messages or paging URLs.
function normalizeInsight(raw: unknown, accountId: string, range: MetaRange): MetaInsight {
  const invalid = () => new MetaError(502, 'meta_invalid_response', 'Meta returned invalid daily insight data.');
  if (!raw || typeof raw !== 'object') throw invalid();
  const row = raw as Record<string, unknown>;
  if (row.account_id !== accountId || typeof row.ad_id !== 'string' || !/^\d+$/.test(row.ad_id) ||
      typeof row.date_start !== 'string' || !validDate(row.date_start) ||
      row.date_start !== row.date_stop || row.date_start < range.since || row.date_start > range.until) throw invalid();
  const text = (key: string) => typeof row[key] === 'string' ? row[key] as string : '';
  const metric = (value: unknown, optional = true) => {
    if (value == null && optional) return '0';
    if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) throw invalid();
    return value;
  };
  const actions = (key: string) => {
    if (row[key] == null) return [];
    if (!Array.isArray(row[key])) throw invalid();
    return row[key].map(item => {
      if (!item || typeof item.action_type !== 'string') throw invalid();
      return { action_type: item.action_type, value: metric(item.value, false) };
    });
  };
  if (!/^[A-Z]{3}$/.test(text('account_currency'))) throw invalid();
  return {
    account_id: accountId, account_name: text('account_name'), account_currency: text('account_currency'),
    campaign_id: text('campaign_id'), campaign_name: text('campaign_name'),
    adset_id: text('adset_id'), adset_name: text('adset_name'), ad_id: text('ad_id'), ad_name: text('ad_name'),
    date_start: text('date_start'), date_stop: text('date_stop'),
    spend: metric(row.spend, false), impressions: metric(row.impressions, false),
    clicks: metric(row.clicks), reach: metric(row.reach), cpc: metric(row.cpc),
    cpm: metric(row.cpm), ctr: metric(row.ctr), actions: actions('actions'), action_values: actions('action_values'),
  };
}

export function createMetaClient(env: Env, options: {
  fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>;
} = {}) {
  const token = env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new MetaError(503, 'meta_not_configured', 'Configure META_ACCESS_TOKEN on the server.');
  const ids = metaAccountIds(env);
  const version = env.META_API_VERSION?.trim() || 'v26.0';
  if (!/^v\d+\.\d+$/.test(version)) throw new MetaError(503, 'meta_config_invalid', 'META_API_VERSION is invalid.');
  const pageSize = setting(env, 'META_SYNC_PAGE_SIZE', 500, 500);
  const maxPages = setting(env, 'META_SYNC_MAX_PAGES_PER_ACCOUNT', 200, 200);
  const request = options.fetch || globalThis.fetch;
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));

  async function graph(url: URL, signal?: AbortSignal) {
    for (let attempt = 0; attempt < 3; attempt++) {
      signal?.throwIfAborted();
      const timeout = AbortSignal.timeout(20000);
      let response: Response;
      let body: any;
      try {
        response = await request(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        body = await response.json();
      } catch {
        throw new MetaError(502, 'meta_connection_failed', 'Meta request failed or timed out. Retry with a smaller date range.');
      }
      const code = typeof body?.error?.code === 'number' ? body.error.code : undefined;
      const transient = response.status === 429 || response.status >= 500 || body?.error?.is_transient === true ||
        [4, 17, 32, 613, 80004].includes(code);
      if (transient && attempt < 2) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await sleep(Math.min(5000, Math.max(500 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0)));
        continue;
      }
      if (!response.ok || body?.error) {
        throw new MetaError(502, code === 190 ? 'meta_auth_failed' : 'meta_request_failed',
          `Meta request failed (HTTP ${response.status}${code === undefined ? '' : `, code ${code}`}). Check token permissions and API version.`);
      }
      return body;
    }
    throw new MetaError(502, 'meta_request_failed', 'Meta request failed.');
  }

  return {
    accountIds: ids,
    async insights(account: string, range: MetaRange, signal?: AbortSignal): Promise<MetaReport> {
      const accountId = account.replace(/^act_/, '');
      if (!ids.includes(accountId)) throw new MetaError(403, 'account_not_allowed', 'Account is not configured in META_AD_ACCOUNT_IDS.');
      range = metaDateRange(env, range.since, range.until);
      const fetchedAt = new Date().toISOString();
      const accountUrl = new URL(`https://graph.facebook.com/${version}/act_${accountId}`);
      accountUrl.searchParams.set('fields', 'account_id,timezone_name');
      const accountData = await graph(accountUrl, signal);
      if (accountData?.account_id !== accountId || typeof accountData.timezone_name !== 'string' || !accountData.timezone_name) {
        throw new MetaError(502, 'meta_invalid_response', 'Meta returned invalid account metadata.');
      }
      const url = new URL(`https://graph.facebook.com/${version}/act_${accountId}/insights`);
      url.search = new URLSearchParams({ fields, level: 'ad', time_increment: '1',
        time_range: JSON.stringify(range), limit: String(pageSize),
        action_report_time: 'impression', use_unified_attribution_setting: 'true',
      }).toString();
      const rows = new Map<string, MetaInsight>();
      const cursors = new Set<string>();
      for (let page = 0; page < maxPages; page++) {
        const body = await graph(url, signal);
        if (!Array.isArray(body?.data)) throw new MetaError(502, 'meta_invalid_response', 'Meta did not return an insight array.');
        for (const raw of body.data) {
          const row = normalizeInsight(raw, accountId, range);
          rows.set(`${row.ad_id}:${row.date_start}`, row);
        }
        if (!body.paging?.next) return {
          account_id: accountId, account_timezone: accountData.timezone_name,
          range, fetched_at: fetchedAt, data: [...rows.values()],
        };
        const after = body.paging?.cursors?.after;
        if (typeof after !== 'string' || !after || cursors.has(after)) {
          throw new MetaError(502, 'meta_invalid_pagination', 'Meta returned an invalid or repeated pagination cursor.');
        }
        cursors.add(after);
        // Rebuild from the fixed Graph host; never follow URLs containing tokens.
        url.searchParams.set('after', after);
      }
      throw new MetaError(502, 'meta_page_limit', 'Page limit reached. Use a smaller date range; no partial report was saved.');
    },
  };
}
