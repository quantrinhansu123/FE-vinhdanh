import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateReportsRawMetrics } from './reportsRawMetrics';

test('detail report sales totals count one normalized employee-day row', () => {
  const result = aggregateReportsRawMetrics([
    {
      id: 'a', report_date: '2026-10-17', code: 'FBC.DieuLN',
      revenue: 85.5, tien_viet: 2_137_500, ad_cost: 1_722_613, mess_comment_count: 8,
    },
    {
      id: 'b', report_date: '2026-10-17', code: 'FBC.DIEULN',
      revenue: 85.5, tien_viet: 2_137_500, ad_cost: 0, mess_comment_count: 0,
    },
    {
      id: 'c', report_date: '2026-10-18', code: 'FBC.DIEULN',
      revenue: 141, tien_viet: 3_525_000, ad_cost: 0, mess_comment_count: 0,
    },
    {
      id: 'd', report_date: '2026-10-17', code: 'FBC.KienHT',
      revenue: 100, tien_viet: 2_500_000, ad_cost: 10, mess_comment_count: 2,
    },
  ]);

  assert.deepEqual(result, {
    mess: 10,
    ads: 1_722_623,
    vnd: 8_162_500,
    revenue: 326.5,
  });
});

test('detail report sales totals keep separate dates and unkeyed rows distinct', () => {
  const result = aggregateReportsRawMetrics([
    { id: 'a', report_date: '2026-10-17', code: 'FBC.KienHT', revenue: 100, tien_viet: 2_500_000 },
    { id: 'b', report_date: '2026-10-18', code: 'FBC.KienHT', revenue: 200, tien_viet: 5_000_000 },
    { id: 'c', report_date: '2026-10-18', revenue: 10, tien_viet: 250_000 },
  ]);

  assert.equal(result.revenue, 310);
  assert.equal(result.vnd, 7_750_000);
});

test('detail report sales can use an employee code embedded in the page tag', () => {
  const result = aggregateReportsRawMetrics([
    { id: 'a', report_date: '2026-10-17', page: 'Ad set [FBC.KienHT]', revenue: 100, tien_viet: 2_500_000 },
    { id: 'b', report_date: '2026-10-17', page: 'Ad set [FBC.KIENHT]', revenue: 100, tien_viet: 2_500_000 },
  ]);

  assert.equal(result.revenue, 100);
  assert.equal(result.vnd, 2_500_000);
});
