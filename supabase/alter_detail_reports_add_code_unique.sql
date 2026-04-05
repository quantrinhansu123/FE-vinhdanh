-- Thêm cột code cho detail_reports và tạo unique theo (report_date, code)
alter table public.detail_reports add column if not exists code text;

create unique index if not exists detail_reports_report_date_code_uidx
  on public.detail_reports (report_date, code)
  where code is not null;

comment on column public.detail_reports.code is 'Mã nhân sự/biệt danh (đồng bộ từ Upcare); dùng cho upsert';

