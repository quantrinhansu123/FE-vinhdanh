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
4. Create `crm_teams` and `du_an` from their schema scripts, or run `supabase/create_du_an_tkqc.sql` if they do not exist yet.
5. For a fresh install, create the seeded admin email in Supabase Dashboard → Authentication → Users and set a strong password.
6. Run `supabase/migrations/20261022090000_heatmap_team_rls_and_auth_link.sql` after the four CRM base tables exist.
7. Restart the app with `npm run dev`.

Legacy CRM credentials are checked on the server during first login and then linked to Supabase Auth. The browser never reads or writes plaintext passwords. Existing legacy password values are cleared after a successful first login; admins can provision or reset an employee's Auth password from the staff form.

Environment variables used by the app:
- `VITE_SUPABASE_EMPLOYEES_TABLE` (default: `employees`)
- `VITE_SUPABASE_LEADERBOARD_VIEW` (default: `employee_leaderboard`)
- `VITE_SUPABASE_AVATARS_BUCKET` (default: `avatars`)
- `VITE_SUPABASE_REPORTS_TABLE` (default: `detail_reports`)
- `VITE_SUPABASE_MARKETING_STAFF_TABLE` (default: `marketing_staff`)
- `VITE_SUPABASE_SYSTEM_SETTINGS_TABLE` (default: `system_settings`)

## Automatic Meta + Odoo detail report sync

The production cron calls `/api/cron-marketing-sync` every 15 minutes. It refreshes today plus the previous three days by default, writes Meta first, then merges Odoo sales/data into the Odoo-specific columns. Both steps use an idempotent `(report_date, normalized employee code)` key and preserve the other source's columns. Revenue totals in the raw report also count one Odoo sales total per employee/day, so duplicate rows with code-case differences cannot inflate the VND total. The job is disabled on local and Vercel preview deployments by default.

To apply the required database schema automatically when a migration is pushed to `main`, add these GitHub Actions repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

The workflow previews pending SQL migrations, then runs `supabase db push`. Vercel still deploys the application separately. Add `CRON_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_IDS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the existing server-only `UPCARE_CRM_*` credentials to the Vercel Production environment. The CRM Auth bridge can use `VITE_SUPABASE_ANON_KEY` at runtime and `META_SYNC_SECRET` for signing when dedicated `SUPABASE_ANON_KEY` and `CRM_SESSION_SECRET` values are not set. Never commit these values or expose private values with a `VITE_` prefix.

The employee-code migration removes the one audited duplicate from October 17, then stops if other normalized employee/day duplicates remain. Review those rows before retrying the migration. The `npm run sync:mkt:backfill -- <from> <to> --apply` repair command backs up the selected rows, fetches Odoo separately for each date, and verifies the saved employee/day metrics before it succeeds.

## Heatmap Ads/DT access and calculations

The browser loads Heatmap data through the server-only `/api/heatmap` endpoint. The endpoint verifies the signed CRM session, reloads the employee's current profile, and scopes results before returning them. Admin/director accounts can view all teams; leaders can view teams they lead, with their assigned `employees.team` as a legacy fallback; project managers can view teams linked to projects where they are listed as leader or assigned staff. Marketing accounts cannot view the Heatmap.

For membership, `crm_teams.member_ids` is authoritative when populated. Teams without explicit member IDs use the normalized `employees.team` value as a legacy fallback. Maintain the team leader, member IDs, project leader/staff IDs, and linked project IDs in the CRM so the displayed membership matches the intended access.

The endpoint aggregates `detail_reports` by employee email and report date, uses `tien_viet` with `revenue` as a legacy fallback, and preserves the existing daily Odoo MKT and Odoo Sales revenue sources. Odoo results are joined by employee code only after restricting the employee set to the viewer's allowed teams. Cost and revenue are summed in VND before percentages are calculated, and requests are limited to seven days.

The migration `20261022090000_heatmap_team_rls_and_auth_link.sql` links employees to Supabase Auth, removes browser access to password columns, and applies role-scoped RLS to `employees`, `detail_reports`, `crm_teams`, and `du_an`. Existing CRM accounts are provisioned into Supabase Auth on first successful login; their legacy plaintext password is then cleared. Staff passwords are set through the admin-only server endpoint and are never read back into the browser. The browser leaderboard uses the safe `employee_leaderboard` view.
