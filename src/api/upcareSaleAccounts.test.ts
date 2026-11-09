import assert from 'node:assert/strict';
import test from 'node:test';
import { mapUpcareMktAccountTotals, shouldSkipZeroRevenueSync } from './upcareSaleAccounts';

test('uses MKT total and sale_count for Hotline and Old Customer', () => {
  const rows = mapUpcareMktAccountTotals([
    { id: 145, code: 'FBC.Hotline', name: 'Hotline MKT', avatar: null, amount: 122, count: 3, dataCount: 0 },
    { id: 153, code: 'FBC.OldCustomer', name: 'Old MKT', avatar: null, amount: 1010, count: 2, dataCount: 0 },
    { id: 215, code: 'FBC.AnhPT', name: 'Anh', avatar: null, amount: 210, count: 1, dataCount: 2 },
  ]);
  assert.deepEqual(rows.map(({ code, amount, count, dataCount, saleRevenue }) => ({ code, amount, count, dataCount, saleRevenue })), [
    { code: 'FBC.Hotline', amount: 122, count: 3, dataCount: 0, saleRevenue: 122 },
    { code: 'FBC.OldCustomer', amount: 1010, count: 2, dataCount: 0, saleRevenue: 1010 },
    { code: 'FBC.AnhPT', amount: 210, count: 1, dataCount: 2, saleRevenue: null },
  ]);
});

test('protects saved sales from a zero response for the two Sales accounts', () => {
  const rows = mapUpcareMktAccountTotals([
    { id: 145, code: 'FBC.Hotline', name: 'Hotline', avatar: null, amount: 0, count: 0 },
    { id: 200, code: 'FBC.Other', name: 'Other', avatar: null, amount: 0, count: 0 },
  ]);
  assert.deepEqual(rows.map(shouldSkipZeroRevenueSync), [true, false]);
});
