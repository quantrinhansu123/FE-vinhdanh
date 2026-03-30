-- Bổ sung cột cho form MKT báo cáo ngày (mkt-report) — chạy nếu bảng chưa có.
alter table public.detail_reports add column if not exists tong_data_nhan integer;
alter table public.detail_reports add column if not exists tong_lead integer;
