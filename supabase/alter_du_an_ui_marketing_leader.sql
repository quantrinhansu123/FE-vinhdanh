-- Bổ sung cột khớp UI Module 1 (Quản lý Dự án): THỊ TRƯỜNG, LEADER, MKT, DT THÁNG + trạng thái review
-- Chạy trong Supabase SQL Editor khi bảng du_an đã tồn tại nhưng thiếu cột.
-- Hoặc chạy lại toàn bộ create_du_an_table.sql (đã có khối ALTER ngay trước INSERT).

alter table public.du_an add column if not exists thi_truong text;
alter table public.du_an add column if not exists leader text;
alter table public.du_an add column if not exists doanh_thu_thang numeric(18, 2) default 0;
alter table public.du_an add column if not exists staff_ids jsonb not null default '[]'::jsonb;
update public.du_an
set staff_ids = '[]'::jsonb
where staff_ids is null;

alter table public.du_an add column if not exists so_mkt integer default 0;
update public.du_an set so_mkt = 0 where so_mkt is null;
alter table public.du_an alter column so_mkt set default 0;
alter table public.du_an alter column so_mkt set not null;

alter table public.du_an drop constraint if exists du_an_so_mkt_non_negative;
alter table public.du_an add constraint du_an_so_mkt_non_negative check (so_mkt >= 0);

comment on column public.du_an.thi_truong is 'Thị trường / khu vực (UI: THỊ TRƯỜNG)';
comment on column public.du_an.leader is 'Tên leader dự án (UI: LEADER)';
comment on column public.du_an.so_mkt is 'Số lượng MKT gắn dự án (UI: MKT)';
comment on column public.du_an.doanh_thu_thang is 'Doanh thu tháng VND (UI: DT THÁNG)';

-- Một lần: đồng bộ DT tháng từ tổng doanh số cũ nếu chưa nhập
update public.du_an
set doanh_thu_thang = coalesce(tong_doanh_so, 0)
where coalesce(doanh_thu_thang, 0) = 0
  and coalesce(tong_doanh_so, 0) > 0;

alter table public.du_an drop constraint if exists du_an_trang_thai_check;
alter table public.du_an add constraint du_an_trang_thai_check
  check (trang_thai in ('dang_chay', 'tam_dung', 'ket_thuc', 'huy', 'review'));
