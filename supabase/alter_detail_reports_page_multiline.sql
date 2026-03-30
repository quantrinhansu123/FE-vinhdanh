-- Báo cáo MKT: nhiều dòng / ngày / email + cột page (Facebook Page / label)
-- Chạy trên Supabase SQL Editor nếu đã từng tạo unique 1 dòng/ngày.

-- Cho phép nhiều bản ghi cùng email + report_date
drop index if exists public.detail_reports_email_lower_report_date_uidx;

create index if not exists detail_reports_email_date_idx
  on public.detail_reports (lower(trim(email)), report_date desc);

alter table public.detail_reports add column if not exists page text;

comment on column public.detail_reports.page is 'Tên Page / fanpage (báo cáo MKT)';
