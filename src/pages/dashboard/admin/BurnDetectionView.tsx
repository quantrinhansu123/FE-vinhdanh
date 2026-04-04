import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { ReportRow } from '../../../types';

const REPORTS_TABLE = 'detail_reports';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';

const ADS_CRITICAL = 45;
const ADS_WARN = 30;
const WASTE_TARGET_FRAC = 0.35;

type DuAnOpt = { id: string; ma_du_an: string | null; ten_du_an: string };
type TkqcOpt = { id: string; ma_tkqc: string };

function toLocalYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(y: number, m0: number): Date {
  return new Date(y, m0, 1);
}

function endOfMonth(y: number, m0: number): Date {
  return new Date(y, m0 + 1, 0);
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

function formatVndDots(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('vi-VN');
}

function formatCompactK(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  return `${Math.round(n / 1_000)}k`;
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

function wasteVnd(revenue: number, adCost: number): number {
  if (revenue <= 0) return adCost > 0 ? adCost : 0;
  return Math.max(0, adCost - revenue * WASTE_TARGET_FRAC);
}

function burnScoreValue(adsPct: number, revenue: number, closePct: number | null): number {
  if (adCostOnly(revenue, adsPct)) return Math.min(100, Math.round(adsPct));
  let s = adsPct;
  if (closePct != null && closePct < 18) s += 12;
  return Math.min(100, Math.round(s));
}

function adCostOnly(revenue: number, adsPct: number): boolean {
  return revenue <= 0 && adsPct >= 100;
}

function tierForRow(adsPct: number, revenue: number, adCost: number): 'crit' | 'warn' | 'ok' {
  if (adCost <= 0 && revenue <= 0) return 'ok';
  if (revenue <= 0 && adCost > 0) return 'crit';
  if (adsPct > ADS_CRITICAL) return 'crit';
  if (adsPct >= ADS_WARN) return 'warn';
  return 'ok';
}

function actionLabel(t: 'crit' | 'warn' | 'ok'): string {
  if (t === 'crit') return 'Rà soát chi phí / Creative';
  if (t === 'warn') return 'Theo dõi thêm';
  return 'Duy trì ngân sách';
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

const monthOptions = (): { value: string; label: string }[] => {
  const out: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const v = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      value: v,
      label: x.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }),
    });
  }
  return out;
};

export const BurnDetectionView: React.FC = () => {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [idDuAn, setIdDuAn] = useState('');
  const [duAnList, setDuAnList] = useState<DuAnOpt[]>([]);
  const [tkqcList, setTkqcList] = useState<TkqcOpt[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'crit' | 'normal'>('all');
  const [search, setSearch] = useState('');

  const bounds = useMemo(() => {
    const [ys, ms] = ym.split('-');
    const y = Number(ys);
    const m0 = Number(ms) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(m0)) {
      const t = new Date();
      return {
        start: toLocalYyyyMmDd(startOfMonth(t.getFullYear(), t.getMonth())),
        end: toLocalYyyyMmDd(endOfMonth(t.getFullYear(), t.getMonth())),
      };
    }
    return {
      start: toLocalYyyyMmDd(startOfMonth(y, m0)),
      end: toLocalYyyyMmDd(endOfMonth(y, m0)),
    };
  }, [ym]);

  const loadRefs = useCallback(async () => {
    const dRes = await supabase.from(DU_AN_TABLE).select('id, ma_du_an, ten_du_an').order('ten_du_an', { ascending: true });
    if (dRes.error) console.error('burn-detect du_an:', dRes.error);
    else setDuAnList((dRes.data || []) as DuAnOpt[]);
  }, []);

  const loadTkqc = useCallback(async (projectId: string) => {
    if (!projectId) {
      setTkqcList([]);
      return;
    }
    const q = await supabase.from(TKQC_TABLE).select('id, ma_tkqc').eq('id_du_an', projectId).order('ma_tkqc', { ascending: true });
    if (q.error) {
      console.error('burn-detect tkqc:', q.error);
      setTkqcList([]);
      return;
    }
    setTkqcList((q.data || []) as TkqcOpt[]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from(REPORTS_TABLE)
      .select(
        'name, email, team, ad_cost, revenue, mess_comment_count, tong_lead, order_count, tong_data_nhan, report_date, ma_tkqc'
      )
      .gte('report_date', bounds.start)
      .lte('report_date', bounds.end)
      .limit(12000);

    if (qErr) {
      console.error('burn-detect:', qErr);
      setError(qErr.message || 'Không tải được báo cáo.');
      setRows([]);
    } else {
      setRows((data || []) as ReportRow[]);
    }
    setLoading(false);
  }, [bounds.start, bounds.end]);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    void loadTkqc(idDuAn);
  }, [idDuAn, loadTkqc]);

  useEffect(() => {
    void load();
  }, [load]);

  const maTkqcSet = useMemo(
    () => new Set(tkqcList.map((t) => t.ma_tkqc?.trim()).filter(Boolean) as string[]),
    [tkqcList]
  );

  const scopedRows = useMemo(() => {
    if (!idDuAn || maTkqcSet.size === 0) return rows;
    return rows.filter((r) => {
      const ma = r.ma_tkqc?.trim();
      return ma && maTkqcSet.has(ma);
    });
  }, [rows, idDuAn, maTkqcSet]);

  const byMarketer = useMemo(() => {
    const map = new Map<string, Agg>();
    for (const r of scopedRows) {
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
  }, [scopedRows]);

  const scored = useMemo(() => {
    return byMarketer.map((m) => {
      const adsPct = m.revenue > 0 ? (m.adCost / m.revenue) * 100 : m.adCost > 0 ? 100 : 0;
      const cplDenom = m.tongLead > 0 ? m.tongLead : m.tongData > 0 ? m.tongData : 0;
      const cpl = cplDenom > 0 ? m.adCost / cplDenom : null;
      const cpo = m.orders > 0 ? m.adCost / m.orders : null;
      const closePct = tyLeChot(m.tongData, m.orders, m.tongLead);
      const waste = wasteVnd(m.revenue, m.adCost);
      const burn = burnScoreValue(adsPct, m.revenue, closePct);
      const tier = tierForRow(adsPct, m.revenue, m.adCost);
      return { ...m, adsPct, cpl, cpo, closePct, waste, burn, tier };
    });
  }, [byMarketer]);

  const sorted = useMemo(() => {
    return [...scored].sort((a, b) => b.burn - a.burn || b.adsPct - a.adsPct);
  }, [scored]);

  const kpi = useMemo(() => {
    let crit = 0;
    let warn = 0;
    let ok = 0;
    for (const s of scored) {
      if (s.tier === 'crit') crit += 1;
      else if (s.tier === 'warn') warn += 1;
      else ok += 1;
    }
    return { crit, warn, ok };
  }, [scored]);

  const displayRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((s) => {
      if (statusFilter === 'crit' && s.tier !== 'crit') return false;
      if (statusFilter === 'normal' && s.tier === 'crit') return false;
      if (!q) return true;
      return (
        s.displayName.toLowerCase().includes(q) ||
        (s.team || '').toLowerCase().includes(q) ||
        (s.key || '').toLowerCase().includes(q)
      );
    });
  }, [sorted, search, statusFilter]);

  const setReviewHighRisk = () => {
    setStatusFilter('crit');
    setSearch('');
  };

  if (loading) {
    return (
      <div className="leader-dash-obsidian dash-fade-up flex items-center justify-center min-h-[220px] gap-3 text-[var(--ld-on-surface-variant)]">
        <Loader2 className="animate-spin text-[var(--ld-primary)]" size={24} />
        <span className="text-sm font-semibold">Đang tải {REPORTS_TABLE}…</span>
      </div>
    );
  }

  return (
    <div className="leader-dash-obsidian dash-fade-up text-[var(--ld-on-surface)] -m-[12px] p-6 sm:p-8 space-y-8 max-w-[1600px] mx-auto pb-24">
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

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--ld-on-surface)] mb-1" style={{ fontFamily: '"Inter", sans-serif' }}>
            Phát hiện đốt tiền
          </h2>
          <p className="text-[var(--ld-on-surface-variant)] leader-dash-label text-sm tracking-wide">
            Phân tích hiệu quả ngân sách &amp; cảnh báo rủi ro · {bounds.start} → {bounds.end}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)] leader-dash-label">Dự án</label>
            <select
              value={idDuAn}
              onChange={(e) => setIdDuAn(e.target.value)}
              className="bg-[var(--ld-surface-container-low)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] focus:ring-1 focus:ring-[var(--ld-primary)] py-2 px-4 min-w-[160px] outline-none"
            >
              <option value="">Tất cả dự án</option>
              {duAnList.map((d) => (
                <option key={d.id} value={d.id}>
                  {[d.ma_du_an, d.ten_du_an].filter(Boolean).join(' · ') || d.ten_du_an}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)] leader-dash-label">Tháng</label>
            <select
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              className="bg-[var(--ld-surface-container-low)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] focus:ring-1 focus:ring-[var(--ld-primary)] py-2 px-4 min-w-[180px] outline-none"
            >
              {monthOptions().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)] leader-dash-label">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'crit' | 'normal')}
              className="bg-[var(--ld-surface-container-low)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] focus:ring-1 focus:ring-[var(--ld-primary)] py-2 px-4 min-w-[150px] outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="crit">Cảnh báo cao</option>
              <option value="normal">Bình thường</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-xs">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)] leader-dash-label">Tìm MKT / team</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--ld-on-surface-variant)] pointer-events-none">
                <span className="material-symbols-outlined text-sm">search</span>
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[var(--ld-surface-container-highest)] border-none rounded-lg pl-10 pr-3 py-2 text-sm text-[var(--ld-on-surface)] focus:ring-2 focus:ring-[var(--ld-primary)] outline-none placeholder:text-[var(--ld-on-surface-variant)]/70"
                placeholder="Tìm kiếm…"
                type="search"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={setReviewHighRisk}
            className="bg-[var(--ld-primary)] text-[var(--ld-on-primary)] font-bold py-3 px-4 rounded-lg text-xs uppercase tracking-widest hover:opacity-90 transition-opacity leader-dash-label shrink-0"
          >
            Rà soát rủi ro cao
          </button>
        </div>
      </div>

      <p className="text-[10px] text-[var(--ld-on-surface-variant)]">
        Nguồn: <code className="text-[var(--ld-primary)]/90">{REPORTS_TABLE}</code>
        {idDuAn ? ' · lọc ma_tkqc theo dự án' : ''}. Waste = chi vượt {Math.round(WASTE_TARGET_FRAC * 100)}% DT (ước lượng).
      </p>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--ld-surface-container-low)] rounded-xl p-6 relative overflow-hidden hover:bg-[var(--ld-surface-container)] transition-colors duration-300 border border-[var(--ld-outline-variant)]/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--ld-error)] opacity-5 blur-[60px] rounded-full -mr-16 -mt-16 pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <span className="material-symbols-outlined text-[var(--ld-error)] text-3xl">warning</span>
            <span className="text-[10px] font-bold leader-dash-label bg-[var(--ld-error-container)] text-[var(--ld-error)] px-2 py-0.5 rounded uppercase tracking-tighter">
              High risk
            </span>
          </div>
          <h3 className="text-[var(--ld-on-surface-variant)] leader-dash-label text-xs font-bold uppercase tracking-widest mb-1">Đốt tiền nghiêm trọng</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-[var(--ld-error)]">{kpi.crit}</span>
            <span className="text-[var(--ld-on-surface-variant)] text-sm">tài khoản</span>
          </div>
          <p className="mt-4 text-[11px] text-[var(--ld-on-surface-variant)] leading-relaxed">
            Ads/DT &gt; {ADS_CRITICAL}% hoặc chi ads khi không có doanh thu (theo tháng đã chọn).
          </p>
        </div>

        <div className="bg-[var(--ld-surface-container-low)] rounded-xl p-6 relative overflow-hidden hover:bg-[var(--ld-surface-container)] transition-colors duration-300 border border-[var(--ld-outline-variant)]/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--ld-tertiary)] opacity-5 blur-[60px] rounded-full -mr-16 -mt-16 pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <span className="material-symbols-outlined text-[var(--ld-tertiary)] text-3xl">visibility</span>
            <span className="text-[10px] font-bold leader-dash-label bg-[color-mix(in_srgb,var(--ld-tertiary-container)_20%,transparent)] text-[var(--ld-tertiary)] px-2 py-0.5 rounded uppercase tracking-tighter">
              Monitoring
            </span>
          </div>
          <h3 className="text-[var(--ld-on-surface-variant)] leader-dash-label text-xs font-bold uppercase tracking-widest mb-1">Cần theo dõi</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-[var(--ld-tertiary)]">{kpi.warn}</span>
            <span className="text-[var(--ld-on-surface-variant)] text-sm">tài khoản</span>
          </div>
          <p className="mt-4 text-[11px] text-[var(--ld-on-surface-variant)] leading-relaxed">
            Ads/DT từ {ADS_WARN}% đến {ADS_CRITICAL}%. Hiệu quả có dấu hiệu giảm.
          </p>
        </div>

        <div className="bg-[var(--ld-surface-container-low)] rounded-xl p-6 relative overflow-hidden hover:bg-[var(--ld-surface-container)] transition-colors duration-300 border border-[var(--ld-outline-variant)]/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--ld-secondary)] opacity-5 blur-[60px] rounded-full -mr-16 -mt-16 pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <span className="material-symbols-outlined text-[var(--ld-secondary)] text-3xl">check_circle</span>
            <span className="text-[10px] font-bold leader-dash-label bg-[color-mix(in_srgb,var(--ld-secondary-container)_20%,transparent)] text-[var(--ld-secondary)] px-2 py-0.5 rounded uppercase tracking-tighter">
              Optimal
            </span>
          </div>
          <h3 className="text-[var(--ld-on-surface-variant)] leader-dash-label text-xs font-bold uppercase tracking-widest mb-1">Hiệu quả tốt</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-[var(--ld-secondary)]">{kpi.ok}</span>
            <span className="text-[var(--ld-on-surface-variant)] text-sm">tài khoản</span>
          </div>
          <p className="mt-4 text-[11px] text-[var(--ld-on-surface-variant)] leading-relaxed">
            Ads/DT &lt; {ADS_WARN}%. Ngân sách tối ưu theo doanh thu khai báo.
          </p>
        </div>
      </section>

      <section className="bg-[var(--ld-surface-container-low)] rounded-xl overflow-hidden shadow-2xl ld-ghost-border border border-[var(--ld-outline-variant)]/15">
        <div className="overflow-x-auto leader-dash-no-scrollbar">
          {displayRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-[var(--ld-on-surface-variant)]">
              Không có marketer phù hợp bộ lọc hoặc chưa có dữ liệu chi/DT trong tháng.
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-[var(--ld-surface-container-high)]">
                  <th className="px-6 py-4 leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-primary)]">Marketer</th>
                  <th className="px-4 py-4 leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-on-surface-variant)]">Ads chi</th>
                  <th className="px-4 py-4 leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-on-surface-variant)]">Revenue</th>
                  <th className="px-4 py-4 leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-on-surface-variant)] text-center">
                    Ads%
                  </th>
                  <th className="px-4 py-4 leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-on-surface-variant)]">
                    Mess / Lead
                  </th>
                  <th className="px-4 py-4 leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-on-surface-variant)]">
                    CPO / Close%
                  </th>
                  <th className="px-4 py-4 leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-on-surface-variant)] text-center">
                    Waste
                  </th>
                  <th className="px-4 py-4 leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-on-surface-variant)] text-center">
                    Burn score
                  </th>
                  <th className="px-6 py-4 leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-on-surface-variant)]">
                    Gợi ý hành động
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((s) => {
                  const barW = Math.min(100, s.revenue > 0 ? s.adsPct : s.adCost > 0 ? 100 : 0);
                  const tierColor =
                    s.tier === 'crit' ? 'var(--ld-error)' : s.tier === 'warn' ? 'var(--ld-tertiary)' : 'var(--ld-secondary)';
                  const borderRing =
                    s.tier === 'crit'
                      ? 'border-[var(--ld-error)]/30'
                      : s.tier === 'warn'
                        ? 'border-[var(--ld-tertiary)]/30'
                        : 'border-[var(--ld-secondary)]/30';
                  const btnCls =
                    s.tier === 'crit'
                      ? 'bg-[var(--ld-error-container)] text-[var(--ld-error)] hover:brightness-110'
                      : s.tier === 'warn'
                        ? 'bg-[color-mix(in_srgb,var(--ld-tertiary-container)_30%,transparent)] text-[var(--ld-tertiary)] hover:brightness-110'
                        : 'bg-[color-mix(in_srgb,var(--ld-secondary-container)_30%,transparent)] text-[var(--ld-secondary)] hover:brightness-110';
                  const adsTextCls =
                    s.tier === 'crit' ? 'text-[var(--ld-error)]' : s.tier === 'warn' ? 'text-[var(--ld-tertiary)]' : 'text-[var(--ld-secondary)]';
                  const barBg =
                    s.tier === 'crit' ? 'bg-[var(--ld-error)]' : s.tier === 'warn' ? 'bg-[var(--ld-tertiary)]' : 'bg-[var(--ld-secondary)]';
                  const closeCls =
                    s.tier === 'crit'
                      ? 'text-[var(--ld-error)]'
                      : s.tier === 'warn'
                        ? 'text-[var(--ld-tertiary)]'
                        : 'text-[var(--ld-secondary)]';
                  const avatarRing =
                    s.tier === 'crit'
                      ? 'bg-[color-mix(in_srgb,var(--ld-error)_20%,transparent)] text-[var(--ld-error)]'
                      : s.tier === 'warn'
                        ? 'bg-[color-mix(in_srgb,var(--ld-tertiary)_20%,transparent)] text-[var(--ld-tertiary)]'
                        : 'bg-[color-mix(in_srgb,var(--ld-secondary)_20%,transparent)] text-[var(--ld-secondary)]';
                  return (
                    <tr key={s.key} className="hover:bg-[var(--ld-surface-container-highest)] transition-colors group border-b border-[var(--ld-outline-variant)]/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarRing}`}>
                            {initials(s.displayName)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--ld-on-surface)]">{s.displayName}</p>
                            <p className="text-[10px] text-[var(--ld-on-surface-variant)] uppercase tracking-tighter">
                              {s.team || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-[var(--ld-on-surface)] tabular-nums">{formatVndDots(s.adCost)}</td>
                      <td className="px-4 py-4 text-sm font-medium text-[var(--ld-on-surface)] tabular-nums">{formatVndDots(s.revenue)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-sm font-bold tabular-nums ${adsTextCls}`}>
                            {s.revenue > 0 ? `${s.adsPct.toFixed(1)}%` : s.adCost > 0 ? '—' : '0%'}
                          </span>
                          <div className="w-16 h-1 bg-[var(--ld-surface-container-highest)] rounded-full overflow-hidden">
                            <div className={`h-full ${barBg} transition-all`} style={{ width: `${barW}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs">
                          <p className="text-[var(--ld-on-surface)]">M: {Math.round(s.mess).toLocaleString('vi-VN')}</p>
                          <p className="text-[var(--ld-on-surface-variant)]">L: {Math.round(s.tongLead).toLocaleString('vi-VN')}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs">
                          <p className="text-[var(--ld-on-surface)]">{s.cpo != null ? formatCompactK(s.cpo) : '—'}</p>
                          <p className={closeCls}>{s.closePct != null ? `${s.closePct.toFixed(1)}%` : '—'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-xs font-bold tabular-nums ${adsTextCls}`}>{formatCompactK(s.waste)}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 ${borderRing} mx-auto`}
                        >
                          <span className="text-xs font-bold tabular-nums" style={{ color: tierColor }}>
                            {s.burn}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`${btnCls} px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all inline-block`}>
                          {actionLabel(s.tier)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[var(--ld-surface-container-low)] p-5 rounded-xl border-l-4 border-[var(--ld-error)]">
          <h4 className="text-[10px] font-bold leader-dash-label uppercase tracking-widest text-[var(--ld-on-surface-variant)] mb-2">
            Đốt tiền nghiêm trọng
          </h4>
          <p className="text-xs text-[var(--ld-on-surface-variant)] leading-relaxed">
            Ads/Revenue &gt; {ADS_CRITICAL}%. Rà soát landing page và creative; kiểm tra chất lượng lead.
          </p>
        </div>
        <div className="bg-[var(--ld-surface-container-low)] p-5 rounded-xl border-l-4 border-[var(--ld-tertiary)]">
          <h4 className="text-[10px] font-bold leader-dash-label uppercase tracking-widest text-[var(--ld-on-surface-variant)] mb-2">
            Vùng cảnh báo
          </h4>
          <p className="text-xs text-[var(--ld-on-surface-variant)] leading-relaxed">
            {ADS_WARN}% &lt; Ads/Revenue ≤ {ADS_CRITICAL}%. Theo dõi tỷ lệ chốt và CPL/CPO.
          </p>
        </div>
        <div className="bg-[var(--ld-surface-container-low)] p-5 rounded-xl border-l-4 border-[var(--ld-secondary)]">
          <h4 className="text-[10px] font-bold leader-dash-label uppercase tracking-widest text-[var(--ld-on-surface-variant)] mb-2">
            Vùng an toàn
          </h4>
          <p className="text-xs text-[var(--ld-on-surface-variant)] leading-relaxed">
            Ads/Revenue &lt; {ADS_WARN}%. Có thể scale nếu lead ổn định.
          </p>
        </div>
        <div className="bg-[var(--ld-surface-container)] p-5 rounded-xl ld-ghost-border border border-[var(--ld-outline-variant)]/15 flex items-center gap-3">
          <div className="w-12 h-12 bg-[color-mix(in_srgb,var(--ld-primary)_10%,transparent)] rounded-lg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[var(--ld-primary)]">lightbulb</span>
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--ld-on-surface)]">Burn score</p>
            <p className="text-[10px] text-[var(--ld-on-surface-variant)] leading-snug">
              Ưu tiên Ads/DT; cộng thêm nếu Close% &lt; 18%. Waste = max(0, Chi − {Math.round(WASTE_TARGET_FRAC * 100)}%×DT).
            </p>
          </div>
        </div>
      </section>

      <button
        type="button"
        title="Làm mới dữ liệu"
        onClick={() => void load()}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[var(--ld-primary)] text-[var(--ld-on-primary-container)] rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform z-30 border border-[var(--ld-primary-container)]/40"
      >
        <span className="material-symbols-outlined text-2xl">refresh</span>
      </button>
    </div>
  );
};
