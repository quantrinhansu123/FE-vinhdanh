-- Sản phẩm CRM — /crm-admin/products
-- Chạy sau create_du_an_table.sql (FK id_du_an → public.du_an, có thể bỏ FK nếu chưa có du_an)

create extension if not exists pgcrypto;

create table if not exists public.crm_products (
  id uuid primary key default gen_random_uuid(),
  ma_san_pham text not null,
  ten_san_pham text not null,
  mo_ta text,
  danh_muc text,
  gia_ban numeric(18, 2) check (gia_ban is null or gia_ban >= 0),
  don_vi_tinh text not null default 'cái',
  id_du_an uuid references public.du_an (id) on delete set null,
  trang_thai text not null default 'dang_ban'
    check (trang_thai in ('dang_ban', 'tam_ngung', 'ngung')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ma_san_pham)
);

create index if not exists crm_products_ten_idx on public.crm_products (ten_san_pham);
create index if not exists crm_products_danh_muc_idx on public.crm_products (danh_muc);
create index if not exists crm_products_du_an_idx on public.crm_products (id_du_an);
create index if not exists crm_products_trang_thai_idx on public.crm_products (trang_thai);

comment on table public.crm_products is 'Danh mục sản phẩm / SKU (CRM Admin)';
comment on column public.crm_products.ma_san_pham is 'Mã nội bộ (SKU)';
comment on column public.crm_products.trang_thai is 'dang_ban | tam_ngung | ngung';

create or replace function public.crm_products_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_products_set_updated_at on public.crm_products;
create trigger crm_products_set_updated_at
before update on public.crm_products
for each row execute procedure public.crm_products_set_updated_at();

alter table public.crm_products enable row level security;

drop policy if exists "anon can read crm_products" on public.crm_products;
drop policy if exists "anon can insert crm_products" on public.crm_products;
drop policy if exists "anon can update crm_products" on public.crm_products;
drop policy if exists "anon can delete crm_products" on public.crm_products;

create policy "anon can read crm_products"
on public.crm_products for select to anon using (true);

create policy "anon can insert crm_products"
on public.crm_products for insert to anon with check (true);

create policy "anon can update crm_products"
on public.crm_products for update to anon using (true) with check (true);

create policy "anon can delete crm_products"
on public.crm_products for delete to anon using (true);
