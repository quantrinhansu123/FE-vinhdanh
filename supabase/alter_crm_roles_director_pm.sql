-- Phân cấp 4 tầng: Giám đốc / Quản lý dự án / Leader / Nhân viên
-- Chạy trong Supabase → SQL Editor, sau supabase/create_crm_access_control.sql
--
-- Đồng bộ FE:
--   src/types/index.ts (UserRole) + src/utils/crmNavAccess.ts (5 tier)
--   + src/utils/roleScope.ts (canViewAllProjects/canEditProjects)

-- 1) Mở rộng CHECK code vai trò
alter table public.crm_roles drop constraint if exists crm_roles_code_check;
alter table public.crm_roles
  add constraint crm_roles_code_check
  check (code in ('admin', 'director', 'project_manager', 'leader', 'mkt'));

-- 2) Seed 2 vai trò mới (idempotent)
insert into public.crm_roles (code, name_vi, description, sort_order)
values
  ('admin', 'Quản trị', 'Toàn bộ module Admin CRM', 1),
  ('director', 'Giám đốc', 'Xem tất cả dự án + số liệu toàn hệ (read, duyệt)', 2),
  ('project_manager', 'Quản lý dự án', 'Xem toàn bộ dự án được giao, quản lý team/TKQC/ngân sách trong scope', 3),
  ('leader', 'Leader', 'Báo cáo & điều phối team / dự án', 4),
  ('mkt', 'Marketing', 'Báo cáo & tài khoản MKT', 5)
on conflict (code) do update
set name_vi = excluded.name_vi,
    description = excluded.description,
    sort_order = excluded.sort_order;

-- 3) Gán view mặc định cho 2 vai trò mới
-- Giám đốc: full như admin (xem tất cả dự án + dashboard toàn hệ)
-- QLDA: quản trị dự án trong scope + toàn bộ view Leader/MKT
insert into public.crm_role_views (role_id, view_id)
select r.id, m.view_id
from (
  values
    ('director'::text, 'admin-dash'::text),
    ('director', 'burn-detect'),
    ('director', 'alerts'),
    ('director', 'projects'),
    ('director', 'project-qc-excel'),
    ('director', 'teams'),
    ('director', 'staff'),
    ('director', 'ad-accounts'),
    ('director', 'agencies'),
    ('director', 'products'),
    ('director', 'markets'),
    ('director', 'budget'),
    ('director', 'reconcile'),
    ('director', 'upcare-mkt'),
    ('director', 'admin-ranking'),
    ('director', 'compare'),
    ('director', 'reports-raw'),
    ('director', 'leader-dash'),
    ('director', 'leader-rank'),
    ('director', 'heatmap'),
    ('director', 'leader-mkt'),
    ('director', 'leader-tkqc'),
    ('director', 'leader-budget'),
    ('director', 'kpi-target'),
    ('director', 'mkt-dash'),
    ('director', 'mkt-report'),
    ('director', 'mkt-bill'),
    ('director', 'mkt-history'),
    ('director', 'mkt-accounts'),
    ('project_manager', 'admin-dash'),
    ('project_manager', 'projects'),
    ('project_manager', 'project-qc-excel'),
    ('project_manager', 'teams'),
    ('project_manager', 'staff'),
    ('project_manager', 'ad-accounts'),
    ('project_manager', 'agencies'),
    ('project_manager', 'products'),
    ('project_manager', 'markets'),
    ('project_manager', 'budget'),
    ('project_manager', 'reconcile'),
    ('project_manager', 'upcare-mkt'),
    ('project_manager', 'admin-ranking'),
    ('project_manager', 'compare'),
    ('project_manager', 'reports-raw'),
    ('project_manager', 'leader-dash'),
    ('project_manager', 'leader-rank'),
    ('project_manager', 'heatmap'),
    ('project_manager', 'leader-mkt'),
    ('project_manager', 'leader-tkqc'),
    ('project_manager', 'leader-budget'),
    ('project_manager', 'kpi-target'),
    ('project_manager', 'mkt-dash'),
    ('project_manager', 'mkt-report'),
    ('project_manager', 'mkt-bill'),
    ('project_manager', 'mkt-history'),
    ('project_manager', 'mkt-accounts')
) as m(role_code, view_id)
inner join public.crm_roles r on r.code = m.role_code
on conflict (role_id, view_id) do nothing;

-- 4) Chuẩn hóa vi_tri employees về 5 giá trị (không ép NOT NULL để tương thích dữ liệu cũ)
-- Chạy kiểm tra trước:
--   select vi_tri, count(*) from public.employees group by 1 order by 2 desc;
-- Sau khi rà soát thủ công, update các biến thể lệch về chuẩn:
--   update public.employees set vi_tri = 'Giám đốc'
--   where lower(trim(vi_tri)) in ('giam doc', 'giamdoc', 'director', 'giám đốc');
--   update public.employees set vi_tri = 'Quản lý dự án'
--   where lower(trim(vi_tri)) in ('quan ly du an', 'qlduan', 'manager', 'project_manager', 'quản lý dự án');
--   update public.employees set vi_tri = 'Leader'
--   where lower(trim(vi_tri)) in ('leader', 'trưởng nhóm', 'truong nhom', 'team lead');
--   update public.employees set vi_tri = 'Nhân viên MKT'
--   where lower(trim(vi_tri)) in ('nhan vien mkt', 'mkt', 'marketing', 'nhân viên mkt');

-- 5) Ví dụ gán vai trò (đổi email rồi bỏ comment):
-- insert into public.crm_user_roles (employee_id, role_id, note)
-- select e.id, r.id, 'seed director'
-- from public.employees e cross join public.crm_roles r
-- where lower(trim(e.email)) = lower('giamdoc@example.com') and r.code = 'director'
-- on conflict (employee_id, role_id) do nothing;
-- insert into public.crm_user_roles (employee_id, role_id, note)
-- select e.id, r.id, 'seed project manager'
-- from public.employees e cross join public.crm_roles r
-- where lower(trim(e.email)) = lower('qldoan@example.com') and r.code = 'project_manager'
-- on conflict (employee_id, role_id) do nothing;
