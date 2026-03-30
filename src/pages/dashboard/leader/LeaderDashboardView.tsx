import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, ProgressRow } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { AuthUser, Employee } from '../../../types';
import { formatCompactVnd, formatKpiMoney, REPORTS_TABLE, toLocalYyyyMmDd } from '../mkt/mktDetailReportShared';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const KPI_TEAM_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_TEAM_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_team_monthly_targets';
const KPI_STAFF_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_STAFF_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_staff_monthly_targets';

const STAFF_SELECT = 'id, name, email, team, ma_ns, vi_tri, trang_thai';

export type LeaderDashboardViewProps = {
  viewer?: AuthUser | null;
};

type Agg = {
  rev: number;
  ads: number;
  tongLead: number;
  tongData: number;
  mess: number;
  orders: number;
  accounts: Set<string>;
};

function ymNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRangeLocal(ym: string): { start: string; end: string } {
  const [ys, ms] = ym.split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    const t = toLocalYyyyMmDd(new Date());
    return { start: `${t.slice(0, 8)}01`, end: t };
  }
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(last).padStart(2, '0')}`,
  };
}

function isActiveStaff(tt: string | null | undefined): boolean {
  return tt === 'dang_lam' || tt === 'tam_nghi' || tt === 'dot_tien';
}

function adsDtPct(ads: number, rev: number): number | null {
  if (!Number.isFinite(ads) || !Number.isFinite(rev) || rev <= 0) return null;
  return (ads / rev) * 100;
}

function heatBadgeClass(pct: number): { cls: string; label: string } {
  if (pct < 30) return { cls: 'bg-[var(--Gd)] text-[var(--G)]', label: `${pct.toFixed(1)}%` };
  if (pct <= 45) return { cls: 'bg-[var(--Yd)] text-[var(--Y)]', label: `${pct.toFixed(1)}%` };
  return { cls: 'bg-[var(--Rd)] text-[var(--R)]', label: `${pct.toFixed(1)}%` };
}

function tyLeChot(data: number, leads: number, orders: number): number | null {
  if (Number.isFinite(data) && data > 0 && Number.isFinite(orders)) return (orders / data) * 100;
  if (Number.isFinite(leads) && leads > 0 && Number.isFinite(orders)) return (orders / leads) * 100;
  return null;
}

function emptyAgg(): Agg {
  return {
    rev: 0,
    ads: 0,
    tongLead: 0,
    tongData: 0,
    mess: 0,
    orders: 0,
    accounts: new Set(),
  };
}

function leadCount(a: Agg): number {
  const tl = a.tongLead;
  if (tl > 0) return tl;
  if (a.mess > 0) return a.mess;
  return 0;
}

export const LeaderDashboardView: React.FC<LeaderDashboardViewProps> = ({ viewer = null }) => {
  const ym = ymNow();
  const { start, end } = monthRangeLocal(ym);
  const monthLabel = useMemo(() => {
    const [y, m] = ym.split('-');
    return `${m}/${y}`;
  }, [ym]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<Employee[]>([]);
  const [byEmail, setByEmail] = useState<Map<string, Agg>>(() => new Map());
  const [teamTargetVnd, setTeamTargetVnd] = useState<number | null>(null);
  const [staffTargets, setStaffTargets] = useState<Map<string, number>>(() => new Map());

  const load = useCallback(async () => {
    const teamRaw = viewer?.team?.trim() || '';
    setTeamName(teamRaw);
    if (!viewer?.email) {
      setError(null);
      setMembers([]);
      setByEmail(new Map());
      setTeamTargetVnd(null);
      setStaffTargets(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const empRes = await supabase.from(EMPLOYEES_TABLE).select(STAFF_SELECT).order('name', { ascending: true });
    if (empRes.error) {
      console.error('leader-dash employees:', empRes.error);
      setError(empRes.error.message || 'Không tải được nhân sự.');
      setLoading(false);
      return;
    }

    const all = (empRes.data || []) as Employee[];
    const teamList = teamRaw
      ? all.filter((e) => e.team?.trim() === teamRaw && isActiveStaff(e.trang_thai))
      : [];

    const emails = [
      ...new Set(
        teamList
          .map((e) => e.email?.trim().toLowerCase())
          .filter((x): x is string => Boolean(x))
      ),
    ];

    const idList = teamList.map((e) => e.id);

    const [teamKpiRes, staffKpiRes, repRes] = await Promise.all([
      teamRaw
        ? supabase
            .from(KPI_TEAM_TABLE)
            .select('muc_tieu_doanh_thu_team')
            .eq('nam_thang', ym)
            .eq('team_key', teamRaw)
            .maybeSingle()
        : Promise.resolve({ data: null as { muc_tieu_doanh_thu_team?: number } | null, error: null }),
      idList.length
        ? supabase.from(KPI_STAFF_TABLE).select('employee_id, muc_tieu_vnd').eq('nam_thang', ym).in('employee_id', idList)
        : Promise.resolve({ data: [] as { employee_id: string; muc_tieu_vnd: number }[], error: null }),
      emails.length
        ? supabase
            .from(REPORTS_TABLE)
            .select('email, name, ad_account, ma_tkqc, ad_cost, revenue, tong_lead, tong_data_nhan, mess_comment_count, order_count')
            .gte('report_date', start)
            .lte('report_date', end)
            .limit(12000)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    ]);

    if (teamKpiRes.error) {
      console.warn('leader-dash team kpi:', teamKpiRes.error);
    }
    const tv = teamKpiRes.data?.muc_tieu_doanh_thu_team;
    setTeamTargetVnd(tv != null && Number.isFinite(Number(tv)) ? Number(tv) : null);

    const stMap = new Map<string, number>();
    if (staffKpiRes.error) {
      console.warn('leader-dash staff kpi:', staffKpiRes.error);
    } else {
      for (const r of staffKpiRes.data || []) {
        const v = Number(r.muc_tieu_vnd);
        if (Number.isFinite(v) && v > 0) stMap.set(r.employee_id, v);
      }
    }
    setStaffTargets(stMap);

    const emailSet = new Set(emails);
    const next = new Map<string, Agg>();

    if (repRes.error) {
      console.error('leader-dash detail_reports:', repRes.error);
      setError(repRes.error.message || 'Không tải detail_reports.');
      setMembers(teamList);
      setByEmail(new Map());
      setLoading(false);
      return;
    }

    for (const row of repRes.data || []) {
      const em = String(row.email || '')
        .trim()
        .toLowerCase();
      if (!em || !emailSet.has(em)) continue;

      const a = next.get(em) || emptyAgg();
      a.rev += Number(row.revenue) || 0;
      a.ads += Number(row.ad_cost) || 0;
      a.tongLead += Number(row.tong_lead) || 0;
      a.tongData += Number(row.tong_data_nhan) || 0;
      a.mess += Number(row.mess_comment_count) || 0;
      a.orders += Number(row.order_count) || 0;
      const acc = String(row.ad_account || '').trim();
      const mq = String(row.ma_tkqc || '').trim();
      if (acc) a.accounts.add(acc);
      if (mq) a.accounts.add(mq);
      next.set(em, a);
    }

    setMembers(teamList);
    setByEmail(next);
    setLoading(false);
  }, [viewer?.email, viewer?.team, start, end, ym]);

  useEffect(() => {
    void load();
  }, [load]);

  const aggForMember = useCallback(
    (m: Employee): Agg => {
      const e = m.email?.trim().toLowerCase();
      if (e && byEmail.has(e)) {
        const x = byEmail.get(e);
        if (x) return x;
      }
      return emptyAgg();
    },
    [byEmail]
  );

  const tableRows = useMemo(() => {
    const rows = members.map((m) => {
      const a = aggForMember(m);
      const pct = adsDtPct(a.ads, a.rev);
      const lc = leadCount(a);
      const chot = tyLeChot(a.tongData, a.tongLead, a.orders);
      const aov = a.orders > 0 ? a.rev / a.orders : 0;
      const cpo = a.orders > 0 ? a.ads / a.orders : 0;
      const cpl = lc > 0 ? a.ads / lc : 0;
      const cpa = a.tongData > 0 ? a.ads / a.tongData : 0;
      const acctLine = [...a.accounts].slice(0, 6).join(', ') || '—';
      return { m, a, pct, lc, chot, aov, cpo, cpl, cpa, acctLine };
    });
    rows.sort((x, y) => y.a.rev - x.a.rev);
    return rows;
  }, [members, aggForMember]);

  const teamTotals = useMemo(() => {
    let rev = 0;
    let ads = 0;
    let leads = 0;
    let data = 0;
    let orders = 0;
    for (const { a } of tableRows) {
      rev += a.rev;
      ads += a.ads;
      orders += a.orders;
      data += a.tongData;
      leads += leadCount(a);
    }
    return { rev, ads, leads, data, orders };
  }, [tableRows]);

  const adsTeamPct = adsDtPct(teamTotals.ads, teamTotals.rev);
  const kpiPctTeam =
    teamTargetVnd != null && teamTargetVnd > 0 ? Math.min(999, (teamTotals.rev / teamTargetVnd) * 100) : null;

  const mktActive = useMemo(
    () => tableRows.filter((r) => r.a.rev > 0 || r.a.ads > 0 || r.a.orders > 0).length,
    [tableRows]
  );

  const needsAttention = useMemo(() => {
    const hi = tableRows.filter((r) => r.pct != null && r.pct > 35);
    return hi;
  }, [tableRows]);

  const firstAlertName = needsAttention[0]?.m.name || '—';

  const kpiLeadDen = teamTotals.leads > 0 ? teamTotals.leads : teamTotals.data;
  const cplTeam = kpiLeadDen > 0 ? teamTotals.ads / kpiLeadDen : 0;
  const chotTeam = tyLeChot(teamTotals.data, teamTotals.leads, teamTotals.orders);

  if (!viewer?.email) {
    return (
      <div className="dash-fade-up p-6 text-[12px] text-[var(--text3)] font-bold">
        Đăng nhập CRM để xem dashboard leader (theo team trên tài khoản).
      </div>
    );
  }

  return (
    <div className="dash-fade-up">
      {error && (
        <div className="mb-3 text-[11px] font-bold text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[8px] px-3 py-2 bg-[var(--Rd)]/20">
          {error}
        </div>
      )}

      {!teamName ? (
        <div className="mb-3 text-[11px] text-[var(--Y)] font-bold border border-[var(--Y)]/30 rounded-[8px] px-3 py-2 bg-[var(--Yd)]/15">
          Tài khoản chưa có <code className="text-[10px]">team</code> — cập nhật tại{' '}
          <code className="text-[10px]">/crm-admin/staff</code> hoặc đăng nhập nhân sự gán team.
        </div>
      ) : null}

      <div className="flex items-center justify-end mb-[10px]">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold border border-[rgba(255,255,255,0.08)] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {loading && members.length === 0 && !teamName ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--text3)]">
          <Loader2 className="animate-spin" size={22} />
          Đang tải…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[10px] mb-[14px]">
            <KpiCard
              label={`DT ${teamName || 'Team'}`}
              value={formatCompactVnd(teamTotals.rev) === '—' ? '0' : formatCompactVnd(teamTotals.rev)}
              sub={
                teamTargetVnd != null && teamTargetVnd > 0
                  ? `Mục tiêu: ${formatKpiMoney(teamTargetVnd)}`
                  : 'Chưa gán KPI team'
              }
              delta={kpiPctTeam != null ? `${kpiPctTeam.toFixed(0)}% KPI` : '—'}
              deltaType={kpiPctTeam != null && kpiPctTeam >= 85 ? 'up' : kpiPctTeam != null && kpiPctTeam >= 50 ? 'nt' : 'dn'}
              barColor="var(--G)"
              animationDelay={0.03}
              valueSize="xl"
            />
            <KpiCard
              label="CHI PHÍ ADS"
              value={formatCompactVnd(teamTotals.ads) === '—' ? '0' : formatCompactVnd(teamTotals.ads)}
              sub={adsTeamPct != null ? `Ads/DT: ${adsTeamPct.toFixed(1)}%` : '—'}
              delta={adsTeamPct != null && adsTeamPct < 35 ? 'An toàn' : 'Theo dõi'}
              deltaType="nt"
              barColor="var(--accent)"
              animationDelay={0.05}
              valueSize="xl"
            />
            <KpiCard
              label="TỔNG LEAD"
              value={kpiLeadDen > 0 ? `${Math.round(kpiLeadDen).toLocaleString('vi-VN')}` : '0'}
              sub={cplTeam > 0 ? `CPL: ${formatKpiMoney(cplTeam)}` : '—'}
              delta="Tháng này"
              deltaType="up"
              barColor="var(--P)"
              animationDelay={0.07}
              valueSize="xl"
            />
            <KpiCard
              label="ĐƠN CHỐT"
              value={teamTotals.orders > 0 ? `${teamTotals.orders.toLocaleString('vi-VN')}` : '0'}
              sub={chotTeam != null ? `Tỷ lệ: ${chotTeam.toFixed(1)}%` : '—'}
              delta={teamTotals.orders > 0 ? `AOV: ${formatKpiMoney(teamTotals.rev / teamTotals.orders)}` : '—'}
              deltaType="up"
              barColor="var(--Y)"
              animationDelay={0.09}
              valueSize="xl"
            />
            <KpiCard
              label="MKT HOẠT ĐỘNG"
              value={`${mktActive}`}
              sub={teamName || 'Team'}
              delta="Có dữ liệu tháng"
              deltaType="nt"
              barColor="var(--G)"
              animationDelay={0.11}
              valueSize="xl"
            />
            <KpiCard
              label="CẦN XỬ LÝ"
              value={`${needsAttention.length}`}
              sub="Ads/DT > 35%"
              delta={firstAlertName}
              deltaType={needsAttention.length ? 'dn' : 'nt'}
              barColor="var(--R)"
              animationDelay={0.13}
              valueSize="xl"
              valueColor={needsAttention.length ? 'var(--R)' : undefined}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[14px]">
            <div className="lg:col-span-2">
              <SectionCard
                title={`📊 Hiệu suất Marketing — ${teamName || 'Team'}`}
                subtitle={`Tháng ${monthLabel} · ${members.length} thành viên · ${REPORTS_TABLE}`}
                bodyPadding={false}
              >
                <div className="overflow-x-auto">
                  {tableRows.length === 0 ? (
                    <div className="p-10 text-center text-[var(--text3)] text-[12px] font-bold">
                      {teamName ? 'Không có nhân sự hoạt động trong team.' : 'Thiếu team trên tài khoản.'}
                    </div>
                  ) : (
                    <table className="w-full border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                          <th className="p-[7px_12px] text-center">#</th>
                          <th className="p-[7px_12px]">Marketing</th>
                          <th className="p-[7px_12px] text-right">Doanh số</th>
                          <th className="p-[7px_12px] text-right">Ads</th>
                          <th className="p-[7px_12px] text-right">Ads/DT</th>
                          <th className="p-[7px_12px] text-right">Lead</th>
                          <th className="p-[7px_12px] text-right">Đơn</th>
                          <th className="p-[7px_12px] text-right">Chốt%</th>
                          <th className="p-[7px_12px] text-right">AOV</th>
                          <th className="p-[7px_12px] text-right">CPO</th>
                          <th className="p-[7px_12px] text-right">CPL</th>
                          <th className="p-[7px_12px] text-right">$/Data</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11.5px] text-[var(--text2)]">
                        {tableRows.map((row, idx) => {
                          const { m, a, pct, lc, chot, aov, cpo, cpl, cpa, acctLine } = row;
                          const critical = pct != null && pct > 45;
                          const rankDisplay =
                            idx === 0 && a.rev > 0 ? (
                              <span className="font-[var(--mono)] text-[var(--gold)] font-bold">1</span>
                            ) : critical ? (
                              <span className="font-[var(--mono)] text-[var(--R)] font-bold">!</span>
                            ) : (
                              <span className="font-[var(--mono)] text-[var(--text3)] font-bold">{idx + 1}</span>
                            );
                          const heat = pct != null ? heatBadgeClass(pct) : null;
                          const trCls = critical
                            ? 'bg-[rgba(224,61,61,0.05)] border-b border-[rgba(224,61,61,0.1)] hover:bg-[rgba(224,61,61,0.08)]'
                            : 'border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]';
                          return (
                            <tr key={m.id} className={`${trCls} transition-colors`}>
                              <td className="p-[9px_12px] text-center">{rankDisplay}</td>
                              <td className="p-[9px_12px]">
                                <div className={`font-bold ${critical ? 'text-[var(--Y)]' : 'text-[var(--text)]'}`}>{m.name}</div>
                                <div className="text-[10px] text-[var(--text3)] truncate max-w-[200px]" title={acctLine}>
                                  {acctLine}
                                </div>
                              </td>
                              <td className="p-[9px_12px] text-right text-[var(--G)] font-bold">{formatCompactVnd(a.rev)}</td>
                              <td className="p-[9px_12px] text-right">{formatCompactVnd(a.ads)}</td>
                              <td className="p-[9px_12px] text-right">
                                {heat ? (
                                  <span className={`p-[2px_7px] rounded-[4px] text-[9.5px] font-bold ${heat.cls}`}>{heat.label}</span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="p-[9px_12px] text-right">{lc > 0 ? lc.toLocaleString('vi-VN') : '—'}</td>
                              <td className="p-[9px_12px] text-right">{a.orders > 0 ? a.orders.toLocaleString('vi-VN') : '—'}</td>
                              <td className={`p-[9px_12px] text-right ${chot != null && chot >= 20 ? 'text-[var(--G)]' : ''}`}>
                                {chot != null ? `${chot.toFixed(1)}%` : '—'}
                              </td>
                              <td className="p-[9px_12px] text-right">{aov > 0 ? formatKpiMoney(aov) : '—'}</td>
                              <td className="p-[9px_12px] text-right">{cpo > 0 ? formatCompactVnd(cpo) : '—'}</td>
                              <td className="p-[9px_12px] text-right">{cpl > 0 ? formatCompactVnd(cpl) : '—'}</td>
                              <td className="p-[9px_12px] text-right">{cpa > 0 ? formatCompactVnd(cpa) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </SectionCard>
            </div>
            <div>
              <SectionCard title="🎯 Tiến độ KPI tháng" subtitle={`${KPI_STAFF_TABLE} · ${ym}`}>
                {tableRows.length === 0 ? (
                  <div className="text-[11px] text-[var(--text3)] py-4">Chưa có nhân sự để hiển thị KPI.</div>
                ) : (
                  tableRows.map(({ m, a }) => {
                    const tgt = staffTargets.get(m.id);
                    const pct = tgt != null && tgt > 0 ? Math.min(100, (a.rev / tgt) * 100) : 0;
                    const hasT = tgt != null && tgt > 0;
                    const valueText = `${formatCompactVnd(a.rev) === '—' ? '0' : formatCompactVnd(a.rev)} / ${hasT ? formatKpiMoney(tgt) : 'chưa gán'}`;
                    return (
                      <ProgressRow
                        key={m.id}
                        label={`${m.name}${m.trang_thai === 'dot_tien' ? ' ⚠' : ''}`}
                        valueText={valueText}
                        percent={hasT ? pct : 0}
                        color={!hasT ? 'var(--text3)' : pct >= 85 ? 'var(--G)' : pct >= 50 ? 'var(--accent)' : 'var(--R)'}
                        subLabel={hasT ? `${pct.toFixed(1)}%` : '—'}
                      />
                    );
                  })
                )}
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
