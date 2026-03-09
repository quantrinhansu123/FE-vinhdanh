-- Create employees table for leaderboard app
create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text not null,
  score integer not null default 0,
  avatar_url text,
  email text,
  pass text
);

alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists pass text;

create unique index if not exists employees_email_unique_idx
on public.employees (lower(email))
where email is not null;

alter table public.employees enable row level security;

-- Re-create policies safely
DROP POLICY IF EXISTS "anon can read employees" ON public.employees;
DROP POLICY IF EXISTS "anon can insert employees" ON public.employees;
DROP POLICY IF EXISTS "anon can update employees" ON public.employees;
DROP POLICY IF EXISTS "anon can delete employees" ON public.employees;

create policy "anon can read employees"
on public.employees
for select
to anon
using (true);

create policy "anon can insert employees"
on public.employees
for insert
to anon
with check (true);

create policy "anon can update employees"
on public.employees
for update
to anon
using (true)
with check (true);

create policy "anon can delete employees"
on public.employees
for delete
to anon
using (true);

-- Optional seed data
insert into public.employees (name, team, score, avatar_url)
values
  ('Nguyen Van A', 'Sale 1', 1200, null),
  ('Tran Thi B', 'Sale 2', 980, null),
  ('Le Van C', 'Sale 3', 860, null)
on conflict do nothing;

update public.employees
set name = 'System Admin',
    team = 'Admin',
    pass = '123456'
where lower(email) = lower('upedu2024@gmail.com');

insert into public.employees (name, team, score, avatar_url, email, pass)
select 'System Admin', 'Admin', 0, null, 'upedu2024@gmail.com', '123456'
where not exists (
  select 1 from public.employees where lower(email) = lower('upedu2024@gmail.com')
);

-- Create public storage bucket for employee avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public,
    name = excluded.name;

-- Re-create storage policies safely
DROP POLICY IF EXISTS "public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "anon can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "anon can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "anon can delete avatars" ON storage.objects;

create policy "public can view avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

create policy "anon can upload avatars"
on storage.objects
for insert
to anon
with check (bucket_id = 'avatars');

create policy "anon can update avatars"
on storage.objects
for update
to anon
using (bucket_id = 'avatars')
with check (bucket_id = 'avatars');

create policy "anon can delete avatars"
on storage.objects
for delete
to anon
using (bucket_id = 'avatars');
