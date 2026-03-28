-- Bảng danh sách TKQC (CRM → Tài khoản Ads → Danh sách TKQC)
-- Cột: id, tkqc, page, don_vi, ngan_sach, tong_chi, doanh_so, so_mess, so_don
-- Chạy trong Supabase SQL Editor (cần extension pgcrypto nếu chưa có)

create extension if not exists pgcrypto;

create table if not exists public.tkqc_accounts (
  id uuid primary key default gen_random_uuid(),
  tkqc text not null,
  page text,
  don_vi text,
  ngan_sach numeric(18, 2) default 0,
  tong_chi numeric(18, 2) default 0,
  doanh_so numeric(18, 2) default 0,
  so_mess integer not null default 0 check (so_mess >= 0),
  so_don integer not null default 0 check (so_don >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tkqc_accounts_tkqc_idx on public.tkqc_accounts (tkqc);
create index if not exists tkqc_accounts_don_vi_idx on public.tkqc_accounts (don_vi);

comment on table public.tkqc_accounts is 'Danh sách tài khoản quảng cáo: mã TKQC, Page, đơn vị, ngân sách, chi, doanh số, tin nhắn, đơn';
comment on column public.tkqc_accounts.tkqc is 'Mã / tên tài khoản quảng cáo';
comment on column public.tkqc_accounts.page is 'Tên Page';
comment on column public.tkqc_accounts.don_vi is 'Đơn vị phụ trách';
comment on column public.tkqc_accounts.ngan_sach is 'Ngân sách (VND)';
comment on column public.tkqc_accounts.tong_chi is 'Tổng chi (VND)';
comment on column public.tkqc_accounts.doanh_so is 'Doanh số (VND)';
comment on column public.tkqc_accounts.so_mess is 'Số tin nhắn (mess)';
comment on column public.tkqc_accounts.so_don is 'Số đơn';

create or replace function public.tkqc_accounts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tkqc_accounts_set_updated_at on public.tkqc_accounts;
create trigger tkqc_accounts_set_updated_at
before update on public.tkqc_accounts
for each row execute procedure public.tkqc_accounts_set_updated_at();

alter table public.tkqc_accounts enable row level security;

drop policy if exists "anon can read tkqc_accounts" on public.tkqc_accounts;
drop policy if exists "anon can insert tkqc_accounts" on public.tkqc_accounts;
drop policy if exists "anon can update tkqc_accounts" on public.tkqc_accounts;
drop policy if exists "anon can delete tkqc_accounts" on public.tkqc_accounts;

create policy "anon can read tkqc_accounts" on public.tkqc_accounts for select to anon using (true);
create policy "anon can insert tkqc_accounts" on public.tkqc_accounts for insert to anon with check (true);
create policy "anon can update tkqc_accounts" on public.tkqc_accounts for update to anon using (true) with check (true);
create policy "anon can delete tkqc_accounts" on public.tkqc_accounts for delete to anon using (true);

-- Dữ liệu mẫu (chỉ thêm nếu chưa có dòng)
insert into public.tkqc_accounts (tkqc, page, don_vi, ngan_sach, tong_chi, doanh_so, so_mess, so_don)
select 'FB-123456', 'Page BĐS Luxury', 'Alpha Media', 200000000, 180000000, 550000000, 42, 18
where not exists (select 1 from public.tkqc_accounts where tkqc = 'FB-123456');

insert into public.tkqc_accounts (tkqc, page, don_vi, ngan_sach, tong_chi, doanh_so, so_mess, so_don)
select 'GG-998877', 'Shop Trendy Official', 'Beta Creative', 100000000, 95000000, 220000000, 120, 45
where not exists (select 1 from public.tkqc_accounts where tkqc = 'GG-998877');
