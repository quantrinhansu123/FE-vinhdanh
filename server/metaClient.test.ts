import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetaClient, MetaError, metaAccountIds, metaDateRange } from './metaClient';

const env = { META_ACCESS_TOKEN: 'test-meta-token', META_AD_ACCOUNT_IDS: '123, act_456,123', META_API_VERSION: 'v26.0' };
const range = { since: '2026-10-01', until: '2026-10-07' };
const row = { account_id: '123', account_currency: 'VND', ad_id: '789',
  date_start: range.since, date_stop: range.since, spend: '12345.67', impressions: '100' };
const metadata = { account_id: '123', timezone_name: 'America/Los_Angeles' };
const errorCode = (code: string) => (error: unknown) => error instanceof MetaError && error.code === code;

test('account list normalization and reporting timezone date boundaries', () => {
  assert.deepEqual(metaAccountIds(env), ['123', '456']);
  assert.deepEqual(metaDateRange({}, undefined, undefined, new Date('2026-10-09T18:00:00Z')),
    { since: '2026-10-04', until: '2026-10-10' });
  assert.throws(() => metaDateRange({}, '2026-02-30', '2026-03-01'), errorCode('invalid_date_range'));
  assert.throws(() => metaDateRange({}, '2026-10-01', null), errorCode('invalid_date_range'));
  assert.throws(() => metaDateRange({}, '2026-09-01', '2026-10-02'), errorCode('invalid_date_range'));
  assert.throws(() => metaDateRange({}, '2026-10-02', '2026-10-01'), errorCode('invalid_date_range'));
  assert.throws(() => metaDateRange({ META_REPORTING_TIMEZONE: 'bad' }), errorCode('meta_config_invalid'));
  assert.throws(() => createMetaClient({ ...env, META_SYNC_PAGE_SIZE: 'NaN' }), errorCode('meta_config_invalid'));
});

test('reads all pages using a fixed host, strips paging URLs, preserves decimals and account timezone', async () => {
  const calls: URL[] = [];
  const client = createMetaClient(env, { fetch: async (input, init) => {
    const url = new URL(String(input));
    calls.push(url);
    assert.equal(url.origin, 'https://graph.facebook.com');
    assert.equal(url.searchParams.has('access_token'), false);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-meta-token');
    assert.equal(init?.redirect, 'error');
    if (!url.pathname.endsWith('/insights')) return Response.json(metadata);
    assert.equal(url.searchParams.get('level'), 'ad');
    assert.equal(url.searchParams.get('time_increment'), '1');
    if (!url.searchParams.has('after')) return Response.json({ data: [row],
      paging: { next: 'https://untrusted.test/?access_token=test-meta-token', cursors: { after: 'page-2' } } });
    return Response.json({ data: [row, { ...row, ad_id: '790', actions: [{ action_type: 'lead', value: '2' }] }] });
  } });
  const report = await client.insights('act_123', range);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].searchParams.get('after'), 'page-2');
  assert.equal(report.data.length, 2);
  assert.equal(report.data[0].spend, '12345.67');
  assert.equal(report.account_timezone, metadata.timezone_name);
  assert.equal(JSON.stringify(report).includes('test-meta-token'), false);
  assert.deepEqual(report.data[1].actions, [{ action_type: 'lead', value: '2' }]);
});

test('does not contact Meta for an unconfigured account', async () => {
  const client = createMetaClient(env, { fetch: async () => { assert.fail('Unexpected network request'); } });
  await assert.rejects(client.insights('999', range), errorCode('account_not_allowed'));
});

test('page cap and repeated cursors reject instead of returning partial data', async () => {
  const request: typeof fetch = async input => !String(input).includes('/insights?') ? Response.json(metadata) :
    Response.json({ data: [row], paging: { next: 'next', cursors: { after: 'repeated' } } });
  await assert.rejects(createMetaClient({ ...env, META_SYNC_MAX_PAGES_PER_ACCOUNT: '1' }, { fetch: request })
    .insights('123', range), errorCode('meta_page_limit'));
  await assert.rejects(createMetaClient(env, { fetch: request }).insights('123', range), errorCode('meta_invalid_pagination'));
});

test('retries rate limits but sanitizes expired-token errors without retrying', async () => {
  let attempts = 0;
  const delays: number[] = [];
  const client = createMetaClient(env, { sleep: async ms => { delays.push(ms); }, fetch: async input => {
    if (String(input).includes('/insights?')) return Response.json({ data: [] });
    attempts++;
    return attempts < 3 ? Response.json({ error: { code: 4 } }, { status: 429 }) : Response.json(metadata);
  } });
  assert.equal((await client.insights('123', range)).data.length, 0);
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [500, 1000]);
  let authAttempts = 0;
  const failed = createMetaClient(env, { fetch: async () => {
    authAttempts++;
    return Response.json({ error: { code: 190, message: 'test-meta-token private details' } }, { status: 400 });
  } });
  await assert.rejects(failed.insights('123', range), error => {
    assert.ok(error instanceof MetaError);
    assert.equal(error.code, 'meta_auth_failed');
    assert.equal(error.message.includes('test-meta-token'), false);
    return true;
  });
  assert.equal(authAttempts, 1);
});

test('malformed, wrong-account and out-of-range rows fail before storage', async () => {
  for (const invalidRow of [{ ...row, account_id: '456' }, { ...row, spend: 'oops' },
    { ...row, date_start: '2026-09-01', date_stop: '2026-09-01' }, { ...row, date_stop: range.until }]) {
    const client = createMetaClient(env, { fetch: async input => Response.json(
      String(input).includes('/insights?') ? { data: [invalidRow] } : metadata) });
    await assert.rejects(client.insights('123', range), errorCode('meta_invalid_response'));
  }
});

test('aborted reports do not issue requests', async () => {
  const controller = new AbortController();
  controller.abort();
  const client = createMetaClient(env, { fetch: async () => { assert.fail('Unexpected network request'); } });
  await assert.rejects(client.insights('123', range, controller.signal));
});
