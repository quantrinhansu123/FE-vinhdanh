# Facebook Ads hourly sync

The hourly marketing job reads the existing Odoo employee/MKT and employee/Sale endpoints plus Meta ad-level Insights, then upserts the source records into Supabase. It stores Sale and MKT snapshots separately from Meta purchase attribution. Leaderboard APIs are a separate read layer.

## One-time setup

1. Run `supabase/create_facebook_ads_insights.sql`, `supabase/create_upcare_mkt_snapshots.sql`, and `supabase/create_upcare_sale_snapshots.sql` in the target Supabase project.
2. Set the following server-side environment variables in Vercel. None of the secrets should use a `VITE_` prefix.
   - `META_ACCESS_TOKEN`: a server-held token with `ads_read` and access to every configured ad account.
   - `META_AD_ACCOUNT_IDS`: comma-separated numeric IDs, with or without the `act_` prefix.
   - `META_API_VERSION`: Graph API version; currently defaults to `v26.0`.
   - `META_REPORTING_TIMEZONE`: reporting date zone; defaults to `Asia/Ho_Chi_Minh`.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase credentials.
   - `CRON_SECRET`: a random secret used to authorize scheduled/manual sync calls.
   - `META_SYNC_LOOKBACK_DAYS`: rolling window to refresh each hour; default `7`, maximum `90`.
   - `UPCARE_CRM_OAUTH_DB`, `UPCARE_CRM_OAUTH_LOGIN`, `UPCARE_CRM_OAUTH_PASSWORD`, and `UPCARE_CRM_OAUTH_BOOTSTRAP_BEARER`: server-only Odoo OAuth settings used by `server/upcareClient.ts`.
3. Deploy the project. Vercel invokes `/api/marketing-sync` hourly and supplies `Authorization: Bearer <CRON_SECRET>`.

Hourly Vercel Cron requires a Pro or Enterprise plan. Vercel Hobby only accepts daily cron schedules, so on Hobby use an external hourly scheduler to call the protected endpoint or upgrade the project plan.

The sync requests ad-level daily Insights (`spend`, `impressions`, `reach`, `clicks`, `actions`, `action_values`, and `purchase_roas`), follows Graph API cursor pagination, retries transient errors, and updates matching daily rows on later runs. In the same hourly job, Odoo's `GET /api/employee/mkt` and `GET /api/employee/sale` responses are saved independently with the requested date range. Raw Ads rows and Odoo snapshots are restricted to the Supabase service role.

Meta ad insights and Odoo Sale employee summaries are stored as separate records. The employee board reads the top 20 Odoo Sale rows; the Meta account board remains separate because there is no configured mapping from an employee to a Meta ad or account.

## Leaderboard values

- Employee ranking reads the top 20 rows from the Odoo `/api/employee/sale` `amount` snapshots in Supabase.
- Meta Ads remains a separate account leaderboard, using Meta's attributed purchase value. It does not merge Facebook ad results into employee sales without an explicit employee-to-ad mapping.
- Ad-account ranking uses the selected Meta purchase action value from `action_values`; purchase count comes from `actions`. Raw action arrays are also retained. Account currencies are returned so the UI can rank within a currency group rather than comparing unlike currencies.
- If Meta uses a different purchase action type, inspect `actions` / `action_values` in the raw table and update the purchase-action preference in `server/metaAdsSync.ts`.

## Manual sync

Call `GET https://<your-domain>/api/marketing-sync` with the same bearer authorization header as the cron. For a one-off date range, provide both `date_from=YYYY-MM-DD` and `date_to=YYYY-MM-DD` (maximum 90 days). Do not paste the authorization value into chat, source control, or a browser URL.

The Meta account leaderboard is available at `/api/meta-ads-leaderboard?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`, and the Odoo Sale employee leaderboard at `/api/upcare-sale-leaderboard?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`; without dates they use the same rolling window as the sync. The older Odoo MKT snapshot route remains available at `/api/upcare-mkt-leaderboard`.

The raw Supabase tables have no `anon`/`authenticated` access. These two GET routes are currently publicly callable, matching the existing `/api/upcare-crm` proxy and the app's client-side login pattern; they return only leaderboard totals. If these revenue figures must be private, add server-side user authentication to the read routes before exposing the deployment publicly.
