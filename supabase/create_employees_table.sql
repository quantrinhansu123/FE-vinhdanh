-- Safe employees schema for the leaderboard and CRM staff screen.
-- Run in Supabase SQL Editor for a new personal project or to harden an older table.
-- Login credentials belong in Supabase Auth. Existing legacy pass columns are left
-- untouched by this setup script so they can be migrated before a separate cleanup.

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text not null default '',
  score integer not null default 0,
  avatar_url text,
  email text,
  ma_ns text,
  ngay_bat_dau date,
  leader text,
  du_an_ten text,
  vi_tri text,
  so_fanpage integer not null default 0 check (so_fanpage >= 0),
  trang_thai text not null default 'dang_lam' check (trang_thai in ('dang_lam', 'nghi', 'tam_nghi', 'dot_tien')),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists ma_ns text;
alter table public.employees add column if not exists ngay_bat_dau date;
alter table public.employees add column if not exists leader text;
alter table public.employees add column if not exists du_an_ten text;
alter table public.employees add column if not exists vi_tri text;
alter table public.employees add column if not exists so_fanpage integer not null default 0;
alter table public.employees add column if not exists trang_thai text not null default 'dang_lam';
alter table public.employees add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table public.employees add column if not exists created_at timestamptz not null default now();
alter table public.employees add column if not exists updated_at timestamptz not null default now();

update public.employees set so_fanpage = 0 where so_fanpage is null;
update public.employees set trang_thai = 'dang_lam' where trang_thai is null;

create unique index if not exists employees_ma_ns_unique_idx
  on public.employees (ma_ns)
  where ma_ns is not null and length(trim(ma_ns)) > 0;

create unique index if not exists employees_email_unique_idx
  on public.employees (lower(trim(email)))
  where email is not null and length(trim(email)) > 0;

alter table public.employees enable row level security;
revoke all on table public.employees from public, anon, authenticated;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'pass'
  ) then
    execute 'revoke select (pass), insert (pass), update (pass), references (pass) on table public.employees from public, anon, authenticated';
  end if;
end $$;
grant select (
  id, name, team, score, avatar_url, email, ma_ns, ngay_bat_dau,
  leader, du_an_ten, vi_tri, so_fanpage, trang_thai, auth_user_id,
  created_at, updated_at
) on table public.employees to authenticated;
grant insert (
  name, team, score, avatar_url, email, ma_ns, ngay_bat_dau,
  leader, du_an_ten, vi_tri, so_fanpage, trang_thai, auth_user_id
) on table public.employees to authenticated;
grant update (
  name, team, score, avatar_url, email, ma_ns, ngay_bat_dau,
  leader, du_an_ten, vi_tri, so_fanpage, trang_thai, auth_user_id
) on table public.employees to authenticated;
grant delete on table public.employees to authenticated;
grant all on table public.employees to service_role;

drop policy if exists "anon can read employees" on public.employees;
drop policy if exists "anon can insert employees" on public.employees;
drop policy if exists "anon can update employees" on public.employees;
drop policy if exists "anon can delete employees" on public.employees;
drop policy if exists employees_authenticated_read on public.employees;
drop policy if exists employees_admin_insert on public.employees;
drop policy if exists employees_admin_update on public.employees;
drop policy if exists employees_admin_delete on public.employees;

create policy employees_authenticated_read
  on public.employees for select to authenticated using (true);
create policy employees_admin_insert
  on public.employees for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy employees_admin_update
  on public.employees for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy employees_admin_delete
  on public.employees for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

comment on table public.employees is
  'Employee leaderboard and CRM data. Login credentials are managed by Supabase Auth, never stored here.';
comment on column public.employees.auth_user_id is
  'Optional link to the matching Supabase Auth user; email remains the login lookup fallback.';

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can view avatars" on storage.objects;
drop policy if exists "anon can upload avatars" on storage.objects;
drop policy if exists "anon can update avatars" on storage.objects;
drop policy if exists "anon can delete avatars" on storage.objects;
drop policy if exists employees_admin_upload_avatars on storage.objects;
drop policy if exists employees_admin_update_avatars on storage.objects;
drop policy if exists employees_admin_delete_avatars on storage.objects;

create policy "public can view avatars"
  on storage.objects for select to public using (bucket_id = 'avatars');
create policy employees_admin_upload_avatars
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy employees_admin_update_avatars
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (bucket_id = 'avatars' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy employees_admin_delete_avatars
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
