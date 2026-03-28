-- Kênh marketing & nội dung (CRM → Marketing → Kênh & nội dung)
-- Cột: loại kênh, link kênh, nội dung, chi phí, số lead, số đơn

create extension if not exists pgcrypto;

create table if not exists public.marketing_channels (
  id uuid primary key default gen_random_uuid(),
  loai_kenh text not null,
  link_kenh text,
  noi_dung text,
  chi_phi numeric(18, 2) not null default 0 check (chi_phi >= 0),
  so_lead integer not null default 0 check (so_lead >= 0),
  so_don integer not null default 0 check (so_don >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_channels_loai_idx on public.marketing_channels (loai_kenh);

comment on table public.marketing_channels is 'Kênh & nội dung: loại kênh, link, chi phí, lead, đơn';
comment on column public.marketing_channels.noi_dung is 'Mô tả / nội dung content';
comment on column public.marketing_channels.chi_phi is 'Chi phí (VND)';

create or replace function public.marketing_channels_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketing_channels_set_updated_at on public.marketing_channels;
create trigger marketing_channels_set_updated_at
before update on public.marketing_channels
for each row execute procedure public.marketing_channels_set_updated_at();

alter table public.marketing_channels enable row level security;

drop policy if exists "anon can read marketing_channels" on public.marketing_channels;
drop policy if exists "anon can insert marketing_channels" on public.marketing_channels;
drop policy if exists "anon can update marketing_channels" on public.marketing_channels;
drop policy if exists "anon can delete marketing_channels" on public.marketing_channels;

create policy "anon can read marketing_channels" on public.marketing_channels for select to anon using (true);
create policy "anon can insert marketing_channels" on public.marketing_channels for insert to anon with check (true);
create policy "anon can update marketing_channels" on public.marketing_channels for update to anon using (true) with check (true);
create policy "anon can delete marketing_channels" on public.marketing_channels for delete to anon using (true);

insert into public.marketing_channels (loai_kenh, link_kenh, noi_dung, chi_phi, so_lead, so_don)
select 'Facebook Ads', 'https://facebook.com/ads.example', 'Video UGC + carousel sản phẩm A', 12500000, 48, 12
where not exists (select 1 from public.marketing_channels limit 1);

insert into public.marketing_channels (loai_kenh, link_kenh, noi_dung, chi_phi, so_lead, so_don)
select 'Google Search', 'https://ads.google.com/...', 'Từ khóa brand + generic', 8200000, 22, 7
where not exists (select 1 from public.marketing_channels where loai_kenh = 'Google Search');
