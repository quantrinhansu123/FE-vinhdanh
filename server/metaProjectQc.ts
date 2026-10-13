import { getMetaAccessToken, MetaTokenManagerError } from './metaTokenManager';

export type MetaProjectQcRow = {
  accountId: string;
  date: string;
  employeeCode: string | null;
  campaignName: string;
  spendVnd: number;
  conversations: number;
};

export type MetaProjectQcResult = {
  rows: MetaProjectQcRow[];
  accountIds: string[];
  skippedCurrencies: string[];
};

export class MetaProjectQcError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502,
    readonly errorCode = 'meta_project_qc_failed'
  ) {
    super(message);
    this.name = 'MetaProjectQcError';
  }
}

type MetaEnvironment = Record<string, string | undefined>;
type MetaAction = { action_type?: string; value?: string | number };
type MetaInsight = {
  account_currency?: string;
  campaign_name?: string;
  date_start?: string;
  spend?: string | number;
  actions?: MetaAction[];
};

const MAX_RANGE_DAYS = 90;
const PAGE_SIZE = 500;
const MAX_PAGES_PER_ACCOUNT = 100;
const CONVERSATION_ACTIONS = [
  'onsite_conversion.messaging_conversation_started_7d',
  'messaging_conversation_started_7d',
  'onsite_conversion.messaging_conversation_started',
  'messaging_conversation_started',
  'onsite_conversion.total_messaging_connection',
];

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function rangeLength(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000) + 1;
}

function parseAccountIds(value: string | undefined): string[] {
  const ids = (value || '')
    .split(/[\s,;]+/)
    .map((id) => id.trim().replace(/^act_/i, ''))
    .filter(Boolean);
  if (ids.some((id) => !/^\d+$/.test(id))) {
    throw new MetaProjectQcError('META_AD_ACCOUNT_IDS cần là danh sách ID tài khoản quảng cáo dạng số.', 503, 'invalid_meta_config');
  }
  return [...new Set(ids)];
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function conversationCount(actions: MetaAction[] | undefined): number {
  if (!Array.isArray(actions)) return 0;
  for (const actionType of CONVERSATION_ACTIONS) {
    const action = actions.find((item) => item.action_type?.toLowerCase() === actionType);
    if (action) return asNumber(action.value);
  }
  return 0;
}

function graphError(response: Response, body: Record<string, unknown>): MetaProjectQcError {
  const error = body.error && typeof body.error === 'object'
    ? body.error as Record<string, unknown>
    : {};
  const code = Number(error.code);
  if (code === 190) {
    return new MetaProjectQcError(
      'Meta từ chối access token. Hãy kiểm tra trạng thái tự động xoay vòng token trên server.',
      502,
      'meta_token_invalid'
    );
  }
  if (code === 10 || code === 200) {
    return new MetaProjectQcError(
      'Token Meta cần quyền đọc quảng cáo và quyền truy cập các tài khoản đã cấu hình.',
      502,
      'meta_permission_denied'
    );
  }
  if (response.status === 429 || [4, 17, 32, 613].includes(code)) {
    return new MetaProjectQcError('Meta đang giới hạn yêu cầu. Hãy thử tải lại sau ít phút.', 503, 'meta_rate_limited');
  }
  return new MetaProjectQcError(
    `Meta Ads API trả lỗi HTTP ${response.status}${Number.isFinite(code) ? ` (mã ${code})` : ''}.`,
    502,
    'meta_api_error'
  );
}

async function fetchAccountInsights(
  accountId: string,
  dateFrom: string,
  dateTo: string,
  apiVersion: string,
  token: string,
  fetcher: typeof fetch
): Promise<MetaInsight[]> {
  const url = new URL(`https://graph.facebook.com/${apiVersion}/act_${accountId}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('time_increment', '1');
  url.searchParams.set('time_range', JSON.stringify({ since: dateFrom, until: dateTo }));
  url.searchParams.set('fields', 'account_currency,campaign_name,date_start,spend,actions');
  url.searchParams.set('limit', String(PAGE_SIZE));

  const rows: MetaInsight[] = [];
  for (let page = 0; page < MAX_PAGES_PER_ACCOUNT; page += 1) {
    let response: Response;
    try {
      response = await fetcher(url, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      const message = error instanceof Error && error.name === 'TimeoutError'
        ? 'Meta Ads API timeout. Hãy thử khoảng ngày ngắn hơn.'
        : 'Không kết nối được Meta Ads API.';
      throw new MetaProjectQcError(message, 502, 'meta_connection_failed');
    }

    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) throw new MetaProjectQcError(`Meta Ads API trả JSON không hợp lệ (HTTP ${response.status}).`);
    if (!response.ok || body.error) throw graphError(response, body);
    if (!Array.isArray(body.data)) throw new MetaProjectQcError('Meta Ads API trả phản hồi thiếu dữ liệu chiến dịch.');
    rows.push(...body.data as MetaInsight[]);

    const paging = body.paging && typeof body.paging === 'object'
      ? body.paging as Record<string, unknown>
      : null;
    if (!paging?.next) return rows;
    const cursors = paging.cursors && typeof paging.cursors === 'object'
      ? paging.cursors as Record<string, unknown>
      : null;
    const after = typeof cursors?.after === 'string' ? cursors.after : '';
    if (!after) throw new MetaProjectQcError('Meta Ads API có trang kế tiếp nhưng thiếu cursor phân trang.');
    url.searchParams.set('after', after);
  }

  throw new MetaProjectQcError('Dữ liệu Meta vượt giới hạn phân trang. Hãy chọn khoảng ngày ngắn hơn.', 422, 'meta_result_too_large');
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

export async function loadMetaProjectQcRows(
  env: MetaEnvironment,
  dateFrom: string,
  dateTo: string,
  fetcher: typeof fetch = globalThis.fetch
): Promise<MetaProjectQcResult> {
  if (!isValidDate(dateFrom) || !isValidDate(dateTo) || dateFrom > dateTo) {
    throw new MetaProjectQcError('Khoảng ngày không hợp lệ; dùng định dạng YYYY-MM-DD.', 400, 'invalid_date_range');
  }
  if (rangeLength(dateFrom, dateTo) > MAX_RANGE_DAYS) {
    throw new MetaProjectQcError('Mỗi lần xem Meta Ads tối đa 90 ngày.', 400, 'date_range_too_large');
  }

  let token: string;
  try {
    token = await getMetaAccessToken(env);
  } catch (error) {
    if (error instanceof MetaTokenManagerError) {
      throw new MetaProjectQcError(error.message, error.statusCode, error.errorCode);
    }
    throw error;
  }
  const apiVersion = env.META_API_VERSION?.trim() || 'v26.0';
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new MetaProjectQcError('META_API_VERSION cần có dạng v26.0.', 503, 'invalid_meta_config');
  }
  const accountIds = parseAccountIds(env.META_AD_ACCOUNT_IDS);
  if (!accountIds.length) {
    throw new MetaProjectQcError('Thiếu META_AD_ACCOUNT_IDS trong cấu hình server Vercel.', 503, 'meta_not_configured');
  }

  const results = await mapConcurrent(accountIds, 5, (accountId) =>
    fetchAccountInsights(accountId, dateFrom, dateTo, apiVersion, token, fetcher)
  );
  const grouped = new Map<string, MetaProjectQcRow>();
  const skippedCurrencies = new Set<string>();

  for (let accountIndex = 0; accountIndex < results.length; accountIndex += 1) {
    const accountId = accountIds[accountIndex];
    const insights = results[accountIndex];
    for (const insight of insights) {
      const date = String(insight.date_start || '').trim();
      const campaignName = String(insight.campaign_name || '').trim();
      if (!isValidDate(date) || date < dateFrom || date > dateTo || !campaignName) continue;
      const currency = String(insight.account_currency || '').trim().toUpperCase();
      if (currency !== 'VND') {
        skippedCurrencies.add(currency || 'UNKNOWN');
        continue;
      }

      const key = `${accountId}\u0000${date}\u0000${campaignName}`;
      const current = grouped.get(key) || {
        accountId,
        date,
        employeeCode: campaignName.match(/\[([^\]]+)\]/)?.[1]?.trim() || null,
        campaignName,
        spendVnd: 0,
        conversations: 0,
      };
      current.spendVnd += asNumber(insight.spend);
      current.conversations += conversationCount(insight.actions);
      grouped.set(key, current);
    }
  }

  const rows = [...grouped.values()].sort((a, b) =>
    b.date.localeCompare(a.date) || a.accountId.localeCompare(b.accountId) || a.campaignName.localeCompare(b.campaignName, 'vi')
  );
  return { rows, accountIds, skippedCurrencies: [...skippedCurrencies].sort() };
}
