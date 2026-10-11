-- Meta Ads daily ad-level metrics. This table is written only by the server.
create table if not exists public.facebook_ad_insights_daily (
  id bigint generated always as identity primary key,
  ad_account_id text not null,
  ad_account_name text,
  account_currency text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text not null,
  ad_name text,
  date_start date not null,
  date_stop date not null,
  spend numeric(20, 6) not null default 0,
  impressions bigint not null default 0,
  reach bigint,
  clicks bigint not null default 0,
  ctr numeric(20, 8),
  cpc numeric(20, 8),
  cpm numeric(20, 8),
  purchase_count numeric(20, 6) not null default 0,
  purchase_value numeric(20, 6) not null default 0,
  actions jsonb not null default '[]'::jsonb,
  action_values jsonb not null default '[]'::jsonb,
  purchase_roas jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facebook_ad_insights_daily_account_ad_date_key
    unique (ad_account_id, ad_id, date_start)
);

create index if not exists facebook_ad_insights_daily_date_idx
  on public.facebook_ad_insights_daily (date_start desc);
create index if not exists facebook_ad_insights_daily_account_date_idx
  on public.facebook_ad_insights_daily (ad_account_id, date_start desc);

alter table public.facebook_ad_insights_daily enable row level security;
revoke all on table public.facebook_ad_insights_daily from anon, authenticated;
grant all on table public.facebook_ad_insights_daily to service_role;

-- Pre-aggregated daily account totals used by the leaderboard. Keep the raw
-- ad-grain table server-only; the read API returns only these account totals.
create table if not exists public.facebook_ad_account_daily (
  id bigint generated always as identity primary key,
  ad_account_id text not null,
  ad_account_name text,
  account_currency text,
  date_start date not null,
  spend numeric(20, 6) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  purchase_count numeric(20, 6) not null default 0,
  purchase_value numeric(20, 6) not null default 0,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facebook_ad_account_daily_account_date_key
    unique (ad_account_id, date_start)
);

create index if not exists facebook_ad_account_daily_date_idx
  on public.facebook_ad_account_daily (date_start desc);

alter table public.facebook_ad_account_daily enable row level security;
revoke all on table public.facebook_ad_account_daily from anon, authenticated;
grant all on table public.facebook_ad_account_daily to service_role;

comment on table public.facebook_ad_insights_daily is
  'Raw daily Meta Marketing API ad-level Insights, upserted by account, ad, and date.';
comment on table public.facebook_ad_account_daily is
  'Daily account-level aggregates for the server-side Meta Ads leaderboard API.';
comment on column public.facebook_ad_insights_daily.purchase_value is
  'One selected Meta purchase action value; raw action_values are retained for audit.';
