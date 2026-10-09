export type MetaAdsLeaderboardAccount = {
  account_id: string;
  account_name: string | null;
  currency: string | null;
  purchase_value: number;
  purchase_count: number;
  last_synced_at: string | null;
};

export type MetaAdsLeaderboardResponse = {
  dateFrom: string;
  dateTo: string;
  accounts: MetaAdsLeaderboardAccount[];
  currencies: string[];
  lastSyncedAt: string | null;
};

export async function fetchMetaAdsLeaderboard(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<MetaAdsLeaderboardResponse> {
  const query = new URLSearchParams({ date_from: params.dateFrom, date_to: params.dateTo });
  const response = await fetch(`/api/meta-ads-leaderboard?${query.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Facebook Ads API trả dữ liệu không hợp lệ (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload as { message?: unknown } : {};
    throw new Error(typeof error.message === 'string' ? error.message : `Không tải được bảng Ads (HTTP ${response.status}).`);
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as MetaAdsLeaderboardResponse).accounts)) {
    throw new Error('Facebook Ads leaderboard không đúng định dạng.');
  }
  return payload as MetaAdsLeaderboardResponse;
}
