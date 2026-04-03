import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { AuthUser, Employee } from '../../../types';
import { formatNumberDots, formatTypingGroupedInt } from '../mkt/mktDetailReportShared';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const KPI_TEAM_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_TEAM_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_team_monthly_targets';
const KPI_STAFF_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_STAFF_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_staff_monthly_targets';

const STAFF_SELECT = 'id, name, team, ma_ns, vi_tri, trang_thai';

function ymNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatVndDots(n: number): string {
  return formatNumberDots(Math.round(n), true);
}

function formatCountDots(n: number): string {
  return formatNumberDots(Math.round(n), true);
}

function parseVndInput(raw: string): number | null {
  const t = raw.replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function displayMaNs(row: Employee): string {
  const m = row.ma_ns?.trim();
  if (m) return m;
  return row.id.slice(0, 8).toUpperCase();
}

function isActiveStaff(tt: string | null | undefined): boolean {
  return tt === 'dang_lam' || tt === 'tam_nghi' || tt === 'dot_tien';
}

type KpiTargetViewProps = {
  viewer?: AuthUser | null;
};

export const KpiTargetView: React.FC<KpiTargetViewProps> = ({ viewer = null }) => {
  const [allStaff, setAllStaff] = useState<Employee[]>([]);
  const [teamKey, setTeamKey] = useState('');
  const [ym, setYm] = useState(ymNow);
  const [teamTargetStr, setTeamTargetStr] = useState('');
  const [teamLeadTargetStr, setTeamLeadTargetStr] = useState('');
  const [teamOrdersTargetStr, setTeamOrdersTargetStr] = useState('');
  const [staffAmounts, setStaffAmounts] = useState<Record<string, string>>({});
  const [staffLeadAmounts, setStaffLeadAmounts] = useState<Record<string, string>>({});
  const [staffOrderAmounts, setStaffOrderAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [teamHistory, setTeamHistory] = useState<
    Array<{
      nam_thang: string;
      muc_tieu_doanh_thu_team: number | null;
      muc_tieu_lead_team: number | null;
      muc_tieu_don_chot_team: number | null;
      updated_at?: string | null;
    }>
  >([]);

  const teamOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of allStaff) {
      const t = e.team?.trim();
      if (t) s.add(t);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allStaff]);

  const viewerTeam = (viewer?.team || '').trim();
  const viewerTeamLocked = Boolean(viewerTeam);

  const teamMembers = useMemo(() => {
    if (!teamKey) return [];
    return allStaff
      .filter((e) => e.team?.trim() === teamKey && isActiveStaff(e.trang_thai))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [allStaff, teamKey]);

  const loadStaffList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await supabase.from(EMPLOYEES_TABLE).select(STAFF_SELECT).order('name', { ascending: true });
    if (res.error) {
      console.error('kpi-target employees:', res.error);
      setError(res.error.message || 'Không tải được nhân sự.');
      setAllStaff([]);
      setLoading(false);
      return;
    }
    const rows = (res.data || []) as Employee[];
    setAllStaff(rows);
    setLoading(false);
  }, []);

  const loadTargetsForPeriod = useCallback(async () => {
    if (!teamKey || !ym) return;
    setError(null);
    const ids = teamMembers.map((e) => e.id);
    const [teamRes, staffRes] = await Promise.all([
      supabase
        .from(KPI_TEAM_TABLE)
        .select('muc_tieu_doanh_thu_team, muc_tieu_lead_team, muc_tieu_don_chot_team')
        .eq('nam_thang', ym)
        .eq('team_key', teamKey)
        .maybeSingle(),
      ids.length
        ? supabase
            .from(KPI_STAFF_TABLE)
            .select('employee_id, muc_tieu_vnd, muc_tieu_lead, muc_tieu_don_chot')
            .eq('nam_thang', ym)
            .in('employee_id', ids)
        : Promise.resolve({
            data: [] as { employee_id: string; muc_tieu_vnd: number; muc_tieu_lead: number; muc_tieu_don_chot: number }[],
            error: null,
          }),
    ]);

    if (teamRes.error) {
      console.error('kpi team target:', teamRes.error);
      setError(
        teamRes.error.message.includes('muc_tieu_lead_team') ||
        teamRes.error.message.includes('muc_tieu_don_chot_team') ||
        teamRes.error.message.includes('muc_tieu_lead') ||
        teamRes.error.message.includes('muc_tieu_don_chot')
          ? 'Thiếu cột KPI Lead/Đơn chốt — chạy supabase/alter_kpi_monthly_targets_add_lead_order_targets.sql trên Supabase.'
          : teamRes.error.message.includes('does not exist') || teamRes.error.message.includes('schema cache')
            ? `Chưa có bảng ${KPI_TEAM_TABLE} — chạy supabase/create_kpi_monthly_targets.sql trên Supabase.`
          : teamRes.error.message
      );
      setTeamTargetStr('');
      setTeamLeadTargetStr('');
      setTeamOrdersTargetStr('');
    } else {
      const rev = teamRes.data?.muc_tieu_doanh_thu_team;
      const lead = teamRes.data?.muc_tieu_lead_team;
      const orders = teamRes.data?.muc_tieu_don_chot_team;
      setTeamTargetStr(rev != null && Number(rev) > 0 ? formatVndDots(Number(rev)) : '');
      setTeamLeadTargetStr(lead != null && Number(lead) > 0 ? formatCountDots(Number(lead)) : '');
      setTeamOrdersTargetStr(orders != null && Number(orders) > 0 ? formatCountDots(Number(orders)) : '');
    }

    const nextRev: Record<string, string> = {};
    const nextLead: Record<string, string> = {};
    const nextOrders: Record<string, string> = {};
    if (staffRes.error) {
      console.error('kpi staff targets:', staffRes.error);
      if (!teamRes.error)
        setError(
          staffRes.error.message.includes('muc_tieu_lead_team') ||
          staffRes.error.message.includes('muc_tieu_don_chot_team') ||
          staffRes.error.message.includes('muc_tieu_lead') ||
          staffRes.error.message.includes('muc_tieu_don_chot')
            ? 'Thiếu cột KPI Lead/Đơn chốt — chạy supabase/alter_kpi_monthly_targets_add_lead_order_targets.sql trên Supabase.'
            : staffRes.error.message.includes('does not exist') || staffRes.error.message.includes('schema cache')
              ? `Chưa có bảng ${KPI_STAFF_TABLE} — chạy supabase/create_kpi_monthly_targets.sql trên Supabase.`
            : staffRes.error.message
        );
    } else {
      const rows = staffRes.data || [];
      const mapRev = new Map(rows.map((r) => [r.employee_id, r.muc_tieu_vnd]));
      const mapLead = new Map(rows.map((r) => [r.employee_id, r.muc_tieu_lead]));
      const mapOrders = new Map(rows.map((r) => [r.employee_id, r.muc_tieu_don_chot]));
      for (const e of teamMembers) {
        const nRev = mapRev.get(e.id);
        const nLead = mapLead.get(e.id);
        const nOrders = mapOrders.get(e.id);
        nextRev[e.id] = nRev != null && Number(nRev) > 0 ? formatVndDots(Number(nRev)) : '';
        nextLead[e.id] = nLead != null && Number(nLead) > 0 ? formatCountDots(Number(nLead)) : '';
        nextOrders[e.id] = nOrders != null && Number(nOrders) > 0 ? formatCountDots(Number(nOrders)) : '';
      }
    }
    setStaffAmounts(nextRev);
    setStaffLeadAmounts(nextLead);
    setStaffOrderAmounts(nextOrders);
  }, [teamKey, ym, teamMembers]);

  const loadTeamHistory = useCallback(async () => {
    if (!teamKey) {
      setTeamHistory([]);
      return;
    }
    setHistoryLoading(true);
    const q = await supabase
      .from(KPI_TEAM_TABLE)
      .select('nam_thang, muc_tieu_doanh_thu_team, muc_tieu_lead_team, muc_tieu_don_chot_team, updated_at')
      .eq('team_key', teamKey)
      .order('nam_thang', { ascending: false })
      .limit(24);

    if (q.error) {
      console.error('kpi team history:', q.error);
      setTeamHistory([]);
    } else {
      setTeamHistory(
        (q.data || []) as Array<{
          nam_thang: string;
          muc_tieu_doanh_thu_team: number | null;
          muc_tieu_lead_team: number | null;
          muc_tieu_don_chot_team: number | null;
          updated_at?: string | null;
        }>
      );
    }
    setHistoryLoading(false);
  }, [teamKey]);

  useEffect(() => {
    void loadStaffList();
  }, [loadStaffList]);

  useEffect(() => {
    if (teamOptions.length === 0) return;
    if (viewerTeam && teamOptions.includes(viewerTeam)) {
      if (teamKey !== viewerTeam) setTeamKey(viewerTeam);
      return;
    }
    if (!teamKey) setTeamKey(teamOptions[0]);
  }, [teamKey, teamOptions, viewerTeam]);

  useEffect(() => {
    if (!teamKey || loading) return;
    void loadTargetsForPeriod();
  }, [teamKey, ym, loading, loadTargetsForPeriod]);

  useEffect(() => {
    if (!teamKey || loading) return;
    void loadTeamHistory();
  }, [teamKey, loading, loadTeamHistory]);

  const setStaffField = (id: string, value: string) => {
    setStaffAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const setStaffLeadField = (id: string, value: string) => {
    setStaffLeadAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const setStaffOrderField = (id: string, value: string) => {
    setStaffOrderAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const teamSummary = useMemo(() => {
    const rev = parseVndInput(teamTargetStr) ?? 0;
    const lead = parseVndInput(teamLeadTargetStr) ?? 0;
    const orders = parseVndInput(teamOrdersTargetStr) ?? 0;
    return { rev, lead, orders };
  }, [teamTargetStr, teamLeadTargetStr, teamOrdersTargetStr]);

  const allocationSummary = useMemo(() => {
    let revTotal = 0;
    let leadTotal = 0;
    let orderTotal = 0;
    let configured = 0;
    for (const m of teamMembers) {
      const rev = parseVndInput(staffAmounts[m.id] || '') ?? 0;
      const lead = parseVndInput(staffLeadAmounts[m.id] || '') ?? 0;
      const ord = parseVndInput(staffOrderAmounts[m.id] || '') ?? 0;
      revTotal += rev;
      leadTotal += lead;
      orderTotal += ord;
      if (rev > 0 || lead > 0 || ord > 0) configured += 1;
    }
    return { revTotal, leadTotal, orderTotal, configured };
  }, [teamMembers, staffAmounts, staffLeadAmounts, staffOrderAmounts]);

  const balanceSummary = useMemo(() => {
    const revDiff = allocationSummary.revTotal - teamSummary.rev;
    const leadDiff = allocationSummary.leadTotal - teamSummary.lead;
    const orderDiff = allocationSummary.orderTotal - teamSummary.orders;
    return { revDiff, leadDiff, orderDiff };
  }, [allocationSummary, teamSummary]);

  const diffClass = (v: number) =>
    v === 0
      ? 'text-[var(--G)] bg-[var(--Gd)] border-[var(--Gb)]'
      : v > 0
        ? 'text-[var(--Y)] bg-[var(--Yd)] border-[var(--Yb)]'
        : 'text-[var(--R)] bg-[var(--Rd)] border-[var(--Rb)]';

  const onSave = async () => {
    if (!teamKey) {
      window.alert('Chọn team.');
      return;
    }
    const teamRevNum = parseVndInput(teamTargetStr);
    const teamLeadNum = parseVndInput(teamLeadTargetStr);
    const teamOrdersNum = parseVndInput(teamOrdersTargetStr);
    if (teamTargetStr.trim() && teamRevNum == null) {
      window.alert('Mục tiêu team: nhập số VNĐ hợp lệ hoặc để trống.');
      return;
    }
    if (teamLeadTargetStr.trim() && teamLeadNum == null) {
      window.alert('Mục tiêu Lead team: nhập số hợp lệ hoặc để trống.');
      return;
    }
    if (teamOrdersTargetStr.trim() && teamOrdersNum == null) {
      window.alert('Mục tiêu Đơn chốt team: nhập số hợp lệ hoặc để trống.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: tErr } = await supabase.from(KPI_TEAM_TABLE).upsert(
        {
          nam_thang: ym,
          team_key: teamKey,
          muc_tieu_doanh_thu_team: teamRevNum ?? 0,
          muc_tieu_lead_team: teamLeadNum ?? 0,
          muc_tieu_don_chot_team: teamOrdersNum ?? 0,
        },
        { onConflict: 'nam_thang,team_key' }
      );
      if (tErr) throw tErr;

      const staffRows = teamMembers.map((e) => ({
        nam_thang: ym,
        employee_id: e.id,
        muc_tieu_vnd: parseVndInput(staffAmounts[e.id] || '') ?? 0,
        muc_tieu_lead: parseVndInput(staffLeadAmounts[e.id] || '') ?? 0,
        muc_tieu_don_chot: parseVndInput(staffOrderAmounts[e.id] || '') ?? 0,
      }));

      if (staffRows.length > 0) {
        const { error: sErr } = await supabase.from(KPI_STAFF_TABLE).upsert(staffRows, {
          onConflict: 'nam_thang,employee_id',
        });
        if (sErr) throw sErr;
      }

      await loadTargetsForPeriod();
      await loadTeamHistory();
      window.alert('Đã lưu mục tiêu.');
    } catch (e) {
      console.error('kpi save:', e);
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes('muc_tieu_lead_team') ||
        msg.includes('muc_tieu_don_chot_team') ||
        msg.includes('muc_tieu_lead') ||
        msg.includes('muc_tieu_don_chot')
          ? 'Thiếu cột KPI Lead/Đơn chốt — chạy supabase/alter_kpi_monthly_targets_add_lead_order_targets.sql trên Supabase.'
          : msg.includes('does not exist') || msg.includes('schema cache')
            ? 'Chạy supabase/create_kpi_monthly_targets.sql trên Supabase.'
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dash-fade-up space-y-[14px]">
      {error && (
        <div className="text-[11px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[var(--r)] px-3 py-2 bg-[var(--Rd)]/20">
          {error}
        </div>
      )}

      <SectionCard
        title="🎯 Thiết lập KPI & Mục tiêu tháng (Doanh thu/Lead/Đơn chốt)"
        subtitle="Thiết lập theo team và phân bổ xuống từng nhân sự"
        actions={
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={() => setFormOpen((prev) => !prev)}
              className="flex items-center gap-[6px] bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold border border-[rgba(61,142,240,0.35)]"
            >
              {formOpen ? 'Ẩn form' : '+ Add KPI tháng'}
            </button>
            <button
              type="button"
              onClick={() => void loadStaffList()}
              disabled={loading}
              className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold border border-[rgba(255,255,255,0.08)] disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
        }
      >
        {loading && !allStaff.length ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[var(--text3)] text-[12px]">
            <Loader2 className="animate-spin" size={20} />
            Đang tải…
          </div>
        ) : teamOptions.length === 0 ? (
          <div className="text-[11px] text-[var(--text3)] py-6">
            Chưa có nhân sự hoặc thiếu trường <code className="text-[var(--text2)]">team</code> — cập nhật tại{' '}
            <code className="text-[var(--text2)]">/crm-admin/staff</code>.
          </div>
        ) : (
          <>
            {formOpen ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-[10px] mb-[16px]">
              <div className="rounded-[10px] border border-[rgba(61,142,240,0.25)] bg-[rgba(61,142,240,0.08)] p-[10px_12px]">
                <div className="text-[9px] uppercase tracking-[1px] font-bold text-[var(--text3)]">Mục tiêu team</div>
                <div className="mt-1 text-[12px] font-bold text-[#fff]">{teamSummary.rev > 0 ? `${formatVndDots(teamSummary.rev)} VND` : '—'}</div>
              </div>
              <div className="rounded-[10px] border border-[rgba(132,204,22,0.25)] bg-[rgba(132,204,22,0.08)] p-[10px_12px]">
                <div className="text-[9px] uppercase tracking-[1px] font-bold text-[var(--text3)]">Lead team</div>
                <div className="mt-1 text-[12px] font-bold text-[#fff]">{teamSummary.lead > 0 ? formatCountDots(teamSummary.lead) : '—'}</div>
              </div>
              <div className="rounded-[10px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] p-[10px_12px]">
                <div className="text-[9px] uppercase tracking-[1px] font-bold text-[var(--text3)]">Đơn chốt team</div>
                <div className="mt-1 text-[12px] font-bold text-[#fff]">{teamSummary.orders > 0 ? formatCountDots(teamSummary.orders) : '—'}</div>
              </div>
              <div className="rounded-[10px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] p-[10px_12px]">
                <div className="text-[9px] uppercase tracking-[1px] font-bold text-[var(--text3)]">Nhân sự đã cấu hình</div>
                <div className="mt-1 text-[12px] font-bold text-[#fff]">
                  {allocationSummary.configured}/{teamMembers.length}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[10px] mb-[16px]">
              <div className={`rounded-[8px] border px-[10px] py-[8px] text-[10px] font-bold ${diffClass(balanceSummary.revDiff)}`}>
                Cân bằng DT: {balanceSummary.revDiff === 0 ? 'Đủ phân bổ' : balanceSummary.revDiff > 0 ? `Vượt +${formatVndDots(balanceSummary.revDiff)} VND` : `Thiếu ${formatVndDots(Math.abs(balanceSummary.revDiff))} VND`}
              </div>
              <div className={`rounded-[8px] border px-[10px] py-[8px] text-[10px] font-bold ${diffClass(balanceSummary.leadDiff)}`}>
                Cân bằng Lead: {balanceSummary.leadDiff === 0 ? 'Đủ phân bổ' : balanceSummary.leadDiff > 0 ? `Vượt +${formatCountDots(balanceSummary.leadDiff)}` : `Thiếu ${formatCountDots(Math.abs(balanceSummary.leadDiff))}`}
              </div>
              <div className={`rounded-[8px] border px-[10px] py-[8px] text-[10px] font-bold ${diffClass(balanceSummary.orderDiff)}`}>
                Cân bằng Đơn: {balanceSummary.orderDiff === 0 ? 'Đủ phân bổ' : balanceSummary.orderDiff > 0 ? `Vượt +${formatCountDots(balanceSummary.orderDiff)}` : `Thiếu ${formatCountDots(Math.abs(balanceSummary.orderDiff))}`}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mb-[20px]">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">
                  Team
                </label>
                <select
                  value={teamKey}
                  onChange={(e) => setTeamKey(e.target.value)}
                  disabled={viewerTeamLocked}
                  className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[13px] font-bold text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
                >
                  {teamOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {viewerTeamLocked ? (
                  <p className="mt-[6px] text-[10px] text-[var(--text3)]">
                    Team tự động theo tài khoản đăng nhập.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">
                  Doanh thu mục tiêu cả team
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={teamTargetStr}
                  onChange={(e) => setTeamTargetStr(formatTypingGroupedInt(e.target.value))}
                  placeholder="VD: 1.500.000.000"
                  className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[13px] font-[var(--mono)] font-bold text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">
                  Mục tiêu Lead cả team
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={teamLeadTargetStr}
                  onChange={(e) => setTeamLeadTargetStr(formatTypingGroupedInt(e.target.value))}
                  placeholder="VD: 10.000"
                  className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[13px] font-[var(--mono)] font-bold text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">
                  Mục tiêu Đơn chốt cả team
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={teamOrdersTargetStr}
                  onChange={(e) => setTeamOrdersTargetStr(formatTypingGroupedInt(e.target.value))}
                  placeholder="VD: 400"
                  className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[13px] font-[var(--mono)] font-bold text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">
                  Tháng áp dụng
                </label>
                <input
                  type="month"
                  value={ym}
                  onChange={(e) => setYm(e.target.value)}
                  className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[13px] font-bold text-[var(--text2)] outline-none focus:border-[var(--accent)] transition-all"
                />
              </div>
            </div>

            <div className="space-y-[12px] mb-[20px]">
              <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-[1.5px] pb-[8px] border-b border-[var(--border)]">
                Phân bổ theo nhân sự trong team ({teamMembers.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-[10px]">
                <div className="rounded-[8px] border border-[rgba(61,142,240,0.25)] bg-[rgba(61,142,240,0.08)] p-[8px_10px] text-[10px] font-bold text-[var(--text2)]">
                  Tổng phân bổ DT: {allocationSummary.revTotal > 0 ? `${formatVndDots(allocationSummary.revTotal)} VND` : '—'}
                </div>
                <div className="rounded-[8px] border border-[rgba(132,204,22,0.25)] bg-[rgba(132,204,22,0.08)] p-[8px_10px] text-[10px] font-bold text-[var(--text2)]">
                  Tổng phân bổ Lead: {allocationSummary.leadTotal > 0 ? formatCountDots(allocationSummary.leadTotal) : '—'}
                </div>
                <div className="rounded-[8px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] p-[8px_10px] text-[10px] font-bold text-[var(--text2)]">
                  Tổng phân bổ Đơn: {allocationSummary.orderTotal > 0 ? formatCountDots(allocationSummary.orderTotal) : '—'}
                </div>
              </div>

              {teamMembers.length === 0 ? (
                <div className="text-[11px] text-[var(--text3)] py-4">
                  Không có nhân sự đang hoạt động trong team này (trạng thái nghỉ đã ẩn).
                </div>
              ) : (
                teamMembers.map((mkt) => (
                  <div
                    key={mkt.id}
                    className="p-[12px_14px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[10px] group hover:border-[rgba(61,142,240,0.3)] transition-all"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-[12px] min-w-0">
                        <span className="text-[11px] font-bold text-[#3d8ef0] w-[56px] shrink-0">{displayMaNs(mkt)}</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[12px] font-extrabold text-[#fff] truncate">{mkt.name}</span>
                          {mkt.vi_tri?.trim() ? (
                            <span className="text-[9px] text-[var(--text3)] truncate">{mkt.vi_tri}</span>
                          ) : null}
                        </div>
                      </div>
                      {mkt.trang_thai === 'dot_tien' ? <Badge type="R">Đốt tiền</Badge> : null}
                    </div>
                    <div className="mt-[10px] grid grid-cols-1 md:grid-cols-3 gap-[8px]">
                      <div className="rounded-[8px] border border-[rgba(61,142,240,0.2)] bg-[rgba(61,142,240,0.06)] p-[8px]">
                        <span className="block text-[9px] text-[var(--text3)] uppercase font-bold mb-[4px]">Mục tiêu (VND)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={staffAmounts[mkt.id] ?? ''}
                          onChange={(e) => setStaffField(mkt.id, formatTypingGroupedInt(e.target.value))}
                          placeholder="0"
                          className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[6px] p-[6px_10px] text-[12px] font-[var(--mono)] font-bold text-right text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
                        />
                      </div>
                      <div className="rounded-[8px] border border-[rgba(132,204,22,0.2)] bg-[rgba(132,204,22,0.06)] p-[8px]">
                        <span className="block text-[9px] text-[var(--text3)] uppercase font-bold mb-[4px]">Lead</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={staffLeadAmounts[mkt.id] ?? ''}
                          onChange={(e) => setStaffLeadField(mkt.id, formatTypingGroupedInt(e.target.value))}
                          placeholder="0"
                          className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[6px] p-[6px_10px] text-[12px] font-[var(--mono)] font-bold text-right text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
                        />
                      </div>
                      <div className="rounded-[8px] border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.06)] p-[8px]">
                        <span className="block text-[9px] text-[var(--text3)] uppercase font-bold mb-[4px]">Đơn chốt</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={staffOrderAmounts[mkt.id] ?? ''}
                          onChange={(e) => setStaffOrderField(mkt.id, formatTypingGroupedInt(e.target.value))}
                          placeholder="0"
                          className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[6px] p-[6px_10px] text-[12px] font-[var(--mono)] font-bold text-right text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            </>
            ) : (
              <div className="mb-[20px] rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-[12px] text-[11px] text-[var(--text2)]">
                Form nhập KPI đang ẩn. Bấm <span className="font-bold text-[#8fc6ff]">+ Add KPI tháng</span> để mở form tạo/chỉnh KPI.
              </div>
            )}

            <div className="mb-[24px]">
              <div className="flex items-center justify-between gap-2 pb-[8px] border-b border-[var(--border)]">
                <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-[1.5px]">
                  Bảng mục tiêu theo tháng ({teamKey || 'Team'})
                </div>
                <button
                  type="button"
                  onClick={() => void loadTeamHistory()}
                  disabled={historyLoading}
                  className="text-[10px] px-[9px] py-[5px] rounded-[6px] border border-[var(--border)] bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--bg4)] disabled:opacity-50"
                >
                  {historyLoading ? 'Đang tải…' : 'Làm mới bảng'}
                </button>
              </div>
              <div className="mt-[10px] overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)]">
                      <th className="p-[8px_10px] text-left">Tháng</th>
                      <th className="p-[8px_10px] text-right">Doanh thu mục tiêu</th>
                      <th className="p-[8px_10px] text-right">Lead mục tiêu</th>
                      <th className="p-[8px_10px] text-right">Đơn chốt mục tiêu</th>
                      <th className="p-[8px_10px] text-left">Cập nhật</th>
                      <th className="p-[8px_10px] text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] text-[var(--text2)]">
                    {historyLoading ? (
                      <tr>
                        <td colSpan={6} className="p-[14px] text-center text-[var(--text3)]">
                          Đang tải dữ liệu KPI tháng…
                        </td>
                      </tr>
                    ) : teamHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-[14px] text-center text-[var(--text3)]">
                          Chưa có dữ liệu KPI theo tháng cho team này.
                        </td>
                      </tr>
                    ) : (
                      teamHistory.map((r) => {
                        const selected = ym === r.nam_thang;
                        return (
                          <tr
                            key={r.nam_thang}
                            className={`border-b border-[rgba(255,255,255,0.04)] ${selected ? 'bg-[rgba(61,142,240,0.12)]' : 'hover:bg-[rgba(255,255,255,0.03)]'}`}
                          >
                            <td className="p-[8px_10px] font-bold text-[#fff]">{r.nam_thang}</td>
                            <td className="p-[8px_10px] text-right font-[var(--mono)]">
                              {Number(r.muc_tieu_doanh_thu_team || 0) > 0
                                ? `${formatVndDots(Number(r.muc_tieu_doanh_thu_team || 0))} VND`
                                : '—'}
                            </td>
                            <td className="p-[8px_10px] text-right font-[var(--mono)]">
                              {Number(r.muc_tieu_lead_team || 0) > 0
                                ? formatCountDots(Number(r.muc_tieu_lead_team || 0))
                                : '—'}
                            </td>
                            <td className="p-[8px_10px] text-right font-[var(--mono)]">
                              {Number(r.muc_tieu_don_chot_team || 0) > 0
                                ? formatCountDots(Number(r.muc_tieu_don_chot_team || 0))
                                : '—'}
                            </td>
                            <td className="p-[8px_10px] text-[10px] text-[var(--text3)]">
                              {r.updated_at ? new Date(r.updated_at).toLocaleString('vi-VN') : '—'}
                            </td>
                            <td className="p-[8px_10px] text-center">
                              <div className="inline-flex items-center gap-[6px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setYm(r.nam_thang);
                                    setFormOpen(true);
                                  }}
                                  className={`px-[8px] py-[4px] rounded-[6px] text-[10px] font-bold border ${
                                    selected
                                      ? 'bg-[rgba(61,142,240,0.2)] border-[rgba(61,142,240,0.45)] text-[#8fc6ff]'
                                      : 'bg-[var(--bg3)] border-[var(--border)] text-[var(--text2)] hover:bg-[var(--bg4)]'
                                  }`}
                                >
                                  {selected ? 'Đang chọn' : 'Chọn'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setYm(r.nam_thang);
                                    setFormOpen(true);
                                  }}
                                  className="px-[8px] py-[4px] rounded-[6px] text-[10px] font-bold border border-[rgba(61,142,240,0.35)] bg-[rgba(61,142,240,0.14)] text-[#8fc6ff] hover:bg-[rgba(61,142,240,0.2)]"
                                >
                                  Sửa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {formOpen ? (
              <button
                type="button"
                disabled={saving || !teamKey}
                onClick={() => void onSave()}
                className="flex items-center gap-[8px] bg-[#3d8ef0] hover:bg-[#2e7dd1] disabled:opacity-50 text-white p-[10px_24px] rounded-[8px] text-[12px] font-bold transition-all shadow-[0_4px_16px_rgba(61,142,240,0.3)]"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                💾 Lưu mục tiêu
              </button>
            ) : null}
          </>
        )}
      </SectionCard>
    </div>
  );
};
