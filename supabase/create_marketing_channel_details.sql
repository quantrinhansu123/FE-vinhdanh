-- Chi tiết nội dung theo từng kênh (CRM → Marketing → Kênh & nội dung)
-- Chạy sau create_marketing_channels.sql

create extension if not exists pgcrypto;

create table if not exists public.marketing_channel_details (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.marketing_channels (id) on delete cascade,
  content_link text,
  image_link text,
  link_nhom jsonb not null default '[]'::jsonb,
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_channel_details_channel_idx on public.marketing_channel_details (channel_id);

comment on table public.marketing_channel_details is 'Nội dung chi tiết theo kênh: link content, ảnh, nhiều link nhóm (JSON mảng chuỗi)';
comment on column public.marketing_channel_details.link_nhom is 'Mảng URL nhóm, ví dụ ["https://facebook.com/groups/a","https://zalo.me/g/b"]';

create or replace function public.marketing_channel_details_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketing_channel_details_set_updated_at on public.marketing_channel_details;
create trigger marketing_channel_details_set_updated_at
before update on public.marketing_channel_details
for each row execute procedure public.marketing_channel_details_set_updated_at();

alter table public.marketing_channel_details enable row level security;

drop policy if exists "anon can read marketing_channel_details" on public.marketing_channel_details;
drop policy if exists "anon can insert marketing_channel_details" on public.marketing_channel_details;
drop policy if exists "anon can update marketing_channel_details" on public.marketing_channel_details;
drop policy if exists "anon can delete marketing_channel_details" on public.marketing_channel_details;

create policy "anon can read marketing_channel_details" on public.marketing_channel_details for select to anon using (true);
create policy "anon can insert marketing_channel_details" on public.marketing_channel_details for insert to anon with check (true);
create policy "anon can update marketing_channel_details" on public.marketing_channel_details for update to anon using (true) with check (true);
create policy "anon can delete marketing_channel_details" on public.marketing_channel_details for delete to anon using (true);
