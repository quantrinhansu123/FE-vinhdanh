-- Bảng dòng dữ liệu export QC (Meta/Excel) gắn dự án — CRM Admin → Dữ liệu QC Excel
-- Chạy trong Supabase SQL Editor sau create_du_an_table.sql

create extension if not exists pgcrypto;

create table if not exists public.du_an_qc_excel_rows (
  id uuid primary key default gen_random_uuid(),
  du_an_id uuid references public.du_an (id) on delete set null,
  ten_tai_khoan text,
  ten_quang_cao text,
  ngay date,
  don_vi_tien_te text,
  so_tien_chi_tieu_vnd numeric(18, 2),
  chi_phi_mua numeric(18, 6),
  cpm numeric(18, 6),
  ctr_tat_ca text,
  luot_tro_chuyen_tin_nhan numeric(18, 4),
  cpc numeric(18, 6),
  bao_cao_tu timestamptz,
  bao_cao_den timestamptz,
  source_file text,
  created_at timestamptz not null default now()
);

create index if not exists du_an_qc_excel_du_an_idx on public.du_an_qc_excel_rows (du_an_id);
create index if not exists du_an_qc_excel_ngay_idx on public.du_an_qc_excel_rows (ngay desc);
create index if not exists du_an_qc_excel_tk_idx on public.du_an_qc_excel_rows (ten_tai_khoan);

comment on table public.du_an_qc_excel_rows is 'Import Excel báo cáo QC (tài khoản, quảng cáo, chi phí, CPM, CTR…) theo mẫu export';
comment on column public.du_an_qc_excel_rows.chi_phi_mua is 'Chi phí trên mỗi lượt mua';
comment on column public.du_an_qc_excel_rows.ctr_tat_ca is 'CTR (Tất cả) — giữ text (vd 1,23%)';

alter table public.du_an_qc_excel_rows enable row level security;

drop policy if exists "anon read du_an_qc_excel" on public.du_an_qc_excel_rows;
drop policy if exists "anon insert du_an_qc_excel" on public.du_an_qc_excel_rows;
drop policy if exists "anon update du_an_qc_excel" on public.du_an_qc_excel_rows;
drop policy if exists "anon delete du_an_qc_excel" on public.du_an_qc_excel_rows;

create policy "anon read du_an_qc_excel" on public.du_an_qc_excel_rows for select to anon using (true);
create policy "anon insert du_an_qc_excel" on public.du_an_qc_excel_rows for insert to anon with check (true);
create policy "anon update du_an_qc_excel" on public.du_an_qc_excel_rows for update to anon using (true) with check (true);
create policy "anon delete du_an_qc_excel" on public.du_an_qc_excel_rows for delete to anon using (true);
