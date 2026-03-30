-- KPI doanh thu theo tháng — Leader /crm-admin/kpi-target
-- Chạy sau create_employees_table.sql (FK employee_id → public.employees)

create extension if not exists pgcrypto;

-- Mục tiêu tổng theo team (chuỗi team khớp employees.team)
create table if not exists public.kpi_team_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  nam_thang text not null
    check (nam_thang ~ '^\d{4}-\d{2}$'),
  team_key text not null,
  muc_tieu_doanh_thu_team numeric(18, 2) not null default 0
    check (muc_tieu_doanh_thu_team >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nam_thang, team_key)
);

create index if not exists kpi_team_monthly_targets_thang_idx
  on public.kpi_team_monthly_targets (nam_thang desc);

comment on table public.kpi_team_monthly_targets is 'Mục tiêu doanh thu tháng theo team (employees.team)';
comment on column public.kpi_team_monthly_targets.nam_thang is 'Định dạng YYYY-MM';
comment on column public.kpi_team_monthly_targets.team_key is 'Giá trị employees.team';

-- Mục tiêu cá nhân theo tháng
create table if not exists public.kpi_staff_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  nam_thang text not null
    check (nam_thang ~ '^\d{4}-\d{2}$'),
  employee_id uuid not null references public.employees (id) on delete cascade,
  muc_tieu_vnd numeric(18, 2) not null default 0
    check (muc_tieu_vnd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nam_thang, employee_id)
);

create index if not exists kpi_staff_monthly_targets_thang_idx
  on public.kpi_staff_monthly_targets (nam_thang desc);
create index if not exists kpi_staff_monthly_targets_emp_idx
  on public.kpi_staff_monthly_targets (employee_id);

comment on table public.kpi_staff_monthly_targets is 'Mục tiêu doanh thu tháng theo nhân sự';

-- updated_at
create or replace function public.kpi_targets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kpi_team_monthly_targets_updated on public.kpi_team_monthly_targets;
create trigger kpi_team_monthly_targets_updated
before update on public.kpi_team_monthly_targets
for each row execute procedure public.kpi_targets_set_updated_at();

drop trigger if exists kpi_staff_monthly_targets_updated on public.kpi_staff_monthly_targets;
create trigger kpi_staff_monthly_targets_updated
before update on public.kpi_staff_monthly_targets
for each row execute procedure public.kpi_targets_set_updated_at();

-- RLS (cùng pattern anon như budget_requests / employees)
alter table public.kpi_team_monthly_targets enable row level security;
alter table public.kpi_staff_monthly_targets enable row level security;

drop policy if exists "anon read kpi_team_monthly" on public.kpi_team_monthly_targets;
drop policy if exists "anon insert kpi_team_monthly" on public.kpi_team_monthly_targets;
drop policy if exists "anon update kpi_team_monthly" on public.kpi_team_monthly_targets;
drop policy if exists "anon delete kpi_team_monthly" on public.kpi_team_monthly_targets;

create policy "anon read kpi_team_monthly" on public.kpi_team_monthly_targets for select to anon using (true);
create policy "anon insert kpi_team_monthly" on public.kpi_team_monthly_targets for insert to anon with check (true);
create policy "anon update kpi_team_monthly" on public.kpi_team_monthly_targets for update to anon using (true) with check (true);
create policy "anon delete kpi_team_monthly" on public.kpi_team_monthly_targets for delete to anon using (true);

drop policy if exists "anon read kpi_staff_monthly" on public.kpi_staff_monthly_targets;
drop policy if exists "anon insert kpi_staff_monthly" on public.kpi_staff_monthly_targets;
drop policy if exists "anon update kpi_staff_monthly" on public.kpi_staff_monthly_targets;
drop policy if exists "anon delete kpi_staff_monthly" on public.kpi_staff_monthly_targets;

create policy "anon read kpi_staff_monthly" on public.kpi_staff_monthly_targets for select to anon using (true);
create policy "anon insert kpi_staff_monthly" on public.kpi_staff_monthly_targets for insert to anon with check (true);
create policy "anon update kpi_staff_monthly" on public.kpi_staff_monthly_targets for update to anon using (true) with check (true);
create policy "anon delete kpi_staff_monthly" on public.kpi_staff_monthly_targets for delete to anon using (true);
