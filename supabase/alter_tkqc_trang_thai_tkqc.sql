-- Cột trang_thai_tkqc đã được gộp vào: supabase/alter_tkqc_team_ngay_bat_dau.sql
-- → Khuyến nghị: chạy TOÀN BỘ file alter_tkqc_team_ngay_bat_dau.sql (một lần).
--
-- Nếu chỉ thiếu đúng cột trang_thai_tkqc, chạy đoạn dưới (bảng public.tkqc phải đã tồn tại).

alter table public.tkqc add column if not exists trang_thai_tkqc text default 'active';

update public.tkqc set trang_thai_tkqc = 'active' where trang_thai_tkqc is null;

alter table public.tkqc alter column trang_thai_tkqc set default 'active';

alter table public.tkqc alter column trang_thai_tkqc set not null;

alter table public.tkqc drop constraint if exists tkqc_trang_thai_tkqc_check;
alter table public.tkqc add constraint tkqc_trang_thai_tkqc_check
  check (trang_thai_tkqc in ('active', 'thieu_thiet_lap'));

comment on column public.tkqc.trang_thai_tkqc is 'UI: Active | Thiếu thiết lập (active | thieu_thiet_lap)';
