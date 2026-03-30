import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/crm-dashboard/Sidebar';
import { Topbar } from '../components/crm-dashboard/Topbar';
import { NotificationPanel } from '../components/crm-dashboard/NotificationPanel';
import { Role, ViewId, UserInfo } from '../components/crm-dashboard/types';
import { ADMIN_NAV, LEADER_NAV, MKT_NAV, VIEW_TITLES } from '../components/crm-dashboard/navData';

// Admin Views
import { AdminDashboardView } from './dashboard/admin/AdminDashboardView';
import { BurnDetectionView } from './dashboard/admin/BurnDetectionView';
import { AlertsView } from './dashboard/admin/AlertsView';
import { ProjectsView } from './dashboard/admin/ProjectsView';
import { TeamsView } from './dashboard/admin/TeamsView';
import { StaffView } from './dashboard/admin/StaffView';
import { AdAccountsView } from './dashboard/admin/AdAccountsView';
import { AgenciesView } from './dashboard/admin/AgenciesView';
import { ProductsView } from './dashboard/admin/ProductsView';
import { MarketsView } from './dashboard/admin/MarketsView';
import { BudgetView } from './dashboard/admin/BudgetView';
import { ReconcileView } from './dashboard/admin/ReconcileView';
import { AdminRankingView } from './dashboard/admin/AdminRankingView';
import { CompareView } from './dashboard/admin/CompareView';

// Leader Views
import { LeaderDashboardView } from './dashboard/leader/LeaderDashboardView';
import { LeaderRankingView } from './dashboard/leader/LeaderRankingView';
import { LeaderMktView } from './dashboard/leader/LeaderMktView';
import { LeaderBudgetView } from './dashboard/leader/LeaderBudgetView';
import { KpiTargetView } from './dashboard/leader/KpiTargetView';
import { HeatmapView } from './dashboard/leader/HeatmapView';

// MKT Views
import { MktDashboardView } from './dashboard/mkt/MktDashboardView';
import { MktReportView } from './dashboard/mkt/MktReportView';
import { MktBillView } from './dashboard/mkt/MktBillView';
import { MktHistoryView } from './dashboard/mkt/MktHistoryView';
import { MktAccountsView } from './dashboard/mkt/MktAccountsView';

import type { Employee, AuthUser as ReportAuthUser } from '../types';
import {
  CRM_ADMIN_BASE,
  crmAdminPathForView,
  defaultViewForRole,
  parseCrmAdminPath,
} from '../utils/crmAdminRoutes';

export interface DashboardAdminLayoutProps {
  employees?: Employee[];
  onEmployeesRefresh?: () => void | Promise<void>;
  onClose?: () => void;
  onLogout?: () => void;
  userName?: string;
  userSubtitle?: string;
  avatarUrl?: string | null;
  reportUser?: ReportAuthUser | null;
}

export const DashboardAdminLayout: React.FC<DashboardAdminLayoutProps> = ({
  employees = [],
  onEmployeesRefresh = () => { },
  onClose,
  onLogout,
  userName = 'Admin User',
  userSubtitle = 'Hệ thống cấp cao',
  avatarUrl,
  reportUser = null,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const parsed = parseCrmAdminPath(location.pathname);

  useEffect(() => {
    const p = parseCrmAdminPath(location.pathname);
    if (p.ok === false) {
      navigate(`${CRM_ADMIN_BASE}/${p.redirect}`, { replace: true });
      return;
    }
    if (p.legacyTwoSegment) {
      navigate(crmAdminPathForView(p.view), { replace: true });
    }
  }, [location.pathname, navigate]);

  const currentRole = parsed.ok ? parsed.role : 'admin';
  const currentView = parsed.ok ? parsed.view : 'admin-dash';

  const handleRoleChange = (role: Role) => {
    navigate(crmAdminPathForView(defaultViewForRole(role)));
  };

  const handleViewChange = (view: ViewId) => {
    navigate(crmAdminPathForView(view));
  };

  const navGroups = currentRole === 'admin' ? ADMIN_NAV : currentRole === 'leader' ? LEADER_NAV : MKT_NAV;

  // Adapt passed props to UserInfo type
  const userInfo: UserInfo = {
    name: userName,
    role: userSubtitle,
    avatar: userName.slice(0, 2).toUpperCase(),
    avatarBg: currentRole === 'admin' ? 'linear-gradient(135deg, #3d8ef0, #7c4dff)' :
      currentRole === 'leader' ? 'linear-gradient(135deg, #10b981, #3d8ef0)' :
        'linear-gradient(135deg, #f59e0b, #ef4444)'
  };

  const renderContent = () => {
    switch (currentView) {
      // Admin Views
      case 'admin-dash': return <AdminDashboardView />;
      case 'burn-detect': return <BurnDetectionView />;
      case 'alerts': return <AlertsView />;
      case 'projects': return <ProjectsView />;
      case 'teams': return <TeamsView />;
      case 'staff':
        return <StaffView onEmployeesRefresh={onEmployeesRefresh} />;
      case 'ad-accounts': return <AdAccountsView />;
      case 'agencies': return <AgenciesView />;
      case 'products': return <ProductsView />;
      case 'markets': return <MarketsView />;
      case 'budget': return <BudgetView />;
      case 'reconcile': return <ReconcileView />;
      case 'admin-ranking': return <AdminRankingView />;
      case 'compare': return <CompareView />;

      // Leader Views
      case 'leader-dash': return <LeaderDashboardView viewer={reportUser ?? null} />;
      case 'leader-rank': return <LeaderRankingView viewer={reportUser ?? null} />;
      case 'leader-mkt': return <LeaderMktView viewer={reportUser ?? null} />;
      case 'leader-budget': return <LeaderBudgetView />;
      case 'kpi-target': return <KpiTargetView viewer={reportUser ?? null} />;
      case 'heatmap': return <HeatmapView />;

      // MKT Views
      case 'mkt-dash': return <MktDashboardView reportUser={reportUser ?? null} />;
      case 'mkt-report': return <MktReportView reportUser={reportUser} />;
      case 'mkt-bill': return <MktBillView />;
      case 'mkt-history': return <MktHistoryView reportUser={reportUser} />;
      case 'mkt-accounts': return <MktAccountsView reportUser={reportUser} />;

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text3)] opacity-50 space-y-4 py-20">
            <div className="text-[48px]">🚧</div>
            <div className="text-[16px] font-bold">Zzz... {VIEW_TITLES[currentView] || currentView} đang thi công</div>
          </div>
        );
    }
  };

  return (
    <div className="dash-theme flex h-screen w-full overflow-hidden">
      <Sidebar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        currentView={currentView}
        onViewChange={handleViewChange}
        user={userInfo}
        navGroups={navGroups}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          title={VIEW_TITLES[currentView] || 'CRM Mini Ads'}
          onToggleNotif={() => setIsNotifOpen(!isNotifOpen)}
          hasNewNotif={true}
        />

        <main className="flex-1 overflow-y-auto p-[12px] dash-scrollbar custom-scrollbar bg-[var(--bg0)]">
          <div className="dash-fade-up w-full">
            {renderContent()}
          </div>
        </main>
      </div>

      <NotificationPanel
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />
    </div>
  );
};

export default DashboardAdminLayout;
