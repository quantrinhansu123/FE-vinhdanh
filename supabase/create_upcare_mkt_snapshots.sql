-- Hourly snapshots of the existing Upcare/Odoo employee MKT endpoint.
create table if not exists public.upcare_mkt_sales_snapshots (
  id bigint generated always as identity primary key,
  odoo_employee_id text not null,
  employee_code text,
  employee_name text not null,
  avatar_url text,
  amount numeric(20, 4) not null default 0,
  order_count numeric(20, 4) not null default 0,
  date_from date not null,
  date_to date not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint upcare_mkt_sales_snapshots_employee_range_key
    unique (odoo_employee_id, date_from, date_to)
);

create index if not exists upcare_mkt_sales_snapshots_range_idx
  on public.upcare_mkt_sales_snapshots (date_from, date_to, amount desc);

alter table public.upcare_mkt_sales_snapshots enable row level security;
revoke all on table public.upcare_mkt_sales_snapshots from anon, authenticated;
grant all on table public.upcare_mkt_sales_snapshots to service_role;

comment on table public.upcare_mkt_sales_snapshots is
  'Hourly upsert snapshots from GET /api/employee/mkt for the requested date range.';
comment on column public.upcare_mkt_sales_snapshots.amount is
  'Sales amount reported by Upcare/Odoo, preserved separately from Meta purchase values.';
