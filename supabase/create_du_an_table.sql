-- Bảng dự án public.du_an — dùng cho CRM → Dự án → Danh sách dự án
-- Chạy trong Supabase SQL Editor (pgcrypto)

create extension if not exists pgcrypto;

create table if not exists public.du_an (
  id uuid primary key default gen_random_uuid(),
  ma_du_an text unique,
  ten_du_an text not null,
  don_vi text,
  mo_ta text,
  ngan_sach_ke_hoach numeric(18, 2) default 0,
  chi_phi_marketing_thuc_te numeric(18, 2) default 0,
  tong_doanh_so numeric(18, 2) default 0,
  ty_le_ads_doanh_so numeric(10, 4) generated always as (
    case
      when coalesce(tong_doanh_so, 0) > 0
        then (coalesce(chi_phi_marketing_thuc_te, 0) / tong_doanh_so) * 100
      else null
    end
  ) stored,
  ngay_bat_dau date,
  ngay_ket_thuc date,
  thi_truong text,
  leader text,
  so_mkt integer not null default 0 check (so_mkt >= 0),
  doanh_thu_thang numeric(18, 2) default 0,
  staff_ids jsonb not null default '[]'::jsonb,
  trang_thai text not null default 'dang_chay'
    check (trang_thai in ('dang_chay', 'tam_dung', 'ket_thuc', 'huy', 'review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists du_an_ten_idx on public.du_an (ten_du_an);
create index if not exists du_an_trang_thai_idx on public.du_an (trang_thai);

comment on table public.du_an is 'Dự án: ngân sách kế hoạch, chi phí marketing, doanh số, % Ads/DS';

create or replace function public.du_an_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists du_an_set_updated_at on public.du_an;
create trigger du_an_set_updated_at
before update on public.du_an
for each row execute procedure public.du_an_set_updated_at();

alter table public.du_an enable row level security;

drop policy if exists "anon can read du_an" on public.du_an;
drop policy if exists "anon can insert du_an" on public.du_an;
drop policy if exists "anon can update du_an" on public.du_an;
drop policy if exists "anon can delete du_an" on public.du_an;

create policy "anon can read du_an" on public.du_an for select to anon using (true);
create policy "anon can insert du_an" on public.du_an for insert to anon with check (true);
create policy "anon can update du_an" on public.du_an for update to anon using (true) with check (true);
create policy "anon can delete du_an" on public.du_an for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- Nếu bảng du_an đã có từ bản cũ: CREATE IF NOT EXISTS không thêm cột mới.
-- Chạy ALTER trước INSERT có thi_truong / leader / so_mkt / doanh_thu_thang.
-- ---------------------------------------------------------------------------
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

comment on column public.du_an.thi_truong is 'Thị trường / khu vực (UI: THỊ TRƯỜNG)';
comment on column public.du_an.leader is 'Tên leader dự án (UI: LEADER)';
comment on column public.du_an.so_mkt is 'Số lượng MKT gắn dự án (UI: MKT)';
comment on column public.du_an.doanh_thu_thang is 'Doanh thu tháng VND (UI: DT THÁNG)';

alter table public.du_an drop constraint if exists du_an_so_mkt_non_negative;
alter table public.du_an add constraint du_an_so_mkt_non_negative check (so_mkt >= 0);

alter table public.du_an drop constraint if exists du_an_trang_thai_check;
alter table public.du_an add constraint du_an_trang_thai_check
  check (trang_thai in ('dang_chay', 'tam_dung', 'ket_thuc', 'huy', 'review'));

update public.du_an
set doanh_thu_thang = coalesce(tong_doanh_so, 0)
where coalesce(doanh_thu_thang, 0) = 0
  and coalesce(tong_doanh_so, 0) > 0;

-- ---------------------------------------------------------------------------
-- Seed (chỉ chạy sau khi các cột trên đã tồn tại)
-- ---------------------------------------------------------------------------
insert into public.du_an (ma_du_an, ten_du_an, don_vi, thi_truong, leader, so_mkt, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, doanh_thu_thang, ngay_bat_dau, trang_thai)
select 'DA-001', 'Bất Động Sản Luxury A', 'Alpha Media', 'Việt Nam', 'Trần Hoàng', 8, 450000000, 380500000, 1170769230, 1485000000, current_date - 60, 'dang_chay'
where not exists (select 1 from public.du_an where ma_du_an = 'DA-001');

insert into public.du_an (ma_du_an, ten_du_an, don_vi, thi_truong, leader, so_mkt, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, doanh_thu_thang, ngay_bat_dau, trang_thai)
select 'DA-002', 'Thời Trang Nữ Trendy', 'Beta Creative', 'Việt Nam', 'Nguyễn Lan', 3, 220000000, 215200000, 515000000, 580000000, current_date - 30, 'dang_chay'
where not exists (select 1 from public.du_an where ma_du_an = 'DA-002');
