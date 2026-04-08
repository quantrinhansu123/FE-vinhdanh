import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, ProgressRow, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { AuthUser, Employee, TkqcAdListRow } from '../../../types';
import { crmNavTierFromUser } from '../../../utils/crmNavAccess';
import { REPORTS_TABLE, formatCompactVnd, formatKpiMoney, formatNumberDots, formatReportDateVi, toLocalYyyyMmDd } from './mktDetailReportShared';

const KPI_STAFF_TARGETS_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_STAFF_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_staff_monthly_targets';
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';
const STAFF_SELECT = 'id, name, email, team, ma_ns, vi_tri, trang_thai, avatar_url';

const LEAD_TARGET = 1500;
const ORDER_TARGET = 400;

const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';
const MARKETING_STAFF_TABLE = import.meta.env.VITE_SUPABASE_MARKETING_STAFF_TABLE?.trim() || 'marketing_staff';

const TKQC_SELECT = `
  id,
  id_du_an,
  ma_tkqc,
  ten_tkqc,
  ten_pae,
  nen_tang,
  ngan_sach_phan_bo,
  ngay_bat_dau,
  trang_thai_tkqc,
  agency,
  id_marketing_staff,
  du_an ( id, ma_du_an, ten_du_an, don_vi, ngay_bat_dau ),
  marketing_staff ( id_ns, name )
`;

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function isEffectiveTkqc(trangThai: TkqcAdListRow['trang_thai_tkqc']): boolean {
  return trangThai !== 'thieu_thiet_lap';
}

function adsDtToBadgeType(pct: number | null): 'G' | 'Y' | 'R' | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct < 30) return 'G';
  if (pct <= 45) return 'Y';
  return 'R';
}

function closeRateToDeltaType(pct: number | null): 'up' | 'dn' | 'nt' {
  if (pct == null || !Number.isFinite(pct)) return 'nt';
  return pct >= 20 ? 'up' : 'dn';
}

function deltaTypeFromPct(pct: number | null): 'up' | 'dn' | 'nt' {
  if (pct == null || !Number.isFinite(pct)) return 'nt';
  return pct >= 85 ? 'up' : pct >= 50 ? 'nt' : 'dn';
}

type DailyAgg = {
  revenue: number;
  adCost: number;
  lead: number;
  orders: number;
};

function emptyDailyAgg(): DailyAgg {
  return { revenue: 0, adCost: 0, lead: 0, orders: 0 };
}

function safeTrim(v: unknown): string {
  return String(v ?? '').trim();
}

function isActiveStaff(tt: string | null | undefined): boolean {
  return tt === 'dang_lam' || tt === 'tam_nghi' || tt === 'dot_tien';
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/[\$,]/g, '').replace(/\s+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Đồng bộ với leader-dash / detail_reports */
function reportRevenueVnd(row: { tien_viet?: unknown; revenue?: unknown }): number {
  return row.tien_viet != null ? safeNum(row.tien_viet) : Math.round(safeNum(row.revenue) * 25000);
}

type ReportScopeRow = {
  report_date?: string;
  revenue?: number | null;
  tien_viet?: number | null;
  ad_cost?: number | null;
  tong_lead?: number | null;
  order_count?: number | null;
  email?: string | null;
  code?: string | null;
};

function rowMatchesReportScope(
  row: ReportScopeRow,
  mode: 'all' | 'team' | 'self',
  emailSet: Set<string>,
  codeSet: Set<string>
): boolean {
  if (mode === 'all') return true;
  const em = String(row.email || '')
    .trim()
    .toLowerCase();
  const codeKey = String(row.code || '')
    .trim()
    .toLowerCase();
  if (codeKey && codeSet.has(codeKey)) return true;
  if (em && emailSet.has(em)) return true;
  return false;
}

export type MktDashboardViewProps = {
  reportUser?: AuthUser | null;
};

export const MktDashboardView: React.FC<MktDashboardViewProps> = ({ reportUser = null }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [daily, setDaily] = useState<Map<string, DailyAgg>>(() => new Map());
  const [monthAgg, setMonthAgg] = useState<DailyAgg>(() => emptyDailyAgg());
  const [targetVnd, setTargetVnd] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<TkqcAdListRow[]>([]);

  const todayStr = useMemo(() => toLocalYyyyMmDd(new Date()), []);

  const navTier = useMemo(() => crmNavTierFromUser(reportUser ?? null), [reportUser]);

  const load = useCallback(async () => {
    if (!reportUser?.email?.trim()) {
      setLoading(false);
      setError('Đăng nhập CRM để xem dashboard Marketing của bạn.');
      return;
    }

    setLoading(true);
    setError(null);

    const tier = crmNavTierFromUser(reportUser);
    const emailLower = reportUser.email.trim().toLowerCase();
    const today = new Date();
    const todayIso = toLocalYyyyMmDd(today);

    const last7From = toLocalYyyyMmDd(addDays(today, -6));
    const last7To = todayIso;

    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${ym}-01`;
    const monthEnd = toLocalYyyyMmDd(new Date(today.getFullYear(), today.getMonth() + 1, 0));

    const dailyMap = new Map<string, DailyAgg>();
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, -6 + i);
      dailyMap.set(toLocalYyyyMmDd(d), emptyDailyAgg());
    }

    let scopeMode: 'all' | 'team' | 'self' = 'self';
    const emailSet = new Set<string>();
    const codeSet = new Set<string>();
    let teamEmployeeIds: string[] = [];

    if (tier === 'admin') {
      scopeMode = 'all';
      teamEmployeeIds = [];
    } else if (tier === 'leader') {
      scopeMode = 'team';
      const viewerName = reportUser.name?.trim() || '';
      const fallbackTeam = reportUser.team?.trim() || '';
      let teamKeys: string[] = [];
      if (viewerName) {
        const teamRes = await supabase.from(TEAMS_TABLE).select('ten_team, leader').eq('leader', viewerName);
        if (!teamRes.error) {
          teamKeys = (teamRes.data || [])
            .map((r) => safeTrim((r as { ten_team?: string }).ten_team))
            .filter(Boolean);
        } else {
          console.warn('mkt-dash crm_teams:', teamRes.error);
        }
      }
      if (!teamKeys.length && fallbackTeam) teamKeys = [fallbackTeam];
      teamKeys = [...new Set(teamKeys.map((x) => x.trim()).filter(Boolean))];

      const empRes = await supabase.from(EMPLOYEES_TABLE).select(STAFF_SELECT).order('name', { ascending: true });
      if (empRes.error) {
        console.error('mkt-dash employees:', empRes.error);
        setError(empRes.error.message || 'Không tải được nhân sự (leader).');
        setLoading(false);
        return;
      }
      const all = (empRes.data || []) as Employee[];
      const teamList = teamKeys.length
        ? all.filter((e) => teamKeys.includes(safeTrim(e.team)) && isActiveStaff(e.trang_thai))
        : [];
      teamEmployeeIds = teamList.map((e) => e.id).filter(Boolean);
      for (const e of teamList) {
        const em = e.email?.trim().toLowerCase();
        if (em) emailSet.add(em);
        const k = safeTrim(e.ma_ns).toLowerCase();
        if (k) codeSet.add(k);
      }
    } else {
      scopeMode = 'self';
      emailSet.add(emailLower);
      const k = safeTrim(reportUser.ma_ns).toLowerCase();
      if (k) codeSet.add(k);
      if (reportUser.id?.trim()) teamEmployeeIds = [reportUser.id.trim()];
    }

    const REPORT_ROW_SELECT =
      'report_date, revenue, tien_viet, ad_cost, tong_lead, order_count, email, code';

    const targetPromise =
      tier === 'admin'
        ? Promise.resolve({ data: null as unknown, error: null })
        : tier === 'leader'
          ? teamEmployeeIds.length > 0
            ? supabase
                .from(KPI_STAFF_TARGETS_TABLE)
                .select('muc_tieu_vnd')
                .eq('nam_thang', ym)
                .in('employee_id', teamEmployeeIds)
            : Promise.resolve({ data: [] as { muc_tieu_vnd?: number }[], error: null })
          : supabase
              .from(KPI_STAFF_TARGETS_TABLE)
              .select('muc_tieu_vnd')
              .eq('nam_thang', ym)
              .eq('employee_id', reportUser.id)
              .maybeSingle();

    const accountsPromise = (async (): Promise<{ data: TkqcAdListRow[]; error: unknown }> => {
      if (tier === 'admin') {
        const { data, error: aErr } = await supabase
          .from(TKQC_TABLE)
          .select(TKQC_SELECT)
          .order('ten_tkqc', { ascending: true, nullsFirst: false })
          .order('ma_tkqc', { ascending: true })
          .limit(500);
        return { data: (data || []) as TkqcAdListRow[], error: aErr };
      }
      if (tier === 'leader') {
        if (teamEmployeeIds.length === 0) return { data: [], error: null };
        const msRes = await supabase
          .from(MARKETING_STAFF_TABLE)
          .select('id')
          .in('employee_id', teamEmployeeIds);
        const staffIds = Array.from(
          new Set((msRes.data || []).map((r) => String((r as { id: string }).id)).filter(Boolean))
        );
        if (staffIds.length === 0) return { data: [], error: msRes.error };
        const { data, error: aErr } = await supabase
          .from(TKQC_TABLE)
          .select(TKQC_SELECT)
          .in('id_marketing_staff', staffIds)
          .order('ten_tkqc', { ascending: true, nullsFirst: false })
          .order('ma_tkqc', { ascending: true });
        return { data: (data || []) as TkqcAdListRow[], error: aErr };
      }
      if (!reportUser.id?.trim()) return { data: [], error: null };
      const byEmp = await supabase.from(MARKETING_STAFF_TABLE).select('id').eq('employee_id', reportUser.id.trim());
      const emailStaff = await supabase.from(MARKETING_STAFF_TABLE).select('id').ilike('email', emailLower);
      const staffIds = [
        ...(byEmp.data || []).map((r) => String((r as { id: string }).id)),
        ...(emailStaff.data || []).map((r) => String((r as { id: string }).id)),
      ];
      const uniq = Array.from(new Set(staffIds));
      if (uniq.length === 0) return { data: [], error: null };
      const { data, error: aErr } = await supabase
        .from(TKQC_TABLE)
        .select(TKQC_SELECT)
        .in('id_marketing_staff', uniq)
        .order('ten_tkqc', { ascending: true, nullsFirst: false })
        .order('ma_tkqc', { ascending: true });
      return { data: (data || []) as TkqcAdListRow[], error: aErr };
    })();

    const [last7Res, monthRes, targetRes, accountsRes] = await Promise.all([
      supabase
        .from(REPORTS_TABLE)
        .select(REPORT_ROW_SELECT)
        .gte('report_date', last7From)
        .lte('report_date', last7To)
        .order('report_date', { ascending: false })
        .limit(15000),
      supabase
        .from(REPORTS_TABLE)
        .select(REPORT_ROW_SELECT)
        .gte('report_date', monthStart)
        .lte('report_date', monthEnd)
        .limit(20000),
      targetPromise,
      accountsPromise,
    ]);

    if (last7Res.error) {
      console.error('mkt-dash last7:', last7Res.error);
      setError(last7Res.error.message || 'Không tải được dữ liệu 7 ngày.');
      setLoading(false);
      return;
    }

    for (const row of (last7Res.data || []) as ReportScopeRow[]) {
      if (!rowMatchesReportScope(row, scopeMode, emailSet, codeSet)) continue;
      const d = row.report_date?.slice(0, 10);
      if (!d || !dailyMap.has(d)) continue;
      const cur = dailyMap.get(d) || emptyDailyAgg();
      cur.revenue += reportRevenueVnd(row);
      cur.adCost += safeNum(row.ad_cost);
      cur.lead += safeNum(row.tong_lead);
      cur.orders += safeNum(row.order_count);
      dailyMap.set(d, cur);
    }
    setDaily(dailyMap);

    if (monthRes.error) {
      console.error('mkt-dash month:', monthRes.error);
      setError(monthRes.error.message || 'Không tải được dữ liệu tháng.');
    }

    const mAgg = emptyDailyAgg();
    for (const row of (monthRes.data || []) as ReportScopeRow[]) {
      if (!rowMatchesReportScope(row, scopeMode, emailSet, codeSet)) continue;
      mAgg.revenue += reportRevenueVnd(row);
      mAgg.adCost += safeNum(row.ad_cost);
      mAgg.lead += safeNum(row.tong_lead);
      mAgg.orders += safeNum(row.order_count);
    }
    setMonthAgg(mAgg);

    if (targetRes.error) {
      console.warn('mkt-dash kpi target:', targetRes.error);
      setTargetVnd(null);
    } else if (tier === 'admin') {
      setTargetVnd(null);
    } else if (tier === 'leader' && Array.isArray(targetRes.data)) {
      let sum = 0;
      for (const r of targetRes.data as { muc_tieu_vnd?: number }[]) {
        const v = Number(r.muc_tieu_vnd);
        if (Number.isFinite(v) && v > 0) sum += v;
      }
      setTargetVnd(sum > 0 ? sum : null);
    } else {
      const v = Number((targetRes.data as { muc_tieu_vnd?: number } | null)?.muc_tieu_vnd);
      setTargetVnd(Number.isFinite(v) && v > 0 ? v : null);
    }

    if (accountsRes.error) {
      console.warn('mkt-dash tkqc:', accountsRes.error);
    } else {
      setAccounts((accountsRes.data || []) as TkqcAdListRow[]);
    }

    setLoading(false);
  }, [reportUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const last7DaysDesc = useMemo(() => {
    const t = new Date();
    const days = Array.from({ length: 7 }, (_, i) => toLocalYyyyMmDd(addDays(t, -6 + i)));
    return days.reverse();
  }, []);

  const todayAgg = daily.get(todayStr) || emptyDailyAgg();
  const yesterdayStr = toLocalYyyyMmDd(addDays(new Date(), -1));
  const yAgg = daily.get(yesterdayStr) || emptyDailyAgg();

  const todayRevenue = todayAgg.revenue;
  const todayAdCost = todayAgg.adCost;
  const todayLead = todayAgg.lead;
  const todayOrders = todayAgg.orders;

  const yesterdayRevenue = yAgg.revenue;

  const revDeltaPct = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;
  const closeRate = todayLead > 0 ? (todayOrders / todayLead) * 100 : null;
  const adsDtPct = todayRevenue > 0 ? (todayAdCost / todayRevenue) * 100 : null;

  const adsSafe = adsDtPct != null ? adsDtPct <= 35 : false;
  const kpiPct = targetVnd != null && targetVnd > 0 ? (monthAgg.revenue / targetVnd) * 100 : null;

  const revenueValueText = formatNumberDots(todayRevenue, false);
  const adsValueText = formatNumberDots(todayAdCost, false);
  const leadTodayValueText = Math.round(todayLead).toLocaleString('vi-VN');
  const monthRevenueValue = formatNumberDots(monthAgg.revenue, false);

  const monthTargetText = targetVnd != null ? formatKpiMoney(targetVnd) : '—';

  const firstDeltaText = revDeltaPct != null ? `${revDeltaPct >= 0 ? '+' : ''}${revDeltaPct.toFixed(0)}% hôm qua` : '—';
  const firstDeltaType = revDeltaPct != null ? (revDeltaPct >= 0 ? 'up' : 'dn') : 'nt';

  const adsDtText = adsDtPct != null ? `${adsDtPct.toFixed(1)}%` : '—';
  const adsDeltaText = adsDtPct != null ? (adsSafe ? 'An toàn' : 'Theo dõi') : '—';
  const adsDeltaType = adsDtPct != null ? (adsSafe ? 'up' : 'dn') : 'nt';

  const leadSubText = `${Math.round(todayOrders).toLocaleString('vi-VN')} đơn chốt`;
  const leadDeltaText = closeRate != null ? `Chốt: ${closeRate.toFixed(1)}%` : 'Chốt: —';
  const leadDeltaType = closeRate != null ? closeRate >= 20 ? 'up' : 'dn' : 'nt';

  const kpiDeltaText = kpiPct != null ? `${kpiPct.toFixed(1)}% KPI` : '—';
  const kpiDeltaType = deltaTypeFromPct(kpiPct);

  const leadProgressPct = Math.round((monthAgg.lead / LEAD_TARGET) * 1000) / 10;
  const orderProgressPct = Math.round((monthAgg.orders / ORDER_TARGET) * 1000) / 10;
  const leadProgress = Math.min(100, Number.isFinite(leadProgressPct) ? leadProgressPct : 0);
  const orderProgress = Math.min(100, Number.isFinite(orderProgressPct) ? orderProgressPct : 0);

  const leadValueText = `${formatNumberDots(monthAgg.lead, false)} / ${formatNumberDots(LEAD_TARGET, false)}`;
  const orderValueText = `${formatNumberDots(monthAgg.orders, false)} / ${formatNumberDots(ORDER_TARGET, false)}`;
  const revenueValueTextKpi = `${formatKpiMoney(monthAgg.revenue)} / ${targetVnd ? formatKpiMoney(targetVnd) : '—'}`;
  const revenueProgress = targetVnd && targetVnd > 0 ? Math.min(100, (monthAgg.revenue / targetVnd) * 100) : 0;

  const topAccounts = useMemo(() => accounts.slice(0, 3), [accounts]);

  if (loading) {
    return (
      <div className="dash-fade-up">
        <div className="flex items-center justify-center gap-2 py-14 text-[var(--text3)] text-[12px] font-bold">
          <Loader2 className="animate-spin" size={20} />
          Đang tải dashboard Marketing…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-fade-up p-6 text-[12px] text-[var(--text3)] font-bold">
        {error}
      </div>
    );
  }

  return (
    <div className="dash-fade-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[14px]">
        <KpiCard
          label="Doanh số hôm nay"
          value={revenueValueText}
          sub="VNĐ"
          delta={firstDeltaText}
          deltaType={firstDeltaType}
          barColor="var(--G)"
          animationDelay={0.03}
          valueSize="lg"
        />
        <KpiCard
          label="Chi phí Ads hôm nay"
          value={adsValueText}
          sub={`Ads/DT: ${adsDtText}`}
          delta={adsDeltaText}
          deltaType={adsDeltaType}
          barColor="var(--accent)"
          animationDelay={0.06}
          valueSize="lg"
        />
        <KpiCard
          label="Lead hôm nay"
          value={leadTodayValueText}
          sub={leadSubText}
          delta={leadDeltaText}
          deltaType={leadDeltaType}
          barColor="var(--P)"
          animationDelay={0.09}
          valueSize="lg"
        />
        <KpiCard
          label={
            navTier === 'admin' ? 'DT tháng (toàn hệ)' : navTier === 'leader' ? 'DT tháng team' : 'DT tháng của tôi'
          }
          value={monthRevenueValue}
          sub={`Mục tiêu: ${monthTargetText}`}
          delta={kpiDeltaText}
          deltaType={kpiDeltaType}
          barColor="var(--Y)"
          animationDelay={0.12}
          valueSize="lg"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px]">
        <SectionCard title="📅 Hiệu suất 7 ngày" bodyPadding={false}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[7px_12px]">Ngày</th>
                  <th className="p-[7px_12px] text-right">DT</th>
                  <th className="p-[7px_12px] text-right">Ads</th>
                  <th className="p-[7px_12px] text-right">Ads/DT</th>
                  <th className="p-[7px_12px] text-right">Lead</th>
                  <th className="p-[7px_12px] text-right">Đơn</th>
                  <th className="p-[7px_12px] text-right">Chốt%</th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)] font-[var(--mono)]">
                {last7DaysDesc.map((d, idx) => {
                  const a = daily.get(d) || emptyDailyAgg();
                  const rev = a.revenue;
                  const ads = a.adCost;
                  const lead = a.lead;
                  const orders = a.orders;

                  const revCompact = rev > 0 ? formatCompactVnd(rev) : '—';
                  const adsCompact = ads > 0 ? formatCompactVnd(ads) : '—';

                  const adsDt = rev > 0 ? (ads / rev) * 100 : null;
                  const adsBadgeType = adsDtToBadgeType(adsDt);
                  const adsDtText = adsDt != null ? `${adsDt.toFixed(1)}%` : '—';

                  const chotPct = lead > 0 ? (orders / lead) * 100 : null;
                  const chotText = chotPct != null ? `${chotPct.toFixed(1)}%` : '—';

                  const chotColorClass =
                    chotPct == null
                      ? ''
                      : chotPct >= 25
                        ? 'text-[var(--G)]'
                        : chotPct <= 20
                          ? 'text-[var(--R)]'
                          : '';

                  const trCls =
                    idx === last7DaysDesc.length - 1
                      ? 'border-[0] transition-colors hover:bg-[rgba(255,255,255,0.02)]'
                      : 'border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]';

                  return (
                    <tr key={d} className={trCls}>
                      <td className="p-[9px_12px]">{formatReportDateVi(d).slice(0, 5)}</td>
                      <td className={`p-[9px_12px] text-right ${rev > 0 ? 'text-[var(--G)] font-extrabold' : ''}`}>
                        {revCompact}
                      </td>
                      <td className="p-[9px_12px] text-right">{adsCompact}</td>
                      <td className="p-[9px_12px] text-right">
                        {adsBadgeType ? <Badge type={adsBadgeType}>{adsDtText}</Badge> : '—'}
                      </td>
                      <td className="p-[9px_12px] text-right">{lead > 0 ? Math.round(lead).toLocaleString('vi-VN') : '—'}</td>
                      <td className="p-[9px_12px] text-right">{orders > 0 ? Math.round(orders).toLocaleString('vi-VN') : '—'}</td>
                      <td className={`p-[9px_12px] text-right ${chotColorClass}`}>{chotText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-[14px]">
          <SectionCard
            title={
              navTier === 'admin'
                ? '🎯 KPI tháng (tổng hợp)'
                : navTier === 'leader'
                  ? '🎯 KPI tháng team'
                  : '🎯 KPI tháng của tôi'
            }
          >
            <ProgressRow
              label="Doanh số"
              valueText={revenueValueTextKpi}
              percent={revenueProgress}
              color="var(--G)"
              height={8}
            />
            <ProgressRow
              label="Lead"
              valueText={leadValueText}
              percent={leadProgress}
              color="var(--P)"
              height={8}
            />
            <ProgressRow
              label="Đơn chốt"
              valueText={orderValueText}
              percent={orderProgress}
              color="var(--Y)"
              height={8}
            />
          </SectionCard>

          <SectionCard title="🎯 Tài khoản Ads">
            {topAccounts.length === 0 ? (
              <div className="text-[12px] text-[var(--text3)] py-8 text-center font-bold">
                {navTier === 'admin'
                  ? 'Chưa có TKQC (hoặc vượt giới hạn hiển thị).'
                  : navTier === 'leader'
                    ? 'Chưa có TKQC cho team.'
                    : 'Chưa có TKQC gán cho bạn.'}
              </div>
            ) : (
              <div className="flex flex-col gap-[6px]">
                {topAccounts.map((row) => {
                  const agency = row.agency?.trim() || row.du_an?.don_vi?.trim() || row.du_an?.ten_du_an?.trim() || '—';
                  const displayName = row.ten_tkqc?.trim() || row.ten_pae?.trim() || row.ma_tkqc;
                  const active = isEffectiveTkqc(row.trang_thai_tkqc);
                  return (
                    <div
                      key={row.id}
                      className="bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[11px_14px] flex items-center gap-[12px]"
                    >
                      <div className="font-[var(--mono)] text-[10.5px] text-[var(--accent)] font-bold w-[90px] shrink-0">
                        {row.ma_tkqc}
                      </div>
                      <div className="flex-1">
                        <div className="text-[11.5px] font-bold text-[var(--text)]">{displayName}</div>
                        <div className="text-[9.5px] text-[var(--text3)]">
                          {agency} · VNĐ
                        </div>
                      </div>
                      <Badge type={active ? 'G' : 'R'}>{active ? 'Active' : 'Thiếu thiết lập'}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
