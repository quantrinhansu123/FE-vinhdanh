-- Liên kết yêu cầu ngân sách với bảng tkqc (Module 4: du_an + tkqc).
-- Chạy sau create_du_an_tkqc.sql và create_budget_requests.sql (hoặc alter_budget_requests_add_tkqc_fk.sql nếu dùng tkqc_accounts).

alter table public.budget_requests
  add column if not exists tkqc_id uuid references public.tkqc (id) on update cascade on delete set null;

create index if not exists budget_requests_tkqc_id_idx on public.budget_requests (tkqc_id);

comment on column public.budget_requests.tkqc_id is 'Tham chiếu tkqc — tạo yêu cầu từ Leader MKT / Admin';
