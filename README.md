<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6533b311-e2e8-488f-9e16-c8e41b4583a2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Supabase setup

If you see 404 on `rest/v1/employees` or upload errors for `avatars`, create the database table, storage bucket, and policies:

1. Open Supabase Dashboard -> SQL Editor.
2. Copy and run the SQL from `supabase/create_employees_table.sql`.
3. Copy and run the SQL from `supabase/create_marketing_reports_schema.sql`.
3. Restart the app with `npm run dev`.

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
