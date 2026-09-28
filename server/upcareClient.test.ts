import assert from 'node:assert/strict';
import test from 'node:test';
import { createUpcareClient, UpcareAuthError } from './upcareClient';

const credentials = {
  UPCARE_CRM_API_BASE: 'https://crm.example.test',
  UPCARE_CRM_OAUTH_DB: 'test-db',
  UPCARE_CRM_OAUTH_LOGIN: 'test-login',
  UPCARE_CRM_OAUTH_PASSWORD: ' test#password! ',
};
const mktPath = '/api/employee/mkt?date_from=2026-02-22&date_to=2026-02-26';
const jwt = (expiresAt: number) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: expiresAt / 1000 })).toString('base64url')}.signature`;

test('logs in with plain multipart fields, retains token and rotated cookies across requests', async () => {
  let logins = 0;
  const client = createUpcareClient({ ...credentials, UPCARE_CRM_COOKIE: 'session_id=old; frontend_lang=en_US' }, {
    fetch: async (url, init) => {
      if (String(url).endsWith('/api/oauth/token')) {
        logins++;
        assert.equal(init?.method, 'POST');
        assert.equal(new Headers(init?.headers).has('Authorization'), false);
        assert.equal(new Headers(init?.headers).has('Content-Type'), false);
        assert.ok(init?.body instanceof FormData);
        assert.equal(init.body.get('db'), credentials.UPCARE_CRM_OAUTH_DB);
        assert.equal(init.body.get('login'), credentials.UPCARE_CRM_OAUTH_LOGIN);
        assert.equal(init.body.get('password'), credentials.UPCARE_CRM_OAUTH_PASSWORD);
        return Response.json({ access_token: 'new-token' }, { headers: { 'Set-Cookie': 'session_id=rotated; HttpOnly; Path=/' } });
      }
      assert.equal(String(url), `${credentials.UPCARE_CRM_API_BASE}${mktPath}`);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('Authorization'), 'Bearer new-token');
      assert.match(headers.get('Cookie')!, /session_id=rotated/);
      assert.match(headers.get('Cookie')!, /authorization=new-token/);
      assert.match(headers.get('Cookie')!, /frontend_lang=en_US/);
      return Response.json([{ id: 1 }]);
    },
  });
  assert.deepEqual(await (await client.request(mktPath)).json(), [{ id: 1 }]);
  await client.request(mktPath);
  assert.equal(logins, 1);
});

test('renews expired tokens before sending data requests and again near their next expiry', async () => {
  let time = 1800000000000;
  let logins = 0;
  let latestToken = '';
  const client = createUpcareClient({ ...credentials, UPCARE_CRM_BEARER_TOKEN: jwt(time - 1000) }, {
    now: () => time,
    fetch: async (url, init) => {
      if (String(url).endsWith('/api/oauth/token')) {
        logins++;
        latestToken = jwt(time + 3600000);
        return Response.json({ access_token: latestToken });
      }
      assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${latestToken}`);
      return Response.json([]);
    },
  });
  await client.request(mktPath);
  await client.request(mktPath);
  assert.equal(logins, 1);
  time += 3600000 - 30000;
  await client.request(mktPath);
  assert.equal(logins, 2);
});

test('simultaneous 401 responses share one login and reuse the new token', async () => {
  let logins = 0;
  let oldRequests = 0;
  let retries = 0;
  let releaseOld!: () => void;
  const oldBarrier = new Promise<void>(resolve => { releaseOld = resolve; });
  const client = createUpcareClient({ ...credentials, UPCARE_CRM_BEARER_TOKEN: 'old-token' }, {
    fetch: async (url, init) => {
      if (String(url).endsWith('/api/oauth/token')) {
        logins++;
        return Response.json({ access_token: 'renewed-token' });
      }
      if (new Headers(init?.headers).get('Authorization') === 'Bearer old-token') {
        if (++oldRequests === 3) releaseOld();
        await oldBarrier;
        return new Response('Unauthorized', { status: 401 });
      }
      retries++;
      return Response.json([]);
    },
  });
  const results = await Promise.all([client.request(mktPath), client.request(mktPath), client.request(mktPath)]);
  assert.ok(results.every(response => response.status === 200));
  assert.equal(oldRequests, 3);
  assert.equal(logins, 1);
  assert.equal(retries, 3);
});

test('a repeated 401 ends after one retry instead of looping', async () => {
  let logins = 0;
  let dataRequests = 0;
  const client = createUpcareClient({ ...credentials, UPCARE_CRM_BEARER_TOKEN: 'old-token' }, {
    fetch: async url => {
      if (String(url).endsWith('/api/oauth/token')) {
        logins++;
        return Response.json({ access_token: 'new-token' });
      }
      dataRequests++;
      return new Response('Unauthorized', { status: 401 });
    },
  });
  assert.equal((await client.request(mktPath)).status, 401);
  assert.equal(logins, 1);
  assert.equal(dataRequests, 2);
});

test('login failure is sanitized and does not prevent a later login attempt', async () => {
  let logins = 0;
  const client = createUpcareClient(credentials, {
    fetch: async url => {
      if (String(url).endsWith('/api/oauth/token')) {
        if (++logins === 1) return Response.json({ message: 'invalid_database', password: credentials.UPCARE_CRM_OAUTH_PASSWORD }, { status: 403 });
        return Response.json({ access_token: 'new-token' });
      }
      return Response.json([]);
    },
  });
  await assert.rejects(client.request(mktPath), (error: Error) => {
    assert.ok(error instanceof UpcareAuthError);
    assert.match(error.message, /HTTP 403.*invalid_database/);
    assert.ok(!error.message.includes(credentials.UPCARE_CRM_OAUTH_PASSWORD));
    return true;
  });
  assert.equal((await client.request(mktPath)).status, 200);
  assert.equal(logins, 2);
});

test('rejects a successful login response without a token', async () => {
  const client = createUpcareClient(credentials, { fetch: async () => Response.json({}) });
  await assert.rejects(client.request(mktPath), UpcareAuthError);
});

test('rejects requests to login endpoints or other origins before using credentials', async () => {
  const client = createUpcareClient(credentials, { fetch: async () => { throw new Error('Should not fetch'); } });
  await assert.rejects(client.request('/api/oauth/token'), /Unsupported Upcare request/);
  await assert.rejects(client.request('@other.example/api/employee/mkt'), /Unsupported Upcare request/);
});
