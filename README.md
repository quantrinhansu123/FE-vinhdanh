# Trang Vinh Danh Nhân Viên Xuất Sắc

Ứng dụng quản lý và hiển thị bảng xếp hạng nhân viên xuất sắc với dashboard báo cáo marketing.

## Run Locally

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
