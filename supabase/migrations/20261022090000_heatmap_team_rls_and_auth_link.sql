-- Move browser data requests from the public anon role to Supabase Auth and
-- enforce report visibility with the employee's current team/project scope.

alter table public.employees add column if not exists auth_user_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_auth_user_id_fkey'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end;
$$;

update public.employees e
set auth_user_id = u.id
from auth.users u
where e.auth_user_id is null
  and e.email is not null
  and lower(trim(e.email)) = lower(trim(u.email));

create unique index if not exists employees_auth_user_id_uidx
  on public.employees(auth_user_id)
  where auth_user_id is not null;

create or replace function public.crm_current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.crm_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees e
    where e.auth_user_id = auth.uid()
      and (
        lower(trim(e.email)) = 'upedu2024@gmail.com'
        or lower(trim(coalesce(e.vi_tri, ''))) = 'admin'
        or lower(coalesce(e.vi_tri, '')) like '%quản trị%'
        or lower(coalesce(e.vi_tri, '')) like '%quan tri%'
        or lower(coalesce(e.vi_tri, '')) like '%quantri%'
        or lower(coalesce(e.vi_tri, '')) like '%giám đốc%'
        or lower(coalesce(e.vi_tri, '')) like '%giam doc%'
        or lower(coalesce(e.vi_tri, '')) like '%giamdoc%'
      )
  );
$$;

create or replace function public.crm_is_project_manager()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees e
    where e.auth_user_id = auth.uid()
      and (
        lower(coalesce(e.vi_tri, '')) like '%quản lý dự án%'
        or lower(coalesce(e.vi_tri, '')) like '%quan ly du an%'
        or lower(coalesce(e.vi_tri, '')) like '%project manager%'
        or lower(trim(coalesce(e.vi_tri, ''))) = 'qlda'
      )
  );
$$;

create or replace function public.crm_is_team_leader()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees e
    where e.auth_user_id = auth.uid()
      and (
        lower(coalesce(e.vi_tri, '')) like '%leader%'
        or lower(coalesce(e.vi_tri, '')) like '%trưởng nhóm%'
        or lower(coalesce(e.vi_tri, '')) like '%truong nhom%'
        or lower(coalesce(e.vi_tri, '')) like '%team lead%'
      )
  );
$$;

create or replace function public.crm_allowed_team_names()
returns setof text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_employee public.employees%rowtype;
  v_has_led_team boolean;
begin
  select e.* into v_employee
  from public.employees e
  where e.auth_user_id = auth.uid()
  limit 1;

  if not found then
    return;
  end if;

  if public.crm_is_admin() then
    return query select distinct t.ten_team from public.crm_teams t where nullif(trim(t.ten_team), '') is not null;
    return;
  end if;

  if public.crm_is_project_manager() then
    return query
      select distinct t.ten_team
      from public.crm_teams t
      join public.du_an p
        on jsonb_typeof(coalesce(t.du_an_ids, '[]'::jsonb)) = 'array'
       and t.du_an_ids ? p.id::text
      where nullif(trim(t.ten_team), '') is not null
        and (
          lower(trim(coalesce(p.leader, ''))) = lower(trim(coalesce(v_employee.name, '')))
          or coalesce(p.staff_ids, '[]'::jsonb) @> to_jsonb(v_employee.id::text)
        );
    return;
  end if;

  if public.crm_is_team_leader() then
    select exists (
      select 1 from public.crm_teams t
      where lower(trim(coalesce(t.leader, ''))) = lower(trim(coalesce(v_employee.name, '')))
    ) into v_has_led_team;

    if v_has_led_team then
      return query
        select distinct t.ten_team
        from public.crm_teams t
        where lower(trim(coalesce(t.leader, ''))) = lower(trim(coalesce(v_employee.name, '')))
          and nullif(trim(t.ten_team), '') is not null;
    elsif nullif(trim(coalesce(v_employee.team, '')), '') is not null then
      return next trim(v_employee.team);
    end if;
  end if;
end;
$$;

create or replace function public.crm_employee_in_scope(p_employee_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_employee public.employees%rowtype;
begin
  if p_employee_id is null then
    return false;
  end if;
  if public.crm_is_admin() or p_employee_id = public.crm_current_employee_id() then
    return true;
  end if;

  select e.* into v_employee from public.employees e where e.id = p_employee_id;
  if not found then
    return false;
  end if;

  return exists (
    select 1
    from public.crm_allowed_team_names() allowed(name)
    where (
        exists (
          select 1 from public.crm_teams t
          where lower(trim(t.ten_team)) = lower(trim(allowed.name))
            and case
              when jsonb_typeof(coalesce(t.member_ids, '[]'::jsonb)) = 'array'
                and jsonb_array_length(coalesce(t.member_ids, '[]'::jsonb)) > 0
                then t.member_ids @> to_jsonb(v_employee.id::text)
              else lower(trim(coalesce(v_employee.team, ''))) = lower(trim(allowed.name))
            end
        )
        or (
          lower(trim(coalesce(v_employee.team, ''))) = lower(trim(allowed.name))
          and not exists (
            select 1 from public.crm_teams t
            where lower(trim(t.ten_team)) = lower(trim(allowed.name))
        )
      )
      )
  );
end;
$$;

create or replace function public.crm_can_read_report(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.crm_is_admin()
    or lower(trim(coalesce(p_email, ''))) = (
      select lower(trim(e.email)) from public.employees e where e.auth_user_id = auth.uid() limit 1
    )
    or exists (
      select 1 from public.employees e
      where lower(trim(coalesce(e.email, ''))) = lower(trim(coalesce(p_email, '')))
        and public.crm_employee_in_scope(e.id)
    );
$$;

create or replace function public.crm_can_write_report(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.crm_is_admin()
    or lower(trim(coalesce(p_email, ''))) = (
      select lower(trim(e.email)) from public.employees e where e.auth_user_id = auth.uid() limit 1
    );
$$;

create or replace function public.crm_can_read_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.crm_is_admin()
    or exists (
      select 1 from public.crm_teams t
      join public.crm_allowed_team_names() allowed(name)
        on lower(trim(allowed.name)) = lower(trim(t.ten_team))
      where t.id = p_team_id
    )
    or exists (
      select 1 from public.crm_teams t, public.employees e
      where t.id = p_team_id
        and e.auth_user_id = auth.uid()
        and (
          lower(trim(t.ten_team)) = lower(trim(coalesce(e.team, '')))
          or t.member_ids @> to_jsonb(e.id::text)
        )
    );
$$;

create or replace function public.crm_can_read_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.crm_is_admin()
    or exists (
      select 1
      from public.du_an p, public.employees e
      where p.id = p_project_id
        and e.auth_user_id = auth.uid()
        and (
          lower(trim(coalesce(p.leader, ''))) = lower(trim(coalesce(e.name, '')))
          or coalesce(p.staff_ids, '[]'::jsonb) @> to_jsonb(e.id::text)
          or exists (
            select 1 from public.crm_teams t
            join public.crm_allowed_team_names() allowed(name)
              on lower(trim(allowed.name)) = lower(trim(t.ten_team))
            where t.du_an_ids ? p.id::text
          )
        )
    );
$$;

-- The rest of the CRM still uses direct Supabase queries. Mirror its existing
-- anon policies for authenticated sessions so moving login to Supabase Auth
-- does not break those screens; the four scoped tables below are excluded.
do $$
declare
  v_policy record;
  v_name text;
  v_sql text;
begin
  for v_policy in
    select schemaname, tablename, policyname, permissive, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename not in ('employees', 'detail_reports', 'crm_teams', 'du_an')
      and 'anon' = any(roles::text[])
  loop
    v_name := 'crm_auth_' || substr(md5(v_policy.schemaname || '.' || v_policy.tablename || '.' || v_policy.policyname), 1, 16);
    execute format('drop policy if exists %I on %I.%I', v_name, v_policy.schemaname, v_policy.tablename);
    v_sql := format(
      'create policy %I on %I.%I as %s for %s to authenticated',
      v_name,
      v_policy.schemaname,
      v_policy.tablename,
      v_policy.permissive,
      v_policy.cmd
    );
    if v_policy.qual is not null then
      v_sql := v_sql || format(' using (%s)', v_policy.qual);
    end if;
    if v_policy.with_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_policy.with_check);
    end if;
    execute v_sql;
  end loop;
end;
$$;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('employees', 'detail_reports', 'crm_teams', 'du_an')
  loop
    execute format('drop policy if exists %I on %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  end loop;
end;
$$;

alter table public.employees enable row level security;
alter table public.detail_reports enable row level security;
alter table public.crm_teams enable row level security;
alter table public.du_an enable row level security;

revoke all on public.employees, public.detail_reports, public.crm_teams, public.du_an from public, anon, authenticated;
do $$
declare
  v_column record;
begin
  for v_column in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('employees', 'detail_reports', 'crm_teams', 'du_an')
  loop
    execute format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on public.%2$I from public, anon, authenticated',
      v_column.column_name,
      v_column.table_name
    );
  end loop;
end;
$$;
grant select (id, name, team, score, avatar_url, email, ma_ns, ngay_bat_dau, leader, du_an_ten, vi_tri, so_fanpage, trang_thai)
  on public.employees to authenticated;
grant insert (id, name, team, score, avatar_url, email, ma_ns, ngay_bat_dau, leader, du_an_ten, vi_tri, so_fanpage, trang_thai)
  on public.employees to authenticated;
grant update (name, team, score, avatar_url, email, ma_ns, ngay_bat_dau, leader, du_an_ten, vi_tri, so_fanpage, trang_thai)
  on public.employees to authenticated;
grant delete on public.employees to authenticated;
grant select, insert, update, delete on public.detail_reports to authenticated;
grant select, insert, update, delete on public.crm_teams, public.du_an to authenticated;
grant select, insert, update, delete on public.employees, public.detail_reports, public.crm_teams, public.du_an to service_role;

create policy crm_employees_select_scoped on public.employees
  for select to authenticated
  using (public.crm_employee_in_scope(id));
create policy crm_employees_insert_admin on public.employees
  for insert to authenticated
  with check (public.crm_is_admin());
create policy crm_employees_update_admin on public.employees
  for update to authenticated
  using (public.crm_is_admin())
  with check (public.crm_is_admin());
create policy crm_employees_delete_admin on public.employees
  for delete to authenticated
  using (public.crm_is_admin());

create policy crm_detail_reports_select_scoped on public.detail_reports
  for select to authenticated
  using (public.crm_can_read_report(email));
create policy crm_detail_reports_insert_scoped on public.detail_reports
  for insert to authenticated
  with check (public.crm_can_write_report(email));
create policy crm_detail_reports_update_scoped on public.detail_reports
  for update to authenticated
  using (public.crm_can_write_report(email))
  with check (public.crm_can_write_report(email));
create policy crm_detail_reports_delete_scoped on public.detail_reports
  for delete to authenticated
  using (public.crm_can_write_report(email));

create policy crm_teams_select_scoped on public.crm_teams
  for select to authenticated
  using (public.crm_can_read_team(id));
create policy crm_teams_insert_admin on public.crm_teams
  for insert to authenticated
  with check (public.crm_is_admin());
create policy crm_teams_update_admin on public.crm_teams
  for update to authenticated
  using (public.crm_is_admin())
  with check (public.crm_is_admin());
create policy crm_teams_delete_admin on public.crm_teams
  for delete to authenticated
  using (public.crm_is_admin());

create policy crm_du_an_select_scoped on public.du_an
  for select to authenticated
  using (public.crm_can_read_project(id));
create policy crm_du_an_insert_admin on public.du_an
  for insert to authenticated
  with check (public.crm_is_admin());
create policy crm_du_an_update_admin on public.du_an
  for update to authenticated
  using (public.crm_is_admin())
  with check (public.crm_is_admin());
create policy crm_du_an_delete_admin on public.du_an
  for delete to authenticated
  using (public.crm_is_admin());

drop policy if exists "anon can upload avatars" on storage.objects;
drop policy if exists "anon can update avatars" on storage.objects;
drop policy if exists "anon can delete avatars" on storage.objects;
drop policy if exists "crm admin can upload avatars" on storage.objects;
drop policy if exists "crm admin can update avatars" on storage.objects;
drop policy if exists "crm admin can delete avatars" on storage.objects;
create policy "crm admin can upload avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and public.crm_is_admin());
create policy "crm admin can update avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and public.crm_is_admin())
  with check (bucket_id = 'avatars' and public.crm_is_admin());
create policy "crm admin can delete avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.crm_is_admin());

revoke all on function public.crm_current_employee_id() from public, anon;
revoke all on function public.crm_is_admin() from public, anon;
revoke all on function public.crm_is_project_manager() from public, anon;
revoke all on function public.crm_is_team_leader() from public, anon;
revoke all on function public.crm_allowed_team_names() from public, anon;
revoke all on function public.crm_employee_in_scope(uuid) from public, anon;
revoke all on function public.crm_can_read_report(text) from public, anon;
revoke all on function public.crm_can_write_report(text) from public, anon;
revoke all on function public.crm_can_read_team(uuid) from public, anon;
revoke all on function public.crm_can_read_project(uuid) from public, anon;
grant execute on function public.crm_current_employee_id() to authenticated;
grant execute on function public.crm_is_admin() to authenticated;
grant execute on function public.crm_is_project_manager() to authenticated;
grant execute on function public.crm_is_team_leader() to authenticated;
grant execute on function public.crm_allowed_team_names() to authenticated;
grant execute on function public.crm_employee_in_scope(uuid) to authenticated;
grant execute on function public.crm_can_read_report(text) to authenticated;
grant execute on function public.crm_can_write_report(text) to authenticated;
grant execute on function public.crm_can_read_team(uuid) to authenticated;
grant execute on function public.crm_can_read_project(uuid) to authenticated;

create or replace view public.employee_leaderboard as
  select id, name, team, score, avatar_url, ma_ns
  from public.employees;
revoke all on public.employee_leaderboard from public, anon, authenticated;
grant select on public.employee_leaderboard to authenticated;

comment on column public.employees.auth_user_id is
  'Supabase Auth identity used by RLS; linked on first successful legacy CRM login.';
comment on view public.employee_leaderboard is
  'Safe employee fields used by the signed-in public leaderboard. Password and email fields are excluded.';
