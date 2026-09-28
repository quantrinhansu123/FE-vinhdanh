-- Meta QC import table. Safe to rerun for creation or migration.
-- Independent of the project table; employee code is stored in ma_nv.

create extension if not exists pgcrypto;

create table if not exists public.du_an_qc_excel_rows (
  id uuid primary key default gen_random_uuid(),
  ma_nv text,
  ngay date,
  ten_chien_dich text,
  so_tien_da_chi_tieu_vnd numeric(18, 2),
  so_tro_chuyen_tin_nhan numeric(18, 4),
  source_file text,
  created_at timestamptz not null default now(),
  legacy_metrics jsonb not null default '{}'::jsonb
);

-- Migrate prior columns and retain old metrics in legacy_metrics.
alter table public.du_an_qc_excel_rows
  add column if not exists ma_nv text,
  add column if not exists ten_chien_dich text,
  add column if not exists so_tien_da_chi_tieu_vnd numeric(18, 2),
  add column if not exists so_tro_chuyen_tin_nhan numeric(18, 4),
  add column if not exists legacy_metrics jsonb not null default '{}'::jsonb;

drop index if exists public.du_an_qc_excel_tk_idx;
drop index if exists public.du_an_qc_excel_du_an_idx;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='du_an_qc_excel_rows' and column_name='ten_quang_cao') then
    execute 'update public.du_an_qc_excel_rows set ten_chien_dich = coalesce(ten_chien_dich, ten_quang_cao)';
    alter table public.du_an_qc_excel_rows drop column ten_quang_cao;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='du_an_qc_excel_rows' and column_name='so_tien_chi_tieu_vnd') then
    execute 'update public.du_an_qc_excel_rows set so_tien_da_chi_tieu_vnd = coalesce(so_tien_da_chi_tieu_vnd, so_tien_chi_tieu_vnd)';
    alter table public.du_an_qc_excel_rows drop column so_tien_chi_tieu_vnd;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='du_an_qc_excel_rows' and column_name='luot_tro_chuyen_tin_nhan') then
    execute 'update public.du_an_qc_excel_rows set so_tro_chuyen_tin_nhan = coalesce(so_tro_chuyen_tin_nhan, luot_tro_chuyen_tin_nhan)';
    alter table public.du_an_qc_excel_rows drop column luot_tro_chuyen_tin_nhan;
  end if;
end $$;

update public.du_an_qc_excel_rows
set ma_nv = substring(ten_chien_dich from '[[]([^]]+)[]]')
where coalesce(nullif(trim(ma_nv), ''), '') = ''
  and ten_chien_dich ~ '[[][^]]+[]]';

-- Remove imported aggregate/total rows; campaign detail rows remain.
delete from public.du_an_qc_excel_rows
where lower(btrim(ten_chien_dich)) in ('all', 'total', 'grand total');

do $$
declare
  old_column text;
  old_columns text[] := array[
    'du_an_id', 'ten_tai_khoan', 'don_vi_tien_te', 'chi_phi_mua', 'cpm',
    'ctr_tat_ca', 'cpc', 'bao_cao_tu', 'bao_cao_den'
  ];
begin
  foreach old_column in array old_columns loop
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='du_an_qc_excel_rows' and column_name=old_column
    ) then
      execute format(
        'update public.du_an_qc_excel_rows set legacy_metrics = legacy_metrics || jsonb_strip_nulls(jsonb_build_object(%L, %I)) where %I is not null',
        old_column, old_column, old_column
      );
      execute format('alter table public.du_an_qc_excel_rows drop column %I', old_column);
    end if;
  end loop;
end $$;

create index if not exists du_an_qc_excel_ngay_idx on public.du_an_qc_excel_rows (ngay desc);
create index if not exists du_an_qc_excel_ma_nv_idx on public.du_an_qc_excel_rows (ma_nv);
create index if not exists du_an_qc_excel_campaign_idx on public.du_an_qc_excel_rows (ten_chien_dich);

comment on table public.du_an_qc_excel_rows is 'Meta QC import: employee code, date, campaign, spend and conversations';

alter table public.du_an_qc_excel_rows enable row level security;

drop policy if exists "anon read du_an_qc_excel" on public.du_an_qc_excel_rows;
drop policy if exists "anon insert du_an_qc_excel" on public.du_an_qc_excel_rows;
drop policy if exists "anon update du_an_qc_excel" on public.du_an_qc_excel_rows;
drop policy if exists "anon delete du_an_qc_excel" on public.du_an_qc_excel_rows;

create policy "anon read du_an_qc_excel" on public.du_an_qc_excel_rows for select to anon using (true);
create policy "anon insert du_an_qc_excel" on public.du_an_qc_excel_rows for insert to anon with check (true);
create policy "anon update du_an_qc_excel" on public.du_an_qc_excel_rows for update to anon using (true) with check (true);
create policy "anon delete du_an_qc_excel" on public.du_an_qc_excel_rows for delete to anon using (true);
