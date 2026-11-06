import { normalizeUpcareMktEmployeeCode, type UpcareMktEmployeeRow } from './upcareCrm';

export type UpcareAccountRow = UpcareMktEmployeeRow & { saleRevenue: number | null };

const SALE_ACCOUNT_CODES = ['FBC.Hotline', 'FBC.OldCustomer'] as const;
const saleCodeKeys = new Set(SALE_ACCOUNT_CODES.map(normalizeUpcareMktEmployeeCode));

/** The MKT employee response is authoritative for these account totals. */
export function shouldSkipZeroRevenueSync(row: UpcareAccountRow): boolean {
  return saleCodeKeys.has(normalizeUpcareMktEmployeeCode(row.code))
    && row.saleRevenue === 0
    && (Number(row.count) || 0) === 0;
}

/** Use the `total` and `sale_count` values normalized by fetchUpcareMktEmployees. */
export function mapUpcareMktAccountTotals(mktRows: UpcareMktEmployeeRow[]): UpcareAccountRow[] {
  const seen = new Set<string>();
  const result: UpcareAccountRow[] = [];
  for (const row of mktRows) {
    const key = normalizeUpcareMktEmployeeCode(row.code);
    if (!saleCodeKeys.has(key)) {
      result.push({ ...row, saleRevenue: null });
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const total = Number(row.amount) || 0;
    result.push({ ...row, amount: total, count: Number(row.count) || 0, saleRevenue: total });
  }
  return result;
}
