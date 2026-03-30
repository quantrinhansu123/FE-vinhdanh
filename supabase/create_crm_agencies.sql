-- Module 5 — Agency (/crm-admin/agencies)
-- Bảng public.crm_agencies: mã, tên, liên hệ, telegram, loại TK, dự án (text), tổng nạp, công nợ, trạng thái

create extension if not exists pgcrypto;

create table if not exists public.crm_agencies (
  id uuid primary key default gen_random_uuid(),
  ma_agency text not null,
  ten_agency text not null,
  lien_he text,
  telegram text,
  tk_cung_cap text,
  du_an text,
  tong_da_nap numeric(18, 2) not null default 0 check (tong_da_nap >= 0),
  cong_no numeric(18, 2) not null default 0 check (cong_no >= 0),
  trang_thai text not null default 'active'
    check (trang_thai in ('active', 'theo_doi', 'tam_dung', 'ngung')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ma_agency)
);

create index if not exists crm_agencies_ten_idx on public.crm_agencies (ten_agency);
create index if not exists crm_agencies_trang_thai_idx on public.crm_agencies (trang_thai);

comment on table public.crm_agencies is 'Agency CRM Module 5';
comment on column public.crm_agencies.tk_cung_cap is 'Loại TK cung cấp (VD: FB VNĐ)';
comment on column public.crm_agencies.du_an is 'Dự án liên quan (text hiển thị, VD: BK, FB)';
comment on column public.crm_agencies.tong_da_nap is 'Tổng đã nạp (VND)';
comment on column public.crm_agencies.cong_no is 'Công nợ (VND)';
comment on column public.crm_agencies.trang_thai is 'active | theo_doi | tam_dung | ngung';

create or replace function public.crm_agencies_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_agencies_set_updated_at on public.crm_agencies;
create trigger crm_agencies_set_updated_at
before update on public.crm_agencies
for each row execute procedure public.crm_agencies_set_updated_at();

alter table public.crm_agencies enable row level security;

drop policy if exists "anon can read crm_agencies" on public.crm_agencies;
drop policy if exists "anon can insert crm_agencies" on public.crm_agencies;
drop policy if exists "anon can update crm_agencies" on public.crm_agencies;
drop policy if exists "anon can delete crm_agencies" on public.crm_agencies;

create policy "anon can read crm_agencies"
on public.crm_agencies for select to anon using (true);

create policy "anon can insert crm_agencies"
on public.crm_agencies for insert to anon with check (true);

create policy "anon can update crm_agencies"
on public.crm_agencies for update to anon using (true) with check (true);

create policy "anon can delete crm_agencies"
on public.crm_agencies for delete to anon using (true);

insert into public.crm_agencies (ma_agency, ten_agency, lien_he, telegram, tk_cung_cap, du_an, tong_da_nap, cong_no, trang_thai)
values
  ('AG-01', 'Media One', 'Nguyễn Hùng', '@mediaone_vn', 'FB VNĐ', 'BK, FB', 450000000, 0, 'active'),
  ('AG-02', 'AdsViet', 'Lê Thanh', '@adsviet', 'FB VNĐ', 'BK, MS', 280000000, 0, 'active'),
  ('AG-03', 'DigiMedia', 'Phạm Loan', '@digimedia', 'FB USD', 'YS', 190000000, 20000000, 'theo_doi')
on conflict (ma_agency) do nothing;
