import React from 'react';
import { MIcon } from '../common/MIcon';
import { 
  formatSignedPct, 
  formatVnd, 
  ADS_THRESHOLD_OK, 
  ADS_THRESHOLD_WARN 
} from '../../utils/dashboardAdminUtils';

const PAGE_SIZE = 10;

interface ProjectRow {
  project: string;
  agency: string;
  budget: number;
  spend: number;
  diffPct: number;
  adsPct: number;
}

interface AlertsDashboardProps {
  pagedRows: ProjectRow[];
  filteredProjects: ProjectRow[];
  projectRows: ProjectRow[];
  pageSafe: number;
  pageCount: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageButtonRange: number[];
  handleExportExcel: () => void;
  dateFrom: string;
  dateTo: string;
  totalProjects: number;
}

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

export function AlertsDashboard({
  pagedRows,
  filteredProjects,
  projectRows,
  pageSafe,
  pageCount,
  setPage,
  pageButtonRange,
  handleExportExcel,
  dateFrom,
  dateTo,
  totalProjects,
}: AlertsDashboardProps) {
  return (
    <div id="crm-dash-reconcile" className="crm-glass-card rounded-2xl overflow-hidden shadow-2xl border border-crm-outline/30 mt-6">
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
  );
}
