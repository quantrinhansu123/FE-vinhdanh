import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  LockKeyhole,
  MessageSquareText,
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
    green: { border: 'border-l-emerald-400', text: 'text-emerald-300', icon: 'bg-emerald-400/10 text-emerald-300', badge: 'bg-emerald-400/10 text-emerald-200 ring-emerald-300/10' },
    red: { border: 'border-l-rose-400', text: 'text-rose-300', icon: 'bg-rose-400/10 text-rose-300', badge: 'bg-rose-400/10 text-rose-200 ring-rose-300/10' },
    amber: { border: 'border-l-amber-400', text: 'text-amber-300', icon: 'bg-amber-400/10 text-amber-300', badge: 'bg-amber-400/10 text-amber-200 ring-amber-300/10' },
    blue: { border: 'border-l-sky-400', text: 'text-sky-300', icon: 'bg-sky-400/10 text-sky-300', badge: 'bg-sky-400/10 text-sky-200 ring-sky-300/10' },
    purple: { border: 'border-l-violet-400', text: 'text-violet-300', icon: 'bg-violet-400/10 text-violet-300', badge: 'bg-violet-400/10 text-violet-200 ring-violet-300/10' },
  }[tone];
  const bar = {
    green: 'bg-emerald-400',
    red: 'bg-rose-400',
    amber: 'bg-amber-400',
    blue: 'bg-sky-400',
    purple: 'bg-violet-400',
  }[tone];
  return (
    <article className={`group relative min-h-[154px] overflow-hidden rounded-2xl border border-white/[0.07] border-l-[3px] ${accent.border} bg-gradient-to-br from-[#172333] to-[#121b28] p-4 shadow-[0_10px_24px_rgba(0,0,0,.16)] transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_16px_32px_rgba(0,0,0,.24)]`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${accent.icon}`}>{icon}</span>
          <span className="text-xs font-semibold leading-4 text-slate-400">{label}</span>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ring-1 ${accent.badge}`}>{status}</span>
      </div>
      <div className={`mt-3 text-[26px] font-extrabold tracking-tight ${accent.text}`}>{value}</div>
      <div className="mt-1 min-h-4 text-[10px] text-slate-500">{sub}</div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
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
    void supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, email, ma_ns')
      .not('email', 'is', null)
      .order('name', { ascending: true })
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
    const fetchRows = (period: DateRange) => supabase
      .from(REPORTS_TABLE)
      .select('id, report_date, revenue, tien_viet, ad_cost, mess_comment_count, tong_data_nhan, tong_lead, order_count, email, code')
      .gte('report_date', period.from)
      .lte('report_date', period.to)
      .or(identityFilter)
      .order('report_date', { ascending: true })
      .limit(10000);

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
  const forecast = (metrics.revenue / days) * daysInMonth;
  const revenueProgress = targetVnd ? Math.min(100, (metrics.revenue / targetVnd) * 100) : undefined;
  const alerts = [
    ...(metrics.revenue > 0 && metrics.adsPct > 30 ? [`%ADS ${formatPercent(metrics.adsPct)} đang vượt trần 30%.`] : []),
    ...(metrics.mess > 0 && metrics.leadPct < 30 ? [`Tỷ lệ nhận data ${formatPercent(metrics.leadPct)} thấp hơn mục tiêu 30%.`] : []),
    ...(metrics.leads > 0 && metrics.closePct < 32 ? [`Tỷ lệ chốt ${formatPercent(metrics.closePct)} thấp hơn mục tiêu 32%.`] : []),
  ];
  const displayRows = [...daily].reverse();
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
    const lines = [columns, ...displayRows.map((row) => [
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
    <div className="mx-auto w-full max-w-[1580px] space-y-5 pb-8 text-slate-100">
      <header className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,.14),transparent_42%),linear-gradient(135deg,#172333,#121a27)] p-5 shadow-xl shadow-black/15 sm:p-6">
        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-sky-300/15 bg-sky-300/[0.07] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.15em] text-sky-200"><LockKeyhole size={11} /> Hiệu quả cá nhân · Marketing</p>
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-50 sm:text-[30px]">{viewerIsAdmin ? 'Báo cáo cá nhân' : 'Báo cáo của tôi'}</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-400">{viewerIsAdmin ? 'Chọn nhân sự để xem kết quả, chi phí quảng cáo và chất lượng chuyển đổi.' : 'Theo dõi kết quả, chi phí quảng cáo và chất lượng chuyển đổi của riêng bạn.'}</p>
        </div>
        {viewerIsAdmin ? (
          <label className="grid min-w-[240px] gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Users size={12} className="text-sky-300" /> Nhân sự đang xem</span>
            <select value={selectedPersonId} onChange={(event) => setSelectedPersonId(event.target.value)} disabled={peopleLoading} className="max-w-[360px] rounded-xl border border-white/10 bg-[#0d1520]/80 px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-white shadow-inner shadow-black/20 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 disabled:opacity-60">
              <option value="">{peopleLoading ? 'Đang tải danh sách…' : 'Chọn nhân sự cần xem'}</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name || person.email} · {person.email}</option>)}
            </select>
          </label>
        ) : (
          <div className="inline-flex items-center gap-2.5 rounded-xl border border-emerald-300/10 bg-[#0c1722]/60 px-3.5 py-2.5 text-xs font-bold text-slate-200">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-sky-300 to-indigo-400 text-[10px] font-extrabold text-slate-950">{(selectedPerson?.name || 'T').slice(0, 2).toUpperCase()}</span>
            <span><span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">Tài khoản cá nhân</span><span className="mt-0.5 block">{selectedPerson?.name || 'Tài khoản của tôi'}</span></span>
            <LockKeyhole size={13} className="ml-2 text-emerald-300" />
          </div>
        )}
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#131d29] p-3.5 shadow-lg shadow-black/10 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 hidden text-[9px] font-extrabold uppercase tracking-[.12em] text-slate-600 lg:inline">Kỳ báo cáo</span>
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.04] bg-[#0b121c]/80 p-1">
          {presets.map((item) => (
            <button key={item.id} type="button" onClick={() => choosePreset(item.id)} className={`rounded-lg px-3 py-2 text-[10px] font-bold transition ${preset === item.id ? 'bg-sky-500 text-slate-950 shadow-[0_3px_12px_rgba(56,189,248,.24)]' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'}`}>
              {item.label}
            </button>
          ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><CalendarDays size={16} className="text-sky-300" />{dateText(range.from)} – {dateText(range.to)}</div>
          <button type="button" onClick={() => { setDraftRange(range); setShowCustom((value) => !value); }} className="rounded-lg border border-white/10 bg-[#1b2838] px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/[0.06]">Chọn thời gian</button>
          <button type="button" onClick={() => setCompare((value) => !value)} aria-pressed={compare} className={`rounded-lg border px-3 py-2 text-[11px] font-bold ${compare ? 'border-sky-400/40 bg-sky-400/10 text-sky-200' : 'border-white/10 bg-[#1b2838] text-slate-300 hover:bg-white/[0.06]'}`}>Đối chiếu kỳ trước</button>
          <button type="button" onClick={() => void load()} className="rounded-lg border border-white/10 bg-[#1b2838] p-2 text-slate-300 hover:bg-white/[0.06]" aria-label="Tải lại"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </section>

      {showCustom && (
        <section className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.08] bg-[#151f2d] p-4">
          <label className="grid gap-1 text-[11px] font-bold text-slate-400">Từ ngày<input type="date" value={draftRange.from} max={draftRange.to || undefined} onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} className="rounded-lg border border-white/10 bg-[#101722] px-3 py-2 text-xs text-white" /></label>
          <label className="grid gap-1 text-[11px] font-bold text-slate-400">Đến ngày<input type="date" value={draftRange.to} min={draftRange.from || undefined} onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} className="rounded-lg border border-white/10 bg-[#101722] px-3 py-2 text-xs text-white" /></label>
          <button type="button" onClick={applyCustomRange} className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500">Áp dụng</button>
        </section>
      )}

      {viewerIsAdmin && !selectedPerson ? (
        <div className="rounded-xl border border-sky-300/15 bg-sky-300/[0.06] p-5 text-sm font-semibold text-sky-100">{peopleLoading ? 'Đang tải danh sách nhân sự…' : peopleError || 'Chọn một nhân sự để xem báo cáo cá nhân.'}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.08] p-4 text-sm font-semibold text-rose-200">{error}</div>
      ) : loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-sky-300/10 bg-sky-300/[0.04] p-4 text-xs font-semibold text-sky-100/80"><RefreshCw size={14} className="animate-spin" /> Đang tổng hợp dữ liệu cá nhân…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#131d29] p-4 text-xs font-semibold text-slate-400">Chưa có báo cáo trong khoảng thời gian đã chọn.</div>
      ) : alerts.length ? (
        <div className="flex gap-3 rounded-xl border border-rose-400/20 border-l-4 border-l-rose-400 bg-rose-400/[0.07] p-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-500 text-white"><TriangleAlert size={15} /></span>
          <div><strong className="text-sm text-rose-200">Chỉ số cần chú ý</strong><p className="mt-1 text-xs text-rose-100/70">{alerts.join(' ')}</p></div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-xl border border-emerald-400/20 border-l-4 border-l-emerald-400 bg-emerald-400/[0.06] p-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white"><CheckCircle2 size={15} /></span>
          <div><strong className="text-sm text-emerald-200">Các chỉ số đang trong ngưỡng</strong><p className="mt-1 text-xs text-emerald-100/70">Tiếp tục theo dõi tiến độ theo ngày.</p></div>
        </div>
      )}

      {(!viewerIsAdmin || selectedPerson) && <>
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-base font-extrabold">Chỉ số trọng tâm</h2><p className="mt-1 text-[11px] text-slate-500">{daily.length} ngày · {selectedPerson?.name || 'cá nhân'} · {priorCaption}</p></div>
        <span className="text-[10px] text-slate-500">Cập nhật theo khoảng thời gian đã chọn</span>
      </div>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Các chỉ số cá nhân">
        <Card label="Doanh số" value={formatMoney(metrics.revenue)} sub={targetVnd ? `Mục tiêu tháng ${formatKpiMoney(targetVnd)}` : 'Tổng doanh thu trong kỳ'} status={targetVnd && metrics.revenue >= targetVnd ? 'Đạt KPI' : 'Theo dõi'} tone="green" icon={<Target size={12} />} progress={revenueProgress} />
        <Card label="Đơn chốt" value={formatCount(metrics.orders)} sub={`${formatCount(metrics.leads)} data nhận trong kỳ`} status={metrics.closePct >= 32 ? 'Tốt' : 'Theo dõi'} tone={metrics.closePct >= 32 ? 'green' : 'amber'} icon={<ShoppingCart size={12} />} progress={metrics.closePct / 32 * 100} />
        <Card label="%ADS · Chi phí/Doanh thu" value={formatPercent(metrics.adsPct)} sub={`Chi phí Ads ${formatMoney(metrics.adCost)}`} status={metrics.adsPct <= 30 ? 'Trong ngưỡng' : 'Báo động'} tone={metrics.adsPct <= 30 ? 'blue' : 'red'} icon={<TriangleAlert size={12} />} progress={metrics.adsPct / 30 * 100} />
        <Card label="Tin nhắn" value={formatCount(metrics.mess)} sub="Tổng tin nhắn trong kỳ" status="Trong kỳ" tone="purple" icon={<MessageSquareText size={12} />} />
        <Card label="Data nhận · Lead" value={formatCount(metrics.leads)} sub={`Tỷ lệ nhận data ${formatPercent(metrics.leadPct)}`} status={metrics.leadPct >= 30 ? 'Đạt mục tiêu' : 'Theo dõi'} tone={metrics.leadPct >= 30 ? 'green' : 'amber'} icon={<Users size={12} />} progress={metrics.leadPct / 30 * 100} />
        <Card label="Tỷ lệ chốt" value={formatPercent(metrics.closePct)} sub="Đơn chốt / data nhận" status={metrics.closePct >= 32 ? 'Đạt mục tiêu' : 'Theo dõi'} tone={metrics.closePct >= 32 ? 'green' : 'amber'} icon={<CheckCircle2 size={12} />} progress={metrics.closePct / 32 * 100} />
        <Card label="CPL · Chi phí mỗi Lead" value={formatMoney(metrics.cpl)} sub="Chi phí Ads / data nhận" status="Theo dõi" tone="purple" icon={<Users size={12} />} progress={metrics.cpl ? 100 - Math.min(100, metrics.cpl / 1000000 * 20) : 4} />
        <Card label="Dự báo doanh số tháng" value={formatMoney(forecast)} sub={`Ước tính theo bình quân ${formatMoney(metrics.revenue / days)}/ngày`} status="Tham khảo" tone="blue" icon={<Target size={12} />} progress={targetVnd ? forecast / targetVnd * 100 : 42} />
      </section>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,.82fr)]">
        <section className="rounded-2xl border border-white/[0.08] bg-[#151f2d] p-4 shadow-lg shadow-black/10 sm:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-extrabold">Doanh số, chi phí và %ADS theo ngày</h2><p className="mt-1 text-[11px] text-slate-500">Xu hướng trong khoảng thời gian đã chọn</p></div><span className="text-[10px] text-slate-500">{daily.length} ngày dữ liệu</span></div>
          <div className="h-[270px] w-full">
            {loading ? <div className="grid h-full place-items-center text-xs text-slate-500">Đang tải dữ liệu…</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(8)} tick={{ fill: '#8290a3', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="money" tickFormatter={(value: number) => formatMoney(value)} tick={{ fill: '#8290a3', fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                  <YAxis yAxisId="percent" orientation="right" tickFormatter={(value: number) => `${value}%`} tick={{ fill: '#8290a3', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip contentStyle={{ background: '#101722', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#e2e8f0', fontSize: 11 }} labelFormatter={(value) => formatReportDateVi(String(value))} formatter={(value, name) => [name === '%ADS' ? `${Number(value).toFixed(1)}%` : formatMoney(Number(value)), name]} />
                  <ReferenceLine yAxisId="percent" y={30} stroke="#fb7185" strokeDasharray="5 5" />
                  <Bar yAxisId="money" dataKey="revenue" name="Doanh số" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={15} />
                  <Bar yAxisId="money" dataKey="adCost" name="Chi phí Ads" fill="#818cf8" radius={[3, 3, 0, 0]} maxBarSize={15} />
                  <Line yAxisId="percent" type="monotone" dataKey={(row: DailyMetrics) => row.revenue ? row.adCost / row.revenue * 100 : 0} name="%ADS" stroke="#fbbf24" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-emerald-400" />Doanh số</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-indigo-400" />Chi phí</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-400" />%ADS thực tế</span><span className="inline-flex items-center gap-1.5"><i className="h-px w-3 bg-rose-400" />Trần %ADS 30%</span></div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#151f2d] p-4 shadow-lg shadow-black/10 sm:p-5">
          <div><h2 className="text-sm font-extrabold">Phễu chuyển đổi của tôi</h2><p className="mt-1 text-[11px] text-slate-500">Từ tin nhắn đến đơn hàng</p></div>
          <div className="mt-5 space-y-3">
            {[
              { label: 'Tin nhắn', value: metrics.mess, rate: 100, color: 'bg-violet-400', note: `${formatCount(metrics.mess / days)} tin/ngày` },
              { label: 'Data nhận', value: metrics.leads, rate: metrics.mess ? metrics.leads / metrics.mess * 100 : 0, color: 'bg-sky-400', note: `${formatPercent(metrics.leadPct)} · mục tiêu 30%` },
              { label: 'Đơn hàng', value: metrics.orders, rate: metrics.mess ? metrics.orders / metrics.mess * 100 : 0, color: 'bg-emerald-400', note: `${formatPercent(metrics.closePct)} chốt trên data · mục tiêu 32%` },
            ].map((stage) => (
              <div key={stage.label} className="rounded-xl border border-white/[0.06] bg-[#101722] p-3">
                <div className="flex items-baseline justify-between gap-3"><span className="text-[11px] font-bold text-slate-400">{stage.label}</span><strong className="text-lg font-extrabold">{formatCount(stage.value)}</strong></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${stage.color}`} style={{ width: `${Math.max(stage.value > 0 ? 3 : 0, Math.min(stage.rate, 100))}%` }} /></div>
                <p className="mt-1.5 text-[10px] text-slate-500">{stage.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-sky-300/10 bg-sky-300/[0.06] p-3"><strong className="block text-[11px] text-sky-200">Dự báo đến cuối tháng</strong><span className="mt-1 block text-xl font-extrabold text-sky-100">{formatMoney(forecast)}</span><p className="mt-1 text-[10px] text-slate-500">Ước tính nếu duy trì bình quân {formatMoney(metrics.revenue / days)}/ngày.</p></div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-[#151f2d] p-4 shadow-lg shadow-black/10 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-extrabold">Chi tiết theo ngày</h2><p className="mt-1 text-[11px] text-slate-500">Dữ liệu tổng hợp trong khoảng thời gian đã chọn</p></div><button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#1b2838] px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/[0.06]"><Download size={14} /> Tải CSV</button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-right text-xs">
            <thead><tr className="bg-[#101722] text-[9px] font-extrabold uppercase tracking-wide text-slate-500"><th className="rounded-l-lg p-3 text-left">Ngày</th><th className="p-3">Mess</th><th className="p-3">Data nhận</th><th className="p-3">Tỷ lệ nhận</th><th className="p-3">Đơn</th><th className="p-3">Tỷ lệ chốt</th><th className="p-3">Doanh số</th><th className="p-3">Chi phí</th><th className="rounded-r-lg p-3">%ADS</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="p-8 text-center text-slate-500">Đang tải dữ liệu…</td></tr> : displayRows.length ? displayRows.map((row) => {
                const leadPct = row.mess ? row.leads / row.mess * 100 : 0;
                const closePct = row.leads ? row.orders / row.leads * 100 : 0;
                const adsPct = row.revenue ? row.adCost / row.revenue * 100 : 0;
                return <tr key={row.date} className="border-t border-white/[0.05] text-slate-300 hover:bg-white/[0.025]"><td className="p-3 text-left font-semibold">{dateText(row.date)}</td><td className="p-3">{formatCount(row.mess)}</td><td className="p-3">{formatCount(row.leads)}</td><td className={`p-3 ${leadPct >= 30 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPercent(leadPct)}</td><td className="p-3">{formatCount(row.orders)}</td><td className={`p-3 ${closePct >= 32 ? 'text-emerald-300' : 'text-amber-300'}`}>{formatPercent(closePct)}</td><td className="p-3 font-bold text-emerald-300">{formatMoney(row.revenue)}</td><td className="p-3">{formatMoney(row.adCost)}</td><td className={`p-3 ${adsPct <= 30 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPercent(adsPct)}</td></tr>;
              }) : <tr><td colSpan={9} className="p-8 text-center text-slate-500">Không có dữ liệu trong khoảng thời gian này.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-slate-600">Phạm vi hiển thị: báo cáo gắn với email hoặc mã nhân sự của {viewerIsAdmin ? selectedPerson?.name || 'nhân sự đã chọn' : 'bạn'}.</p>
      </section>

      </>}
      <footer className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-slate-600"><LockKeyhole size={12} /> Báo cáo hiệu quả cá nhân · {selectedPerson?.name || 'Tài khoản của tôi'}</footer>
    </div>
  );
};
