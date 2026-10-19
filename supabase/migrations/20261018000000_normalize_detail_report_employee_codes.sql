-- Keep one detail_reports row per employee/day regardless of code casing.
-- The live audit found one duplicate: FBC.DieuLN / FBC.DIEULN on 2026-10-17.
do $$
declare
  duplicate_group_count integer;
  deleted_count integer;
begin
  select count(*)
    into duplicate_group_count
  from (
    select report_date, lower(regexp_replace(btrim(replace(code, chr(160), ' ')), '[[:space:]]+', ' ', 'g')) as normalized_code
    from public.detail_reports
    where code is not null and nullif(btrim(code), '') is not null
    group by report_date, lower(regexp_replace(btrim(replace(code, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
    having count(*) > 1
  ) duplicates;

  if duplicate_group_count > 0 then
    if duplicate_group_count <> 1 or not exists (
      select 1
      from public.detail_reports
      where report_date = date '2026-10-17'
        and lower(regexp_replace(btrim(replace(code, chr(160), ' ')), '[[:space:]]+', ' ', 'g')) = 'fbc.dieuln'
      group by report_date, lower(regexp_replace(btrim(replace(code, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
      having count(*) = 2
    ) then
      raise exception 'Migration stopped: unexpected duplicate detail_reports employee/day keys need review.';
    end if;

    if not exists (
      select 1
      from public.detail_reports keeper
      join public.detail_reports duplicate
        on duplicate.report_date = keeper.report_date
       and lower(regexp_replace(btrim(replace(duplicate.code, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
           = lower(regexp_replace(btrim(replace(keeper.code, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
      where keeper.report_date = date '2026-10-17'
        and keeper.code = 'FBC.DieuLN'
        and duplicate.code = 'FBC.DIEULN'
        and keeper.revenue is not distinct from duplicate.revenue
        and keeper.tien_viet is not distinct from duplicate.tien_viet
        and keeper.order_count is not distinct from duplicate.order_count
        and keeper.tong_data_nhan is not distinct from duplicate.tong_data_nhan
        and coalesce(duplicate.ad_cost, 0) = 0
        and coalesce(duplicate.mess_comment_count, 0) = 0
    ) then
      raise exception 'Migration stopped: the audited Diệu rows changed; review and merge their current values before retrying.';
    end if;

    delete from public.detail_reports duplicate
    where duplicate.report_date = date '2026-10-17'
      and duplicate.code = 'FBC.DIEULN'
      and exists (
        select 1
        from public.detail_reports keeper
        where keeper.report_date = duplicate.report_date
          and keeper.code = 'FBC.DieuLN'
          and lower(regexp_replace(btrim(replace(keeper.code, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
              = lower(regexp_replace(btrim(replace(duplicate.code, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
          and keeper.revenue is not distinct from duplicate.revenue
          and keeper.tien_viet is not distinct from duplicate.tien_viet
          and keeper.order_count is not distinct from duplicate.order_count
          and keeper.tong_data_nhan is not distinct from duplicate.tong_data_nhan
      );
    get diagnostics deleted_count = row_count;

    if deleted_count <> 1 then
      raise exception 'Migration stopped: expected to remove exactly one audited Diệu duplicate, removed %.', deleted_count;
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.detail_reports
    where code is not null and nullif(btrim(code), '') is not null
    group by report_date, lower(regexp_replace(btrim(replace(code, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
    having count(*) > 1
  ) then
    raise exception 'Migration stopped: duplicate normalized detail_reports employee/day keys remain.';
  end if;
end;
$$;

alter table public.detail_reports
  add column if not exists code_normalized text
  generated always as (nullif(lower(regexp_replace(btrim(replace(code, chr(160), ' ')), '[[:space:]]+', ' ', 'g')), '')) stored;

drop index if exists public.detail_reports_report_date_code_uidx;
create unique index if not exists detail_reports_report_date_code_normalized_uidx
  on public.detail_reports (report_date, code_normalized)
  where code_normalized is not null;

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
