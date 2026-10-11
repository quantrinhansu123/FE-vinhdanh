# Meta Marketing API

Server implementation: `server/metaClient.ts`, `server/metaSync.ts`, and
`api/meta-ads.ts`. The same endpoint runs in Vite development and on Vercel.
No additional npm dependency is required.

## QC Excel button

The **Lấy từ API Meta** button in **Dữ liệu QC Excel** imports campaign/day
spend and messaging conversations into the existing QC table. It applies the
date inputs currently shown on the page. Run `supabase/create_meta_qc_import.sql`
after the existing `create_du_an_qc_excel.sql` migration to enable atomic imports.
No direct browser access to the private `meta_ads_insights` table is required.

The import dialog verifies an Admin CRM account against `employees` on the
server and uses a signed, HttpOnly cookie valid for one hour. The existing
super-admin email and Admin/director positions accepted by CRM navigation are
supported. The server rechecks the account's current role on each request.
Meta tokens, the API secret and Supabase service credentials stay on the server.

Choose one account or all configured accounts. Imports run one account at a
time and report failures per account. A successful import replaces only that
account's Meta-generated QC rows in the requested range (source marker
`meta-api:<account_id>`). Identical rows already imported manually from Excel
are skipped. Other manual rows stay in place; different revisions imported
from Excel cannot be identified as the same account automatically.

Only VND accounts are imported into the VND fields. The employee code is taken
from the first `[Mã NV]` in the campaign name. Missing codes are reported and
remain blank for review. Messaging counts use the single action type
`onsite_conversion.messaging_conversation_started_7d`. Daily data remains in
the ad account's timezone. Use the existing **Đồng bộ QC vào chi tiết MKT**
action after reviewing the imported rows.

## Setup

1. Add the Meta settings from `.env.example` to the ignored `.env.local` file
   for local use, or to the server environment on Vercel. Use a fresh Meta token
   with `ads_read` permission and access to the configured ad accounts.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server.
   The existing public `VITE_SUPABASE_URL` is accepted as a URL fallback.
   Secrets must never use the `VITE_` prefix.
3. Run `supabase/create_meta_ads_insights.sql` in the Supabase SQL Editor.
   It creates a private `meta_ads_insights` table and a transaction function
   accessible only to `service_role`.
4. Generate a separate API authorization secret using
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
   and set it as `META_SYNC_SECRET`. Keep it on the calling server too.
5. Restart `npm run dev` or redeploy after setting environment variables.

The provided 19 account IDs and `v26.0` are in `.env.example`. Meta must support
that configured version for the token/app. The implementation does not silently
downgrade the API version.

## Read and sync

Run on a trusted machine/server from the project root:

```sh
# Read live data without writing to Supabase (all configured accounts).
npm run meta:sync -- --read-only

# Save the last 7 calendar days, including today, for all configured accounts.
npm run meta:sync

# Fetch/save one account for a specific inclusive range (maximum 31 days).
npm run meta:sync -- --account 719932067032734 --since 2026-10-01 --until 2026-10-07
```

The CLI loads `.env.local`, then `.env`, without overriding existing process
variables. Each account returns a JSON result; failures return a sanitized error
and set a nonzero process exit code while allowing the other accounts to finish.
The CLI can be scheduled on a server after its environment has been configured.
No automatic schedule is installed.

For server-to-server HTTP calls, send `Authorization: Bearer <META_SYNC_SECRET>`:

| Method | URL | Result |
| --- | --- | --- |
| GET | `/api/meta-ads?account_id=719932067032734` | Live daily ad insights; no writes |
| POST | `/api/meta-ads?account_id=719932067032734` | Fetch and save daily ad insights |

Both methods accept `since=YYYY-MM-DD&until=YYYY-MM-DD` in the query string.
No request body is required. Each HTTP request handles one allowlisted account;
this keeps work bounded by the serverless runtime. Use the CLI for all accounts
or large reports. HTTP work has a 55-second deadline; if it fails, reduce the
date range. A failed account fetch does not persist partial pages.

GET returns `{ account_id, account_timezone, range, fetched_at, data }`.
POST returns `{ account_id, account_timezone, range, fetched_at, rows_saved }`.
Errors return `{ error, message? }`. No Meta token, service key, raw upstream
error, or pagination URL is included in responses. Both methods require the
separate server secret; do not put that secret into frontend code.

## Data interpretation

Insights are requested at `level=ad`, `time_increment=1`, with campaign/ad-set/ad
IDs and names, spend, impressions, clicks, reach, CPC, CPM, CTR, actions and
action values. Decimal metrics stay as strings in HTTP JSON to preserve source
precision; Supabase stores numeric metrics as numeric/bigint.

`META_REPORTING_TIMEZONE` selects the default date range. The daily Meta buckets
remain in each advertising account's timezone, saved as `account_timezone`;
they are not converted to Vietnam time. Amounts retain `account_currency`;
do not sum different currencies as VND. Reach is a daily estimate and should
not be summed as unique reach across ads/dates. Attribution uses each ad set's
unified attribution setting and reports actions by impression date.

Actions remain separated by `action_type`; overlapping purchase/lead action
types are not automatically added together. The new table is not automatically
merged into manual CRM reports or existing dashboard totals.

A successful save atomically replaces only that account's requested date slice,
including removal of stale rows when Meta returns an empty report. The key is
`(account_id, ad_id, date_start)`, so repeating a sync does not duplicate rows.
All pages must complete before saving. Pagination limits, repeated cursors,
invalid data, or upstream errors prevent replacement.

Reference: [Meta Business SDK AdAccount insights parameters](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py)
and [AdsInsights fields](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py).
