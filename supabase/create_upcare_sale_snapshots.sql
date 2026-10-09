-- Hourly snapshots of the existing Upcare/Odoo employee Sale endpoint.
create table if not exists public.upcare_sale_snapshots (
  id bigint generated always as identity primary key,
  odoo_employee_id text not null,
  employee_code text,
  employee_name text not null,
  avatar_url text,
  amount numeric(20, 4) not null default 0,
  sale_count numeric(20, 4) not null default 0,
  date_from date not null,
  date_to date not null,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint upcare_sale_snapshots_employee_range_key
    unique (odoo_employee_id, date_from, date_to)
);

create index if not exists upcare_sale_snapshots_range_idx
  on public.upcare_sale_snapshots (date_from, date_to, amount desc);

alter table public.upcare_sale_snapshots enable row level security;
revoke all on table public.upcare_sale_snapshots from anon, authenticated;
grant all on table public.upcare_sale_snapshots to service_role;

comment on table public.upcare_sale_snapshots is
  'Hourly upsert snapshots from GET /api/employee/sale for the requested date range.';
comment on column public.upcare_sale_snapshots.amount is
  'Sales amount reported by Upcare/Odoo; stored independently from Meta attributed purchase value.';
