-- Sửa unique index email: chỉ áp dụng khi email có nội dung — tránh nhiều dòng email = '' gây 409 Conflict
-- Chạy trong Supabase SQL Editor nếu bảng `employees` đã tạo từ bản create_employees_table.sql cũ

drop index if exists public.employees_email_unique_idx;

create unique index if not exists employees_email_unique_idx
on public.employees (lower(trim(email)))
where email is not null and length(trim(email)) > 0;
