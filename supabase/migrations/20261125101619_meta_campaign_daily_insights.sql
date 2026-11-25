-- Campaign-level daily snapshots imported from the authenticated Meta Ads UI.
-- Raw reads and writes stay server-only; the extension never receives DB keys.
begin;

create table if not exists public.meta_campaign_daily_insights (
  account_id text not null,
  campaign_key text not null,
  campaign_id text,
  report_date date not null,
  account_name text not null default '',
  campaign_name text not null,
  currency text,
  spend numeric(18, 4) not null default 0 check (spend >= 0),
  impressions bigint check (impressions is null or impressions >= 0),
  reach bigint check (reach is null or reach >= 0),
  clicks bigint check (clicks is null or clicks >= 0),
  cpc numeric(18, 6) check (cpc is null or cpc >= 0),
  cpm numeric(18, 6) check (cpm is null or cpm >= 0),
  ctr numeric(18, 6) check (ctr is null or ctr >= 0),
  fetched_at timestamptz not null,
  primary key (account_id, campaign_key, report_date),
  check (account_id ~ '^[0-9]+$'),
  check (campaign_key <> ''),
  check (campaign_name <> ''),
  check (currency is null or currency ~ '^[A-Z]{3}$')
);

create index if not exists meta_campaign_daily_report_date_idx
  on public.meta_campaign_daily_insights (report_date desc, account_id);
create index if not exists meta_campaign_daily_campaign_date_idx
  on public.meta_campaign_daily_insights (campaign_id, report_date desc)
  where campaign_id is not null;

alter table public.meta_campaign_daily_insights enable row level security;
revoke all on public.meta_campaign_daily_insights from public, anon, authenticated;
grant select, insert, update, delete on public.meta_campaign_daily_insights to service_role;

create or replace function public.upsert_meta_campaign_daily_insights(
  p_account_id text,
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
  saved_count integer;
begin
  if p_account_id is null or p_account_id !~ '^[0-9]+$'
     or p_since is null or p_until is null or p_since > p_until or p_until - p_since > 30
     or p_fetched_at is null or p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) > 2500 then
    raise exception 'Invalid Meta campaign import arguments';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_rows) as r
    where r->>'account_id' is distinct from p_account_id
       or coalesce(btrim(r->>'campaign_key'), '') = ''
       or length(r->>'campaign_key') > 180
       or coalesce(btrim(r->>'campaign_name'), '') = ''
       or length(r->>'campaign_name') > 500
       or case when coalesce(r->>'report_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
               then (r->>'report_date')::date not between p_since and p_until else true end
       or coalesce(r->>'spend', '') !~ '^\d+(\.\d{1,4})?$'
       or case when coalesce(r->>'spend', '') ~ '^\d+(\.\d{1,4})?$'
               then (r->>'spend')::numeric < 0 else false end
       or (r->>'impressions' is not null and r->>'impressions' !~ '^\d+$')
       or (r->>'reach' is not null and r->>'reach' !~ '^\d+$')
       or (r->>'clicks' is not null and r->>'clicks' !~ '^\d+$')
       or (r->>'campaign_id' is not null and r->>'campaign_id' !~ '^\d+$')
       or (r ? 'currency' and r->>'currency' is not null and r->>'currency' !~ '^[A-Z]{3}$')
  ) then
    raise exception 'Invalid Meta campaign import rows';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('meta_campaign_daily:' || p_account_id, 0));
  insert into public.meta_campaign_daily_insights (
    account_id, campaign_key, campaign_id, report_date, account_name, campaign_name,
    currency, spend, impressions, reach, clicks, cpc, cpm, ctr, fetched_at
  )
  select r.account_id, r.campaign_key, nullif(r.campaign_id, ''), r.report_date,
         coalesce(r.account_name, ''), btrim(r.campaign_name), nullif(r.currency, ''),
         r.spend, r.impressions, r.reach, r.clicks, r.cpc, r.cpm, r.ctr, p_fetched_at
  from jsonb_to_recordset(p_rows) as r(
    account_id text, campaign_key text, campaign_id text, report_date date,
    account_name text, campaign_name text, currency text,
    spend numeric, impressions bigint, reach bigint, clicks bigint,
    cpc numeric, cpm numeric, ctr numeric
  )
  on conflict (account_id, campaign_key, report_date) do update set
    campaign_id = excluded.campaign_id,
    account_name = excluded.account_name,
    campaign_name = excluded.campaign_name,
    currency = coalesce(excluded.currency, meta_campaign_daily_insights.currency),
    spend = excluded.spend,
    impressions = excluded.impressions,
    reach = excluded.reach,
    clicks = excluded.clicks,
    cpc = excluded.cpc,
    cpm = excluded.cpm,
    ctr = excluded.ctr,
    fetched_at = excluded.fetched_at
  where public.meta_campaign_daily_insights.fetched_at <= excluded.fetched_at;

  get diagnostics saved_count = row_count;
  return saved_count;
end;
$$;

revoke all on function public.upsert_meta_campaign_daily_insights(text, date, date, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_meta_campaign_daily_insights(text, date, date, timestamptz, jsonb)
  to service_role;

commit;
