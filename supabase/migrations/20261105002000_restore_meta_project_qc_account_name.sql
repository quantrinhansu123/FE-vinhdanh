begin;

alter table public.meta_project_qc_insights
  add column if not exists account_name text not null default '';

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
    account_id, account_name, report_date, employee_code, campaign_name,
    spend_vnd, conversations, fetched_at
  )
  select r.account_id, coalesce(nullif(btrim(r.account_name), ''), ''), r.report_date,
         nullif(btrim(r.employee_code), ''), btrim(r.campaign_name),
         r.spend_vnd, r.conversations, p_fetched_at
  from jsonb_to_recordset(p_rows) as r(
    account_id text, account_name text, report_date date, employee_code text, campaign_name text,
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

comment on column public.meta_project_qc_insights.account_name is
  'Meta ad account display name returned by the Graph API';

commit;
