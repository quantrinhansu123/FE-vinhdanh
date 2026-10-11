import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaError, type MetaReport } from './metaClient';
import { createMetaStore } from './metaSync';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key' };
const report: MetaReport = { account_id: '123', account_timezone: 'Asia/Ho_Chi_Minh',
  range: { since: '2026-10-01', until: '2026-10-07' }, fetched_at: '2026-10-07T01:00:00Z', data: [] };

test('empty reports replace only their account/date slice using the private transaction RPC', async () => {
  let calls = 0;
  const save = createMetaStore(env, { fetch: async (input, init) => {
    calls++;
    assert.equal(String(input), 'https://example.supabase.co/rest/v1/rpc/replace_meta_ads_insights');
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('apikey'), 'test-service-role-key');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      p_account_id: '123', p_since: '2026-10-01', p_until: '2026-10-07', p_timezone: report.account_timezone,
      p_fetched_at: report.fetched_at, p_rows: [],
    });
    return Response.json(0);
  } });
  const result = await save(report);
  assert.equal(calls, 1);
  assert.equal(result.rows_saved, 0);
  assert.equal(JSON.stringify(result).includes('test-service-role-key'), false);
});

test('storage errors are sanitized and browser anon credentials are not used', async () => {
  const save = createMetaStore(env, { fetch: async () => Response.json({ message: 'test-service-role-key internal details' }, { status: 400 }) });
  await assert.rejects(save(report), error => {
    assert.ok(error instanceof MetaError);
    assert.equal(error.code, 'meta_storage_failed');
    assert.equal(error.message.includes('test-service-role-key'), false);
    return true;
  });
  assert.throws(() => createMetaStore({ VITE_SUPABASE_URL: env.SUPABASE_URL, VITE_SUPABASE_ANON_KEY: 'anon' }),
    error => error instanceof MetaError && error.code === 'meta_storage_not_configured');
});
