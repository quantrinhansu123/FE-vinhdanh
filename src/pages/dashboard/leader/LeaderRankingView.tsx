import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard, RankItem, ProgressRow, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { AuthUser, Employee } from '../../../types';
import { REPORTS_TABLE, formatCompactVnd, formatKpiMoney } from '../mkt/mktDetailReportShared';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const KPI_TEAM_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_TEAM_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_team_monthly_targets';
const KPI_STAFF_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_STAFF_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_staff_monthly_targets';

const STAFF_SELECT = 'id, name, email, team, ma_ns, vi_tri, trang_thai';

function ymNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRangeLocal(ym: string): { start: string; end: string } {
  const [ys, ms] = ym.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const mm = String(m).padStart(2, '0');
  const last = new Date(y, m, 0).getDate();
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

function isActiveStaff(tt: string | null | undefined): boolean {
  return tt === 'dang_lam' || tt === 'tam_nghi' || tt === 'dot_tien';
}

function adsDtPct(ads: number, rev: number): number | null {
  if (!Number.isFinite(ads) || !Number.isFinite(rev) || rev <= 0) return null;
  return (ads / rev) * 100;
}

function heatBadgeType(pct: number | null): 'G' | 'Y' | 'R' | undefined {
  if (pct == null || !Number.isFinite(pct)) return undefined;
  if (pct < 30) return 'G';
  if (pct <= 45) return 'Y';
  return 'R';
}

function abbrFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts.slice(0, 2).map((p) => (p[0] || '').toUpperCase());
  const s = a.join('');
  return s || name.trim().slice(0, 2).toUpperCase() || '—';
}

function emptyNumber(): number {
  return 0;
}

type Agg = {
  email: string;
  name: string;
  rev: number;
  ads: number;
  tongLead: number;
  tongData: number;
  mess: number;
  orders: number;
  accounts: Set<string>;
};

function makeEmptyAgg(email: string, name: string): Agg {
  return {
    email,
    name,
    rev: emptyNumber(),
    ads: emptyNumber(),
    tongLead: emptyNumber(),
    tongData: emptyNumber(),
    mess: emptyNumber(),
    orders: emptyNumber(),
    accounts: new Set<string>(),
  };
}

export type LeaderRankingViewProps = {
  viewer?: AuthUser | null;
};

export const LeaderRankingView: React.FC<LeaderRankingViewProps> = ({ viewer = null }) => {
  const ym = ymNow();
  const { start, end } = monthRangeLocal(ym);
  const monthLabel = useMemo(() => {
    const [, m] = ym.split('-');
    return `Tháng ${Number(m)}`;
  }, [ym]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teamKey, setTeamKey] = useState('');
  const [members, setMembers] = useState<Employee[]>([]);
  const [staffTargets, setStaffTargets] = useState<Map<string, number>>(() => new Map());
  const [teamTargetVnd, setTeamTargetVnd] = useState<number | null>(null);

  const [aggByEmail, setAggByEmail] = useState<Map<string, Agg>>(() => new Map());

  const load = useCallback(async () => {
    const viewerTeam = viewer?.team?.trim() || '';
    const viewerEmail = viewer?.email?.trim().toLowerCase() || '';
    setTeamKey(viewerTeam);

    if (!viewerEmail) {
      setMembers([]);
      setAggByEmail(new Map());
      setStaffTargets(new Map());
      setTeamTargetVnd(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const empRes = await supabase.from(EMPLOYEES_TABLE).select(STAFF_SELECT).order('name', { ascending: true });
    if (empRes.error) {
      console.error('leader-rank employees:', empRes.error);
      setError(empRes.error.message || 'Không tải được nhân sự.');
      setMembers([]);
      setAggByEmail(new Map());
      setStaffTargets(new Map());
      setTeamTargetVnd(null);
      setLoading(false);
      return;
    }

    const all = (empRes.data || []) as Employee[];
    const teamMembers = viewerTeam ? all.filter((e) => e.team?.trim() === viewerTeam && isActiveStaff(e.trang_thai)) : [];
    setMembers(teamMembers);

    const emailSet = new Set<string>(
      teamMembers.map((m) => String(m.email || '').trim().toLowerCase()).filter(Boolean),
    );

    const ids = teamMembers.map((m) => m.id);

    const [teamKpiRes, staffKpiRes, repRes] = await Promise.all([
      viewerTeam
        ? supabase
            .from(KPI_TEAM_TABLE)
            .select('muc_tieu_doanh_thu_team')
            .eq('nam_thang', ym)
            .eq('team_key', viewerTeam)
            .maybeSingle()
        : Promise.resolve({ data: null as { muc_tieu_doanh_thu_team?: number } | null, error: null }),

      ids.length
        ? supabase
            .from(KPI_STAFF_TABLE)
            .select('employee_id, muc_tieu_vnd')
            .eq('nam_thang', ym)
            .in('employee_id', ids)
        : Promise.resolve({ data: [] as { employee_id: string; muc_tieu_vnd: number }[], error: null }),

      emailSet.size
        ? supabase
            .from(REPORTS_TABLE)
            .select('email, name, ad_account, ma_tkqc, ad_cost, revenue, tong_lead, tong_data_nhan, mess_comment_count, order_count')
            .gte('report_date', start)
            .lte('report_date', end)
            .limit(15000)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    ]);

    if (teamKpiRes.error) console.warn('leader-rank team kpi:', teamKpiRes.error);
    const tv = teamKpiRes.data?.muc_tieu_doanh_thu_team;
    setTeamTargetVnd(tv != null && Number.isFinite(Number(tv)) ? Number(tv) : null);

    if (staffKpiRes.error) console.warn('leader-rank staff kpi:', staffKpiRes.error);
    const st = new Map<string, number>();
    for (const r of staffKpiRes.data || []) {
      const n = Number(r.muc_tieu_vnd);
      if (Number.isFinite(n) && n > 0) st.set(String(r.employee_id), n);
    }
    setStaffTargets(st);

    if (repRes.error) {
      console.error('leader-rank detail_reports:', repRes.error);
      setError(repRes.error.message || 'Không tải được detail_reports.');
      setAggByEmail(new Map());
      setLoading(false);
      return;
    }

    const next = new Map<string, Agg>();
    for (const row of repRes.data || []) {
      const email = String(row.email || '')
        .trim()
        .toLowerCase();
      if (!emailSet.has(email)) continue;
      const name = String(row.name || '').trim();

      const a = next.get(email) || makeEmptyAgg(email, name || email);
      a.rev += Number(row.revenue) || 0;
      a.ads += Number(row.ad_cost) || 0;
      a.tongLead += Number(row.tong_lead) || 0;
      a.tongData += Number(row.tong_data_nhan) || 0;
      a.mess += Number(row.mess_comment_count) || 0;
      a.orders += Number(row.order_count) || 0;
      const acc1 = String(row.ad_account || '').trim();
      const acc2 = String(row.ma_tkqc || '').trim();
      if (acc1) a.accounts.add(acc1);
      if (acc2) a.accounts.add(acc2);
      next.set(email, a);
    }

    setAggByEmail(next);
    setLoading(false);
  }, [viewer, start, end, ym]);

  useEffect(() => {
    void load();
  }, [load]);

  const computed = useMemo(() => {
    const byEmployee = members.map((m) => {
      const em = String(m.email || '').trim().toLowerCase();
      const a = em && aggByEmail.has(em) ? (aggByEmail.get(em) as Agg) : makeEmptyAgg(em, m.name || em || m.id);
      const target = staffTargets.get(m.id);
      const kpiPct = target && target > 0 ? (a.rev / target) * 100 : null;
      const pctAds = adsDtPct(a.ads, a.rev);
      return {
        member: m,
        agg: a,
        target,
        kpiPct,
        pctAds,
      };
    });

    byEmployee.sort((x, y) => {
      const kx = x.kpiPct ?? -1;
      const ky = y.kpiPct ?? -1;
      if (ky !== kx) return ky - kx;
      return y.agg.rev - x.agg.rev;
    });

    const top = byEmployee.slice(0, 3);
    const sortedByAds = [...byEmployee].filter((x) => x.pctAds != null).sort((a, b) => (b.pctAds as number) - (a.pctAds as number));
    const risk = sortedByAds[0] || null;

    const critical = risk && (risk.pctAds as number) >= 45;
    const riskType: 'G' | 'Y' | 'R' = critical ? 'R' : (risk ? 'Y' : 'G');

    let advisor = '';
    if (risk) {
      const adsCostText = formatKpiMoney(risk.agg.ads);
      const adsShare = (risk.pctAds as number).toFixed(1);
      const firstAcc = [...risk.agg.accounts][0] || '—';
      advisor = `⚠️ ${risk.member.name}: Chi phí Ads ${adsCostText} chiếm ${adsShare}% doanh số (Ads/DT). Cân nhắc tối ưu hoặc tạm dừng các chiến dịch kém hiệu quả (ví dụ: ${firstAcc}).`;
    }

    const teamPerf =
      teamTargetVnd != null && teamTargetVnd > 0
        ? byEmployee.reduce((s, r) => s + r.agg.rev, 0) / teamTargetVnd
        : null;
    const teamBadgeType: 'G' | 'Y' | 'R' =
      teamPerf == null ? 'G' : teamPerf >= 1 ? 'G' : teamPerf >= 0.7 ? 'Y' : 'R';

    return { top, risk, riskType, advisor, byEmployee, teamBadgeType };
  }, [members, aggByEmail, staffTargets, teamTargetVnd]);

  if (!viewer?.email) {
    return (
      <div className="dash-fade-up p-6 text-[12px] text-[var(--text3)] font-bold">
        Đăng nhập CRM để xem xếp hạng leader (theo team trên tài khoản).
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px]">
        <SectionCard title={`🏆 Xếp hạng Marketing — ${teamKey || 'Team'}`} badge={{ text: monthLabel, type: computed.teamBadgeType }}>
          {loading && computed.byEmployee.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-14 text-[var(--text3)] text-[12px]">
              <Loader2 className="animate-spin" size={20} />
              Đang tải…
            </div>
          ) : computed.top.length === 0 ? (
            <div className="text-[11px] text-[var(--text3)] py-6">
              Chưa có dữ liệu xếp hạng trong tháng này.
              {teamKey ? null : (
                <>
                  {' '}Cập nhật <code className="text-[var(--text2)]">team</code> của tài khoản để hiển thị.
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              {computed.top.map((x, idx) => {
                const pctAds = x.pctAds;
                const badgeType = heatBadgeType(pctAds);
                const badgeText = pctAds != null ? `${pctAds.toFixed(1)}% Ads` : undefined;
                const accShort = [...x.agg.accounts].slice(0, 4).join(', ') || '—';
                const kpiPctText = x.kpiPct != null ? `KPI ${x.kpiPct.toFixed(1)}%` : 'KPI —';
                const valueText = x.agg.rev > 0 ? formatKpiMoney(x.agg.rev) : '—';
                const rankColor = idx === 0 ? 'var(--gold)' : undefined;
                const valueColor = idx === 0 ? 'var(--G)' : undefined;
                return (
                  <RankItem
                    key={x.member.id}
                    rank={String(idx + 1).padStart(2, '0')}
                    avatar={abbrFromName(x.member.name || x.member.id)}
                    name={x.member.name}
                    team={`${accShort} · ${(x.member.vi_tri || x.member.ma_ns || '').toString().trim() || '—'} · ${kpiPctText}`}
                    value={valueText}
                    badgeText={badgeText}
                    badgeType={badgeType}
                    rankColor={rankColor}
                    valueColor={valueColor}
                    avatarBg={undefined}
                  />
                );
              })}
            </div>
          )}
        </SectionCard>

        <div className="space-y-[14px]">
          <SectionCard title="🔥 Cảnh báo hiệu suất" badge={{ text: computed.risk ? 'Critical' : 'OK', type: computed.riskType }}>
            {computed.risk ? (
              <>
                <div className="flex flex-col mb-[10px]">
                  {(() => {
                    const pctAds = computed.risk.pctAds as number | null;
                    const adsText = pctAds != null ? `${pctAds.toFixed(1)}%` : '—';
                    const badgeText = pctAds != null ? (computed.riskType === 'R' ? '🔴 High Risk' : '🟡 Moderate') : undefined;
                    const badgeType = computed.riskType === 'R' ? 'R' : 'Y';
                    const rankColor = computed.riskType === 'R' ? 'var(--R)' : undefined;
                    const nameColor = computed.riskType === 'R' ? 'var(--Y)' : undefined;
                    const valueColor = computed.riskType === 'R' ? 'var(--R)' : undefined;
                    return (
                      <RankItem
                        rank="!"
                        avatar={abbrFromName(computed.risk.member.name)}
                        name={computed.risk.member.name}
                        team={`Burn: ${pctAds!.toFixed(1)}% · ${[...computed.risk.agg.accounts][0] || '—'} · ${
                          computed.risk.kpiPct != null ? `KPI ${computed.risk.kpiPct.toFixed(1)}%` : 'KPI —'
                        }`}
                        value={adsText}
                        badgeText={badgeText}
                        badgeType={badgeType}
                        rankColor={rankColor}
                        nameColor={nameColor}
                        valueColor={valueColor}
                      />
                    );
                  })()}
                </div>
                <div className="pt-[14px] border-t border-[var(--border)]">
                  <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-[1.5px] mb-[12px]">Cố vấn hành động</div>
                  <div className="bg-[rgba(224,61,61,0.08)] border border-[rgba(224,61,61,0.15)] rounded-[8px] p-[10px] text-[10.5px] text-[var(--R)] font-medium leading-[1.6]">
                    {computed.advisor}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[11px] text-[var(--text3)] py-6">
                Chưa có cảnh báo trong tháng này (Ads/DT chưa đạt ngưỡng).
              </div>
            )}
          </SectionCard>

          <SectionCard title="🎯 Tiêu chí xếp hạng Team">
            <div className="space-y-[12px]">
              <ProgressRow label="Doanh số (KPI)" valueText="40%" percent={40} color="var(--G)" subLabel="Trọng số cao nhất" />
              <ProgressRow label="Tỷ lệ Ads/DT (<20%)" valueText="30%" percent={30} color="var(--accent)" />
              <ProgressRow label="Tỷ lệ chốt Lead" valueText="20%" percent={20} color="var(--P)" />
              <ProgressRow label="Số lượng lead mới" valueText="10%" percent={10} color="var(--Y)" />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
