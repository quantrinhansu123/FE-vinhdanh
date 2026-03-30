-- (Tùy chọn) Một báo cáo / email / ngày — hỗ trợ upsert .upsert(..., { onConflict: '...' }) từ client
-- Chỉ chạy khi chắc không có bản ghi trùng (email, report_date).
-- Nếu lỗi duplicate, dọn dữ liệu trùng trước.

create unique index if not exists detail_reports_email_lower_report_date_uidx
  on public.detail_reports (lower(trim(email)), report_date);
