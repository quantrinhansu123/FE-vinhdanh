-- Run after create_du_an_qc_excel.sql. Server-only atomic Meta import into QC Excel.
begin;

create or replace function public.replace_meta_qc_excel(
  p_account_id text, p_since date, p_until date, p_rows jsonb
) returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
  source_marker text := 'meta-api:' || p_account_id;
begin
  if p_account_id is null or p_account_id !~ '^[0-9]+$'
     or p_since is null or p_until is null or p_since > p_until or p_until - p_since > 30
     or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Invalid Meta QC import scope';
  end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r
    where r->>'ngay' is null or (r->>'ngay')::date not between p_since and p_until
      or coalesce(btrim(r->>'ten_chien_dich'), '') = ''
      or r->>'so_tien_da_chi_tieu_vnd' is null or (r->>'so_tien_da_chi_tieu_vnd')::numeric < 0
      or r->>'so_tro_chuyen_tin_nhan' is null or (r->>'so_tro_chuyen_tin_nhan')::numeric < 0) then
    raise exception 'Invalid Meta QC import rows';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('meta_qc:' || p_account_id, 0));
  delete from public.du_an_qc_excel_rows
  where source_file = source_marker and ngay between p_since and p_until;

  insert into public.du_an_qc_excel_rows
    (ngay, ma_nv, ten_chien_dich, so_tien_da_chi_tieu_vnd, so_tro_chuyen_tin_nhan, source_file)
  select r.ngay, r.ma_nv, r.ten_chien_dich, r.so_tien_da_chi_tieu_vnd, r.so_tro_chuyen_tin_nhan, source_marker
  from jsonb_to_recordset(p_rows) as r(
    ngay date, ma_nv text, ten_chien_dich text,
    so_tien_da_chi_tieu_vnd numeric, so_tro_chuyen_tin_nhan numeric
  )
  -- Match the existing Excel duplicate rule without deleting manually imported rows.
  where not exists (
    select 1 from public.du_an_qc_excel_rows e
    where coalesce(e.source_file, '') not like 'meta-api:%'
      and e.ngay = r.ngay
      and upper(btrim(coalesce(e.ma_nv, ''))) = upper(btrim(coalesce(r.ma_nv, '')))
      and lower(btrim(e.ten_chien_dich)) = lower(btrim(r.ten_chien_dich))
      and e.so_tien_da_chi_tieu_vnd = r.so_tien_da_chi_tieu_vnd
      and e.so_tro_chuyen_tin_nhan = r.so_tro_chuyen_tin_nhan
  );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant select, insert, delete on public.du_an_qc_excel_rows to service_role;
revoke all on function public.replace_meta_qc_excel(text, date, date, jsonb) from public, anon, authenticated;
grant execute on function public.replace_meta_qc_excel(text, date, date, jsonb) to service_role;

commit;
