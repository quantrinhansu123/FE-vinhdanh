-- Server-side Meta snapshot and controlled merge into detail_reports.
-- Run after the base detail_reports schema exists.
begin;

create table if not exists public.meta_project_qc_insights (
  account_id text not null,
  report_date date not null,
  employee_code text,
  campaign_name text not null,
  spend_vnd numeric(18, 2) not null default 0 check (spend_vnd >= 0),
  conversations numeric(18, 4) not null default 0 check (conversations >= 0),
  fetched_at timestamptz not null,
  primary key (account_id, report_date, campaign_name)
);

create index if not exists meta_project_qc_insights_report_date_idx
  on public.meta_project_qc_insights (report_date desc);
create index if not exists meta_project_qc_insights_employee_date_idx
  on public.meta_project_qc_insights (employee_code, report_date);

alter table public.meta_project_qc_insights enable row level security;
revoke all on public.meta_project_qc_insights from public, anon, authenticated;
grant select, insert, update, delete on public.meta_project_qc_insights to service_role;

alter table public.detail_reports add column if not exists code text;
alter table public.detail_reports add column if not exists meta_synced_at timestamptz;
alter table public.detail_reports add column if not exists revenue numeric;
alter table public.detail_reports add column if not exists tien_viet numeric;
alter table public.detail_reports add column if not exists order_count integer;
alter table public.detail_reports add column if not exists tong_data_nhan integer;
alter table public.detail_reports
  add column if not exists code_normalized text
  generated always as (nullif(lower(regexp_replace(btrim(replace(code, chr(160), ' ')), '[[:space:]]+', ' ', 'g')), '')) stored;

do $$
begin
  if exists (
    select 1 from public.detail_reports
    where code_normalized is not null
    group by report_date, code_normalized
    having count(*) > 1
  ) then
    raise exception 'Migration stopped: detail_reports contains duplicate normalized (report_date, code) rows. Reconcile the employee/day rows before enabling the automatic Meta/Odoo sync.';
  end if;
end;
$$;

drop index if exists public.detail_reports_report_date_code_uidx;
create unique index if not exists detail_reports_report_date_code_normalized_uidx
  on public.detail_reports (report_date, code_normalized)
  where code_normalized is not null;
grant select, insert, update, delete on public.detail_reports to service_role;

comment on table public.meta_project_qc_insights is
  'Server-only Meta campaign daily snapshots used to seed marketing detail_reports';
comment on column public.detail_reports.meta_synced_at is
  'Last time Meta refreshed ad_cost and mess_comment_count for this detail report row';

create or replace function public.replace_meta_project_qc_insights(
  p_since date,
  p_until date,
  p_fetched_at timestamptz,
  p_rows jsonb
) returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
begin
  if p_since is null or p_until is null or p_since > p_until or p_until - p_since > 89
     or p_fetched_at is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Invalid Meta snapshot arguments';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as row_data
    where coalesce(row_data->>'account_id', '') !~ '^[0-9]+$'
       or row_data->>'report_date' is null
       or row_data->>'report_date' !~ '^\d{4}-\d{2}-\d{2}$'
       or (row_data->>'report_date')::date not between p_since and p_until
       or coalesce(btrim(row_data->>'campaign_name'), '') = ''
       or coalesce(row_data->>'spend_vnd', '') !~ '^\d+(\.\d+)?$'
       or (row_data->>'spend_vnd')::numeric < 0
       or coalesce(row_data->>'conversations', '') !~ '^\d+(\.\d+)?$'
       or (row_data->>'conversations')::numeric < 0
  ) then
    raise exception 'Invalid Meta snapshot rows';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('meta_project_qc_insights', 0));
  delete from public.meta_project_qc_insights
  where report_date between p_since and p_until;

  insert into public.meta_project_qc_insights (
    account_id, report_date, employee_code, campaign_name,
    spend_vnd, conversations, fetched_at
  )
  select r.account_id, r.report_date, nullif(btrim(r.employee_code), ''), btrim(r.campaign_name),
         r.spend_vnd, r.conversations, p_fetched_at
  from jsonb_to_recordset(p_rows) as r(
    account_id text, report_date date, employee_code text, campaign_name text,
    spend_vnd numeric, conversations numeric
  );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.replace_meta_project_qc_insights(date, date, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_meta_project_qc_insights(date, date, timestamptz, jsonb)
  to service_role;

create or replace function public.sync_meta_qc_to_detail_reports(
  p_since date,
  p_until date,
  p_rows jsonb,
  p_reset_dates jsonb
) returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  synced_count integer;
  synced_at timestamptz := now();
begin
  if p_since is null or p_until is null or p_since > p_until or p_until - p_since > 89
     or p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or p_reset_dates is null or jsonb_typeof(p_reset_dates) <> 'array' then
    raise exception 'Invalid detail report sync scope';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as row_data
    where row_data->>'report_date' is null
       or row_data->>'report_date' !~ '^\d{4}-\d{2}-\d{2}$'
       or (row_data->>'report_date')::date not between p_since and p_until
       or coalesce(btrim(row_data->>'code'), '') = ''
       or coalesce(btrim(row_data->>'name'), '') = ''
       or coalesce(btrim(row_data->>'email'), '') = ''
       or coalesce(row_data->>'ad_cost', '') !~ '^\d+(\.\d+)?$'
       or (row_data->>'ad_cost')::numeric < 0
       or coalesce(row_data->>'mess_comment_count', '') !~ '^\d+$'
       or (row_data->>'mess_comment_count')::integer < 0
  ) then
    raise exception 'Invalid detail report rows';
  end if;

  if exists (
    select 1 from jsonb_array_elements_text(p_reset_dates) as reset_date(value)
    where value !~ '^\d{4}-\d{2}-\d{2}$'
       or value::date not between p_since and p_until
  ) then
    raise exception 'Invalid Meta reset dates';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sync_meta_qc_to_detail_reports', 0));

  -- Only clear dates whose entire Meta slice was mapped. Odoo and sales fields remain untouched.
  update public.detail_reports
  set ad_cost = 0,
      mess_comment_count = 0,
      meta_synced_at = synced_at
  where meta_synced_at is not null
    and report_date in (
      select value::date
      from jsonb_array_elements_text(p_reset_dates) as reset_date(value)
    );

  insert into public.detail_reports (
    report_date, code, name, email, team, ad_account,
    ad_cost, mess_comment_count, meta_synced_at
  )
  select r.report_date, btrim(r.code), btrim(r.name), lower(btrim(r.email)),
         nullif(btrim(r.team), ''), nullif(btrim(r.ad_account), ''),
         r.ad_cost, r.mess_comment_count, synced_at
  from jsonb_to_recordset(p_rows) as r(
    report_date date, code text, name text, email text, team text,
    ad_account text, ad_cost numeric, mess_comment_count integer
  )
  on conflict (report_date, code_normalized) where code_normalized is not null
  do update set
    name = excluded.name,
    email = excluded.email,
    team = excluded.team,
    ad_account = excluded.ad_account,
    ad_cost = excluded.ad_cost,
    mess_comment_count = excluded.mess_comment_count,
    meta_synced_at = excluded.meta_synced_at;

  get diagnostics synced_count = row_count;
  return synced_count;
end;
$$;

revoke all on function public.sync_meta_qc_to_detail_reports(date, date, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_meta_qc_to_detail_reports(date, date, jsonb, jsonb)
  to service_role;

create or replace function public.sync_upcare_mkt_to_detail_reports(
  p_since date,
  p_until date,
  p_rows jsonb
) returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  synced_count integer;
begin
  if p_since is null or p_until is null or p_since > p_until or p_until - p_since > 6
     or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Invalid Odoo detail report sync scope';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_rows) as row_data
    where row_data->>'report_date' is null
       or row_data->>'report_date' !~ '^\d{4}-\d{2}-\d{2}$'
       or (row_data->>'report_date')::date not between p_since and p_until
       or coalesce(btrim(row_data->>'code'), '') = ''
       or coalesce(btrim(row_data->>'name'), '') = ''
       or coalesce(btrim(row_data->>'email'), '') = ''
       or coalesce(row_data->>'revenue', '') !~ '^-?\d+(\.\d+)?$'
       or coalesce(row_data->>'tien_viet', '') !~ '^-?\d+(\.\d+)?$'
       or coalesce(row_data->>'order_count', '') !~ '^-?\d+$'
       or coalesce(row_data->>'tong_data_nhan', '') !~ '^-?\d+$'
  ) then
    raise exception 'Invalid Odoo detail report rows';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sync_upcare_mkt_to_detail_reports', 0));
  insert into public.detail_reports (
    report_date, code, name, email, team, revenue, tien_viet, order_count, tong_data_nhan
  )
  select r.report_date, btrim(r.code), btrim(r.name), lower(btrim(r.email)),
         nullif(btrim(r.team), ''), r.revenue, r.tien_viet, r.order_count, r.tong_data_nhan
  from jsonb_to_recordset(p_rows) as r(
    report_date date, code text, name text, email text, team text,
    revenue numeric, tien_viet numeric, order_count integer, tong_data_nhan integer
  )
  on conflict (report_date, code_normalized) where code_normalized is not null
  do update set
    name = excluded.name,
    email = excluded.email,
    team = excluded.team,
    revenue = excluded.revenue,
    tien_viet = excluded.tien_viet,
    order_count = excluded.order_count,
    tong_data_nhan = excluded.tong_data_nhan;

  get diagnostics synced_count = row_count;
  return synced_count;
end;
$$;

revoke all on function public.sync_upcare_mkt_to_detail_reports(date, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_upcare_mkt_to_detail_reports(date, date, jsonb)
  to service_role;

commit;
