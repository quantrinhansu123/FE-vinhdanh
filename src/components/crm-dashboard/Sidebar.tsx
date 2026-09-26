import React from 'react';
import { NavGroup, UserInfo, ViewId } from './types';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  currentView: ViewId;
  onViewChange: (view: ViewId) => void;
  user: UserInfo;
  navGroups: NavGroup[];
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  user,
  navGroups,
  onLogout
}) => {
  return (
    <aside className="w-[var(--sw)] shrink-0 bg-[#101722] border-r border-white/[0.07] flex flex-col overflow-hidden z-20">
      <div className="p-[16px_14px_14px] border-b border-white/[0.07] shrink-0">
        <div className="flex items-center gap-[10px]">
          <div className="w-[34px] h-[34px] rounded-[8px] bg-gradient-to-br from-[#6d9fe5] to-[#3e659a] flex items-center justify-center text-[9px] font-extrabold tracking-[-0.5px] text-white shrink-0">MAP</div>
          <div className="min-w-0 text-[11px] font-bold leading-tight text-slate-100">MAP - Marketing Analytic Platform</div>
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
