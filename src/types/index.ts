/**
 * Centralized TypeScript type definitions for the CRM Mini Ads project.
 */

export interface Employee {
  id: string;
  name: string;
  team: string;
  score: number;
  avatar_url: string | null;
  email?: string;
  pass?: string;
  rank?: number;
  /** CRM Module 3 — staff list */
  ma_ns?: string | null;
  ngay_bat_dau?: string | null;
  leader?: string | null;
  du_an_ten?: string | null;
  /** Vị trí / chức danh (CRM staff) */
  vi_tri?: string | null;
  so_fanpage?: number | null;
  trang_thai?: string | null;
}

export type ReportRow = {
  id?: string;
  report_date: string;
  name?: string | null;
  email?: string | null;
  team?: string | null;
  product?: string | null;
  market?: string | null;
  /** Page / fanpage — migration alter_detail_reports_page_multiline.sql */
  page?: string | null;
  /** Mã TKQC — migration alter_detail_reports_ma_tkqc.sql */
  ma_tkqc?: string | null;
  ad_account?: string | null;
  ad_cost?: number | null;
  mess_comment_count?: number | null;
  order_count?: number | null;
  revenue?: number | null;
  /** Tổng data nhận (form MKT) — cần migration alter_detail_reports_mkt_form.sql */
  tong_data_nhan?: number | null;
  /** Tổng lead (form MKT) */
  tong_lead?: number | null;
  created_at?: string | null;
};

export type ChannelAgg = {
  key: string;
  label: string;
  revenue: number;
  ad_cost: number;
  adsPct: number;
};

export type ProjectRow = {
  project: string;
  agency: string;
  budget: number;
  spend: number;
  diffPct: number;
  adsPct: number;
};

export type ChartGranularity = 'day' | 'week' | 'month' | 'year';

export type UserRole = 'admin' | 'manager' | 'director' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  team: string;
  avatar_url: string | null;
  /** Vị trí nhân sự (employees.vi_tri) — dùng cho rule báo cáo MKT */
  vi_tri?: string | null;
}

export type TkqcAccountRow = {
  id: string;
  tkqc: string;
  page: string | null;
  don_vi: string | null;
  employee_id?: string | null;
  ngan_sach: number | null;
  tong_chi: number | null;
  doanh_so: number | null;
  so_mess: number | null;
  so_don: number | null;
};

export type BudgetRequestStatus = 'cho_phe_duyet' | 'dong_y' | 'tu_choi';

export type BudgetRequestRow = {
  id: string;
  ngan_sach_xin: number;
  ngay_gio_xin: string;
  trang_thai: BudgetRequestStatus;
  ly_do_tu_choi: string | null;
  ghi_chu: string | null;
  tkqc_account_id: string | null;
  tkqc_id?: string | null;
  created_at?: string;
  updated_at?: string;
  tkqc_accounts?: {
    id: string;
    don_vi: string | null;
    tkqc: string;
    page: string | null;
  } | null;
  /** Embed khi có cột tkqc_id + FK tới public.tkqc */
  tkqc?: {
    id: string;
    ma_tkqc: string;
    ten_pae: string | null;
    du_an?: { ten_du_an: string; don_vi: string | null } | null;
  } | null;
};

/** Leader KPI mục tiêu tháng — bảng kpi_team_monthly_targets */
export type KpiTeamMonthlyTargetRow = {
  id: string;
  nam_thang: string;
  team_key: string;
  muc_tieu_doanh_thu_team: number;
};

/** Leader KPI mục tiêu tháng — bảng kpi_staff_monthly_targets */
export type KpiStaffMonthlyTargetRow = {
  id: string;
  nam_thang: string;
  employee_id: string;
  muc_tieu_vnd: number;
};

export type CrmRevenueAreaPoint = { label: string; revenue: number };

export type MarketingCampaignRow = {
  id: string;
  ma_chien_dich: string | null;
  ten_chien_dich: string;
  mo_ta: string | null;
  nen_tang: string | null;
  ngay_bat_dau: string | null;
  ngay_ket_thuc: string | null;
  trang_thai: string;
};

export type CampaignTkqcLink = {
  id: string;
  campaign_id: string;
  tkqc_account_id: string;
  ngan_sach_gan: number | null;
  chi_phi_thuc_te: number | null;
  ghi_chu: string | null;
  tkqc_accounts?: { tkqc: string; page: string | null; don_vi: string | null } | null;
};

export type MarketingChannelRow = {
  id: string;
  loai_kenh: string;
  link_kenh: string | null;
  noi_dung: string | null;
  chi_phi: number | null;
  so_lead: number | null;
  so_don: number | null;
};

export type MarketingChannelDetailRow = {
  id: string;
  channel_id: string;
  content_link: string | null;
  image_link: string | null;
  link_nhom: unknown;
  ghi_chu: string | null;
};

/** Import Excel QC (Meta) — bảng public.du_an_qc_excel_rows */
export type DuAnQcExcelRow = {
  id: string;
  du_an_id: string | null;
  ten_tai_khoan: string | null;
  ten_quang_cao: string | null;
  ngay: string | null;
  don_vi_tien_te: string | null;
  so_tien_chi_tieu_vnd: number | null;
  chi_phi_mua: number | null;
  cpm: number | null;
  ctr_tat_ca: string | null;
  luot_tro_chuyen_tin_nhan: number | null;
  cpc: number | null;
  bao_cao_tu: string | null;
  bao_cao_den: string | null;
  source_file: string | null;
  created_at: string | null;
};

export type DuAnRow = {
  id: string;
  ma_du_an: string | null;
  ten_du_an: string;
  don_vi: string | null;
  mo_ta?: string | null;
  /** UI: THỊ TRƯỜNG */
  thi_truong?: string | null;
  /** UI: LEADER */
  leader?: string | null;
  /** UI: MKT (số lượng) */
  so_mkt?: number | null;
  ngan_sach_ke_hoach: number | null;
  chi_phi_marketing_thuc_te?: number | null;
  tong_doanh_so?: number | null;
  /** UI: DT THÁNG (VND) */
  doanh_thu_thang?: number | null;
  ty_le_ads_doanh_so?: number | null;
  ngay_bat_dau?: string | null;
  ngay_ket_thuc?: string | null;
  trang_thai?: string;
  /** Danh sách nhân sự trong dự án (jsonb) */
  staff_ids?: string[] | null;
};

/** Agency CRM Module 5 — bảng public.crm_agencies */
export type CrmAgencyRow = {
  id: string;
  ma_agency: string;
  ten_agency: string;
  lien_he?: string | null;
  telegram?: string | null;
  tk_cung_cap?: string | null;
  du_an?: string | null;
  tong_da_nap?: number | null;
  cong_no?: number | null;
  trang_thai?: string;
  created_at?: string;
  updated_at?: string;
};

/** Sản phẩm — bảng public.crm_products */
export type CrmProductRow = {
  id: string;
  ma_san_pham: string;
  ten_san_pham: string;
  mo_ta?: string | null;
  danh_muc?: string | null;
  gia_ban?: number | null;
  don_vi_tinh?: string | null;
  id_du_an?: string | null;
  trang_thai?: string;
  created_at?: string;
  updated_at?: string;
  du_an?: { id: string; ma_du_an: string | null; ten_du_an: string } | null;
};

/** Thị trường — bảng public.crm_markets */
export type CrmMarketRow = {
  id: string;
  ma_thi_truong: string;
  ten_thi_truong: string;
  mo_ta?: string | null;
  trang_thai?: string;
  created_at?: string;
  updated_at?: string;
};

/** Team CRM Module 2 — bảng public.crm_teams */
export type CrmTeamRow = {
  id: string;
  ma_team: string | null;
  ten_team: string;
  leader: string | null;
  so_thanh_vien: number | null;
  member_ids?: string[] | null;
  du_an_ids?: string[] | null;
  doanh_so_thang?: number | null;
  trang_thai?: string;
  created_at?: string;
  updated_at?: string;
};

export type TkqcRow = {
  id: string;
  id_du_an: string;
  ma_tkqc: string;
  ten_tkqc: string | null;
  /** Tên quảng cáo (ad name) — cột ten_quang_cao */
  ten_quang_cao?: string | null;
  ten_pae: string | null;
  nen_tang: string | null;
  ngan_sach_phan_bo: number | null;
  chi_phi_thuc_te: number | null;
  tong_doanh_so?: number | null;
  ty_le_ads_doanh_so?: number | null;
  id_marketing_staff?: string | null;
  /** Ngày bắt đầu TK (ưu tiên hơn du_an.ngay_bat_dau trên UI) */
  ngay_bat_dau?: string | null;
  /** Team CRM (crm_teams.id) */
  id_crm_team?: string | null;
  /** Active | Thiếu thiết lập */
  trang_thai_tkqc?: 'active' | 'thieu_thiet_lap' | null;
  /** Agency / đơn vị QC (ưu tiên hơn du_an.don_vi khi hiển thị) */
  agency?: string | null;
};

/** Module 4 — danh sách TKQC với embed Supabase */
export type TkqcAdListRow = TkqcRow & {
  du_an?: {
    id: string;
    ma_du_an: string | null;
    ten_du_an: string;
    don_vi: string | null;
    ngay_bat_dau: string | null;
    trang_thai: string;
  } | null;
  marketing_staff?: {
    id_ns: string;
    name: string;
  } | null;
};

export interface StaffRecord {
  name: string;
  email: string;
  team: string;
  id_ns: string;
  branch: string;
}

export interface DraftReportRow {
  name: string;
  email: string;
  report_date: string;
  product: string;
  market: string;
  ad_account: string;
  ad_cost: string;
  mess_comment_count: string;
  order_count: string;
  revenue: string;
  team: string;
}

export type ReportModalVariant = 'modal' | 'embedded';

export interface SearchTerm {
  id: number;
  term: string;
  matchType: string;
  conversions: number;
  costPerConv: string;
  convRate: string;
  cost: string;
  clicks: number;
  avgCPC: string;
  ctr: string;
  impressions: number;
  avgCPM: string;
}

export interface EmployeeReport {
  name: string;
  email: string;
  team: string;
  totalRevenue: number;
  totalData: number;
  closedData: number;
  unclosedData: number;
  adsCost: number;
  adsPerClosed: number;
  adsPerRevenue: number;
}

export interface AdsMetrics {
  team: string;
  name: string;
  email: string;
  soMess: number; // Số Mess
  cpqc: number; // CPQC (Cost Per Qualified Contact)
  soDon: number; // Số Đơn
  soDonTT: number; // Số Đơn (TT)
  dsChot: number; // DS Chốt
  dsChotTT: number; // DS Chốt (TT)
  tiLeChot: number; // Tỉ lệ chốt (%)
  tiLeChotTT: number; // Tỉ lệ chốt (TT) (%)
  giaMess: number; // Giá Mess
  cps: number; // CPS (Cost Per Sale)
  cpds: number; // %CP/DS
  giaTBDon: number; // Giá TB Đơn
}
