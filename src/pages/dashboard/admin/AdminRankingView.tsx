import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard, RankItem } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { Employee } from '../../../types';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';

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
    const { data, error: qErr } = await supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, team, score, avatar_url, du_an_ten, trang_thai, ma_ns, ngay_bat_dau')
      .order('score', { ascending: false });

    if (qErr) {
      console.error('admin-ranking employees:', qErr);
      setError(qErr.message || 'Không tải được bảng vinh danh.');
      setRows([]);
    } else {
      const list = (data || []) as Employee[];
      setRows(
        list.map((emp, index) => ({
          ...emp,
          rank: index + 1,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const burnList = useMemo(() => rows.filter((e) => e.trang_thai === 'dot_tien'), [rows]);

  return (
    <div className="dash-fade-up">
      {/* Top bar */}
      <div className="flex justify-between items-center w-full mb-4">
        <div className="flex items-center gap-8">
          <h1 className="text-[var(--ld-on-surface)] font-extrabold text-xl tracking-tight">Bảng xếp hạng</h1>
          <div className="hidden md:flex items-center gap-3 text-[var(--ld-on-surface-variant)]">
            <div className="flex items-center gap-2 bg-[var(--ld-surface-container-low)] px-3 py-1.5 rounded-lg border border-[var(--ld-outline-variant)]/20">
              <span className="text-xs">Tháng này</span>
              <span className="material-symbols-outlined text-xs">calendar_today</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)]">{monthBadge}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface)] px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold border border-[var(--ld-outline-variant)]/20 hover:bg-[var(--ld-surface-bright)] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">{loading ? 'hourglass' : 'sync'}</span>
          Đồng bộ dữ liệu
        </button>
      </div>

      {error ? (
        <div className="mb-3 text-[11px] text-[var(--ld-error)] border border-[var(--ld-error)]/25 rounded px-3 py-2 bg-[color-mix(in_srgb,var(--ld-error)_12%,transparent)]">
          {error}
        </div>
      ) : null}

      <div className="flex gap-6 items-start">
        {/* Left: Top Marketing table */}
        <section className="flex-[3] bg-[var(--ld-surface-container)] rounded-2xl overflow-hidden border border-[var(--ld-outline-variant)]/10">
          <div className="p-4 border-b border-[var(--ld-surface-container-low)] flex justify-between items-center bg-[var(--ld-surface-container-high)]/30">
            <h3 className="text-[var(--ld-on-surface)] font-bold text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--ld-primary)]">military_tech</span>
              Top Marketing – theo Bảng vinh danh
            </h3>
            <div className="flex gap-2">
              <span className="bg-[var(--ld-primary)]/10 text-[var(--ld-primary)] text-[10px] font-bold px-2 py-1 rounded">24/7 TRACKING</span>
              <span className="bg-[var(--ld-tertiary)]/10 text-[var(--ld-tertiary)] text-[10px] font-bold px-2 py-1 rounded">REAL-TIME DATA</span>
            </div>
          </div>
          <div className="max-h-[min(560px,70vh)] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[var(--ld-surface-container)] z-10">
                <tr className="text-[var(--ld-on-surface-variant)]/60 text-[10px] uppercase tracking-[0.2em] font-bold">
                  <th className="px-6 py-3 w-14">#</th>
                  <th className="py-3">Nhân sự</th>
                  <th className="py-3">Nhóm</th>
                  <th className="py-3 text-right">Doanh số (VNĐ)</th>
                  <th className="py-3 text-center">Trạng thái</th>
                  <th className="px-6 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ld-background)]/30">
                {loading && !rows.length ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[var(--ld-on-surface-variant)]">
                      <Loader2 className="inline-block animate-spin mr-2" size={16} />
                      Đang tải…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[var(--ld-on-surface-variant)]">
                      Chưa có nhân sự trong {EMPLOYEES_TABLE}.
                    </td>
                  </tr>
                ) : (
                  rows.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[var(--ld-surface-container-high)] transition-colors group">
                      <td className="px-6 py-4">
                        <span className="w-8 h-8 rounded-lg bg-[var(--ld-primary-container)] text-[var(--ld-on-primary-container)] flex items-center justify-center font-bold text-xs">
                          {emp.rank === 1 ? '1st' : emp.rank}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full ring-2 ring-[var(--ld-primary-container)]/30 flex items-center justify-center text-[11px] font-bold"
                            style={{ background: AVATAR_BGS[(emp.rank - 1) % AVATAR_BGS.length] }}
                          >
                            {initials(emp.name)}
                          </div>
                          <div>
                            <div className="text-[var(--ld-on-surface)] font-bold text-sm">{emp.name}</div>
                            <div className="text-[var(--ld-on-surface-variant)]/60 text-[10px]">ID: {emp.ma_ns || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-[var(--ld-on-surface-variant)] text-xs font-medium">{emp.team || '—'}</td>
                      <td className="py-4 text-right font-mono text-[var(--ld-primary)] font-bold text-sm tracking-tight">
                        {emp.score.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-4 text-center">
                        <span className="px-2 py-1 bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)]/70 text-[10px] font-bold rounded border border-[var(--ld-outline-variant)]/10">
                          {emp.trang_thai || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="material-symbols-outlined text-[var(--ld-on-surface-variant)]/30 group-hover:text-[var(--ld-primary)] transition-colors cursor-pointer">
                          arrow_forward_ios
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-[var(--ld-surface-container-lowest)] flex justify-center border-t border-[var(--ld-background)]/15">
            <button className="text-[var(--ld-primary)] text-xs font-bold flex items-center gap-2 hover:underline">
              Xem toàn bộ bảng vinh danh
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </button>
          </div>
        </section>

        {/* Right: Burn alert + mini card */}
        <section className="flex-1 flex flex-col gap-6">
          <div className="bg-[var(--ld-surface-container)] rounded-2xl p-6 border border-[var(--ld-error)]/8 relative overflow-hidden text-center min-h-[280px] flex flex-col items-center justify-center">
            <div className="absolute top-0 right-0 p-4">
              <span className="bg-[var(--ld-error-container)] text-[var(--ld-on-error-container)] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow">
                CRM staff
              </span>
            </div>
            <div className="mb-4">
              <div className="w-16 h-16 rounded-full bg-[color-mix(in_srgb,var(--ld-error)_15%,transparent)] flex items-center justify-center border border-[var(--ld-error)]/20 mx-auto">
                <span className="material-symbols-outlined text-3xl text-[var(--ld-error)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  local_fire_department
                </span>
              </div>
            </div>
            <h3 className="font-extrabold text-lg text-[var(--ld-on-surface)] mb-1">Marketing đốt tiền – Cần xử lý</h3>
            <p className="text-[var(--ld-on-surface-variant)]/70 text-sm max-w-[260px] mx-auto mb-4">
              {burnList.length === 0 ? 'Không có nhân sự trạng thái Đốt tiền trong hệ thống hiện tại.' : `Có ${burnList.length} nhân sự cần xử lý.`}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 bg-[var(--ld-surface-container-high)] border border-[var(--ld-outline-variant)]/20 rounded-xl text-[var(--ld-on-surface)] text-sm font-bold hover:bg-[var(--ld-surface-bright)]"
            >
              Kiểm tra thủ công
            </button>
          </div>

          <div className="bg-[var(--ld-surface-container)] rounded-2xl p-6 border border-[var(--ld-primary)]/8">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-sm text-[var(--ld-on-surface-variant)]">Tăng trưởng nhanh nhất</h4>
              <span className="material-symbols-outlined text-[var(--ld-primary)] text-sm">trending_up</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[var(--ld-background)]/40 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--ld-primary-fixed-variant,#3323cc)] flex items-center justify-center text-[10px] font-bold">TM</div>
                  <span className="text-xs font-semibold">Trần Mạnh</span>
                </div>
                <span className="text-[var(--ld-tertiary)] font-bold text-xs">+42%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[var(--ld-background)]/40 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--ld-tertiary-container)] flex items-center justify-center text-[10px] font-bold">LD</div>
                  <span className="text-xs font-semibold">Lê Đăng</span>
                </div>
                <span className="text-[var(--ld-tertiary)] font-bold text-xs">+28%</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
