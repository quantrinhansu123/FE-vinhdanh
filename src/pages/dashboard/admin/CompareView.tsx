import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Loader2, RefreshCw, Wallet } from 'lucide-react';
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
import './compare.css';

type CmpCardProps = {
  currentLabel: string;
  currentValue: string;
  previousLabel: string;
  previousValue: string;
  change: string;
  subTone?: 'up' | 'down' | 'neutral';
};

const CmpCard: React.FC<CmpCardProps> = ({ currentLabel, currentValue, previousLabel, previousValue, change, subTone = 'neutral' }) => {
  const tonePill =
    subTone === 'up'
      ? 'compare-delta compare-delta--up'
      : subTone === 'down'
        ? 'compare-delta compare-delta--down'
        : 'compare-delta compare-delta--neutral';
  const DeltaIcon = subTone === 'up' ? ArrowUpRight : subTone === 'down' ? ArrowDownRight : ArrowRight;

  return (
    <article className="compare-card">
      <div className="compare-card-heading">
        <span className="compare-period-label">{currentLabel}</span>
        <span className={tonePill}><DeltaIcon size={14} strokeWidth={2.5} />{change}</span>
      </div>
      <div className="compare-value-grid">
        <div className="compare-current-value">
          <span className="compare-value-caption">Kỳ hiện tại</span>
          <strong>{currentValue}</strong>
        </div>
        <div className="compare-value-divider" aria-hidden="true"><ArrowRight size={15} /></div>
        <div className="compare-previous-value">
          <span className="compare-value-caption">{previousLabel}</span>
          <strong>{previousValue}</strong>
        </div>
      </div>
    </article>
  );
};

function StitchCompareSection({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="compare-section">
      <header className="compare-section-header">
        <span className="compare-section-icon" aria-hidden="true">{icon}</span>
        <div><h2>{title}</h2><p>{description}</p></div>
      </header>
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

  const weekTone: CmpCardProps['subTone'] =
    stats.dW == null ? 'neutral' : stats.dW >= 0 ? 'up' : 'down';
  const monthTone: CmpCardProps['subTone'] =
    stats.dM == null ? 'neutral' : stats.dM >= 0 ? 'up' : 'down';
  const changeLabel = (delta: number | null, baseline: number) =>
    delta == null ? (baseline === 0 ? 'Chưa có dữ liệu đối chiếu' : 'Chưa thể so sánh') : formatPct(delta);

  return (
    <div className="compare-page dash-fade-up">
      <div className="compare-hero">
        <div className="compare-hero-copy">
          <span className="compare-eyebrow"><BarChart3 size={14} /> PHÂN TÍCH HIỆU SUẤT</span>
          <h1>So sánh hiệu suất</h1>
          <p>Theo dõi biến động doanh thu và chi phí quảng cáo theo tuần, tháng.</p>
          <span className="compare-range"><CalendarDays size={14} /> Dữ liệu trong 120 ngày gần nhất</span>
        </div>
        <StitchButton
          variant="secondary"
          size="small"
          className="compare-refresh"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Cập nhật dữ liệu
        </StitchButton>
      </div>

      {error && (
        <div className="compare-error">
          {error}
        </div>
      )}

      {loading && !rows.length ? (
        <div className="compare-loading">
          <Loader2 className="animate-spin" size={22} />
          <span>Đang tải dữ liệu hiệu suất…</span>
        </div>
      ) : (
        <>
          <StitchCompareSection title="Doanh thu" description="So sánh doanh thu kỳ hiện tại với kỳ liền trước." icon={<BarChart3 size={18} />}>
            <div className="compare-card-grid">
              <CmpCard
                currentLabel="Tuần này"
                currentValue={`${formatCompactVnd(stats.revThisW)} đ`}
                previousLabel="Tuần trước"
                previousValue={`${formatCompactVnd(stats.revLastW)} đ`}
                change={changeLabel(stats.dW, stats.revLastW)}
                subTone={weekTone}
              />
              <CmpCard
                currentLabel="Tháng này"
                currentValue={`${formatCompactVnd(stats.revThisM)} đ`}
                previousLabel="Tháng trước"
                previousValue={`${formatCompactVnd(stats.revLastM)} đ`}
                change={changeLabel(stats.dM, stats.revLastM)}
                subTone={monthTone}
              />
            </div>
          </StitchCompareSection>

          <StitchCompareSection title="Chi phí quảng cáo" description="Theo dõi mức chi và chiều hướng thay đổi qua từng kỳ." icon={<Wallet size={18} />}>
            <div className="compare-card-grid">
              <CmpCard
                currentLabel="Tuần này"
                currentValue={`${formatCompactVnd(stats.adThisW)} đ`}
                previousLabel="Tuần trước"
                previousValue={`${formatCompactVnd(stats.adLastW)} đ`}
                change={changeLabel(stats.adDW, stats.adLastW)}
                subTone={stats.adDW == null ? 'neutral' : stats.adDW <= 0 ? 'up' : 'down'}
              />
              <CmpCard
                currentLabel="Tháng này"
                currentValue={`${formatCompactVnd(stats.adThisM)} đ`}
                previousLabel="Tháng trước"
                previousValue={`${formatCompactVnd(stats.adLastM)} đ`}
                change={changeLabel(stats.adDM, stats.adLastM)}
                subTone={stats.adDM == null ? 'neutral' : stats.adDM <= 0 ? 'up' : 'down'}
              />
            </div>
          </StitchCompareSection>

          {rows.length === 0 && !loading && !error && (
            <div className="compare-empty">
              Chưa có dữ liệu báo cáo trong khoảng thời gian này.
            </div>
          )}
        </>
      )}
    </div>
  );
};
