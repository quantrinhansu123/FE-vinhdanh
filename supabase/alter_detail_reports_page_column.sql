-- Chỉ thêm cột page (fanpage) — chạy khi lỗi: column detail_reports.page does not exist
-- Nếu cần nhiều dòng/ngày/email, chạy thêm alter_detail_reports_page_multiline.sql (bỏ unique).

alter table public.detail_reports add column if not exists page text;

comment on column public.detail_reports.page is 'Tên Page / fanpage (báo cáo MKT)';
