import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Eye, Loader2, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../../../api/supabase';
import type { Employee, ReportRow } from '../../../types';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';
import { formatCompactVnd, formatReportDateVi } from '../mkt/mktDetailReportShared';

const REPORTS_TABLE = 'detail_reports';
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const STAFF_FOR_DASH_SELECT = 'name, team, ma_ns';

const ADMIN_DASH_PAGE_SIZE = 1000;
const ADMIN_DASH_MAX_PAGES = 500;
const ADMIN_DASH_DETAIL_SELECT =
  'id, report_date, name, team, code, ad_cost, tien_viet, order_count, tong_lead, tong_data_nhan, mess_comment_count';

async function fetchAllAdminDetailReports(
  start: string,
  end: string
): Promise<{ data: ReportRow[]; error: { message: string } | null }> {
  const all: ReportRow[] = [];
  let lastId: string | null = null;
  for (let p = 0; p < ADMIN_DASH_MAX_PAGES; p++) {
    let q = supabase
      .from(REPORTS_TABLE)
      .select(ADMIN_DASH_DETAIL_SELECT)
      .gte('report_date', start)
      .lte('report_date', end)
      .order('id', { ascending: true })
      .limit(ADMIN_DASH_PAGE_SIZE);
    if (lastId) q = q.gt('id', lastId);
    const { data, error } = await q;
    if (error) return { data: [], error: { message: error.message } };
    const batch = (data || []) as ReportRow[];
    if (!batch.length) break;
    all.push(...batch);
    const raw = batch[batch.length - 1]?.id;
    const next = raw == null ? '' : String(raw);
    if (!next) break;
    lastId = next;
    if (batch.length < ADMIN_DASH_PAGE_SIZE) break;
  }
  return { data: all, error: null };
}

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

function previousPeriodBounds(start: string, end: string): { start: string; end: string } {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return { start: toLocalYyyyMmDd(startOfMonth(d)), end: toLocalYyyyMmDd(endOfMonth(d)) };
  }
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  const previousEnd = new Date(startDate);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  return {
    start: toLocalYyyyMmDd(previousStart),
    end: toLocalYyyyMmDd(previousEnd),
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

/**
 * Admin dashboard: doanh thu VND chỉ từ cột tien_viet.
 * Không cộng/quy đổi từ revenue (tránh lẫn tổng doanh số theo đơn / USD trên báo cáo).
 */
function adminRevenueVnd(r: Pick<ReportRow, 'tien_viet'>): number {
  if (r.tien_viet == null) return 0;
  return Math.round(safeNum(r.tien_viet));
}

/** Chuẩn hóa mã trên detail_reports / ma_ns: trim, NBSP → space, gộp khoảng trắng liên tiếp. */
function normalizeDetailCode(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Key gom nhóm + khớp nhân sự: chữ thường sau normalize; rỗng → null. */
function codeKey(raw: string | null | undefined): string | null {
  const n = normalizeDetailCode(raw);
  return n ? n.toLowerCase() : null;
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

type StaffLite = { name: string; team: string };

function buildStaffMaps(rows: Employee[]): { byCode: Map<string, StaffLite> } {
  const byCode = new Map<string, StaffLite>();
  for (const e of rows) {
    const name = (e.name || '').trim();
    const team = (e.team || '').trim();
    const lite: StaffLite = { name, team };
    const k = codeKey(e.ma_ns);
    if (k) byCode.set(k, lite);
  }
  return { byCode };
}

/** Khớp employees.ma_ns ↔ detail_reports.code (cùng normalize + không phân biệt hoa thường). */
function resolveStaffFromMaps(code: string | null, maps: { byCode: Map<string, StaffLite> }): StaffLite | null {
  const k = codeKey(code);
  if (k && maps.byCode.has(k)) return maps.byCode.get(k)!;
  return null;
}

/** Gom dòng theo code đã chuẩn hóa; bỏ dòng không có code. */
function groupRowsByMarketerKey(rows: ReportRow[]): Map<string, ReportRow[]> {
  const map = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const k = codeKey(r.code);
    if (!k) continue;
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

const ADS_DT_WARN = 45;
const ADS_DT_MED = 30;

const iconFill: React.CSSProperties = { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" };

function aggregateRows(rows: ReportRow[]) {
  let revenue = 0;
  let adCost = 0;
  let tongLead = 0;
  let orders = 0;
  let tongData = 0;
  let mess = 0;
  for (const r of rows) {
    revenue += adminRevenueVnd(r);
    adCost += safeNum(r.ad_cost);
    tongLead += safeNum(r.tong_lead);
    orders += safeNum(r.order_count);
    tongData += safeNum(r.tong_data_nhan);
    mess += safeNum(r.mess_comment_count);
  }
  const adsDtPct = revenue > 0 ? (adCost / revenue) * 100 : null;
  const chotPct = tyLeChot(tongData, orders, tongLead);
  return { revenue, adCost, tongLead, orders, tongData, mess, adsDtPct, chotPct };
}

type DailyPoint = {
  date: string;
  spend: number;
  rev: number;
  leads: number;
  data: number;
  orders: number;
  mess: number;
  adsPct: number;
};

function buildDailySeries(rows: ReportRow[], from: string, to: string): DailyPoint[] {
  const map = new Map<string, Omit<DailyPoint, 'date' | 'adsPct'>>();
  for (const r of rows) {
    const d = r.report_date?.slice(0, 10);
    if (!d) continue;
    const cur = map.get(d) || { spend: 0, rev: 0, leads: 0, data: 0, orders: 0, mess: 0 };
    cur.spend += safeNum(r.ad_cost);
    cur.rev += adminRevenueVnd(r);
    cur.leads += safeNum(r.tong_lead);
    cur.data += safeNum(r.tong_data_nhan);
    cur.orders += safeNum(r.order_count);
    cur.mess += safeNum(r.mess_comment_count);
    map.set(d, cur);
  }
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ ...v, date, adsPct: v.rev > 0 ? (v.spend / v.rev) * 100 : 0 }));
  }
  const points: DailyPoint[] = [];
  const cursor = new Date(start);
  for (let i = 0; cursor <= end && i < 370; i += 1, cursor.setDate(cursor.getDate() + 1)) {
    const date = toLocalYyyyMmDd(cursor);
    const value = map.get(date) || { spend: 0, rev: 0, leads: 0, data: 0, orders: 0, mess: 0 };
    points.push({ ...value, date, adsPct: value.rev > 0 ? (value.spend / value.rev) * 100 : 0 });
  }
  return points;
}

type AdminDashboardProps = { viewer?: { name?: string; email?: string; team?: string; avatar_url?: string | null; vi_tri?: string | null } | null };

const MetricCard: React.FC<{
  title: string;
  value: string;
  detail: string;
  icon: string;
  color: string;
  badge?: string;
}> = ({ title, value, detail, icon, color, badge }) => (
  <article className="personal-kpi-card">
    <div className="flex items-start justify-between gap-3">
      <div className="personal-kpi-icon" style={{ background: `${color}1a`, color }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      {badge && <span className="personal-kpi-badge" style={{ color, borderColor: `${color}55`, background: `${color}15` }}>{badge}</span>}
    </div>
    <div className="relative z-[1] mt-4">
      <p className="personal-kpi-title">{title}</p>
      <p className="personal-kpi-value">{value}</p>
      <p className="personal-kpi-detail">{detail}</p>
    </div>
    <div className="personal-kpi-bars" aria-hidden="true">
      {[22, 35, 27, 48, 40, 68, 54, 78].map((height, index) => (
        <span key={index} style={{ height: `${height}%`, background: color }} />
      ))}
    </div>
  </article>
);

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

export const AdminDashboardView: React.FC<AdminDashboardProps> = ({ viewer }) => {
  const chartId = React.useId().replace(/:/g, '');
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [prevRows, setPrevRows] = useState<ReportRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState(false);
  const [mktDetailKey, setMktDetailKey] = useState<string | null>(null);

  const monthRef = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => toLocalYyyyMmDd(startOfMonth(monthRef)), [monthRef]);
  const monthEnd = useMemo(() => toLocalYyyyMmDd(endOfMonth(monthRef)), [monthRef]);
  const today = useMemo(() => toLocalYyyyMmDd(monthRef), [monthRef]);
  const [rangeStart, setRangeStart] = useState(monthStart);
  const [rangeEnd, setRangeEnd] = useState(today);
  const [rangePreset, setRangePreset] = useState<'yesterday' | '7days' | 'month' | 'custom'>('month');
  const monthLabel = `${formatReportDateVi(rangeStart)} – ${formatReportDateVi(rangeEnd)}`;
  const prevBounds = useMemo(() => previousPeriodBounds(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const setQuickRange = (preset: 'yesterday' | '7days' | 'month') => {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);
    if (preset === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (preset === '7days') {
      start.setDate(start.getDate() - 6);
    } else {
      start = startOfMonth(now);
    }
    setRangeStart(toLocalYyyyMmDd(start));
    setRangeEnd(toLocalYyyyMmDd(end));
    setRangePreset(preset);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [curFull, prevFull, empRes] = await Promise.all([
      fetchAllAdminDetailReports(rangeStart, rangeEnd),
      fetchAllAdminDetailReports(prevBounds.start, prevBounds.end),
      supabase.from(EMPLOYEES_TABLE).select(STAFF_FOR_DASH_SELECT).limit(8000),
    ]);

    let empList: Employee[] = [];
    if (empRes.error) {
      console.warn('admin-dash employees:', empRes.error);
    } else {
      empList = (empRes.data || []) as Employee[];
    }

    if (curFull.error) {
      console.error('admin-dash detail_reports:', curFull.error);
      setError(curFull.error.message || 'Không tải được báo cáo.');
      setRows([]);
      setPrevRows([]);
      setEmployees(empList);
      setLoading(false);
      return;
    }

    let prevRowsData: ReportRow[] = [];
    if (prevFull.error) {
      console.warn('admin-dash prev month:', prevFull.error);
    } else {
      prevRowsData = prevFull.data;
    }

    setEmployees(empList);
    setRows(curFull.data);
    setPrevRows(prevRowsData);
    setLoading(false);
  }, [rangeStart, rangeEnd, prevBounds.start, prevBounds.end]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => aggregateRows(rows), [rows]);
  const prevTotals = useMemo(() => aggregateRows(prevRows), [prevRows]);

  const spendDelta = pctChange(totals.adCost, prevTotals.adCost);
  const revDelta = pctChange(totals.revenue, prevTotals.revenue);
  const cpaMessNow = totals.mess > 0 ? totals.adCost / totals.mess : null;
  const cpaMessPrev = prevTotals.mess > 0 ? prevTotals.adCost / prevTotals.mess : null;
  const cpaMessDeltaPct =
    cpaMessNow != null && cpaMessPrev != null ? pctChange(cpaMessNow, cpaMessPrev) : null;
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
        const c = normalizeDetailCode(r.code);
        if (c) s.add(c);
      }
      setCodesList([...s].sort((a, b) => a.localeCompare(b)));
    } finally {
      setCodesLoading(false);
    }
  }, [codesFrom, codesTo, codesAll]);

  const staffMaps = useMemo(() => buildStaffMaps(employees), [employees]);

  const byMarketer = useMemo(() => {
    type AggBuild = MarketerAgg & { aggCode: string | null };
    const map = new Map<string, AggBuild>();
    for (const r of rows) {
      const k = codeKey(r.code);
      if (!k) continue;
      const codeDisplay = normalizeDetailCode(r.code);
      const cur =
        map.get(k) ||
        ({
          key: k,
          displayName: codeDisplay,
          team: r.team?.trim() || null,
          aggCode: codeDisplay,
          revenue: 0,
          adCost: 0,
          tongLead: 0,
          orders: 0,
          tongData: 0,
        } satisfies AggBuild);
      cur.revenue += adminRevenueVnd(r);
      cur.adCost += safeNum(r.ad_cost);
      cur.tongLead += safeNum(r.tong_lead);
      cur.orders += safeNum(r.order_count);
      cur.tongData += safeNum(r.tong_data_nhan);
      if (!cur.aggCode && codeDisplay) cur.aggCode = codeDisplay;
      if (!cur.team && r.team?.trim()) cur.team = r.team.trim();
      map.set(k, cur);
    }

    const out: MarketerAgg[] = [];
    for (const m of map.values()) {
      const staff = resolveStaffFromMaps(m.aggCode, staffMaps);
      /** Tên MKT chỉ từ nhân sự (ma_ns ↔ code); không dùng email / name trên dòng báo cáo. */
      const displayName = staff?.name?.trim() || m.aggCode?.trim() || '—';
      const team = staff?.team?.trim() ? staff.team.trim() : m.team || null;
      out.push({
        key: m.key,
        displayName,
        team,
        revenue: m.revenue,
        adCost: m.adCost,
        tongLead: m.tongLead,
        orders: m.orders,
        tongData: m.tongData,
      });
    }
    return out.sort((a, b) => b.revenue - a.revenue);
  }, [rows, staffMaps]);

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

  const daily = useMemo(() => buildDailySeries(rows, rangeStart, rangeEnd), [rows, rangeStart, rangeEnd]);

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

  const rowsByMktKey = useMemo(() => groupRowsByMarketerKey(rows), [rows]);

  const mktDetailRows = useMemo(
    () => (mktDetailKey ? rowsByMktKey.get(mktDetailKey) ?? [] : []),
    [mktDetailKey, rowsByMktKey]
  );

  const mktDetailTitle = useMemo(() => {
    if (!mktDetailKey) return '';
    const hit = byMarketer.find((x) => x.key === mktDetailKey);
    return hit?.displayName || mktDetailKey;
  }, [mktDetailKey, byMarketer]);

  useEffect(() => {
    if (!mktDetailKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMktDetailKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mktDetailKey]);

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

  const leadCount = totals.tongLead || totals.tongData;
  const previousLeadCount = prevTotals.tongLead || prevTotals.tongData;
  const closeRate = tyLeChot(totals.tongData, totals.orders, totals.tongLead);
  const costPerLead = leadCount > 0 ? totals.adCost / leadCount : null;
  const costPerOrder = totals.orders > 0 ? totals.adCost / totals.orders : null;
  const averageOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : null;
  const adsRevenuePct = totals.revenue > 0 ? (totals.adCost / totals.revenue) * 100 : null;
  const deltaText = (delta: number | null) => delta == null ? 'Chưa có kỳ so sánh' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% so kỳ trước`;
  const dailyRows = daily.filter((point) => point.spend || point.rev || point.leads || point.data || point.orders || point.mess);
  const displayName = viewer?.name?.trim() || viewer?.email?.trim() || 'Tài khoản';
  const displayRole = viewer?.vi_tri?.trim() || viewer?.team?.trim() || 'Marketing';
  const avatarInitials = displayName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();

  const exportDailyCsv = () => {
    const headers = ['Ngày', 'Tin nhắn', 'Lead', 'Data nhận', 'Đơn', 'Tỷ lệ chốt (%)', 'Doanh số (VND)', 'Chi phí quảng cáo (VND)', 'CP/DT (%)'];
    const lines = [headers.join(','), ...dailyRows.map((point) => {
      const close = tyLeChot(point.data, point.orders, point.leads);
      return [
        point.date,
        point.mess,
        point.leads,
        point.data,
        point.orders,
        close == null ? '' : close.toFixed(2),
        point.rev,
        point.spend,
        point.adsPct.toFixed(2),
      ].join(',');
    })];
    const blob = new Blob(['\ufeff', lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dashboard-ca-nhan-${rangeStart}-${rangeEnd}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

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
    <div className="leader-dash-obsidian admin-personal-dashboard dash-fade-up -m-[12px] min-h-full px-4 py-4 sm:px-6 sm:py-5">
      <header className="personal-dashboard-header">
        <div className="flex min-w-0 items-center gap-4">
          <div className="personal-dashboard-avatar">
            {viewer?.avatar_url ? <img src={viewer.avatar_url} alt="" className="h-full w-full object-cover" /> : avatarInitials || 'U'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{displayName}</p>
            <p className="truncate text-xs text-slate-400">{displayRole}</p>
          </div>
          <div className="mx-1 hidden h-10 w-px bg-slate-700 sm:block" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">Dashboard cá nhân</h1>
            <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">Tổng quan hiệu quả công việc trong kỳ</p>
          </div>
        </div>
        <div className="personal-period-toolbar">
          <div className="personal-period-presets" role="group" aria-label="Chọn khoảng thời gian">
            <CalendarDays size={16} className="mx-1 text-slate-400" />
            <button type="button" onClick={() => setQuickRange('yesterday')} className={rangePreset === 'yesterday' ? 'active' : ''}>Hôm qua</button>
            <button type="button" onClick={() => setQuickRange('7days')} className={rangePreset === '7days' ? 'active' : ''}>7 ngày</button>
            <button type="button" onClick={() => setQuickRange('month')} className={rangePreset === 'month' ? 'active' : ''}>Tháng này</button>
            <button type="button" onClick={() => setRangePreset('custom')} className={rangePreset === 'custom' ? 'active' : ''}>Tùy chọn</button>
          </div>
          <div className="personal-date-range">
            <CalendarDays size={16} className="shrink-0 text-slate-400" />
            <input aria-label="Từ ngày" type="date" value={rangeStart} max={rangeEnd || undefined} onChange={(event) => { setRangeStart(event.target.value); setRangePreset('custom'); }} />
            <span>–</span>
            <input aria-label="Đến ngày" type="date" value={rangeEnd} min={rangeStart || undefined} max={today} onChange={(event) => { setRangeEnd(event.target.value); setRangePreset('custom'); }} />
          </div>
        </div>
      </header>

      {error && (
        <div className="my-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 font-semibold hover:text-white"><RefreshCw size={14} /> Thử lại</button>
        </div>
      )}

      <section className={`personal-alert-banner ${burnMarketers.length ? 'is-alert' : 'is-clear'}`}>
        <div className="personal-alert-icon">
          {burnMarketers.length ? <TriangleAlert size={22} /> : <CheckCircle2 size={22} />}
        </div>
        <div className="min-w-0">
          <h2>{burnMarketers.length ? `${burnMarketers.length} chỉ số đang vượt ngưỡng theo dõi` : 'Các chỉ số quảng cáo đang trong ngưỡng theo dõi'}</h2>
          <p>{burnMarketers.length
            ? `CP/DT từ ${ADS_DT_WARN}% trở lên ở ${burnMarketers.slice(0, 4).map((item) => item.displayName).join(', ')}${burnMarketers.length > 4 ? ` và ${burnMarketers.length - 4} nhân sự khác` : ''}.`
            : `Chưa ghi nhận nhân sự có CP/DT từ ${ADS_DT_WARN}% trong khoảng ${monthLabel}.`}</p>
          <p>{rows.length ? `${rows.length.toLocaleString('vi-VN')} dòng báo cáo · ${activeCampaigns} nhân sự có dữ liệu` : 'Chưa có dữ liệu báo cáo trong khoảng thời gian đã chọn.'}</p>
        </div>
      </section>

      <section className="personal-kpi-grid" aria-label="Chỉ số tổng quan">
        <MetricCard title="Doanh số" value={formatCompactVnd(totals.revenue)} detail={deltaText(revDelta)} icon="bar_chart" color="#09c987" badge="Doanh thu" />
        <MetricCard title="Chi phí quảng cáo" value={formatCompactVnd(totals.adCost)} detail={deltaText(spendDelta)} icon="database" color="#1688ff" badge="Chi phí" />
        <MetricCard title="CP/DT" value={adsRevenuePct == null ? '—' : `${adsRevenuePct.toFixed(1)}%`} detail={`Ngưỡng theo dõi: ${ADS_DT_WARN}%`} icon="pie_chart" color={adsRevenuePct != null && adsRevenuePct >= ADS_DT_WARN ? '#ff4f63' : '#ff9d17'} badge={adsRevenuePct == null ? 'Chưa có dữ liệu' : adsRevenuePct >= ADS_DT_WARN ? 'Cần chú ý' : 'Trong ngưỡng'} />
        <MetricCard title="Tin nhắn" value={Math.round(totals.mess).toLocaleString('vi-VN')} detail={`${deltaText(pctChange(totals.mess, prevTotals.mess))} · theo báo cáo`} icon="forum" color="#7963ff" badge="Tương tác" />
        <MetricCard title="Lead" value={Math.round(leadCount).toLocaleString('vi-VN')} detail={deltaText(pctChange(leadCount, previousLeadCount))} icon="groups" color="#1389f5" badge="Khách hàng tiềm năng" />
        <MetricCard title="Đơn hàng" value={Math.round(totals.orders).toLocaleString('vi-VN')} detail={averageOrderValue == null ? 'Chưa có đơn hàng trong kỳ' : `Giá trị TB ${formatCompactVnd(averageOrderValue)}`} icon="shopping_cart" color="#ffb321" badge="Chuyển đổi" />
        <MetricCard title="Tỷ lệ chốt" value={closeRate == null ? '—' : `${closeRate.toFixed(1)}%`} detail={`${Math.round(totals.orders).toLocaleString('vi-VN')} đơn / ${Math.round(totals.tongData || totals.tongLead).toLocaleString('vi-VN')} data`} icon="track_changes" color="#14c5c9" badge="Hiệu quả" />
        <MetricCard title="CPL" value={costPerLead == null ? '—' : formatCompactVnd(costPerLead)} detail="Chi phí quảng cáo / lead" icon="person_search" color="#37a7ff" badge="Chi phí / lead" />
      </section>

      <section className="personal-panel">
        <div className="personal-panel-heading">
          <div>
            <h2>Doanh thu, chi phí và tỷ lệ CP/DT theo ngày</h2>
            <p>{monthLabel} · {dailyRows.length} ngày có dữ liệu</p>
          </div>
          <div className="personal-chart-legend">
            <span><i className="legend-revenue" />Doanh thu</span>
            <span><i className="legend-spend" />Chi phí quảng cáo</span>
            <span><i className="legend-ratio" />CP/DT</span>
          </div>
        </div>
        <div className="personal-chart-wrap">
          {dailyRows.length === 0 ? (
            <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-slate-400">Chưa có dữ liệu trong khoảng thời gian này.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyRows} margin={{ top: 12, right: 10, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="#20324a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(8, 10)} tick={{ fill: '#a8bad2', fontSize: 11 }} axisLine={{ stroke: '#263a54' }} tickLine={false} />
                <YAxis yAxisId="money" tickFormatter={(value) => formatCompactVnd(Number(value))} tick={{ fill: '#a8bad2', fontSize: 10 }} axisLine={false} tickLine={false} width={56} />
                <YAxis yAxisId="ratio" orientation="right" tickFormatter={(value) => `${Number(value).toFixed(0)}%`} tick={{ fill: '#a8bad2', fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
                <Tooltip
                  contentStyle={{ background: '#101b2b', border: '1px solid #28405e', borderRadius: 10, color: '#e7efff' }}
                  labelFormatter={(label) => formatReportDateVi(String(label))}
                  formatter={(value, name) => [String(name) === 'CP/DT' ? `${Number(value).toFixed(1)}%` : formatCompactVnd(Number(value)), String(name)]}
                />
                <Legend wrapperStyle={{ color: '#c6d5eb', fontSize: 12 }} />
                <ReferenceLine yAxisId="ratio" y={ADS_DT_WARN} stroke="#ff4e87" strokeDasharray="6 5" />
                <Bar yAxisId="money" dataKey="rev" name="Doanh thu" fill="#1cc98a" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar yAxisId="money" dataKey="spend" name="Chi phí quảng cáo" fill="#3978ff" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Line yAxisId="ratio" type="monotone" dataKey="adsPct" name="CP/DT" stroke="#ff8a13" strokeWidth={2.5} dot={{ r: 3, fill: '#ff8a13', stroke: '#071426', strokeWidth: 1 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="personal-panel overflow-hidden">
        <div className="personal-panel-heading">
          <div>
            <h2>Chi tiết theo ngày</h2>
            <p>Dữ liệu tổng hợp từ detail_reports</p>
          </div>
          <button type="button" onClick={exportDailyCsv} disabled={!dailyRows.length} className="personal-export-button">Tải CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="personal-daily-table">
            <thead>
              <tr>
                <th>Ngày</th><th>Tin nhắn</th><th>Lead</th><th>Data</th><th>Đơn</th><th>Tỷ lệ chốt</th><th>Doanh số</th><th>Chi phí</th><th>CP/DT</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">Chưa có dữ liệu để hiển thị.</td></tr>
              ) : dailyRows.map((point) => {
                const pointClose = tyLeChot(point.data, point.orders, point.leads);
                return (
                  <tr key={point.date}>
                    <td>{formatReportDateVi(point.date)}</td>
                    <td>{Math.round(point.mess).toLocaleString('vi-VN')}</td>
                    <td>{Math.round(point.leads).toLocaleString('vi-VN')}</td>
                    <td>{Math.round(point.data).toLocaleString('vi-VN')}</td>
                    <td>{Math.round(point.orders).toLocaleString('vi-VN')}</td>
                    <td className={pointClose != null && pointClose >= 10 ? 'metric-positive' : ''}>{pointClose == null ? '—' : `${pointClose.toFixed(1)}%`}</td>
                    <td className="metric-positive">{formatCompactVnd(point.rev)}</td>
                    <td>{formatCompactVnd(point.spend)}</td>
                    <td className={point.adsPct >= ADS_DT_WARN ? 'metric-negative' : ''}>{point.rev > 0 ? `${point.adsPct.toFixed(1)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <details className="personal-secondary-section">
        <summary>Hiệu suất theo nhân sự · {rankRows.length}</summary>
        <div className="overflow-x-auto pt-4">
          <table className="personal-daily-table">
            <thead><tr><th>Nhân sự</th><th>Team</th><th>Đơn</th><th>Doanh số</th><th>Chi phí</th><th>CP/DT</th><th>Tình trạng</th><th></th></tr></thead>
            <tbody>
              {tableRows.map(({ m, adsPct, status }) => (
                <tr key={m.key}>
                  <td>{m.displayName}</td><td>{m.team || '—'}</td><td>{m.orders.toLocaleString('vi-VN')}</td>
                  <td className="metric-positive">{formatCompactVnd(m.revenue)}</td><td>{formatCompactVnd(m.adCost)}</td>
                  <td className={status === 'bad' ? 'metric-negative' : ''}>{m.revenue > 0 ? `${adsPct.toFixed(1)}%` : '—'}</td>
                  <td>{status === 'bad' ? 'Cần theo dõi' : status === 'med' ? 'Theo dõi' : 'Tốt'}</td>
                  <td><button type="button" onClick={() => setMktDetailKey(m.key)} className="text-sky-300 hover:text-white" aria-label={`Chi tiết ${m.displayName}`}><Eye size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={exportCsv} disabled={!tableRows.length} className="personal-export-button">Tải hiệu suất CSV</button>
            <button type="button" onClick={() => setFilterStatus((value) => !value)} className="personal-export-button">{filterStatus ? 'Hiện tất cả' : 'Chỉ xem cảnh báo'}</button>
          </div>
        </div>
      </details>

      {mktDetailKey != null ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="presentation" onClick={() => setMktDetailKey(null)}>
          <div className="personal-detail-modal" role="dialog" aria-modal="true" aria-labelledby="admin-mkt-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-700/70 px-5 py-4">
              <div className="min-w-0">
                <h3 id="admin-mkt-detail-title" className="truncate text-base font-bold text-white">Chi tiết báo cáo — {mktDetailTitle}</h3>
                <p className="mt-1 text-xs text-slate-400">{monthLabel} · {mktDetailRows.length} dòng trong {REPORTS_TABLE}</p>
              </div>
              <button type="button" onClick={() => setMktDetailKey(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Đóng"><X size={18} /></button>
            </div>
            <div className="overflow-auto p-4">
              <table className="personal-daily-table min-w-[680px]">
                <thead><tr><th>Ngày</th><th>Tên</th><th>Code</th><th>Team</th><th>Chi phí</th><th>Doanh số</th><th>Đơn</th><th>Lead / Data</th></tr></thead>
                <tbody>{mktDetailRows.map((row, index) => (
                  <tr key={row.id ? String(row.id) : `${index}-${row.report_date}-${row.code}`}>
                    <td>{formatReportDateVi(row.report_date?.slice(0, 10) || '')}</td><td>{row.name || '—'}</td><td>{row.code || '—'}</td><td>{row.team || '—'}</td>
                    <td>{formatCompactVnd(safeNum(row.ad_cost))}</td><td className="metric-positive">{formatCompactVnd(adminRevenueVnd(row))}</td><td>{safeNum(row.order_count)}</td><td>{safeNum(row.tong_lead)} / {safeNum(row.tong_data_nhan)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
