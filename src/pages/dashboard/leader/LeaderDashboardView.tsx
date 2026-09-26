import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Eye, Loader2, RefreshCw, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../api/supabase';
import type { AuthUser, Employee } from '../../../types';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';
import {
  formatCompactVnd,
  formatKpiMoney,
  formatReportDateVi,
  toLocalYyyyMmDd,
} from '../mkt/mktDetailReportShared';

/** Hiệu suất Marketing (leader): luôn lấy từ bảng này, không dùng VITE_SUPABASE_REPORTS_TABLE */
const DETAIL_REPORTS_TABLE = 'detail_reports';

/** Lấy theo lô + keyset `id > lastId` để không bị trần một lần query */
const DETAIL_REPORTS_PAGE_SIZE = 1000;
/** Tối đa số lô (1000 × 500 = 500k dòng/tháng) */
const DETAIL_REPORT_MAX_PAGES = 500;

const LEADER_DETAIL_REPORTS_SELECT =
  'id, report_date, team, email, name, code, ad_account, ma_tkqc, ad_cost, revenue, tien_viet, tong_lead, tong_data_nhan, mess_comment_count, order_count';

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

/** Chuẩn hóa mã: trim, NBSP → space, gộp khoảng trắng — khớp detail_reports.code ↔ employees.ma_ns. */
function normalizeDetailCode(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function codeKey(raw: string | null | undefined): string | null {
  const n = normalizeDetailCode(raw);
  return n ? n.toLowerCase() : null;
}

/** Khớp team giữa employees.team, crm_teams.ten_team, kpi.team_key: NBSP, gộp space, gạch Unicode → '-', chữ thường. */
function normalizeTeamLookupKey(raw: string | null | undefined): string {
  return String(raw ?? '')
    /** Bỏ dấu (NFD) để "Hải Yến" / "Hai Yen" / lệch gõ vẫn cùng bucket KPI. */
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015\u2212\ufe58\ufe63\uff0d]/g, '-')
    .trim()
    .replace(/\s+/g, ' ')
    /** "FBC - Aware" và "FBC-Aware" → cùng một khóa (tránh KPI / DR / roster lệch 1 bucket). */
    .replace(/\s*-\s*/g, '-')
    .toLowerCase()
    /** "FBC Aware" (chỉ khoảng trắng) vs "fbc-aware" — gom còn lại thành một bucket. */
    .replace(/\s+/g, '-');
}

/**
 * Khi `normalizeTeamLookupKey(detail_reports.team)` ∉ allowed nhưng chuỗi gốc gần giống đúng một `team_key` KPI
 * (khoảng trắng / gạch / hậu tố thừa) — trả về khóa chuẩn của KPI đó; nhiều kết quả → bỏ qua.
 */
/** Bỏ tiền tố kiểu "Team …" / "Nhóm …" trên detail_reports.team để khớp team_key KPI. */
function detailReportsTeamPrefixStrip(raw: string | null | undefined): string {
  const full = safeTrim(raw);
  if (!full) return '';
  const stripped = full.replace(/^(team|nh[oô]m)\s*[:.\-_/\\]*\s*/i, '').trim();
  return stripped || full;
}

function remapDrTeamToKpiNorm(drRaw: string, teamKpiRows: { teamKey: string }[]): string {
  const t = safeTrim(drRaw).toLowerCase().replace(/\s+/g, ' ');
  if (!t) return '';
  const hits: string[] = [];
  for (const r of teamKpiRows) {
    const k = safeTrim(r.teamKey).toLowerCase().replace(/\s+/g, ' ');
    if (!k) continue;
    const nk = normalizeTeamLookupKey(r.teamKey);
    if (!nk) continue;
    if (t === k) hits.push(nk);
    else if (t.startsWith(`${k} `) || t.startsWith(`${k}-`) || t.startsWith(`${k}/`)) hits.push(nk);
    else if (k.startsWith(`${t} `) || k.startsWith(`${t}-`) || k.startsWith(`${t}/`)) hits.push(nk);
  }
  const uniq = [...new Set(hits)];
  return uniq.length === 1 ? uniq[0] : '';
}

/** Tên hiển thị kèm mã: ưu tiên tên CRM theo `ma_ns`/`code` (map từ roster), sau đó `m.name`. */
function mktNameWithCode(m: Employee, nameByCode?: Map<string, string>): string {
  const code = safeTrim(m.ma_ns) || safeTrim(m.code);
  const cLc = codeKey(code);
  const fromMap = cLc ? nameByCode?.get(cLc) : undefined;
  const name = safeTrim(fromMap) || safeTrim(m.name) || '—';
  if (!code) return name;
  return `${name} · ${code}`;
}

/** Một dòng detail_reports: tên MKT ưu tiên theo `code` → roster CRM, không có thì tên trên DR. */
function leaderDrMktDisplayName(r: Record<string, unknown>, nameByCode: Map<string, string>): string {
  const c = codeKey((r as { code?: string }).code);
  const drName = safeTrim((r as { name?: string }).name);
  if (!c) return drName || '—';
  return safeTrim(nameByCode.get(c)) || drName || '—';
}

/** Giống admin-dash: tiền từ detail_reports (chuỗi có dấu phẩy / khoảng trắng) */
function safeNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/[\$,]/g, '').replace(/\s+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatVndDots(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('vi-VN');
}

/** Doanh thu VND từ detail_reports: ưu tiên tien_viet; không có thì dùng revenue (đã là VND trên bảng, không nhân 25000). */
function reportRevenueVnd(row: { tien_viet?: unknown; revenue?: unknown }): number {
  if (row.tien_viet != null) return Math.round(safeNum(row.tien_viet));
  return Math.round(safeNum(row.revenue));
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
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string }>(() => ({
    start: monthRangeLocal(ymNow()).start,
    end: toLocalYyyyMmDd(new Date()),
  }));
  const start = selectedRange.start;
  const end = selectedRange.end;
  const selectedYm = start.slice(0, 7);
  const monthLabel = `${formatReportDateVi(start)} – ${formatReportDateVi(end)}`;
  const currentYm = ymNow();
  const currentMonthRange = monthRangeLocal(currentYm);
  const isViewingCurrentMonth = start === currentMonthRange.start && end === toLocalYyyyMmDd(new Date());

  const setQuickRange = (preset: 'yesterday' | '7days' | 'month') => {
    const today = new Date();
    const finish = new Date(today);
    const first = new Date(today);
    if (preset === 'yesterday') {
      first.setDate(first.getDate() - 1);
      finish.setDate(finish.getDate() - 1);
    } else if (preset === '7days') {
      first.setDate(first.getDate() - 6);
    } else {
      setSelectedRange({ start: currentMonthRange.start, end: toLocalYyyyMmDd(today) });
      return;
    }
    setSelectedRange({ start: toLocalYyyyMmDd(first), end: toLocalYyyyMmDd(finish) });
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<Employee[]>([]);
  const [byCodeKey, setByCodeKey] = useState<Map<string, Agg>>(() => new Map());
  const [teamTargetVnd, setTeamTargetVnd] = useState<number | null>(null);
  /** Mục tiêu DT team theo từng team_key (KPI); mỗi team một thanh tiến độ, không cộng gộp nhầm. */
  const [teamKpiRows, setTeamKpiRows] = useState<{ teamKey: string; targetVnd: number }[]>([]);
  const [leaderTeamKeys, setLeaderTeamKeys] = useState<string[]>([]);
  const [staffTargets, setStaffTargets] = useState<Map<string, number>>(() => new Map());
  const [filterHighCpdt, setFilterHighCpdt] = useState(false);
  const [detailRowsByCodeKey, setDetailRowsByCodeKey] = useState<Map<string, Record<string, unknown>[]>>(() => new Map());
  const [mktNameByCode, setMktNameByCode] = useState<Map<string, string>>(() => new Map());
  const [mktDetailCodeKey, setMktDetailCodeKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const fallbackTeam = viewer?.team?.trim() || '';
    const viewerName = viewer?.name?.trim() || '';

    if (!viewer?.email) {
      setTeamName('');
      setError(null);
      setMembers([]);
      setByCodeKey(new Map());
      setDetailRowsByCodeKey(new Map());
      setMktNameByCode(new Map());
      setTeamTargetVnd(null);
      setTeamKpiRows([]);
      setLeaderTeamKeys([]);
      setStaffTargets(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setMembers([]);
    setByCodeKey(new Map());
    setDetailRowsByCodeKey(new Map());
    setMktNameByCode(new Map());
    setMktDetailCodeKey(null);
    setTeamTargetVnd(null);
    setTeamKpiRows([]);
    setLeaderTeamKeys([]);
    setStaffTargets(new Map());

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
      setMembers([]);
      setByCodeKey(new Map());
      setDetailRowsByCodeKey(new Map());
      setMktNameByCode(new Map());
      setTeamKpiRows([]);
      setLeaderTeamKeys([]);
      setLoading(false);
      return;
    }

    const all = (empRes.data || []) as Employee[];
    const teamNormSet = new Set(teamKeys.map((t) => normalizeTeamLookupKey(t)));
    const teamList = isAdminViewer
      ? all.filter((e) => isActiveStaff(e.trang_thai))
      : teamKeys.length
        ? all.filter((e) => teamNormSet.has(normalizeTeamLookupKey(e.team)) && isActiveStaff(e.trang_thai))
        : [];

    /** Chỉ gom báo cáo khi detail_reports.code (chuẩn hóa) khớp ma_ns nhân sự trong team. */
    const allowedCodeKeys = new Set<string>();
    const nameByCodeMap = new Map<string, string>();
    for (const e of teamList) {
      const k = codeKey(e.ma_ns);
      if (k) {
        allowedCodeKeys.add(k);
        const nm = safeTrim(e.name);
        if (nm) nameByCodeMap.set(k, nm);
      }
    }

    const idList = teamList.map((e) => e.id);

    const kpiTeamKeyList = isAdminViewer
      ? [...new Set(teamList.map((e) => safeTrim(e.team)).filter(Boolean))]
      : teamKeys;

    /** Lấy toàn bộ KPI tháng rồi lọc theo khóa chuẩn hóa — tránh .in(team_key) lệch chữ với employees / báo cáo. */
    const teamKpiPromise =
      kpiTeamKeyList.length > 0
        ? supabase
            .from(KPI_TEAM_TABLE)
            .select('muc_tieu_doanh_thu_team, team_key')
            .eq('nam_thang', selectedYm)
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
      allowedCodeKeys.size > 0 ? fetchAllLeaderDetailReportsForRange(start, end) : Promise.resolve({ data: [], error: null }),
    ]);

    if (teamKpiRes.error) {
      console.warn('leader-dash team kpi:', teamKpiRes.error);
    }
    const allowedTeamNorm = new Set(kpiTeamKeyList.map((t) => normalizeTeamLookupKey(t)));
    const teamKpiMerged = new Map<string, { label: string; targetVnd: number }>();
    for (const row of teamKpiRes.data || []) {
      const tkRaw = safeTrim((row as { team_key?: string }).team_key);
      const v = Number((row as { muc_tieu_doanh_thu_team?: number }).muc_tieu_doanh_thu_team);
      if (!tkRaw || !Number.isFinite(v) || v <= 0) continue;
      const kn = normalizeTeamLookupKey(tkRaw);
      if (!allowedTeamNorm.has(kn)) continue;
      const prev = teamKpiMerged.get(kn);
      teamKpiMerged.set(kn, {
        label: prev?.label ?? tkRaw,
        targetVnd: (prev?.targetVnd ?? 0) + v,
      });
    }
    const teamKpiRowsArr = [...teamKpiMerged.values()].map(({ label, targetVnd }) => ({ teamKey: label, targetVnd }));
    const tvSum = teamKpiRowsArr.reduce((s, r) => s + r.targetVnd, 0);
    setTeamKpiRows(teamKpiRowsArr);
    setLeaderTeamKeys(kpiTeamKeyList);
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

    const next = new Map<string, Agg>();

    if (repRes.error) {
      console.error(`leader-dash ${DETAIL_REPORTS_TABLE}:`, repRes.error);
      setError(repRes.error.message || `Không tải ${DETAIL_REPORTS_TABLE}.`);
      setMembers([]);
      setByCodeKey(new Map());
      setDetailRowsByCodeKey(new Map());
      setMktNameByCode(new Map());
      setTeamKpiRows([]);
      setLeaderTeamKeys([]);
      setTeamTargetVnd(null);
      setLoading(false);
      return;
    }

    /** Mã NS đã có ≥1 dòng detail_reports trong kỳ (không gom theo email). */
    const codesWithDetailRows = new Set<string>();
    const detailByCode = new Map<string, Record<string, unknown>[]>();
    for (const row of repRes.data || []) {
      const ck = codeKey((row as { code?: string | null }).code);
      if (!ck || !allowedCodeKeys.has(ck)) continue;

      codesWithDetailRows.add(ck);
      const drList = detailByCode.get(ck) || [];
      drList.push(row as Record<string, unknown>);
      detailByCode.set(ck, drList);

      const a = next.get(ck) || emptyAgg();
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
      next.set(ck, a);
    }

    const membersFromDetail = teamList.filter((e) => {
      const k = codeKey(e.ma_ns);
      return Boolean(k && codesWithDetailRows.has(k));
    });
    setMktNameByCode(nameByCodeMap);
    setDetailRowsByCodeKey(detailByCode);
    setMembers(membersFromDetail);
    setByCodeKey(next);
    setLoading(false);
  }, [viewer?.email, viewer?.team, viewer?.name, viewer?.role, start, end, selectedYm]);

  useEffect(() => {
    void load();
  }, [load]);

  const mktDetailRows = useMemo(() => {
    if (!mktDetailCodeKey) return [];
    return detailRowsByCodeKey.get(mktDetailCodeKey) ?? [];
  }, [mktDetailCodeKey, detailRowsByCodeKey]);

  const mktDetailTitle = useMemo(() => {
    if (!mktDetailCodeKey) return '';
    const hit = members.find((x) => codeKey(x.ma_ns) === mktDetailCodeKey);
    if (hit) return mktNameWithCode(hit, mktNameByCode);
    const nm = mktNameByCode.get(mktDetailCodeKey);
    return nm ? `${nm} · ${mktDetailCodeKey}` : mktDetailCodeKey;
  }, [mktDetailCodeKey, members, mktNameByCode]);

  useEffect(() => {
    if (!mktDetailCodeKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMktDetailCodeKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mktDetailCodeKey]);

  const aggForMember = useCallback(
    (m: Employee): Agg => {
      const k = codeKey(m.ma_ns);
      if (k && byCodeKey.has(k)) {
        const x = byCodeKey.get(k);
        if (x) return x;
      }
      return emptyAgg();
    },
    [byCodeKey]
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
  /** % trên tổng mục tiêu các team (Σ MT) — khác từng thanh KPI team (DT team / MT team). */
  const kpiPctTeam =
    teamTargetVnd != null && teamTargetVnd > 0 ? Math.min(999, (teamTotals.rev / teamTargetVnd) * 100) : null;

  /** ma_ns (code) → team roster (chuẩn hóa) — để gán dòng DR không có cột team / nhân sự chưa gán team khi leader chỉ 1 team. */
  const codeKeyToRosterTeamNorm = useMemo(() => {
    const m = new Map<string, string>();
    const singleKn =
      leaderTeamKeys.length === 1 ? normalizeTeamLookupKey(safeTrim(leaderTeamKeys[0])) : '';
    for (const mem of members) {
      const k = codeKey(mem.ma_ns);
      if (!k) continue;
      let kn = normalizeTeamLookupKey(mem.team);
      if (!kn && singleKn) kn = singleKn;
      if (!kn) continue;
      if (!m.has(k)) m.set(k, kn);
    }
    return m;
  }, [members, leaderTeamKeys]);

  /**
   * Doanh thu cho từng thanh KPI team: mỗi dòng DR chỉ cộng **một lần**.
   * Nhiều team: ưu tiên `detail_reports.team` nếu khớp team leader (sau normalize); không thì roster theo mã NS.
   * Tránh lỗi cũ (cộng full theo roster + cộng theo DR) làm % sai (ví dụ 300M+150M so với mục tiêu từng team).
   */
  const revByTeamAttributed = useMemo(() => {
    const allowedKn = new Set<string>();
    for (const t of leaderTeamKeys) {
      const kn = normalizeTeamLookupKey(t);
      if (kn) allowedKn.add(kn);
    }
    for (const r of teamKpiRows) {
      const kn = normalizeTeamLookupKey(r.teamKey);
      if (kn) allowedKn.add(kn);
    }
    const singleKn =
      leaderTeamKeys.length === 1 ? normalizeTeamLookupKey(safeTrim(leaderTeamKeys[0])) : '';
    const out = new Map<string, number>();
    for (const rows of detailRowsByCodeKey.values()) {
      for (const row of rows) {
        const ck = codeKey((row as { code?: string | null }).code);
        if (!ck) continue;
        const drRaw = safeTrim((row as { team?: string | null }).team);
        const knDr = drRaw ? normalizeTeamLookupKey(detailReportsTeamPrefixStrip(drRaw)) : '';
        const knRos = codeKeyToRosterTeamNorm.get(ck) ?? '';
        let kn = '';
        if (leaderTeamKeys.length <= 1) {
          kn = knDr || knRos || singleKn;
        } else {
          /** Nhiều team: ưu tiên cột team trên DR (kể cả remap), sau đó mới roster — tránh nuốt hết DT vào một employees.team. */
          if (knDr && allowedKn.has(knDr)) kn = knDr;
          else if (knDr && !allowedKn.has(knDr)) {
            const remapped = remapDrTeamToKpiNorm(detailReportsTeamPrefixStrip(drRaw), teamKpiRows);
            if (remapped && allowedKn.has(remapped)) kn = remapped;
          }
          if (!kn && knRos && allowedKn.has(knRos)) kn = knRos;
        }
        if (!kn) continue;
        const add = reportRevenueVnd(row as { tien_viet?: unknown; revenue?: unknown });
        out.set(kn, (out.get(kn) ?? 0) + add);
      }
    }
    return out;
  }, [detailRowsByCodeKey, codeKeyToRosterTeamNorm, leaderTeamKeys, teamKpiRows]);

  /** Mỗi team một thanh: DT team / mục tiêu team (không gộp nhiều team vào một thanh). */
  const teamKpiBarItems = useMemo(() => {
    if (!teamKpiRows.length) return [];
    const byNorm = new Map(teamKpiRows.map((r) => [normalizeTeamLookupKey(r.teamKey), r] as const));
    const seen = new Set<string>();
    const out: { label: string; rev: number; target: number; pct: number }[] = [];

    const distinctKpiNorm = new Set(teamKpiRows.map((r) => normalizeTeamLookupKey(r.teamKey)).filter(Boolean));
    const multiKpiBars = leaderTeamKeys.length > 1 || distinctKpiNorm.size > 1;

    /** Đồng bộ tổng DT đã gán bucket với tổng bảng chính (tránh % KPI team lệch khi dòng DR không gán được team). */
    const revAdjust = new Map(revByTeamAttributed);
    const sumAttr = [...revAdjust.values()].reduce((s, v) => s + v, 0);
    const totalRev = teamTotals.rev;
    if (multiKpiBars && totalRev > 0) {
      /** Chỉ làm tròn VND — trước đây 0,5% tổng DT khiến vài trăm triệu không vào thanh KPI. */
      const minOrphan = 1;
      if (sumAttr <= 0 && distinctKpiNorm.size > 0) {
        /** Không gán được bucket từ DR: chia theo doanh thu roster (employees.team), scale lên tổng bảng — tránh chia đều 50/50 làm % lệch mạnh. */
        const perKn = new Map<string, number>();
        const singleKn =
          leaderTeamKeys.length === 1 ? normalizeTeamLookupKey(safeTrim(leaderTeamKeys[0])) : '';
        for (const { m: mem, a } of tableRows) {
          let kn = normalizeTeamLookupKey(mem.team);
          if (!kn && singleKn) kn = singleKn;
          if (!kn || !distinctKpiNorm.has(kn)) continue;
          perKn.set(kn, (perKn.get(kn) ?? 0) + a.rev);
        }
        const s = [...perKn.values()].reduce((x, y) => x + y, 0);
        if (s > 0) {
          for (const kn of distinctKpiNorm) {
            const raw = perKn.get(kn) ?? 0;
            revAdjust.set(kn, (raw / s) * totalRev);
          }
        } else {
          const share = totalRev / distinctKpiNorm.size;
          for (const kn of distinctKpiNorm) {
            revAdjust.set(kn, share);
          }
        }
      } else if (sumAttr > 0 && totalRev - sumAttr >= minOrphan) {
        let orphan = totalRev - sumAttr;
        const rosterRevByKn = new Map<string, number>();
        const singleKnOr =
          leaderTeamKeys.length === 1 ? normalizeTeamLookupKey(safeTrim(leaderTeamKeys[0])) : '';
        for (const { m: mem, a } of tableRows) {
          let kn = normalizeTeamLookupKey(mem.team);
          if (!kn && singleKnOr) kn = singleKnOr;
          if (!kn || !distinctKpiNorm.has(kn)) continue;
          rosterRevByKn.set(kn, (rosterRevByKn.get(kn) ?? 0) + a.rev);
        }
        /** DT chưa gán bucket: ưu tiên team có attr=0 nhưng có DT trên roster (thường là DR sai team / thiếu team). */
        const zeroAttrWithRoster = [...distinctKpiNorm].filter(
          (kn) => (revAdjust.get(kn) ?? 0) === 0 && (rosterRevByKn.get(kn) ?? 0) > 0
        );
        if (zeroAttrWithRoster.length > 0 && orphan >= minOrphan) {
          const sumZ = zeroAttrWithRoster.reduce((s, kn) => s + (rosterRevByKn.get(kn) ?? 0), 0);
          if (sumZ > 0) {
            let allocated = 0;
            for (let i = 0; i < zeroAttrWithRoster.length; i++) {
              const kn = zeroAttrWithRoster[i];
              const r = rosterRevByKn.get(kn) ?? 0;
              const isLast = i === zeroAttrWithRoster.length - 1;
              const add = isLast ? orphan - allocated : Math.round((orphan * r) / sumZ);
              allocated += add;
              revAdjust.set(kn, (revAdjust.get(kn) ?? 0) + add);
            }
            orphan = totalRev - [...revAdjust.values()].reduce((s, v) => s + v, 0);
          }
        }
        if (orphan >= minOrphan) {
          let sumW = 0;
          const wByKn = new Map<string, number>();
          for (const kn of distinctKpiNorm) {
            const a = revAdjust.get(kn) ?? 0;
            const r = rosterRevByKn.get(kn) ?? 0;
            const w = a > 0 ? a : r;
            wByKn.set(kn, w);
            sumW += w;
          }
          if (sumW > 0) {
            let alloc2 = 0;
            const knList = [...distinctKpiNorm];
            for (let i = 0; i < knList.length; i++) {
              const kn = knList[i];
              const w = wByKn.get(kn) ?? 0;
              const cur = revAdjust.get(kn) ?? 0;
              const isLast = i === knList.length - 1;
              const add = isLast ? orphan - alloc2 : Math.round((orphan * w) / sumW);
              alloc2 += add;
              revAdjust.set(kn, cur + add);
            }
          } else {
            const eq = Math.round(orphan / distinctKpiNorm.size);
            let alloc3 = 0;
            const knArr = [...distinctKpiNorm];
            for (let i = 0; i < knArr.length; i++) {
              const kn = knArr[i];
              const add = i === knArr.length - 1 ? orphan - alloc3 : eq;
              alloc3 += add;
              revAdjust.set(kn, (revAdjust.get(kn) ?? 0) + add);
            }
          }
        }
      }
    }

    const pushBar = (label: string) => {
      const kn = normalizeTeamLookupKey(label);
      if (seen.has(kn)) return;
      const row = byNorm.get(kn);
      if (!row || row.targetVnd <= 0) return;
      seen.add(kn);
      const rev = revAdjust.get(kn) ?? 0;
      out.push({
        label: row.teamKey,
        rev,
        target: row.targetVnd,
        pct: (rev / row.targetVnd) * 100,
      });
    };

    for (const k of leaderTeamKeys) pushBar(k);
    for (const t of teamKpiRows) pushBar(t.teamKey);

    /** Leader chỉ 1 team: đồng bộ tổng DT bảng chính (mọi dòng đã gán bucket). */
    if (out.length === 1 && leaderTeamKeys.length === 1 && teamTotals.rev > 0) {
      const tgt = out[0].target;
      out[0] = {
        ...out[0],
        rev: teamTotals.rev,
        pct: (teamTotals.rev / tgt) * 100,
      };
    }
    return out;
  }, [teamKpiRows, leaderTeamKeys, revByTeamAttributed, teamTotals.rev, tableRows]);

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
  }, [displayRows, teamName, selectedYm, mktNameByCode]);

  if (!viewer?.email) {
    return (
      <div className="leader-dash-obsidian dash-fade-up p-6 text-[12px] text-[var(--ld-on-surface-variant)] font-semibold">
        Đăng nhập CRM để xem dashboard leader (theo team trên tài khoản).
      </div>
    );
  }

  const revStr = formatCompactVnd(teamTotals.rev) === '—' ? '0' : formatCompactVnd(teamTotals.rev);
  const adsStr = formatCompactVnd(teamTotals.ads) === '—' ? '0' : formatCompactVnd(teamTotals.ads);
  const rangeDays = Math.max(1, Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1);
  const monthDayCount = new Date(Number(selectedYm.slice(0, 4)), Number(selectedYm.slice(5, 7)), 0).getDate();
  const kpiMonthStart = new Date(`${selectedYm}-01T00:00:00`);
  const kpiMonthEnd = new Date(`${selectedYm}-${String(monthDayCount).padStart(2, '0')}T00:00:00`);
  const rangeStartDate = new Date(`${start}T00:00:00`);
  const rangeEndDate = new Date(`${end}T00:00:00`);
  const targetRangeStart = Math.max(rangeStartDate.getTime(), kpiMonthStart.getTime());
  const targetRangeEnd = Math.min(rangeEndDate.getTime(), kpiMonthEnd.getTime());
  const targetDaysInRange = targetRangeStart <= targetRangeEnd
    ? Math.round((targetRangeEnd - targetRangeStart) / 86400000) + 1
    : 0;
  const targetRangeFactor = Math.min(1, targetDaysInRange / Math.max(1, monthDayCount));
  const teamRangeTarget = teamTargetVnd != null ? teamTargetVnd * targetRangeFactor : null;
  const kpiPctForRange = teamRangeTarget != null && teamRangeTarget > 0 ? (teamTotals.rev / teamRangeTarget) * 100 : null;
  const todayYmd = toLocalYyyyMmDd(new Date());
  const elapsedDays = todayYmd < start ? 0 : todayYmd > end ? rangeDays : Math.max(1, Math.round((new Date(`${todayYmd}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1);
  const periodPacePct = Math.min(100, (elapsedDays / rangeDays) * 100);
  const teamMess = tableRows.reduce((sum, row) => sum + row.a.mess, 0);
  const teamCpa = teamMess > 0 ? teamTotals.ads / teamMess : 0;
  const teamCpo = teamTotals.orders > 0 ? teamTotals.ads / teamTotals.orders : 0;
  const averageOrderValue = teamTotals.orders > 0 ? teamTotals.rev / teamTotals.orders : 0;
  const leaderMember = tableRows[0] ?? null;
  const bestEfficiency = [...tableRows].filter((row) => row.cpdt != null).sort((a, b) => (a.cpdt ?? Infinity) - (b.cpdt ?? Infinity))[0] ?? null;
  const supportMember = [...tableRows].sort((a, b) => {
    const aTarget = (staffTargets.get(a.m.id) || 0) * targetRangeFactor;
    const bTarget = (staffTargets.get(b.m.id) || 0) * targetRangeFactor;
    const aGap = aTarget > 0 ? (a.a.rev / aTarget) * 100 - periodPacePct : Infinity;
    const bGap = bTarget > 0 ? (b.a.rev / bTarget) * 100 - periodPacePct : Infinity;
    return aGap - bGap;
  })[0] ?? null;
  const memberColors = ['#1682ff', '#14d88a', '#7b5cff', '#ff9d1b', '#21d4d8', '#ff4f5e', '#f5c451'];
  const pieStops = tableRows.length
    ? (() => {
        let edge = 0;
        return tableRows.map((row, index) => {
          const share = teamTotals.rev > 0 ? (row.a.rev / teamTotals.rev) * 100 : 100 / tableRows.length;
          const next = edge + share;
          const stop = `${memberColors[index % memberColors.length]} ${edge.toFixed(2)}% ${next.toFixed(2)}%`;
          edge = next;
          return stop;
        }).join(', ');
      })()
    : '#1c3450 0% 100%';
  const progressRows = tableRows.map((row) => {
    const target = (staffTargets.get(row.m.id) || 0) * targetRangeFactor;
    const pct = target > 0 ? (row.a.rev / target) * 100 : null;
    const forecast = elapsedDays > 0 ? (row.a.rev / elapsedDays) * rangeDays : 0;
    const forecastPct = target > 0 ? (forecast / target) * 100 : null;
    const state = forecastPct == null ? 'unassigned' : forecastPct >= 100 ? 'on' : forecastPct >= 80 ? 'slow' : 'risk';
    return { ...row, target, pct, forecast, forecastPct, state };
  });

  return (
    <div className="leader-dash-obsidian team-dashboard-modern dash-fade-up">
      <header className="team-dashboard-topbar">
        <div className="team-dashboard-brand">
          <div className="team-dashboard-brand-icon"><Users size={25} /></div>
          <div className="min-w-0">
            <h1>Dashboard Team {teamName || 'Kinh doanh'}</h1>
            <p>Tổng quan hiệu suất, tiến độ và cơ cấu doanh số theo thành viên</p>
          </div>
        </div>
        <div className="team-dashboard-filters">
          <div className="team-dashboard-segment" role="group" aria-label="Khoảng thời gian">
            <button type="button" onClick={() => setQuickRange('yesterday')}>Hôm qua</button>
            <button type="button" onClick={() => setQuickRange('7days')}>7 ngày</button>
            <button type="button" onClick={() => setQuickRange('month')} className={isViewingCurrentMonth ? 'active' : ''}>Tháng này</button>
          </div>
          <div className="team-dashboard-datebox">
            <CalendarDays size={16} />
            <input aria-label="Từ ngày" type="date" value={start} max={end} onChange={(event) => setSelectedRange((range) => ({ ...range, start: event.target.value }))} />
            <span>–</span>
            <input aria-label="Đến ngày" type="date" value={end} min={start} max={toLocalYyyyMmDd(new Date())} onChange={(event) => setSelectedRange((range) => ({ ...range, end: event.target.value }))} />
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="team-dashboard-refresh" aria-label="Làm mới"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </header>

      {error ? <div className="team-dashboard-error">{error}</div> : null}
      {!teamName ? <div className="team-dashboard-error">Chưa xác định team. Kiểm tra leader trong bảng crm_teams hoặc trường team ở nhân sự.</div> : null}

      {loading ? (
        <div className="team-dashboard-loading"><Loader2 size={22} className="animate-spin" /> Đang tải dashboard team…</div>
      ) : (
        <>
          <section className="team-dashboard-summary-grid" aria-label="Tổng quan team">
            <article className="team-dashboard-card team-dashboard-summary"><p className="td-label">Doanh số team</p><strong>{revStr}</strong><p className="td-sub">Mục tiêu kỳ {teamRangeTarget ? formatCompactVnd(teamRangeTarget) : 'chưa thiết lập'} <span className={kpiPctForRange != null && kpiPctForRange >= periodPacePct ? 'td-good' : 'td-warn'}>{kpiPctForRange == null ? '—' : `${kpiPctForRange.toFixed(1)}%`}</span></p></article>
            <article className="team-dashboard-card team-dashboard-summary"><p className="td-label">Chi phí quảng cáo</p><strong>{adsStr}</strong><p className="td-sub">CP/DT hiện tại <span className={adsTeamPct != null && adsTeamPct <= 30 ? 'td-good' : adsTeamPct != null && adsTeamPct <= 45 ? 'td-warn' : 'td-bad'}>{adsTeamPct == null ? '—' : `${adsTeamPct.toFixed(1)}%`}</span></p></article>
            <article className="team-dashboard-card team-dashboard-summary"><p className="td-label">Tổng Lead</p><strong>{Math.round(teamTotals.leads).toLocaleString('vi-VN')}</strong><p className="td-sub">CPL bình quân <span>{cplTeam > 0 ? formatCompactVnd(cplTeam) : '—'}</span></p></article>
            <article className="team-dashboard-card team-dashboard-summary"><p className="td-label">Tổng đơn</p><strong>{teamTotals.orders.toLocaleString('vi-VN')}</strong><p className="td-sub">Tỷ lệ chốt <span className={chotTeam != null && chotTeam >= 15 ? 'td-good' : 'td-warn'}>{chotTeam == null ? '—' : `${chotTeam.toFixed(1)}%`}</span></p></article>
            <article className="team-dashboard-card team-dashboard-summary"><p className="td-label">AOV bình quân</p><strong>{averageOrderValue > 0 ? formatCompactVnd(averageOrderValue) : '—'}</strong><p className="td-sub">CPA mess <span>{teamCpa > 0 ? formatCompactVnd(teamCpa) : '—'}</span></p></article>
          </section>

          <section className="team-dashboard-main-grid">
            <article className="team-dashboard-card team-dashboard-panel">
              <div className="team-dashboard-panel-title"><div><h2>Bảng hiệu suất tổng hợp theo thành viên</h2><p>Team là tổng các nhân sự có báo cáo trong khoảng đã chọn</p></div><button type="button" onClick={exportCsv} disabled={!displayRows.length} className="team-dashboard-export">Export CSV</button></div>
              <div className="team-dashboard-table-wrap">
                <table className="team-dashboard-table">
                  <thead><tr><th>Nhân sự</th><th>Doanh số</th><th>Chi phí</th><th>CP/DT</th><th>Mess</th><th>CPA</th><th>Lead</th><th>CPL</th><th>Đơn</th><th>CPO</th><th>%CR</th><th>AOV</th></tr></thead>
                  <tbody>
                    <tr className="team-row"><td className="person team-name">TEAM · {teamName || '—'}</td><td>{formatCompactVnd(teamTotals.rev)}</td><td>{formatCompactVnd(teamTotals.ads)}</td><td>{adsTeamPct == null ? '—' : `${adsTeamPct.toFixed(1)}%`}</td><td>{Math.round(teamMess).toLocaleString('vi-VN')}</td><td>{teamCpa > 0 ? formatCompactVnd(teamCpa) : '—'}</td><td>{Math.round(teamTotals.leads).toLocaleString('vi-VN')}</td><td>{cplTeam > 0 ? formatCompactVnd(cplTeam) : '—'}</td><td>{teamTotals.orders.toLocaleString('vi-VN')}</td><td>{teamCpo > 0 ? formatCompactVnd(teamCpo) : '—'}</td><td>{chotTeam == null ? '—' : `${chotTeam.toFixed(1)}%`}</td><td>{averageOrderValue > 0 ? formatCompactVnd(averageOrderValue) : '—'}</td></tr>
                    {tableRows.map((row, index) => <tr key={row.m.id}>
                      <td className="person"><span className={`td-rank ${index === 0 ? 'top' : ''}`}>{index + 1}</span>{mktNameWithCode(row.m, mktNameByCode)}</td>
                      <td className={index === 0 ? 'td-good' : ''}>{formatCompactVnd(row.a.rev)}</td><td>{formatCompactVnd(row.a.ads)}</td>
                      <td className={row.cpdt == null ? '' : row.cpdt <= 30 ? 'td-good' : row.cpdt <= 45 ? 'td-warn' : 'td-bad'}>{row.cpdt == null ? '—' : `${row.cpdt.toFixed(1)}%`}</td>
                      <td>{Math.round(row.mess).toLocaleString('vi-VN')}</td><td>{row.cpa > 0 ? formatCompactVnd(row.cpa) : '—'}</td><td>{Math.round(row.lead).toLocaleString('vi-VN')}</td><td>{row.cpl > 0 ? formatCompactVnd(row.cpl) : '—'}</td>
                      <td>{row.a.orders.toLocaleString('vi-VN')}</td><td>{row.cpo > 0 ? formatCompactVnd(row.cpo) : '—'}</td><td>{row.crPct == null ? '—' : `${row.crPct.toFixed(1)}%`}</td><td>{row.aov > 0 ? formatCompactVnd(row.aov) : '—'}</td>
                    </tr>)}
                    {!tableRows.length ? <tr><td colSpan={12} className="td-empty">Chưa có báo cáo của thành viên trong khoảng ngày này.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="team-dashboard-card team-dashboard-panel team-dashboard-share">
              <div className="team-dashboard-panel-title"><div><h2>Tỷ trọng doanh số trong team</h2><p>Theo doanh số thực đạt · {tableRows.length} thành viên</p></div></div>
              <div className="team-dashboard-pie-wrap"><div className="team-dashboard-pie" style={{ background: `conic-gradient(${pieStops})` }}><span>TEAM</span></div></div>
              <div className="team-dashboard-legend">
                {tableRows.map((row, index) => <div className="team-dashboard-legend-item" key={row.m.id}><div className="team-dashboard-legend-name"><i style={{ background: memberColors[index % memberColors.length] }} /> <span>{mktNameWithCode(row.m, mktNameByCode)}</span></div><strong>{teamTotals.rev > 0 ? `${((row.a.rev / teamTotals.rev) * 100).toFixed(1)}%` : '0%'}</strong></div>)}
                {!tableRows.length ? <p className="td-sub">Chưa có dữ liệu doanh số để phân bổ.</p> : null}
              </div>
            </aside>
          </section>

          <section className="team-dashboard-card team-dashboard-progress">
            <div className="team-dashboard-panel-title"><div><h2>Tiến độ theo nhân sự</h2><p>Vạch dọc trên thanh là nhịp kỳ vọng đã qua: {periodPacePct.toFixed(0)}% · Dự báo dựa trên doanh số bình quân mỗi ngày</p></div></div>
            <div className="team-dashboard-table-wrap"><table className="team-dashboard-table team-dashboard-progress-table"><thead><tr><th>Nhân sự</th><th>DS hiện tại</th><th>DS mục tiêu</th><th>Tiến độ</th><th>%</th><th>DS/ngày</th><th>Dự báo</th><th>Trạng thái</th></tr></thead><tbody>
              {progressRows.map((row) => {
                const dailyRevenue = elapsedDays > 0 ? row.a.rev / elapsedDays : 0;
                const barColor = row.state === 'on' ? 'green' : row.state === 'slow' ? 'orange' : row.state === 'risk' ? 'red' : 'orange';
                const stateText = row.state === 'on' ? 'Đúng nhịp' : row.state === 'slow' ? 'Chậm nhịp' : row.state === 'risk' ? 'Nguy cơ hụt' : 'Chưa gán KPI';
                return <tr key={row.m.id}><td className="person">{mktNameWithCode(row.m, mktNameByCode)}</td><td>{formatCompactVnd(row.a.rev)}</td><td>{row.target > 0 ? formatCompactVnd(row.target) : '—'}</td>
                  <td><div className="team-dashboard-track"><i className="team-dashboard-marker" style={{ left: `${periodPacePct}%` }} /><i className={`team-dashboard-fill ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, row.pct || 0))}%` }} /></div></td>
                  <td className={`td-progress-pct ${row.state === 'on' ? 'td-good' : row.state === 'slow' ? 'td-warn' : row.state === 'risk' ? 'td-bad' : ''}`}>{row.pct == null ? '—' : `${row.pct.toFixed(1)}%`}</td><td>{formatCompactVnd(dailyRevenue)}</td><td className={row.forecastPct != null && row.forecastPct >= 100 ? 'td-good' : row.forecastPct != null && row.forecastPct < 80 ? 'td-bad' : 'td-warn'}>{row.forecastPct == null ? '—' : `${row.forecastPct.toFixed(0)}%`}</td><td><span className={`team-dashboard-status ${row.state}`}>{stateText}</span></td></tr>;
              })}
              {!progressRows.length ? <tr><td colSpan={8} className="td-empty">Chưa có thành viên có báo cáo trong khoảng ngày này.</td></tr> : null}
            </tbody></table></div>
          </section>

          <section className="team-dashboard-mini-grid">
            <article className="team-dashboard-card team-dashboard-mini"><h3>Top doanh số</h3><strong>{leaderMember ? `${mktNameWithCode(leaderMember.m, mktNameByCode)} · ${formatCompactVnd(leaderMember.a.rev)}` : 'Chưa có dữ liệu'}</strong><p>{leaderMember && teamTotals.rev > 0 ? `Đóng góp ${((leaderMember.a.rev / teamTotals.rev) * 100).toFixed(1)}% doanh số team` : 'Số liệu sẽ hiện khi có báo cáo.'}</p></article>
            <article className="team-dashboard-card team-dashboard-mini"><h3>Hiệu suất quảng cáo tốt nhất</h3><strong>{bestEfficiency ? `${mktNameWithCode(bestEfficiency.m, mktNameByCode)} · ${bestEfficiency.cpdt?.toFixed(1)}%` : 'Chưa có dữ liệu'}</strong><p>{bestEfficiency ? 'CP/DT thấp nhất trong các thành viên có doanh thu.' : 'Chưa thể tính CP/DT trong kỳ này.'}</p></article>
            <article className="team-dashboard-card team-dashboard-mini"><h3>Cần ưu tiên hỗ trợ</h3><strong className={supportMember && staffTargets.has(supportMember.m.id) ? 'td-bad' : ''}>{supportMember && staffTargets.has(supportMember.m.id) ? `${mktNameWithCode(supportMember.m, mktNameByCode)} · trễ ${Math.max(0, periodPacePct - (supportMember.pct ?? 0)).toFixed(0)} điểm %` : 'Chưa có KPI để so sánh'}</strong><p>{supportMember && staffTargets.has(supportMember.m.id) ? 'Dựa trên tiến độ KPI so với thời gian đã qua.' : 'Gán KPI tháng cho thành viên để theo dõi nhịp.'}</p></article>
          </section>
        </>
      )}

      <button type="button" onClick={() => navigate(crmAdminPathForView('kpi-target'))} className="team-dashboard-kpi-button" title="Gán KPI tháng">＋</button>

      {mktDetailCodeKey != null ? <div className="team-dashboard-modal-backdrop" role="presentation" onClick={() => setMktDetailCodeKey(null)}><div className="team-dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="leader-mkt-detail-title" onClick={(event) => event.stopPropagation()}>
        <div className="team-dashboard-modal-head"><div><h3 id="leader-mkt-detail-title">Chi tiết báo cáo — {mktDetailTitle}</h3><p>{monthLabel} · {mktDetailRows.length} dòng · {DETAIL_REPORTS_TABLE}</p></div><button type="button" onClick={() => setMktDetailCodeKey(null)} aria-label="Đóng"><X size={19} /></button></div>
        <div className="team-dashboard-table-wrap"><table className="team-dashboard-table"><thead><tr><th>Ngày</th><th>MKT</th><th>Mã NS</th><th>Tên trên báo cáo</th><th>Team</th><th>Chi phí</th><th>Doanh thu</th><th>Đơn</th><th>Mess</th><th>Lead / Data</th></tr></thead><tbody>
          {mktDetailRows.map((row, index) => { const date = String((row as { report_date?: string }).report_date || '').slice(0, 10); const revenue = reportRevenueVnd(row as { tien_viet?: unknown; revenue?: unknown }); return <tr key={String((row as { id?: unknown }).id ?? `detail-${index}`)}><td>{date ? formatReportDateVi(date) : '—'}</td><td>{leaderDrMktDisplayName(row, mktNameByCode)}</td><td>{safeTrim((row as { code?: string }).code) || '—'}</td><td>{safeTrim((row as { name?: string }).name) || '—'}</td><td>{safeTrim((row as { team?: string }).team) || '—'}</td><td>{formatCompactVnd(safeNum((row as { ad_cost?: unknown }).ad_cost))}</td><td className="td-good">{formatCompactVnd(revenue)}</td><td>{safeNum((row as { order_count?: unknown }).order_count)}</td><td>{safeNum((row as { mess_comment_count?: unknown }).mess_comment_count)}</td><td>{safeNum((row as { tong_lead?: unknown }).tong_lead)} / {safeNum((row as { tong_data_nhan?: unknown }).tong_data_nhan)}</td></tr>; })}
          {!mktDetailRows.length ? <tr><td colSpan={10} className="td-empty">Không có dòng dữ liệu.</td></tr> : null}
        </tbody></table></div>
      </div></div> : null}
    </div>
  );
};
