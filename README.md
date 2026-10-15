# Trang Vinh Danh Nhân Viên Xuất Sắc

Ứng dụng quản lý và hiển thị bảng xếp hạng nhân viên xuất sắc với dashboard báo cáo marketing.

## Run Locally

Meta advertising data API and private Supabase sync: [setup and usage](docs/meta-ads.md).

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Supabase setup

If you see 404 on `rest/v1/employees` or upload errors for `avatars`, create the database table, storage bucket, and policies:

1. Open Supabase Dashboard -> SQL Editor.
2. Copy and run the SQL from `supabase/create_employees_table.sql`.
3. Copy and run the SQL from `supabase/create_marketing_reports_schema.sql`.
4. (Tùy chọn) Bảng dự án & tài khoản quảng cáo: chạy `supabase/create_du_an_tkqc.sql` — tạo `du_an` (ngân sách, chi phí, doanh số, % Ads/DS) và `tkqc` (mã TKQC, `ten_pae`, chỉ số theo dự án).
5. Restart the app with `npm run dev`.

Default seeded login:
- Email: `upedu2024@gmail.com`
- Password: `123456`

Login data is stored directly in `employees` via columns `email` and `pass`.

Environment variables used by the app:
- `VITE_SUPABASE_EMPLOYEES_TABLE` (default: `employees`)
- `VITE_SUPABASE_AVATARS_BUCKET` (default: `avatars`)
- `VITE_SUPABASE_REPORTS_TABLE` (default: `detail_reports`)
- `VITE_SUPABASE_MARKETING_STAFF_TABLE` (default: `marketing_staff`)
- `VITE_SUPABASE_SYSTEM_SETTINGS_TABLE` (default: `system_settings`)

## Automatic Meta + Odoo detail report sync

The production cron calls `/api/cron-marketing-sync` once per day at 01:15 Vietnam time. It refreshes the previous three complete days by default, writes Meta first, then merges Odoo sales/data into the Odoo-specific columns. Both steps use an idempotent `(report_date, code)` key and preserve the other source's columns. The job is disabled on local and Vercel preview deployments by default.

To apply the required database schema automatically when a migration is pushed to `main`, add these GitHub Actions repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

The workflow previews pending SQL migrations, then runs `supabase db push`. Vercel still deploys the application separately. Add `CRON_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_IDS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the existing server-only `UPCARE_CRM_*` credentials to the Vercel Production environment. Never commit these values or expose them with a `VITE_` prefix.

The migration intentionally stops if `detail_reports` already has duplicate non-empty `(report_date, code)` pairs; it will not merge or discard existing report rows automatically. Resolve those duplicates before the workflow can apply the unique key and enable safe upserts.
