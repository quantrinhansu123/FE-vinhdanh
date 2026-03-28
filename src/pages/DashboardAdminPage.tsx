/**
 * CRM Mini Ads — Admin dashboard page: dữ liệu từ Supabase detail_reports, giao diện theo DashboardAdmin.html
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, X } from 'lucide-react';
import type { Employee, AuthUser as ReportAuthUser, ProjectRow, ReportRow, ChartGranularity } from '../types';
import { EmployeeTeamAdminPanel } from '../components/dashboard/EmployeeTeamAdminPanel';
import { AdsAccountsOverview } from '../components/dashboard/AdsAccountsOverview';
import { AdsTkqcAccountsTable } from '../components/dashboard/AdsTkqcAccountsTable';
import { BudgetSummaryTable } from '../components/dashboard/BudgetSummaryTable';
import { ProjectsListTable } from '../components/dashboard/ProjectsListTable';
import { ProjectsAllocationView } from '../components/dashboard/ProjectsAllocationView';
import { MarketingChannelsTable } from '../components/dashboard/MarketingChannelsTable';
import { MarketingCampaignsTable } from '../components/dashboard/MarketingCampaignsTable';
import { ProgressDashboard } from './ProgressDashboard';
import { ReportModal } from '../components/dashboard/ReportModal';
import { GoogleAdsDashboard } from './GoogleAdsDashboard';
import { CrmRevenueAreaChart } from '../components/dashboard/CrmRevenueAreaChart';
import { OverviewDashboard } from '../components/dashboard/OverviewDashboard';
import { AlertsDashboard } from '../components/dashboard/AlertsDashboard';
import { DevelopingPlaceholder } from '../components/dashboard/DevelopingPlaceholder';

import { supabase } from '../api/supabase';
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
} from '../utils/dashboardAdminUtils';

const REPORT_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

const MS_BASE = { fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" as const };
const MS_FILL = { fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" as const };

import { Sidebar } from '../components/dashboard/Sidebar';
import { Header } from '../components/dashboard/Header';
import { MIcon } from '../components/common/MIcon';
import {
  pathToNavKey,
  isValidCrmAdminPath,
  navKeyToPath,
  getNavPlaceholderText,
  CRM_ADMIN_BASE
} from '../utils/navigation';


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

export interface DashboardAdminPageProps {
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

export function DashboardAdminPage({
  employees = [],
  onEmployeesRefresh = () => {},
  onClose,
  onLogout,
  userName = 'Admin User',
  userSubtitle = 'Hệ thống cấp cao',
  avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCq4IVGRcDsNW79LSQB6KOK_itTwQjwdyXT1g3NTRY4tK3Xg5TWjwQcenqwvhUbC9YKMoXzIIphIZSdODMCwJywK57DHQelM3IMfgIHVo-35r_S7xeU9MAssW4WuUWGlgDS-p9g8Li04_mufizCVczUnA5rIhJuokNQgTdd3rxvyYEG0auVOSif-1x6BZR-y2Os7yOOqLG5PZKhQYHnmeTFLbNtr8m8L3wbTnkMm3gWMWnt2TIyJ2LT-dLL-BgMX3KN899D7cKqmag',
  reportUser = null,
}: DashboardAdminPageProps) {
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

  const { revenue: totalRevenue, ad_cost: totalAdCost } = useMemo(() => sumReports(reports), [reports]);
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
    if (p === `${CRM_ADMIN_BASE}/reconcile` || p === `${CRM_ADMIN_BASE}/reconcile/`) {
      navigate(`${CRM_ADMIN_BASE}/reconcile/table`, { replace: true });
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
    if (activeNav === 'reports:summary') {
      document.getElementById('crm-reports-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (activeNav === 'dashboard:overview') {
      document.getElementById('crm-dash-google-ads')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const base = activeNav.split(':')[0];
    if (base === 'reconcile') {
      const elId = activeNav === 'reconcile:history' ? 'crm-reconcile-history' : 'crm-dash-reconcile';
      document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (base === 'dashboard') {
      document.getElementById('crm-dash-kpi')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    document.getElementById('crm-dash-placeholder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeNav]);

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
      <Sidebar
        activeNav={activeNav}
        expandedNavIds={expandedNavIds}
        onNavClick={scrollToSection}
        onToggleExpand={toggleNavExpand}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Header
          search={search}
          onSearchChange={setSearch}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          loading={loading}
          onRefresh={fetchData}
          userName={userName}
          userSubtitle={userSubtitle}
          avatarUrl={avatarUrl}
        />

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
            activeNav !== 'reports:summary' &&
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
            activeNav !== 'reports:summary' &&
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
          ) : activeNav === 'reports:summary' ? (
            <DevelopingPlaceholder
              id="crm-reports-summary"
              title="Báo cáo Tổng hợp"
              description="Tính năng Báo cáo Tổng hợp (General Report Summary) đang được hoàn thiện hệ thống cơ sở dữ liệu. Vui lòng quay lại sau."
              icon="analytics"
            />
          ) : activeNav === 'dashboard:alerts' || activeNav === 'reconcile:table' ? (
            <AlertsDashboard
              pagedRows={pagedRows}
              filteredProjects={filteredProjects}
              projectRows={projectRows}
              pageSafe={pageSafe}
              pageCount={pageCount}
              setPage={setPage}
              pageButtonRange={pageButtonRange}
              handleExportExcel={handleExportExcel}
              dateFrom={dateFrom}
              dateTo={dateTo}
              totalProjects={totalProjects}
            />
          ) : activeNav === 'reconcile:history' ? (
            <DevelopingPlaceholder
              id="crm-reconcile-history"
              title="Lịch sử chỉnh sửa"
              description="Tính năng theo dõi lịch sử chỉnh sửa các bản ghi đối chiếu đang được hoàn thiện hệ thống cơ sở dữ liệu. Vui lòng quay lại sau."
              icon="history"
            />
          ) : (

            <>

              {activeNav === 'dashboard:overview' ? (
                <OverviewDashboard
                  plannedBudget={plannedBudget}
                  totalAdCost={totalAdCost}
                  totalRevenue={totalRevenue}
                  adsRatio={adsRatio}
                  roas={roas}
                  budgetUsePct={budgetUsePct}
                  revenueMom={revenueMom}
                  budgetMom={budgetMom}
                  chartPeriodKey={chartPeriodKey}
                  setChartPeriodKey={setChartPeriodKey}
                  chartSeries={chartSeries}
                  chartPath={chartPath}
                  chartValues={chartValues}
                  topGood={topGood}
                  topBad={topBad}
                  activeNav={activeNav}
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-crm-on-surface-variant/50 italic text-sm">
                  Vui lòng chọn một mục trong Dashboard
                </div>
              )}
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
