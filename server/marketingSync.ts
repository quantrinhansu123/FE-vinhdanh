import { getMetaDateRange, syncMetaAds, type MetaSyncOptions } from './metaAdsSync';
import { syncUpcareMktSnapshot } from './upcareSnapshotSync';
import { syncUpcareSaleSnapshot } from './upcareSaleSnapshotSync';
import { createUpcareClient } from './upcareClient';
import type { MetaEnvironment } from './metaAdsClient';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Lỗi không xác định.';
}

export async function syncMarketingSources(env: MetaEnvironment, options: MetaSyncOptions = {}) {
  const startedAt = Date.now();
  const range = getMetaDateRange(env, options);
  const upcare = createUpcareClient(env);
  const [metaResult, odooMktResult, odooSaleResult] = await Promise.allSettled([
    syncMetaAds(env, { dateFrom: range.dateFrom, dateTo: range.dateTo }),
    syncUpcareMktSnapshot(env, range.dateFrom, range.dateTo, undefined, upcare),
    syncUpcareSaleSnapshot(env, range.dateFrom, range.dateTo, undefined, upcare),
  ]);

  const metaAds = metaResult.status === 'fulfilled'
    ? metaResult.value
    : { ok: false, error: errorText(metaResult.reason) };
  const odooMkt = odooMktResult.status === 'fulfilled'
    ? odooMktResult.value
    : { ok: false, error: errorText(odooMktResult.reason) };
  const odooSale = odooSaleResult.status === 'fulfilled'
    ? odooSaleResult.value
    : { ok: false, error: errorText(odooSaleResult.reason) };
  const ok = metaAds.ok && odooMkt.ok && odooSale.ok;
  return {
    ok,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    metaAds,
    odooMkt,
    odooSale,
    durationMs: Date.now() - startedAt,
  };
}
