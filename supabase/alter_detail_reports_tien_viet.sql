-- Thêm cột tien_viet còn thiếu trên public.detail_reports
-- Chạy khi gặp lỗi: column detail_reports.tien_viet does not exist
-- (code FE truy vấn tien_viet nhưng schema gốc create_marketing_reports_schema.sql chưa tạo cột này)

alter table public.detail_reports add column if not exists tien_viet numeric;

comment on column public.detail_reports.tien_viet is 'Doanh thu quy đổi VND (ví dụ revenue USD * 25,000)';

-- Backfill: điền VND từ revenue cho các dòng đang NULL (an toàn, chạy lại được)
update public.detail_reports
set tien_viet = round(coalesce(revenue, 0) * 25000)
where tien_viet is null
  and revenue is not null;

create index if not exists detail_reports_tien_viet_idx
  on public.detail_reports (tien_viet);
