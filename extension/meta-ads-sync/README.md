# FE-vinhdanh Meta Ads Sync

Chrome/Edge Manifest V3 extension. It reads campaign rows from the open Meta Ads Manager **Campaigns** table and sends them to the authenticated FE-vinhdanh server import route. It does not call Meta's Graph API and contains no Meta token or Supabase key.

## Data captured

- Ad account ID from `act=` in the Ads Manager URL and the visible account name when available.
- Campaign name and ID when exposed by the visible row; if Meta does not expose the ID, a stable key derived from the campaign name is used.
- Daily date, spend, impressions, reach and clicks when those columns are present.

The page must show one selected day or a **Day** time breakdown. The extension refuses to import a multi-day aggregate as daily data. It captures rows currently rendered in the table; scrolling/paging triggers additional upserts. Import is incremental and does not delete rows that are not visible.

## Install

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable **Developer mode**, choose **Load unpacked**, and select this folder.
3. Keep FE-vinhdanh open in the same browser at `https://fe-vinhdanh.vercel.app` and sign in to the Meta Ads import panel once so its admin session cookie is active.
4. Open an Ads Manager campaign table. The extension reads visible rows and sends them to `/api/meta-campaign-import`; any rows awaiting login stay in the extension's local queue until FE-vinhdanh is open and authorized.

## Database setup

Apply `supabase/migrations/20261125101619_meta_campaign_daily_insights.sql` in the FE-vinhdanh Supabase project before importing. The function grants write access only to `service_role`; the extension never receives database credentials.

## Limits

- Up to 31 days per import request and 2,500 rows per request.
- Meta's UI is virtualized; it imports rows currently rendered. Scroll through the table to capture additional rows.
- The Meta session can require a daily breakdown and visible metric columns. Missing optional metrics are saved as `null`.
- The extension works in Chrome/Edge; Orca's embedded browser may not support loading extensions.
