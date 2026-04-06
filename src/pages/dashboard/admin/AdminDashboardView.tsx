import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../api/supabase';
import type { ReportRow } from '../../../types';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';
import { formatCompactVnd } from '../mkt/mktDetailReportShared';

const REPORTS_TABLE = 'detail_reports';

function toLocalYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function prevMonthBounds(ref: Date): { start: string; end: string } {
  const d = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  return {
    start: toLocalYyyyMmDd(startOfMonth(d)),
    end: toLocalYyyyMmDd(endOfMonth(d)),
  };
}

function formatVndDots(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('vi-VN');
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  // Chuẩn hóa chuỗi tiền tệ: bỏ $, dấu phẩy, khoảng trắng
  const s = String(v).trim().replace(/[\$,]/g, '').replace(/\s+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function tyLeChot(tongData: number, orders: number, tongLead: number): number | null {
  if (tongData > 0 && Number.isFinite(orders)) return (orders / tongData) * 100;
  if (tongLead > 0 && Number.isFinite(orders)) return (orders / tongLead) * 100;
  return null;
}

function pctChange(cur: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function roiPct(revenue: number, adCost: number): number | null {
  if (!Number.isFinite(adCost) || adCost <= 0) return null;
  return ((revenue - adCost) / adCost) * 100;
}

type MarketerAgg = {
  key: string;
  displayName: string;
  team: string | null;
  revenue: number;
  adCost: number;
  tongLead: number;
  orders: number;
  tongData: number;
};

const ADS_DT_WARN = 45;
const ADS_DT_MED = 30;

const iconFill: React.CSSProperties = { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" };

function aggregateRows(rows: ReportRow[]) {
  // Doanh thu quy đổi VND: ưu tiên tien_viet; nếu thiếu, quy đổi từ revenue * 25,000
  let revenue = 0;
  let adCost = 0;
  let tongLead = 0;
  let orders = 0;
  let tongData = 0;
  for (const r of rows) {
    const vnd = r.tien_viet != null ? safeNum(r.tien_viet) : Math.round(safeNum(r.revenue) * 25000);
    revenue += vnd;
    adCost += safeNum(r.ad_cost);
    tongLead += safeNum(r.tong_lead);
    orders += safeNum(r.order_count);
    tongData += safeNum(r.tong_data_nhan);
  }
  const adsDtPct = revenue > 0 ? (adCost / revenue) * 100 : null;
  const chotPct = tyLeChot(tongData, orders, tongLead);
  return { revenue, adCost, tongLead, orders, tongData, adsDtPct, chotPct };
}

function buildDailySeries(rows: ReportRow[]): { date: string; spend: number; rev: number }[] {
  const map = new Map<string, { spend: number; rev: number }>();
  for (const r of rows) {
    const d = r.report_date?.slice(0, 10);
    if (!d) continue;
    const cur = map.get(d) || { spend: 0, rev: 0 };
    cur.spend += safeNum(r.ad_cost);
    cur.rev += r.tien_viet != null ? safeNum(r.tien_viet) : Math.round(safeNum(r.revenue) * 25000);
    map.set(d, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, spend: v.spend, rev: v.rev }));
}

function svgPathLine(pts: { x: number; y: number }[]): string {
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  return d;
}

function svgPathArea(pts: { x: number; y: number }[], bottomY: number): string {
  if (!pts.length) return '';
  const line = svgPathLine(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
}

export const AdminDashboardView: React.FC = () => {
  const chartId = React.useId().replace(/:/g, '');
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [prevRows, setPrevRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState(false);

  const monthRef = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => toLocalYyyyMmDd(startOfMonth(monthRef)), [monthRef]);
  const monthEnd = useMemo(() => toLocalYyyyMmDd(endOfMonth(monthRef)), [monthRef]);
  const monthLabel = useMemo(
    () =>
      monthRef.toLocaleDateString('vi-VN', {
        month: '2-digit',
        year: 'numeric',
      }),
    [monthRef]
  );
  const prevBounds = useMemo(() => prevMonthBounds(monthRef), [monthRef]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [curRes, prevRes] = await Promise.all([
      supabase
        .from(REPORTS_TABLE)
        .select('report_date, name, email, team, code, ad_cost, revenue, tien_viet, order_count, tong_lead, tong_data_nhan')
        .gte('report_date', monthStart)
        .lte('report_date', monthEnd)
        .limit(8000),
      supabase
        .from(REPORTS_TABLE)
        .select('report_date, name, email, team, code, ad_cost, revenue, tien_viet, order_count, tong_lead, tong_data_nhan')
        .gte('report_date', prevBounds.start)
        .lte('report_date', prevBounds.end)
        .limit(8000),
    ]);

    if (curRes.error) {
      console.error('admin-dash detail_reports:', curRes.error);
      setError(curRes.error.message || 'Không tải được báo cáo.');
      setRows([]);
      setPrevRows([]);
    } else {
      setRows((curRes.data || []) as ReportRow[]);
      if (prevRes.error) {
        console.warn('admin-dash prev month:', prevRes.error);
        setPrevRows([]);
      } else {
        setPrevRows((prevRes.data || []) as ReportRow[]);
      }
    }
    setLoading(false);
  }, [monthStart, monthEnd, prevBounds.start, prevBounds.end]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => aggregateRows(rows), [rows]);
  const prevTotals = useMemo(() => aggregateRows(prevRows), [prevRows]);

  const spendDelta = pctChange(totals.adCost, prevTotals.adCost);
  const revDelta = pctChange(totals.revenue, prevTotals.revenue);
  const roiNow = roiPct(totals.revenue, totals.adCost);
  const roiPrev = roiPct(prevTotals.revenue, prevTotals.adCost);
  const roiDelta = roiNow != null && roiPrev != null ? roiNow - roiPrev : null;
  // Tổng doanh thu (VND) đã quy đổi

  // Bộ lọc ngày cho danh sách code
  const [codesFrom, setCodesFrom] = useState<string>(() => monthStart);
  const [codesTo, setCodesTo] = useState<string>(() => monthEnd);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesList, setCodesList] = useState<string[]>([]);
  const [codesAll, setCodesAll] = useState(false);

  const loadCodes = useCallback(async () => {
    setCodesLoading(true);
    try {
      let q = supabase.from(REPORTS_TABLE).select('code, report_date').not('code', 'is', null);
      if (!codesAll) {
        q = q.gte('report_date', codesFrom).lte('report_date', codesTo);
      }
      const { data, error } = await q.limit(50000);
      if (error) {
        console.error('admin-dash codes:', error);
        setCodesList([]);
        return;
      }
      const s = new Set<string>();
      for (const r of (data as { code?: string | null }[]) || []) {
        const c = r.code?.trim();
        if (c) s.add(c);
      }
      setCodesList([...s].sort((a, b) => a.localeCompare(b)));
    } finally {
      setCodesLoading(false);
    }
  }, [codesFrom, codesTo]);

  const byMarketer = useMemo(() => {
    const map = new Map<string, MarketerAgg>();
    for (const r of rows) {
      const code = r.code?.trim();
      const email = r.email?.trim().toLowerCase() || '';
      const nm = (r.name || '').trim();
      // Ưu tiên gom theo code; nếu thiếu thì theo email, cuối cùng mới theo name
      const key = (code || email || nm || `anon-${map.size}`).toLowerCase();
      const displayName = code || nm || email || '—';
      const cur =
        map.get(key) ||
        ({
          key,
          displayName,
          team: r.team?.trim() || null,
          revenue: 0,
          adCost: 0,
          tongLead: 0,
          orders: 0,
          tongData: 0,
        } satisfies MarketerAgg);
      // Doanh thu VNĐ: ưu tiên tien_viet; nếu thiếu, quy đổi từ revenue * 25,000
      cur.revenue += r.tien_viet != null ? safeNum(r.tien_viet) : Math.round(safeNum(r.revenue) * 25000);
      cur.adCost += safeNum(r.ad_cost);
      cur.tongLead += safeNum(r.tong_lead);
      cur.orders += safeNum(r.order_count);
      cur.tongData += safeNum(r.tong_data_nhan);
      if (!cur.team && r.team?.trim()) cur.team = r.team.trim();
      if (cur.displayName === '—' && nm) cur.displayName = displayName;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  const activeCampaigns = useMemo(
    () => byMarketer.filter((m) => m.revenue > 0 || m.adCost > 0).length,
    [byMarketer]
  );

  const burnMarketers = useMemo(
    () =>
      byMarketer.filter((m) => {
        if (m.revenue <= 0 || m.adCost <= 0) return false;
        return (m.adCost / m.revenue) * 100 >= ADS_DT_WARN;
      }),
    [byMarketer]
  );

  const rankRows = useMemo(() => {
    return byMarketer.map((m, idx) => {
      const adsPct = m.revenue > 0 ? (m.adCost / m.revenue) * 100 : m.adCost > 0 ? 100 : 0;
      const cplDenom = m.tongLead > 0 ? m.tongLead : m.tongData > 0 ? m.tongData : 0;
      const cpl = cplDenom > 0 ? m.adCost / cplDenom : null;
      const cpo = m.orders > 0 ? m.adCost / m.orders : null;
      const chot = tyLeChot(m.tongData, m.orders, m.tongLead);
      let status: 'good' | 'med' | 'bad' = 'good';
      if (adsPct >= ADS_DT_WARN) status = 'bad';
      else if (adsPct >= ADS_DT_MED) status = 'med';
      const isBurn = status === 'bad' && m.revenue > 0;
      return { rank: idx + 1, m, adsPct, cpl, cpo, chot, status, isBurn };
    });
  }, [byMarketer]);

  const daily = useMemo(() => buildDailySeries(rows), [rows]);

  const chartModel = useMemo(() => {
    const W = 700;
    const H = 300;
    const padL = 36;
    const padR = 8;
    const padB = 8;
    const padT = 8;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    if (daily.length === 0) {
      return { spendPts: [] as { x: number; y: number }[], revPts: [] as { x: number; y: number }[], maxY: 1, W, H, padL, padB, yLabels: ['0', '0', '0', '0'], xTickIdx: [] as number[], xTickLabels: [] as string[] };
    }
    const maxY = Math.max(1, ...daily.map((d) => Math.max(d.spend, d.rev)));
    const n = daily.length;
    const xAt = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v: number) => padT + innerH - (v / maxY) * innerH;
    const spendPts = daily.map((d, i) => ({ x: xAt(i), y: yAt(d.spend) }));
    const revPts = daily.map((d, i) => ({ x: xAt(i), y: yAt(d.rev) }));
    const fmtY = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}k`);
    const yLabels = [maxY, (maxY * 2) / 3, maxY / 3, 0].map((v) => fmtY(v));
    const tickIdx = [0, Math.floor((n - 1) / 4), Math.floor((n - 1) / 2), Math.floor((3 * (n - 1)) / 4), n - 1].filter((i, j, a) => a.indexOf(i) === j);
    const xTickLabels = tickIdx.map((i) => {
      const raw = daily[i]?.date || '';
      const [y, mo, da] = raw.split('-');
      if (!y || !mo || !da) return '';
      const dt = new Date(Number(y), Number(mo) - 1, Number(da));
      return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' });
    });
    return { spendPts, revPts, maxY, W, H, padL, padB, yLabels, xTickIdx: tickIdx, xTickLabels };
  }, [daily]);

  const heatCells = useMemo(() => {
    const last = daily.slice(-14);
    const mx = Math.max(1, ...last.map((d) => d.spend + d.rev));
    const intensities = last.map((d) => (d.spend + d.rev) / mx);
    while (intensities.length < 14) intensities.unshift(0);
    return intensities.slice(-14);
  }, [daily]);

  const topMarketers = useMemo(() => byMarketer.slice(0, 5), [byMarketer]);

  const tableRows = useMemo(() => {
    const base = rankRows;
    if (!filterStatus) return base;
    return base.filter((r) => r.status !== 'good');
  }, [rankRows, filterStatus]);

  const exportCsv = useCallback(() => {
    const headers = ['Hạng', 'Tên', 'Team', 'Doanh thu', 'Chi phí', 'Ads/DT%', 'Trạng thái'];
    const lines = [
      headers.join(','),
      ...tableRows.map((r) =>
        [
          r.rank,
          `"${(r.m.displayName || '').replace(/"/g, '""')}"`,
          `"${(r.m.team || '').replace(/"/g, '""')}"`,
          r.m.revenue,
          r.m.adCost,
          r.m.revenue > 0 ? r.adsPct.toFixed(2) : '',
          r.status,
        ].join(',')
      ),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `admin-dash-${monthStart.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [tableRows, monthStart]);

  const TrendPill: React.FC<{
    delta: number | null;
    invert?: boolean;
    goodUp?: boolean;
  }> = ({ delta, invert, goodUp }) => {
    if (delta == null || !Number.isFinite(delta)) {
      return (
        <span className="leader-dash-label text-xs font-bold text-[var(--ld-on-surface-variant)] flex items-center bg-[color-mix(in_srgb,var(--ld-on-surface-variant)_8%,transparent)] px-2 py-1 rounded-full">
          —
        </span>
      );
    }
    const up = delta > 0;
    const isGood = invert ? !up : goodUp ? up : !up;
    const Icon = up ? 'trending_up' : 'trending_down';
    const cls = isGood
      ? 'text-[var(--ld-secondary)] bg-[color-mix(in_srgb,var(--ld-secondary-container)_10%,transparent)]'
      : 'text-[var(--ld-error)] bg-[color-mix(in_srgb,var(--ld-error-container)_10%,transparent)]';
    return (
      <span className={`leader-dash-label text-xs font-bold flex items-center px-2 py-1 rounded-full ${cls}`}>
        <span className="material-symbols-outlined text-xs mr-1">{Icon}</span>
        {Math.abs(delta).toFixed(2)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="leader-dash-obsidian dash-fade-up flex items-center justify-center min-h-[240px] gap-3 text-[var(--ld-on-surface-variant)]">
        <Loader2 className="animate-spin text-[var(--ld-primary)]" size={24} />
        <span className="text-sm font-semibold">Đang tải {REPORTS_TABLE}…</span>
      </div>
    );
  }

  return (
    <div className="leader-dash-obsidian dash-fade-up text-[var(--ld-on-surface)] -m-[12px] p-6 sm:p-8 space-y-8 pb-12">
      {error ? (
        <div className="text-[12px] text-[var(--ld-error)] border border-[var(--ld-error)]/25 rounded-xl px-4 py-3 bg-[color-mix(in_srgb,var(--ld-error)_12%,transparent)] flex flex-wrap items-center gap-3">
          {error}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ld-primary)] hover:underline"
          >
            <RefreshCw size={12} /> Thử lại
          </button>
        </div>
      ) : null}

      <p className="text-[10px] text-[var(--ld-on-surface-variant)] leading-relaxed max-w-3xl">
        <strong className="text-[var(--ld-on-surface)]">Nguồn:</strong>{' '}
        <code className="text-[var(--ld-primary)]/90">{REPORTS_TABLE}</code> · tháng {monthLabel}. So sánh % là tháng trước (
        {prevBounds.start.slice(0, 7)}).
      </p>

      {/* Summary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl flex flex-col justify-between hover:bg-[var(--ld-surface-container-high)] transition-all border border-[var(--ld-outline-variant)]/10">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="p-2 bg-[color-mix(in_srgb,var(--ld-error-container)_20%,transparent)] rounded-lg">
              <span className="material-symbols-outlined text-[var(--ld-error)]" style={iconFill}>
                payments
              </span>
            </div>
            <TrendPill delta={spendDelta} invert />
          </div>
          <div>
            <p className="leader-dash-label text-xs text-[var(--ld-on-surface-variant)] uppercase tracking-wider mb-1">Tổng chi tiêu</p>
            <h3 className="text-2xl font-extrabold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
              {formatVndDots(totals.adCost)} <span className="text-sm font-medium text-[var(--ld-on-surface-variant)]">VND</span>
            </h3>
            {totals.adsDtPct != null ? (
              <p className="text-[10px] text-[var(--ld-on-surface-variant)] mt-1">Ads/DT: {totals.adsDtPct.toFixed(1)}%</p>
            ) : null}
          </div>
        </div>

        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl flex flex-col justify-between hover:bg-[var(--ld-surface-container-high)] transition-all border border-[var(--ld-outline-variant)]/10">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="p-2 bg-[color-mix(in_srgb,var(--ld-secondary-container)_20%,transparent)] rounded-lg">
              <span className="material-symbols-outlined text-[var(--ld-secondary)]" style={iconFill}>
                account_balance_wallet
              </span>
            </div>
            <TrendPill delta={revDelta} goodUp />
          </div>
          <div>
            <p className="leader-dash-label text-xs text-[var(--ld-on-surface-variant)] uppercase tracking-wider mb-1">Tổng doanh thu</p>
            <h3 className="text-2xl font-extrabold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
              {formatVndDots(totals.revenue)} <span className="text-sm font-medium text-[var(--ld-on-surface-variant)]">VNĐ</span>
            </h3>
          </div>
        </div>

        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl flex flex-col justify-between hover:bg-[var(--ld-surface-container-high)] transition-all border border-[var(--ld-outline-variant)]/10">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="p-2 bg-[color-mix(in_srgb,var(--ld-tertiary-container)_20%,transparent)] rounded-lg">
              <span className="material-symbols-outlined text-[var(--ld-tertiary)]" style={iconFill}>
                analytics
              </span>
            </div>
            {roiDelta != null && Number.isFinite(roiDelta) ? (
              <span
                className={`leader-dash-label text-xs font-bold flex items-center px-2 py-1 rounded-full ${
                  roiDelta >= 0
                    ? 'text-[var(--ld-secondary)] bg-[color-mix(in_srgb,var(--ld-secondary-container)_10%,transparent)]'
                    : 'text-[var(--ld-error)] bg-[color-mix(in_srgb,var(--ld-error-container)_10%,transparent)]'
                }`}
              >
                <span className="material-symbols-outlined text-xs mr-1">{roiDelta >= 0 ? 'trending_up' : 'trending_down'}</span>
                {roiDelta >= 0 ? '+' : ''}
                {roiDelta.toFixed(2)} điểm %
              </span>
            ) : (
              <span className="leader-dash-label text-xs font-bold text-[var(--ld-on-surface-variant)] bg-[color-mix(in_srgb,var(--ld-on-surface-variant)_8%,transparent)] px-2 py-1 rounded-full">
                —
              </span>
            )}
          </div>
          <div>
            <p className="leader-dash-label text-xs text-[var(--ld-on-surface-variant)] uppercase tracking-wider mb-1">ROI tổng thể</p>
            <h3 className="text-2xl font-extrabold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
              {roiNow != null ? `${roiNow.toFixed(2)}%` : '—'}
            </h3>
            <p className="text-[10px] text-[var(--ld-on-surface-variant)] mt-1 italic">(DT − Chi) / Chi · tháng hiện tại</p>
          </div>
        </div>

        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl flex flex-col justify-between hover:bg-[var(--ld-surface-container-high)] transition-all border border-[var(--ld-outline-variant)]/10">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="p-2 bg-[color-mix(in_srgb,var(--ld-primary-container)_20%,transparent)] rounded-lg">
              <span className="material-symbols-outlined text-[var(--ld-primary)]" style={iconFill}>
                rocket_launch
              </span>
            </div>
            <span className="leader-dash-label text-xs font-bold text-[var(--ld-primary)] flex items-center bg-[color-mix(in_srgb,var(--ld-primary-container)_10%,transparent)] px-2 py-1 rounded-full border border-[var(--ld-primary)]/20">
              Active
            </span>
          </div>
          <div>
            <p className="leader-dash-label text-xs text-[var(--ld-on-surface-variant)] uppercase tracking-wider mb-1">MKT có dữ liệu</p>
            <h3 className="text-2xl font-extrabold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
              {activeCampaigns}
            </h3>
            <p className="text-[10px] text-[var(--ld-on-surface-variant)] mt-1">
              Cảnh báo Ads/DT ≥ {ADS_DT_WARN}%: <span className="text-[var(--ld-error)] font-bold">{burnMarketers.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Danh sách toàn bộ code với bộ lọc theo ngày */}
      <div className="bg-[var(--ld-surface-container-low)] p-4 rounded-xl border border-[var(--ld-outline-variant)]/10 space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="leader-dash-label text-[10px] uppercase tracking-widest font-bold text-[var(--ld-on-surface-variant)]">
              Từ ngày
            </span>
            <input
              type="date"
              value={codesFrom}
              onChange={(e) => setCodesFrom(e.target.value || monthStart)}
              className="bg-[var(--ld-surface-container-highest)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="leader-dash-label text-[10px] uppercase tracking-widest font-bold text-[var(--ld-on-surface-variant)]">
              Đến ngày
            </span>
            <input
              type="date"
              value={codesTo}
              onChange={(e) => setCodesTo(e.target.value || monthEnd)}
              className="bg-[var(--ld-surface-container-highest)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadCodes()}
            disabled={codesLoading}
            className="rounded-lg bg-[var(--ld-primary)] text-[var(--ld-on-primary)] px-4 py-2 text-sm font-bold uppercase tracking-widest"
          >
            {codesLoading ? 'Đang tải…' : 'Lấy danh sách'}
          </button>
          <label className="flex items-center gap-2 text-[12px] text-[var(--ld-on-surface-variant)]">
            <input
              type="checkbox"
              checked={codesAll}
              onChange={(e) => setCodesAll(e.target.checked)}
              className="accent-[var(--ld-primary)]"
            />
            Bỏ lọc ngày (lấy tất cả)
          </label>
          <p className="leader-dash-label text-xs text-[var(--ld-on-surface-variant)]">
            Mã nhân sự (code): {codesList.length}
          </p>
        </div>
        {codesList.length === 0 ? (
          <p className="text-[12px] text-[var(--ld-on-surface-variant)]">Chưa có mã code trong phạm vi lọc.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {codesList.map((c) => (
              <span
                key={c}
                className="text-[12px] font-bold px-2 py-1 rounded bg-[color-mix(in_srgb,var(--ld-surface-container-highest)_40%,transparent)] text-[var(--ld-on-surface)] border border-[var(--ld-outline-variant)]/20"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        <section className="col-span-12 lg:col-span-8 bg-[var(--ld-surface-container-low)] rounded-xl p-6 sm:p-8 overflow-hidden border border-[var(--ld-outline-variant)]/10">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-xl font-bold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
                Chi tiêu quảng cáo vs Doanh thu theo thời gian
              </h2>
              <p className="text-sm text-[var(--ld-on-surface-variant)] leader-dash-label mt-1">
                Gộp theo ngày trong tháng {monthLabel} · {daily.length} ngày có dữ liệu
              </p>
            </div>
            <div className="flex gap-6 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[var(--ld-error)]" />
                <span className="text-xs text-[var(--ld-on-surface-variant)] leader-dash-label">Chi tiêu</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[var(--ld-secondary)]" />
                <span className="text-xs text-[var(--ld-on-surface-variant)] leader-dash-label">Doanh thu</span>
              </div>
            </div>
          </div>

          <div className="relative h-[320px] w-full flex items-end justify-between px-1">
            {daily.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--ld-on-surface-variant)]">
                Chưa có điểm dữ liệu theo ngày trong tháng.
              </div>
            ) : (
              <>
                <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-[var(--ld-on-surface-variant)]/50 leader-dash-label w-8 text-right pr-1">
                  {chartModel.yLabels.map((lb, i) => (
                    <span key={i}>{lb}</span>
                  ))}
                </div>
                <div className="absolute inset-0 left-8 bottom-6 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="border-b border-[var(--ld-outline-variant)]/10 w-full" />
                  ))}
                </div>
                <svg
                  className="absolute inset-0 left-8 h-[calc(100%-1.5rem)] w-[calc(100%-2rem)]"
                  viewBox={`0 0 ${chartModel.W} ${chartModel.H}`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id={`adminGradSpend-${chartId}`} x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#ff716c" stopOpacity={1} />
                      <stop offset="100%" stopColor="#ff716c" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={`adminGradRev-${chartId}`} x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#69f6b8" stopOpacity={1} />
                      <stop offset="100%" stopColor="#69f6b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path
                    d={svgPathArea(chartModel.spendPts, chartModel.H - chartModel.padB)}
                    fill={`url(#adminGradSpend-${chartId})`}
                    opacity={0.12}
                  />
                  <path
                    d={svgPathArea(chartModel.revPts, chartModel.H - chartModel.padB)}
                    fill={`url(#adminGradRev-${chartId})`}
                    opacity={0.12}
                  />
                  <path
                    d={svgPathLine(chartModel.spendPts)}
                    fill="none"
                    stroke="#ff716c"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  <path
                    d={svgPathLine(chartModel.revPts)}
                    fill="none"
                    stroke="#69f6b8"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </svg>
              </>
            )}
          </div>
          {daily.length > 0 && (
            <div className="mt-2 flex justify-between pl-8 pr-2 text-[10px] text-[var(--ld-on-surface-variant)] leader-dash-label uppercase tracking-widest">
              {chartModel.xTickLabels.map((lb, i) => (
                <span key={i}>{lb}</span>
              ))}
            </div>
          )}
        </section>

        <aside className="col-span-12 lg:col-span-4 bg-[var(--ld-surface-container-low)] rounded-xl p-6 border border-[var(--ld-outline-variant)]/10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
              Hiệu suất MKT
            </h2>
            <button
              type="button"
              onClick={() => navigate(crmAdminPathForView('admin-ranking'))}
              className="text-xs text-[var(--ld-primary)] leader-dash-label hover:underline"
            >
              Xem tất cả
            </button>
          </div>
          <div className="space-y-4">
            {topMarketers.length === 0 ? (
              <p className="text-xs text-[var(--ld-on-surface-variant)]">Chưa có marketer trong tháng.</p>
            ) : (
              topMarketers.map((m) => {
                const roiM = roiPct(m.revenue, m.adCost);
                const roiLabel = roiM != null ? `${roiM.toFixed(1)}% ROI` : '—';
                const roiGood = roiM != null && roiM >= 10;
                const roiBad = roiM != null && roiM < 0;
                return (
                  <div
                    key={m.key}
                    className="bg-[var(--ld-surface-container)] p-4 rounded-lg flex items-center justify-between hover:bg-[var(--ld-surface-container-highest)] transition-colors cursor-pointer border border-transparent hover:border-[var(--ld-outline-variant)]/20"
                    onClick={() => navigate(crmAdminPathForView('admin-ranking'))}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(crmAdminPathForView('admin-ranking'))}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[var(--ld-surface-container-low)] flex items-center justify-center overflow-hidden border border-[var(--ld-outline-variant)]/20 shrink-0 text-sm font-bold text-[var(--ld-primary)]">
                        {(m.displayName || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-[var(--ld-on-surface)] truncate">{m.displayName}</h4>
                        <p className="text-[10px] text-[var(--ld-on-surface-variant)] leader-dash-label uppercase tracking-tight truncate">
                          {m.team || 'Marketing'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <p className="text-sm font-bold text-[var(--ld-on-surface)]">{formatCompactVnd(m.revenue)}</p>
                      <span
                        className={`text-[10px] font-bold leader-dash-label px-1.5 py-0.5 rounded ${
                          roiBad
                            ? 'text-[var(--ld-error)] bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)]'
                            : roiGood
                              ? 'text-[var(--ld-secondary)] bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)]'
                              : 'text-[var(--ld-tertiary)] bg-[color-mix(in_srgb,var(--ld-tertiary)_10%,transparent)]'
                        }`}
                      >
                        {roiLabel}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-[var(--ld-surface-container-lowest)] border border-[var(--ld-outline-variant)]/10">
            <h4 className="text-xs font-bold text-[var(--ld-on-surface-variant)] mb-3 uppercase tracking-widest leader-dash-label">
              Phân bổ hoạt động (14 ngày gần nhất)
            </h4>
            <div className="grid grid-cols-7 gap-1">
              {heatCells.map((intensity, i) => {
                const tier = intensity < 0.25 ? 0.2 : intensity < 0.5 ? 0.45 : intensity < 0.75 ? 0.7 : 1;
                const color =
                  intensity < 0.15
                    ? 'bg-[var(--ld-surface-container-highest)]'
                    : intensity < 0.45
                      ? 'bg-[var(--ld-secondary)]'
                      : intensity < 0.75
                        ? 'bg-[var(--ld-tertiary)]'
                        : 'bg-[var(--ld-error)]';
                return <div key={i} className={`h-4 rounded-sm ${color}`} style={{ opacity: 0.25 + tier * 0.55 }} />;
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Detail table */}
      <div className="bg-[var(--ld-surface-container-low)] rounded-xl p-6 sm:p-8 border border-[var(--ld-outline-variant)]/10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h2 className="text-lg font-bold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
            Danh sách chi tiết (theo MKT)
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!tableRows.length}
              className="bg-[var(--ld-surface-container)] px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-on-surface)] border border-[var(--ld-outline-variant)]/10 transition-colors disabled:opacity-40"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterStatus
                  ? 'bg-[var(--ld-primary-container)]/30 text-[var(--ld-primary)] border-[var(--ld-primary)]/30'
                  : 'bg-[var(--ld-surface-container)] text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-on-surface)] border-[var(--ld-outline-variant)]/10'
              }`}
            >
              {filterStatus ? 'Hiện tất cả' : 'Lọc cần tối ưu'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 bg-[var(--ld-surface-container)] px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--ld-on-surface-variant)] border border-[var(--ld-outline-variant)]/10 hover:text-[var(--ld-on-surface)]"
            >
              <RefreshCw size={12} />
              Làm mới
            </button>
          </div>
        </div>
        <div className="overflow-x-auto leader-dash-no-scrollbar">
          <table className="w-full text-left min-w-[720px]">
            <thead className="border-b border-[var(--ld-outline-variant)]/10">
              <tr className="text-[10px] font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-widest leader-dash-label">
                <th className="pb-4 px-2">Kênh / Team</th>
                <th className="pb-4 px-2">MKT</th>
                <th className="pb-4 px-2">Chi phí</th>
                <th className="pb-4 px-2">Doanh thu</th>
                <th className="pb-4 px-2">Ads/DT</th>
                <th className="pb-4 px-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[var(--ld-on-surface-variant)]">
                    {filterStatus ? 'Không có MKT nào ngoài mức “Tốt”.' : `Chưa có dòng trong ${REPORTS_TABLE} cho tháng này.`}
                  </td>
                </tr>
              ) : (
                tableRows.map(({ m, adsPct, status }) => (
                  <tr
                    key={m.key}
                    className="group border-b border-transparent hover:bg-[var(--ld-surface-container-high)] transition-colors"
                  >
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[var(--ld-primary)] text-sm">social_leaderboard</span>
                        <span className="text-sm font-semibold text-[var(--ld-on-surface)]">{m.team || '—'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-sm text-[var(--ld-on-surface-variant)]">{m.displayName}</td>
                    <td className="py-4 px-2 text-sm text-[var(--ld-error)] font-semibold tabular-nums">{formatVndDots(m.adCost)}</td>
                    <td className="py-4 px-2 text-sm text-[var(--ld-secondary)] font-semibold tabular-nums">{formatVndDots(m.revenue)}</td>
                    <td className="py-4 px-2 text-sm font-medium tabular-nums text-[var(--ld-on-surface)]">
                      {m.revenue > 0 ? `${adsPct.toFixed(1)}%` : m.adCost > 0 ? '—' : '0%'}
                    </td>
                    <td className="py-4 px-2">
                      {status === 'bad' ? (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)] text-[var(--ld-error)] uppercase leader-dash-label">
                          Cần tối ưu
                        </span>
                      ) : status === 'med' ? (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-[color-mix(in_srgb,var(--ld-tertiary)_10%,transparent)] text-[var(--ld-tertiary)] uppercase leader-dash-label">
                          Theo dõi
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)] text-[var(--ld-secondary)] uppercase leader-dash-label">
                          Tốt
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
