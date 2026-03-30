import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { Employee } from '../../../types';
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

export const KpiTargetView: React.FC = () => {
  const [allStaff, setAllStaff] = useState<Employee[]>([]);
  const [teamKey, setTeamKey] = useState('');
  const [ym, setYm] = useState(ymNow);
  const [teamTargetStr, setTeamTargetStr] = useState('');
  const [staffAmounts, setStaffAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of allStaff) {
      const t = e.team?.trim();
      if (t) s.add(t);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allStaff]);

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
        .select('muc_tieu_doanh_thu_team')
        .eq('nam_thang', ym)
        .eq('team_key', teamKey)
        .maybeSingle(),
      ids.length
        ? supabase.from(KPI_STAFF_TABLE).select('employee_id, muc_tieu_vnd').eq('nam_thang', ym).in('employee_id', ids)
        : Promise.resolve({ data: [] as { employee_id: string; muc_tieu_vnd: number }[], error: null }),
    ]);

    if (teamRes.error) {
      console.error('kpi team target:', teamRes.error);
      setError(
        teamRes.error.message.includes('does not exist') || teamRes.error.message.includes('schema cache')
          ? `Chưa có bảng ${KPI_TEAM_TABLE} — chạy supabase/create_kpi_monthly_targets.sql trên Supabase.`
          : teamRes.error.message
      );
      setTeamTargetStr('');
    } else {
      const v = teamRes.data?.muc_tieu_doanh_thu_team;
      setTeamTargetStr(v != null && Number(v) > 0 ? formatVndDots(Number(v)) : '');
    }

    const next: Record<string, string> = {};
    if (staffRes.error) {
      console.error('kpi staff targets:', staffRes.error);
      if (!teamRes.error)
        setError(
          staffRes.error.message.includes('does not exist') || staffRes.error.message.includes('schema cache')
            ? `Chưa có bảng ${KPI_STAFF_TABLE} — chạy supabase/create_kpi_monthly_targets.sql trên Supabase.`
            : staffRes.error.message
        );
    } else {
      const map = new Map((staffRes.data || []).map((r) => [r.employee_id, r.muc_tieu_vnd]));
      for (const e of teamMembers) {
        const n = map.get(e.id);
        next[e.id] = n != null && Number(n) > 0 ? formatVndDots(Number(n)) : '';
      }
    }
    setStaffAmounts(next);
  }, [teamKey, ym, teamMembers]);

  useEffect(() => {
    void loadStaffList();
  }, [loadStaffList]);

  useEffect(() => {
    if (!teamKey && teamOptions.length > 0) setTeamKey(teamOptions[0]);
  }, [teamKey, teamOptions]);

  useEffect(() => {
    if (!teamKey || loading) return;
    void loadTargetsForPeriod();
  }, [teamKey, ym, loading, loadTargetsForPeriod]);

  const setStaffField = (id: string, value: string) => {
    setStaffAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const onSave = async () => {
    if (!teamKey) {
      window.alert('Chọn team.');
      return;
    }
    const teamNum = parseVndInput(teamTargetStr);
    if (teamTargetStr.trim() && teamNum == null) {
      window.alert('Mục tiêu team: nhập số VNĐ hợp lệ hoặc để trống.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: tErr } = await supabase.from(KPI_TEAM_TABLE).upsert(
        {
          nam_thang: ym,
          team_key: teamKey,
          muc_tieu_doanh_thu_team: teamNum ?? 0,
        },
        { onConflict: 'nam_thang,team_key' }
      );
      if (tErr) throw tErr;

      const staffRows = teamMembers.map((e) => ({
        nam_thang: ym,
        employee_id: e.id,
        muc_tieu_vnd: parseVndInput(staffAmounts[e.id] || '') ?? 0,
      }));

      if (staffRows.length > 0) {
        const { error: sErr } = await supabase.from(KPI_STAFF_TABLE).upsert(staffRows, {
          onConflict: 'nam_thang,employee_id',
        });
        if (sErr) throw sErr;
      }

      await loadTargetsForPeriod();
      window.alert('Đã lưu mục tiêu.');
    } catch (e) {
      console.error('kpi save:', e);
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes('does not exist') || msg.includes('schema cache')
          ? 'Chạy supabase/create_kpi_monthly_targets.sql trên Supabase.'
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dash-fade-up space-y-[14px]">
      <p className="text-[10px] text-[var(--text3)] leading-relaxed">
        Nguồn: <code className="text-[var(--text2)]">{KPI_TEAM_TABLE}</code>,{' '}
        <code className="text-[var(--text2)]">{KPI_STAFF_TABLE}</code> · team khớp{' '}
        <code className="text-[var(--text2)]">{EMPLOYEES_TABLE}.team</code>.
      </p>

      {error && (
        <div className="text-[11px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[var(--r)] px-3 py-2 bg-[var(--Rd)]/20">
          {error}
        </div>
      )}

      <SectionCard
        title="🎯 Thiết lập KPI & Mục tiêu doanh thu tháng"
        actions={
          <button
            type="button"
            onClick={() => void loadStaffList()}
            disabled={loading}
            className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold border border-[rgba(255,255,255,0.08)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mb-[24px]">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">
                  Team
                </label>
                <select
                  value={teamKey}
                  onChange={(e) => setTeamKey(e.target.value)}
                  className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[13px] font-bold text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
                >
                  {teamOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
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

            <div className="space-y-[12px] mb-[24px]">
              <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-[1.5px] pb-[8px] border-b border-[var(--border)]">
                Phân bổ theo nhân sự trong team ({teamMembers.length})
              </div>

              {teamMembers.length === 0 ? (
                <div className="text-[11px] text-[var(--text3)] py-4">
                  Không có nhân sự đang hoạt động trong team này (trạng thái nghỉ đã ẩn).
                </div>
              ) : (
                teamMembers.map((mkt) => (
                  <div
                    key={mkt.id}
                    className="flex items-center justify-between p-[12px_16px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-[10px] group hover:border-[rgba(61,142,240,0.3)] transition-all gap-3 flex-wrap"
                  >
                    <div className="flex items-center gap-[16px] min-w-0">
                      <span className="text-[11px] font-bold text-[#3d8ef0] w-[56px] shrink-0">{displayMaNs(mkt)}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] font-extrabold text-[#fff] truncate">{mkt.name}</span>
                        {mkt.vi_tri?.trim() ? (
                          <span className="text-[9px] text-[var(--text3)] truncate">{mkt.vi_tri}</span>
                        ) : null}
                      </div>
                      {mkt.trang_thai === 'dot_tien' ? <Badge type="R">Đốt tiền</Badge> : null}
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[9px] text-[var(--text3)] uppercase font-bold mb-[4px]">Mục tiêu (VND)</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={staffAmounts[mkt.id] ?? ''}
                        onChange={(e) => setStaffField(mkt.id, formatTypingGroupedInt(e.target.value))}
                        placeholder="0"
                        className="w-[160px] bg-[var(--bg4)] border border-[var(--border)] rounded-[6px] p-[6px_10px] text-[12px] font-[var(--mono)] font-bold text-right text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              disabled={saving || !teamKey}
              onClick={() => void onSave()}
              className="flex items-center gap-[8px] bg-[#3d8ef0] hover:bg-[#2e7dd1] disabled:opacity-50 text-white p-[10px_24px] rounded-[8px] text-[12px] font-bold transition-all shadow-[0_4px_16px_rgba(61,142,240,0.3)]"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              💾 Lưu mục tiêu
            </button>
          </>
        )}
      </SectionCard>
    </div>
  );
};
