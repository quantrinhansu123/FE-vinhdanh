#!/usr/bin/env node
// Read-only check: can META_ACCESS_TOKEN read every account in META_AD_ACCOUNT_IDS?
// Usage: node scripts/checkMetaAccounts.mjs [path/to/.env] [extraId,extraId...]
// The token value is never printed.
import { readFileSync } from 'node:fs';

const envPath = process.argv[2] || '.env';
const extraIds = (process.argv[3] || '').split(/[\s,;]+/).filter(Boolean);

const env = {};
for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const index = line.indexOf('=');
  env[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^["']|["']$/g, '');
}

const token = env.META_ACCESS_TOKEN || '';
const version = env.META_API_VERSION || 'v26.0';
if (!token) {
  console.error(`META_ACCESS_TOKEN is missing in ${envPath}`);
  process.exit(2);
}

const graph = async (path, params) => {
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  return response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
};
const when = (seconds) => (seconds ? new Date(seconds * 1000).toISOString().slice(0, 16) : 'never');

const appToken = env.META_APP_ID && env.META_APP_SECRET ? `${env.META_APP_ID}|${env.META_APP_SECRET}` : token;
const debug = (await graph('debug_token', { input_token: token, access_token: appToken })).data || {};
console.log(`token valid: ${debug.is_valid} | type: ${debug.type} | app: ${debug.application}`);
console.log(`expires: ${when(debug.expires_at)} | data access expires: ${when(debug.data_access_expires_at)}`);
console.log(`scopes: ${(debug.scopes || []).join(', ')}`);

const STATUS = { 1: 'ACTIVE', 2: 'DISABLED', 3: 'UNSETTLED', 7: 'PENDING_RISK_REVIEW', 8: 'PENDING_SETTLEMENT',
  9: 'IN_GRACE_PERIOD', 100: 'PENDING_CLOSURE', 101: 'CLOSED' };
const ids = [...new Set([...(env.META_AD_ACCOUNT_IDS || '').split(/[\s,;]+/), ...extraIds]
  .map((id) => id.replace(/^act_/i, '')).filter(Boolean))];

let failed = 0;
for (const id of ids) {
  const account = await graph(`act_${id}`, { fields: 'name,account_status,currency', access_token: token });
  const tag = extraIds.includes(id) ? ' (new)' : '';
  if (account.error) {
    failed += 1;
    console.log(`  FAIL ${id}${tag} | ${String(account.error.message).slice(0, 110)}`);
  } else {
    console.log(`  OK   ${id}${tag} | ${account.name} | ${STATUS[account.account_status] || account.account_status} | ${account.currency}`);
  }
}
console.log(`readable: ${ids.length - failed}/${ids.length}`);
process.exitCode = failed ? 1 : 0;
