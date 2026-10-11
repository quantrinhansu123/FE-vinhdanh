import { config } from 'dotenv';
import { createMetaClient, MetaError, metaDateRange } from './metaClient';
import { createMetaStore } from './metaSync';

// Shell/server values take precedence, then .env.local, then .env.
config({ path: ['.env.local', '.env'], quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const readOnly = args.includes('--read-only');
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--read-only') continue;
    if (!['--account', '--since', '--until'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new MetaError(400, 'invalid_arguments', 'Usage: npm run meta:sync -- [--read-only] [--account ID] [--since YYYY-MM-DD --until YYYY-MM-DD]');
    }
    values.set(args[i], args[++i]);
  }
  const client = createMetaClient(process.env);
  const range = metaDateRange(process.env, values.get('--since'), values.get('--until'));
  const account = values.get('--account')?.replace(/^act_/, '');
  if (account && !client.accountIds.includes(account)) throw new MetaError(403, 'account_not_allowed', 'Account is not configured.');
  const save = readOnly ? undefined : createMetaStore(process.env);
  for (const id of account ? [account] : client.accountIds) {
    try {
      // Run outside the serverless request deadline for large account reports.
      const signal = AbortSignal.timeout(15 * 60 * 1000);
      const report = await client.insights(id, range, signal);
      console.log(JSON.stringify(save ? await save(report, signal) : report));
    } catch (error) {
      console.error(JSON.stringify({ account_id: id, error: error instanceof MetaError ? error.code : 'meta_operation_failed',
        message: error instanceof MetaError ? error.message : 'Meta operation failed.' }));
      process.exitCode = 1;
    }
  }
}

main().catch(error => {
  console.error(error instanceof MetaError ? `${error.code}: ${error.message}` : 'Meta sync failed. Check server configuration.');
  process.exitCode = 1;
});
