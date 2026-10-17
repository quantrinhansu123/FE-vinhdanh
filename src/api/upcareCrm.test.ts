import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchUpcareMktEmployees } from './upcareCrm';

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
  assert.equal(requests, 0);
});
