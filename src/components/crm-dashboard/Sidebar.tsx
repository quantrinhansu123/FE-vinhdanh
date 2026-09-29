import React from 'react';
import { NavGroup, UserInfo, ViewId } from './types';
import { BriefcaseBusiness, ChartColumnIncreasing, ChartNoAxesCombined, Circle, Database, Download, Flame, Globe2, Home, IdCard, LogOut, Megaphone, Package, Scale, ShieldAlert, Target, TriangleAlert, Trophy, UserRound, UsersRound, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const stitchNavIcons: Record<string, LucideIcon> = {
  'admin-dash': Home, 'mkt-dash': UserRound, 'leader-dash': UsersRound,
  'burn-detect': Flame, alerts: TriangleAlert, projects: BriefcaseBusiness,
  teams: UsersRound, staff: IdCard, 'ad-accounts': ChartNoAxesCombined,
  kpis: ChartColumnIncreasing, agencies: BriefcaseBusiness, products: Package,
  markets: Globe2, budget: Wallet, reconcile: Scale, 'upcare-mkt': Megaphone,
  'project-qc-excel': ChartColumnIncreasing, 'reports-raw': Database,
  'admin-ranking': Trophy, compare: ChartNoAxesCombined, 'leader-rank': Trophy,
  'leader-mkt': UserRound, 'leader-tkqc': Megaphone, 'leader-budget': Wallet,
  'kpi-target': Target, heatmap: ChartColumnIncreasing, 'mkt-history': Download,
  'mkt-accounts': ShieldAlert,
};

interface SidebarProps {
  currentView: ViewId;
  onViewChange: (view: ViewId) => void;
  user: UserInfo;
  navGroups: NavGroup[];
  onLogout?: () => void;
  stitch?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  user,
  navGroups,
  onLogout,
  stitch = false,
}) => {
  if (stitch) {
    return (
      <aside className="stitch-sidebar" aria-label="Điều hướng chính">
        <div className="stitch-sidebar-brand">
          <div className="stitch-sidebar-logo">MAP</div>
          <div className="stitch-sidebar-brand-copy"><strong>MAP - Marketing</strong><span>Analytics Platform</span></div>
        </div>
        <nav className="stitch-sidebar-nav">
          {navGroups.map((group, groupIndex) => (
            <div className="stitch-sidebar-group" key={`${group.label}-${groupIndex}`}>
              <div className="stitch-sidebar-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = stitchNavIcons[item.id] || Circle;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onViewChange(item.id)}
                    className={`stitch-sidebar-link ${currentView === item.id ? 'is-active' : ''}`}
                    aria-current={currentView === item.id ? 'page' : undefined}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <Icon size={17} strokeWidth={2} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.id === 'burn-detect' && <i className="stitch-sidebar-alert-dot" aria-hidden="true" />}
                    {item.badge && <b className="stitch-sidebar-badge">{item.badge.text}</b>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="stitch-sidebar-footer">
          {onLogout && <button type="button" className="stitch-sidebar-logout" onClick={onLogout}><LogOut size={17} />Đăng xuất</button>}
          <div className="stitch-sidebar-user">
            <span className="stitch-sidebar-user-avatar">{user.avatar}</span>
            <span className="stitch-sidebar-user-copy"><strong>{user.name}</strong><small>{user.role} · Admin</small></span>
          </div>
        </div>
      </aside>
    );
  }
  return (
    <aside className="w-[var(--sw)] shrink-0 bg-[#101722] border-r border-white/[0.07] flex flex-col overflow-hidden z-20">
      <div className="p-[16px_14px_14px] border-b border-white/[0.07] shrink-0">
        <div className="flex items-center gap-[10px]">
          <div className="w-[34px] h-[34px] rounded-[8px] bg-gradient-to-br from-[#6d9fe5] to-[#3e659a] flex items-center justify-center text-[9px] font-extrabold tracking-[-0.5px] text-white shrink-0">MAP</div>
          <div className="min-w-0 text-[13px] font-bold leading-[1.25] text-slate-100">MAP - Marketing Analytic Platform</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-[10px_8px] custom-scrollbar dash-scrollbar">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="mb-[18px]">
            <div className="text-[9px] font-bold tracking-[1.4px] uppercase text-slate-500 px-[10px] mb-[7px]">
              {group.label}
            </div>
            {group.items.map((item) => (
              <div
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-[8px] p-[9px_12px] rounded-[7px] cursor-pointer text-[12px] font-medium transition-all duration-150 mb-[2px] relative select-none ${
                  currentView === item.id
                    ? 'bg-[#1d2b3d] text-[#a9cbff] font-semibold'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                }`}
              >
                {currentView === item.id && (
                  <div className="absolute left-0 top-1/5 bottom-1/5 w-[2px] rounded-[2px] bg-[#75a9f5]" />
                )}
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className={`ml-auto text-[9px] font-bold px-[6px] py-[1px] rounded-[10px] text-[#fff] ${
                    item.badge.type === 'y' ? 'bg-[var(--Y)]' : item.badge.type === 'b' ? 'bg-[var(--accent)]' : 'bg-[var(--R)]'
                  }`}>
                    {item.badge.text}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {onLogout && (
        <div className="px-[10px] mb-[4px]">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-[10px] p-[8.5px_12px] rounded-[8px] text-[11.5px] font-bold text-[var(--text2)] hover:bg-[var(--bg3)] hover:text-[var(--R)] transition-all duration-200 group relative overflow-hidden active:scale-[0.98]"
          >
            <LogOut size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Đăng xuất
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--R)] to-transparent opacity-0 group-hover:opacity-[0.05] transition-opacity" />
          </button>
        </div>
      )}

      <div className="p-[10px_12px] border-t border-[var(--border)] shrink-0 flex items-center gap-[8px]">
        <div className="flex items-center gap-[8px] flex-1">
          <div 
            className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[11px] font-extrabold text-[#fff] shrink-0 shadow-sm"
            style={{ background: user.avatarBg || 'linear-gradient(135deg, var(--accent), #7c4dff)' }}
          >
            {user.avatar}
          </div>
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold text-[var(--text)] leading-tight truncate">{user.name}</div>
            <div className="text-[9.5px] text-[var(--text3)] leading-tight truncate">{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
