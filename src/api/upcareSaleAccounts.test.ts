import assert from 'node:assert/strict';
import test from 'node:test';
import { mapUpcareMktAccountTotals } from './upcareSaleAccounts';

test('uses MKT total and sale_count for both requested sales measures', () => {
  const rows = mapUpcareMktAccountTotals([
    { id: 145, code: 'FBC.Hotline', name: 'Hotline MKT', avatar: null, amount: 122, count: 3, dataCount: 0 },
    { id: 153, code: 'FBC.OldCustomer', name: 'Old MKT', avatar: null, amount: 1010, count: 2, dataCount: 0 },
    { id: 215, code: 'FBC.AnhPT', name: 'Anh', avatar: null, amount: 210, count: 1, dataCount: 2 },
  ]);
  assert.deepEqual(rows.map(({ code, amount, count, dataCount, saleRevenue, deliveryRevenue }) => ({ code, amount, count, dataCount, saleRevenue, deliveryRevenue })), [
    { code: 'FBC.Hotline', amount: 122, count: 3, dataCount: 0, saleRevenue: 122, deliveryRevenue: 122 },
    { code: 'FBC.OldCustomer', amount: 1010, count: 2, dataCount: 0, saleRevenue: 1010, deliveryRevenue: 1010 },
    { code: 'FBC.AnhPT', amount: 210, count: 1, dataCount: 2, saleRevenue: null, deliveryRevenue: null },
  ]);
});

test('uses Odoo zero totals without falling back to stale report values', () => {
  const rows = mapUpcareMktAccountTotals([
    { id: 145, code: 'FBC.Hotline', name: 'Hotline', avatar: null, amount: 0, count: 0 },
    { id: 200, code: 'FBC.Other', name: 'Other', avatar: null, amount: 0, count: 0 },
  ]);
  assert.deepEqual(rows.map(({ amount, saleRevenue, deliveryRevenue }) => ({ amount, saleRevenue, deliveryRevenue })), [
    { amount: 0, saleRevenue: 0, deliveryRevenue: 0 },
    { amount: 0, saleRevenue: null, deliveryRevenue: null },
  ]);
});

test('combines duplicate Odoo rows for the same target code', () => {
  const rows = mapUpcareMktAccountTotals([
    { id: 145, code: 'FBC.Hotline', name: 'Hotline', avatar: null, amount: 52, count: 1, dataCount: 1 },
    { id: 146, code: 'fbc.hotline', name: 'Hotline', avatar: null, amount: 10, count: 2, dataCount: 3 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 62);
  assert.equal(rows[0].count, 3);
  assert.equal(rows[0].dataCount, 4);
  assert.equal(rows[0].deliveryRevenue, 62);
});
