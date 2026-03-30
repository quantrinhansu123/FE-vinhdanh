import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { ReportRow } from '../../../types';

const REPORTS_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

function toLocalYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Thứ Hai đầu tuần (locale) */
function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function sumInRange(
  rows: ReportRow[],
  start: Date,
  end: Date,
  field: 'revenue' | 'ad_cost'
): number {
  const a = toLocalYyyyMmDd(start);
  const b = toLocalYyyyMmDd(end);
  return rows.reduce((acc, r) => {
    const d = r.report_date?.slice(0, 10);
    if (!d || d < a || d > b) return acc;
    const v = field === 'revenue' ? r.revenue : r.ad_cost;
    const n = Number(v);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function formatCompactVnd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  const x = n;
  const abs = Math.abs(x);
  if (abs >= 1_000_000_000) {
    const v = x / 1_000_000_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    const v = x / 1_000_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) return `${Math.round(x / 1_000)}K`;
  return `${Math.round(x)}`;
}

function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function formatPct(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

type CmpCardProps = {
  label: string;
  value: string;
  sub: string;
  subTone?: 'up' | 'down' | 'neutral';
  valueClassName?: string;
};

const CmpCard: React.FC<CmpCardProps> = ({ label, value, sub, subTone = 'neutral', valueClassName }) => {
  const subCls =
    subTone === 'up'
      ? 'text-[var(--G)]'
      : subTone === 'down'
        ? 'text-[var(--R)]'
        : 'text-[var(--text3)]';
  return (
    <div className="bg-[var(--bg3)] rounded-[8px] border border-[var(--border)] p-[12px_14px]">
      <div className="text-[9.5px] font-extrabold tracking-[0.8px] uppercase text-[var(--text3)] mb-[8px]">{label}</div>
      <div className={`font-[var(--mono)] text-[18px] font-extrabold text-[var(--text)] ${valueClassName || ''}`}>{value}</div>
      <div className={`text-[10.5px] font-bold mt-[6px] ${subCls}`}>{sub}</div>
    </div>
  );
};

export const CompareView: React.FC = () => {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const since = addDays(new Date(), -120);
    const sinceStr = toLocalYyyyMmDd(since);
    const { data, error: qErr } = await supabase
      .from(REPORTS_TABLE)
      .select('report_date, revenue, ad_cost')
      .gte('report_date', sinceStr)
      .order('report_date', { ascending: true });

    if (qErr) {
      console.error('compare reports:', qErr);
      setError(qErr.message || 'Không tải được báo cáo.');
      setRows([]);
    } else {
      setRows((data || []) as ReportRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const today = new Date();
    const thisWeekStart = startOfWeekMonday(today);
    const thisWeekEnd = addDays(thisWeekStart, 6);
    const lastWeekEnd = addDays(thisWeekStart, -1);
    const lastWeekStart = addDays(lastWeekEnd, -6);

    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    const prevMonthEnd = addDays(thisMonthStart, -1);
    const prevMonthStart = startOfMonth(prevMonthEnd);

    const tw = { start: thisWeekStart, end: thisWeekEnd };
    const lw = { start: lastWeekStart, end: lastWeekEnd };
    const tm = { start: thisMonthStart, end: thisMonthEnd };
    const lm = { start: prevMonthStart, end: prevMonthEnd };

    const revThisW = sumInRange(rows, tw.start, tw.end, 'revenue');
    const revLastW = sumInRange(rows, lw.start, lw.end, 'revenue');
    const revThisM = sumInRange(rows, tm.start, tm.end, 'revenue');
    const revLastM = sumInRange(rows, lm.start, lm.end, 'revenue');

    const adThisW = sumInRange(rows, tw.start, tw.end, 'ad_cost');
    const adLastW = sumInRange(rows, lw.start, lw.end, 'ad_cost');
    const adThisM = sumInRange(rows, tm.start, tm.end, 'ad_cost');
    const adLastM = sumInRange(rows, lm.start, lm.end, 'ad_cost');

    const dW = pctDelta(revThisW, revLastW);
    const dM = pctDelta(revThisM, revLastM);
    const adDW = pctDelta(adThisW, adLastW);
    const adDM = pctDelta(adThisM, adLastM);

    return {
      revThisW,
      revLastW,
      revThisM,
      revLastM,
      adThisW,
      adLastW,
      adThisM,
      adLastM,
      dW,
      dM,
      adDW,
      adDM,
    };
  }, [rows]);

  const weekSubThis =
    stats.dW == null
      ? stats.revLastW === 0
        ? 'Không có dữ liệu tuần trước'
        : 'So với tuần trước: —'
      : `${stats.dW >= 0 ? '▲' : '▼'} ${formatPct(stats.dW)} so với tuần trước`;

  const weekTone: CmpCardProps['subTone'] =
    stats.dW == null ? 'neutral' : stats.dW >= 0 ? 'up' : 'down';

  const monthSubThis =
    stats.dM == null
      ? stats.revLastM === 0
        ? 'Không có dữ liệu tháng trước'
        : 'So với tháng trước: —'
      : `${stats.dM >= 0 ? '▲' : '▼'} ${formatPct(stats.dM)} so với tháng trước`;

  const monthTone: CmpCardProps['subTone'] =
    stats.dM == null ? 'neutral' : stats.dM >= 0 ? 'up' : 'down';

  return (
    <div className="dash-fade-up space-y-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-[var(--text3)] max-w-[520px] leading-relaxed">
          Số liệu cộng từ bảng <code className="text-[var(--text2)]">{REPORTS_TABLE}</code> (cột{' '}
          <code className="text-[var(--text2)]">revenue</code>, <code className="text-[var(--text2)]">ad_cost</code>), nhóm theo{' '}
          <strong className="text-[var(--text2)]">report_date</strong>. Tuần bắt đầu Thứ Hai.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold border border-[rgba(255,255,255,0.08)] disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[var(--r)] px-3 py-2 bg-[var(--Rd)]/20">
          {error}
        </div>
      )}

      {loading && !rows.length ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--text3)] text-[12px]">
          <Loader2 className="animate-spin" size={20} />
          Đang tải báo cáo…
        </div>
      ) : (
        <>
          <SectionCard title="📈 Doanh thu (revenue) — tuần">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
              <CmpCard
                label="Tuần này"
                value={`${formatCompactVnd(stats.revThisW)} đ`}
                sub={weekSubThis}
                subTone={weekTone}
              />
              <CmpCard label="Tuần trước" value={`${formatCompactVnd(stats.revLastW)} đ`} sub="Baseline tuần trước" />
            </div>
          </SectionCard>

          <SectionCard title="📈 Doanh thu (revenue) — tháng">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
              <CmpCard
                label="Tháng này"
                value={`${formatCompactVnd(stats.revThisM)} đ`}
                sub={monthSubThis}
                subTone={monthTone}
                valueClassName="!text-[var(--G)]"
              />
              <CmpCard label="Tháng trước" value={`${formatCompactVnd(stats.revLastM)} đ`} sub="Baseline tháng trước" />
            </div>
          </SectionCard>

          <SectionCard title="💸 Chi phí Ads (ad_cost)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px] mb-[10px]">
              <div className="md:col-span-2 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wide">Tuần</div>
              <CmpCard
                label="Tuần này"
                value={`${formatCompactVnd(stats.adThisW)} đ`}
                sub={
                  stats.adDW == null
                    ? stats.adLastW === 0
                      ? '—'
                      : 'So với tuần trước: —'
                    : `${stats.adDW >= 0 ? '▲' : '▼'} ${formatPct(stats.adDW)} tuần trước`
                }
                subTone={stats.adDW == null ? 'neutral' : stats.adDW <= 0 ? 'up' : 'down'}
              />
              <CmpCard label="Tuần trước" value={`${formatCompactVnd(stats.adLastW)} đ`} sub="Baseline" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px] pt-[10px] border-t border-[var(--border)]">
              <div className="md:col-span-2 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wide">Tháng</div>
              <CmpCard
                label="Tháng này"
                value={`${formatCompactVnd(stats.adThisM)} đ`}
                sub={
                  stats.adDM == null
                    ? stats.adLastM === 0
                      ? '—'
                      : 'So với tháng trước: —'
                    : `${stats.adDM >= 0 ? '▲' : '▼'} ${formatPct(stats.adDM)} tháng trước`
                }
                subTone={stats.adDM == null ? 'neutral' : stats.adDM <= 0 ? 'up' : 'down'}
              />
              <CmpCard label="Tháng trước" value={`${formatCompactVnd(stats.adLastM)} đ`} sub="Baseline" />
            </div>
          </SectionCard>

          {rows.length === 0 && !loading && !error && (
            <div className="text-[11px] text-[var(--text3)] text-center py-4">
              Chưa có dòng báo cáo trong 120 ngày gần đây.
            </div>
          )}
        </>
      )}
    </div>
  );
};
