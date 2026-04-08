import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../api/supabase';
import type { AuthUser, Employee } from '../../../types';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';
import { formatCompactVnd, formatKpiMoney, toLocalYyyyMmDd } from '../mkt/mktDetailReportShared';

/** Hiệu suất Marketing (leader): luôn lấy từ bảng này, không dùng VITE_SUPABASE_REPORTS_TABLE */
const DETAIL_REPORTS_TABLE = 'detail_reports';

/** Lấy theo lô + keyset `id > lastId` để không bị trần một lần query */
const DETAIL_REPORTS_PAGE_SIZE = 1000;
/** Tối đa số lô (1000 × 500 = 500k dòng/tháng) */
const DETAIL_REPORT_MAX_PAGES = 500;

const LEADER_DETAIL_REPORTS_SELECT =
  'id, email, name, code, ad_account, ma_tkqc, ad_cost, revenue, tien_viet, tong_lead, tong_data_nhan, mess_comment_count, order_count';

async function fetchAllLeaderDetailReportsForRange(
  start: string,
  end: string
): Promise<{ data: Record<string, unknown>[]; error: { message: string } | null }> {
  const all: Record<string, unknown>[] = [];
  let lastId: string | null = null;
  for (let p = 0; p < DETAIL_REPORT_MAX_PAGES; p++) {
    let q = supabase
      .from(DETAIL_REPORTS_TABLE)
      .select(LEADER_DETAIL_REPORTS_SELECT)
      .gte('report_date', start)
      .lte('report_date', end)
      .order('id', { ascending: true })
      .limit(DETAIL_REPORTS_PAGE_SIZE);
    if (lastId) q = q.gt('id', lastId);
    const { data, error } = await q;
    if (error) return { data: [], error };
    const batch = data || [];
    if (batch.length === 0) break;
    all.push(...batch);
    const raw = batch[batch.length - 1]?.id;
    const next = raw == null ? '' : String(raw);
    if (!next) break;
    lastId = next;
    if (batch.length < DETAIL_REPORTS_PAGE_SIZE) break;
  }
  return { data: all, error: null };
}

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';
const KPI_TEAM_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_TEAM_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_team_monthly_targets';
const KPI_STAFF_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_STAFF_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_staff_monthly_targets';

/** CPA (VND) ngưỡng cảnh báo (90M — quy ước tiền trong báo cáo nội bộ) */
const CPA_ALERT_THRESHOLD_VND = 90_000_000;

const STAFF_SELECT = 'id, name, email, team, ma_ns, vi_tri, trang_thai, avatar_url';

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

function safeTrim(v: unknown): string {
  return String(v ?? '').trim();
}

/** Tên hiển thị kèm mã (ma_ns / code — khớp cột `code` trong detail_reports khi gộp số liệu) */
function mktNameWithCode(m: Employee): string {
  const name = safeTrim(m.name) || '—';
  const code = safeTrim(m.ma_ns) || safeTrim(m.code);
  if (!code) return name;
  return `${name} · ${code}`;
}

/** Giống admin-dash: tiền từ detail_reports (chuỗi có dấu phẩy / khoảng trắng) */
function safeNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/[\$,]/g, '').replace(/\s+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Doanh thu VND từ detail_reports — cùng quy tắc AdminDashboardView */
function reportRevenueVnd(row: { tien_viet?: unknown; revenue?: unknown }): number {
  return row.tien_viet != null ? safeNum(row.tien_viet) : Math.round(safeNum(row.revenue) * 25000);
}

function adsDtPct(ads: number, rev: number): number | null {
  if (!Number.isFinite(ads) || !Number.isFinite(rev) || rev <= 0) return null;
  return (ads / rev) * 100;
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

function cpdtPillClass(pct: number): string {
  if (pct < 30) return 'bg-[color-mix(in_srgb,var(--ld-secondary-container)_10%,transparent)] text-[var(--ld-secondary)]';
  if (pct <= 45) return 'bg-[color-mix(in_srgb,var(--ld-tertiary-container)_10%,transparent)] text-[var(--ld-tertiary)]';
  return 'bg-[color-mix(in_srgb,var(--ld-error-container)_10%,transparent)] text-[var(--ld-error)]';
}

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

const StaffAvatar: React.FC<{ member: Employee }> = ({ member }) => {
  const [imgErr, setImgErr] = useState(false);
  const url = member.avatar_url?.trim();
  if (!url || imgErr) {
    return (
      <div className="w-8 h-8 rounded-full border border-[var(--ld-primary)]/20 bg-[var(--ld-surface-container-highest)] flex items-center justify-center text-[11px] font-bold text-[var(--ld-on-surface)]">
        {(member.name || '?').charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      alt=""
      src={url}
      className="w-8 h-8 rounded-full border border-[var(--ld-primary)]/20 object-cover"
      onError={() => setImgErr(true)}
    />
  );
};

type DeltaKind = 'up' | 'down' | 'stable' | 'high' | 'neutral';

const ObsidianKpiCard: React.FC<{
  label: string;
  value: string;
  deltaKind: DeltaKind;
  deltaText: string;
  icon: string;
  valueEmphasis?: 'error';
}> = ({ label, value, deltaKind, deltaText, icon, valueEmphasis }) => {
  const deltaRing: Record<DeltaKind, string> = {
    up: 'text-[var(--ld-secondary)] bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)]',
    down: 'text-[var(--ld-error)] bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)]',
    stable: 'text-[var(--ld-tertiary)] bg-[color-mix(in_srgb,var(--ld-tertiary)_10%,transparent)]',
    high: 'text-[var(--ld-error)] bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)]',
    neutral: 'text-[var(--ld-on-surface-variant)] bg-[color-mix(in_srgb,var(--ld-on-surface-variant)_8%,transparent)]',
  };
  return (
    <div className="bg-[var(--ld-surface-container-low)] p-4 rounded-xl transition-all hover:bg-[var(--ld-surface-container-high)] border border-[var(--ld-outline-variant)]/10">
      <p className="leader-dash-label text-[10px] uppercase tracking-widest text-[var(--ld-on-surface-variant)] mb-1">
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p
          className={`text-2xl font-bold ${valueEmphasis === 'error' ? 'text-[var(--ld-error)]' : 'text-[var(--ld-on-surface)]'}`}
        >
          {value}
        </p>
        <span
          className={`text-[10px] font-bold shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${deltaRing[deltaKind]}`}
        >
          {deltaText}
          <span className="material-symbols-outlined text-[10px] leading-none" style={{ fontSize: '10px' }}>
            {icon}
          </span>
        </span>
      </div>
    </div>
  );
};

export const LeaderDashboardView: React.FC<LeaderDashboardViewProps> = ({ viewer = null }) => {
  const navigate = useNavigate();
  const [selectedYm, setSelectedYm] = useState<string>(() => ymNow());
  const { start, end } = monthRangeLocal(selectedYm);
  const monthLabel = useMemo(() => {
    const [y, m] = selectedYm.split('-');
    return `${m}/${y}`;
  }, [selectedYm]);
  const currentYm = ymNow();
  const isViewingCurrentMonth = selectedYm === currentYm;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<Employee[]>([]);
  const [byEmail, setByEmail] = useState<Map<string, Agg>>(() => new Map());
  const [teamTargetVnd, setTeamTargetVnd] = useState<number | null>(null);
  const [staffTargets, setStaffTargets] = useState<Map<string, number>>(() => new Map());
  const [filterHighCpdt, setFilterHighCpdt] = useState(false);

  const load = useCallback(async () => {
    const fallbackTeam = viewer?.team?.trim() || '';
    const viewerName = viewer?.name?.trim() || '';

    if (!viewer?.email) {
      setTeamName('');
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

    const isAdminViewer = viewer?.role === 'admin';

    let teamKeys: string[] = [];
    if (!isAdminViewer && viewerName) {
      const teamRes = await supabase.from(TEAMS_TABLE).select('ten_team, leader').eq('leader', viewerName);
      if (!teamRes.error) {
        teamKeys = (teamRes.data || [])
          .map((r) => safeTrim((r as { ten_team?: string }).ten_team))
          .filter(Boolean);
      } else {
        console.warn('leader-dash crm_teams:', teamRes.error);
      }
    }
    if (!isAdminViewer && !teamKeys.length && fallbackTeam) teamKeys = [fallbackTeam];
    teamKeys = [...new Set(teamKeys.map((x) => x.trim()).filter(Boolean))];

    const teamLabel = isAdminViewer
      ? 'Toàn bộ nhân sự (admin)'
      : teamKeys.length
        ? teamKeys.join(' · ')
        : fallbackTeam;
    setTeamName(teamLabel);

    const empRes = await supabase.from(EMPLOYEES_TABLE).select(STAFF_SELECT).order('name', { ascending: true });
    if (empRes.error) {
      console.error('leader-dash employees:', empRes.error);
      setError(empRes.error.message || 'Không tải được nhân sự.');
      setLoading(false);
      return;
    }

    const all = (empRes.data || []) as Employee[];
    const teamList = isAdminViewer
      ? all.filter((e) => isActiveStaff(e.trang_thai))
      : teamKeys.length
        ? all.filter((e) => teamKeys.includes(safeTrim(e.team)) && isActiveStaff(e.trang_thai))
        : [];

    const emails = [
      ...new Set(
        teamList
          .map((e) => e.email?.trim().toLowerCase())
          .filter((x): x is string => Boolean(x))
      ),
    ];

    /** detail_reports.code thường trùng employees.ma_ns (bảng employees không có cột code) */
    const codeKeyToEmail = new Map<string, string>();
    for (const e of teamList) {
      const em = e.email?.trim().toLowerCase();
      if (!em) continue;
      const k = safeTrim(e.ma_ns).toLowerCase();
      if (k) codeKeyToEmail.set(k, em);
    }

    const idList = teamList.map((e) => e.id);

    const kpiTeamKeyList = isAdminViewer
      ? [...new Set(teamList.map((e) => safeTrim(e.team)).filter(Boolean))]
      : teamKeys;

    const teamKpiPromise =
      kpiTeamKeyList.length > 0
        ? supabase
            .from(KPI_TEAM_TABLE)
            .select('muc_tieu_doanh_thu_team, team_key')
            .eq('nam_thang', selectedYm)
            .in('team_key', kpiTeamKeyList)
        : Promise.resolve({ data: [] as { muc_tieu_doanh_thu_team?: number; team_key?: string }[], error: null });

    const [teamKpiRes, staffKpiRes, repRes] = await Promise.all([
      teamKpiPromise,
      idList.length
        ? supabase
            .from(KPI_STAFF_TABLE)
            .select('employee_id, muc_tieu_vnd')
            .eq('nam_thang', selectedYm)
            .in('employee_id', idList)
        : Promise.resolve({ data: [] as { employee_id: string; muc_tieu_vnd: number }[], error: null }),
      emails.length ? fetchAllLeaderDetailReportsForRange(start, end) : Promise.resolve({ data: [], error: null }),
    ]);

    if (teamKpiRes.error) {
      console.warn('leader-dash team kpi:', teamKpiRes.error);
    }
    let tvSum = 0;
    for (const row of teamKpiRes.data || []) {
      const v = Number((row as { muc_tieu_doanh_thu_team?: number }).muc_tieu_doanh_thu_team);
      if (Number.isFinite(v) && v > 0) tvSum += v;
    }
    setTeamTargetVnd(tvSum > 0 ? tvSum : null);

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
      console.error(`leader-dash ${DETAIL_REPORTS_TABLE}:`, repRes.error);
      setError(repRes.error.message || `Không tải ${DETAIL_REPORTS_TABLE}.`);
      setMembers([]);
      setByEmail(new Map());
      setLoading(false);
      return;
    }

    /** Email nhân sự (canonical) đã có ≥1 dòng detail_reports khớp team trong kỳ — không lấy roster “trống” */
    const emailsWithDetailRows = new Set<string>();
    for (const row of repRes.data || []) {
      const em = String(row.email || '')
        .trim()
        .toLowerCase();
      const codeKey = String((row as { code?: string | null }).code || '')
        .trim()
        .toLowerCase();
      let target: string | null = null;
      // Ưu tiên code (detail_reports) khớp ma_ns nhân sự trong phạm vi team/admin
      if (codeKey && codeKeyToEmail.has(codeKey)) target = codeKeyToEmail.get(codeKey)!;
      else if (em && emailSet.has(em)) target = em;
      if (!target) continue;

      emailsWithDetailRows.add(target);
      const a = next.get(target) || emptyAgg();
      a.rev += reportRevenueVnd(row as { tien_viet?: unknown; revenue?: unknown });
      a.ads += safeNum((row as { ad_cost?: unknown }).ad_cost);
      a.tongLead += safeNum((row as { tong_lead?: unknown }).tong_lead);
      a.tongData += safeNum((row as { tong_data_nhan?: unknown }).tong_data_nhan);
      a.mess += safeNum((row as { mess_comment_count?: unknown }).mess_comment_count);
      a.orders += safeNum((row as { order_count?: unknown }).order_count);
      const acc = String((row as { ad_account?: string | null }).ad_account || '').trim();
      const mq = String((row as { ma_tkqc?: string | null }).ma_tkqc || '').trim();
      if (acc) a.accounts.add(acc);
      if (mq) a.accounts.add(mq);
      next.set(target, a);
    }

    // Cho phép aggForMember tra cứu theo ma_ns: cùng bucket với email
    for (const e of teamList) {
      const em = e.email?.trim().toLowerCase();
      const mns = safeTrim(e.ma_ns).toLowerCase();
      if (!em || !mns) continue;
      const bucket = next.get(em);
      if (bucket && !next.has(mns)) next.set(mns, bucket);
    }

    const membersFromDetail = teamList.filter((e) => {
      const em = e.email?.trim().toLowerCase();
      return Boolean(em && emailsWithDetailRows.has(em));
    });
    setMembers(membersFromDetail);
    setByEmail(next);
    setLoading(false);
  }, [viewer?.email, viewer?.team, viewer?.name, viewer?.role, start, end, selectedYm]);

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
      const mns = safeTrim(m.ma_ns).toLowerCase();
      if (mns && byEmail.has(mns)) {
        const x = byEmail.get(mns);
        if (x) return x;
      }
      return emptyAgg();
    },
    [byEmail]
  );

  const tableRows = useMemo(() => {
    const rows = members.map((m) => {
      const a = aggForMember(m);
      const cpdt = adsDtPct(a.ads, a.rev);
      const mess = a.mess;
      const lead = a.tongLead;
      const cpa = mess > 0 ? a.ads / mess : 0;
      const cpl = lead > 0 ? a.ads / lead : 0;
      const cpo = a.orders > 0 ? a.ads / a.orders : 0;
      const crPct = lead > 0 ? (a.orders / lead) * 100 : null;
      const aov = a.orders > 0 ? a.rev / a.orders : 0;
      const acctLine = [...a.accounts].slice(0, 6).join(', ') || '—';
      return { m, a, cpdt, mess, lead, cpa, cpl, cpo, crPct, aov, acctLine };
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
    return tableRows.filter((r) => r.cpdt != null && r.cpdt > 35);
  }, [tableRows]);

  const kpiLeadDen = teamTotals.leads > 0 ? teamTotals.leads : teamTotals.data;
  const cplTeam = kpiLeadDen > 0 ? teamTotals.ads / kpiLeadDen : 0;
  const chotTeam = tyLeChot(teamTotals.data, teamTotals.leads, teamTotals.orders);

  const displayRows = useMemo(() => {
    if (!filterHighCpdt) return tableRows;
    return tableRows.filter((r) => r.cpdt != null && r.cpdt > 35);
  }, [tableRows, filterHighCpdt]);

  const cpaAlertRow = useMemo(
    () => tableRows.find((r) => r.mess > 0 && r.cpa >= CPA_ALERT_THRESHOLD_VND),
    [tableRows]
  );

  const unassignedKpiCount = useMemo(
    () => tableRows.filter(({ m }) => !staffTargets.get(m.id)).length,
    [tableRows, staffTargets]
  );

  const exportCsv = useCallback(() => {
    const headers = [
      'STT',
      'Marketing',
      'Doanh số',
      'Chi phí',
      'CP/DT %',
      'Mess',
      'CPA',
      'Lead',
      'CPL',
      'Đơn',
      'CPO',
      '%CR',
      'AOV',
    ];
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...displayRows.map((row, idx) => {
        const { m, a, cpdt, mess, lead, cpa, cpl, cpo, crPct, aov } = row;
        const cells = [
          String(idx + 1),
          mktNameWithCode(m),
          String(a.rev),
          String(a.ads),
          cpdt != null ? cpdt.toFixed(2) : '',
          String(Math.round(mess)),
          String(Math.round(cpa)),
          String(Math.round(lead)),
          String(Math.round(cpl)),
          String(a.orders),
          String(Math.round(cpo)),
          crPct != null ? crPct.toFixed(2) : '',
          String(Math.round(aov)),
        ];
        return cells.map(escapeCsvCell).join(',');
      }),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leader-dash-${teamName.replace(/\s+/g, '_') || 'team'}-${selectedYm}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [displayRows, teamName, selectedYm]);

  if (!viewer?.email) {
    return (
      <div className="leader-dash-obsidian dash-fade-up p-6 text-[12px] text-[var(--ld-on-surface-variant)] font-semibold">
        Đăng nhập CRM để xem dashboard leader (theo team trên tài khoản).
      </div>
    );
  }

  const revStr = formatCompactVnd(teamTotals.rev) === '—' ? '0' : formatCompactVnd(teamTotals.rev);
  const adsStr = formatCompactVnd(teamTotals.ads) === '—' ? '0' : formatCompactVnd(teamTotals.ads);

  return (
    <div className="leader-dash-obsidian dash-fade-up text-[var(--ld-on-surface)] relative pb-20">
      {error && (
        <div className="mb-3 text-[11px] font-semibold text-[var(--ld-error)] border border-[var(--ld-error)]/25 rounded-lg px-3 py-2 bg-[color-mix(in_srgb,var(--ld-error)_12%,transparent)]">
          {error}
        </div>
      )}

      {!teamName && viewer?.role !== 'admin' ? (
        <div className="mb-3 text-[11px] text-[var(--ld-tertiary)] font-semibold border border-[var(--ld-tertiary)]/30 rounded-lg px-3 py-2 bg-[color-mix(in_srgb,var(--ld-tertiary)_10%,transparent)]">
          Không xác định được team: cần <code className="text-[10px]">tên Leader</code> khớp cột leader trong{' '}
          <code className="text-[10px]">crm_teams</code>, hoặc gán <code className="text-[10px]">team</code> trên nhân sự tại{' '}
          <code className="text-[10px]">/crm-admin/staff</code>.
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] leader-dash-label uppercase tracking-widest text-[var(--ld-on-surface-variant)]">
            Tháng báo cáo
          </span>
          <input
            type="month"
            value={selectedYm}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d{4}-\d{2}$/.test(v)) setSelectedYm(v);
            }}
            className="bg-[var(--ld-surface-container-highest)] border border-[var(--ld-outline-variant)]/40 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--ld-on-surface)] min-h-[34px] [color-scheme:dark]"
            aria-label="Chọn tháng lấy dữ liệu detail_reports"
          />
          {!isViewingCurrentMonth ? (
            <button
              type="button"
              onClick={() => setSelectedYm(ymNow())}
              className="text-[11px] font-semibold text-[var(--ld-primary)] hover:underline px-1"
            >
              Về tháng này
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 bg-[var(--ld-surface-container-highest)] hover:bg-[var(--ld-surface-bright)] text-[var(--ld-on-surface-variant)] py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border border-[var(--ld-outline-variant)]/40 disabled:opacity-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--ld-on-surface-variant)] text-[13px] font-semibold">
          <Loader2 className="animate-spin" size={22} />
          Đang tải dashboard…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <ObsidianKpiCard
              label={`DT ${teamName || 'Team'}`}
              value={revStr}
              deltaKind={
                kpiPctTeam == null ? 'neutral' : kpiPctTeam >= 85 ? 'up' : kpiPctTeam >= 50 ? 'stable' : 'down'
              }
              deltaText={kpiPctTeam != null ? `${kpiPctTeam.toFixed(0)}% KPI` : '—'}
              icon={kpiPctTeam != null && kpiPctTeam >= 85 ? 'trending_up' : kpiPctTeam != null && kpiPctTeam < 50 ? 'trending_down' : 'horizontal_rule'}
            />
            <ObsidianKpiCard
              label="Chi phí ADS"
              value={adsStr}
              deltaKind={adsTeamPct != null && adsTeamPct > 40 ? 'down' : adsTeamPct != null ? 'up' : 'neutral'}
              deltaText={adsTeamPct != null ? `${adsTeamPct.toFixed(1)}% CP/DT` : '—'}
              icon={adsTeamPct != null && adsTeamPct > 40 ? 'trending_down' : 'trending_up'}
            />
            <ObsidianKpiCard
              label="Tổng Lead"
              value={kpiLeadDen > 0 ? `${Math.round(kpiLeadDen).toLocaleString('vi-VN')}` : '0'}
              deltaKind={cplTeam > 0 ? 'up' : 'neutral'}
              deltaText={cplTeam > 0 ? `CPL ${formatKpiMoney(cplTeam)}` : '—'}
              icon="trending_up"
            />
            <ObsidianKpiCard
              label="Đơn chốt"
              value={teamTotals.orders > 0 ? `${teamTotals.orders.toLocaleString('vi-VN')}` : '0'}
              deltaKind={chotTeam != null && chotTeam >= 12 ? 'up' : chotTeam != null ? 'stable' : 'neutral'}
              deltaText={chotTeam != null ? `${chotTeam.toFixed(1)}% CR` : '—'}
              icon="trending_up"
            />
            <ObsidianKpiCard
              label="MKT hoạt động"
              value={`${mktActive}/${Math.max(members.length, 1)}`}
              deltaKind="stable"
              deltaText={isViewingCurrentMonth ? 'Tháng này' : `Thg ${monthLabel}`}
              icon="horizontal_rule"
            />
            <ObsidianKpiCard
              label="Cần xử lý"
              value={`${needsAttention.length}`}
              deltaKind={needsAttention.length ? 'high' : 'neutral'}
              deltaText={needsAttention.length ? 'Cao' : 'Ổn'}
              icon={needsAttention.length ? 'priority_high' : 'horizontal_rule'}
              valueEmphasis={needsAttention.length ? 'error' : undefined}
            />
          </div>

          <section className="bg-[var(--ld-surface-container)] rounded-2xl overflow-hidden border border-[var(--ld-outline-variant)]/10 mb-8">
            <div className="px-6 py-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-[color-mix(in_srgb,var(--ld-surface-container-high)_50%,transparent)]">
              <div>
                <h2 className="text-lg font-bold text-[var(--ld-on-surface)]">
                  Hiệu suất Marketing — {teamName || 'Team'}
                </h2>
                <p className="text-xs text-[var(--ld-on-surface-variant)] leader-dash-label mt-0.5">
                  Tháng {monthLabel} · Chi tiết {DETAIL_REPORTS_TABLE}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!displayRows.length}
                  className="bg-[var(--ld-surface-container-highest)] px-4 py-2 rounded-lg text-xs font-semibold text-[var(--ld-on-surface)] hover:bg-[var(--ld-surface-bright)] transition-colors disabled:opacity-40"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setFilterHighCpdt((v) => !v)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    filterHighCpdt
                      ? 'bg-[var(--ld-primary-container)] text-[var(--ld-on-primary-container)]'
                      : 'bg-[var(--ld-primary)] text-[var(--ld-on-primary-container)] hover:brightness-110'
                  }`}
                >
                  {filterHighCpdt ? 'Xem tất cả' : 'Lọc CP/DT &gt; 35%'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto leader-dash-no-scrollbar px-2 sm:px-4 pb-4">
              {displayRows.length === 0 ? (
                <div className="p-10 text-center text-[var(--ld-on-surface-variant)] text-[12px] font-semibold">
                  {teamName
                    ? filterHighCpdt
                      ? 'Không có MKT nào vượt ngưỡng CP/DT 35%.'
                      : `Không có dòng detail_reports trong tháng ${monthLabel} khớp team (theo email hoặc code = mã NS trên nhân sự).`
                    : 'Chưa gán team / leader — xem cảnh báo phía trên.'}
                </div>
              ) : (
                <table className="w-full text-left border-separate border-spacing-y-2 min-w-[1120px]">
                  <thead>
                    <tr className="text-[10px] leader-dash-label uppercase tracking-widest text-[var(--ld-on-surface-variant)]">
                      <th className="pb-2 pl-4 font-medium">#</th>
                      <th className="pb-2 font-medium">
                        Marketing
                        <span className="block text-[9px] font-normal normal-case tracking-normal text-[var(--ld-on-surface-variant)] opacity-90">
                          tên · mã NS
                        </span>
                      </th>
                      <th className="pb-2 font-medium">Doanh số</th>
                      <th className="pb-2 font-medium">Chi phí</th>
                      <th className="pb-2 font-medium">CP/DT</th>
                      <th className="pb-2 font-medium">Mess</th>
                      <th className="pb-2 font-medium">CPA</th>
                      <th className="pb-2 font-medium">Lead</th>
                      <th className="pb-2 font-medium">CPL</th>
                      <th className="pb-2 font-medium">Đơn</th>
                      <th className="pb-2 font-medium">CPO</th>
                      <th className="pb-2 font-medium">%CR</th>
                      <th className="pb-2 pr-4 text-right font-medium">AOV</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {displayRows.map((row, idx) => {
                      const { m, a, cpdt, mess, lead, cpa, cpl, cpo, crPct, aov, acctLine } = row;
                      const critical = cpdt != null && cpdt > 45;
                      const rank = String(idx + 1).padStart(2, '0');
                      return (
                        <tr
                          key={m.id}
                          className="bg-[color-mix(in_srgb,var(--ld-surface-container-low)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--ld-surface-container-highest)_60%,transparent)] transition-colors"
                        >
                          <td className="py-3.5 pl-4 rounded-l-xl font-bold text-[var(--ld-primary)] align-top">{rank}</td>
                          <td className="py-3.5 align-top">
                            <div
                              className={`font-semibold ${critical ? 'text-[var(--ld-tertiary)]' : 'text-[var(--ld-on-surface)]'}`}
                              title={mktNameWithCode(m)}
                            >
                              {mktNameWithCode(m)}
                            </div>
                            <div
                              className="text-[10px] text-[var(--ld-on-surface-variant)] truncate max-w-[200px]"
                              title={acctLine}
                            >
                              {acctLine}
                            </div>
                          </td>
                          <td className="py-3.5 font-mono text-xs text-[var(--ld-secondary)] font-semibold align-top">
                            {formatCompactVnd(a.rev)}
                          </td>
                          <td className="py-3.5 font-mono text-xs align-top">{formatCompactVnd(a.ads)}</td>
                          <td className="py-3.5 align-top">
                            {cpdt != null ? (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cpdtPillClass(cpdt)}`}>
                                {cpdt.toFixed(1)}%
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3.5 align-top">{mess > 0 ? Math.round(mess).toLocaleString('vi-VN') : '—'}</td>
                          <td className="py-3.5 font-mono text-xs align-top">{cpa > 0 ? formatCompactVnd(cpa) : '—'}</td>
                          <td className="py-3.5 align-top">{lead > 0 ? Math.round(lead).toLocaleString('vi-VN') : '—'}</td>
                          <td className="py-3.5 font-mono text-xs align-top">{cpl > 0 ? formatCompactVnd(cpl) : '—'}</td>
                          <td className="py-3.5 font-bold text-[var(--ld-on-surface)] align-top">
                            {a.orders > 0 ? a.orders.toLocaleString('vi-VN') : '—'}
                          </td>
                          <td className="py-3.5 font-mono text-xs align-top">{cpo > 0 ? formatCompactVnd(cpo) : '—'}</td>
                          <td
                            className={`py-3.5 align-top ${crPct != null && crPct < 15 ? 'text-[var(--ld-error)]' : ''}`}
                          >
                            {crPct != null ? `${crPct.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-3.5 pr-4 text-right rounded-r-xl font-mono text-xs align-top">
                            {aov > 0 ? formatCompactVnd(aov) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[var(--ld-surface-container)] rounded-2xl p-6 border border-[var(--ld-outline-variant)]/10">
              <h3 className="text-sm font-bold mb-6 flex items-center gap-2 text-[var(--ld-on-surface)]">
                <span className="material-symbols-outlined text-[var(--ld-primary)] text-lg">analytics</span>
                Tiến độ KPI tháng
              </h3>
              <div className="space-y-6">
                {tableRows.length === 0 ? (
                  <div className="text-[11px] text-[var(--ld-on-surface-variant)]">Chưa có nhân sự để hiển thị KPI.</div>
                ) : (
                  tableRows.map(({ m, a }) => {
                    const tgt = staffTargets.get(m.id);
                    const pct = tgt != null && tgt > 0 ? Math.min(100, (a.rev / tgt) * 100) : 0;
                    const hasT = tgt != null && tgt > 0;
                    const barColor = !hasT
                      ? 'var(--ld-outline-variant)'
                      : pct >= 85
                        ? 'var(--ld-secondary)'
                        : pct >= 50
                          ? 'var(--ld-tertiary)'
                          : 'var(--ld-error)';
                    const scoreText = hasT ? `${Math.round(pct)}/100` : '0/chưa gán';
                    const subRole = safeTrim(m.vi_tri) || 'Marketing';
                    return (
                      <div key={m.id} className="space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <StaffAvatar member={m} />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[var(--ld-on-surface)] truncate" title={mktNameWithCode(m)}>
                                {mktNameWithCode(m)}
                              </p>
                              <p className="text-[10px] text-[var(--ld-on-surface-variant)] truncate">{subRole}</p>
                            </div>
                          </div>
                          <p className="text-xs font-bold shrink-0" style={{ color: barColor }}>
                            {scoreText}{' '}
                            {hasT ? (
                              <span className="text-[10px] text-[var(--ld-on-surface-variant)] font-normal">
                                ({pct.toFixed(0)}%)
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="w-full bg-[var(--ld-surface-container-highest)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${hasT ? pct : 0}%`, background: barColor }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-[var(--ld-surface-container)] rounded-2xl p-6 border border-[var(--ld-outline-variant)]/10">
              <h3 className="text-sm font-bold mb-6 flex items-center gap-2 text-[var(--ld-on-surface)]">
                <span className="material-symbols-outlined text-[var(--ld-error)] text-lg">warning</span>
                Cảnh báo hiệu suất
              </h3>
              <div className="space-y-4">
                {needsAttention[0] ? (
                  <div className="bg-[color-mix(in_srgb,var(--ld-error-container)_10%,transparent)] p-3 rounded-xl border border-[var(--ld-error)]/10 flex gap-3">
                    <span className="material-symbols-outlined text-[var(--ld-error)] shrink-0">ads_click</span>
                    <div>
                      <p className="text-xs font-bold text-[var(--ld-error)]">CP/DT vượt ngưỡng</p>
                      <p className="text-[10px] text-[var(--ld-on-surface-variant)]">
                        {mktNameWithCode(needsAttention[0].m)}: CP/DT {needsAttention[0].cpdt?.toFixed(1)}% (Ngưỡng theo dõi: 35%)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[color-mix(in_srgb,var(--ld-secondary-container)_10%,transparent)] p-3 rounded-xl border border-[var(--ld-secondary)]/10 flex gap-3">
                    <span className="material-symbols-outlined text-[var(--ld-secondary)] shrink-0">check_circle</span>
                    <div>
                      <p className="text-xs font-bold text-[var(--ld-secondary)]">CP/DT ổn định</p>
                      <p className="text-[10px] text-[var(--ld-on-surface-variant)]">Không có MKT nào vượt ngưỡng CP/DT 35%.</p>
                    </div>
                  </div>
                )}

                {cpaAlertRow ? (
                  <div className="bg-[color-mix(in_srgb,var(--ld-error-container)_10%,transparent)] p-3 rounded-xl border border-[var(--ld-error)]/10 flex gap-3">
                    <span className="material-symbols-outlined text-[var(--ld-error)] shrink-0">ads_click</span>
                    <div>
                      <p className="text-xs font-bold text-[var(--ld-error)]">CPA vượt ngưỡng</p>
                      <p className="text-[10px] text-[var(--ld-on-surface-variant)]">
                        {mktNameWithCode(cpaAlertRow.m)}: CPA {formatCompactVnd(cpaAlertRow.cpa)} (Ngưỡng:{' '}
                        {formatCompactVnd(CPA_ALERT_THRESHOLD_VND)})
                      </p>
                    </div>
                  </div>
                ) : null}

                {unassignedKpiCount > 0 ? (
                  <div className="bg-[color-mix(in_srgb,var(--ld-tertiary-container)_10%,transparent)] p-3 rounded-xl border border-[var(--ld-tertiary)]/10 flex gap-3">
                    <span className="material-symbols-outlined text-[var(--ld-tertiary)] shrink-0">hourglass_empty</span>
                    <div>
                      <p className="text-xs font-bold text-[var(--ld-tertiary)]">KPI chưa gán</p>
                      <p className="text-[10px] text-[var(--ld-on-surface-variant)]">
                        Có {unassignedKpiCount} thành viên chưa có mục tiêu KPI tháng trong {KPI_STAFF_TABLE}.
                      </p>
                    </div>
                  </div>
                ) : null}

                {kpiPctTeam != null && kpiPctTeam >= 100 ? (
                  <div className="bg-[color-mix(in_srgb,var(--ld-secondary-container)_10%,transparent)] p-3 rounded-xl border border-[var(--ld-secondary)]/10 flex gap-3">
                    <span className="material-symbols-outlined text-[var(--ld-secondary)] shrink-0">trending_up</span>
                    <div>
                      <p className="text-xs font-bold text-[var(--ld-secondary)]">Đạt KPI team</p>
                      <p className="text-[10px] text-[var(--ld-on-surface-variant)]">
                        Doanh thu team đạt {kpiPctTeam.toFixed(0)}% mục tiêu tháng {monthLabel}.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="fixed bottom-8 right-8 z-30">
            <button
              type="button"
              title="Gán KPI tháng"
              onClick={() => navigate(crmAdminPathForView('kpi-target'))}
              className="w-14 h-14 rounded-full bg-[var(--ld-primary)] flex items-center justify-center text-[var(--ld-on-primary-container)] shadow-2xl hover:scale-105 active:scale-95 transition-all group border border-[var(--ld-primary-container)]/30"
            >
              <span className="material-symbols-outlined group-hover:rotate-90 transition-transform text-2xl">add</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
