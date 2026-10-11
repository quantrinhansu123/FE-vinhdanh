-- Run once in Supabase SQL Editor. Only server service_role can access this data.
begin;

create table if not exists public.meta_ads_insights (
  account_id text not null,
  ad_id text not null,
  date_start date not null,
  date_stop date not null,
  account_name text not null default '',
  account_currency text not null,
  account_timezone text not null,
  campaign_id text not null default '',
  campaign_name text not null default '',
  adset_id text not null default '',
  adset_name text not null default '',
  ad_name text not null default '',
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  reach bigint not null default 0,
  cpc numeric not null default 0,
  cpm numeric not null default 0,
  ctr numeric not null default 0,
  actions jsonb not null default '[]'::jsonb,
  action_values jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null,
  primary key (account_id, ad_id, date_start),
  check (date_start = date_stop),
  check (spend >= 0 and impressions >= 0 and clicks >= 0 and reach >= 0)
);
create index if not exists meta_ads_insights_account_date_idx
  on public.meta_ads_insights (account_id, date_start);

alter table public.meta_ads_insights enable row level security;
revoke all on public.meta_ads_insights from public, anon, authenticated;
grant select, insert, update, delete on public.meta_ads_insights to service_role;

-- Replacement is atomic, idempotent, and removes stale rows in a completed
-- reporting slice. An empty report clears only this account and date range.
create or replace function public.replace_meta_ads_insights(
  p_account_id text, p_since date, p_until date, p_timezone text,
  p_fetched_at timestamptz, p_rows jsonb
) returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
begin
  if p_account_id is null or p_account_id !~ '^[0-9]+$'
     or p_since is null or p_until is null or p_since > p_until or p_until - p_since > 30
     or p_timezone is null or p_timezone = '' or p_fetched_at is null
     or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Invalid Meta report arguments';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_rows) as r
    where r->>'account_id' is distinct from p_account_id
      or r->>'ad_id' is null or r->>'ad_id' !~ '^[0-9]+$'
      or r->>'date_start' is null or r->>'date_stop' is null
      or (r->>'date_start')::date not between p_since and p_until
      or (r->>'date_stop')::date <> (r->>'date_start')::date
  ) then
    raise exception 'Meta rows do not match account/date scope';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('meta_ads:' || p_account_id, 0));
  -- A slower, older request must not overwrite a newer snapshot.
  if exists (select 1 from public.meta_ads_insights where account_id = p_account_id
             and date_start between p_since and p_until and fetched_at > p_fetched_at) then
    raise exception 'A newer Meta report has already been saved';
  end if;

  delete from public.meta_ads_insights
  where account_id = p_account_id and date_start between p_since and p_until;

  insert into public.meta_ads_insights (
    account_id, ad_id, date_start, date_stop, account_name, account_currency, account_timezone,
    campaign_id, campaign_name, adset_id, adset_name, ad_name,
    spend, impressions, clicks, reach, cpc, cpm, ctr, actions, action_values, fetched_at
  )
  select r.account_id, r.ad_id, r.date_start, r.date_stop, r.account_name, r.account_currency, p_timezone,
    r.campaign_id, r.campaign_name, r.adset_id, r.adset_name, r.ad_name,
    r.spend, r.impressions, r.clicks, r.reach, r.cpc, r.cpm, r.ctr, r.actions, r.action_values, p_fetched_at
  from jsonb_to_recordset(p_rows) as r(
    account_id text, ad_id text, date_start date, date_stop date, account_name text, account_currency text,
    campaign_id text, campaign_name text, adset_id text, adset_name text, ad_name text,
    spend numeric, impressions bigint, clicks bigint, reach bigint, cpc numeric, cpm numeric, ctr numeric,
    actions jsonb, action_values jsonb
  );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.replace_meta_ads_insights(text, date, date, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_meta_ads_insights(text, date, date, text, timestamptz, jsonb)
  to service_role;

commit;
