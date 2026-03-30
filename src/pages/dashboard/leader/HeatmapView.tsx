import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard, HeatCell } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import { REPORTS_TABLE, toLocalYyyyMmDd } from '../mkt/mktDetailReportShared';

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function formatShortDm(isoYmd: string): string {
  const s = isoYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [, m, day] = s.split('-');
  return `${Number(day)}/${Number(m)}`;
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

function buildLast7Ymd(anchor: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toLocalYyyyMmDd(addDays(anchor, -6 + i)));
}

export const HeatmapView: React.FC = () => {
  const [dayKeys, setDayKeys] = useState<string[]>(() => buildLast7Ymd(new Date()));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** key: emailLower + \0 + ymd */
  const [byKey, setByKey] = useState<Map<string, RowAgg>>(() => new Map());
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(() => new Map());

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
      setLoading(false);
      return;
    }

    const next = new Map<string, RowAgg>();
    const names = new Map<string, string>();
    for (const r of data || []) {
      const email = String(r.email || '')
        .trim()
        .toLowerCase();
      if (!email) continue;
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
    setByKey(next);
    setDisplayNames(names);
    setLoading(false);
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
      const na = displayNames.get(a) || a;
      const nb = displayNames.get(b) || b;
      return na.localeCompare(nb, 'vi');
    });
  }, [byKey, displayNames]);

  const subtitle = useMemo(() => {
    const f = formatShortDm(dayKeys[0]);
    const t = formatShortDm(dayKeys[6]);
    return `Xanh < 30% · Vàng 30–45% · Đỏ > 45% · ${REPORTS_TABLE} · ${f} → ${t}`;
  }, [dayKeys]);

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="🌡️ Heatmap Ads/DT — 7 ngày × Marketing"
        subtitle={subtitle}
        bodyPadding={false}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold border border-[rgba(255,255,255,0.08)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        }
      >
        <div className="p-[14px_16px] overflow-x-auto">
          {error && (
            <div className="mb-3 text-[11px] font-bold text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[8px] px-3 py-2 bg-[var(--Rd)]/20">
              {error}
            </div>
          )}
          {loading && marketers.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[var(--text3)] text-[12px]">
              <Loader2 className="animate-spin" size={22} />
              Đang tải {REPORTS_TABLE}…
            </div>
          ) : (
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)]">
                  <th className="p-[7px_12px] text-left">Marketing</th>
                  {dayKeys.map((ymd) => (
                    <th key={ymd} className="p-[7px_12px] text-center whitespace-nowrap">
                      {formatShortDm(ymd)}
                    </th>
                  ))}
                  <th className="p-[7px_12px] text-right">TB 7 ngày</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text2)]">
                {marketers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={dayKeys.length + 2}
                      className="p-10 text-center text-[var(--text3)] text-[12px] font-bold"
                    >
                      Chưa có dòng báo cáo trong 7 ngày (hoặc thiếu email trên bản ghi).
                    </td>
                  </tr>
                ) : (
                  marketers.map((email) => {
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
                    const label = displayNames.get(email) || email;
                    return (
                      <tr
                        key={email}
                        className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.01)] transition-colors"
                      >
                        <td className="p-[9px_12px] max-w-[200px]">
                          <div className="font-bold text-[var(--text)] truncate" title={label}>
                            {label}
                          </div>
                        </td>
                        {dayKeys.map((ymd) => {
                          const a = byKey.get(`${email}\0${ymd}`);
                          const pct = a ? adsDtPct(a.ad, a.rev) : null;
                          if (pct == null) {
                            return (
                              <td key={ymd} className="p-[9px_12px] text-center">
                                <HeatCell value="—" type="N" />
                              </td>
                            );
                          }
                          const t = heatType(pct);
                          return (
                            <td key={ymd} className="p-[9px_12px] text-center">
                              <HeatCell value={pct.toFixed(1)} type={t} />
                            </td>
                          );
                        })}
                        <td className="p-[9px_12px] text-right">
                          {avgPct == null ? (
                            <HeatCell value="—" type="N" />
                          ) : (
                            <HeatCell value={`${avgPct.toFixed(1)}%`} type={heatType(avgPct)} />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
          <div className="mt-[12px] flex flex-wrap gap-[14px] border-t border-[var(--border)] pt-[12px]">
            <div className="flex items-center gap-[5px]">
              <div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--Gd)] text-[var(--G)] text-[9px] font-black flex items-center justify-center">
                OK
              </div>
              <span className="text-[10px] text-[var(--text3)]">&lt; 30% — Tốt</span>
            </div>
            <div className="flex items-center gap-[5px]">
              <div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--Yd)] text-[var(--Y)] text-[9px] font-black flex items-center justify-center">
                !
              </div>
              <span className="text-[10px] text-[var(--text3)]">30–45% — Chú ý</span>
            </div>
            <div className="flex items-center gap-[5px]">
              <div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--Rd)] text-[var(--R)] text-[9px] font-black flex items-center justify-center">
                ⭕
              </div>
              <span className="text-[10px] text-[var(--text3)]">&gt; 45% — Nguy hiểm</span>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
