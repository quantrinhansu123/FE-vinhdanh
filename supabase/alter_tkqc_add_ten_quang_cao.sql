-- Bổ sung cột tên quảng cáo cho bảng tkqc (Module 4 — Danh sách TKQC)
-- Chạy trong Supabase SQL Editor nếu DB đã tạo tkqc trước khi script create_du_an_tkqc.sql có dòng này.

alter table public.tkqc add column if not exists ten_quang_cao text;

comment on column public.tkqc.ten_quang_cao is 'Tên quảng cáo (ad name — vd export Meta)';
