import React, { useState } from 'react';
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
  const [currentRole, setCurrentRole] = useState<Role>('admin');
  const [currentView, setCurrentView] = useState<ViewId>('admin-dash');
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const handleRoleChange = (role: Role) => {
    setCurrentRole(role);
    // Set default view for role
    if (role === 'admin') setCurrentView('admin-dash');
    else if (role === 'leader') setCurrentView('leader-dash');
    else setCurrentView('mkt-dash');
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
      case 'staff': return <StaffView />;
      case 'ad-accounts': return <AdAccountsView />;
      case 'agencies': return <AgenciesView />;
      case 'budget': return <BudgetView />;
      case 'reconcile': return <ReconcileView />;
      case 'admin-ranking': return <AdminRankingView />;
      case 'compare': return <CompareView />;

      // Leader Views
      case 'leader-dash': return <LeaderDashboardView />;
      case 'leader-rank': return <LeaderRankingView />;
      case 'leader-mkt': return <LeaderMktView />;
      case 'leader-budget': return <LeaderBudgetView />;
      case 'kpi-target': return <KpiTargetView />;
      case 'heatmap': return <HeatmapView />;

      // MKT Views
      case 'mkt-dash': return <MktDashboardView />;
      case 'mkt-report': return <MktReportView />;
      case 'mkt-bill': return <MktBillView />;
      case 'mkt-history': return <MktHistoryView />;
      case 'mkt-accounts': return <MktAccountsView />;

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
        onViewChange={setCurrentView}
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
