-- VND revenue populated from the Upcare MKT amount during report sync.
alter table public.detail_reports
  add column if not exists tien_viet numeric;

comment on column public.detail_reports.tien_viet is
  'Revenue converted to VND; Upcare amount is converted at 25,000 VND per unit.';
