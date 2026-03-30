-- Liên kết marketing_staff ↔ employees (dropdown TKQC lấy từ nhân sự MKT)
-- Chạy sau khi có public.employees và public.marketing_staff.

alter table public.marketing_staff add column if not exists employee_id uuid;

create unique index if not exists marketing_staff_employee_id_unique_idx
on public.marketing_staff (employee_id)
where employee_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'marketing_staff'
      and c.conname = 'marketing_staff_employee_id_fkey'
  ) then
    alter table public.marketing_staff
      add constraint marketing_staff_employee_id_fkey
      foreign key (employee_id) references public.employees (id) on delete set null;
  end if;
end $$;

comment on column public.marketing_staff.employee_id is 'Nhân sự CRM (employees); TKQC chọn MKT theo vi_tri';
