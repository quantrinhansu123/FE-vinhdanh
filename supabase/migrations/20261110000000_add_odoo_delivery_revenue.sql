alter table public.detail_reports
  add column if not exists delivery_revenue numeric;

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
       or (row_data->>'delivery_revenue' is not null and row_data->>'delivery_revenue' !~ '^-?\d+(\.\d+)?$')
       or coalesce(row_data->>'order_count', '') !~ '^-?\d+$'
       or coalesce(row_data->>'tong_data_nhan', '') !~ '^-?\d+$'
  ) then
    raise exception 'Invalid Odoo detail report rows';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sync_upcare_mkt_to_detail_reports', 0));
  insert into public.detail_reports (
    report_date, code, name, email, team, revenue, tien_viet, delivery_revenue, order_count, tong_data_nhan
  )
  select r.report_date, btrim(r.code), btrim(r.name), lower(btrim(r.email)),
         nullif(btrim(r.team), ''), r.revenue, r.tien_viet, r.delivery_revenue, r.order_count, r.tong_data_nhan
  from jsonb_to_recordset(p_rows) as r(
    report_date date, code text, name text, email text, team text,
    revenue numeric, tien_viet numeric, delivery_revenue numeric, order_count integer, tong_data_nhan integer
  )
  on conflict (report_date, code_normalized) where code_normalized is not null
  do update set
    name = excluded.name,
    email = excluded.email,
    team = excluded.team,
    revenue = excluded.revenue,
    tien_viet = excluded.tien_viet,
    delivery_revenue = excluded.delivery_revenue,
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
