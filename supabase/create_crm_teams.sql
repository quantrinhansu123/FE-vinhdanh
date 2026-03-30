-- Bảng Team (Module 2) — CRM Admin /crm-admin/teams
-- Cột khớp UI: MÃ TEAM, TÊN TEAM, LEADER, SỐ THÀNH VIÊN, DỰ ÁN PHỤ TRÁCH (uuid trong du_an_ids), DOANH SỐ THÁNG, TRẠNG THÁI
-- Chạy sau create_du_an_table.sql (không bắt buộc FK) + create_employees_table.sql (dùng id nhân sự trong member_ids)

create extension if not exists pgcrypto;

create table if not exists public.crm_teams (
  id uuid primary key default gen_random_uuid(),
  ma_team text unique,
  ten_team text not null,
  leader text,
  so_thanh_vien integer not null default 0 check (so_thanh_vien >= 0),
  member_ids jsonb not null default '[]'::jsonb,
  du_an_ids jsonb not null default '[]'::jsonb,
  doanh_so_thang numeric(18, 2) default 0,
  trang_thai text not null default 'hoat_dong'
    check (trang_thai in ('hoat_dong', 'tam_dung', 'ngung')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_teams_ten_idx on public.crm_teams (ten_team);
create index if not exists crm_teams_trang_thai_idx on public.crm_teams (trang_thai);

comment on table public.crm_teams is 'Team CRM Module 2: thành viên (member_ids), dự án phụ trách (du_an_ids)';
comment on column public.crm_teams.member_ids is 'Mảng uuid nhân sự (public.employees.id)';
comment on column public.crm_teams.du_an_ids is 'Mảng uuid dự án (public.du_an.id)';
comment on column public.crm_teams.so_thanh_vien is 'Nên đồng bộ với số phần tử member_ids khi lưu từ app';

create or replace function public.crm_teams_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_teams_set_updated_at on public.crm_teams;
create trigger crm_teams_set_updated_at
before update on public.crm_teams
for each row execute procedure public.crm_teams_set_updated_at();

alter table public.crm_teams enable row level security;

drop policy if exists "anon can read crm_teams" on public.crm_teams;
drop policy if exists "anon can insert crm_teams" on public.crm_teams;
drop policy if exists "anon can update crm_teams" on public.crm_teams;
drop policy if exists "anon can delete crm_teams" on public.crm_teams;

create policy "anon can read crm_teams" on public.crm_teams for select to anon using (true);
create policy "anon can insert crm_teams" on public.crm_teams for insert to anon with check (true);
create policy "anon can update crm_teams" on public.crm_teams for update to anon using (true) with check (true);
create policy "anon can delete crm_teams" on public.crm_teams for delete to anon using (true);

insert into public.crm_teams (ma_team, ten_team, leader, so_thanh_vien, member_ids, du_an_ids, doanh_so_thang, trang_thai)
select 'TEAM-A', 'Elite Performance', 'Trần Hoàng', 12, '[]'::jsonb, '[]'::jsonb, 1240000000, 'hoat_dong'
where not exists (select 1 from public.crm_teams where ma_team = 'TEAM-A');

insert into public.crm_teams (ma_team, ten_team, leader, so_thanh_vien, member_ids, du_an_ids, doanh_so_thang, trang_thai)
select 'TEAM-B', 'Growth Hackers', 'Nguyễn Lan', 8, '[]'::jsonb, '[]'::jsonb, 860000000, 'hoat_dong'
where not exists (select 1 from public.crm_teams where ma_team = 'TEAM-B');
