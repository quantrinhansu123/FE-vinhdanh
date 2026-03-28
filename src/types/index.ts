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
}

export type ReportRow = {
  report_date: string;
  name?: string | null;
  email?: string | null;
  team?: string | null;
  product?: string | null;
  market?: string | null;
  ad_account?: string | null;
  ad_cost?: number | null;
  mess_comment_count?: number | null;
  order_count?: number | null;
  revenue?: number | null;
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
  tkqc_accounts?: {
    id: string;
    don_vi: string | null;
    tkqc: string;
    page: string | null;
  } | null;
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

export type DuAnRow = {
  id: string;
  ma_du_an: string | null;
  ten_du_an: string;
  don_vi: string | null;
  mo_ta?: string | null;
  ngan_sach_ke_hoach: number | null;
  chi_phi_marketing_thuc_te?: number | null;
  tong_doanh_so?: number | null;
  ty_le_ads_doanh_so?: number | null;
  ngay_bat_dau?: string | null;
  ngay_ket_thuc?: string | null;
  trang_thai?: string;
};

export type TkqcRow = {
  id: string;
  id_du_an: string;
  ma_tkqc: string;
  ten_tkqc: string | null;
  ten_pae: string | null;
  nen_tang: string | null;
  ngan_sach_phan_bo: number | null;
  chi_phi_thuc_te: number | null;
  tong_doanh_so?: number | null;
  ty_le_ads_doanh_so?: number | null;
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
