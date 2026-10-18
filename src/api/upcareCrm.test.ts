import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchUpcareMktEmployees, fetchUpcareMktEmployeesForRange } from './upcareCrm';

test('personal dashboard makes one range call and keeps Odoo day buckets', async () => {
  const requests: URL[] = [];
  const result = await fetchUpcareMktEmployeesForRange({ dateFrom: '2026-10-02', dateTo: '2026-10-03' }, async (input) => {
    const url = new URL(String(input), 'http://localhost');
    requests.push(url);
    return Response.json({
      '2026-10-02': [{ id: 248, f99_uid: 'FBC.KienHT', name: 'Hà Trung Kiên', amount: 431, data_count: 27, sale_count: 8 }],
      '2026-10-03': [{ id: 248, f99_uid: 'FBC.KienHT', name: 'Hà Trung Kiên', amount: 753, data_count: 14, sale_count: 8 }],
    });
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get('date_from'), '2026-10-02');
  assert.equal(requests[0].searchParams.get('date_to'), '2026-10-03');
  assert.equal(result.hasDailyBreakdown, true);
  assert.equal(result.dailyRows.length, 2);
  assert.deepEqual(
    result.employees.map(({ amount, dataCount, count }) => ({ amount, dataCount, count })),
    [{ amount: 1184, dataCount: 41, count: 16 }],
  );
});

test('period totals use daily Upcare calls and merge by normalized employee code', async () => {
  const requests: URL[] = [];
  const rows = await fetchUpcareMktEmployees({ dateFrom: '2026-10-01', dateTo: '2026-10-02' }, async (input) => {
    const url = new URL(String(input), 'http://localhost');
    requests.push(url);
    const date = url.searchParams.get('date_from');
    assert.equal(url.searchParams.get('date_to'), date);
    const isFirstDay = date === '2026-10-01';
    return Response.json([{
      id: isFirstDay ? 101 : 202,
      f99_uid: isFirstDay ? 'FBC.KienHT' : 'fbc.kienht',
      name: 'Kiên',
      amount: isFirstDay ? 100 : 50,
      data_count: isFirstDay ? 2 : 1,
      sale_count: isFirstDay ? 3 : 1,
    }]);
  });

  assert.deepEqual(requests.map((url) => url.searchParams.get('date_from')), [
    '2026-10-01',
    '2026-10-02',
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { amount: rows[0].amount, data: rows[0].dataCount, orders: rows[0].count },
    { amount: 150, data: 3, orders: 4 },
  );
});

test('period requests reject invalid and overlong date ranges before calling Upcare', async () => {
  let requests = 0;
  const request = async () => {
    requests += 1;
    return Response.json([]);
  };

  await assert.rejects(
    fetchUpcareMktEmployees({ dateFrom: '2026-10-18', dateTo: '2026-10-17' }, request),
    /Khoảng ngày Upcare không hợp lệ/,
  );
  await assert.rejects(
    fetchUpcareMktEmployees({ dateFrom: '2025-01-01', dateTo: '2026-10-17' }, request),
    /không được vượt quá 370 ngày/,
  );
  await assert.rejects(
    fetchUpcareMktEmployeesForRange({ dateFrom: '2026-10-18', dateTo: '2026-10-17' }, request),
    /Khoảng ngày Upcare không hợp lệ/,
  );
  await assert.rejects(
    fetchUpcareMktEmployeesForRange({ dateFrom: '2025-01-01', dateTo: '2026-10-17' }, request),
    /không được vượt quá 370 ngày/,
  );
  assert.equal(requests, 0);
});
