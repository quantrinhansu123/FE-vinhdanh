import React from 'react';
import { MIcon } from '../../components/common/MIcon';
import { GoogleAdsPage } from './GoogleAdsPage';
import { CrmRevenueAreaChart } from '../../components/dashboard/CrmRevenueAreaChart';
import { formatCompactM, formatSignedPct, ADS_THRESHOLD_OK, ADS_THRESHOLD_WARN } from '../../utils/dashboardAdminUtils';

interface OverviewPageProps {
  plannedBudget: number;
  totalAdCost: number;
  totalRevenue: number;
  adsRatio: number;
  roas: number;
  budgetUsePct: number;
  revenueMom: number | null;
  budgetMom: number | null;
  chartPeriodKey: 'NGÀY' | 'TUẦN' | 'THÁNG' | 'NĂM';
  setChartPeriodKey: (key: 'NGÀY' | 'TUẦN' | 'THÁNG' | 'NĂM') => void;
  chartSeries: any[];
  chartPath: { areaD: string; lineD: string; circles: { cx: number; cy: number }[] };
  chartValues: number[];
  topGood: any[];
  topBad: any[];
  activeNav: string;
}

function avatarUrlForLabel(label: string) {
  const safe = encodeURIComponent(label.slice(0, 24) || 'CRM');
  return `https://ui-avatars.com/api/?background=1a2e22&color=4ade80&size=64&name=${safe}`;
}

const CHART_PERIODS: { key: 'NGÀY' | 'TUẦN' | 'THÁNG' | 'NĂM' }[] = [
  { key: 'NGÀY' },
  { key: 'TUẦN' },
  { key: 'THÁNG' },
  { key: 'NĂM' },
];

export function OverviewPage({
  plannedBudget,
  totalAdCost,
  totalRevenue,
  adsRatio,
  roas,
  budgetUsePct,
  revenueMom,
  budgetMom,
  chartPeriodKey,
  setChartPeriodKey,
  chartSeries,
  chartPath,
  chartValues,
  topGood,
  topBad,
  activeNav,
}: OverviewPageProps) {
  return (
    <GoogleAdsPage variant="embedded">
      <div id="crm-dash-kpi" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div className="crm-glass-card p-6 rounded-xl hover:border-crm-primary/50 border border-transparent transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-crm-primary/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-crm-on-surface-variant tracking-[0.15em] uppercase">Tổng Ngân Sách (ước tính)</span>
            <MIcon name="account_balance" className="text-crm-primary group-hover:scale-110 transition-transform" />
          </div>
          <h2 className="text-3xl font-extrabold text-crm-on-surface tracking-tighter crm-glow-primary">{formatCompactM(plannedBudget)}</h2>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {budgetMom !== null && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  budgetMom >= 0 ? 'text-crm-success bg-crm-success/10 border-crm-success/20' : 'text-crm-error bg-crm-error/10 border-crm-error/20'
                }`}
              >
                {formatSignedPct(budgetMom)}
              </span>
            )}
            <span className="text-[10px] text-crm-on-surface-variant font-medium">vs kỳ trước</span>
          </div>
        </div>
        <div className="crm-glass-card p-6 rounded-xl hover:border-crm-secondary/50 border border-transparent transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-crm-secondary/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-crm-on-surface-variant tracking-[0.15em] uppercase">Chi Phí Marketing</span>
            <MIcon name="payments" className="text-crm-secondary group-hover:scale-110 transition-transform" />
          </div>
          <h2 className="text-3xl font-extrabold text-crm-on-surface tracking-tighter">{formatCompactM(totalAdCost)}</h2>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-crm-secondary bg-crm-secondary/10 border border-crm-secondary/20 px-2 py-0.5 rounded-full">
              {plannedBudget > 0 ? `${budgetUsePct.toFixed(1)}%` : '—'}
            </span>
            <span className="text-[10px] text-crm-on-surface-variant font-medium">Quỹ đã sử dụng</span>
          </div>
        </div>
        <div className="crm-glass-card p-6 rounded-xl hover:border-crm-primary/50 border border-transparent transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-crm-primary/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-crm-on-surface-variant tracking-[0.15em] uppercase">Tổng Doanh Số</span>
            <MIcon name="trending_up" className="text-crm-primary group-hover:scale-110 transition-transform" />
          </div>
          <h2 className="text-3xl font-extrabold text-crm-on-surface tracking-tighter">{formatCompactM(totalRevenue)}</h2>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {revenueMom !== null && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  revenueMom >= 0 ? 'text-crm-success bg-crm-success/10 border-crm-success/20' : 'text-crm-error bg-crm-error/10 border-crm-error/20'
                }`}
              >
                {formatSignedPct(revenueMom)}
              </span>
            )}
            <span className="text-[10px] text-crm-on-surface-variant font-medium uppercase tracking-tighter">ROAS: {roas >= 0 ? `${roas.toFixed(2)}x` : '—'}</span>
          </div>
        </div>
        <div className="crm-glass-card p-6 rounded-xl border-crm-error/30 hover:border-crm-error/60 border transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-crm-error/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-crm-on-surface-variant tracking-[0.15em] uppercase">% Ads/Doanh Số</span>
            <MIcon name="warning" className="text-crm-error group-hover:scale-110 transition-transform" />
          </div>
          <h2 className="text-3xl font-extrabold text-crm-error tracking-tighter drop-shadow-[0_0_12px_rgba(248,113,113,0.35)]">{adsRatio.toFixed(1)}%</h2>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-extrabold text-crm-on-surface bg-crm-error px-2 py-0.5 rounded-full uppercase italic">
              {adsRatio >= ADS_THRESHOLD_WARN ? 'Vượt ngưỡng' : adsRatio >= ADS_THRESHOLD_OK ? 'Cảnh báo' : 'Ổn định'}
            </span>
            <span className="text-[10px] text-crm-on-surface-variant font-medium">Target: {'<'} {ADS_THRESHOLD_OK}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 crm-glass-card p-8 rounded-2xl relative overflow-hidden border border-crm-outline/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-crm-primary via-crm-secondary to-crm-primary opacity-50" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
            <div>
              <h3 className="text-xl font-bold text-crm-on-surface tracking-tight">Xu hướng Doanh số</h3>
              <p className="text-xs text-crm-on-surface-variant mt-1">Theo khoảng ngày đã chọn (gom theo {chartPeriodKey.toLowerCase()})</p>
            </div>
            <div className="flex p-1 bg-crm-surface-accent rounded-lg border border-crm-outline/50 flex-wrap">
              {CHART_PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setChartPeriodKey(p.key)}
                  className={`text-[10px] font-bold px-3 sm:px-4 py-1.5 rounded-md transition-all ${
                    chartPeriodKey === p.key
                      ? 'bg-crm-primary text-white shadow-[0_0_16px_rgba(34,197,94,0.38)]'
                      : 'text-crm-on-surface-variant hover:text-crm-on-surface'
                  }`}
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full min-h-[200px] flex justify-between gap-2 items-stretch">
            <div className="relative w-full min-h-[200px]">
              {chartValues.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-crm-on-surface-variant text-sm">
                  Không có dữ liệu doanh số trong khoảng này
                </div>
              ) : activeNav === 'dashboard:alerts' ? (
                <CrmRevenueAreaChart series={chartSeries} />
              ) : (
                <svg className="w-full h-[256px]" preserveAspectRatio="none" viewBox="0 0 700 200">
                  <defs>
                    <linearGradient id="crm-glowing-gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#4ade80" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={chartPath.areaD} fill="url(#crm-glowing-gradient)" />
                  <path d={chartPath.lineD} fill="none" stroke="#4ade80" strokeLinecap="round" strokeWidth="3" className="crm-glow-line" />
                  {chartPath.circles.map((c, i) => (
                    <circle key={i} cx={c.cx} cy={c.cy} fill="#93c5fd" r="4" stroke="#0c1220" strokeWidth="2" />
                  ))}
                </svg>
              )}
            </div>
          </div>
          {!(activeNav === 'dashboard:alerts' && chartSeries.length > 0) && (
            <div className="flex justify-between mt-6 px-2 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-[0.15em] gap-1 flex-wrap">
              {chartSeries.length === 0 ? (
                <span>—</span>
              ) : (
                chartSeries.map((p) => (
                  <span key={p.sortKey} className="truncate max-w-[4.5rem]">
                    {p.label}
                  </span>
                ))
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="crm-glass-card p-6 rounded-2xl border-l-4 border-l-crm-success relative border border-crm-outline/30">
            <h4 className="text-xs font-extrabold text-crm-on-surface mb-5 flex items-center gap-2 tracking-widest uppercase">
              <MIcon name="workspace_premium" className="text-crm-success text-lg" />
              Top Marketing Hiệu Quả
            </h4>
            <div className="space-y-5">
              {topGood.length === 0 ? (
                <p className="text-xs text-crm-on-surface-variant">Chưa đủ dữ liệu (cần doanh số theo thị trường/sản phẩm)</p>
              ) : (
                topGood.map((row) => (
                  <div key={row.key} className="flex items-center justify-between group cursor-default gap-2">
                    <div className="flex items-center gap-4 min-w-0">
                      <img alt="" className="w-8 h-8 rounded-full border border-crm-success/30 object-cover shrink-0" src={avatarUrlForLabel(row.label)} />
                      <span className="text-xs font-semibold text-crm-on-surface tracking-tight truncate">{row.label}</span>
                    </div>
                    <span className="text-xs font-extrabold text-crm-success shrink-0">{row.adsPct.toFixed(0)}% Ads</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="crm-glass-card p-6 rounded-2xl border-l-4 border-l-crm-error relative border border-crm-outline/30">
            <h4 className="text-xs font-extrabold text-crm-on-surface mb-5 flex items-center gap-2 tracking-widest uppercase">
              <MIcon name="local_fire_department" className="text-crm-error text-lg" />
              Top Marketing Đốt Tiền
            </h4>
            <div className="space-y-5">
              {topBad.length === 0 ? (
                <p className="text-xs text-crm-on-surface-variant">Chưa đủ dữ liệu</p>
              ) : (
                topBad.map((row) => (
                  <div key={row.key} className="flex items-center justify-between group cursor-default gap-2">
                    <div className="flex items-center gap-4 min-w-0">
                      <img alt="" className="w-8 h-8 rounded-full border border-crm-error/30 object-cover shrink-0" src={avatarUrlForLabel(row.label)} />
                      <span className="text-xs font-semibold text-crm-on-surface tracking-tight truncate">{row.label}</span>
                    </div>
                    <span className="text-xs font-extrabold text-crm-error shrink-0">{row.adsPct.toFixed(0)}% Ads</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </GoogleAdsPage>
  );
}
