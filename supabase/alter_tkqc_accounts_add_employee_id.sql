-- Gắn nhân sự phụ trách (employees) cho từng dòng tkqc_accounts — chạy sau create_employees_table.sql + create_tkqc_accounts.sql

alter table public.tkqc_accounts
  add column if not exists employee_id uuid references public.employees (id) on delete set null;

create index if not exists tkqc_accounts_employee_id_idx on public.tkqc_accounts (employee_id);

comment on column public.tkqc_accounts.employee_id is 'Nhân viên phụ trách (bảng employees)';
