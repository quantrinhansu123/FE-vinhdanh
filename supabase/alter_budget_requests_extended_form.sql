-- Form xin ngân sách mở rộng (dự án, agency, CK, hạng mục, chứng từ).
-- Chạy sau create_budget_requests.sql, create_du_an_table.sql, create_crm_agencies.sql.

alter table public.budget_requests
  add column if not exists id_du_an uuid references public.du_an (id) on update cascade on delete set null;

alter table public.budget_requests
  add column if not exists agency_id uuid references public.crm_agencies (id) on update cascade on delete set null;

alter table public.budget_requests add column if not exists ngan_hang text;
alter table public.budget_requests add column if not exists so_tai_khoan text;
alter table public.budget_requests add column if not exists chu_tai_khoan text;
alter table public.budget_requests add column if not exists loai_tien text default 'VND';
alter table public.budget_requests add column if not exists hang_muc_chi_phi text;
alter table public.budget_requests add column if not exists noi_dung_chuyen_khoan text;
alter table public.budget_requests add column if not exists muc_dich_chi_tiet text;
alter table public.budget_requests add column if not exists chung_tu_urls text[];

create index if not exists budget_requests_id_du_an_idx on public.budget_requests (id_du_an);
create index if not exists budget_requests_agency_id_idx on public.budget_requests (agency_id);

comment on column public.budget_requests.id_du_an is 'Dự án áp dụng (form xin ngân sách)';
comment on column public.budget_requests.agency_id is 'Đơn vị thụ hưởng / agency';
comment on column public.budget_requests.ngan_hang is 'Thông tin CK: ngân hàng';
comment on column public.budget_requests.so_tai_khoan is 'Thông tin CK: số TK';
comment on column public.budget_requests.chu_tai_khoan is 'Thông tin CK: chủ TK';
comment on column public.budget_requests.loai_tien is 'Loại tiền (VD: VND)';
comment on column public.budget_requests.hang_muc_chi_phi is 'Hạng mục chi phí';
comment on column public.budget_requests.noi_dung_chuyen_khoan is 'Nội dung chuyển khoản / memo';
comment on column public.budget_requests.muc_dich_chi_tiet is 'Mục đích sử dụng chi tiết';
comment on column public.budget_requests.chung_tu_urls is 'URL file chứng từ (Storage), mảng text';
