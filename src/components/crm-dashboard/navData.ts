import { Role, NavGroup } from './types';

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Tổng quan',
    items: [
      { id: 'admin-dash', label: 'Dashboard', icon: '📊' },
      { id: 'burn-detect', label: 'Phát hiện đốt tiền', icon: '🔥' },
      { id: 'alerts', label: 'Cảnh báo hệ thống', icon: '🚨' },
    ]
  },
  {
    label: 'Quản lý',
    items: [
      { id: 'projects', label: 'Dự án (Module 1)', icon: '📁' },
      { id: 'project-qc-excel', label: 'Dữ liệu QC Excel', icon: '📊' },
      { id: 'teams', label: 'Team (Module 2)', icon: '👥' },
      { id: 'staff', label: 'Nhân sự (Module 3)', icon: '👤' },
      { id: 'ad-accounts', label: 'TK Ads (Module 4)', icon: '🎯' },
      { id: 'agencies', label: 'Agency (Module 5)', icon: '🏢' },
      { id: 'products', label: 'Sản phẩm', icon: '📦' },
      { id: 'markets', label: 'Thị trường', icon: '🌍' },
    ]
  },
  {
    label: 'Tài chính',
    items: [
      { id: 'budget', label: 'Ngân sách (Module 6)', icon: '💰', badge: { text: '3', type: 'y' } },
      { id: 'reconcile', label: 'Đối chiếu 3 lớp', icon: '⚖️' },
    ]
  },
  {
    label: 'Báo cáo',
    items: [
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
  'admin-dash': 'Dashboard Toàn Hệ Thống',
  'burn-detect': 'Phát hiện Đốt tiền',
  'alerts': 'Cảnh báo Hệ thống',
  'projects': 'Dự án (Module 1)',
  'project-qc-excel': 'Dữ liệu QC Excel (dự án)',
  'teams': 'Team (Module 2)',
  'staff': 'Nhân sự (Module 3)',
  'ad-accounts': 'Tài khoản Ads (Module 4)',
  'agencies': 'Agency (Module 5)',
  'products': 'Sản phẩm',
  'markets': 'Thị trường',
  'budget': 'Ngân sách (Module 6)',
  'reconcile': 'Đối chiếu 3 Lớp',
  'admin-ranking': 'Bảng xếp hạng',
  'compare': 'So sánh tuần/tháng',
  'leader-dash': 'Dashboard Team A',
  'leader-rank': 'Xếp hạng Marketing',
  'heatmap': 'Heatmap Ads/DT',
  'leader-mkt': 'Danh sách Marketing',
  'leader-tkqc': 'Quản lý TKQC',
  'leader-budget': 'Xin Ngân sách',
  'kpi-target': 'KPI Mục tiêu',
  'mkt-dash': 'Dashboard Cá nhân',
  'mkt-report': 'Nhập Báo cáo · Module 7',
  'mkt-bill': 'Bill Hiệu suất',
  'mkt-history': 'Lịch sử Báo cáo',
  'mkt-accounts': 'Tài khoản Ads của tôi'
};
