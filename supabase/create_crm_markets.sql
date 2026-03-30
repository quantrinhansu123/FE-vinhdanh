-- Thị trường CRM — /crm-admin/markets
-- Dùng cho dropdown báo cáo MKT (detail_reports.market)

create extension if not exists pgcrypto;

create table if not exists public.crm_markets (
  id uuid primary key default gen_random_uuid(),
  ma_thi_truong text not null,
  ten_thi_truong text not null,
  mo_ta text,
  trang_thai text not null default 'hoat_dong'
    check (trang_thai in ('hoat_dong', 'tam_dung', 'ngung')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ma_thi_truong)
);

create index if not exists crm_markets_ten_idx on public.crm_markets (ten_thi_truong);
create index if not exists crm_markets_trang_thai_idx on public.crm_markets (trang_thai);

comment on table public.crm_markets is 'Danh mục thị trường (CRM Admin, form MKT report)';
comment on column public.crm_markets.trang_thai is 'hoat_dong | tam_dung | ngung';

create or replace function public.crm_markets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_markets_set_updated_at on public.crm_markets;
create trigger crm_markets_set_updated_at
before update on public.crm_markets
for each row execute procedure public.crm_markets_set_updated_at();

alter table public.crm_markets enable row level security;

drop policy if exists "anon can read crm_markets" on public.crm_markets;
drop policy if exists "anon can insert crm_markets" on public.crm_markets;
drop policy if exists "anon can update crm_markets" on public.crm_markets;
drop policy if exists "anon can delete crm_markets" on public.crm_markets;

create policy "anon can read crm_markets"
on public.crm_markets for select to anon using (true);

create policy "anon can insert crm_markets"
on public.crm_markets for insert to anon with check (true);

create policy "anon can update crm_markets"
on public.crm_markets for update to anon using (true) with check (true);

create policy "anon can delete crm_markets"
on public.crm_markets for delete to anon using (true);
