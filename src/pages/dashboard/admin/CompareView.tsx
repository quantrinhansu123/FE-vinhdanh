import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
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

import { StitchButton } from '../../../components/ui/StitchUI';
import '../../../styles/stitchSystem.css';

type CmpCardProps = {
  label: string;
  value: string;
  sub: string;
  subTone?: 'up' | 'down' | 'neutral';
  valueClassName?: string;
};

const CmpCard: React.FC<CmpCardProps> = ({ label, value, sub, subTone = 'neutral', valueClassName }) => {
  const tonePill =
    subTone === 'up'
      ? 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]'
      : subTone === 'down'
        ? 'bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3]'
        : 'bg-[#f0f4f1] text-[#476355] border border-[#e2e8e5]';

  return (
    <div className="bg-[#f8faf9] rounded-xl border border-[#e2e8e5] p-4 transition-all hover:shadow-xs">
      <div className="text-[11px] font-bold tracking-wider uppercase text-[#476355] mb-2">{label}</div>
      <div className={`font-mono text-xl font-extrabold text-[#191c1b] ${valueClassName || ''}`}>{value}</div>
      <div className="mt-2.5">
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${tonePill}`}>
          {sub}
        </span>
      </div>
    </div>
  );
};

function StitchCompareSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-[#e2e8e5] p-5 sm:p-6 shadow-xs">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[#191c1b] mb-4 flex items-center gap-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

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
    <div className="dash-fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#e2e8e5]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#191c1b] tracking-tight">So sánh hiệu suất</h1>
          <p className="text-xs text-[#476355] mt-1 leading-relaxed max-w-xl">
            Số liệu tổng hợp từ bảng <code className="font-mono text-[#006e51] bg-[#ecfdf5] px-1.5 py-0.5 rounded">{REPORTS_TABLE}</code> (cột <code className="font-mono text-[#006e51] bg-[#ecfdf5] px-1.5 py-0.5 rounded">revenue</code>, <code className="font-mono text-[#006e51] bg-[#ecfdf5] px-1.5 py-0.5 rounded">ad_cost</code>), nhóm theo ngày. Tuần bắt đầu Thứ Hai.
          </p>
        </div>
        <StitchButton
          variant="secondary"
          size="small"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </StitchButton>
      </div>

      {error && (
        <div className="text-xs font-semibold text-[#e11d48] border border-[#fecdd3] rounded-xl px-4 py-3 bg-[#fff1f2]">
          {error}
        </div>
      )}

      {loading && !rows.length ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[#476355] text-sm font-medium">
          <Loader2 className="animate-spin text-[#006e51]" size={20} />
          Đang tải báo cáo…
        </div>
      ) : (
        <>
          <StitchCompareSection title="📈 Doanh thu (revenue) — theo tuần">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CmpCard
                label="Tuần này"
                value={`${formatCompactVnd(stats.revThisW)} đ`}
                sub={weekSubThis}
                subTone={weekTone}
              />
              <CmpCard label="Tuần trước" value={`${formatCompactVnd(stats.revLastW)} đ`} sub="Baseline tuần trước" />
            </div>
          </StitchCompareSection>

          <StitchCompareSection title="📈 Doanh thu (revenue) — theo tháng">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CmpCard
                label="Tháng này"
                value={`${formatCompactVnd(stats.revThisM)} đ`}
                sub={monthSubThis}
                subTone={monthTone}
                valueClassName="!text-[#059669]"
              />
              <CmpCard label="Tháng trước" value={`${formatCompactVnd(stats.revLastM)} đ`} sub="Baseline tháng trước" />
            </div>
          </StitchCompareSection>

          <StitchCompareSection title="💸 Chi phí Ads (ad_cost)">
            <div className="mb-4">
              <div className="text-xs font-bold text-[#476355] uppercase tracking-wider mb-2.5">Theo tuần</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <CmpCard label="Tuần trước" value={`${formatCompactVnd(stats.adLastW)} đ`} sub="Baseline tuần trước" />
              </div>
            </div>
            <div className="pt-4 border-t border-[#e2e8e5]">
              <div className="text-xs font-bold text-[#476355] uppercase tracking-wider mb-2.5">Theo tháng</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <CmpCard label="Tháng trước" value={`${formatCompactVnd(stats.adLastM)} đ`} sub="Baseline tháng trước" />
              </div>
            </div>
          </StitchCompareSection>

          {rows.length === 0 && !loading && !error && (
            <div className="text-xs text-[#476355] text-center py-8 bg-white rounded-xl border border-[#e2e8e5]">
              Chưa có dòng báo cáo trong 120 ngày gần đây.
            </div>
          )}
        </>
      )}
    </div>
  );
};
