-- Mã dự án: logic đầy đủ trên UI reports-raw (ưu tiên khối [CODE.tên] trong chuỗi). Cột + comment schema tại đây.
alter table public.detail_reports add column if not exists ma_du_an text;

comment on column public.detail_reports.ma_du_an is 'Mã dự án — ưu tiên [CODE.tên] trong page (vd Chạy thiếu[FBC.x]… → FBC); không có thì bỏ [ ] hai đầu chuỗi rồi phần trước . đầu tiên';

-- Backfill đơn giản (không khớp chuỗi có text trước [FBC.x] — nên dùng nút reports-raw):
-- update public.detail_reports dr
-- set ma_du_an = case
--   when dr.page is null or trim(dr.page) = '' then null
--   else nullif(
--     trim(split_part(trim(both '[]' from trim(dr.page)), '.', 1)),
--     ''
--   )
-- end;
