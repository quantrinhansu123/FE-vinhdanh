-- Gộp: public.du_an (nếu chưa có) + marketing_staff + public.tkqc
-- Dùng khi DB chưa có du_an HOẶC chỉ thiếu tkqc — chạy một lần trong Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Dự án (FK cho tkqc)
-- ---------------------------------------------------------------------------
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

alter table public.du_an add column if not exists thi_truong text;
alter table public.du_an add column if not exists leader text;
alter table public.du_an add column if not exists doanh_thu_thang numeric(18, 2) default 0;
alter table public.du_an add column if not exists staff_ids jsonb not null default '[]'::jsonb;
update public.du_an set staff_ids = '[]'::jsonb where staff_ids is null;

alter table public.du_an add column if not exists so_mkt integer default 0;
update public.du_an set so_mkt = 0 where so_mkt is null;
alter table public.du_an alter column so_mkt set default 0;
alter table public.du_an alter column so_mkt set not null;

alter table public.du_an drop constraint if exists du_an_so_mkt_non_negative;
alter table public.du_an add constraint du_an_so_mkt_non_negative check (so_mkt >= 0);

alter table public.du_an drop constraint if exists du_an_trang_thai_check;
alter table public.du_an add constraint du_an_trang_thai_check
  check (trang_thai in ('dang_chay', 'tam_dung', 'ket_thuc', 'huy', 'review'));

update public.du_an
set doanh_thu_thang = coalesce(tong_doanh_so, 0)
where coalesce(doanh_thu_thang, 0) = 0
  and coalesce(tong_doanh_so, 0) > 0;

insert into public.du_an (ma_du_an, ten_du_an, don_vi, thi_truong, leader, so_mkt, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, doanh_thu_thang, ngay_bat_dau, trang_thai)
select 'DA-001', 'Bất Động Sản Luxury A', 'Alpha Media', 'Việt Nam', 'Trần Hoàng', 8, 450000000, 380500000, 1170769230, 1485000000, current_date - 60, 'dang_chay'
where not exists (select 1 from public.du_an where ma_du_an = 'DA-001');

insert into public.du_an (ma_du_an, ten_du_an, don_vi, thi_truong, leader, so_mkt, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, doanh_thu_thang, ngay_bat_dau, trang_thai)
select 'DA-002', 'Thời Trang Nữ Trendy', 'Beta Creative', 'Việt Nam', 'Nguyễn Lan', 3, 220000000, 215200000, 515000000, 580000000, current_date - 30, 'dang_chay'
where not exists (select 1 from public.du_an where ma_du_an = 'DA-002');

-- ---------------------------------------------------------------------------
-- 2) marketing_staff (FK tùy chọn từ tkqc)
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_staff (
  id uuid primary key default gen_random_uuid(),
  id_ns text not null unique,
  name text not null,
  email text not null unique,
  team text,
  branch text,
  role text default 'user',
  created_at timestamptz not null default now()
);

alter table public.marketing_staff enable row level security;

drop policy if exists "anon can read marketing staff" on public.marketing_staff;
create policy "anon can read marketing staff"
on public.marketing_staff for select to anon using (true);

drop policy if exists "anon can insert marketing staff" on public.marketing_staff;
drop policy if exists "anon can update marketing staff" on public.marketing_staff;
drop policy if exists "anon can delete marketing staff" on public.marketing_staff;

create policy "anon can insert marketing staff"
on public.marketing_staff for insert to anon with check (true);
create policy "anon can update marketing staff"
on public.marketing_staff for update to anon using (true) with check (true);
create policy "anon can delete marketing staff"
on public.marketing_staff for delete to anon using (true);

alter table public.marketing_staff add column if not exists employee_id uuid;
create unique index if not exists marketing_staff_employee_id_unique_idx
on public.marketing_staff (employee_id)
where employee_id is not null;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'employees')
     and not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'marketing_staff'
      and c.conname = 'marketing_staff_employee_id_fkey'
  ) then
    alter table public.marketing_staff
      add constraint marketing_staff_employee_id_fkey
      foreign key (employee_id) references public.employees (id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) tkqc (Module 4 — /crm-admin/ad-accounts)
-- ---------------------------------------------------------------------------
create table if not exists public.tkqc (
  id uuid primary key default gen_random_uuid(),
  id_du_an uuid not null references public.du_an (id) on delete cascade,
  ma_tkqc text not null,
  ten_tkqc text,
  ten_pae text,
  nen_tang text,
  ngan_sach_phan_bo numeric(18, 2) default 0,
  chi_phi_thuc_te numeric(18, 2) default 0,
  tong_doanh_so numeric(18, 2) default 0,
  ty_le_ads_doanh_so numeric(10, 4) generated always as (
    case
      when coalesce(tong_doanh_so, 0) > 0
        then (coalesce(chi_phi_thuc_te, 0) / tong_doanh_so) * 100
      else null
    end
  ) stored,
  id_marketing_staff uuid references public.marketing_staff (id) on delete set null,
  ngay_bat_dau date,
  id_crm_team uuid,
  trang_thai_tkqc text not null default 'active'
    constraint tkqc_trang_thai_tkqc_check check (trang_thai_tkqc in ('active', 'thieu_thiet_lap')),
  agency text,
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id_du_an, ma_tkqc)
);

-- tkqc cũ thiếu cột: CREATE IF NOT EXISTS không thêm cột mới
alter table public.tkqc add column if not exists ngay_bat_dau date;
alter table public.tkqc add column if not exists id_crm_team uuid;

alter table public.tkqc add column if not exists trang_thai_tkqc text default 'active';
update public.tkqc set trang_thai_tkqc = 'active' where trang_thai_tkqc is null;
alter table public.tkqc alter column trang_thai_tkqc set default 'active';
alter table public.tkqc alter column trang_thai_tkqc set not null;
alter table public.tkqc drop constraint if exists tkqc_trang_thai_tkqc_check;
alter table public.tkqc add constraint tkqc_trang_thai_tkqc_check
  check (trang_thai_tkqc in ('active', 'thieu_thiet_lap'));

alter table public.tkqc add column if not exists agency text;

create index if not exists tkqc_du_an_idx on public.tkqc (id_du_an);
create index if not exists tkqc_ma_tkqc_idx on public.tkqc (ma_tkqc);

create or replace function public.du_an_tkqc_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tkqc_set_updated_at on public.tkqc;
create trigger tkqc_set_updated_at
before update on public.tkqc
for each row execute procedure public.du_an_tkqc_set_updated_at();

alter table public.tkqc enable row level security;

drop policy if exists "anon can read tkqc" on public.tkqc;
drop policy if exists "anon can insert tkqc" on public.tkqc;
drop policy if exists "anon can update tkqc" on public.tkqc;
drop policy if exists "anon can delete tkqc" on public.tkqc;

create policy "anon can read tkqc" on public.tkqc for select to anon using (true);
create policy "anon can insert tkqc" on public.tkqc for insert to anon with check (true);
create policy "anon can update tkqc" on public.tkqc for update to anon using (true) with check (true);
create policy "anon can delete tkqc" on public.tkqc for delete to anon using (true);

-- FK team (khi đã có crm_teams)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'crm_teams'
  ) and not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'tkqc' and c.conname = 'tkqc_id_crm_team_fkey'
  ) then
    alter table public.tkqc
      add constraint tkqc_id_crm_team_fkey
      foreign key (id_crm_team) references public.crm_teams (id) on delete set null;
  end if;
end $$;

create index if not exists tkqc_crm_team_idx on public.tkqc (id_crm_team);

comment on column public.tkqc.ngay_bat_dau is 'Ngày bắt đầu vận hành TK';
comment on column public.tkqc.id_crm_team is 'Team phụ trách (crm_teams)';

-- Mẫu tkqc (sau khi đã có du_an DA-001 / DA-002)
insert into public.tkqc (id_du_an, ma_tkqc, ten_tkqc, ten_pae, nen_tang, ngan_sach_phan_bo, chi_phi_thuc_te, tong_doanh_so)
select d.id, 'FB-123456', 'TK Facebook — Luxury A', 'Page BĐS Luxury', 'Facebook', 200000000, 180000000, 550000000
from public.du_an d where d.ma_du_an = 'DA-001'
on conflict (id_du_an, ma_tkqc) do nothing;

insert into public.tkqc (id_du_an, ma_tkqc, ten_tkqc, ten_pae, nen_tang, ngan_sach_phan_bo, chi_phi_thuc_te, tong_doanh_so)
select d.id, 'GG-998877', 'Google Ads — Trendy', 'Shop Trendy Official', 'Google', 100000000, 95000000, 220000000
from public.du_an d where d.ma_du_an = 'DA-002'
on conflict (id_du_an, ma_tkqc) do nothing;
