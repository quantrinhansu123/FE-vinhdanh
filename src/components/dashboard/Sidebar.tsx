import React from 'react';
import { MIcon } from '../common/MIcon';
import { NAV } from '../../utils/navigation';

interface SidebarProps {
  activeNav: string;
  expandedNavIds: string[];
  onNavClick: (navKey: string) => void;
  onToggleExpand: (parentId: string) => void;
  onLogout?: () => void;
}

export function Sidebar({
  activeNav,
  expandedNavIds,
  onNavClick,
  onToggleExpand,
  onLogout
}: SidebarProps) {
  return (
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
                      ? 'text-crm-primary font-semibold'
                      : 'text-crm-on-surface-variant hover:text-crm-on-surface hover:bg-crm-surface-accent/50'
                  }`}
                  onClick={() => onNavClick(item.id)}
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
                      onToggleExpand(item.id);
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
                        onClick={() => onNavClick(childKey)}
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
  );
}
