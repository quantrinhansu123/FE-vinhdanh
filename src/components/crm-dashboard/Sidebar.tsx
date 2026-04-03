import React from 'react';
import { Role, NavGroup, UserInfo, ViewId } from './types';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  currentRole: Role;
  /** Chỉ hiển thị nút chuyển khu vực tương ứng (theo vị trí / phân quyền) */
  allowedRoles: Role[];
  onRoleChange: (role: Role) => void;
  currentView: ViewId;
  onViewChange: (view: ViewId) => void;
  user: UserInfo;
  navGroups: NavGroup[];
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  allowedRoles,
  onRoleChange,
  currentView,
  onViewChange,
  user,
  navGroups,
  onLogout
}) => {
  const roleTabs = (['admin', 'leader', 'mkt'] as Role[]).filter((r) => allowedRoles.includes(r));
  const gridCols =
    roleTabs.length >= 3 ? 'grid-cols-3' : roleTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <aside className="w-[var(--sw)] shrink-0 bg-[var(--bg1)] border-r border-[var(--border)] flex flex-col overflow-hidden z-20">
      <div className="p-[14px_14px_10px] border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-[9px] mb-[12px]">
          <div className="w-[30px] h-[30px] rounded-[7px] bg-gradient-to-br from-[var(--accent)] to-[#5b4dff] flex items-center justify-center text-[13px] font-extrabold text-[#fff] shrink-0">
            M
          </div>
          <div>
            <div className="text-[13px] font-extrabold tracking-[0.3px]">
              CRM <em className="text-[var(--accent)] not-italic">Mini Ads</em>
            </div>
            <div className="text-[9px] text-[var(--text3)] tracking-[0.8px] uppercase">
              BIOKAMA · v3.0
            </div>
          </div>
        </div>
        
        {roleTabs.length > 0 && (
          <div className={`grid ${gridCols} gap-[3px] bg-[var(--bg2)] rounded-[7px] p-[3px]`}>
            {roleTabs.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onRoleChange(role)}
                className={`p-[5px_2px] border-0 rounded-[5px] cursor-pointer font-[var(--f)] text-[10px] font-bold tracking-[0.5px] text-center transition-all duration-150 ${
                  currentRole === role
                    ? 'bg-[var(--accent)] text-[#fff]'
                    : 'text-[var(--text3)] bg-transparent hover:bg-[var(--bg3)] hover:text-[var(--text)]'
                }`}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-[10px_8px] custom-scrollbar dash-scrollbar">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="mb-[18px]">
            <div className="text-[9px] font-bold tracking-[1.5px] uppercase text-[var(--text3)] px-[8px] mb-[5px]">
              {group.label}
            </div>
            {group.items.map((item) => (
              <div
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-[8px] p-[7px_10px] rounded-[7px] cursor-pointer text-[11.5px] font-medium transition-all duration-150 mb-[1px] relative select-none ${
                  currentView === item.id
                    ? 'bg-[var(--accent-d)] text-[var(--accent)] font-bold'
                    : 'text-[var(--text2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]'
                }`}
              >
                {currentView === item.id && (
                  <div className="absolute left-0 top-1/5 bottom-1/5 w-[3px] rounded-[2px] bg-[var(--accent)]" />
                )}
                <span className="text-[13px] w-[16px] text-center shrink-0">{item.icon}</span>
                {item.label}
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
