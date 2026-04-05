-- Phân quyền CRM (/crm-admin/*) — vai trò, màn hình (view_id), gán theo nhân sự
--
-- Ghi chú FE: menu tab CRM chủ yếu theo cột employees.vi_tri (xem src/utils/crmNavAccess.ts):
--   Admin (vi_tri) → đủ tab Admin + Leader + MKT; Leader → Leader + MKT; MKT → chỉ MKT.
-- Bảng dưới dùng khi muốn gán vai trò CRM theo id nhân sự (tùy chọn, song song với vi_tri).
--
-- Phụ thuộc: public.employees (create_employees_table.sql)
-- Chạy trong Supabase → SQL Editor.
--
-- Cách dùng:
--   1) Seed tạo 3 vai trò + danh sách view mặc định (đồng bộ src/utils/crmAdminRoutes.ts).
--   2) Gán vai trò cho user: insert vào crm_user_roles (employee_id = id từ employees).
--   3) Ứng dụng: đọc crm_user_roles → join crm_role_views → union view_id để kiểm tra URL.

create extension if not exists pgcrypto;

-- Vai trò CRM (khớp Role trong FE: admin | leader | mkt)
create table if not exists public.crm_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code in ('admin', 'leader', 'mkt')),
  name_vi text not null,
  description text,
  sort_order integer not null default 0
);

comment on table public.crm_roles is 'Vai trò CRM — gán cho nhân sự qua crm_user_roles';

-- Màn hình được phép theo từng vai trò (view_id khớp path /crm-admin/:view_id)
create table if not exists public.crm_role_views (
  role_id uuid not null references public.crm_roles (id) on delete cascade,
  view_id text not null,
  primary key (role_id, view_id)
);

create index if not exists crm_role_views_view_id_idx on public.crm_role_views (view_id);

comment on table public.crm_role_views is 'Danh sách view_id mặc định cho mỗi vai trò';

-- Một nhân sự có thể có nhiều vai trò; quyền màn hình = hợp (union) các view của các vai trò đó
create table if not exists public.crm_user_roles (
  employee_id uuid not null references public.employees (id) on delete cascade,
  role_id uuid not null references public.crm_roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  note text,
  primary key (employee_id, role_id)
);

create index if not exists crm_user_roles_employee_idx on public.crm_user_roles (employee_id);
create index if not exists crm_user_roles_role_idx on public.crm_user_roles (role_id);

comment on table public.crm_user_roles is 'Gán vai trò CRM cho nhân sự (employees.id)';

-- (Tùy chọn) Ghi đè từng màn: allowed = true bổ sung, false = cấm dù vai trò có
create table if not exists public.crm_user_view_overrides (
  employee_id uuid not null references public.employees (id) on delete cascade,
  view_id text not null,
  allowed boolean not null,
  updated_at timestamptz not null default now(),
  primary key (employee_id, view_id)
);

create index if not exists crm_user_view_overrides_employee_idx on public.crm_user_view_overrides (employee_id);

comment on table public.crm_user_view_overrides is 'Cho phép / chặn từng view_id cho một nhân sự (áp sau union vai trò)';

-- RLS — cùng pattern các bảng CRM hiện tại (anon); production nên thu hẹp theo auth thật
alter table public.crm_roles enable row level security;
alter table public.crm_role_views enable row level security;
alter table public.crm_user_roles enable row level security;
alter table public.crm_user_view_overrides enable row level security;

drop policy if exists "anon read crm_roles" on public.crm_roles;
drop policy if exists "anon insert crm_roles" on public.crm_roles;
drop policy if exists "anon update crm_roles" on public.crm_roles;
drop policy if exists "anon delete crm_roles" on public.crm_roles;

create policy "anon read crm_roles" on public.crm_roles for select to anon using (true);
create policy "anon insert crm_roles" on public.crm_roles for insert to anon with check (true);
create policy "anon update crm_roles" on public.crm_roles for update to anon using (true) with check (true);
create policy "anon delete crm_roles" on public.crm_roles for delete to anon using (true);

drop policy if exists "anon read crm_role_views" on public.crm_role_views;
drop policy if exists "anon insert crm_role_views" on public.crm_role_views;
drop policy if exists "anon update crm_role_views" on public.crm_role_views;
drop policy if exists "anon delete crm_role_views" on public.crm_role_views;

create policy "anon read crm_role_views" on public.crm_role_views for select to anon using (true);
create policy "anon insert crm_role_views" on public.crm_role_views for insert to anon with check (true);
create policy "anon update crm_role_views" on public.crm_role_views for update to anon using (true) with check (true);
create policy "anon delete crm_role_views" on public.crm_role_views for delete to anon using (true);

drop policy if exists "anon read crm_user_roles" on public.crm_user_roles;
drop policy if exists "anon insert crm_user_roles" on public.crm_user_roles;
drop policy if exists "anon update crm_user_roles" on public.crm_user_roles;
drop policy if exists "anon delete crm_user_roles" on public.crm_user_roles;

create policy "anon read crm_user_roles" on public.crm_user_roles for select to anon using (true);
create policy "anon insert crm_user_roles" on public.crm_user_roles for insert to anon with check (true);
create policy "anon update crm_user_roles" on public.crm_user_roles for update to anon using (true) with check (true);
create policy "anon delete crm_user_roles" on public.crm_user_roles for delete to anon using (true);

drop policy if exists "anon read crm_user_view_overrides" on public.crm_user_view_overrides;
drop policy if exists "anon insert crm_user_view_overrides" on public.crm_user_view_overrides;
drop policy if exists "anon update crm_user_view_overrides" on public.crm_user_view_overrides;
drop policy if exists "anon delete crm_user_view_overrides" on public.crm_user_view_overrides;

create policy "anon read crm_user_view_overrides" on public.crm_user_view_overrides for select to anon using (true);
create policy "anon insert crm_user_view_overrides" on public.crm_user_view_overrides for insert to anon with check (true);
create policy "anon update crm_user_view_overrides" on public.crm_user_view_overrides for update to anon using (true) with check (true);
create policy "anon delete crm_user_view_overrides" on public.crm_user_view_overrides for delete to anon using (true);

-- Seed vai trò (idempotent)
insert into public.crm_roles (code, name_vi, description, sort_order)
values
  ('admin', 'Quản trị', 'Toàn bộ module Admin CRM', 1),
  ('leader', 'Leader', 'Báo cáo & điều phối team / dự án', 2),
  ('mkt', 'Marketing', 'Báo cáo & tài khoản MKT', 3)
on conflict (code) do update
set
  name_vi = excluded.name_vi,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- Gán view mặc định — đồng bộ ADMIN_VIEWS / LEADER_VIEWS / MKT_VIEWS (crmAdminRoutes.ts)
insert into public.crm_role_views (role_id, view_id)
select r.id, m.view_id
from (
  values
    ('admin'::text, 'admin-dash'::text),
    ('admin', 'burn-detect'),
    ('admin', 'alerts'),
    ('admin', 'projects'),
    ('admin', 'project-qc-excel'),
    ('admin', 'teams'),
    ('admin', 'staff'),
    ('admin', 'ad-accounts'),
    ('admin', 'agencies'),
    ('admin', 'products'),
    ('admin', 'markets'),
    ('admin', 'budget'),
    ('admin', 'reconcile'),
    ('admin', 'upcare-mkt'),
    ('admin', 'admin-ranking'),
    ('admin', 'compare'),
    ('leader', 'leader-dash'),
    ('leader', 'leader-rank'),
    ('leader', 'heatmap'),
    ('leader', 'leader-mkt'),
    ('leader', 'leader-tkqc'),
    ('leader', 'leader-budget'),
    ('leader', 'kpi-target'),
    ('mkt', 'mkt-dash'),
    ('mkt', 'mkt-report'),
    ('mkt', 'mkt-bill'),
    ('mkt', 'mkt-history'),
    ('mkt', 'mkt-accounts')
) as m(role_code, view_id)
inner join public.crm_roles r on r.code = m.role_code
on conflict (role_id, view_id) do nothing;

-- Ví dụ: gán Leader cho một nhân sự (đổi email / bỏ comment khi dùng)
-- insert into public.crm_user_roles (employee_id, role_id, note)
-- select e.id, r.id, 'seed leader'
-- from public.employees e
-- cross join public.crm_roles r
-- where lower(trim(e.email)) = lower('user@example.com') and r.code = 'leader'
-- on conflict (employee_id, role_id) do nothing;
