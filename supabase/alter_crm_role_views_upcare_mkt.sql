-- Bổ sung view_id upcare-mkt cho vai trò admin (đồng bộ FE /crm-admin/upcare-mkt)
insert into public.crm_role_views (role_id, view_id)
select r.id, 'upcare-mkt'
from public.crm_roles r
where r.code = 'admin'
on conflict (role_id, view_id) do nothing;
