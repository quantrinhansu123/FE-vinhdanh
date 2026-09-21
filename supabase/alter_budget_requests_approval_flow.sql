-- Luồng duyệt ngân sách nhiều bước: Giám đốc → Kế toán → Giải ngân
-- Chạy khi gặp lỗi: column budget_requests.giam_doc_da_duyet does not exist
-- (FE LeaderBudgetView/BudgetView truy vấn các cột này nhưng schema gốc chưa tạo)
-- Chạy sau create_budget_requests.sql (không phụ thuộc bảng khác).

alter table public.budget_requests add column if not exists giam_doc_da_duyet boolean not null default false;
alter table public.budget_requests add column if not exists giam_doc_duyet_boi text;
alter table public.budget_requests add column if not exists giam_doc_duyet_at timestamptz;

alter table public.budget_requests add column if not exists ke_toan_da_duyet boolean not null default false;
alter table public.budget_requests add column if not exists ke_toan_duyet_boi text;
alter table public.budget_requests add column if not exists ke_toan_duyet_at timestamptz;

alter table public.budget_requests add column if not exists da_giai_ngan boolean not null default false;
alter table public.budget_requests add column if not exists giai_ngan_boi text;
alter table public.budget_requests add column if not exists giai_ngan_at timestamptz;
alter table public.budget_requests add column if not exists anh_giai_ngan_urls text[];

comment on column public.budget_requests.giam_doc_da_duyet is 'Giám đốc đã duyệt (bước 1)';
comment on column public.budget_requests.giam_doc_duyet_boi is 'Người duyệt (giám đốc)';
comment on column public.budget_requests.giam_doc_duyet_at is 'Thời điểm giám đốc duyệt';
comment on column public.budget_requests.ke_toan_da_duyet is 'Kế toán đã duyệt (bước 2)';
comment on column public.budget_requests.ke_toan_duyet_boi is 'Người duyệt (kế toán)';
comment on column public.budget_requests.ke_toan_duyet_at is 'Thời điểm kế toán duyệt';
comment on column public.budget_requests.da_giai_ngan is 'Đã giải ngân (bước 3)';
comment on column public.budget_requests.giai_ngan_boi is 'Người giải ngân';
comment on column public.budget_requests.giai_ngan_at is 'Thời điểm giải ngân';
comment on column public.budget_requests.anh_giai_ngan_urls is 'Ảnh chứng từ giải ngân (Storage), mảng text';
