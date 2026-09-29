import { Role, NavGroup } from './types';

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Tổng quan',
    items: [
      { id: 'admin-dash', label: 'Dashboard', icon: '📊' },
      { id: 'mkt-dash', label: 'Dashboard C\u00e1 nh\u00e2n', icon: '' },
      { id: 'leader-dash', label: 'Dashboard team', icon: '' },
      { id: 'burn-detect', label: 'Phát hiện đốt tiền', icon: '🔥' },
      { id: 'alerts', label: 'Cảnh báo hệ thống', icon: '🚨' },
    ]
  },
  {
    label: 'Quản lý',
    items: [
      { id: 'projects', label: 'Dự án', icon: '📁' },
      { id: 'teams', label: 'Team', icon: '👥' },
      { id: 'staff', label: 'Nhân sự', icon: '👤' },
      { id: 'ad-accounts', label: 'TK Ads', icon: '🎯' },
      { id: 'kpis', label: 'KPIs', icon: '📊' },
      { id: 'agencies', label: 'Agency', icon: '🏢' },
      { id: 'products', label: 'Sản phẩm', icon: '📦' },
      { id: 'markets', label: 'Thị trường', icon: '🌍' },
    ]
  },
  {
    label: 'Tài chính',
    items: [
      { id: 'budget', label: 'Ngân sách', icon: '💰', badge: { text: '3', type: 'y' } },
      { id: 'reconcile', label: 'Đối chiếu 3 lớp', icon: '⚖️' },
    ]
  },
  {
    label: 'Báo cáo',
    items: [
      { id: 'upcare-mkt', label: 'MKT Fabico (API)', icon: '🌐' },
      { id: 'project-qc-excel', label: 'Dữ liệu QC Excel (Mã NV)', icon: '📊' },
      { id: 'reports-raw', label: 'Bảng detail_reports', icon: '🧾' },
      { id: 'admin-ranking', label: 'Bảng xếp hạng', icon: '🏆' },
      { id: 'compare', label: 'So sánh tuần/tháng', icon: '📈' },
    ]
  }
];

export const LEADER_NAV: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { id: 'leader-dash', label: 'Team Overview', icon: '📊' },
      { id: 'leader-rank', label: 'Xếp hạng', icon: '🏆' },
      { id: 'heatmap', label: 'Heatmap Ads/DT', icon: '🌡️' },
    ]
  },
  {
    label: 'Quản lý',
    items: [
      { id: 'leader-mkt', label: 'Marketing', icon: '👤' },
      { id: 'leader-tkqc', label: 'Quản lý TKQC', icon: '📣' },
      { id: 'leader-budget', label: 'Xin ngân sách', icon: '💰' },
      { id: 'kpi-target', label: 'KPI Mục tiêu', icon: '🎯' },
    ]
  }
];

/** Menu MAP gọn cho khu vực marketing và quản lý team. */
export const MAP_NAV: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { id: 'mkt-dash', label: 'Dashboard cá nhân', icon: '' },
      { id: 'leader-dash', label: 'Dashboard team', icon: '' },
      { id: 'heatmap', label: 'Chỉ số bán hàng', icon: '' },
    ],
  },
];

export const MKT_NAV: NavGroup[] = [
  {
    label: 'Của tôi',
    items: [
      { id: 'mkt-dash', label: 'Dashboard cá nhân', icon: '📊' },
      { id: 'mkt-report', label: 'Nhập báo cáo', icon: '✏️' },
      { id: 'mkt-bill', label: 'Bill hiệu suất', icon: '📋' },
      { id: 'mkt-history', label: 'Lịch sử', icon: '📅' },
    ]
  },
  {
    label: 'Tài khoản',
    items: [
      { id: 'mkt-accounts', label: 'TK Ads của tôi', icon: '🎯' },
    ]
  }
];

export const VIEW_TITLES: Record<string, string> = {
  'admin-dash': 'Dashboard cá nhân',
  'burn-detect': 'Phát hiện Đốt tiền',
  'alerts': 'Cảnh báo Hệ thống',
  'projects': 'Dự án',
  'project-qc-excel': 'Dữ liệu QC Excel (Mã NV)',
  'teams': 'Team',
  'staff': 'Nhân sự',
  'ad-accounts': 'Agency Control Center',
  'kpis': 'KPIs',
  'agencies': 'Agency Ecosystem',
  'products': 'Quản lý Sản phẩm',
  'markets': 'Thị trường',
  'budget': 'Ngân sách',
  'reconcile': 'Đối chiếu 3 Lớp',
  'upcare-mkt': 'MKT Fabico (API)',
  'admin-ranking': 'Bảng xếp hạng',
  'compare': 'So sánh tuần/tháng',
  'leader-dash': 'Dashboard team',
  'leader-rank': 'Xếp hạng Marketing',
  'heatmap': 'Chỉ số bán hàng',
  'leader-mkt': 'Danh sách Marketing',
  'leader-tkqc': 'Quản lý TKQC',
  'leader-budget': 'Xin Ngân sách',
  'kpi-target': 'KPI Mục tiêu',
  'mkt-dash': 'Dashboard cá nhân',
  'mkt-report': 'Nhập Báo cáo · Module 7',
  'mkt-bill': 'Bill Hiệu suất',
  'mkt-history': 'Lịch sử Báo cáo',
  'mkt-accounts': 'Tài khoản Ads của tôi'
};
