import React from 'react';
import { MIcon } from '../common/MIcon';

interface HeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  loading: boolean;
  onRefresh: () => void;
  userName: string;
  userSubtitle: string;
  avatarUrl: string | null;
}

export function Header({
  search,
  onSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  loading,
  onRefresh,
  userName,
  userSubtitle,
  avatarUrl
}: HeaderProps) {
  return (
    <header className="shrink-0 min-h-20 bg-crm-surface/50 backdrop-blur-xl z-40 px-6 lg:px-10 flex flex-wrap justify-between items-center border-b border-crm-outline/30 gap-4 py-3">
      <div className="flex items-center gap-4 lg:gap-8 min-w-0 flex-1">
        <div className="hidden sm:flex items-center bg-crm-surface-container border border-crm-outline/50 rounded-xl px-4 py-2 w-full max-w-[320px] focus-within:border-crm-primary/50 transition-all shadow-inner">
          <MIcon name="search" className="text-crm-on-surface-variant text-xl shrink-0" />
          <input
            className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-crm-on-surface-variant/50 ml-2 outline-none"
            placeholder="Tìm kiếm dự án, đơn vị..."
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="crm-glass-card crm-date-picker-icon flex items-center gap-3 px-4 py-1.5 rounded-xl border border-crm-outline/50 shrink-0">
          <div className="flex flex-col">
            <span className="text-[9px] font-extrabold text-crm-on-surface-variant uppercase tracking-widest leading-none mb-1">Từ ngày</span>
            <input
              className="bg-transparent border-none p-0 text-xs font-bold text-crm-on-surface focus:ring-0 w-28 outline-none"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
            />
          </div>
          <div className="h-6 w-px bg-crm-outline/50" />
          <div className="flex flex-col">
            <span className="text-[9px] font-extrabold text-crm-on-surface-variant uppercase tracking-widest leading-none mb-1">Đến ngày</span>
            <input
              className="bg-transparent border-none p-0 text-xs font-bold text-crm-on-surface focus:ring-0 w-28 outline-none"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="ml-2 p-1.5 bg-crm-primary/10 hover:bg-crm-primary/20 text-crm-primary rounded-lg transition-colors disabled:opacity-50"
            aria-label="Làm mới"
            disabled={loading}
            onClick={onRefresh}
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
  );
}
