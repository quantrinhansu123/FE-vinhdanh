-- Bảng dự án (du_an): ngân sách & chỉ số chi phí / doanh số theo dự án
-- Bảng tài khoản quảng cáo (tkqc): mã TKQC, tên Page (ten_pae), chỉ số gắn dự án
-- Chạy trong Supabase SQL Editor sau create_marketing_reports_schema.sql (cần extension pgcrypto)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- du_an: 1 dòng = 1 dự án / chiến dịch
-- ---------------------------------------------------------------------------
create table if not exists public.du_an (
  id uuid primary key default gen_random_uuid(),
  ma_du_an text unique,
  ten_du_an text not null,
  don_vi text,
  mo_ta text,
  -- Chi phí & doanh (đơn vị VND; có thể cập nhật từ báo cáo hoặc nhập tay)
  ngan_sach_ke_hoach numeric(18, 2) default 0,
  chi_phi_marketing_thuc_te numeric(18, 2) default 0,
  tong_doanh_so numeric(18, 2) default 0,
  -- % chi phí ads / doanh số (0–100+); có thể lưu snapshot hoặc tính từ cột trên)
  ty_le_ads_doanh_so numeric(10, 4) generated always as (
    case
      when coalesce(tong_doanh_so, 0) > 0
        then (coalesce(chi_phi_marketing_thuc_te, 0) / tong_doanh_so) * 100
      else null
    end
  ) stored,
  ngay_bat_dau date,
  ngay_ket_thuc date,
  trang_thai text not null default 'dang_chay'
    check (trang_thai in ('dang_chay', 'tam_dung', 'ket_thuc', 'huy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists du_an_ten_idx on public.du_an (ten_du_an);
create index if not exists du_an_trang_thai_idx on public.du_an (trang_thai);

comment on table public.du_an is 'Dự án: ngân sách kế hoạch, chi phí marketing thực tế, doanh số, % Ads/DS';
comment on column public.du_an.ngan_sach_ke_hoach is 'Ngân sách kế hoạch (VND)';
comment on column public.du_an.chi_phi_marketing_thuc_te is 'Tổng chi phí marketing/ads thực tế (VND)';
comment on column public.du_an.tong_doanh_so is 'Tổng doanh số thực tế trong kỳ (VND)';
comment on column public.du_an.ty_le_ads_doanh_so is 'Chi phí ads / doanh số × 100 (generated)';

-- ---------------------------------------------------------------------------
-- tkqc: tài khoản quảng cáo thuộc 1 dự án; lưu ten_pae (tên Page) & chỉ số
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
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id_du_an, ma_tkqc)
);

create index if not exists tkqc_du_an_idx on public.tkqc (id_du_an);
create index if not exists tkqc_ma_tkqc_idx on public.tkqc (ma_tkqc);

comment on table public.tkqc is 'Tài khoản quảng cáo: mã TKQC, tên Page (ten_pae), chỉ số theo dự án';
comment on column public.tkqc.ten_pae is 'Tên Page (Facebook hoặc page đối tượng tương ứng)';
comment on column public.tkqc.ngan_sach_phan_bo is 'Ngân sách phân bổ cho TK này (VND)';
comment on column public.tkqc.chi_phi_thuc_te is 'Chi phí ads thực tế (VND)';
comment on column public.tkqc.tong_doanh_so is 'Doanh số ghi nhận cho TK (VND)';

-- Cập nhật updated_at (PostgreSQL 11+)
create or replace function public.du_an_tkqc_set_updated_at()
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
for each row execute procedure public.du_an_tkqc_set_updated_at();

drop trigger if exists tkqc_set_updated_at on public.tkqc;
create trigger tkqc_set_updated_at
before update on public.tkqc
for each row execute procedure public.du_an_tkqc_set_updated_at();

-- RLS (giống các bảng marketing khác: anon dev)
alter table public.du_an enable row level security;
alter table public.tkqc enable row level security;

drop policy if exists "anon can read du_an" on public.du_an;
drop policy if exists "anon can insert du_an" on public.du_an;
drop policy if exists "anon can update du_an" on public.du_an;
drop policy if exists "anon can delete du_an" on public.du_an;

create policy "anon can read du_an" on public.du_an for select to anon using (true);
create policy "anon can insert du_an" on public.du_an for insert to anon with check (true);
create policy "anon can update du_an" on public.du_an for update to anon using (true) with check (true);
create policy "anon can delete du_an" on public.du_an for delete to anon using (true);

drop policy if exists "anon can read tkqc" on public.tkqc;
drop policy if exists "anon can insert tkqc" on public.tkqc;
drop policy if exists "anon can update tkqc" on public.tkqc;
drop policy if exists "anon can delete tkqc" on public.tkqc;

create policy "anon can read tkqc" on public.tkqc for select to anon using (true);
create policy "anon can insert tkqc" on public.tkqc for insert to anon with check (true);
create policy "anon can update tkqc" on public.tkqc for update to anon using (true) with check (true);
create policy "anon can delete tkqc" on public.tkqc for delete to anon using (true);

-- Dữ liệu mẫu (tùy chọn)
insert into public.du_an (ma_du_an, ten_du_an, don_vi, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, ngay_bat_dau, trang_thai)
values
  ('DA-001', 'Bất Động Sản Luxury A', 'Alpha Media', 450000000, 380500000, 1170769230, current_date - 60, 'dang_chay'),
  ('DA-002', 'Thời Trang Nữ Trendy', 'Beta Creative', 220000000, 215200000, 515000000, current_date - 30, 'dang_chay')
on conflict (ma_du_an) do nothing;

insert into public.tkqc (id_du_an, ma_tkqc, ten_tkqc, ten_pae, nen_tang, ngan_sach_phan_bo, chi_phi_thuc_te, tong_doanh_so)
select d.id, 'FB-123456', 'TK Facebook — Luxury A', 'Page BĐS Luxury', 'Facebook', 200000000, 180000000, 550000000
from public.du_an d where d.ma_du_an = 'DA-001'
on conflict (id_du_an, ma_tkqc) do nothing;

insert into public.tkqc (id_du_an, ma_tkqc, ten_tkqc, ten_pae, nen_tang, ngan_sach_phan_bo, chi_phi_thuc_te, tong_doanh_so)
select d.id, 'GG-998877', 'Google Ads — Trendy', 'Shop Trendy Official', 'Google', 100000000, 95000000, 220000000
from public.du_an d where d.ma_du_an = 'DA-002'
on conflict (id_du_an, ma_tkqc) do nothing;
