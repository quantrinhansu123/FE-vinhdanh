import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import { REPORTS_TABLE, toLocalYyyyMmDd } from '../mkt/mktDetailReportShared';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function formatColHeader(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  return `${day} ${mon}`;
}

function monthBannerLabel(keys: string[]): string {
  if (!keys.length) return '';
  const d = new Date(`${keys[0].slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }).toUpperCase();
}

function adsDtPct(ad: number, rev: number): number | null {
  if (!Number.isFinite(ad) || !Number.isFinite(rev) || rev <= 0) return null;
  return (ad / rev) * 100;
}

function heatType(pct: number): 'G' | 'Y' | 'R' {
  if (pct < 30) return 'G';
  if (pct <= 45) return 'Y';
  return 'R';
}

type RowAgg = { ad: number; rev: number };

type EmpMeta = { name: string; avatar_url: string | null; vi_tri: string | null };

function buildLast7Ymd(anchor: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toLocalYyyyMmDd(addDays(anchor, -6 + i)));
}

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function ObsidianHeatCell({ pct }: { pct: number | null }) {
  if (pct == null) {
    return (
      <div className="heatmap-cell w-full min-h-[56px] rounded-lg bg-[var(--ld-surface-container-highest)] flex items-center justify-center text-sm font-bold text-[var(--ld-on-surface-variant)]">
        —
      </div>
    );
  }
  const t = heatType(pct);
  const cls =
    t === 'G'
      ? 'bg-[var(--ld-secondary-container)] text-[var(--ld-secondary)]'
      : t === 'Y'
        ? 'bg-[var(--ld-tertiary-container)] text-[#2a1700]'
        : 'bg-[var(--ld-error-container)] text-[#ffa8a3]';
  return (
    <div className={`heatmap-cell w-full min-h-[56px] rounded-lg flex items-center justify-center font-bold text-sm ${cls}`}>
      {pct.toFixed(1)}%
    </div>
  );
}

export const HeatmapView: React.FC = () => {
  const [dayKeys, setDayKeys] = useState<string[]>(() => buildLast7Ymd(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [byKey, setByKey] = useState<Map<string, RowAgg>>(() => new Map());
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(() => new Map());
  const [empByEmail, setEmpByEmail] = useState<Map<string, EmpMeta>>(() => new Map());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const keys = buildLast7Ymd(new Date());
    setDayKeys(keys);
    const from = keys[0];
    const to = keys[keys.length - 1];
    const { data, error: qErr } = await supabase
      .from(REPORTS_TABLE)
      .select('email, name, report_date, ad_cost, revenue')
      .gte('report_date', from)
      .lte('report_date', to)
      .limit(8000);

    if (qErr) {
      console.error('heatmap detail_reports:', qErr);
      setError(qErr.message || 'Không tải được detail_reports.');
      setByKey(new Map());
      setDisplayNames(new Map());
      setEmpByEmail(new Map());
      setLoading(false);
      setLastRefresh(new Date());
      return;
    }

    const next = new Map<string, RowAgg>();
    const names = new Map<string, string>();
    const emailSet = new Set<string>();
    for (const r of data || []) {
      const email = String(r.email || '')
        .trim()
        .toLowerCase();
      if (!email) continue;
      emailSet.add(email);
      const d = String(r.report_date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const k = `${email}\0${d}`;
      const ad = Number(r.ad_cost) || 0;
      const rev = Number(r.revenue) || 0;
      const prev = next.get(k) || { ad: 0, rev: 0 };
      prev.ad += ad;
      prev.rev += rev;
      next.set(k, prev);
      const nm = String(r.name || '').trim();
      if (nm && !names.has(email)) names.set(email, nm);
    }

    let empMap = new Map<string, EmpMeta>();
    if (emailSet.size > 0) {
      const empRes = await supabase.from(EMPLOYEES_TABLE).select('email, name, avatar_url, vi_tri').not('email', 'is', null).limit(600);
      if (!empRes.error && empRes.data) {
        for (const row of empRes.data as { email?: string; name?: string; avatar_url?: string | null; vi_tri?: string | null }[]) {
          const em = String(row.email || '')
            .trim()
            .toLowerCase();
          if (!em || !emailSet.has(em)) continue;
          empMap.set(em, {
            name: String(row.name || '').trim() || em,
            avatar_url: row.avatar_url ?? null,
            vi_tri: row.vi_tri ?? null,
          });
        }
      }
    }

    setByKey(next);
    setDisplayNames(names);
    setEmpByEmail(empMap);
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const marketers = useMemo(() => {
    const emails = new Set<string>();
    for (const key of byKey.keys()) {
      emails.add(key.split('\0')[0]);
    }
    return [...emails].sort((a, b) => {
      const na = displayNames.get(a) || empByEmail.get(a)?.name || a;
      const nb = displayNames.get(b) || empByEmail.get(b)?.name || b;
      return na.localeCompare(nb, 'vi');
    });
  }, [byKey, displayNames, empByEmail]);

  const insights = useMemo(() => {
    const pcts: number[] = [];
    let danger = 0;
    for (const email of marketers) {
      for (const ymd of dayKeys) {
        const a = byKey.get(`${email}\0${ymd}`);
        const pct = a ? adsDtPct(a.ad, a.rev) : null;
        if (pct != null) {
          pcts.push(pct);
          if (heatType(pct) === 'R') danger += 1;
        }
      }
    }
    const avg = pcts.length ? pcts.reduce((s, x) => s + x, 0) / pcts.length : null;
    const vs30 = avg != null ? avg - 30 : null;
    return { avg, danger, cellCount: pcts.length, vs30 };
  }, [byKey, marketers, dayKeys]);

  const monthLabel = useMemo(() => monthBannerLabel(dayKeys), [dayKeys]);

  const exportCsv = () => {
    const sep = ';';
    const h = ['Marketing', 'Email', 'TB 7 ngày %', ...dayKeys.map(formatColHeader)];
    const lines = [h.join(sep)];
    for (const email of marketers) {
      let wAd = 0;
      let wRev = 0;
      for (const ymd of dayKeys) {
        const a = byKey.get(`${email}\0${ymd}`);
        if (a) {
          wAd += a.ad;
          wRev += a.rev;
        }
      }
      const avgPct = adsDtPct(wAd, wRev);
      const label = displayNames.get(email) || empByEmail.get(email)?.name || email;
      const row: string[] = [label.replaceAll(sep, ','), email];
      row.push(avgPct != null ? avgPct.toFixed(2) : '');
      for (const ymd of dayKeys) {
        const a = byKey.get(`${email}\0${ymd}`);
        const pct = a ? adsDtPct(a.ad, a.rev) : null;
        row.push(pct != null ? pct.toFixed(2) : '');
      }
      lines.push(row.join(sep));
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heatmap-ads-dt-${dayKeys[0]}-${dayKeys[6]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const rows = marketers.map((email) => {
      let wAd = 0;
      let wRev = 0;
      const days: Record<string, number | null> = {};
      for (const ymd of dayKeys) {
        const agg = byKey.get(`${email}\0${ymd}`);
        const pct = agg ? adsDtPct(agg.ad, agg.rev) : null;
        days[ymd] = pct;
        if (agg) {
          wAd += agg.ad;
          wRev += agg.rev;
        }
      }
      return {
        email,
        name: displayNames.get(email) || empByEmail.get(email)?.name || email,
        tb7: adsDtPct(wAd, wRev),
        days,
      };
    });
    const blob = new Blob([JSON.stringify({ range: { from: dayKeys[0], to: dayKeys[6] }, rows }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heatmap-ads-dt-${dayKeys[0]}-${dayKeys[6]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="leader-dash-obsidian heatmap-obsidian dash-fade-up text-[var(--ld-on-surface)] pb-10">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div>
          <h1 className="font-[family-name:Inter,sans-serif] font-extrabold text-2xl sm:text-3xl tracking-tight text-[var(--ld-on-surface)] mb-2">
            Heatmap Ads/DT
          </h1>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 bg-[var(--ld-secondary)]/10 px-3 py-1 rounded-full border border-[var(--ld-secondary)]/25">
              <div className="w-2 h-2 rounded-full bg-[var(--ld-secondary)] animate-pulse" />
              <span className="font-[family-name:Manrope,sans-serif] text-[10px] font-bold uppercase tracking-widest text-[var(--ld-secondary)]">
                LIVE
              </span>
            </div>
            <span className="font-[family-name:Manrope,sans-serif] text-[11px] text-[var(--ld-on-surface-variant)] uppercase tracking-widest">
              {REPORTS_TABLE} · Ads/Doanh thu theo ngày
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[var(--ld-surface-container-high)] p-1 rounded-lg flex items-center gap-1 border border-[var(--ld-outline-variant)]/40">
            <span className="px-4 py-2 bg-[var(--ld-surface-container-highest)] text-[var(--ld-primary)] font-[family-name:Manrope,sans-serif] text-[11px] font-bold rounded-md shadow-sm whitespace-nowrap">
              {monthLabel || '—'}
            </span>
            <span
              className="px-3 py-2 text-[var(--ld-on-surface-variant)]"
              title="Khung 7 ngày gần nhất (theo máy)"
            >
              <span className="material-symbols-outlined text-[22px]">calendar_today</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="w-10 h-10 flex items-center justify-center bg-[var(--ld-surface-container-high)] rounded-lg border border-[var(--ld-outline-variant)]/40 text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-primary)] transition-all active:scale-95 disabled:opacity-50"
            title="Làm mới"
          >
            {loading ? <Loader2 className="w-[22px] h-[22px] animate-spin" /> : <span className="material-symbols-outlined text-[22px]">refresh</span>}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 text-[11px] font-bold text-[#ffa8a3] border border-[#9f0519]/40 rounded-lg px-3 py-2 bg-[#9f0519]/15">
          {error}
        </div>
      )}

      <section className="bg-[var(--ld-surface-container-low)] rounded-xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.45)] border border-[var(--ld-outline-variant)]/35 relative">
        <div className="overflow-x-auto leader-dash-no-scrollbar">
          {loading && marketers.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-20 text-[var(--ld-on-surface-variant)] text-[13px] font-[family-name:Manrope,sans-serif]">
              <Loader2 className="animate-spin w-5 h-5" />
              Đang tải {REPORTS_TABLE}…
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[var(--ld-surface-container-high)]/55">
                  <th className="p-5 font-[family-name:Manrope,sans-serif] text-[10px] uppercase tracking-[0.2em] text-[var(--ld-on-surface-variant)] font-bold sticky left-0 z-40 bg-[var(--ld-surface-container-high)]/95 backdrop-blur-md min-w-[240px] border-b border-[var(--ld-outline-variant)]/25">
                    Marketing Lead
                  </th>
                  <th className="p-3 font-[family-name:Manrope,sans-serif] text-[10px] uppercase tracking-[0.2em] text-[var(--ld-on-surface-variant)] font-bold text-center min-w-[88px] border-b border-[var(--ld-outline-variant)]/25">
                    TB 7 ngày
                  </th>
                  {dayKeys.map((ymd) => (
                    <th
                      key={ymd}
                      className="p-3 font-[family-name:Manrope,sans-serif] text-[10px] uppercase tracking-[0.2em] text-[var(--ld-on-surface-variant)] font-bold text-center whitespace-nowrap min-w-[72px] border-b border-[var(--ld-outline-variant)]/25"
                    >
                      {formatColHeader(ymd)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ld-outline-variant)]/12">
                {marketers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={dayKeys.length + 2}
                      className="p-12 text-center text-[var(--ld-on-surface-variant)] text-[13px] font-[family-name:Manrope,sans-serif]"
                    >
                      Chưa có dòng báo cáo trong 7 ngày (hoặc thiếu email trên bản ghi).
                    </td>
                  </tr>
                ) : (
                  marketers.map((email) => {
                    const emp = empByEmail.get(email);
                    const label = displayNames.get(email) || emp?.name || email;
                    const role = emp?.vi_tri?.trim() || 'Marketing';
                    let wAd = 0;
                    let wRev = 0;
                    for (const ymd of dayKeys) {
                      const a = byKey.get(`${email}\0${ymd}`);
                      if (a) {
                        wAd += a.ad;
                        wRev += a.rev;
                      }
                    }
                    const avgPct = adsDtPct(wAd, wRev);
                    return (
                      <tr key={email} className="hover:bg-[var(--ld-surface-container-high)]/35 transition-colors group">
                        <td className="p-5 sticky left-0 z-30 bg-[var(--ld-surface-container-low)] group-hover:bg-[var(--ld-surface-container-high)]/50 transition-colors border-r border-[var(--ld-outline-variant)]/15">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--ld-surface-container)] shrink-0 flex items-center justify-center text-[11px] font-extrabold text-[var(--ld-primary)]">
                              {emp?.avatar_url ? (
                                <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                initialsFromName(label)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-[family-name:Inter,sans-serif] font-bold text-sm text-[var(--ld-on-surface)] truncate" title={label}>
                                {label}
                              </p>
                              <p className="font-[family-name:Manrope,sans-serif] text-[10px] text-[var(--ld-on-surface-variant)] uppercase tracking-wider truncate">
                                {role}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 align-middle">
                          <div className="w-full min-h-[56px] rounded-lg bg-[var(--ld-surface-container-highest)] flex items-center justify-center font-[family-name:Inter,sans-serif] font-extrabold text-sm text-[var(--ld-primary)]">
                            {avgPct != null ? `${avgPct.toFixed(1)}%` : '—'}
                          </div>
                        </td>
                        {dayKeys.map((ymd) => {
                          const a = byKey.get(`${email}\0${ymd}`);
                          const pct = a ? adsDtPct(a.ad, a.rev) : null;
                          return (
                            <td key={ymd} className="p-2 align-middle">
                              <ObsidianHeatCell pct={pct} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <footer className="p-5 sm:p-6 bg-[var(--ld-surface-container-high)]/25 border-t border-[var(--ld-outline-variant)]/15 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-6 sm:gap-8">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-sm bg-[var(--ld-secondary-container)]" />
              <span className="font-[family-name:Manrope,sans-serif] text-xs font-bold text-[var(--ld-on-surface-variant)]">
                OK (&lt; 30%)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-sm bg-[var(--ld-tertiary-container)]" />
              <span className="font-[family-name:Manrope,sans-serif] text-xs font-bold text-[var(--ld-on-surface-variant)]">
                WARNING (30–45%)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-sm bg-[var(--ld-error-container)]" />
              <span className="font-[family-name:Manrope,sans-serif] text-xs font-bold text-[var(--ld-on-surface-variant)]">
                DANGER (&gt; 45%)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[var(--ld-on-surface-variant)] font-[family-name:Manrope,sans-serif] text-[10px] uppercase tracking-widest font-bold">
            <span>Export:</span>
            <button type="button" onClick={exportCsv} className="hover:text-[var(--ld-primary)] transition-colors disabled:opacity-40" disabled={!marketers.length}>
              CSV
            </button>
            <button type="button" onClick={exportJson} className="hover:text-[var(--ld-primary)] transition-colors disabled:opacity-40" disabled={!marketers.length}>
              JSON
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="hover:text-[var(--ld-primary)] transition-colors disabled:opacity-40"
              disabled={!marketers.length}
              title="Dùng hộp thoại in của trình duyệt"
            >
              PDF
            </button>
          </div>
        </footer>
      </section>

      <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--ld-surface-container)] rounded-xl p-6 shadow-xl border-l-4 border-[var(--ld-primary)] border border-[var(--ld-outline-variant)]/25">
          <div className="flex justify-between items-start mb-4">
            <span className="material-symbols-outlined text-[var(--ld-primary)] bg-[var(--ld-primary)]/12 p-2 rounded-lg">trending_up</span>
            <span className="font-[family-name:Manrope,sans-serif] text-[10px] font-bold text-[var(--ld-secondary)] uppercase tracking-tight bg-[var(--ld-secondary)]/12 px-2 py-0.5 rounded">
              {insights.vs30 != null ? `${insights.vs30 >= 0 ? '+' : ''}${insights.vs30.toFixed(1)} vs 30%` : '—'}
            </span>
          </div>
          <h3 className="font-[family-name:Inter,sans-serif] font-bold text-lg text-[var(--ld-on-surface)] mb-1">Trung bình Ads/DT</h3>
          <p className="font-[family-name:Manrope,sans-serif] text-xs text-[var(--ld-on-surface-variant)] mb-4 leading-relaxed">
            Trung bình các ô có doanh thu &gt; 0 trong khung 7 ngày ({insights.cellCount} ô).
          </p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold text-[var(--ld-on-surface)]">{insights.avg != null ? `${insights.avg.toFixed(1)}%` : '—'}</span>
            <span className="font-[family-name:Manrope,sans-serif] text-xs text-[var(--ld-on-surface-variant)] mb-1">Overall</span>
          </div>
        </div>

        <div className="bg-[var(--ld-surface-container)] rounded-xl p-6 shadow-xl border-l-4 border-[var(--ld-tertiary)] border border-[var(--ld-outline-variant)]/25">
          <div className="flex justify-between items-start mb-4">
            <span className="material-symbols-outlined text-[var(--ld-tertiary)] bg-[var(--ld-tertiary)]/12 p-2 rounded-lg">warning</span>
            <span className="font-[family-name:Manrope,sans-serif] text-[10px] font-bold text-[var(--ld-error)] uppercase tracking-tight bg-[var(--ld-error)]/12 px-2 py-0.5 rounded">
              High risk
            </span>
          </div>
          <h3 className="font-[family-name:Inter,sans-serif] font-bold text-lg text-[var(--ld-on-surface)] mb-1">Ô nguy cơ cao</h3>
          <p className="font-[family-name:Manrope,sans-serif] text-xs text-[var(--ld-on-surface-variant)] mb-4 leading-relaxed">
            Số ô có Ads/DT &gt; 45% (cùng ngưỡng màu đỏ trên heatmap).
          </p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold text-[var(--ld-on-surface)]">{String(insights.danger).padStart(2, '0')}</span>
            <span className="font-[family-name:Manrope,sans-serif] text-xs text-[var(--ld-on-surface-variant)] mb-1">Critical</span>
          </div>
        </div>

        <div className="bg-[var(--ld-surface-container)] rounded-xl p-6 shadow-xl border-l-4 border-[var(--ld-secondary)] border border-[var(--ld-outline-variant)]/25">
          <div className="flex justify-between items-start mb-4">
            <span className="material-symbols-outlined text-[var(--ld-secondary)] bg-[var(--ld-secondary)]/12 p-2 rounded-lg">bolt</span>
            <span className="font-[family-name:Manrope,sans-serif] text-[10px] font-bold text-[var(--ld-secondary)] uppercase tracking-tight bg-[var(--ld-secondary)]/12 px-2 py-0.5 rounded">
              Optimal
            </span>
          </div>
          <h3 className="font-[family-name:Inter,sans-serif] font-bold text-lg text-[var(--ld-on-surface)] mb-1">Cập nhật dữ liệu</h3>
          <p className="font-[family-name:Manrope,sans-serif] text-xs text-[var(--ld-on-surface-variant)] mb-4 leading-relaxed">
            Lần tải gần nhất từ Supabase (báo cáo MKT).
          </p>
          <div className="flex items-end gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-[var(--ld-on-surface)] tabular-nums">
              {lastRefresh
                ? lastRefresh.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '—'}
            </span>
            <span className="font-[family-name:Manrope,sans-serif] text-xs text-[var(--ld-on-surface-variant)] mb-1">Giờ</span>
          </div>
        </div>
      </section>
    </div>
  );
};
