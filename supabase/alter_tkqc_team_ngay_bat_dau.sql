-- Module 4 — TKQC: bổ sung cột thiếu (ngày bắt đầu, team, trạng thái Active/Thiếu thiết lập)
--
-- Lỗi: "column tkqc.ngay_bat_dau / id_crm_team / trang_thai_tkqc / agency does not exist"
--   → Chạy TOÀN BỘ file này một lần trong Supabase SQL Editor.
--
-- Điều kiện: public.tkqc đã tồn tại.

do $guard$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tkqc'
  ) then
    raise exception
      'public.tkqc chưa tồn tại. Chạy trước supabase/create_du_an_tkqc.sql hoặc create_tkqc_for_existing_du_an.sql.';
  end if;
end
$guard$;

alter table public.tkqc add column if not exists ngay_bat_dau date;
alter table public.tkqc add column if not exists id_crm_team uuid;

comment on column public.tkqc.ngay_bat_dau is 'Ngày bắt đầu vận hành TK (ưu tiên hiển thị trên UI)';
comment on column public.tkqc.id_crm_team is 'Team CRM phụ trách (public.crm_teams)';

create index if not exists tkqc_crm_team_idx on public.tkqc (id_crm_team);

-- FK tới crm_teams khi bảng đã có (chạy create_crm_teams.sql trước nếu cần)
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

-- Trạng thái hiển thị (Active / Thiếu thiết lập) — lỗi "trang_thai_tkqc does not exist"
alter table public.tkqc add column if not exists trang_thai_tkqc text default 'active';

update public.tkqc set trang_thai_tkqc = 'active' where trang_thai_tkqc is null;

alter table public.tkqc alter column trang_thai_tkqc set default 'active';

alter table public.tkqc alter column trang_thai_tkqc set not null;

alter table public.tkqc drop constraint if exists tkqc_trang_thai_tkqc_check;
alter table public.tkqc add constraint tkqc_trang_thai_tkqc_check
  check (trang_thai_tkqc in ('active', 'thieu_thiet_lap'));

comment on column public.tkqc.trang_thai_tkqc is 'UI: Active | Thiếu thiết lập (active | thieu_thiet_lap)';

-- Agency (cột AGENCY trên form TK) — lỗi "agency does not exist"
alter table public.tkqc add column if not exists agency text;
comment on column public.tkqc.agency is 'Agency / đơn vị QC — ưu tiên hiển thị hơn du_an.don_vi';
