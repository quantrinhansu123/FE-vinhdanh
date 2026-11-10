import { normalizeUpcareMktEmployeeCode, type UpcareMktEmployeeRow } from './upcareCrm';

export type UpcareAccountRow = UpcareMktEmployeeRow & {
  saleRevenue: number | null;
  deliveryRevenue: number | null;
};

const SALE_ACCOUNT_CODES = ['FBC.Hotline', 'FBC.OldCustomer'] as const;
const saleCodeKeys = new Set(SALE_ACCOUNT_CODES.map(normalizeUpcareMktEmployeeCode));

/** Use the Odoo MKT `total` and `sale_count` for both requested sales measures. */
export function mapUpcareMktAccountTotals(mktRows: UpcareMktEmployeeRow[]): UpcareAccountRow[] {
  const result: UpcareAccountRow[] = [];
  const targetRows = new Map<string, UpcareAccountRow>();
  for (const row of mktRows) {
    const key = normalizeUpcareMktEmployeeCode(row.code);
    if (!saleCodeKeys.has(key)) {
      result.push({ ...row, saleRevenue: null, deliveryRevenue: null });
      continue;
    }
    const previous = targetRows.get(key);
    if (previous) {
      previous.amount += Number(row.amount) || 0;
      previous.dataCount = (Number(previous.dataCount) || 0) + (Number(row.dataCount) || 0);
      previous.count = (Number(previous.count) || 0) + (Number(row.count) || 0);
      previous.saleRevenue = previous.amount;
      previous.deliveryRevenue = previous.amount;
      if (!previous.name?.trim() && row.name?.trim()) previous.name = row.name;
      continue;
    }
    const total = Number(row.amount) || 0;
    const target = {
      ...row,
      amount: total,
      count: Number(row.count) || 0,
      dataCount: Number(row.dataCount) || 0,
      saleRevenue: total,
      deliveryRevenue: total,
    };
    targetRows.set(key, target);
    result.push(target);
  }
  return result;
}
