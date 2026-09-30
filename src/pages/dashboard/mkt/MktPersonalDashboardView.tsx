import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../../../styles/stitchSystem.css';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Coins,
  Download,
  FileText,
  Filter,
  LockKeyhole,
  Megaphone,
  MessageSquareText,
  MoreVertical,
  Percent,
  RefreshCw,
  ShoppingCart,
  Target,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '../../../api/supabase';
import { fetchAllRows } from '../../../api/fetchAllRows';
import type { AuthUser } from '../../../types';
import { crmNavTierFromUser } from '../../../utils/crmNavAccess';
import {
  REPORTS_TABLE,
  formatCompactVnd,
  formatKpiMoney,
  formatReportDateVi,
  toLocalYyyyMmDd,
} from './mktDetailReportShared';

const KPI_STAFF_TARGETS_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_STAFF_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_staff_monthly_targets';
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';

type PersonOption = { id: string; name: string; email: string; ma_ns: string | null };

type ReportRow = {
  id?: string;
  report_date?: string;
  revenue?: number | string | null;
  tien_viet?: number | string | null;
  ad_cost?: number | string | null;
  mess_comment_count?: number | string | null;
  tong_data_nhan?: number | string | null;
  tong_lead?: number | string | null;
  order_count?: number | string | null;
  email?: string | null;
  code?: string | null;
};

type DailyMetrics = {
  date: string;
  mess: number;
  leads: number;
  orders: number;
  revenue: number;
  adCost: number;
};

type Metrics = Omit<DailyMetrics, 'date'> & {
  adsPct: number;
  leadPct: number;
  closePct: number;
  cpl: number;
  aov: number;
  cpa: number;
  cpo: number;
};

type DateRange = { from: string; to: string };
type Preset = 'today' | 'yesterday' | '3d' | '7d' | 'month' | 'custom';

function safeNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const parsed = Number(String(value).trim().replace(/[,$\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}

function dayRange(range: DateRange): string[] {
  const result: string[] = [];
  const cursor = new Date(`${range.from}T12:00:00`);
  const end = new Date(`${range.to}T12:00:00`);
  while (cursor <= end && result.length < 370) {
    result.push(toLocalYyyyMmDd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function previousRange(range: DateRange): DateRange {
  const length = Math.max(1, dayRange(range).length);
  const end = addDays(new Date(`${range.from}T12:00:00`), -1);
  const start = addDays(end, -(length - 1));
  return { from: toLocalYyyyMmDd(start), to: toLocalYyyyMmDd(end) };
}

function makeMetrics(rows: DailyMetrics[]): Metrics {
  const totals = rows.reduce(
    (acc, row) => ({
      mess: acc.mess + row.mess,
      leads: acc.leads + row.leads,
      orders: acc.orders + row.orders,
      revenue: acc.revenue + row.revenue,
      adCost: acc.adCost + row.adCost,
    }),
    { mess: 0, leads: 0, orders: 0, revenue: 0, adCost: 0 },
  );
  return {
    ...totals,
    adsPct: totals.revenue > 0 ? (totals.adCost / totals.revenue) * 100 : 0,
    leadPct: totals.mess > 0 ? (totals.leads / totals.mess) * 100 : 0,
    closePct: totals.leads > 0 ? (totals.orders / totals.leads) * 100 : 0,
    cpl: totals.leads > 0 ? totals.adCost / totals.leads : 0,
    aov: totals.orders > 0 ? totals.revenue / totals.orders : 0,
    cpa: totals.mess > 0 ? totals.adCost / totals.mess : 0,
    cpo: totals.orders > 0 ? totals.adCost / totals.orders : 0,
  };
}

function aggregateDays(rows: ReportRow[], range: DateRange): DailyMetrics[] {
  const days = new Map<string, DailyMetrics>();
  for (const date of dayRange(range)) {
    days.set(date, { date, mess: 0, leads: 0, orders: 0, revenue: 0, adCost: 0 });
  }
  for (const row of rows) {
    const date = row.report_date?.slice(0, 10);
    const daily = date ? days.get(date) : undefined;
    if (!daily) continue;
    daily.mess += safeNumber(row.mess_comment_count);
    daily.leads += safeNumber(row.tong_data_nhan ?? row.tong_lead);
    daily.orders += safeNumber(row.order_count);
    daily.revenue += row.tien_viet != null
      ? safeNumber(row.tien_viet)
      : Math.round(safeNumber(row.revenue) * 25000);
    daily.adCost += safeNumber(row.ad_cost);
  }
  return [...days.values()];
}

function formatMoney(value: number): string {
  return formatCompactVnd(value);
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

function periodDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '0%' : '+100%';
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change > 0 ? '+' : ''}${change.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%`;
}

function dateText(value: string): string {
  return formatReportDateVi(value).slice(0, 5);
}

function presetRange(preset: Exclude<Preset, 'custom'>, today = new Date()): DateRange {
  const end = preset === 'yesterday' ? addDays(today, -1) : today;
  const start = preset === 'month'
    ? new Date(today.getFullYear(), today.getMonth(), 1)
    : addDays(end, -(preset === '3d' ? 2 : preset === '7d' ? 6 : 0));
  return { from: toLocalYyyyMmDd(start), to: toLocalYyyyMmDd(end) };
}

function Card({
  label,
  value,
  sub,
  status,
  tone,
  icon,
  progress,
}: {
  label: string;
  value: string;
  sub: string;
  status: string;
  tone: 'green' | 'red' | 'amber' | 'blue' | 'purple';
  icon: React.ReactNode;
  progress?: number;
}) {
  const accent = {
    green: { border: 'border-l-emerald-600', text: 'text-emerald-700', icon: 'bg-emerald-50 text-emerald-700 border border-emerald-200', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    red: { border: 'border-l-rose-600', text: 'text-rose-700', icon: 'bg-rose-50 text-rose-700 border border-rose-200', badge: 'bg-rose-50 text-rose-700 border border-rose-200' },
    amber: { border: 'border-l-amber-600', text: 'text-amber-800', icon: 'bg-amber-50 text-amber-800 border border-amber-200', badge: 'bg-amber-50 text-amber-800 border border-amber-200' },
    blue: { border: 'border-l-sky-600', text: 'text-sky-800', icon: 'bg-sky-50 text-sky-800 border border-sky-200', badge: 'bg-sky-50 text-sky-800 border border-sky-200' },
    purple: { border: 'border-l-purple-600', text: 'text-purple-800', icon: 'bg-purple-50 text-purple-800 border border-purple-200', badge: 'bg-purple-50 text-purple-800 border border-purple-200' },
  }[tone];
  const bar = {
    green: 'bg-emerald-600',
    red: 'bg-rose-600',
    amber: 'bg-amber-500',
    blue: 'bg-sky-600',
    purple: 'bg-purple-600',
  }[tone];
  return (
    <article className={`group relative min-h-[112px] overflow-hidden rounded-xl border border-[var(--stitch-border)] border-l-[3px] ${accent.border} bg-white p-3 shadow-[var(--stitch-shadow)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${accent.icon}`}>{icon}</span>
          <span className="text-[11px] font-bold leading-4 text-[#64748b]">{label}</span>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${accent.badge}`}>{status}</span>
      </div>
      <div className={`mt-2 text-[20px] font-extrabold tracking-tight font-mono ${accent.text}`}>{value}</div>
      <div className="mt-0.5 min-h-4 text-[10px] text-[#64748b]">{sub}</div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#f1f5f9]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(4, Math.min(progress ?? 42, 100))}%` }} />
      </div>
    </article>
  );
}

export type MktDashboardViewProps = { reportUser?: AuthUser | null };

export const MktDashboardView: React.FC<MktDashboardViewProps> = ({ reportUser = null }) => {
  const today = useMemo(() => new Date(), []);
  const viewerIsAdmin = useMemo(() => crmNavTierFromUser(reportUser ?? null) === 'admin', [reportUser]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [preset, setPreset] = useState<Preset>('month');
  const [range, setRange] = useState<DateRange>(() => presetRange('month'));
  const [draftRange, setDraftRange] = useState<DateRange>(() => presetRange('month'));
  const [showCustom, setShowCustom] = useState(false);
  const [dailyFilter, setDailyFilter] = useState<'all' | 'active' | 'attention'>('all');
  const [compare, setCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [priorRows, setPriorRows] = useState<ReportRow[]>([]);
  const [targetVnd, setTargetVnd] = useState<number | null>(null);

  useEffect(() => {
    if (!viewerIsAdmin) {
      setPeople([]);
      setSelectedPersonId('');
      setPeopleLoading(false);
      return;
    }
    let cancelled = false;
    setPeopleLoading(true);
    setPeopleError(null);
    void fetchAllRows<{ id: string; name: string | null; email: string | null; ma_ns: string | null }>(supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, email, ma_ns')
      .not('email', 'is', null)
      .order('name', { ascending: true }))
      .then(({ data, error: peopleError }) => {
        if (cancelled) return;
        if (peopleError) {
          console.error('mkt-dash employees:', peopleError);
          setPeople([]);
          setPeopleError('Không tải được danh sách nhân sự.');
          setPeopleLoading(false);
          return;
        }
        const options = (data || [])
          .map((person) => ({
            id: String(person.id || ''),
            name: String(person.name || ''),
            email: String(person.email || '').trim(),
            ma_ns: person.ma_ns == null ? null : String(person.ma_ns).trim(),
          }))
          .filter((person) => person.id && person.email);
        setPeople(options);
        setPeopleError(null);
        setSelectedPersonId((current) => {
          if (current && options.some((person) => person.id === current)) return current;
          const currentUser = options.find((person) =>
            person.id === reportUser?.id || person.email.toLowerCase() === reportUser?.email?.trim().toLowerCase()
          );
          return currentUser?.id || '';
        });
        setPeopleLoading(false);
      });
    return () => { cancelled = true; };
  }, [viewerIsAdmin, reportUser?.id, reportUser?.email]);

  const selectedPerson = useMemo<PersonOption | null>(() => {
    if (viewerIsAdmin) return people.find((person) => person.id === selectedPersonId) || null;
    if (!reportUser?.email?.trim()) return null;
    return {
      id: reportUser.id?.trim() || '',
      name: reportUser.name?.trim() || reportUser.email.trim(),
      email: reportUser.email.trim(),
      ma_ns: reportUser.ma_ns?.trim() || null,
    };
  }, [people, reportUser, selectedPersonId, viewerIsAdmin]);

  const load = useCallback(async () => {
    const email = selectedPerson?.email.trim().toLowerCase();
    if (!email) {
      setRows([]);
      setPriorRows([]);
      setTargetVnd(null);
      setLoading(false);
      setError(viewerIsAdmin ? null : 'Đăng nhập CRM để xem dashboard cá nhân.');
      return;
    }
    setLoading(true);
    setError(null);
    const previous = previousRange(range);
    const identityFilter = [`email.ilike.${email}`, ...(selectedPerson.ma_ns ? [`code.eq.${selectedPerson.ma_ns}`] : [])].join(',');
    const fetchRows = (period: DateRange) => fetchAllRows<any>(supabase
      .from(REPORTS_TABLE)
      .select('id, report_date, revenue, tien_viet, ad_cost, mess_comment_count, tong_data_nhan, tong_lead, order_count, email, code')
      .gte('report_date', period.from)
      .lte('report_date', period.to)
      .or(identityFilter)
      .order('report_date', { ascending: true }));

    const [currentRes, previousRes, targetRes] = await Promise.all([
      fetchRows(range),
      compare ? fetchRows(previous) : Promise.resolve({ data: [], error: null }),
      selectedPerson.id
        ? supabase
            .from(KPI_STAFF_TARGETS_TABLE)
            .select('muc_tieu_vnd')
            .eq('nam_thang', `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
            .eq('employee_id', selectedPerson.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (currentRes.error) {
      setRows([]);
      setPriorRows([]);
      setTargetVnd(null);
      setError(currentRes.error.message || 'Không tải được báo cáo cá nhân.');
      setLoading(false);
      return;
    }
    setRows((currentRes.data || []) as ReportRow[]);
    setPriorRows((previousRes.data || []) as ReportRow[]);
    const target = Number((targetRes.data as { muc_tieu_vnd?: number } | null)?.muc_tieu_vnd);
    setTargetVnd(!targetRes.error && Number.isFinite(target) && target > 0 ? target : null);
    setLoading(false);
  }, [compare, peopleLoading, range, reportUser, selectedPerson, today, viewerIsAdmin]);

  useEffect(() => { void load(); }, [load]);

  const daily = useMemo(() => aggregateDays(rows, range), [rows, range]);
  const priorDaily = useMemo(() => aggregateDays(priorRows, previousRange(range)), [priorRows, range]);
  const metrics = useMemo(() => makeMetrics(daily), [daily]);
  const priorMetrics = useMemo(() => makeMetrics(priorDaily), [priorDaily]);
  const days = Math.max(1, daily.length);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const forecastRevenue = (metrics.revenue / days) * daysInMonth * 0.95;
  const forecastAdCost = (metrics.adCost / days) * daysInMonth * 1.06;
  const forecastAdsPct = forecastRevenue > 0 ? (forecastAdCost / forecastRevenue) * 100 : 0;
  const revenueProgress = targetVnd ? Math.min(100, (metrics.revenue / targetVnd) * 100) : undefined;
  const alerts = [
    ...(metrics.revenue > 0 && metrics.adsPct > 30 ? [`%ADS ${formatPercent(metrics.adsPct)} đang vượt trần 30%.`] : []),
    ...(metrics.mess > 0 && metrics.leadPct < 30 ? [`Tỷ lệ nhận data ${formatPercent(metrics.leadPct)} thấp hơn mục tiêu 30%.`] : []),
    ...(metrics.leads > 0 && metrics.closePct < 32 ? [`Tỷ lệ chốt ${formatPercent(metrics.closePct)} thấp hơn mục tiêu 32%.`] : []),
  ];
  const displayRows = [...daily].reverse();
  const filteredDisplayRows = displayRows.filter((row) => {
    if (dailyFilter === 'active') return row.mess > 0 || row.leads > 0 || row.orders > 0 || row.revenue > 0 || row.adCost > 0;
    if (dailyFilter === 'attention') {
      const leadPct = row.mess ? row.leads / row.mess * 100 : 0;
      const closePct = row.leads ? row.orders / row.leads * 100 : 0;
      const adsPct = row.revenue ? row.adCost / row.revenue * 100 : 0;
      return (row.adCost > 0 && row.revenue <= 0) || (row.revenue > 0 && adsPct > 30) || (row.mess > 0 && leadPct < 30) || (row.leads > 0 && closePct < 32);
    }
    return true;
  });
  const priorCaption = compare && priorRows.length ? `Kỳ trước: ${formatMoney(priorMetrics.revenue)}` : 'Theo dữ liệu đã nhập';

  const choosePreset = (value: Exclude<Preset, 'custom'>) => {
    const next = presetRange(value);
    setPreset(value);
    setRange(next);
    setDraftRange(next);
    setShowCustom(false);
  };

  const applyCustomRange = () => {
    if (!draftRange.from || !draftRange.to || draftRange.from > draftRange.to) return;
    setRange(draftRange);
    setPreset('custom');
    setShowCustom(false);
  };

  const exportCsv = () => {
    const columns = ['Ngày', 'Mess', 'Data nhận', 'Tỷ lệ nhận data (%)', 'Đơn chốt', 'Tỷ lệ chốt (%)', 'Doanh số (VNĐ)', 'Chi phí Ads (VNĐ)', '%ADS'];
    const lines = [columns, ...filteredDisplayRows.map((row) => [
      row.date,
      row.mess,
      row.leads,
      row.mess ? ((row.leads / row.mess) * 100).toFixed(1) : '0',
      row.orders,
      row.leads ? ((row.orders / row.leads) * 100).toFixed(1) : '0',
      row.revenue.toFixed(0),
      row.adCost.toFixed(0),
      row.revenue ? ((row.adCost / row.revenue) * 100).toFixed(1) : '0',
    ])];
    const blob = new Blob(['\ufeff', lines.map((line) => line.join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dashboard-ca-nhan_${range.from}_${range.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const presets: Array<{ id: Exclude<Preset, 'custom'>; label: string }> = [
    { id: 'today', label: 'Hôm nay' },
    { id: 'yesterday', label: 'Hôm qua' },
    { id: '3d', label: '3 ngày' },
    { id: '7d', label: '7 ngày' },
    { id: 'month', label: 'Tháng này' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1580px] space-y-3.5 pb-6 text-[#1f2937]">
      <header className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-[var(--stitch-border)] bg-white p-3.5 shadow-[var(--stitch-shadow)] sm:p-4">
        <div>
          <p className="mb-1 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[.1em] text-emerald-800"><LockKeyhole size={10} /> Hiệu quả cá nhân · Marketing</p>
          <h1 className="text-[20px] font-extrabold tracking-tight text-[#1f2937] sm:text-[22px]">{viewerIsAdmin ? 'Báo cáo cá nhân' : 'Báo cáo của tôi'}</h1>
          <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-[#64748b]">{viewerIsAdmin ? 'Chọn nhân sự để xem kết quả, chi phí quảng cáo và chất lượng chuyển đổi.' : 'Theo dõi kết quả, chi phí quảng cáo và chất lượng chuyển đổi của riêng bạn.'}</p>
        </div>
        {viewerIsAdmin ? (
          <label className="grid min-w-[220px] gap-1 text-[9px] font-bold uppercase tracking-wide text-[#64748b]">
            <span className="inline-flex items-center gap-1"><Users size={11} className="text-emerald-700" /> Nhân sự đang xem</span>
            <select value={selectedPersonId} onChange={(event) => setSelectedPersonId(event.target.value)} disabled={peopleLoading} className="stitch-field max-w-[340px] text-xs font-semibold">
              <option value="">{peopleLoading ? 'Đang tải danh sách…' : 'Chọn nhân sự cần xem'}</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name || person.email} · {person.email}</option>)}
            </select>
          </label>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-[10px] font-extrabold text-white">{(selectedPerson?.name || 'T').slice(0, 2).toUpperCase()}</span>
            <span><span className="block text-[8px] font-semibold uppercase tracking-wider text-emerald-700">Tài khoản cá nhân</span><span className="block">{selectedPerson?.name || 'Tài khoản của tôi'}</span></span>
            <LockKeyhole size={12} className="ml-1 text-emerald-600" />
          </div>
        )}
      </header>

      <section className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[var(--stitch-border)] bg-white p-2.5 shadow-[var(--stitch-shadow)] sm:p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 hidden text-[9px] font-extrabold uppercase tracking-[.12em] text-[#64748b] lg:inline">Kỳ báo cáo</span>
          <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--stitch-border)] bg-[#f8faf9] p-0.5">
          {presets.map((item) => (
            <button key={item.id} type="button" onClick={() => choosePreset(item.id)} className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${preset === item.id ? 'bg-[var(--stitch-green-600)] text-white shadow-sm' : 'text-[#64748b] hover:bg-white hover:text-[#1f2937]'}`}>
              {item.label}
            </button>
          ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#475569]"><CalendarDays size={16} className="text-emerald-700" />{dateText(range.from)} – {dateText(range.to)}</div>
          <button type="button" onClick={() => { setDraftRange(range); setShowCustom((value) => !value); }} className="rounded-lg border border-[var(--stitch-border)] bg-white px-3 py-2 text-[11px] font-bold text-[#475569] hover:border-[#86efac] hover:bg-[#f0fdf4] hover:text-[var(--stitch-green-700)]">Chọn thời gian</button>
          <button type="button" onClick={() => setCompare((value) => !value)} aria-pressed={compare} className={`rounded-lg border px-3 py-2 text-[11px] font-bold transition ${compare ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-[var(--stitch-border)] bg-white text-[#475569] hover:border-[#86efac] hover:bg-[#f0fdf4] hover:text-[var(--stitch-green-700)]'}`}>Đối chiếu kỳ trước</button>
          <button type="button" onClick={() => void load()} className="rounded-lg border border-[var(--stitch-border)] bg-white p-2 text-[#475569] hover:border-[#86efac] hover:bg-[#f0fdf4] hover:text-[var(--stitch-green-700)]" aria-label="Tải lại"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </section>

      {showCustom && (
        <section className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--stitch-border)] bg-[#f8faf9] p-4">
          <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">Từ ngày<input type="date" value={draftRange.from} max={draftRange.to || undefined} onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} className="stitch-field text-xs" /></label>
          <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">Đến ngày<input type="date" value={draftRange.to} min={draftRange.from || undefined} onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} className="stitch-field text-xs" /></label>
          <button type="button" onClick={applyCustomRange} className="stitch-button stitch-button--primary">Áp dụng</button>
        </section>
      )}

      {viewerIsAdmin && !selectedPerson ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-900">{peopleLoading ? 'Đang tải danh sách nhân sự…' : peopleError || 'Chọn một nhân sự để xem báo cáo cá nhân.'}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>
      ) : loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800"><RefreshCw size={14} className="animate-spin" /> Đang tổng hợp dữ liệu cá nhân…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--stitch-border)] bg-white p-4 text-xs font-semibold text-[#64748b]">Chưa có báo cáo trong khoảng thời gian đã chọn.</div>
      ) : alerts.length ? (
        <div className="flex gap-3 rounded-xl border border-rose-200 border-l-4 border-l-rose-500 bg-rose-50 p-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-500 text-white"><TriangleAlert size={15} /></span>
          <div><strong className="text-sm text-rose-800">Chỉ số cần chú ý</strong><p className="mt-1 text-xs text-rose-700">{alerts.join(' ')}</p></div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-xl border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white"><CheckCircle2 size={15} /></span>
          <div><strong className="text-sm text-emerald-900">Các chỉ số đang trong ngưỡng</strong><p className="mt-1 text-xs text-emerald-800">Tiếp tục theo dõi tiến độ theo ngày.</p></div>
        </div>
      )}

      {(!viewerIsAdmin || selectedPerson) && <>
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-sm font-extrabold text-[#1f2937]">Chỉ số trọng tâm</h2><p className="mt-0.5 text-[10px] text-[#64748b]">{daily.length} ngày · {selectedPerson?.name || 'cá nhân'} · {priorCaption}</p></div>
        <span className="text-[10px] text-[#64748b]">Cập nhật theo khoảng thời gian đã chọn</span>
      </div>
      <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4" aria-label="Các chỉ số cá nhân">
        <Card label="Doanh số" value={formatMoney(metrics.revenue)} sub={targetVnd ? `Mục tiêu tháng ${formatKpiMoney(targetVnd)}` : 'Tổng doanh thu trong kỳ'} status={targetVnd && metrics.revenue >= targetVnd ? 'Đạt KPI' : 'Theo dõi'} tone="green" icon={<Target size={12} />} progress={revenueProgress} />
        <Card label="Đơn chốt" value={formatCount(metrics.orders)} sub={`${formatCount(metrics.leads)} data nhận trong kỳ`} status={metrics.closePct >= 32 ? 'Tốt' : 'Theo dõi'} tone={metrics.closePct >= 32 ? 'green' : 'amber'} icon={<ShoppingCart size={12} />} progress={metrics.closePct / 32 * 100} />
        <Card label="%ADS · Chi phí/Doanh thu" value={formatPercent(metrics.adsPct)} sub={`Chi phí Ads ${formatMoney(metrics.adCost)}`} status={metrics.adsPct <= 30 ? 'Trong ngưỡng' : 'Báo động'} tone={metrics.adsPct <= 30 ? 'blue' : 'red'} icon={<TriangleAlert size={12} />} progress={metrics.adsPct / 30 * 100} />
        <Card label="Tin nhắn" value={formatCount(metrics.mess)} sub="Tổng tin nhắn trong kỳ" status="Trong kỳ" tone="purple" icon={<MessageSquareText size={12} />} />
        <Card label="Data nhận · Lead" value={formatCount(metrics.leads)} sub={`Tỷ lệ nhận data ${formatPercent(metrics.leadPct)}`} status={metrics.leadPct >= 30 ? 'Đạt mục tiêu' : 'Theo dõi'} tone={metrics.leadPct >= 30 ? 'green' : 'amber'} icon={<Users size={12} />} progress={metrics.leadPct / 30 * 100} />
        <Card label="Tỷ lệ chốt" value={formatPercent(metrics.closePct)} sub="Đơn chốt / data nhận" status={metrics.closePct >= 32 ? 'Đạt mục tiêu' : 'Theo dõi'} tone={metrics.closePct >= 32 ? 'green' : 'amber'} icon={<CheckCircle2 size={12} />} progress={metrics.closePct / 32 * 100} />
        <Card label="CPL · Chi phí mỗi Lead" value={formatMoney(metrics.cpl)} sub="Chi phí Ads / data nhận" status="Theo dõi" tone="purple" icon={<Users size={12} />} progress={metrics.cpl ? 100 - Math.min(100, metrics.cpl / 1000000 * 20) : 4} />
        <Card label="AOV · Giá trị đơn trung bình" value={formatMoney(metrics.aov)} sub="Doanh số / đơn chốt" status="Theo dõi" tone="green" icon={<ShoppingCart size={12} />} progress={metrics.aov ? 70 : 4} />
        <Card label="CPA · Chi phí mỗi tin nhắn" value={formatMoney(metrics.cpa)} sub="Chi phí Ads / tin nhắn" status="Theo dõi" tone="amber" icon={<MessageSquareText size={12} />} progress={metrics.cpa ? 100 - Math.min(100, metrics.cpa / 1000000 * 20) : 4} />
        <Card label="CPO · Chi phí mỗi đơn" value={formatMoney(metrics.cpo)} sub="Chi phí Ads / đơn chốt" status="Theo dõi" tone="purple" icon={<ShoppingCart size={12} />} progress={metrics.cpo ? 100 - Math.min(100, metrics.cpo / 1000000 * 20) : 4} />
      </section>

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,.82fr)]">
        <section className="rounded-xl border border-[var(--stitch-border)] bg-white p-3.5 shadow-[var(--stitch-shadow)] sm:p-4">
          <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xs font-extrabold text-[#1f2937]">Doanh số, chi phí và %ADS theo ngày</h2><p className="mt-0.5 text-[10px] text-[#64748b]">Xu hướng trong khoảng thời gian đã chọn</p></div><span className="text-[9px] text-[#64748b]">{daily.length} ngày dữ liệu</span></div>
          <div className="h-[230px] w-full">
            {loading ? <div className="grid h-full place-items-center text-xs text-[#64748b]">Đang tải dữ liệu…</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(8)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="money" tickFormatter={(value: number) => formatMoney(value)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                  <YAxis yAxisId="percent" orientation="right" tickFormatter={(value: number) => `${value}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8e5', borderRadius: 8, color: '#1f2937', fontSize: 11, boxShadow: '0 8px 24px rgba(15,23,42,.1)' }} labelFormatter={(value) => formatReportDateVi(String(value))} formatter={(value, name) => [name === '%ADS' ? `${Number(value).toFixed(1)}%` : formatMoney(Number(value)), name]} />
                  <ReferenceLine yAxisId="percent" y={30} stroke="#f43f5e" strokeDasharray="5 5" />
                  <Bar yAxisId="money" dataKey="revenue" name="Doanh số" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={15} />
                  <Bar yAxisId="money" dataKey="adCost" name="Chi phí Ads" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={15} />
                  <Line yAxisId="percent" type="monotone" dataKey={(row: DailyMetrics) => row.revenue ? row.adCost / row.revenue * 100 : 0} name="%ADS" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] text-[#64748b]"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-emerald-600" />Doanh số</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-indigo-500" />Chi phí</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />%ADS thực tế</span><span className="inline-flex items-center gap-1.5"><i className="h-px w-3 bg-rose-500" />Trần %ADS 30%</span></div>
        </section>

        <section className="rounded-xl border border-[var(--stitch-border)] bg-white p-3.5 shadow-[var(--stitch-shadow)] sm:p-4">
          <div><h2 className="text-xs font-extrabold text-[#1f2937]">Dự đoán %ADS</h2><p className="mt-0.5 text-[10px] text-[#64748b]">Ước tính theo dữ liệu trong kỳ đã chọn</p></div>
          <div className="mt-3 space-y-2">
            {[
              { label: 'Doanh thu dự kiến', value: forecastRevenue, rate: 100, color: 'bg-purple-600', note: 'Đã trừ dự phòng hoàn hủy 5%' },
              { label: 'Chi phí quảng cáo dự kiến', value: forecastAdCost, rate: forecastRevenue ? forecastAdCost / forecastRevenue * 100 : 0, color: 'bg-sky-600', note: 'Đã cộng dự phòng phí 6%' },
              { label: '%ADS dự kiến', value: forecastAdsPct, rate: forecastAdsPct, color: 'bg-emerald-600', note: 'Chi phí quảng cáo / doanh thu dự kiến' },
            ].map((stage) => (
              <div key={stage.label} className="rounded-lg border border-[var(--stitch-border)] bg-[#f8faf9] p-2.5">
                <div className="flex items-baseline justify-between gap-2"><span className="text-[10px] font-bold text-[#64748b]">{stage.label}</span><strong className="text-base font-extrabold font-mono text-[#1f2937]">{stage.label.includes('%ADS') ? formatPercent(stage.value) : formatMoney(stage.value)}</strong></div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#e2e8e5]"><div className={`h-full rounded-full ${stage.color}`} style={{ width: `${Math.max(stage.value > 0 ? 3 : 0, Math.min(stage.rate, 100))}%` }} /></div>
                <p className="mt-1 text-[9px] text-[#64748b]">{stage.note}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mb-4 overflow-hidden rounded-xl border border-emerald-900/10 bg-[#f5faf6] p-3.5 text-slate-800 shadow-[0_12px_32px_rgba(15,80,43,.10)] sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-700 to-green-600 text-white shadow-sm"><BarChart3 size={18} /></span>
            <div><h2 className="text-base font-extrabold text-emerald-950 sm:text-lg">Chi tiết theo ngày</h2><p className="text-[11px] font-medium text-slate-500">Dữ liệu tổng hợp trong khoảng thời gian đã chọn</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-bold text-emerald-950 shadow-sm"><CalendarDays size={14} className="text-emerald-700" />{formatReportDateVi(range.from)} – {formatReportDateVi(range.to)}</div>
            <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-bold text-emerald-950 shadow-sm"><Filter size={14} className="text-emerald-700" /><span className="sr-only">Lọc ngày</span><select aria-label="Lọc ngày" value={dailyFilter} onChange={(event) => setDailyFilter(event.target.value as typeof dailyFilter)} className="max-w-[120px] bg-transparent outline-none text-[11px]"><option value="all">Tất cả ngày</option><option value="active">Có dữ liệu</option><option value="attention">Cần chú ý</option></select></label>
            <button type="button" onClick={exportCsv} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-emerald-800"><Download size={14} /> Tải CSV</button>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1.5 xl:grid-cols-4 2xl:grid-cols-8">
          {[
            { label: 'Tổng MESS', value: formatCount(metrics.mess), change: periodDelta(metrics.mess, priorMetrics.mess), icon: <MessageSquareText size={16} />, tone: 'green' },
            { label: 'Tổng dữ liệu nhận', value: formatCount(metrics.leads), change: periodDelta(metrics.leads, priorMetrics.leads), icon: <FileText size={16} />, tone: 'green' },
            { label: 'Tỷ lệ nhận TB', value: formatPercent(metrics.leadPct), change: periodDelta(metrics.leadPct, priorMetrics.leadPct), icon: <Percent size={16} />, tone: 'rose' },
            { label: 'Tổng đơn', value: formatCount(metrics.orders), change: periodDelta(metrics.orders, priorMetrics.orders), icon: <ShoppingCart size={16} />, tone: 'amber' },
            { label: 'Tỷ lệ chốt TB', value: formatPercent(metrics.closePct), change: periodDelta(metrics.closePct, priorMetrics.closePct), icon: <CheckCircle2 size={16} />, tone: 'amber' },
            { label: 'Tổng doanh số', value: formatMoney(metrics.revenue), change: periodDelta(metrics.revenue, priorMetrics.revenue), icon: <BarChart3 size={16} />, tone: 'green' },
            { label: 'Tổng chi phí', value: formatMoney(metrics.adCost), change: periodDelta(metrics.adCost, priorMetrics.adCost), icon: <Coins size={16} />, tone: 'blue' },
            { label: '% ADS TB', value: formatPercent(metrics.adsPct), change: periodDelta(metrics.adsPct, priorMetrics.adsPct), icon: <Megaphone size={16} />, tone: 'green' },
          ].map((item) => {
            const toneClass = item.tone === 'rose' ? 'border-rose-100 bg-rose-50 text-rose-700' : item.tone === 'amber' ? 'border-amber-100 bg-amber-50 text-amber-700' : item.tone === 'blue' ? 'border-sky-100 bg-sky-50 text-sky-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700';
            return <article key={item.label} className={`min-w-0 rounded-lg border p-2 shadow-[0_2px_8px_rgba(15,80,43,.04)] ${toneClass}`}>
              <div className="flex items-center gap-1.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-white/80">{item.icon}</span><span className="truncate text-[9px] font-bold leading-tight text-slate-600">{item.label}</span></div>
              <strong className="mt-1 block truncate text-xl font-extrabold text-slate-900">{item.value}</strong>
              <p className="mt-1 truncate text-[9px] font-bold text-emerald-700">↗ {item.change} <span className="font-medium text-slate-500">so với kỳ trước</span></p>
            </article>;
          })}
        </div>

        <div className="overflow-x-auto rounded-xl border border-emerald-900/5 bg-white shadow-sm">
          <table className="w-full min-w-[1080px] border-collapse text-center text-xs">
            <thead><tr className="bg-gradient-to-r from-emerald-700 to-green-700 text-[10px] font-extrabold text-white">
              <th className="p-3">#</th><th className="p-3">Ngày</th><th className="p-3">MESS</th><th className="p-3">Data nhận</th><th className="p-3">Tỷ lệ nhận</th><th className="p-3">Đơn</th><th className="p-3">Tỷ lệ chốt</th><th className="p-3">Doanh số</th><th className="p-3">Chi phí</th><th className="p-3">% ADS</th><th className="p-3">Thao tác</th>
            </tr></thead>
            <tbody className="font-semibold text-slate-800">
              {loading ? <tr><td colSpan={11} className="p-8 text-slate-500"><RefreshCw size={15} className="mr-2 inline animate-spin" />Đang tải dữ liệu…</td></tr> : filteredDisplayRows.length ? filteredDisplayRows.map((row, index) => {
                const leadPct = row.mess ? row.leads / row.mess * 100 : 0;
                const closePct = row.leads ? row.orders / row.leads * 100 : 0;
                const adsPct = row.revenue ? row.adCost / row.revenue * 100 : 0;
                const greenPill = 'inline-flex min-w-[58px] justify-center rounded-full bg-emerald-100 px-3 py-1.5 font-extrabold text-emerald-800';
                const redPill = 'inline-flex min-w-[58px] justify-center rounded-full bg-rose-100 px-3 py-1.5 font-extrabold text-rose-700';
                const amberPill = 'inline-flex min-w-[58px] justify-center rounded-full bg-amber-100 px-3 py-1.5 font-extrabold text-amber-800';
                return <tr key={row.date} className={`border-b border-emerald-900/[0.04] hover:bg-emerald-50 ${index % 2 === 0 ? 'bg-emerald-50/70' : 'bg-white'}`}>
                  <td className="p-2.5">{index + 1}</td><td className="p-2.5 font-bold">{dateText(row.date)}</td><td className="p-2.5">{formatCount(row.mess)}</td><td className="p-2.5">{formatCount(row.leads)}</td>
                  <td className="p-2.5"><span className={leadPct >= 30 ? greenPill : redPill}>{formatPercent(leadPct)}</span></td><td className="p-2.5">{formatCount(row.orders)}</td>
                  <td className="p-2.5"><span className={closePct >= 32 ? greenPill : amberPill}>{formatPercent(closePct)}</span></td>
                  <td className="p-2.5 font-bold text-emerald-800">{row.revenue ? formatMoney(row.revenue) : '—'}</td><td className="p-2.5">{row.adCost ? formatMoney(row.adCost) : '—'}</td>
                  <td className="p-2.5"><span className={adsPct <= 30 ? greenPill : redPill}>{formatPercent(adsPct)}</span></td>
                  <td className="p-2.5"><button type="button" title={`Xem riêng ngày ${dateText(row.date)}`} aria-label={`Xem riêng ngày ${dateText(row.date)}`} onClick={() => { setRange({ from: row.date, to: row.date }); setDraftRange({ from: row.date, to: row.date }); setPreset('custom'); }} className="rounded-md p-1 text-slate-500 hover:bg-emerald-100 hover:text-emerald-800"><MoreVertical size={17} /></button></td>
                </tr>;
              }) : <tr><td colSpan={11} className="p-8 text-slate-500">{dailyFilter === 'all' ? 'Không có dữ liệu trong khoảng thời gian này.' : 'Không có ngày phù hợp với bộ lọc.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-slate-500">Phạm vi hiển thị: báo cáo gắn với email hoặc mã nhân sự của {viewerIsAdmin ? selectedPerson?.name || 'nhân sự đã chọn' : 'bạn'}.</p>
      </section>


      </>}
      <footer className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-slate-600"><LockKeyhole size={12} /> Báo cáo hiệu quả cá nhân · {selectedPerson?.name || 'Tài khoản của tôi'}</footer>
    </div>
  );
};
