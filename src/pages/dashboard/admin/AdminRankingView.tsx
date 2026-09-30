import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import { fetchAllRows } from '../../../api/fetchAllRows';
import type { Employee } from '../../../types';
import { REPORTS_TABLE } from '../mkt/mktDetailReportShared';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const REPORTS_FROM = 'report_date, code, tien_viet';

const AVATAR_BGS = [
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #3b82f6, #6366f1)',
  'linear-gradient(135deg, #10b981, #06b6d4)',
  'linear-gradient(135deg, #a855f7, #ec4899)',
  'linear-gradient(135deg, #eab308, #f97316)',
  'linear-gradient(135deg, #14b8a6, #0ea5e9)',
];

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return (name.trim().slice(0, 2) || '?').toUpperCase();
}

function workDaysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000));
}

function teamSubtitle(emp: Employee): string {
  const parts: string[] = [];
  if (emp.team?.trim()) parts.push(emp.team.trim());
  if (emp.du_an_ten?.trim()) parts.push(emp.du_an_ten.trim());
  const days = workDaysSince(emp.ngay_bat_dau);
  if (days != null) parts.push(`${days} ngày`);
  return parts.length ? parts.join(' · ') : '—';
}

function normalizedCode(value: unknown): string {
  return String(value ?? '').replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
}

type RankedEmployee = Employee & { rank: number };

export const AdminRankingView: React.FC = () => {
  const [rows, setRows] = useState<RankedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthBadge = useMemo(
    () =>
      new Date().toLocaleDateString('vi-VN', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase()),
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const now = new Date();
    const dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const dateTo = `${dateFrom.slice(0, 7)}-${String(now.getDate()).padStart(2, '0')}`;
    const { data: reportData, error: reportErr } = await fetchAllRows<any>(supabase
      .from(REPORTS_TABLE)
      .select(REPORTS_FROM)
      .gte('report_date', dateFrom)
      .lte('report_date', dateTo));
    if (reportErr) {
      console.error('admin-ranking detail_reports:', reportErr);
      setError(reportErr.message || 'KhÃ´ng táº£i Ä‘Æ°á»£c detail_reports.');
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error: qErr } = await fetchAllRows<Employee>(supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, team, avatar_url, du_an_ten, trang_thai, ma_ns, ngay_bat_dau'));

    if (qErr) {
      console.error('admin-ranking employees:', qErr);
      setError(qErr.message || 'Không tải được bảng vinh danh.');
      setRows([]);
    } else {
      const revenueByCode = new Map<string, number>();
      const displayCodeByKey = new Map<string, string>();
      for (const report of reportData || []) {
        const code = String(report.code || '').replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ');
        const key = normalizedCode(code);
        if (!key) continue;
        const revenue = Number(report.tien_viet);
        if (Number.isFinite(revenue)) revenueByCode.set(key, (revenueByCode.get(key) || 0) + revenue);
        if (!displayCodeByKey.has(key)) displayCodeByKey.set(key, code);
      }

      const employees = (data || []) as Employee[];
      const employeeCodeKeys = new Set<string>();
      const ranked: Employee[] = employees.map((emp) => {
        const key = normalizedCode(emp.ma_ns);
        if (key) employeeCodeKeys.add(key);
        return { ...emp, score: key ? revenueByCode.get(key) || 0 : 0 };
      });
      for (const [key, revenue] of revenueByCode) {
        if (employeeCodeKeys.has(key)) continue;
        const code = displayCodeByKey.get(key) || key;
        ranked.push({ id: `report-${key}`, name: code, team: '', score: revenue, avatar_url: null, ma_ns: code });
      }
      ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'vi'));
      setRows(ranked.map((emp, index) => ({ ...emp, rank: index + 1 })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const burnList = useMemo(() => rows.filter((e) => e.trang_thai === 'dot_tien'), [rows]);

  return (
    <div className="dash-fade-up">
      <div className="mb-3 flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#6d9fe5] to-[#3e659a] text-[11px] font-extrabold tracking-[-0.5px] text-white shadow-sm">MAP</div>
        <div className="min-w-0">
          <div className="text-[12px] font-extrabold text-[var(--text)]">MAP - Marketing Analytic Platform</div>
          <div className="text-[10px] text-[var(--text3)]">Bảng xếp hạng doanh số · {monthBadge}</div>
        </div>
      </div>

      {error ? (
        <div className="mb-3 rounded-[8px] border border-[var(--R)]/25 bg-[var(--Rd)] px-3 py-2 text-[11px] text-[var(--R)]">
          {error}
        </div>
      ) : null}

      <SectionCard
        title="Bảng xếp hạng nhân sự"
        subtitle={`${rows.length.toLocaleString('vi-VN')} nhân sự · Doanh số báo cáo tháng ${monthBadge}`}
        bodyPadding={false}
        actions={
          <button type="button" onClick={() => void load()} disabled={loading}
            className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg3)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text2)] hover:bg-[var(--bg4)] disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Đồng bộ dữ liệu
          </button>
        }
      >
        <div className="max-h-[min(650px,72vh)] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[var(--bg2)]">
              <tr className="border-b border-[var(--border)] text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">
                <th className="p-2 pl-4">Hạng</th><th className="p-2">Nhân sự</th><th className="p-2">Nhóm</th>
                <th className="p-2 text-right">Doanh số (VND)</th><th className="p-2 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="text-[11px] text-[var(--text2)]">
              {loading && !rows.length ? (
                <tr><td colSpan={5} className="p-10 text-center text-[var(--text3)]"><Loader2 className="mr-2 inline-block animate-spin" size={16} />Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-[var(--text3)] font-bold">Chưa có nhân sự trong {EMPLOYEES_TABLE}.</td></tr>
              ) : rows.map((emp) => (
                <tr key={emp.id} className="border-b border-[rgba(255,255,255,0.04)] transition-colors hover:bg-[rgba(255,255,255,0.03)]">
                  <td className="p-2 pl-4"><span className="inline-flex h-8 min-w-8 items-center justify-center rounded-[6px] bg-[var(--accent-d)] px-2 text-[11px] font-extrabold text-[var(--accent)]">{emp.rank}</span></td>
                  <td className="p-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: AVATAR_BGS[(emp.rank - 1) % AVATAR_BGS.length] }}>{initials(emp.name)}</div>
                      <div className="min-w-0"><div className="truncate font-bold text-[var(--text)]">{emp.name}</div><div className="text-[9px] text-[var(--text3)]">ID: {emp.ma_ns || '—'}</div></div>
                    </div>
                  </td>
                  <td className="p-2">{emp.team || '—'}</td>
                  <td className="p-2 text-right font-[var(--mono)] font-bold text-[var(--G)]">{emp.score.toLocaleString('vi-VN')}</td>
                  <td className="p-2 text-center"><span className="rounded-[4px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-[9px] font-bold text-[var(--text2)]">{emp.trang_thai || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard title="Marketing cần theo dõi" subtitle="Nhân sự đang có trạng thái đốt tiền" badge={{ text: `${burnList.length} nhân sự`, type: burnList.length ? 'R' : 'G' }}>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--Rd)] text-[var(--R)]"><Flame size={18} /></span>
            <div className="text-[11px] text-[var(--text2)]">{burnList.length === 0 ? 'Không có nhân sự ở trạng thái đốt tiền.' : `Có ${burnList.length} nhân sự cần được kiểm tra.`}</div>
          </div>
        </SectionCard>

        <SectionCard title="Doanh số cao nhất tháng này" subtitle="Hai nhân sự có doanh số cao nhất" badge={{ text: 'Top 2', type: 'B' }}>
          <div className="mb-3 flex items-center gap-2 text-[var(--G)]"><TrendingUp size={16} /><span className="text-[10px] font-bold">Doanh số trong tháng</span></div>
          <div className="space-y-2">
            {rows.filter((emp) => emp.score > 0).slice(0, 2).map((emp) => (
              <div key={emp.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg3)] p-2.5">
                <div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: AVATAR_BGS[(emp.rank - 1) % AVATAR_BGS.length] }}>{initials(emp.name)}</span><span className="truncate text-[11px] font-semibold text-[var(--text)]">{emp.name}</span></div>
                <span className="whitespace-nowrap font-[var(--mono)] text-[10px] font-bold text-[var(--G)]">{emp.score.toLocaleString('vi-VN')} ₫</span>
              </div>
            ))}
            {!rows.some((emp) => emp.score > 0) && <p className="text-[11px] text-[var(--text3)]">Chưa có doanh số trong tháng này.</p>}
          </div>
        </SectionCard>
      </div>

    </div>
  );
};
