import React, { useState } from 'react';
import { Sidebar } from '../../components/crm-dashboard/Sidebar';
import { Topbar } from '../../components/crm-dashboard/Topbar';
import { NotificationPanel } from '../../components/crm-dashboard/NotificationPanel';
import { Role, ViewId, UserInfo } from '../../components/crm-dashboard/types';
import { ADMIN_NAV, LEADER_NAV, MKT_NAV, VIEW_TITLES } from '../../components/crm-dashboard/navData';

// Lazy loading views later if needed, but for now we'll import them
// We haven't created them yet, so let's placeholders
import { AdminDashboardView } from './admin/AdminDashboardView';
import { BurnDetectionView } from './admin/BurnDetectionView';
import { AlertsView } from './admin/AlertsView';
import { ProjectsView } from './admin/ProjectsView';
import { TeamsView } from './admin/TeamsView';
import { StaffView } from './admin/StaffView';
import { AdAccountsView } from './admin/AdAccountsView';
import { AgenciesView } from './admin/AgenciesView';
import { BudgetView } from './admin/BudgetView';
import { ReconcileView } from './admin/ReconcileView';
import { AdminRankingView } from './admin/AdminRankingView';
import { CompareView } from './admin/CompareView';

import { LeaderDashboardView } from './leader/LeaderDashboardView';
import { HeatmapView } from './leader/HeatmapView';

import { MktDashboardView } from './mkt/MktDashboardView';
import { MktReportView } from './mkt/MktReportView';
import { MktBillView } from './mkt/MktBillView';

const ROLES_INFO: Record<Role, UserInfo> = {
  admin: { name: 'Quản trị viên', role: 'Administrator', avatar: 'AD', avatarBg: 'linear-gradient(135deg, #3d8ef0, #7c4dff)' },
  leader: { name: 'Trần Hoàng', role: 'Leader · Team A', avatar: 'TH', avatarBg: 'linear-gradient(135deg, #10b981, #3d8ef0)' },
  mkt: { name: 'Nguyễn Thị Lan', role: 'Marketing · Team A', avatar: 'NL', avatarBg: 'linear-gradient(135deg, #f59e0b, #ef4444)' }
};

const DashboardPage: React.FC = () => {
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
      case 'heatmap': return <HeatmapView />;

      // MKT Views
      case 'mkt-dash': return <MktDashboardView />;
      case 'mkt-report': return <MktReportView />;
      case 'mkt-bill': return <MktBillView />;

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
        user={ROLES_INFO[currentRole]}
        navGroups={navGroups}
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar 
          title={VIEW_TITLES[currentView] || 'CRM Mini Ads'} 
          onToggleNotif={() => setIsNotifOpen(!isNotifOpen)}
          hasNewNotif={true}
        />
        
        <main className="flex-1 overflow-y-auto p-[16px_20px_28px] dash-scrollbar custom-scrollbar bg-[var(--bg0)]">
          <div className="dash-fade-up max-w-[1400px] mx-auto">
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

export default DashboardPage;
