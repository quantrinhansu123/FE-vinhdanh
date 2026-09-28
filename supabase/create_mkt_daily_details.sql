-- Daily campaign detail synchronized from Meta QC Excel.
create extension if not exists pgcrypto;

create table if not exists public.mkt_daily_details (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  ma_nv text not null,
  ten_chien_dich text not null,
  ad_cost_vnd numeric(18, 2) not null default 0,
  message_conversations numeric(18, 4) not null default 0,
  source_file text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mkt_daily_details_day_employee_campaign_key
    unique (report_date, ma_nv, ten_chien_dich)
);

create index if not exists mkt_daily_details_report_date_idx
  on public.mkt_daily_details (report_date desc);
create index if not exists mkt_daily_details_ma_nv_idx
  on public.mkt_daily_details (ma_nv);

create or replace function public.mkt_daily_details_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mkt_daily_details_set_updated_at on public.mkt_daily_details;
create trigger mkt_daily_details_set_updated_at
before update on public.mkt_daily_details
for each row execute procedure public.mkt_daily_details_set_updated_at();

alter table public.mkt_daily_details enable row level security;
drop policy if exists "anon read mkt_daily_details" on public.mkt_daily_details;
drop policy if exists "anon insert mkt_daily_details" on public.mkt_daily_details;
drop policy if exists "anon update mkt_daily_details" on public.mkt_daily_details;
drop policy if exists "anon delete mkt_daily_details" on public.mkt_daily_details;
create policy "anon read mkt_daily_details" on public.mkt_daily_details for select to anon using (true);
create policy "anon insert mkt_daily_details" on public.mkt_daily_details for insert to anon with check (true);
create policy "anon update mkt_daily_details" on public.mkt_daily_details for update to anon using (true) with check (true);
create policy "anon delete mkt_daily_details" on public.mkt_daily_details for delete to anon using (true);

comment on table public.mkt_daily_details is
  'Daily MKT campaign detail by employee code: spend and messaging conversations';
