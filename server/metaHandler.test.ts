import assert from 'node:assert/strict';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMetaHandler } from './metaHandler';

const secret = 'test-sync-secret-with-at-least-32-characters';
async function request(options: { method?: string; authorization?: string; url?: string; env?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {};
  let body = '';
  const res = { statusCode: 0, setHeader: (key: string, value: string) => { headers[key] = value; },
    end: (value: string) => { body = value; } };
  await createMetaHandler({ META_SYNC_SECRET: secret, ...options.env })({
    method: options.method || 'GET', url: options.url || '/api/meta-ads?account_id=123',
    headers: { authorization: options.authorization },
  } as IncomingMessage, res as unknown as ServerResponse);
  return { status: res.statusCode, headers, body: JSON.parse(body) };
}

test('GET and POST require the separate server secret', async () => {
  for (const method of ['GET', 'POST']) {
    for (const authorization of [undefined, 'Bearer wrong-secret', `Bearer ${'x'.repeat(secret.length)}`]) {
      const result = await request({ method, authorization });
      assert.equal(result.status, 401);
      assert.equal(result.headers['Cache-Control'], 'no-store');
      assert.deepEqual(result.body, { error: 'unauthorized' });
    }
  }
});

test('fails closed for missing secret and rejects unsupported methods', async () => {
  assert.equal((await request({ env: { META_SYNC_SECRET: '' } })).status, 503);
  const result = await request({ method: 'DELETE' });
  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'GET, POST');
});

test('validates path, account and range before accessing upstream credentials', async () => {
  const authorization = `Bearer ${secret}`;
  assert.equal((await request({ authorization, url: '/api/meta-ads/anything' })).status, 404);
  assert.equal((await request({ authorization, url: '/api/meta-ads' })).status, 400);
  assert.equal((await request({ authorization, url: '/api/meta-ads?account_id=123/insights' })).status, 400);
  assert.equal((await request({ authorization, url: '/api/meta-ads?account_id=123&since=2026-02-30&until=2026-03-01' })).status, 400);
  assert.equal((await request({ authorization })).body.error, 'meta_not_configured');
  const write = await request({ authorization, method: 'POST' });
  assert.equal(write.status, 503);
  assert.equal(write.body.error, 'meta_storage_not_configured');
});
