import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { ReportRow } from '../../../types';
const REPORTS_TABLE = 'detail_reports';

const ADS_CRITICAL = 45;
const ADS_WARN = 30;
const WASTE_TARGET_FRAC = 0.35;

/** Số ngày (report_date) gần nhất, gồm hôm nay */
const LOOKBACK_DAYS = 7;

function toLocalYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
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
  if (t === 'crit') return 'Rà soát chi phí / creative';
  if (t === 'warn') return 'Theo dõi thêm';
  return 'Giữ cấu hình';
}

export const BurnDetectionView: React.FC = () => {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const today = new Date();
    const from = addDays(today, -(LOOKBACK_DAYS - 1));
    return { fromStr: toLocalYyyyMmDd(from), toStr: toLocalYyyyMmDd(today) };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from(REPORTS_TABLE)
      .select(
        'name, email, team, ad_cost, revenue, mess_comment_count, tong_lead, order_count, tong_data_nhan, report_date'
      )
      .gte('report_date', range.fromStr)
      .lte('report_date', range.toStr)
      .limit(8000);

    if (qErr) {
      console.error('burn-detect:', qErr);
      setError(qErr.message || 'Không tải được báo cáo.');
      setRows([]);
    } else {
      setRows((data || []) as ReportRow[]);
    }
    setLoading(false);
  }, [range.fromStr, range.toStr]);

  useEffect(() => {
    void load();
  }, [load]);

  const byMarketer = useMemo(() => {
    const map = new Map<string, Agg>();
    for (const r of rows) {
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
  }, [rows]);

  const scored = useMemo(() => {
    return byMarketer.map((m) => {
      const adsPct =
        m.revenue > 0 ? (m.adCost / m.revenue) * 100 : m.adCost > 0 ? 100 : 0;
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

  if (loading) {
    return (
      <div className="dash-fade-up flex items-center justify-center min-h-[200px] gap-2 text-[var(--text2)]">
        <Loader2 className="animate-spin" size={20} />
        <span className="text-[12px]">Đang tải {REPORTS_TABLE}…</span>
      </div>
    );
  }

  return (
    <div className="dash-fade-up">
      {error ? (
        <div className="mb-[14px] text-[12px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[8px] px-3 py-2 bg-[var(--Rd)]/15 flex flex-wrap items-center gap-3">
          {error}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline"
          >
            <RefreshCw size={12} /> Thử lại
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[14px]">
        <div className="bg-[rgba(224,61,61,0.06)] border border-[rgba(224,61,61,0.15)] rounded-[var(--r)] p-[14px_16px] relative overflow-hidden transition-all duration-200">
          <div className="absolute top-0 left-0 w-[3px] h-full bg-[var(--R)] opacity-40" />
          <div className="text-[9.5px] font-extrabold tracking-[1.2px] uppercase text-[rgba(224,61,61,0.55)] mb-[6px]">
            Đốt tiền nghiêm trọng
          </div>
          <div className="text-[22px] font-[var(--mono)] font-extrabold text-[var(--R)] leading-none mb-[5px]">{kpi.crit}</div>
          <div className="text-[9.5px] text-[RGBA(224,61,61,0.5)] font-bold">
            Ads/DT &gt; {ADS_CRITICAL}% hoặc chi mà không có DT
          </div>
        </div>

        <div className="bg-[rgba(255,178,36,0.06)] border border-[rgba(255,178,36,0.15)] rounded-[var(--r)] p-[14px_16px] relative overflow-hidden transition-all duration-200">
          <div className="absolute top-0 left-0 w-[3px] h-full bg-[var(--Y)] opacity-40" />
          <div className="text-[9.5px] font-extrabold tracking-[1.2px] uppercase text-[rgba(255,178,36,0.6)] mb-[6px]">
            Cần theo dõi
          </div>
          <div className="text-[22px] font-[var(--mono)] font-extrabold text-[var(--Y)] leading-none mb-[5px]">{kpi.warn}</div>
          <div className="text-[9.5px] text-[rgba(255,178,36,0.55)] font-bold">
            Ads/DT {ADS_WARN}–{ADS_CRITICAL}%
          </div>
        </div>

        <div className="bg-[rgba(15,168,109,0.06)] border border-[rgba(15,168,109,0.15)] rounded-[var(--r)] p-[14px_16px] relative overflow-hidden transition-all duration-200">
          <div className="absolute top-0 left-0 w-[3px] h-full bg-[var(--G)] opacity-40" />
          <div className="text-[9.5px] font-extrabold tracking-[1.2px] uppercase text-[rgba(15,168,109,0.65)] mb-[6px]">
            Hiệu quả tốt
          </div>
          <div className="text-[22px] font-[var(--mono)] font-extrabold text-[var(--G)] leading-none mb-[5px]">{kpi.ok}</div>
          <div className="text-[9.5px] text-[rgba(15,168,109,0.6)] font-bold">Ads/DT &lt; {ADS_WARN}%</div>
        </div>
      </div>

      <SectionCard
        title="🔥 Bảng phát hiện đốt tiền"
        subtitle={`${range.fromStr} → ${range.toStr} · Gộp theo email/tên · ${REPORTS_TABLE} · Waste = chi vượt ${Math.round(WASTE_TARGET_FRAC * 100)}% DT`}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-ghost py-[4.5px] px-[12px] rounded-[6px] text-[10.5px] bg-[rgba(255,255,255,0.05)] text-[var(--text2)] border-[var(--border)] inline-flex items-center gap-1"
          >
            <RefreshCw size={12} /> Làm mới
          </button>
        }
        bodyPadding={false}
      >
        <div className="overflow-x-auto">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-[var(--text3)]">
              Chưa có dòng báo cáo có chi hoặc doanh thu trong khoảng {LOOKBACK_DAYS} ngày.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-extrabold tracking-[1.2px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[8px_14px]">Marketing</th>
                  <th className="p-[8px_14px] text-right">Ads Chi</th>
                  <th className="p-[8px_14px] text-right">Revenue</th>
                  <th className="p-[8px_14px] text-right">Ads%</th>
                  <th className="p-[8px_14px] text-right">Mess</th>
                  <th className="p-[8px_14px] text-right">Lead</th>
                  <th className="p-[8px_14px] text-right">Đơn</th>
                  <th className="p-[8px_14px] text-right">CPL</th>
                  <th className="p-[8px_14px] text-right">CPO</th>
                  <th className="p-[8px_14px] text-center">Close%</th>
                  <th className="p-[8px_14px] text-right">Waste</th>
                  <th className="p-[8px_14px] text-right">Burn Score</th>
                  <th className="p-[8px_14px]">Gợi ý</th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)]">
                {sorted.map((s) => {
                  const rowBg =
                    s.tier === 'crit'
                      ? 'border-b border-[rgba(224,61,61,0.08)] bg-[rgba(224,61,61,0.035)] hover:bg-[rgba(224,61,61,0.05)]'
                      : s.tier === 'warn'
                        ? 'border-b border-[rgba(255,178,36,0.06)] hover:bg-[rgba(255,178,36,0.03)]'
                        : 'border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(15,168,109,0.04)]';
                  const nameColor =
                    s.tier === 'crit' ? 'text-[var(--R)]' : s.tier === 'warn' ? 'text-[var(--Y)]' : 'text-[var(--text)]';
                  const adsBadge =
                    s.tier === 'crit'
                      ? 'bg-[rgba(224,61,61,0.2)] text-[var(--R)]'
                      : s.tier === 'warn'
                        ? 'bg-[rgba(255,178,36,0.15)] text-[var(--Y)]'
                        : 'bg-[rgba(15,168,109,0.15)] text-[var(--G)]';
                  const burnColor =
                    s.tier === 'crit' ? 'text-[var(--R)]' : s.tier === 'warn' ? 'text-[var(--Y)]' : 'text-[var(--G)]';
                  return (
                    <tr key={s.key} className={`${rowBg} transition-colors`}>
                      <td className="p-[10px_14px]">
                        <div className={`font-bold text-[12px] tracking-[0.2px] ${nameColor}`}>{s.displayName}</div>
                        <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">{s.team || '—'}</div>
                      </td>
                      <td className="p-[10px_14px] text-right font-[var(--mono)] font-bold">{formatVndDots(s.adCost)}</td>
                      <td className="p-[10px_14px] text-right font-[var(--mono)]">{formatVndDots(s.revenue)}</td>
                      <td className="p-[10px_14px] text-right">
                        <span className={`${adsBadge} p-[2.5px_8px] rounded-[4px] text-[10px] font-bold`}>
                          {s.revenue > 0 ? `${s.adsPct.toFixed(1)}%` : s.adCost > 0 ? '—' : '0%'}
                        </span>
                      </td>
                      <td className="p-[10px_14px] text-right font-[var(--mono)]">{Math.round(s.mess).toLocaleString('vi-VN')}</td>
                      <td className="p-[10px_14px] text-right font-[var(--mono)]">{Math.round(s.tongLead).toLocaleString('vi-VN')}</td>
                      <td className="p-[10px_14px] text-right font-[var(--mono)]">{Math.round(s.orders).toLocaleString('vi-VN')}</td>
                      <td className="p-[10px_14px] text-right font-[var(--mono)]">
                        {s.cpl != null ? formatVndDots(s.cpl) : '—'}
                      </td>
                      <td className="p-[10px_14px] text-right font-[var(--mono)]">
                        {s.cpo != null ? formatVndDots(s.cpo) : '—'}
                      </td>
                      <td className="p-[10px_14px] text-center font-[var(--mono)] font-bold">
                        {s.closePct != null ? `${s.closePct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="p-[10px_14px] text-right font-[var(--mono)] font-bold">{formatVndDots(s.waste)}</td>
                      <td className="p-[10px_14px] text-right">
                        <div className={`font-[var(--mono)] text-[12.5px] font-extrabold ${burnColor}`}>{s.burn}</div>
                      </td>
                      <td className="p-[10px_14px]">
                        <span className="text-[9px] font-extrabold p-[3px_10px] rounded-[6px] border border-[var(--border)] text-[var(--text2)] uppercase whitespace-nowrap">
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
        <div className="p-[14px_16px] border-t border-[var(--border)] bg-[rgba(255,255,255,0.015)]">
          <div className="text-[10px] font-extrabold text-[var(--text3)] tracking-[1.5px] uppercase mb-[10px]">
            Quy tắc cảnh báo Ads / Doanh số (theo dữ liệu khai báo)
          </div>
          <div className="flex flex-wrap gap-[18px]">
            <div className="flex items-center gap-[6px] text-[10.5px] font-bold text-[var(--text3)]">
              <span className="text-[var(--G)] text-[12px]">●</span> &lt; {ADS_WARN}% — An toàn
            </div>
            <div className="flex items-center gap-[6px] text-[10.5px] font-bold text-[var(--text3)]">
              <span className="text-[var(--Y)] text-[12px]">●</span> {ADS_WARN}–{ADS_CRITICAL}% — Cần chú ý
            </div>
            <div className="flex items-center gap-[6px] text-[10.5px] font-bold text-[var(--text3)]">
              <span className="text-[var(--R)] text-[12px]">●</span> &gt; {ADS_CRITICAL}% hoặc chi khi DT = 0 — Nguy hiểm
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
