# Facebook Ads hourly sync

This sync reads Meta ad-level daily Insights and upserts raw ad rows plus account/day aggregates into Supabase. It does not call Odoo; Odoo employee sales remain a separate leaderboard.

## One-time setup

1. For an existing company Supabase project, **do not run** `supabase/create_employees_table.sql` or insert a new admin/employee row. The app reads the existing `public.employees` table (or `VITE_SUPABASE_EMPLOYEES_TABLE` if its table has another name). This Meta integration adds only the two Meta tables from `supabase/create_facebook_ads_insights.sql`; it does not replace employee data or the employee form.
2. Login uses Supabase Auth, then matches the signed-in email to the existing employee row. The existing admin must therefore already be present under Supabase Authentication → Users, and the browser and server environment variables must point to that same Supabase project. If the admin exists only as a row in `public.employees` with a legacy `pass` value, that is not a Supabase Auth account and this branch cannot sign it in until the account is provisioned in Supabase Auth.
3. Run only `supabase/create_facebook_ads_insights.sql` in the target Supabase project's SQL Editor. This creates the Meta destination tables; it does not fetch data by itself.
4. Set the public build variables in Vercel Preview for an isolated test. These are safe browser settings, not secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (publishable/anon key only)
   - `VITE_SUPABASE_EMPLOYEES_TABLE` (optional; defaults to `employees`)
5. Add these variables to the Vercel Preview environment. Keep all secrets server-side; do not use `VITE_` prefixes.
   - `META_ACCESS_TOKEN`: a token with `ads_read` and access to every configured ad account.
   - `META_AD_ACCOUNT_IDS`: comma-separated numeric IDs, with or without the `act_` prefix.
   - `META_API_VERSION`: Graph API version; defaults to `v26.0`.
   - `META_REPORTING_TIMEZONE`: fallback if Meta does not return an account timezone; defaults to `Asia/Ho_Chi_Minh`.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: server credentials for writes and private reads. Point these to the same Supabase project as the public build URL.
   - `CRON_SECRET`: a random secret of at least 16 characters. Vercel uses it to authorize scheduled calls.
   - `META_SYNC_LOOKBACK_DAYS`: rolling window refreshed hourly; defaults to `14`, maximum `90`.
   - `SUPABASE_ANON_KEY`: optional server-side copy of the publishable/anon key used to validate a Supabase Auth session for the Meta read endpoint. If omitted, the endpoint uses `VITE_SUPABASE_ANON_KEY`.
6. Deploy the feature branch to a Vercel Preview. Trigger one manual sync to validate the Meta → Supabase write, then sign in and open `/meta`. `vercel.json` schedules `GET /api/meta-ads-sync` at minute 0 of every hour on Production; Preview and `vite dev` do not run that schedule automatically.

Vercel Hobby supports daily cron schedules only; an hourly schedule will fail deployment on Hobby. Hourly runs require Pro/Enterprise or an external scheduler calling the protected endpoint. Vercel schedules in UTC. It does not retry failed invocations, so check the function logs; partial account failures now return HTTP 502 and are visible as failed runs. The function is configured for up to 300 seconds per invocation.

Each run requests daily Insights (`spend`, `impressions`, `reach`, `clicks`, `actions`, `action_values`, and `purchase_roas`) for a rolling 14-day window. It uses each Meta ad account's `timezone_name` to select the date range, follows Graph API cursor pagination, retries transient Meta errors, and upserts matching daily rows. Re-fetching recent dates lets later runs replace preliminary values Meta may revise; it does not mean same-day reporting is final. Writes use the Supabase service role.

Raw ad rows are stored in `facebook_ad_insights_daily`; account/day aggregates are stored in `facebook_ad_account_daily`. The `/meta` page reads these rows through the authenticated server endpoint `/api/meta-ads-leaderboard`; the service-role key never reaches the browser. The board separates currencies and ranks accounts by attributed purchase value, falling back to spend only when the selected currency has no purchase-value data. Meta Ads and Odoo employee sales remain separate until an employee-to-ad mapping is explicitly defined.

## Manual sync

Call `GET https://<your-domain>/api/meta-ads-sync` with `Authorization: Bearer <CRON_SECRET>`. For a one-off date range, provide both `date_from=YYYY-MM-DD` and `date_to=YYYY-MM-DD` (maximum 90 days). Do not put the authorization value in a URL, chat, or source control.

For local integration checks, `vite.config.ts` exposes the same protected endpoint at `http://127.0.0.1:3000/api/meta-ads-sync` while `npm run dev` is running. The local handler reads server variables from `.env`; it does not create an hourly schedule. Keep the Meta token and Supabase secret key server-side.
