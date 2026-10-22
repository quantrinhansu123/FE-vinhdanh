import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Loader2, RefreshCw, TrendingUp, Zap } from 'lucide-react';
import { fetchHeatmap, type HeatmapApiResult } from '../../../api/crmSession';
import { ADS_LIMIT_PERCENT, ADS_WARNING_PERCENT, adsTone, performanceTextClass } from '../../../utils/performanceThresholds';
import { toLocalYyyyMmDd } from '../mkt/mktDetailReportShared';
import '../../../styles/stitchSystem.css';

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
  if (pct < ADS_WARNING_PERCENT) return 'G';
  if (pct <= ADS_LIMIT_PERCENT) return 'Y';
  return 'R';
}

type RowAgg = { ad: number; rev: number };

type EmpMeta = {
  name: string;
  avatar_url: string | null;
  vi_tri: string | null;
  ma_ns: string | null;
  teamId: string | null;
  teamName: string;
};

function buildLast7Ymd(anchor: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toLocalYyyyMmDd(addDays(anchor, -6 + i)));
}

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function ObsidianHeatCell({ pct, adCost }: { pct: number | null; adCost: number }) {
  if (pct == null) {
    return (
      <div
        className={`heatmap-cell w-full min-h-[56px] rounded-xl border flex items-center justify-center text-xs font-semibold ${adCost > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-[#f0f4f1] border-[#e2e8e5]/80 text-[#8b9b94]'}`}
        title={adCost > 0 ? 'Có chi phí Ads nhưng chưa có doanh thu VND' : 'Chưa có doanh thu'}
      >
        {adCost > 0 ? 'Chưa có DT' : '—'}
      </div>
    );
  }
  const t = heatType(pct);
  const cls =
    t === 'G'
      ? 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] font-bold'
      : t === 'Y'
        ? 'bg-[#fefce8] text-[#d97706] border border-[#fde68a] font-bold'
        : 'bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3] font-black';
  return (
    <div className={`heatmap-cell w-full min-h-[56px] rounded-xl flex items-center justify-center text-sm shadow-xs transition-transform hover:scale-[1.03] ${cls}`}>
      {pct.toFixed(1)}%
    </div>
  );
}

export const HeatmapView: React.FC = () => {
  const [dayKeys, setDayKeys] = useState<string[]>(() => buildLast7Ymd(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceWarning, setSourceWarning] = useState<string | null>(null);
  const [byKey, setByKey] = useState<Map<string, RowAgg>>(() => new Map());
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(() => new Map());
  const [empByEmail, setEmpByEmail] = useState<Map<string, EmpMeta>>(() => new Map());
  const [heatmapTeams, setHeatmapTeams] = useState<HeatmapApiResult['teams']>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [scope, setScope] = useState<HeatmapApiResult['scope']>('team');
  const [scopeWarning, setScopeWarning] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSourceWarning(null);
    const keys = buildLast7Ymd(new Date());
    setDayKeys(keys);
    const from = keys[0];
    const to = keys[keys.length - 1];
    try {
      const result = await fetchHeatmap(from, to);
      const next = new Map<string, RowAgg>();
      const names = new Map<string, string>();
      const employees = new Map<string, EmpMeta>();
      for (const row of result.rows) {
        const email = row.email.trim().toLowerCase();
        if (!email) continue;
        const key = `${email}\0${row.date}`;
        const current = next.get(key) || { ad: 0, rev: 0 };
        current.ad += Number(row.adCost) || 0;
        current.rev += Number(row.revenueVnd) || 0;
        next.set(key, current);
        if (row.name && !names.has(email)) names.set(email, row.name);
        employees.set(email, {
          name: row.name || email,
          avatar_url: row.avatarUrl,
          vi_tri: row.position,
          ma_ns: row.code,
          teamId: row.teamId,
          teamName: row.teamName,
        });
      }
      setByKey(next);
      setDisplayNames(names);
      setEmpByEmail(employees);
      setHeatmapTeams(result.teams);
      setScope(result.scope);
      setScopeWarning(result.scopeWarning);
      setSourceWarning(result.warnings.length ? result.warnings.join(' ') : null);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'Không tải được Heatmap.';
      setError(reason);
      setByKey(new Map());
      setDisplayNames(new Map());
      setEmpByEmail(new Map());
      setHeatmapTeams([]);
      setScopeWarning(null);
      setSourceWarning(null);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
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

  const selectedTeam = heatmapTeams.some((team) => team.id === selectedTeamId) ? selectedTeamId : 'all';
  const marketersInScope = useMemo(() => selectedTeam === 'all'
    ? marketers
    : marketers.filter((email) => empByEmail.get(email)?.teamId === selectedTeam),
  [marketers, empByEmail, selectedTeam]);

  const insights = useMemo(() => {
    const pcts: number[] = [];
    let danger = 0;
    for (const email of marketersInScope) {
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
  }, [byKey, marketersInScope, dayKeys]);

  const monthLabel = useMemo(() => monthBannerLabel(dayKeys), [dayKeys]);

  const exportCsv = () => {
    const sep = ';';
    const h = ['Marketing', 'Team', 'Email', 'TB 7 ngày %', ...dayKeys.map(formatColHeader)];
    const lines = [h.join(sep)];
    for (const email of marketersInScope) {
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
      const team = empByEmail.get(email)?.teamName || '';
      const row: string[] = [label.replaceAll(sep, ','), team.replaceAll(sep, ','), email];
      row.push(avgPct != null ? avgPct.toFixed(2) : wAd > 0 ? 'Chưa có DT' : '');
      for (const ymd of dayKeys) {
        const a = byKey.get(`${email}\0${ymd}`);
        const pct = a ? adsDtPct(a.ad, a.rev) : null;
        row.push(pct != null ? pct.toFixed(2) : (a?.ad || 0) > 0 ? 'Chưa có DT' : '');
      }
      lines.push(row.join(sep));
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heatmap-ads-dt-${selectedTeam === 'all' ? 'all-teams' : selectedTeam}-${dayKeys[0]}-${dayKeys[6]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const rows = marketersInScope.map((email) => {
      let wAd = 0;
      let wRev = 0;
      const days: Record<string, number | null> = {};
      const dayStatuses: Record<string, 'ok' | 'no_revenue' | 'no_report'> = {};
      for (const ymd of dayKeys) {
        const agg = byKey.get(`${email}\0${ymd}`);
        const pct = agg ? adsDtPct(agg.ad, agg.rev) : null;
        days[ymd] = pct;
        dayStatuses[ymd] = !agg ? 'no_report' : agg.rev <= 0 ? 'no_revenue' : 'ok';
        if (agg) {
          wAd += agg.ad;
          wRev += agg.rev;
        }
      }
      return {
        email,
        name: displayNames.get(email) || empByEmail.get(email)?.name || email,
        team: empByEmail.get(email)?.teamName || null,
        tb7: adsDtPct(wAd, wRev),
        status: wRev <= 0 ? 'no_revenue' : 'ok',
        days,
        dayStatuses,
      };
    });
    const blob = new Blob([JSON.stringify({ range: { from: dayKeys[0], to: dayKeys[6] }, rows }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heatmap-ads-dt-${selectedTeam === 'all' ? 'all-teams' : selectedTeam}-${dayKeys[0]}-${dayKeys[6]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="leader-dash-obsidian heatmap-obsidian dash-fade-up text-[#191c1b] pb-10">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div>
          <h1 className="font-sans font-extrabold text-2xl sm:text-3xl tracking-tight text-[#191c1b] mb-2">
            Heatmap Ads/DT
          </h1>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 bg-[#ecfdf5] px-3 py-1 rounded-full border border-[#a7f3d0]">
              <div className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#059669]">
                LIVE
              </span>
            </div>
            <span className="font-sans text-xs text-[#476355] font-medium tracking-wide">
              Ads + doanh thu VND theo ngày · detail_reports/Odoo
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white p-1 rounded-xl flex items-center gap-1 border border-[#e2e8e5] shadow-xs">
            <span className="px-3.5 py-1.5 bg-[#f0f4f1] text-[#006e51] font-sans text-xs font-bold rounded-lg shadow-xs whitespace-nowrap">
              {monthLabel || '—'}
            </span>
            <span
              className="px-2.5 py-1.5 text-[#476355]"
              title="Khung 7 ngày gần nhất (theo máy)"
            >
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-[#e2e8e5] shadow-xs text-[#476355] hover:text-[#006e51] transition-all active:scale-95 disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 text-xs font-semibold text-[#e11d48] border border-[#fecdd3] rounded-xl px-4 py-3 bg-[#fff1f2]">
          {error}
        </div>
      )}
      {sourceWarning ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {sourceWarning}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e8e5] bg-white px-4 py-3">
        <div className="text-xs font-semibold text-[#476355]">
          Phạm vi dữ liệu: <span className="text-[#006e51]">{scope === 'all' ? 'Toàn hệ thống' : scope === 'project' ? 'Các team thuộc dự án được giao' : 'Team được giao'}</span>
          {scopeWarning ? <span className="ml-2 text-amber-700">· {scopeWarning}</span> : null}
        </div>
        {heatmapTeams.length > 1 ? (
          <label className="flex items-center gap-2 text-xs font-semibold text-[#476355]">
            Team
            <select
              value={selectedTeam}
              onChange={(event) => setSelectedTeamId(event.target.value)}
              className="rounded-lg border border-[#e2e8e5] bg-white px-3 py-2 text-sm text-[#191c1b]"
            >
              <option value="all">Tất cả team trong phạm vi</option>
              {heatmapTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
        ) : heatmapTeams.length === 1 ? (
          <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-bold text-[#006e51]">{heatmapTeams[0].name}</span>
        ) : null}
      </div>

      <section className="bg-white rounded-2xl overflow-hidden shadow-xs border border-[#e2e8e5] relative">
        <div className="overflow-x-auto leader-dash-no-scrollbar">
          {loading && marketersInScope.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-20 text-[#476355] text-sm font-medium">
              <Loader2 className="animate-spin w-5 h-5 text-[#006e51]" />
              Đang tải Heatmap…
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#f8faf9]">
                  <th className="p-4 font-sans text-[11px] uppercase tracking-wider text-[#476355] font-bold sticky left-0 z-40 bg-[#f8faf9] backdrop-blur-md min-w-[240px] border-b border-[#e2e8e5] border-r border-[#e2e8e5]">
                    Marketing Lead
                  </th>
                  <th className="p-3 font-sans text-[11px] uppercase tracking-wider text-[#476355] font-bold text-center min-w-[96px] border-b border-[#e2e8e5]">
                    TB 7 ngày
                  </th>
                  {dayKeys.map((ymd) => (
                    <th
                      key={ymd}
                      className="p-3 font-sans text-[11px] uppercase tracking-wider text-[#476355] font-bold text-center whitespace-nowrap min-w-[80px] border-b border-[#e2e8e5]"
                    >
                      {formatColHeader(ymd)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8e5]">
                {marketersInScope.length === 0 ? (
                  <tr>
                    <td
                      colSpan={dayKeys.length + 2}
                      className="p-12 text-center text-[#476355] text-sm font-medium"
                    >
                      Chưa có dòng báo cáo trong 7 ngày (hoặc thiếu email trên bản ghi).
                    </td>
                  </tr>
                ) : (
                  marketersInScope.map((email) => {
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
                      <tr key={email} className="hover:bg-[#f8faf9]/80 transition-colors group">
                        <td className="p-4 sticky left-0 z-30 bg-white group-hover:bg-[#f8faf9] transition-colors border-r border-[#e2e8e5]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#e8f5ee] shrink-0 flex items-center justify-center text-xs font-black text-[#006e51] border border-[#c1e2d2]">
                              {emp?.avatar_url ? (
                                <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                initialsFromName(label)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-sans font-bold text-sm text-[#191c1b] truncate" title={label}>
                                {label}
                              </p>
                              <p className="font-sans text-xs text-[#476355] truncate" title={`${emp?.teamName || 'Chưa gán team'} · ${role}`}>
                                {emp?.teamName || 'Chưa gán team'} · {role}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 align-middle">
                          <div className={`w-full min-h-[56px] rounded-xl bg-[#f0f4f1] border border-[#e2e8e5]/80 flex items-center justify-center font-mono font-bold text-sm ${performanceTextClass(adsTone(avgPct))}`}>
                            {avgPct != null ? `${avgPct.toFixed(1)}%` : '—'}
                          </div>
                        </td>
                        {dayKeys.map((ymd) => {
                          const a = byKey.get(`${email}\0${ymd}`);
                          const pct = a ? adsDtPct(a.ad, a.rev) : null;
                          return (
                            <td key={ymd} className="p-2 align-middle">
                              <ObsidianHeatCell pct={pct} adCost={a?.ad || 0} />
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

        <footer className="p-4 sm:p-5 bg-[#f8faf9] border-t border-[#e2e8e5] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-6 sm:gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-[#ecfdf5] border border-[#a7f3d0]" />
              <span className="font-sans text-xs font-semibold text-[#191c1b]">
                OK (&lt; {ADS_WARNING_PERCENT}%)
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-[#fefce8] border border-[#fde68a]" />
              <span className="font-sans text-xs font-semibold text-[#191c1b]">
                WARNING ({ADS_WARNING_PERCENT}–{ADS_LIMIT_PERCENT}%)
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-[#fff1f2] border border-[#fecdd3]" />
              <span className="font-sans text-xs font-semibold text-[#191c1b]">
                DANGER (&gt; {ADS_LIMIT_PERCENT}%)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#476355]">
            <span className="uppercase text-[10px] tracking-wider text-[#8b9b94]">Xuất file:</span>
            <button type="button" onClick={exportCsv} className="px-3 py-1.5 bg-white border border-[#e2e8e5] rounded-lg shadow-2xs hover:text-[#006e51] hover:border-[#006e51] transition-all disabled:opacity-40" disabled={!marketersInScope.length}>
              CSV
            </button>
            <button type="button" onClick={exportJson} className="px-3 py-1.5 bg-white border border-[#e2e8e5] rounded-lg shadow-2xs hover:text-[#006e51] hover:border-[#006e51] transition-all disabled:opacity-40" disabled={!marketersInScope.length}>
              JSON
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-white border border-[#e2e8e5] rounded-lg shadow-2xs hover:text-[#006e51] hover:border-[#006e51] transition-all disabled:opacity-40"
              disabled={!marketersInScope.length}
              title="Dùng hộp thoại in của trình duyệt"
            >
              PDF
            </button>
          </div>
        </footer>
      </section>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-xs border-l-4 border-l-[#006e51] border border-[#e2e8e5]">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-[#ecfdf5] p-2.5 rounded-xl border border-[#a7f3d0]">
              <TrendingUp className="w-5 h-5 text-[#006e51]" />
            </div>
            <span className="font-mono text-xs font-bold text-[#059669] bg-[#ecfdf5] border border-[#a7f3d0] px-2.5 py-0.5 rounded-full">
              {insights.vs30 != null ? `${insights.vs30 >= 0 ? '+' : ''}${insights.vs30.toFixed(1)} vs 30%` : '—'}
            </span>
          </div>
          <h3 className="font-sans font-bold text-base text-[#191c1b] mb-1">Trung bình Ads/DT</h3>
          <p className="font-sans text-xs text-[#476355] mb-4 leading-relaxed">
            Trung bình các ô có doanh thu &gt; 0 trong khung 7 ngày ({insights.cellCount} ô).
          </p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#191c1b]">{insights.avg != null ? `${insights.avg.toFixed(1)}%` : '—'}</span>
            <span className="font-sans text-xs text-[#476355] mb-1">Trong phạm vi</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xs border-l-4 border-l-[#e11d48] border border-[#e2e8e5]">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-[#fff1f2] p-2.5 rounded-xl border border-[#fecdd3]">
              <AlertTriangle className="w-5 h-5 text-[#e11d48]" />
            </div>
            <span className="font-mono text-xs font-bold text-[#e11d48] bg-[#fff1f2] border border-[#fecdd3] px-2.5 py-0.5 rounded-full">
              Cảnh báo cao
            </span>
          </div>
          <h3 className="font-sans font-bold text-base text-[#191c1b] mb-1">Ô nguy cơ cao</h3>
          <p className="font-sans text-xs text-[#476355] mb-4 leading-relaxed">
            Số ô có Ads/DT &gt; {ADS_LIMIT_PERCENT}% (ngưỡng cần tối ưu ngân sách ngay).
          </p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#e11d48]">{String(insights.danger).padStart(2, '0')}</span>
            <span className="font-sans text-xs text-[#476355] mb-1">Critical</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xs border-l-4 border-l-[#059669] border border-[#e2e8e5]">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-[#ecfdf5] p-2.5 rounded-xl border border-[#a7f3d0]">
              <Zap className="w-5 h-5 text-[#059669]" />
            </div>
            <span className="font-mono text-xs font-bold text-[#059669] bg-[#ecfdf5] border border-[#a7f3d0] px-2.5 py-0.5 rounded-full">
              Trực tiếp
            </span>
          </div>
          <h3 className="font-sans font-bold text-base text-[#191c1b] mb-1">Cập nhật dữ liệu</h3>
          <p className="font-sans text-xs text-[#476355] mb-4 leading-relaxed">
            Lần tải gần nhất từ cơ sở dữ liệu Supabase (báo cáo MKT).
          </p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-extrabold font-mono text-[#191c1b]">
              {lastRefresh
                ? lastRefresh.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '—'}
            </span>
            <span className="font-sans text-xs text-[#476355] mb-1">Hôm nay</span>
          </div>
        </div>
      </section>
    </div>
  );
};
