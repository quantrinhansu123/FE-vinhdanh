-- Liên kết yêu cầu ngân sách với tkqc_accounts (Dự án = don_vi, TKQC theo dòng)
-- Chạy sau create_tkqc_accounts.sql và create_budget_requests.sql

alter table public.budget_requests
  add column if not exists tkqc_account_id uuid references public.tkqc_accounts (id) on delete set null;

create index if not exists budget_requests_tkqc_account_idx on public.budget_requests (tkqc_account_id);

comment on column public.budget_requests.tkqc_account_id is 'Tham chiếu tkqc_accounts — chọn Dự án (don_vi) + TKQC';
