-- Báo cáo MKT: mã TKQC (Module 4, khớp tkqc.ma_tkqc) — có thể nhập tay nếu chưa FK.
alter table public.detail_reports add column if not exists ma_tkqc text;

comment on column public.detail_reports.ma_tkqc is 'Mã TKQC (tài khoản quảng cáo nội bộ)';
