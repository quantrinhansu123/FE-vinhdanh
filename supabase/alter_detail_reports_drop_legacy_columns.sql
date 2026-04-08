-- Gỡ các cột legacy không còn dùng trên public.detail_reports.
-- Chạy trong Supabase SQL Editor (idempotent — chạy lại không lỗi).

alter table public.detail_reports drop column if exists shift;
alter table public.detail_reports drop column if exists staff_id;
alter table public.detail_reports drop column if exists branch;
alter table public.detail_reports drop column if exists outbound_revenue;
alter table public.detail_reports drop column if exists cancelled_order_count;
alter table public.detail_reports drop column if exists closed_revenue;
alter table public.detail_reports drop column if exists revenue_after_cancel;
alter table public.detail_reports drop column if exists revenue_after_shipping;
alter table public.detail_reports drop column if exists tc_revenue;
alter table public.detail_reports drop column if exists kpis;
alter table public.detail_reports drop column if exists ad_cost_by_account;
alter table public.detail_reports drop column if exists page_report;
alter table public.detail_reports drop column if exists status;
alter table public.detail_reports drop column if exists warning;
