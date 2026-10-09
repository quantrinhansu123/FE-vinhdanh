export type MetaEnvironment = Record<string, string | undefined>;

export type MetaActionValue = {
  action_type?: string;
  value?: string | number;
};

export type MetaAdInsight = {
  account_id?: string;
  account_name?: string;
  account_currency?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start?: string;
  date_stop?: string;
  spend?: string | number;
  impressions?: string | number;
  reach?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  cpm?: string | number;
  actions?: MetaActionValue[];
  action_values?: MetaActionValue[];
  purchase_roas?: MetaActionValue[];
};

export type MetaAdAccountMetadata = {
  id?: string;
  name?: string;
  currency?: string;
};

export class MetaAdsConfigError extends Error {}

export class MetaAdsApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
    readonly metaCode?: number
  ) {
    super(message);
    this.name = 'MetaAdsApiError';
  }
}

const INSIGHT_FIELDS = [
  'account_id',
  'account_name',
  'account_currency',
  'campaign_id',
  'campaign_name',
  'adset_id',
  'adset_name',
  'ad_id',
  'ad_name',
  'date_start',
  'date_stop',
  'spend',
  'impressions',
  'reach',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'actions',
  'action_values',
  'purchase_roas',
].join(',');

function positiveInteger(raw: string | undefined, fallback: number, max: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}

export function parseMetaAdAccountIds(raw: string | undefined): string[] {
  const ids = (raw || '')
    .split(/[\s,;]+/)
    .map((value) => value.trim().replace(/^act_/i, ''))
    .filter(Boolean);
  for (const id of ids) {
    if (!/^\d+$/.test(id)) throw new MetaAdsConfigError('META_AD_ACCOUNT_IDS chỉ được chứa ID dạng số, phân tách bằng dấu phẩy.');
  }
  return [...new Set(ids)];
}

export function createMetaAdsClient(env: MetaEnvironment, fetcher: typeof fetch = globalThis.fetch) {
  const token = env.META_ACCESS_TOKEN?.trim() || '';
  const version = env.META_API_VERSION?.trim() || 'v26.0';
  const pageSize = positiveInteger(env.META_SYNC_PAGE_SIZE, 500, 500);
  const maxPages = positiveInteger(env.META_SYNC_MAX_PAGES_PER_ACCOUNT, 200, 1000);

  if (!token) throw new MetaAdsConfigError('Thiếu META_ACCESS_TOKEN trong environment server.');
  if (!/^v\d+\.\d+$/.test(version)) throw new MetaAdsConfigError('META_API_VERSION cần có dạng v26.0.');

  async function getJson(url: URL): Promise<Record<string, unknown>> {
    const retryableCodes = new Set([4, 17, 32, 613]);
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await fetcher(url, {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          redirect: 'error',
          signal: AbortSignal.timeout(25000),
        });
      } catch (error) {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw new MetaAdsApiError(error instanceof Error && error.name === 'TimeoutError' ? 'Meta API timeout.' : 'Không kết nối được Meta API.');
      }

      const text = await response.text();
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        if (response.status >= 500 && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw new MetaAdsApiError(`Meta API trả phản hồi không hợp lệ (HTTP ${response.status}).`, response.status);
      }

      if (!response.ok || payload.error) {
        const errorObject = payload.error && typeof payload.error === 'object'
          ? payload.error as Record<string, unknown>
          : {};
        const code = Number(errorObject.code);
        const canRetry = response.status === 429 || response.status >= 500 || retryableCodes.has(code);
        if (canRetry && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
          continue;
        }
        throw new MetaAdsApiError(
          `Meta API từ chối yêu cầu (HTTP ${response.status}${Number.isFinite(code) ? `, mã ${code}` : ''}). Kiểm tra token, quyền ads_read và quyền truy cập tài khoản.`,
          response.status,
          Number.isFinite(code) ? code : undefined
        );
      }
      return payload;
    }
    throw new MetaAdsApiError('Không lấy được phản hồi từ Meta API sau khi thử lại.');
  }

  return {
    async fetchAdAccountMetadata(accountId: string): Promise<MetaAdAccountMetadata> {
      const url = new URL(`https://graph.facebook.com/${version}/act_${accountId}`);
      url.searchParams.set('fields', 'id,name,currency');
      const payload = await getJson(url);
      if (payload.error || typeof payload.id !== 'string') {
        throw new MetaAdsApiError(`Meta API không trả được thông tin tài khoản ${accountId}.`);
      }
      return {
        id: payload.id,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        currency: typeof payload.currency === 'string' ? payload.currency : undefined,
      };
    },
    async fetchAdInsights(accountId: string, dateFrom: string, dateTo: string): Promise<MetaAdInsight[]> {
      const url = new URL(`https://graph.facebook.com/${version}/act_${accountId}/insights`);
      url.searchParams.set('level', 'ad');
      url.searchParams.set('time_increment', '1');
      url.searchParams.set('time_range', JSON.stringify({ since: dateFrom, until: dateTo }));
      url.searchParams.set('fields', INSIGHT_FIELDS);
      url.searchParams.set('limit', String(pageSize));

      const rows: MetaAdInsight[] = [];
      for (let page = 0; page < maxPages; page++) {
        const payload = await getJson(url);
        const data = Array.isArray(payload.data) ? payload.data : null;
        if (!data) throw new MetaAdsApiError('Meta API trả về JSON thiếu mảng data.');
        rows.push(...data as MetaAdInsight[]);

        const paging = payload.paging && typeof payload.paging === 'object'
          ? payload.paging as Record<string, unknown>
          : null;
        const next = paging?.next;
        if (!next) return rows;
        const cursors = paging?.cursors && typeof paging.cursors === 'object'
          ? paging.cursors as Record<string, unknown>
          : null;
        const after = typeof cursors?.after === 'string' ? cursors.after : '';
        if (!after) throw new MetaAdsApiError('Meta API có trang tiếp theo nhưng thiếu cursor phân trang.');
        url.searchParams.set('after', after);
      }
      throw new MetaAdsApiError(`Meta API vượt quá giới hạn ${maxPages} trang cho tài khoản ${accountId}; chưa lưu dữ liệu tài khoản này.`);
    },
  };
}
