-- Bổ sung cột cho CRM Module 3 — Quản lý Nhân sự (/crm-admin/staff)
--
-- Nếu public.employees chưa tồn tại: script chỉ ghi NOTICE và thoát (không lỗi).
--   → Chạy supabase/create_employees_table.sql (bản mới đã gồm cột CRM; khi đó thường không cần file alter này).
-- File alter này chỉ dùng cho DB cũ đã có employees nhưng thiếu cột CRM.

do $body$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'employees'
  ) then
    raise notice
      'alter_employees_crm_staff_ui: bỏ qua — public.employees chưa tồn tại. Chạy supabase/create_employees_table.sql trước (hoặc bỏ qua nếu create đã có đủ cột).';
    return;
  end if;

  alter table public.employees add column if not exists ma_ns text;
  alter table public.employees add column if not exists ngay_bat_dau date;
  alter table public.employees add column if not exists leader text;
  alter table public.employees add column if not exists du_an_ten text;
  alter table public.employees add column if not exists vi_tri text;
  alter table public.employees add column if not exists so_fanpage integer not null default 0
    check (so_fanpage >= 0);
  alter table public.employees add column if not exists trang_thai text not null default 'dang_lam'
    check (trang_thai in ('dang_lam', 'nghi', 'tam_nghi', 'dot_tien'));

  update public.employees set so_fanpage = 0 where so_fanpage is null;
  update public.employees set trang_thai = 'dang_lam' where trang_thai is null;

  create unique index if not exists employees_ma_ns_unique_idx
  on public.employees (ma_ns)
  where ma_ns is not null and length(trim(ma_ns)) > 0;

  comment on column public.employees.ma_ns is 'Mã nhân sự hiển thị CRM (VD: MK-001)';
  comment on column public.employees.ngay_bat_dau is 'Ngày bắt đầu làm việc';
  comment on column public.employees.leader is 'Leader / quản lý trực tiếp (text)';
  comment on column public.employees.du_an_ten is 'Tên dự án gắn (hiển thị cạnh team)';
  comment on column public.employees.vi_tri is 'Vị trí / chức danh (VD: MKT, Leader)';
  comment on column public.employees.so_fanpage is 'Số fanpage phụ trách';
  comment on column public.employees.trang_thai is 'dang_lam | nghi | tam_nghi | dot_tien';
end
$body$;
