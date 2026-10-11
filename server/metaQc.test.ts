import assert from 'node:assert/strict';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { metaReportToQcRows } from './metaQc';
import { MetaError, type MetaInsight, type MetaReport } from './metaClient';
import { createMetaQcHandler, readMetaQcSession, signMetaQcSession } from './metaQcHandler';

const secret = 'qc-session-test-secret-at-least-32-characters';
const env = { META_SYNC_SECRET: secret, SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', META_ACCESS_TOKEN: 'test-meta-token', META_AD_ACCOUNT_IDS: '123' };
const ad: MetaInsight = { account_id: '123', account_name: 'Account', account_currency: 'VND',
  campaign_id: '456', campaign_name: 'Campaign [NV-01]', adset_id: '1', adset_name: 'Set', ad_id: '789', ad_name: 'Ad',
  date_start: '2026-10-01', date_stop: '2026-10-01', spend: '1000.10', impressions: '100', clicks: '1', reach: '50',
  cpc: '0', cpm: '0', ctr: '0', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '2' },
    { action_type: 'onsite_conversion.messaging_first_reply', value: '9' }], action_values: [] };
const report: MetaReport = { account_id: '123', account_timezone: 'Asia/Ho_Chi_Minh',
  range: { since: '2026-10-01', until: '2026-10-01' }, fetched_at: '2026-10-02T00:00:00Z', data: [ad] };

test('campaign/day rows sum ads once and use only the conversation-start metric', () => {
  const rows = metaReportToQcRows({ ...report, data: [ad, { ...ad, ad_id: '790' },
    { ...ad, ad_id: '791', date_start: '2026-10-02', date_stop: '2026-10-02' }] });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].ma_nv, 'NV-01');
  assert.equal(rows[0].so_tien_da_chi_tieu_vnd, 2000.20);
  assert.equal(rows[0].so_tro_chuyen_tin_nhan, 4);
  assert.equal(metaReportToQcRows({ ...report, data: [{ ...ad, campaign_name: 'No code' }] })[0].ma_nv, null);
  assert.throws(() => metaReportToQcRows({ ...report, data: [{ ...ad, account_currency: 'USD' }] }),
    error => error instanceof MetaError && error.code === 'meta_currency_unsupported');
});

test('signed CRM session rejects tampering and expires after one hour', () => {
  const now = 1000000;
  const token = signMetaQcSession('user-1', secret, now);
  assert.equal(readMetaQcSession(`other=foo; meta_qc_session=${token}`, secret, now), 'user-1');
  assert.equal(readMetaQcSession(`meta_qc_session=${token}`, 'wrong-secret', now), null);
  assert.equal(readMetaQcSession(`meta_qc_session=${token}`, secret, now + 3600000), null);
  const forged = Buffer.from(JSON.stringify({ id: 'admin', exp: 9999999999 })).toString('base64url');
  assert.equal(readMetaQcSession(`meta_qc_session=${forged}.${token.split('.')[1]}`, secret, now), null);
});

async function call(options: { method?: string; action?: string; body?: unknown; cookie?: string;
  headers?: Record<string, string>; fetch?: typeof fetch; env?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {};
  let body = '';
  const res = { statusCode: 0, setHeader: (key: string, value: string) => { headers[key] = value; }, end: (value: string) => { body = value; } };
  const req = { method: options.method || 'GET', url: `/api/meta-qc${options.action ? `?action=${options.action}` : ''}`,
    headers: { 'x-meta-qc-request': '1', cookie: options.cookie, ...options.headers }, body: options.body };
  await createMetaQcHandler({ ...env, ...options.env }, { fetch: options.fetch || (async () => { assert.fail('Unexpected upstream call'); }) })(
    req as unknown as IncomingMessage, res as unknown as ServerResponse);
  return { status: res.statusCode, headers, data: JSON.parse(body) };
}
const employee = { id: 'user-1', email: 'admin@example.test', pass: 'test-password', vi_tri: 'Admin' };

test('QC API denies cached browser roles, missing sessions and cross-site requests', async () => {
  assert.equal((await call()).status, 401);
  assert.equal((await call({ method: 'POST', body: { role: 'admin', email: employee.email } })).status, 401);
  assert.equal((await call({ headers: { 'x-meta-qc-request': '' } })).status, 403);
  assert.equal((await call({ headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await call({ method: 'DELETE' })).status, 405);
});

test('CRM login verifies password and role on the server, without exposing credentials', async () => {
  const login = { method: 'POST', action: 'login', body: { email: employee.email, password: employee.pass } };
  const result = await call({ ...login, env: { NODE_ENV: 'production' }, fetch: async () => Response.json([employee]) });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { accounts: ['123'] });
  assert.match(result.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
  assert.match(result.headers['Set-Cookie'], /; Secure$/);
  assert.equal(JSON.stringify(result.data).includes('test-service-key'), false);
  assert.equal((await call({ ...login, body: { email: employee.email, password: 'wrong' }, fetch: async () => Response.json([employee]) })).status, 401);
  assert.equal((await call({ ...login, fetch: async () => Response.json([{ ...employee, vi_tri: 'MKT' }]) })).status, 403);
});

test('authenticated import fetches Meta then makes exactly one scoped private QC transaction', async () => {
  let writes = 0;
  const cookie = `meta_qc_session=${signMetaQcSession('user-1', secret)}`;
  const result = await call({ method: 'POST', cookie, body: { account_id: '123', since: '2026-10-01', until: '2026-10-01' }, fetch: async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'graph.facebook.com') {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-meta-token');
      return Response.json(url.pathname.endsWith('/insights') ? { data: [ad] } : { account_id: '123', timezone_name: report.account_timezone });
    }
    assert.equal(new Headers(init?.headers).get('apikey'), 'test-service-key');
    if (url.pathname.endsWith('/rpc/replace_meta_qc_excel')) {
      writes++;
      const data = JSON.parse(String(init?.body));
      assert.equal(data.p_account_id, '123');
      assert.equal(data.p_since, '2026-10-01');
      assert.deepEqual(data.p_rows, metaReportToQcRows(report));
      return Response.json(1);
    }
    return Response.json({ email: employee.email, vi_tri: employee.vi_tri });
  } });
  assert.equal(result.status, 200);
  assert.equal(writes, 1);
  assert.equal(result.data.rows_saved, 1);
});

test('an existing session does not authorize an employee whose role was removed', async () => {
  const result = await call({ cookie: `meta_qc_session=${signMetaQcSession('user-1', secret)}`,
    fetch: async () => Response.json({ email: employee.email, vi_tri: 'MKT' }) });
  assert.equal(result.status, 403);
});
