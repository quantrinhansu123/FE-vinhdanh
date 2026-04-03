import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';
import { supabase } from '../../../api/supabase';
import type { AuthUser, Employee } from '../../../types';
import {
  REPORTS_TABLE,
} from '../mkt/mktDetailReportShared';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';
const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';
const MARKETING_STAFF_TABLE =
  import.meta.env.VITE_SUPABASE_MARKETING_STAFF_TABLE?.trim() || 'marketing_staff';

const KPI_STAFF_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_STAFF_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_staff_monthly_targets';

function ymNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthBounds(ym: string): { start: string; end: string } {
  const [ys, ms] = ym.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

function isMktEmployee(viTri: string | null | undefined): boolean {
  const raw = (viTri || '').trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  if (t === 'nhân viên mkt') return true;
  const u = raw.toUpperCase();
  if (u === 'MKT' || u === 'MARKETING') return true;
  if (/\bMKT\b/.test(u)) return true;
  return u.startsWith('MKT/') || u.startsWith('MKT-');
}

function isActiveStaff(tt: string | null | undefined): boolean {
  return tt === 'dang_lam' || tt === 'tam_nghi' || tt === 'dot_tien';
}

function safeTrim(v: unknown): string {
  return String(v ?? '').trim();
}

function formatDateVn(iso: string | null | undefined): string {
  const s = (iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function kpiBadge(kpiPct: number | null | undefined): { type: 'G' | 'Y' | 'R' | 'default'; label: string } {
  if (kpiPct == null || !Number.isFinite(kpiPct)) return { type: 'default', label: '—' };
  if (kpiPct >= 85) return { type: 'G', label: 'Hoạt động' };
  if (kpiPct >= 50) return { type: 'Y', label: 'Monitor' };
  return { type: 'R', label: 'Cảnh báo' };
}

type Row = {
  emp: Employee;
  tkqcCount: number;
  rev: number;
  target: number | null;
  kpiPct: number | null;
};

export type LeaderMktViewProps = {
  viewer?: AuthUser | null;
};

export const LeaderMktView: React.FC<LeaderMktViewProps> = ({ viewer = null }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ym, setYm] = useState(ymNow);

  const [rows, setRows] = useState<Row[]>([]);
  const [managedTeams, setManagedTeams] = useState<string[]>([]);

  const load = useCallback(async () => {
    const fallbackTeam = viewer?.team?.trim() || '';
    const viewerName = viewer?.name?.trim() || '';
    const viewerEmail = viewer?.email?.trim().toLowerCase() || '';
    setLoading(true);
    setError(null);
    setRows([]);
    setManagedTeams([]);

    if (!viewerEmail && !fallbackTeam && !viewerName) {
      setError('Cần đăng nhập để xem danh sách Marketing.');
      setLoading(false);
      return;
    }

    const { start, end } = monthBounds(ym);

    // Ưu tiên team leader đang phụ trách từ CRM teams, fallback về viewer.team
    let teamKeys: string[] = [];
    if (viewerName) {
      const teamRes = await supabase
        .from(TEAMS_TABLE)
        .select('ten_team, leader')
        .eq('leader', viewerName);
      if (!teamRes.error) {
        teamKeys = (teamRes.data || [])
          .map((r) => safeTrim((r as { ten_team?: string }).ten_team))
          .filter(Boolean);
      } else {
        console.warn('leader-mkt teams:', teamRes.error);
      }
    }
    if (!teamKeys.length && fallbackTeam) teamKeys = [fallbackTeam];
    teamKeys = [...new Set(teamKeys.map((x) => x.trim()).filter(Boolean))];
    setManagedTeams(teamKeys);

    if (!teamKeys.length) {
      setError('Không xác định được team phụ trách của tài khoản leader.');
      setLoading(false);
      return;
    }

    const empRes = await supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, email, team, ma_ns, ngay_bat_dau, du_an_ten, vi_tri, trang_thai')
      .in('team', teamKeys)
      .order('name', { ascending: true });

    if (empRes.error) {
      console.error('leader-mkt employees:', empRes.error);
      setError(empRes.error.message || 'Không tải được nhân sự.');
      setLoading(false);
      return;
    }

    const allEmps = (empRes.data || []) as Employee[];
    const mktEmps = allEmps.filter((e) => isMktEmployee(e.vi_tri) && isActiveStaff(e.trang_thai));

    const ids = mktEmps.map((e) => e.id);
    const emailSet = new Set<string>(
      mktEmps.map((e) => safeTrim(e.email).toLowerCase()).filter(Boolean),
    );

    // Load KPI targets
    const targetMap = new Map<string, number>();
    if (ids.length) {
      const kpiRes = await supabase
        .from(KPI_STAFF_TABLE)
        .select('employee_id, muc_tieu_vnd')
        .eq('nam_thang', ym)
        .in('employee_id', ids);

      if (!kpiRes.error) {
        for (const r of (kpiRes.data || []) as { employee_id: string; muc_tieu_vnd: number }[]) {
          const v = Number(r.muc_tieu_vnd);
          if (Number.isFinite(v) && v > 0) targetMap.set(String(r.employee_id), v);
        }
      } else {
        console.warn('leader-mkt kpi target:', kpiRes.error);
      }
    }

    // Load performance from detail_reports (revenue sum by email)
    const revMap = new Map<string, number>();
    if (emailSet.size) {
      const repRes = await supabase
        .from(REPORTS_TABLE)
        .select('email, revenue')
        .gte('report_date', start)
        .lte('report_date', end)
        .in('email', [...emailSet]);

      if (!repRes.error) {
        for (const r of (repRes.data || []) as { email: string; revenue: number }[]) {
          const e = safeTrim(r.email).toLowerCase();
          if (!e) continue;
          const v = Number(r.revenue) || 0;
          revMap.set(e, (revMap.get(e) || 0) + v);
        }
      } else {
        console.warn('leader-mkt detail_reports revenue:', repRes.error);
      }
    }

    // Build tkqcCount: marketing_staff (employee_id) -> tkqc (id_marketing_staff)
    const msByEmp = new Map<string, string[]>();
    const msIds: string[] = [];
    if (ids.length) {
      const msRes = await supabase
        .from(MARKETING_STAFF_TABLE)
        .select('id, employee_id')
        .in('employee_id', ids);

      if (!msRes.error) {
        for (const r of (msRes.data || []) as { id: string; employee_id: string | null }[]) {
          const empId = r.employee_id ? String(r.employee_id) : '';
          const msId = String(r.id);
          if (!empId) continue;
          msIds.push(msId);
          const arr = msByEmp.get(empId) || [];
          arr.push(msId);
          msByEmp.set(empId, arr);
        }
      } else {
        console.warn('leader-mkt marketing_staff:', msRes.error);
      }
    }

    const tkqcCountMap = new Map<string, number>();
    if (msIds.length) {
      const tkqcRes = await supabase
        .from(TKQC_TABLE)
        .select('id, id_marketing_staff')
        .in('id_marketing_staff', msIds);

      if (!tkqcRes.error) {
        // Reverse lookup map: marketing_staff id -> employee_id
        const empByMs = new Map<string, string>();
        for (const [empId, arr] of msByEmp.entries()) {
          for (const mid of arr) empByMs.set(mid, empId);
        }

        for (const r of (tkqcRes.data || []) as { id: string; id_marketing_staff: string }[]) {
          const mid = String(r.id_marketing_staff);
          const empId = empByMs.get(mid);
          if (!empId) continue;
          tkqcCountMap.set(empId, (tkqcCountMap.get(empId) || 0) + 1);
        }
      } else {
        console.warn('leader-mkt tkqc:', tkqcRes.error);
      }
    }

    const next: Row[] = mktEmps.map((emp) => {
      const email = safeTrim(emp.email).toLowerCase();
      const rev = email ? revMap.get(email) || 0 : 0;
      const target = targetMap.has(emp.id) ? targetMap.get(emp.id)! : null;
      const kpiPct = target && target > 0 ? (rev / target) * 100 : null;
      return {
        emp,
        tkqcCount: tkqcCountMap.get(emp.id) || 0,
        rev,
        target,
        kpiPct,
      };
    });

    next.sort((a, b) => {
      const ak = a.kpiPct ?? -1;
      const bk = b.kpiPct ?? -1;
      if (bk !== ak) return bk - ak;
      return b.rev - a.rev;
    });

    setRows(next);
    setLoading(false);
  }, [viewer, ym]);

  useEffect(() => {
    void load();
  }, [load]);

  const avgKpiPct = useMemo(() => {
    const arr = rows.map((r) => r.kpiPct).filter((x): x is number => x != null && Number.isFinite(x));
    if (!arr.length) return null;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }, [rows]);

  const subtitle = useMemo(() => {
    const n = rows.length;
    const avg = avgKpiPct != null ? `${avgKpiPct.toFixed(1)}%` : '—';
    const teamLabel = managedTeams.length ? managedTeams.join(', ') : '—';
    return `${n} nhân sự hoạt động · KPI trung bình ${avg} · Team: ${teamLabel}`;
  }, [rows.length, avgKpiPct, managedTeams]);

  const teamLabel = managedTeams.length ? managedTeams.join(', ') : viewer?.team?.trim() || '—';

  return (
    <div className="dash-fade-up">
      <p className="text-[11px] text-[var(--text3)] mb-[12px]">
        Xin / nạp ngân sách cho TKQC:{' '}
        <Link to={crmAdminPathForView('leader-budget')} className="text-[#3d8ef0] font-bold hover:underline">
          mở trang Xin ngân sách
        </Link>
        .
      </p>

      <SectionCard
        title={`👥 Quản lý Marketing — ${teamLabel}`}
        subtitle={subtitle}
        actions={
          <button className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]">
            + Thêm Marketing
          </button>
        }
        bodyPadding={false}
      >
        <div className="flex items-center justify-end gap-[10px] px-[14px] py-[10px] border-b border-[var(--border)]">
          <div className="text-[10px] text-[var(--text3)]">
            Tháng: <code className="text-[var(--text2)]">{ym}</code>
          </div>
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

        {error && (
          <div className="mx-[14px] mt-[12px] text-[11px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[var(--r)] px-3 py-2 bg-[var(--Rd)]/20">
            {error}
          </div>
        )}

        <div className="overflow-x-auto mt-[10px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                <th className="p-[12px_16px]">MÃ NS</th>
                <th className="p-[12px_16px]">HỌ TÊN</th>
                <th className="p-[12px_16px]">NGÀY BẮT ĐẦU</th>
                <th className="p-[12px_16px]">DỰ ÁN</th>
                <th className="p-[12px_16px] text-center">TK ADS</th>
                <th className="p-[12px_16px] text-right">KPI THÁNG</th>
                <th className="p-[12px_16px]">TRẠNG THÁI</th>
                <th className="p-[12px_16px]"></th>
              </tr>
            </thead>
            <tbody className="text-[11.5px] text-[var(--text2)]">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-[30px_16px] text-center text-[var(--text3)]">
                    <Loader2 className="animate-spin inline-block mr-2" size={18} />
                    Đang tải…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-[30px_16px] text-center text-[var(--text3)]">
                    Không có nhân sự MKT trong team này.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const kpiBadgeInfo = kpiBadge(r.kpiPct);
                  const kpiText = r.kpiPct != null ? `${r.kpiPct.toFixed(1)}%` : '—';
                  return (
                    <tr
                      key={r.emp.id}
                      className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors"
                    >
                      <td className="p-[12px_16px] font-bold text-[#3d8ef0]">{safeTrim(r.emp.ma_ns) || r.emp.id.slice(0, 6).toUpperCase()}</td>
                      <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">{r.emp.name}</td>
                      <td className="p-[12px_16px]">{formatDateVn(r.emp.ngay_bat_dau)}</td>
                      <td className="p-[12px_16px] font-medium text-[var(--text2)]">{safeTrim(r.emp.du_an_ten) || '—'}</td>
                      <td className="p-[12px_16px] text-center">
                        <span
                          className="p-[2.5px_8px] rounded-[4px] text-[9.5px] font-bold border"
                          style={{
                            background:
                              r.tkqcCount > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                            color: r.tkqcCount > 0 ? 'var(--G)' : 'var(--text3)',
                            borderColor: r.tkqcCount > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.25)',
                          }}
                        >
                          {r.tkqcCount} tài khoản
                        </span>
                      </td>
                      <td className="p-[12px_16px] text-right font-bold" style={{ color: kpiBadgeInfo.type === 'G' ? 'var(--G)' : kpiBadgeInfo.type === 'Y' ? 'var(--Y)' : kpiBadgeInfo.type === 'R' ? 'var(--R)' : 'var(--text3)' }}>
                        {kpiText}
                      </td>
                      <td className="p-[12px_16px]">
                        {kpiBadgeInfo.type === 'default' ? (
                          <Badge>{kpiBadgeInfo.label}</Badge>
                        ) : (
                          <Badge type={kpiBadgeInfo.type as 'G' | 'Y' | 'R'}>{kpiBadgeInfo.label}</Badge>
                        )}
                      </td>
                      <td className="p-[12px_16px] text-right">
                        <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">
                          Sửa
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
