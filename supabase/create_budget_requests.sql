-- Yêu cầu xin ngân sách (CRM → Ngân sách → Tổng quan ngân sách)
-- Cột: id, ngan_sach_xin, ngay_gio_xin, trang_thai, ly_do_tu_choi, tkqc_account_id → tkqc_accounts
-- Chạy sau create_tkqc_accounts.sql (bảng tkqc_accounts phải tồn tại trước)

create extension if not exists pgcrypto;

create table if not exists public.budget_requests (
  id uuid primary key default gen_random_uuid(),
  ngan_sach_xin numeric(18, 2) not null check (ngan_sach_xin > 0),
  ngay_gio_xin timestamptz not null default now(),
  trang_thai text not null default 'cho_phe_duyet'
    check (trang_thai in ('cho_phe_duyet', 'dong_y', 'tu_choi')),
  ly_do_tu_choi text,
  ghi_chu text,
  tkqc_account_id uuid references public.tkqc_accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_requests_tu_choi_has_reason check (
    trang_thai <> 'tu_choi'
    or (ly_do_tu_choi is not null and length(trim(ly_do_tu_choi)) > 0)
  )
);

create index if not exists budget_requests_trang_thai_idx on public.budget_requests (trang_thai);
create index if not exists budget_requests_ngay_gio_xin_idx on public.budget_requests (ngay_gio_xin desc);

comment on table public.budget_requests is 'Yêu cầu xin ngân sách — trạng thái phê duyệt';
comment on column public.budget_requests.ngan_sach_xin is 'Số tiền xin (VND)';
comment on column public.budget_requests.ngay_gio_xin is 'Thời điểm gửi yêu cầu';
comment on column public.budget_requests.trang_thai is 'cho_phe_duyet | dong_y | tu_choi';
comment on column public.budget_requests.ly_do_tu_choi is 'Bắt buộc khi từ chối';

create or replace function public.budget_requests_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists budget_requests_set_updated_at on public.budget_requests;
create trigger budget_requests_set_updated_at
before update on public.budget_requests
for each row execute procedure public.budget_requests_set_updated_at();

alter table public.budget_requests enable row level security;

drop policy if exists "anon can read budget_requests" on public.budget_requests;
drop policy if exists "anon can insert budget_requests" on public.budget_requests;
drop policy if exists "anon can update budget_requests" on public.budget_requests;
drop policy if exists "anon can delete budget_requests" on public.budget_requests;

create policy "anon can read budget_requests" on public.budget_requests for select to anon using (true);
create policy "anon can insert budget_requests" on public.budget_requests for insert to anon with check (true);
create policy "anon can update budget_requests" on public.budget_requests for update to anon using (true) with check (true);
create policy "anon can delete budget_requests" on public.budget_requests for delete to anon using (true);
