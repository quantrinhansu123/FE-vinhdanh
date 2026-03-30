-- Add Lead / Đơn chốt KPI targets to existing monthly KPI tables
-- Chạy sau khi đã chạy supabase/create_kpi_monthly_targets.sql

alter table public.kpi_team_monthly_targets
  add column if not exists muc_tieu_lead_team numeric(18, 2) not null default 0
    check (muc_tieu_lead_team >= 0);

alter table public.kpi_team_monthly_targets
  add column if not exists muc_tieu_don_chot_team numeric(18, 2) not null default 0
    check (muc_tieu_don_chot_team >= 0);

alter table public.kpi_staff_monthly_targets
  add column if not exists muc_tieu_lead numeric(18, 2) not null default 0
    check (muc_tieu_lead >= 0);

alter table public.kpi_staff_monthly_targets
  add column if not exists muc_tieu_don_chot numeric(18, 2) not null default 0
    check (muc_tieu_don_chot >= 0);

comment on column public.kpi_team_monthly_targets.muc_tieu_lead_team is 'Mục tiêu Lead tháng theo team';
comment on column public.kpi_team_monthly_targets.muc_tieu_don_chot_team is 'Mục tiêu Đơn chốt tháng theo team';
comment on column public.kpi_staff_monthly_targets.muc_tieu_lead is 'Mục tiêu Lead tháng theo nhân sự';
comment on column public.kpi_staff_monthly_targets.muc_tieu_don_chot is 'Mục tiêu Đơn chốt tháng theo nhân sự';

