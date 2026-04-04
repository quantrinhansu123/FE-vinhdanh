import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { DuAnRow, ReportRow } from '../../../types';
import { formatCompactVnd } from '../mkt/mktDetailReportShared';
import { ProjectFormModal } from './ProjectFormModal';

const REPORTS_TABLE = 'detail_reports';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';

const ADS_CRITICAL = 45;
const ADS_WARN = 30;
const PAGE_SIZE = 8;

const MIN_LEAD_FOR_LOW_CLOSE = 15;
const LOW_CLOSE_PCT = 15;
const MIN_CHI_FOR_ZERO_LEAD = 3_000_000;

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

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function tyLeChot(tongData: number, orders: number, tongLead: number): number | null {
  if (tongData > 0 && Number.isFinite(orders)) return (orders / tongData) * 100;
  if (tongLead > 0 && Number.isFinite(orders)) return (orders / tongLead) * 100;
  return null;
}

function tierBurn(adsPct: number, revenue: number, adCost: number): 'crit' | 'warn' | 'ok' {
  if (adCost <= 0 && revenue <= 0) return 'ok';
  if (revenue <= 0 && adCost > 0) return 'crit';
  if (adsPct > ADS_CRITICAL) return 'crit';
  if (adsPct >= ADS_WARN) return 'warn';
  return 'ok';
}

function formatVndDots(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('vi-VN');
}

type Agg = {
  key: string;
  displayName: string;
  team: string | null;
  adCost: number;
  revenue: number;
  mess: number;
  tongLead: number;
  orders: number;
  tongData: number;
};

type SysAlert = {
  id: string;
  title: string;
  description: string;
  statusText: string;
  statusType: 'R' | 'Y';
};

function displayMa(ma: string | null, ten: string): string {
  if (ma?.trim()) {
    const t = ma.trim();
    if (t.length <= 8) return t.toUpperCase();
    return `${t.slice(0, 4).toUpperCase()}…`;
  }
  const id = ten.replace(/\s/g, '').slice(0, 4);
  return id ? `PJ-${id.toUpperCase()}` : 'PJ-—';
}

function badgeForStatus(trangThai: string | undefined): { label: string; kind: 'active' | 'pending' | 'hold' | 'neutral' } {
  switch (trangThai) {
    case 'dang_chay':
      return { label: 'Active', kind: 'active' };
    case 'review':
    case 'tam_dung':
      return { label: trangThai === 'review' ? 'Review' : 'Tạm dừng', kind: 'pending' };
    case 'ket_thuc':
      return { label: 'Kết thúc', kind: 'neutral' };
    case 'huy':
      return { label: 'Huỷ', kind: 'hold' };
    default:
      return { label: trangThai?.trim() || '—', kind: 'neutral' };
  }
}

function initials(s: string): string {
  const p = s.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function rowIconVariant(id: string): { icon: string; box: string; ic: string } {
  const h = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const set = [
    { icon: 'rocket_launch', box: 'from-[color-mix(in_srgb,var(--ld-primary)_20%,transparent)] to-[color-mix(in_srgb,var(--ld-secondary)_20%,transparent)]', ic: 'text-[var(--ld-primary)]' },
    { icon: 'language', box: 'from-[color-mix(in_srgb,var(--ld-tertiary)_20%,transparent)] to-[color-mix(in_srgb,var(--ld-error)_15%,transparent)]', ic: 'text-[var(--ld-tertiary)]' },
    { icon: 'database', box: 'from-[color-mix(in_srgb,var(--ld-primary)_18%,transparent)] to-[color-mix(in_srgb,var(--ld-primary-container)_25%,transparent)]', ic: 'text-[var(--ld-primary-container)]' },
    { icon: 'verified_user', box: 'from-[color-mix(in_srgb,var(--ld-secondary)_20%,transparent)] to-[color-mix(in_srgb,var(--ld-primary)_18%,transparent)]', ic: 'text-[var(--ld-secondary)]' },
    { icon: 'token', box: 'from-[color-mix(in_srgb,var(--ld-primary)_15%,transparent)] to-[color-mix(in_srgb,var(--ld-tertiary)_15%,transparent)]', ic: 'text-[var(--ld-primary)]' },
  ];
  return set[h % set.length];
}

const marketDot = ['bg-[var(--ld-tertiary)]', 'bg-[var(--ld-secondary)]', 'bg-[var(--ld-outline)]'] as const;

export const AlertsView: React.FC = () => {
  const [repRows, setRepRows] = useState<ReportRow[]>([]);
  const [projects, setProjects] = useState<DuAnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<DuAnRow | null>(null);
  const [search, setSearch] = useState('');
  const [filterRunning, setFilterRunning] = useState(false);
  const [page, setPage] = useState(1);

  const monthRef = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => toLocalYyyyMmDd(startOfMonth(monthRef)), [monthRef]);
  const monthEnd = useMemo(() => toLocalYyyyMmDd(endOfMonth(monthRef)), [monthRef]);
  const monthVi = useMemo(
    () => monthRef.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }),
    [monthRef]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [repRes, duRes] = await Promise.all([
      supabase
        .from(REPORTS_TABLE)
        .select(
          'report_date, name, email, team, ad_cost, revenue, mess_comment_count, tong_lead, order_count, tong_data_nhan'
        )
        .gte('report_date', monthStart)
        .lte('report_date', monthEnd)
        .limit(8000),
      supabase
        .from(DU_AN_TABLE)
        .select(
          'id, ma_du_an, ten_du_an, don_vi, mo_ta, thi_truong, leader, so_mkt, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, doanh_thu_thang, ty_le_ads_doanh_so, ngay_bat_dau, ngay_ket_thuc, trang_thai, staff_ids'
        )
        .order('ten_du_an', { ascending: true }),
    ]);

    if (repRes.error) {
      console.error('alerts view reports:', repRes.error);
      setError(repRes.error.message || 'Không tải được báo cáo.');
      setRepRows([]);
    } else {
      setRepRows((repRes.data || []) as ReportRow[]);
    }

    if (duRes.error) {
      console.error('alerts view du_an:', duRes.error);
      if (!repRes.error) setError(duRes.error.message || 'Không tải được dự án.');
      setProjects([]);
    } else {
      setProjects((duRes.data || []) as DuAnRow[]);
    }

    setLoading(false);
  }, [monthStart, monthEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const byMarketer = useMemo(() => {
    const map = new Map<string, Agg>();
    for (const r of repRows) {
      const email = r.email?.trim().toLowerCase() || '';
      const nm = (r.name || '').trim();
      const key = email || nm || `anon-${map.size}`;
      const displayName = nm || email || '—';
      const cur =
        map.get(key) ||
        ({
          key,
          displayName,
          team: r.team?.trim() || null,
          adCost: 0,
          revenue: 0,
          mess: 0,
          tongLead: 0,
          orders: 0,
          tongData: 0,
        } satisfies Agg);
      cur.adCost += safeNum(r.ad_cost);
      cur.revenue += safeNum(r.revenue);
      cur.mess += safeNum(r.mess_comment_count);
      cur.tongLead += safeNum(r.tong_lead);
      cur.orders += safeNum(r.order_count);
      cur.tongData += safeNum(r.tong_data_nhan);
      if (!cur.team && r.team?.trim()) cur.team = r.team.trim();
      if (cur.displayName === '—' && nm) cur.displayName = displayName;
      map.set(key, cur);
    }
    return Array.from(map.values()).filter((m) => m.adCost > 0 || m.revenue > 0);
  }, [repRows]);

  const scored = useMemo(() => {
    return byMarketer.map((m) => {
      const adsPct = m.revenue > 0 ? (m.adCost / m.revenue) * 100 : m.adCost > 0 ? 100 : 0;
      const closePct = tyLeChot(m.tongData, m.orders, m.tongLead);
      const burnTier = tierBurn(adsPct, m.revenue, m.adCost);
      return { ...m, adsPct, closePct, burnTier };
    });
  }, [byMarketer]);

  const kpi = useMemo(() => {
    let crit = 0;
    let warn = 0;
    let ok = 0;
    for (const s of scored) {
      if (s.burnTier === 'crit') crit += 1;
      else if (s.burnTier === 'warn') warn += 1;
      else ok += 1;
    }
    return { crit, warn, ok };
  }, [scored]);

  const alerts = useMemo((): SysAlert[] => {
    const out: SysAlert[] = [];

    const critBurn = scored.filter((s) => s.burnTier === 'crit');
    if (critBurn.length > 0) {
      const bits = critBurn.slice(0, 6).map((s) => {
        const pct = s.revenue > 0 ? `${s.adsPct.toFixed(1)}%` : 'chi khi DT=0';
        return `${s.displayName} (${pct})`;
      });
      const more = critBurn.length > 6 ? ` · …+${critBurn.length - 6} người` : '';
      out.push({
        id: 'burn-crit',
        title: `Ads/DT nguy hiểm — tháng ${monthVi}`,
        description: `${bits.join(' · ')}${more} · ${REPORTS_TABLE}`,
        statusText: 'Nguy hiểm',
        statusType: 'R',
      });
    }

    const lowClose = scored.filter(
      (s) =>
        s.tongLead >= MIN_LEAD_FOR_LOW_CLOSE &&
        s.closePct != null &&
        s.closePct < LOW_CLOSE_PCT &&
        s.revenue > 0
    );
    if (lowClose.length > 0) {
      const bits = lowClose.slice(0, 5).map(
        (s) => `${s.displayName} — ${Math.round(s.tongLead)} lead, chốt ${s.closePct!.toFixed(1)}%`
      );
      const more = lowClose.length > 5 ? ` · …+${lowClose.length - 5}` : '';
      out.push({
        id: 'low-close',
        title: 'Nhiều lead nhưng tỷ lệ chốt thấp',
        description: bits.join(' · ') + more,
        statusText: 'Rủi ro chốt',
        statusType: 'R',
      });
    }

    const warnBurn = scored.filter((s) => s.burnTier === 'warn');
    if (warnBurn.length > 0) {
      const bits = warnBurn.slice(0, 6).map((s) => `${s.displayName} (${s.adsPct.toFixed(1)}%)`);
      const more = warnBurn.length > 6 ? ` · …+${warnBurn.length - 6}` : '';
      out.push({
        id: 'burn-warn',
        title: `Ads/DT cần theo dõi (${ADS_WARN}–${ADS_CRITICAL}%)`,
        description: bits.join(' · ') + more + ` · ${REPORTS_TABLE}`,
        statusText: 'Theo dõi',
        statusType: 'Y',
      });
    }

    const zeroLead = scored.filter(
      (s) => s.adCost >= MIN_CHI_FOR_ZERO_LEAD && s.tongLead <= 0 && s.mess <= 0
    );
    if (zeroLead.length > 0) {
      const bits = zeroLead.slice(0, 5).map(
        (s) => `${s.displayName} · chi ${formatCompactVnd(s.adCost)} · 0 lead/mess`
      );
      const more = zeroLead.length > 5 ? ` · …+${zeroLead.length - 5}` : '';
      out.push({
        id: 'spend-no-lead',
        title: 'Chi ads nhưng không có lead / mess ghi nhận',
        description: bits.join(' · ') + more,
        statusText: 'Bất thường',
        statusType: 'Y',
      });
    }

    const messZeroRows: string[] = [];
    const seen = new Set<string>();
    for (const r of repRows) {
      const ord = safeNum(r.order_count);
      const rev = safeNum(r.revenue);
      const mess = safeNum(r.mess_comment_count);
      if (mess > 0 || (ord <= 0 && rev <= 0)) continue;
      const d = r.report_date?.slice(0, 10) || '';
      const email = r.email?.trim().toLowerCase() || '';
      const label = (r.name || email || '—').trim();
      const key = `${email}|${d}`;
      if (seen.has(key)) continue;
      seen.add(key);
      messZeroRows.push(`${label} · ${d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')} · đơn/DT nhưng mess=0`);
      if (messZeroRows.length >= 8) break;
    }
    if (messZeroRows.length > 0) {
      out.push({
        id: 'mess-zero',
        title: 'Có đơn hoặc doanh thu nhưng mess = 0 (theo từng dòng báo cáo)',
        description: messZeroRows.join(' · '),
        statusText: 'Kiểm tra',
        statusType: 'Y',
      });
    }

    return out;
  }, [scored, repRows, monthVi]);

  const marketsCount = useMemo(() => {
    const s = new Set<string>();
    for (const p of projects) {
      const t = p.thi_truong?.trim();
      if (t) s.add(t);
    }
    return s.size;
  }, [projects]);

  const revenueSum = useMemo(() => {
    return projects.reduce((a, p) => a + safeNum(p.doanh_thu_thang ?? p.tong_doanh_so), 0);
  }, [projects]);

  const capacityPct = useMemo(() => {
    if (!projects.length) return 0;
    const run = projects.filter((p) => p.trang_thai === 'dang_chay').length;
    return Math.round((run / projects.length) * 100);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (filterRunning && p.trang_thai !== 'dang_chay') return false;
      if (!q) return true;
      return (
        p.ten_du_an.toLowerCase().includes(q) ||
        (p.ma_du_an || '').toLowerCase().includes(q) ||
        (p.thi_truong || '').toLowerCase().includes(q) ||
        (p.leader || '').toLowerCase().includes(q)
      );
    });
  }, [projects, search, filterRunning]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * PAGE_SIZE;
    return filteredProjects.slice(start, start + PAGE_SIZE);
  }, [filteredProjects, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, filterRunning]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const exportCsv = useCallback(() => {
    const headers = ['Mã', 'Tên', 'Thị trường', 'Leader', 'MKT', 'DT tháng', 'Trạng thái'];
    const lines = [
      headers.join(','),
      ...filteredProjects.map((p) =>
        [
          displayMa(p.ma_du_an, p.ten_du_an),
          `"${(p.ten_du_an || '').replace(/"/g, '""')}"`,
          `"${(p.thi_truong || '').replace(/"/g, '""')}"`,
          `"${(p.leader || '').replace(/"/g, '""')}"`,
          p.so_mkt ?? '',
          p.doanh_thu_thang ?? p.tong_doanh_so ?? '',
          p.trang_thai || '',
        ].join(',')
      ),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `alerts-projects-${DU_AN_TABLE}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filteredProjects]);

  const statusPillClass = (kind: 'active' | 'pending' | 'hold' | 'neutral') => {
    if (kind === 'active')
      return 'bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)] text-[var(--ld-secondary)] border-[var(--ld-secondary)]/20';
    if (kind === 'pending')
      return 'bg-[color-mix(in_srgb,var(--ld-tertiary)_10%,transparent)] text-[var(--ld-tertiary)] border-[var(--ld-tertiary)]/20';
    if (kind === 'hold')
      return 'bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)] text-[var(--ld-error)] border-[var(--ld-error)]/20';
    return 'bg-[color-mix(in_srgb,var(--ld-on-surface-variant)_8%,transparent)] text-[var(--ld-on-surface-variant)] border-[var(--ld-outline-variant)]/20';
  };

  if (loading) {
    return (
      <div className="leader-dash-obsidian dash-fade-up flex items-center justify-center min-h-[220px] gap-3 text-[var(--ld-on-surface-variant)]">
        <Loader2 className="animate-spin text-[var(--ld-primary)]" size={24} />
        <span className="text-sm font-semibold">Đang tải {DU_AN_TABLE} &amp; {REPORTS_TABLE}…</span>
      </div>
    );
  }

  return (
    <div className="leader-dash-obsidian dash-fade-up text-[var(--ld-on-surface)] selection:bg-[var(--ld-primary)] selection:text-[var(--ld-on-primary-container)] -m-[12px] p-6 sm:p-8 max-w-[1600px] mx-auto pb-16">
      {error ? (
        <div className="mb-6 text-[12px] text-[var(--ld-error)] border border-[var(--ld-error)]/25 rounded-xl px-4 py-3 bg-[color-mix(in_srgb,var(--ld-error)_12%,transparent)] flex flex-wrap items-center gap-3">
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

      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-10">
        <div>
          <nav className="flex items-center gap-2 text-[var(--ld-on-surface-variant)] text-xs leader-dash-label mb-2">
            <span>CRM Admin</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-[var(--ld-primary)]/90">Cảnh báo &amp; dự án</span>
          </nav>
          <h1 className="text-3xl font-black tracking-tight text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
            Module 1 — Quản lý dự án
          </h1>
          <p className="text-sm text-[var(--ld-on-surface-variant)] leader-dash-label mt-1">
            Bảng dự án ({DU_AN_TABLE}) + cảnh báo từ báo cáo MKT tháng {monthVi}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingProject(null);
            setFormOpen(true);
          }}
          className="px-6 py-2.5 bg-[var(--ld-primary)] text-[var(--ld-on-primary-container)] font-bold rounded-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined">add_circle</span>
          Thêm dự án
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl border border-[var(--ld-outline-variant)]/5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[var(--ld-on-surface-variant)] leader-dash-label text-sm uppercase tracking-wider">Tổng dự án</span>
            <span className="material-symbols-outlined text-[var(--ld-primary)]">analytics</span>
          </div>
          <div className="text-3xl font-black text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
            {projects.length}
          </div>
          <div className="text-[var(--ld-secondary)] text-xs mt-2 flex items-center gap-1 leader-dash-label">
            <span className="material-symbols-outlined text-[14px]">campaign</span>
            {alerts.length} nhóm cảnh báo · {kpi.crit} MKT nguy hiểm
          </div>
        </div>
        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl border border-[var(--ld-outline-variant)]/5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[var(--ld-on-surface-variant)] leader-dash-label text-sm uppercase tracking-wider">Thị trường</span>
            <span className="material-symbols-outlined text-[var(--ld-tertiary)]">public</span>
          </div>
          <div className="text-3xl font-black text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
            {String(marketsCount).padStart(2, '0')}
          </div>
          <div className="text-[var(--ld-on-surface-variant)] text-xs mt-2 leader-dash-label">Giá trị khác nhau · thi_truong</div>
        </div>
        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl border border-[var(--ld-outline-variant)]/5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[var(--ld-on-surface-variant)] leader-dash-label text-sm uppercase tracking-wider">DT gộp (dự án)</span>
            <span className="material-symbols-outlined text-[var(--ld-secondary)]">monetization_on</span>
          </div>
          <div className="text-3xl font-black text-[var(--ld-on-surface)] truncate" style={{ fontFamily: '"Inter", sans-serif' }} title={formatVndDots(revenueSum)}>
            {formatCompactVnd(revenueSum)}
          </div>
          <div className="text-[var(--ld-secondary)] text-xs mt-2 flex items-center gap-1 leader-dash-label">
            <span className="material-symbols-outlined text-[14px]">bolt</span>
            doanh_thu_thang / tong_doanh_so
          </div>
        </div>
        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl border border-[var(--ld-outline-variant)]/5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[var(--ld-on-surface-variant)] leader-dash-label text-sm uppercase tracking-wider">Dự án đang chạy</span>
            <span className="material-symbols-outlined text-[var(--ld-primary)]">groups</span>
          </div>
          <div className="text-3xl font-black text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
            {capacityPct}%
          </div>
          <div className="w-full bg-[var(--ld-surface-container-highest)] h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-[var(--ld-primary)] h-full rounded-full transition-all" style={{ width: `${capacityPct}%` }} />
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <section className="mb-8 space-y-3">
          <h3 className="text-sm font-bold text-[var(--ld-on-surface)] flex items-center gap-2" style={{ fontFamily: '"Inter", sans-serif' }}>
            <span className="material-symbols-outlined text-[var(--ld-error)]">notifications_active</span>
            Cảnh báo hệ thống ({monthVi})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="rounded-xl p-4 border border-[var(--ld-outline-variant)]/15 backdrop-blur-md bg-[color-mix(in_srgb,var(--ld-surface-container)_72%,transparent)]"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="text-sm font-bold text-[var(--ld-on-surface)]">{a.title}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                      a.statusType === 'R'
                        ? 'bg-[color-mix(in_srgb,var(--ld-error)_15%,transparent)] text-[var(--ld-error)]'
                        : 'bg-[color-mix(in_srgb,var(--ld-tertiary)_12%,transparent)] text-[var(--ld-tertiary)]'
                    }`}
                  >
                    {a.statusText}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ld-on-surface-variant)] leading-relaxed">{a.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="bg-[var(--ld-surface-container-low)] rounded-xl overflow-hidden border border-[var(--ld-outline-variant)]/10 ld-ghost-border shadow-2xl shadow-black/20">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--ld-outline-variant)]/10">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ld-on-surface-variant)] text-[20px] pointer-events-none">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[var(--ld-surface-container-highest)] border-none rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--ld-on-surface)] focus:ring-2 focus:ring-[var(--ld-primary)] w-full sm:w-64 outline-none placeholder:text-[var(--ld-on-surface-variant)]/50"
                placeholder="Tìm kiếm dự án…"
                type="search"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterRunning((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 text-sm leader-dash-label rounded-lg transition-colors ${
                filterRunning
                  ? 'text-[var(--ld-primary)] bg-[var(--ld-surface-container-highest)]'
                  : 'text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-on-surface)] hover:bg-[var(--ld-surface-container-highest)]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              {filterRunning ? 'Chỉ đang chạy' : 'Bộ lọc'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!filteredProjects.length}
              className="p-2 text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-on-surface)] transition-colors disabled:opacity-30"
              title="Export CSV"
            >
              <span className="material-symbols-outlined">download</span>
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="p-2 text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-on-surface)] transition-colors"
              title="Làm mới"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto leader-dash-no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-[var(--ld-on-surface-variant)] leader-dash-label text-[10px] uppercase tracking-[0.15em]">
                <th className="px-8 py-5 font-semibold">Mã</th>
                <th className="px-6 py-5 font-semibold">Tên dự án</th>
                <th className="px-6 py-5 font-semibold">Thị trường</th>
                <th className="px-6 py-5 font-semibold">Leader</th>
                <th className="px-6 py-5 font-semibold">MKT</th>
                <th className="px-6 py-5 font-semibold text-right">DT tháng</th>
                <th className="px-6 py-5 font-semibold">Trạng thái</th>
                <th className="px-8 py-5 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-8 py-14 text-center text-sm text-[var(--ld-on-surface-variant)]">
                    {projects.length === 0
                      ? `Chưa có dự án trong ${DU_AN_TABLE}.`
                      : 'Không khớp bộ lọc / tìm kiếm.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => {
                  const st = badgeForStatus(row.trang_thai);
                  const rv = rowIconVariant(row.id);
                  const dot = marketDot[idx % marketDot.length];
                  const dt = safeNum(row.doanh_thu_thang ?? row.tong_doanh_so);
                  return (
                    <tr key={row.id} className="group hover:bg-[var(--ld-surface-container-high)] transition-colors border-b border-[var(--ld-outline-variant)]/5">
                      <td className="px-8 py-4">
                        <span className="bg-[var(--ld-surface-container-lowest)] px-2 py-1 rounded text-xs font-mono text-[var(--ld-primary)] border border-[var(--ld-outline-variant)]/20">
                          {displayMa(row.ma_du_an, row.ten_du_an)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded shrink-0 bg-gradient-to-br ${rv.box} flex items-center justify-center`}
                          >
                            <span className={`material-symbols-outlined ${rv.ic} text-[18px]`}>{rv.icon}</span>
                          </div>
                          <span className="font-semibold text-[var(--ld-on-surface)] truncate" style={{ fontFamily: '"Inter", sans-serif' }}>
                            {row.ten_du_an}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                          <span className="text-sm leader-dash-label truncate">{row.thi_truong || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--ld-primary)_12%,transparent)] flex items-center justify-center text-[10px] font-bold text-[var(--ld-primary)] ring-2 ring-[var(--ld-surface-container-low)]">
                            {initials(row.leader || row.ten_du_an || '?')}
                          </div>
                          <span className="text-sm text-[var(--ld-on-surface)] truncate max-w-[120px]" title={row.leader || ''}>
                            {row.leader || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--ld-on-surface-variant)] leader-dash-label tabular-nums">
                        {row.so_mkt != null ? row.so_mkt : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-[var(--ld-secondary)] tabular-nums text-sm">
                        {formatVndDots(dt)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusPillClass(st.kind)}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            title="Sửa"
                            onClick={() => {
                              setEditingProject(row);
                              setFormOpen(true);
                            }}
                            className="p-2 hover:bg-[var(--ld-surface-container-highest)] text-[var(--ld-primary)] rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit_square</span>
                          </button>
                          <button
                            type="button"
                            title="Làm mới danh sách"
                            onClick={() => void load()}
                            className="p-2 hover:bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)] rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-[var(--ld-outline-variant)]/10">
          <span className="text-sm text-[var(--ld-on-surface-variant)] leader-dash-label">
            Hiển thị {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredProjects.length)} / {filteredProjects.length}{' '}
            dự án
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 hover:bg-[var(--ld-surface-container-highest)] rounded-lg disabled:opacity-20 transition-colors"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
              .reduce<(number | 'dots')[]>((acc, n, i, arr) => {
                if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('dots');
                acc.push(n);
                return acc;
              }, [])
              .map((item, i) =>
                item === 'dots' ? (
                  <span key={`d-${i}`} className="px-2 text-[var(--ld-on-surface-variant)]">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                      item === safePage
                        ? 'bg-[var(--ld-primary)] text-[var(--ld-on-primary-container)]'
                        : 'hover:bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface)]'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 hover:bg-[var(--ld-surface-container-highest)] rounded-lg disabled:opacity-20 transition-colors"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-12 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-[var(--ld-on-surface-variant)]/50 text-[10px] leader-dash-label uppercase tracking-widest">
        <div>CRM · Cảnh báo &amp; quản lý dự án</div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="hover:text-[var(--ld-primary)] transition-colors cursor-default">
            {REPORTS_TABLE}: tháng {monthVi}
          </span>
          <span className="w-1 h-1 rounded-full bg-[var(--ld-secondary)]" />
          <span>{alerts.length ? `${alerts.length} cảnh báo` : 'Không cảnh báo'}</span>
        </div>
      </footer>

      <ProjectFormModal
        open={formOpen}
        initial={editingProject}
        onClose={() => {
          setFormOpen(false);
          setEditingProject(null);
        }}
        onSaved={() => void load()}
      />
    </div>
  );
};
