import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, AlertItem } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { ReportRow } from '../../../types';
import { formatCompactVnd } from '../mkt/mktDetailReportShared';

const REPORTS_TABLE = 'detail_reports';

const ADS_CRITICAL = 45;
const ADS_WARN = 30;

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

const MIN_LEAD_FOR_LOW_CLOSE = 15;
const LOW_CLOSE_PCT = 15;
const MIN_CHI_FOR_ZERO_LEAD = 3_000_000;

export const AlertsView: React.FC = () => {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const { data, error: qErr } = await supabase
      .from(REPORTS_TABLE)
      .select(
        'report_date, name, email, team, ad_cost, revenue, mess_comment_count, tong_lead, order_count, tong_data_nhan'
      )
      .gte('report_date', monthStart)
      .lte('report_date', monthEnd)
      .limit(8000);

    if (qErr) {
      console.error('alerts view:', qErr);
      setError(qErr.message || 'Không tải được báo cáo.');
      setRows([]);
    } else {
      setRows((data || []) as ReportRow[]);
    }
    setLoading(false);
  }, [monthStart, monthEnd]);

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
    for (const r of rows) {
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
  }, [scored, rows, monthVi]);

  const dangerAlertCount = useMemo(() => alerts.filter((a) => a.statusType === 'R').length, [alerts]);
  const warnAlertCount = useMemo(() => alerts.filter((a) => a.statusType === 'Y').length, [alerts]);

  if (loading) {
    return (
      <div className="dash-fade-up flex items-center justify-center min-h-[200px] gap-2 text-[var(--text2)]">
        <Loader2 className="animate-spin" size={20} />
        <span className="text-[12px]">Đang tải cảnh báo từ {REPORTS_TABLE}…</span>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[10px] mb-[14px]">
        <KpiCard
          label="Nguy hiểm (MKT)"
          value={String(kpi.crit)}
          sub="Ads/DT đỏ hoặc chi khi không có DT"
          animationDelay={0}
          barColor="var(--R)"
          valueColor="var(--R)"
        />
        <KpiCard
          label="Cần chú ý (MKT)"
          value={String(kpi.warn)}
          sub={`Ads/DT ${ADS_WARN}–${ADS_CRITICAL}% · tháng ${monthVi}`}
          animationDelay={0.03}
          barColor="var(--Y)"
          valueColor="var(--Y)"
        />
        <KpiCard
          label="Ổn định (MKT)"
          value={String(kpi.ok)}
          sub={`Có dòng báo cáo trong tháng · ${REPORTS_TABLE}`}
          animationDelay={0.06}
          barColor="var(--G)"
          valueColor="var(--G)"
        />
      </div>

      <SectionCard
        title={`🚨 Cảnh báo từ báo cáo · tháng ${monthVi}`}
        subtitle={
          alerts.length === 0
            ? `Không phát sinh cảnh báo từ ${REPORTS_TABLE} (${monthStart} → ${monthEnd})`
            : `${alerts.length} nhóm · ${dangerAlertCount} nguy hiểm · ${warnAlertCount} cần chú ý`
        }
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-ghost py-[4.5px] px-[10px] text-[10.5px] rounded-[6px] inline-flex items-center gap-1 bg-[rgba(255,255,255,0.05)] text-[var(--text2)] border-[var(--border)]"
          >
            <RefreshCw size={12} /> Làm mới
          </button>
        }
      >
        {alerts.length === 0 ? (
          <p className="text-[12px] text-[var(--text3)]">
            Dữ liệu đủ tốt trong kỳ, hoặc chưa có dòng báo cáo. Cảnh báo TK/agency/ngân sách cần nguồn khác ngoài{' '}
            <code className="text-[10px] text-[var(--text2)]">{REPORTS_TABLE}</code>.
          </p>
        ) : (
          <div className="flex flex-col gap-[7px]">
            {alerts.map((a) => (
              <AlertItem
                key={a.id}
                title={a.title}
                description={a.description}
                statusText={a.statusText}
                statusType={a.statusType}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};
