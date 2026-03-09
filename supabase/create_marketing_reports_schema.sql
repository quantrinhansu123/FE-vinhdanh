-- Marketing reports schema
create extension if not exists pgcrypto;

drop function if exists public.authenticate_app_user(text, text);
drop table if exists public.app_users cascade;

create table if not exists public.marketing_staff (
  id uuid primary key default gen_random_uuid(),
  id_ns text not null unique,
  name text not null,
  email text not null unique,
  team text,
  branch text,
  role text default 'user',
  created_at timestamptz not null default now()
);

alter table public.marketing_staff enable row level security;

DROP POLICY IF EXISTS "anon can read marketing staff" ON public.marketing_staff;
create policy "anon can read marketing staff"
on public.marketing_staff
for select
to anon
using (true);

create table if not exists public.detail_reports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  report_date date not null,
  product text,
  market text,
  ad_account text,
  ad_cost numeric,
  mess_comment_count integer,
  order_count integer,
  revenue numeric,
  team text,
  created_at timestamptz not null default now()
);

alter table public.detail_reports drop column if exists shift;
alter table public.detail_reports drop column if exists staff_id;
alter table public.detail_reports drop column if exists branch;
alter table public.detail_reports drop column if exists outbound_revenue;
alter table public.detail_reports drop column if exists cancelled_order_count;
alter table public.detail_reports drop column if exists closed_revenue;
alter table public.detail_reports drop column if exists revenue_after_cancel;
alter table public.detail_reports drop column if exists revenue_after_shipping;
alter table public.detail_reports drop column if exists tc_revenue;
alter table public.detail_reports drop column if exists kpis;
alter table public.detail_reports drop column if exists ad_cost_by_account;
alter table public.detail_reports drop column if exists page_report;
alter table public.detail_reports drop column if exists status;
alter table public.detail_reports drop column if exists warning;

alter table public.detail_reports enable row level security;

DROP POLICY IF EXISTS "anon can read detail reports" ON public.detail_reports;
DROP POLICY IF EXISTS "anon can insert detail reports" ON public.detail_reports;
DROP POLICY IF EXISTS "anon can update detail reports" ON public.detail_reports;
DROP POLICY IF EXISTS "anon can delete detail reports" ON public.detail_reports;

create policy "anon can read detail reports"
on public.detail_reports
for select
to anon
using (true);

create policy "anon can insert detail reports"
on public.detail_reports
for insert
to anon
with check (true);

create policy "anon can update detail reports"
on public.detail_reports
for update
to anon
using (true)
with check (true);

create policy "anon can delete detail reports"
on public.detail_reports
for delete
to anon
using (true);

-- Optional staff seed for auto-fill in report form
insert into public.marketing_staff (id_ns, name, email, team, branch, role)
values
  ('MKT001', 'Nguyen Van A', 'a.marketing@example.com', 'MKT Alpha', 'HN', 'user'),
  ('MKT002', 'Tran Thi B', 'b.marketing@example.com', 'MKT Beta', 'HCM', 'manager')
on conflict (email) do update
set id_ns = excluded.id_ns,
    name = excluded.name,
    team = excluded.team,
    branch = excluded.branch,
    role = excluded.role;
