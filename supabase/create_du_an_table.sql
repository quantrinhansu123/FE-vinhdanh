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
  trang_thai text not null default 'dang_chay'
    check (trang_thai in ('dang_chay', 'tam_dung', 'ket_thuc', 'huy')),
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

insert into public.du_an (ma_du_an, ten_du_an, don_vi, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, ngay_bat_dau, trang_thai)
select 'DA-001', 'Bất Động Sản Luxury A', 'Alpha Media', 450000000, 380500000, 1170769230, current_date - 60, 'dang_chay'
where not exists (select 1 from public.du_an where ma_du_an = 'DA-001');

insert into public.du_an (ma_du_an, ten_du_an, don_vi, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, ngay_bat_dau, trang_thai)
select 'DA-002', 'Thời Trang Nữ Trendy', 'Beta Creative', 220000000, 215200000, 515000000, current_date - 30, 'dang_chay'
where not exists (select 1 from public.du_an where ma_du_an = 'DA-002');
