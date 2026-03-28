/**
 * CRM Mini Ads — Admin dashboard: dữ liệu từ Supabase detail_reports, giao diện theo DashboardAdmin.html
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, X } from 'lucide-react';
import type { Employee } from '../pages/LeaderboardPage';
import { EmployeeTeamAdminPanel } from './EmployeeTeamAdminPanel';
import { AdsAccountsOverview } from './AdsAccountsOverview';
import { AdsTkqcAccountsTable } from './AdsTkqcAccountsTable';
import { BudgetSummaryTable } from './BudgetSummaryTable';
import { ProjectsListTable } from './ProjectsListTable';
import { ProjectsAllocationView } from './ProjectsAllocationView';
import { MarketingChannelsTable } from './MarketingChannelsTable';
import { MarketingCampaignsTable } from './MarketingCampaignsTable';
import { ProgressDashboard } from './ProgressDashboard';
import { ReportModal, type AuthUser as ReportAuthUser } from './ReportModal';
import { GoogleAdsDashboard } from './GoogleAdsDashboard';
import { CrmRevenueAreaChart } from './CrmRevenueAreaChart';
import { supabase } from '../lib/supabase';
import {
  ADS_THRESHOLD_OK,
  ADS_THRESHOLD_WARN,
  aggregateByChannel,
  aggregateByProject,
  aggregateRevenueByPeriod,
  buildSmoothChartPath,
  downloadCsv,
  formatCompactM,
  formatSignedPct,
  formatVnd,
  pctChange,
  plannedBudgetFromRevenue,
  previousDateRange,
  sumReports,
  type ChartGranularity,
  type ProjectRow,
  type ReportRow,
} from './dashboardAdminUtils';

const REPORT_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

const MS_BASE = { fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" as const };
const MS_FILL = { fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" as const };

function MIcon({
  name,
  className = '',
  filled,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span className={`material-symbols-outlined ${className}`.trim()} style={filled ? MS_FILL : MS_BASE}>
      {name}
    </span>
  );
}

type NavChild = { id: string; label: string };
type NavItem = {
  id: string;
  icon: string;
  label: string;
  children?: NavChild[];
};

/** Menu 2 cấp: mục cha + thanh con (sub) */
const NAV: NavItem[] = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', children: [{ id: 'overview', label: 'Tổng quan' }, { id: 'alerts', label: 'Cảnh báo' }] },
  { id: 'projects', icon: 'folder_copy', label: 'Dự án', children: [{ id: 'list', label: 'Danh sách dự án' }, { id: 'allocation', label: 'Phân bổ ngân sách' }] },
  {
    id: 'team',
    icon: 'group',
    label: 'Team',
    children: [
      { id: 'members', label: 'Thành viên' },
      { id: 'progress', label: 'Tiến bộ' },
    ],
  },
  {
    id: 'ads',
    icon: 'ads_click',
    label: 'Tài khoản Ads',
    children: [
      { id: 'overview', label: 'Tổng quan & biểu đồ' },
      { id: 'accounts', label: 'Danh sách TKQC' },
    ],
  },
  { id: 'budget', icon: 'payments', label: 'Ngân sách', children: [{ id: 'summary', label: 'Tổng quan ngân sách' }] },
  {
    id: 'reports',
    icon: 'analytics',
    label: 'Báo cáo',
    children: [
      { id: 'daily', label: 'Báo cáo hàng ngày' },
      { id: 'summary', label: 'Tổng hợp' },
    ],
  },
  { id: 'reconcile', icon: 'account_balance_wallet', label: 'Đối chiếu', children: [{ id: 'table', label: 'Bảng đối chiếu' }, { id: 'history', label: 'Lịch sử chỉnh sửa' }] },
];

const CRM_ADMIN_BASE = '/crm-admin';

/** `/crm-admin/team/members` → `team:members` */
function pathToNavKey(pathname: string): string {
  const rest = pathname.replace(new RegExp(`^${CRM_ADMIN_BASE}/?`), '').split('/').filter(Boolean);
  if (rest.length === 0) return 'dashboard:overview';
  if (rest[0] === 'marketing') {
    if (rest.length === 1) return 'marketing';
    if (rest.length === 2 && (rest[1] === 'channels' || rest[1] === 'campaigns')) return `marketing:${rest[1]}`;
    return 'dashboard:overview';
  }
  if (rest.length === 1) {
    const parent = NAV.find((n) => n.id === rest[0]);
    if (!parent) return 'dashboard:overview';
    return rest[0];
  }
  const parent = NAV.find((n) => n.id === rest[0]);
  const child = parent?.children?.find((c) => c.id === rest[1]);
  if (!parent || !child) return 'dashboard:overview';
  return `${rest[0]}:${rest[1]}`;
}

function isValidCrmAdminPath(pathname: string): boolean {
  if (!pathname.startsWith(CRM_ADMIN_BASE)) return false;
  const rest = pathname.replace(new RegExp(`^${CRM_ADMIN_BASE}/?`), '').split('/').filter(Boolean);
  if (rest.length === 0) return true;
  if (rest[0] === 'marketing') {
    if (rest.length === 1) return true;
    if (rest.length === 2) return rest[1] === 'channels' || rest[1] === 'campaigns';
    return false;
  }
  if (rest.length === 1) return NAV.some((n) => n.id === rest[0]);
  if (rest.length === 2) {
    const p = NAV.find((n) => n.id === rest[0]);
    return Boolean(p?.children?.some((c) => c.id === rest[1]));
  }
  return false;
}

/** `team:members` → `/crm-admin/team/members` */
function navKeyToPath(navKey: string): string {
  if (!navKey.includes(':')) {
    return `${CRM_ADMIN_BASE}/${navKey}`;
  }
  const [parent, child] = navKey.split(':');
  return `${CRM_ADMIN_BASE}/${parent}/${child}`;
}

function getNavPlaceholderText(activeNav: string): string | null {
  const parts = activeNav.split(':');
  const parent = NAV.find((n) => n.id === parts[0]);
  if (!parent) return null;
  if (parent.id === 'dashboard' || parent.id === 'reconcile') return null;
  if (activeNav === 'ads:overview') return null;
  if (activeNav === 'ads:accounts') return null;
  if (activeNav === 'budget:summary') return null;
  if (activeNav === 'projects:list') return null;
  if (activeNav === 'projects:allocation') return null;
  if (activeNav === 'marketing:channels') return null;
  if (activeNav === 'marketing:campaigns') return null;
  if (activeNav === 'team:progress') return null;
  if (activeNav === 'reports:daily') return null;
  if (parts.length === 1) {
    return parent.children?.length ? `${parent.label} — chọn mục con bên dưới` : null;
  }
  const child = parent.children?.find((c) => c.id === parts[1]);
  return child ? `${parent.label} → ${child.label}` : null;
}

const CHART_PERIODS: { key: 'NGÀY' | 'TUẦN' | 'THÁNG' | 'NĂM'; gran: ChartGranularity }[] = [
  { key: 'NGÀY', gran: 'day' },
  { key: 'TUẦN', gran: 'week' },
  { key: 'THÁNG', gran: 'month' },
  { key: 'NĂM', gran: 'year' },
];

const PAGE_SIZE = 10;

function avatarUrlForLabel(label: string) {
  const safe = encodeURIComponent(label.slice(0, 24) || 'CRM');
  return `https://ui-avatars.com/api/?background=1a2e22&color=4ade80&size=64&name=${safe}`;
}

export interface DashboardAdminProps {
  /** Danh sách nhân viên (Vinh danh) — dùng tại Team → Thành viên */
  employees?: Employee[];
  onEmployeesRefresh?: () => void | Promise<void>;
  onClose?: () => void;
  onLogout?: () => void;
  userName?: string;
  userSubtitle?: string;
  avatarUrl?: string | null;
  /** User đăng nhập — Báo cáo → Báo cáo hàng ngày */
  reportUser?: ReportAuthUser | null;
}

export function DashboardAdmin({
  employees = [],
  onEmployeesRefresh = () => {},
  onClose,
  onLogout,
  userName = 'Admin User',
  userSubtitle = 'Hệ thống cấp cao',
  avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCq4IVGRcDsNW79LSQB6KOK_itTwQjwdyXT1g3NTRY4tK3Xg5TWjwQcenqwvhUbC9YKMoXzIIphIZSdODMCwJywK57DHQelM3IMfgIHVo-35r_S7xeU9MAssW4WuUWGlgDS-p9g8Li04_mufizCVczUnA5rIhJuokNQgTdd3rxvyYEG0auVOSif-1x6BZR-y2Os7yOOqLG5PZKhQYHnmeTFLbNtr8m8L3wbTnkMm3gWMWnt2TIyJ2LT-dLL-BgMX3KN899D7cKqmag',
  reportUser = null,
}: DashboardAdminProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [dateFrom, setDateFrom] = useState(() => {
    const t = new Date();
    t.setDate(1);
    return t.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [chartPeriodKey, setChartPeriodKey] = useState<'NGÀY' | 'TUẦN' | 'THÁNG' | 'NĂM'>('NGÀY');
  const [search, setSearch] = useState('');
  const [activeNav, setActiveNav] = useState<string>(() =>
    typeof window !== 'undefined' ? pathToNavKey(window.location.pathname) : 'dashboard:overview'
  );
  const [expandedNavIds, setExpandedNavIds] = useState<string[]>(['dashboard', 'team']);
  const [page, setPage] = useState(1);

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [prevReports, setPrevReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const prev = previousDateRange(dateFrom, dateTo);

    const [cur, prevR] = await Promise.all([
      supabase.from(REPORT_TABLE).select('*').gte('report_date', dateFrom).lte('report_date', dateTo).order('report_date', { ascending: true }),
      supabase.from(REPORT_TABLE).select('*').gte('report_date', prev.from).lte('report_date', prev.to).order('report_date', { ascending: true }),
    ]);

    if (cur.error) {
      console.error(cur.error);
      setError(cur.error.message || 'Không tải được báo cáo');
      setReports([]);
    } else {
      setReports((cur.data || []) as ReportRow[]);
    }

    if (prevR.error) {
      console.error(prevR.error);
      setPrevReports([]);
    } else {
      setPrevReports((prevR.data || []) as ReportRow[]);
    }

    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { revenue: totalRevenue, adCost: totalAdCost } = useMemo(() => sumReports(reports), [reports]);
  const prevSums = useMemo(() => sumReports(prevReports), [prevReports]);

  const plannedBudget = plannedBudgetFromRevenue(totalRevenue);
  const budgetUsePct = plannedBudget > 0 ? (totalAdCost / plannedBudget) * 100 : 0;
  const adsRatio = totalRevenue > 0 ? (totalAdCost / totalRevenue) * 100 : 0;
  const roas = totalAdCost > 0 ? totalRevenue / totalAdCost : 0;

  const revenueMom = pctChange(totalRevenue, prevSums.revenue);
  const budgetMom = pctChange(plannedBudget, plannedBudgetFromRevenue(prevSums.revenue));

  const chartGran = CHART_PERIODS.find((p) => p.key === chartPeriodKey)?.gran ?? 'day';
  const chartSeries = useMemo(
    () => aggregateRevenueByPeriod(reports, dateFrom, dateTo, chartGran),
    [reports, dateFrom, dateTo, chartGran]
  );
  const chartValues = chartSeries.map((p) => p.revenue);
  const chartPath = useMemo(() => buildSmoothChartPath(chartValues), [chartValues]);

  const channels = useMemo(() => aggregateByChannel(reports), [reports]);
  const topGood = useMemo(() => {
    const withRev = channels.filter((c) => c.revenue > 0);
    const sorted = [...withRev].sort((a, b) => a.adsPct - b.adsPct);
    return sorted.slice(0, 2);
  }, [channels]);
  const topBad = useMemo(() => {
    const withRev = channels.filter((c) => c.revenue > 0);
    const sorted = [...withRev].sort((a, b) => b.adsPct - a.adsPct);
    return sorted.slice(0, 2);
  }, [channels]);

  const projectRows = useMemo(() => aggregateByProject(reports), [reports]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projectRows;
    return projectRows.filter(
      (p) => p.project.toLowerCase().includes(q) || p.agency.toLowerCase().includes(q)
    );
  }, [projectRows, search]);

  const totalProjects = projectRows.length;
  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const pagedRows = filteredProjects.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const pageButtonRange = useMemo(() => {
    const maxBtn = 9;
    if (pageCount <= maxBtn) return Array.from({ length: pageCount }, (_, i) => i + 1);
    let start = Math.max(1, pageSafe - Math.floor(maxBtn / 2));
    let end = Math.min(pageCount, start + maxBtn - 1);
    if (end - start + 1 < maxBtn) start = Math.max(1, end - maxBtn + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pageCount, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo]);

  useEffect(() => {
    const colon = activeNav.indexOf(':');
    if (colon > 0) {
      const parentId = activeNav.slice(0, colon);
      setExpandedNavIds((prev) => (prev.includes(parentId) ? prev : [...prev, parentId]));
    }
  }, [activeNav]);

  /** Chuẩn hóa URL: /crm-admin → mặc định; path lạ → về dashboard */
  useEffect(() => {
    const p = location.pathname;
    if (!p.startsWith(CRM_ADMIN_BASE)) return;
    if (p === CRM_ADMIN_BASE || p === `${CRM_ADMIN_BASE}/`) {
      navigate(`${CRM_ADMIN_BASE}/dashboard/overview`, { replace: true });
      return;
    }
    if (p === `${CRM_ADMIN_BASE}/ads` || p === `${CRM_ADMIN_BASE}/ads/`) {
      navigate(`${CRM_ADMIN_BASE}/ads/overview`, { replace: true });
      return;
    }
    if (p === `${CRM_ADMIN_BASE}/marketing` || p === `${CRM_ADMIN_BASE}/marketing/`) {
      navigate(`${CRM_ADMIN_BASE}/marketing/channels`, { replace: true });
      return;
    }
    if (p === `${CRM_ADMIN_BASE}/team` || p === `${CRM_ADMIN_BASE}/team/`) {
      navigate(`${CRM_ADMIN_BASE}/team/members`, { replace: true });
      return;
    }
    if (p === `${CRM_ADMIN_BASE}/reports` || p === `${CRM_ADMIN_BASE}/reports/`) {
      navigate(`${CRM_ADMIN_BASE}/reports/daily`, { replace: true });
      return;
    }
    if (!isValidCrmAdminPath(p)) {
      navigate(`${CRM_ADMIN_BASE}/dashboard/overview`, { replace: true });
    }
  }, [location.pathname, navigate]);

  /** Đồng bộ sidebar / nội dung với URL */
  useEffect(() => {
    setActiveNav(pathToNavKey(location.pathname));
  }, [location.pathname]);

  /** Cuộn tới khối nội dung khi đổi route */
  useEffect(() => {
    if (activeNav === 'team:members') {
      document.getElementById('crm-team-members')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'team:progress') {
      document.getElementById('crm-team-progress')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'ads:overview') {
      document.getElementById('crm-ads-overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'ads:accounts') {
      document.getElementById('crm-ads-tkqc-accounts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'budget:summary') {
      document.getElementById('crm-budget-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'projects:list') {
      document.getElementById('crm-projects-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'projects:allocation') {
      document.getElementById('crm-projects-allocation')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'marketing:channels') {
      document.getElementById('crm-marketing-channels')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'marketing:campaigns') {
      document.getElementById('crm-marketing-campaigns')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'reports:daily') {
      document.getElementById('crm-reports-daily')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'dashboard:overview') {
      document.getElementById('crm-dash-google-ads')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const base = activeNav.split(':')[0];
    if (base === 'reconcile') {
      document.getElementById('crm-dash-reconcile')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (base === 'dashboard') {
      document.getElementById('crm-dash-kpi')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    document.getElementById('crm-dash-placeholder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeNav]);

  function rowStatus(p: ProjectRow): {
    icon: 'check_circle' | 'error' | 'dangerous';
    filled: boolean;
    iconClass: string;
    rowHover: string;
    warnRow: boolean;
  } {
    if (p.adsPct >= ADS_THRESHOLD_WARN || p.diffPct > 5) {
      return {
        icon: 'dangerous',
        filled: true,
        iconClass: 'text-crm-error drop-shadow-[0_0_10px_rgba(248,113,113,0.45)]',
        rowHover: 'bg-crm-error/5 hover:bg-crm-error/10',
        warnRow: true,
      };
    }
    if (p.adsPct >= ADS_THRESHOLD_OK || p.diffPct > 0) {
      return {
        icon: 'error',
        filled: false,
        iconClass: 'text-crm-warning',
        rowHover: 'hover:bg-crm-warning/5',
        warnRow: false,
      };
    }
    return {
      icon: 'check_circle',
      filled: true,
      iconClass: 'text-crm-success drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]',
      rowHover: 'hover:bg-crm-primary/5',
      warnRow: false,
    };
  }

  function adsBadgeClass(p: ProjectRow): string {
    if (p.adsPct >= ADS_THRESHOLD_WARN) return 'bg-crm-error text-crm-surface shadow-[0_0_14px_rgba(248,113,113,0.35)] border-0';
    if (p.adsPct >= ADS_THRESHOLD_OK) return 'bg-crm-warning/10 text-crm-warning border-crm-warning/20';
    return 'bg-crm-success/10 text-crm-success border-crm-success/20';
  }

  const handleExportExcel = () => {
    const headers = ['Tên dự án', 'Đơn vị', 'Ngân sách (ước tính)', 'Chi tiêu thực', 'Chênh lệch %', '% Ads/DS'];
    const rows = filteredProjects.map((p) => [
      p.project,
      p.agency,
      `${p.budget}`,
      `${p.spend}`,
      `${p.diffPct.toFixed(2)}`,
      `${p.adsPct.toFixed(2)}`,
    ]);
    downloadCsv(`doi-chieu-${dateFrom}-${dateTo}.csv`, headers, rows);
  };

  const scrollToSection = (navKey: string) => {
    navigate(navKeyToPath(navKey));
  };

  const toggleNavExpand = (parentId: string) => {
    setExpandedNavIds((prev) => (prev.includes(parentId) ? prev.filter((x) => x !== parentId) : [...prev, parentId]));
  };

  const placeholderHint = getNavPlaceholderText(activeNav);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="crm-admin-theme fixed inset-0 z-[125] font-crm text-crm-on-surface antialiased dark overflow-hidden flex"
      style={{
        fontFamily: 'Plus Jakarta Sans, ui-sans-serif, system-ui',
        backgroundColor: 'var(--color-crm-surface)',
        backgroundImage: `
          radial-gradient(at 0% 0%, color-mix(in srgb, var(--color-crm-primary) 8%, transparent) 0px, transparent 52%),
          radial-gradient(at 100% 0%, color-mix(in srgb, var(--color-crm-secondary) 6%, transparent) 0px, transparent 50%),
          radial-gradient(at 50% 100%, color-mix(in srgb, var(--color-crm-accent-warm) 3%, transparent) 0px, transparent 45%)
        `,
      }}
    >
      <aside className="h-screen w-64 shrink-0 crm-glass-sidebar flex flex-col py-8 z-50">
        <div className="px-8 mb-12">
          <h1 className="text-xl font-extrabold tracking-tighter uppercase italic bg-gradient-to-r from-crm-primary via-crm-secondary to-crm-accent-warm bg-clip-text text-transparent">
            CRM MINI ADS
          </h1>
          <p className="text-[10px] font-bold text-crm-on-surface-variant tracking-[0.2em] mt-1 uppercase">Advanced Core v2.0</p>
        </div>
        <nav className="flex-1 space-y-1 px-2 overflow-y-auto custom-scrollbar">
          {NAV.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const expanded = expandedNavIds.includes(item.id);
            const parentActive =
              activeNav === item.id || (hasChildren && activeNav.startsWith(`${item.id}:`));
            return (
              <div key={item.id} className="space-y-0.5">
                <div
                  className={`flex items-stretch rounded-lg overflow-hidden border border-transparent ${
                    parentActive ? 'border-crm-primary/20 bg-crm-primary/5' : ''
                  }`}
                >
                  <button
                    type="button"
                    className={`flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0 text-left transition-all rounded-l-lg ${
                      parentActive
                        ? 'text-crm-primary crm-nav-active'
                        : 'text-crm-on-surface-variant hover:text-crm-on-surface hover:bg-crm-surface-accent/50'
                    }`}
                    onClick={() => {
                      if (hasChildren) {
                        setExpandedNavIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
                        scrollToSection(`${item.id}:${item.children![0].id}`);
                      } else {
                        scrollToSection(item.id);
                      }
                    }}
                  >
                    <MIcon name={item.icon} className="text-xl shrink-0" />
                    <span className={`text-sm truncate ${parentActive ? 'font-semibold' : 'font-medium'} tracking-wide`}>{item.label}</span>
                  </button>
                  {hasChildren && (
                    <button
                      type="button"
                      className="shrink-0 px-2 flex items-center justify-center text-crm-on-surface-variant hover:text-crm-primary hover:bg-crm-surface-accent/40 rounded-r-lg transition-colors"
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Thu gọn' : 'Mở rộng'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleNavExpand(item.id);
                      }}
                    >
                      <MIcon name="expand_more" className={`text-xl transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {hasChildren && expanded && (
                  <div className="ml-2 pl-3 border-l border-crm-outline/50 space-y-0.5 py-0.5">
                    {item.children!.map((child) => {
                      const childKey = `${item.id}:${child.id}`;
                      const childActive = activeNav === childKey;
                      return (
                        <button
                          key={childKey}
                          type="button"
                          className={`w-full text-left pl-2 pr-2 py-2 rounded-md text-[11px] leading-snug tracking-wide transition-all ${
                            childActive
                              ? 'text-crm-primary font-semibold bg-crm-primary/10 border border-crm-primary/25'
                              : 'text-crm-on-surface-variant font-medium hover:text-crm-on-surface hover:bg-crm-surface-accent/40 border border-transparent'
                          }`}
                          onClick={() => scrollToSection(childKey)}
                        >
                          {child.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto px-4 space-y-2 border-t border-crm-outline/30 pt-6">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 text-crm-on-surface-variant hover:text-crm-on-surface transition-colors" onClick={() => alert('Cài đặt: đang phát triển')}
          >
            <MIcon name="settings" className="text-xl" />
            <span className="text-sm font-medium tracking-wide">Cài đặt</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 text-crm-error/80 hover:text-crm-error transition-colors text-left"
            onClick={() => onLogout?.()}
          >
            <MIcon name="logout" className="text-xl" />
            <span className="text-sm font-medium tracking-wide">Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="shrink-0 min-h-20 bg-crm-surface/50 backdrop-blur-xl z-40 px-6 lg:px-10 flex flex-wrap justify-between items-center border-b border-crm-outline/30 gap-4 py-3">
          <div className="flex items-center gap-4 lg:gap-8 min-w-0 flex-1">
            <div className="hidden sm:flex items-center bg-crm-surface-container border border-crm-outline/50 rounded-xl px-4 py-2 w-full max-w-[320px] focus-within:border-crm-primary/50 transition-all shadow-inner">
              <MIcon name="search" className="text-crm-on-surface-variant text-xl shrink-0" />
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-crm-on-surface-variant/50 ml-2 outline-none"
                placeholder="Tìm kiếm dự án, đơn vị..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="crm-glass-card crm-date-picker-icon flex items-center gap-3 px-4 py-1.5 rounded-xl border border-crm-outline/50 shrink-0">
              <div className="flex flex-col">
                <span className="text-[9px] font-extrabold text-crm-on-surface-variant uppercase tracking-widest leading-none mb-1">Từ ngày</span>
                <input
                  className="bg-transparent border-none p-0 text-xs font-bold text-crm-on-surface focus:ring-0 w-28 outline-none"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="h-6 w-px bg-crm-outline/50" />
              <div className="flex flex-col">
                <span className="text-[9px] font-extrabold text-crm-on-surface-variant uppercase tracking-widest leading-none mb-1">Đến ngày</span>
                <input
                  className="bg-transparent border-none p-0 text-xs font-bold text-crm-on-surface focus:ring-0 w-28 outline-none"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="ml-2 p-1.5 bg-crm-primary/10 hover:bg-crm-primary/20 text-crm-primary rounded-lg transition-colors disabled:opacity-50"
                aria-label="Làm mới"
                disabled={loading}
                onClick={() => fetchData()}
              >
                <MIcon name="refresh" className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 lg:gap-6 shrink-0">
            <div className="hidden md:flex items-center gap-2">
              <button type="button" className="hover:bg-crm-surface-accent rounded-lg p-2.5 transition-all text-crm-on-surface-variant hover:text-crm-primary border border-transparent hover:border-crm-outline" onClick={() => alert('Thông báo: đang phát triển')}>
                <MIcon name="notifications" className="text-xl" />
              </button>
              <button type="button" className="hover:bg-crm-surface-accent rounded-lg p-2.5 transition-all text-crm-on-surface-variant hover:text-crm-primary border border-transparent hover:border-crm-outline" onClick={() => alert('Trợ giúp: báo cáo từ bảng detail_reports, ngân sách = doanh số × 1.15 (ước tính).')}>
                <MIcon name="help_outline" className="text-xl" />
              </button>
            </div>
            <div className="hidden md:block h-8 w-px bg-crm-outline/50 mx-1" />
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-crm-on-surface tracking-tight leading-none">{userName}</p>
                <p className="text-[10px] text-crm-primary font-bold uppercase tracking-[0.1em] mt-1">{userSubtitle}</p>
              </div>
              <div className="relative group shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-crm-primary to-crm-secondary rounded-full opacity-50 group-hover:opacity-100 transition duration-300 blur-sm" />
                <img alt="" className="relative w-11 h-11 rounded-full border border-crm-surface object-cover" src={avatarUrl || undefined} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar pt-8 pb-16 px-6 lg:px-10 relative">
          {loading &&
            activeNav !== 'team:members' &&
            activeNav !== 'team:progress' &&
            activeNav !== 'ads:overview' &&
            activeNav !== 'ads:accounts' &&
            activeNav !== 'budget:summary' &&
            activeNav !== 'projects:list' &&
            activeNav !== 'projects:allocation' &&
            activeNav !== 'marketing:channels' &&
            activeNav !== 'marketing:campaigns' &&
            activeNav !== 'reports:daily' &&
            activeNav !== 'dashboard:overview' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-crm-surface/40 backdrop-blur-sm">
              <Loader2 className="animate-spin text-crm-primary w-10 h-10" />
            </div>
          )}

          {error &&
            activeNav !== 'team:members' &&
            activeNav !== 'team:progress' &&
            activeNav !== 'ads:overview' &&
            activeNav !== 'ads:accounts' &&
            activeNav !== 'budget:summary' &&
            activeNav !== 'projects:list' &&
            activeNav !== 'projects:allocation' &&
            activeNav !== 'marketing:channels' &&
            activeNav !== 'marketing:campaigns' &&
            activeNav !== 'reports:daily' &&
            activeNav !== 'dashboard:overview' && (
            <div className="mb-6 px-4 py-3 rounded-xl border border-crm-error/50 bg-crm-error/10 text-sm text-crm-error">{error}</div>
          )}

          {activeNav === 'team:members' ? (
            <EmployeeTeamAdminPanel employees={employees} onRefresh={onEmployeesRefresh} />
          ) : activeNav === 'team:progress' ? (
            <ProgressDashboard variant="embedded" embeddedRootId="crm-team-progress" />
          ) : activeNav === 'ads:overview' ? (
            <AdsAccountsOverview />
          ) : activeNav === 'ads:accounts' ? (
            <AdsTkqcAccountsTable />
          ) : activeNav === 'budget:summary' ? (
            <BudgetSummaryTable />
          ) : activeNav === 'projects:list' ? (
            <ProjectsListTable />
          ) : activeNav === 'projects:allocation' ? (
            <ProjectsAllocationView />
          ) : activeNav === 'marketing:channels' ? (
            <MarketingChannelsTable />
          ) : activeNav === 'marketing:campaigns' ? (
            <MarketingCampaignsTable />
          ) : activeNav === 'reports:daily' ? (
            <ReportModal variant="embedded" currentUser={reportUser ?? undefined} embeddedRootId="crm-reports-daily" />
          ) : (
            <>
          {activeNav === 'dashboard:overview' ? <GoogleAdsDashboard variant="embedded" /> : null}
          <div id="crm-dash-placeholder" className="mb-6 crm-glass-card rounded-xl border border-crm-outline/30 p-4 text-center text-xs text-crm-on-surface-variant">
            {placeholderHint ? (
              <span>
                Mục <strong className="text-crm-on-surface">{placeholderHint}</strong> — đang phát triển. Dữ liệu tổng hợp hiện tại ở Dashboard & Đối chiếu.
              </span>
            ) : (
              <span>Ngân sách hiển thị là ước tính (doanh số × 1.15) vì bảng không có cột ngân sách kế hoạch.</span>
            )}
          </div>

          <div id="crm-dash-kpi" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            <div className="crm-glass-card p-6 rounded-xl hover:border-crm-primary/50 border border-transparent transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-crm-primary/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-extrabold text-crm-on-surface-variant tracking-[0.15em] uppercase">Tổng Ngân Sách (ước tính)</span>
                <MIcon name="account_balance" className="text-crm-primary group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-3xl font-extrabold text-crm-on-surface tracking-tighter crm-glow-primary">{formatCompactM(plannedBudget)}</h2>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {budgetMom !== null && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      budgetMom >= 0 ? 'text-crm-success bg-crm-success/10 border-crm-success/20' : 'text-crm-error bg-crm-error/10 border-crm-error/20'
                    }`}
                  >
                    {formatSignedPct(budgetMom)}
                  </span>
                )}
                <span className="text-[10px] text-crm-on-surface-variant font-medium">vs kỳ trước</span>
              </div>
            </div>
            <div className="crm-glass-card p-6 rounded-xl hover:border-crm-secondary/50 border border-transparent transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-crm-secondary/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-extrabold text-crm-on-surface-variant tracking-[0.15em] uppercase">Chi Phí Marketing</span>
                <MIcon name="payments" className="text-crm-secondary group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-3xl font-extrabold text-crm-on-surface tracking-tighter">{formatCompactM(totalAdCost)}</h2>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-crm-secondary bg-crm-secondary/10 border border-crm-secondary/20 px-2 py-0.5 rounded-full">
                  {plannedBudget > 0 ? `${budgetUsePct.toFixed(1)}%` : '—'}
                </span>
                <span className="text-[10px] text-crm-on-surface-variant font-medium">Quỹ đã sử dụng</span>
              </div>
            </div>
            <div className="crm-glass-card p-6 rounded-xl hover:border-crm-primary/50 border border-transparent transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-crm-primary/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-extrabold text-crm-on-surface-variant tracking-[0.15em] uppercase">Tổng Doanh Số</span>
                <MIcon name="trending_up" className="text-crm-primary group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-3xl font-extrabold text-crm-on-surface tracking-tighter">{formatCompactM(totalRevenue)}</h2>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {revenueMom !== null && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      revenueMom >= 0 ? 'text-crm-success bg-crm-success/10 border-crm-success/20' : 'text-crm-error bg-crm-error/10 border-crm-error/20'
                    }`}
                  >
                    {formatSignedPct(revenueMom)}
                  </span>
                )}
                <span className="text-[10px] text-crm-on-surface-variant font-medium uppercase tracking-tighter">ROAS: {roas >= 0 ? `${roas.toFixed(2)}x` : '—'}</span>
              </div>
            </div>
            <div className="crm-glass-card p-6 rounded-xl border-crm-error/30 hover:border-crm-error/60 border transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-crm-error/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-extrabold text-crm-on-surface-variant tracking-[0.15em] uppercase">% Ads/Doanh Số</span>
                <MIcon name="warning" className="text-crm-error group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-3xl font-extrabold text-crm-error tracking-tighter drop-shadow-[0_0_12px_rgba(248,113,113,0.35)]">{adsRatio.toFixed(1)}%</h2>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold text-crm-on-surface bg-crm-error px-2 py-0.5 rounded-full uppercase italic">
                  {adsRatio >= ADS_THRESHOLD_WARN ? 'Vượt ngưỡng' : adsRatio >= ADS_THRESHOLD_OK ? 'Cảnh báo' : 'Ổn định'}
                </span>
                <span className="text-[10px] text-crm-on-surface-variant font-medium">Target: {'<'} {ADS_THRESHOLD_OK}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2 crm-glass-card p-8 rounded-2xl relative overflow-hidden border border-crm-outline/30">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-crm-primary via-crm-secondary to-crm-primary opacity-50" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
                <div>
                  <h3 className="text-xl font-bold text-crm-on-surface tracking-tight">Xu hướng Doanh số</h3>
                  <p className="text-xs text-crm-on-surface-variant mt-1">Theo khoảng ngày đã chọn (gom theo {chartPeriodKey.toLowerCase()})</p>
                </div>
                <div className="flex p-1 bg-crm-surface-accent rounded-lg border border-crm-outline/50 flex-wrap">
                  {CHART_PERIODS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setChartPeriodKey(p.key)}
                      className={`text-[10px] font-bold px-3 sm:px-4 py-1.5 rounded-md transition-all ${
                        chartPeriodKey === p.key
                          ? 'bg-crm-primary text-white shadow-[0_0_16px_rgba(34,197,94,0.38)]'
                          : 'text-crm-on-surface-variant hover:text-crm-on-surface'
                      }`}
                    >
                      {p.key}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-full min-h-[200px] flex justify-between gap-2 items-stretch">
                <div className="relative w-full min-h-[200px]">
                  {chartValues.length === 0 ? (
                    <div className="h-[280px] flex items-center justify-center text-crm-on-surface-variant text-sm">
                      Không có dữ liệu doanh số trong khoảng này
                    </div>
                  ) : activeNav === 'dashboard:alerts' ? (
                    <CrmRevenueAreaChart series={chartSeries} />
                  ) : (
                    <svg className="w-full h-[256px]" preserveAspectRatio="none" viewBox="0 0 700 200">
                      <defs>
                        <linearGradient id="crm-glowing-gradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={chartPath.areaD} fill="url(#crm-glowing-gradient)" />
                      <path d={chartPath.lineD} fill="none" stroke="#4ade80" strokeLinecap="round" strokeWidth="3" className="crm-glow-line" />
                      {chartPath.circles.map((c, i) => (
                        <circle key={i} cx={c.cx} cy={c.cy} fill="#93c5fd" r="4" stroke="#0c1220" strokeWidth="2" />
                      ))}
                    </svg>
                  )}
                </div>
              </div>
              {!(activeNav === 'dashboard:alerts' && chartSeries.length > 0) && (
                <div className="flex justify-between mt-6 px-2 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-[0.15em] gap-1 flex-wrap">
                  {chartSeries.length === 0 ? (
                    <span>—</span>
                  ) : (
                    chartSeries.map((p) => (
                      <span key={p.sortKey} className="truncate max-w-[4.5rem]">
                        {p.label}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="crm-glass-card p-6 rounded-2xl border-l-4 border-l-crm-success relative border border-crm-outline/30">
                <h4 className="text-xs font-extrabold text-crm-on-surface mb-5 flex items-center gap-2 tracking-widest uppercase">
                  <MIcon name="workspace_premium" className="text-crm-success text-lg" />
                  Top Marketing Hiệu Quả
                </h4>
                <div className="space-y-5">
                  {topGood.length === 0 ? (
                    <p className="text-xs text-crm-on-surface-variant">Chưa đủ dữ liệu (cần doanh số theo thị trường/sản phẩm)</p>
                  ) : (
                    topGood.map((row) => (
                      <div key={row.key} className="flex items-center justify-between group cursor-default gap-2">
                        <div className="flex items-center gap-4 min-w-0">
                          <img alt="" className="w-8 h-8 rounded-full border border-crm-success/30 object-cover shrink-0" src={avatarUrlForLabel(row.label)} />
                          <span className="text-xs font-semibold text-crm-on-surface tracking-tight truncate">{row.label}</span>
                        </div>
                        <span className="text-xs font-extrabold text-crm-success shrink-0">{row.adsPct.toFixed(0)}% Ads</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="crm-glass-card p-6 rounded-2xl border-l-4 border-l-crm-error relative border border-crm-outline/30">
                <h4 className="text-xs font-extrabold text-crm-on-surface mb-5 flex items-center gap-2 tracking-widest uppercase">
                  <MIcon name="local_fire_department" className="text-crm-error text-lg" />
                  Top Marketing Đốt Tiền
                </h4>
                <div className="space-y-5">
                  {topBad.length === 0 ? (
                    <p className="text-xs text-crm-on-surface-variant">Chưa đủ dữ liệu</p>
                  ) : (
                    topBad.map((row) => (
                      <div key={row.key} className="flex items-center justify-between group cursor-default gap-2">
                        <div className="flex items-center gap-4 min-w-0">
                          <img alt="" className="w-8 h-8 rounded-full border border-crm-error/30 object-cover shrink-0" src={avatarUrlForLabel(row.label)} />
                          <span className="text-xs font-semibold text-crm-on-surface tracking-tight truncate">{row.label}</span>
                        </div>
                        <span className="text-xs font-extrabold text-crm-error shrink-0">{row.adsPct.toFixed(0)}% Ads</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div id="crm-dash-reconcile" className="crm-glass-card rounded-2xl overflow-hidden shadow-2xl border border-crm-outline/30">
            <div className="px-6 lg:px-8 py-6 border-b border-crm-outline/30 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-crm-surface-accent/30">
              <div>
                <h3 className="text-xl font-bold text-crm-on-surface tracking-tight">Đối chiếu Ngân sách vs Chi tiêu</h3>
                <p className="text-xs text-crm-on-surface-variant mt-1">Gom theo dự án (product) trong khoảng ngày — ngân sách ước tính = doanh số × 1.15</p>
              </div>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={filteredProjects.length === 0}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-crm-primary text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(34,197,94,0.32)] hover:shadow-[0_0_28px_rgba(34,197,94,0.48)] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <MIcon name="download" className="text-sm" />
                Xuất Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-crm-surface-accent/20">
                    <th className="px-6 lg:px-8 py-5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-[0.2em]">Tên Dự Án</th>
                    <th className="px-6 lg:px-8 py-5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-[0.2em] text-right">Ngân Sách</th>
                    <th className="px-6 lg:px-8 py-5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-[0.2em] text-right">Chi Tiêu Thực</th>
                    <th className="px-6 lg:px-8 py-5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-[0.2em] text-right">Chênh Lệch</th>
                    <th className="px-6 lg:px-8 py-5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-[0.2em] text-center">% Ads/Doanh Số</th>
                    <th className="px-6 lg:px-8 py-5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-[0.2em] text-right">Tình Trạng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-outline/20">
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-crm-on-surface-variant text-sm">
                        {filteredProjects.length === 0 && projectRows.length > 0 ? 'Không khớp tìm kiếm' : 'Không có dự án trong khoảng ngày'}
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row) => {
                      const st = rowStatus(row);
                      const diffStr = formatSignedPct(row.diffPct);
                      return (
                        <tr key={`${row.project}-${row.agency}`} className={`${st.rowHover} transition-colors group ${st.warnRow ? 'bg-crm-error/5' : ''}`}>
                          <td className="px-6 lg:px-8 py-6">
                            <p className={`text-sm font-bold text-crm-on-surface ${!st.warnRow ? 'group-hover:text-crm-primary transition-colors' : ''}`}>{row.project}</p>
                            <span className="text-[10px] text-crm-on-surface-variant font-bold uppercase tracking-wider opacity-60">{row.agency}</span>
                          </td>
                          <td className="px-6 lg:px-8 py-6 text-sm font-medium text-crm-on-surface text-right">{formatVnd(row.budget)}</td>
                          <td className="px-6 lg:px-8 py-6 text-sm font-medium text-crm-on-surface text-right">{formatVnd(row.spend)}</td>
                          <td className={`px-6 lg:px-8 py-6 text-sm font-extrabold text-right ${row.diffPct > 0 ? 'text-crm-error' : row.diffPct < 0 ? 'text-crm-success' : 'text-crm-on-surface-variant'}`}>
                            {diffStr}
                          </td>
                          <td className="px-6 lg:px-8 py-6 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold border ${adsBadgeClass(row)}`}>{row.adsPct.toFixed(1)}%</span>
                          </td>
                          <td className="px-6 lg:px-8 py-6 text-right">
                            <MIcon name={st.icon} className={st.iconClass} filled={st.filled} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 lg:px-8 py-5 bg-crm-surface-accent/50 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-[0.2em]">
              <span className="text-center sm:text-left">
                HIỂN THỊ {filteredProjects.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filteredProjects.length)} / {filteredProjects.length} DỰ ÁN
                {totalProjects !== filteredProjects.length ? ` (lọc từ ${totalProjects})` : ''}
              </span>
              <div className="flex gap-6 items-center flex-wrap justify-center">
                <button
                  type="button"
                  disabled={pageSafe <= 1}
                  className="hover:text-crm-primary transition-colors flex items-center gap-1 disabled:opacity-30"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <MIcon name="chevron_left" className="text-base" />
                  TRƯỚC
                </button>
                <div className="flex gap-2 items-center flex-wrap justify-center">
                  {pageButtonRange.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPage(num)}
                      className={`min-w-[1.75rem] px-1 py-0.5 rounded ${
                        num === pageSafe ? 'text-crm-primary crm-glow-primary underline underline-offset-4 decoration-2' : 'hover:text-crm-primary'
                      }`}
                    >
                      {String(num).padStart(2, '0')}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={pageSafe >= pageCount}
                  className="hover:text-crm-primary transition-colors flex items-center gap-1 disabled:opacity-30"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  SAU
                  <MIcon name="chevron_right" className="text-base" />
                </button>
              </div>
            </div>
          </div>
            </>
          )}
        </main>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="fixed top-4 right-4 z-[140] p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all border border-white/20 backdrop-blur-md"
          title="Đóng"
          aria-label="Đóng dashboard"
        >
          <X size={20} />
        </button>
      )}
    </motion.div>
  );
}
