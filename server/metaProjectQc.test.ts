import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMetaProjectQcRows, MetaProjectQcError } from './metaProjectQc';
import { MetaDetailReportSyncError, syncMetaProjectQcToDetailReports } from './metaDetailReportSync';

const env = { META_ACCESS_TOKEN: 'test-meta-token', META_AD_ACCOUNT_IDS: '111,222,333' };

const graphError = (code: number, status = 400) =>
  new Response(JSON.stringify({ error: { code, message: 'denied' } }), { status });

type AccountBehaviour = 'ok' | Response;

/** Fake Graph API: each account answers both the account lookup and the insights call. */
function fakeMeta(byAccount: Record<string, () => AccountBehaviour>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const account = url.match(/act_(\d+)/)?.[1] || '';
    const behaviour = byAccount[account]();
    if (behaviour !== 'ok') return behaviour;
    if (!url.includes('/insights')) {
      return new Response(JSON.stringify({ account_id: account, name: `Account ${account}` }));
    }
    return new Response(JSON.stringify({ data: [{
      account_id: account, account_currency: 'VND', campaign_name: `Campaign [NV-${account}]`,
      date_start: '2026-11-01', spend: '1000',
      actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '2' }],
    }] }));
  }) as typeof fetch;
}

test('accounts without permission are skipped and reported instead of failing every account', async () => {
  const result = await loadMetaProjectQcRows(env, '2026-11-01', '2026-11-01', fakeMeta({
    111: () => 'ok', 222: () => graphError(200, 403), 333: () => 'ok',
  }));
  assert.deepEqual(result.rows.map(row => row.accountId), ['111', '333']);
  assert.deepEqual(result.accountIds, ['111', '333']);
  assert.deepEqual(result.failedAccounts.map(item => [item.accountId, item.errorCode]), [['222', 'meta_permission_denied']]);
});

test('token-wide errors still fail the whole request', async () => {
  await assert.rejects(
    loadMetaProjectQcRows(env, '2026-11-01', '2026-11-01', fakeMeta({
      111: () => 'ok', 222: () => graphError(190, 401), 333: () => 'ok',
    })),
    error => error instanceof MetaProjectQcError && error.errorCode === 'meta_token_invalid'
  );
});

test('the request fails when no account is readable', async () => {
  await assert.rejects(
    loadMetaProjectQcRows(env, '2026-11-01', '2026-11-01', fakeMeta({
      111: () => graphError(200, 403), 222: () => graphError(200, 403), 333: () => graphError(10, 403),
    })),
    error => error instanceof MetaProjectQcError && error.errorCode === 'meta_permission_denied'
  );
});

test('detail-report sync refuses partial results so stored rows of failed accounts are not wiped', async () => {
  await assert.rejects(
    syncMetaProjectQcToDetailReports({}, {
      rows: [], accountIds: ['111'], skippedCurrencies: [],
      failedAccounts: [{ accountId: '222', errorCode: 'meta_permission_denied', message: 'denied' }],
    }, '2026-11-01', '2026-11-01'),
    error => error instanceof MetaDetailReportSyncError && error.errorCode === 'meta_accounts_incomplete'
  );
});
