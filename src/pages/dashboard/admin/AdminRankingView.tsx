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
      <div className="flex justify-end mb-[10px]">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold transition-all border border-[rgba(255,255,255,0.08)] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Đồng bộ dữ liệu
        </button>
      </div>

      {error && (
        <div className="mb-[12px] text-[11px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[var(--r)] px-3 py-2 bg-[var(--Rd)]/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
        <SectionCard
          title="🏆 Top Marketing — theo Bảng vinh danh"
          subtitle="Cùng nguồn employees, sắp xếp theo điểm (score) giảm dần"
          badge={{ text: monthBadge, type: 'G' }}
        >
          {loading && !rows.length ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[var(--text3)] text-[12px]">
              <Loader2 className="animate-spin" size={20} />
              Đang tải…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-[11px] text-[var(--text3)] py-6 text-center">
              Chưa có nhân sự trong <code className="text-[var(--text2)]">{EMPLOYEES_TABLE}</code>.
            </div>
          ) : (
            <div className="flex flex-col max-h-[min(520px,70vh)] overflow-y-auto pr-1">
              {rows.map((emp, i) => (
                <RankItem
                  key={emp.id}
                  rank={String(emp.rank).padStart(2, '0')}
                  avatar={initials(emp.name)}
                  avatarBg={AVATAR_BGS[i % AVATAR_BGS.length]}
                  name={emp.name}
                  team={teamSubtitle(emp)}
                  value={emp.score.toLocaleString('vi-VN')}
                  badgeText={emp.ma_ns?.trim() || undefined}
                  badgeType={emp.rank <= 3 ? 'G' : 'B'}
                  rankColor={emp.rank === 1 ? 'var(--gold)' : undefined}
                  valueColor="var(--G)"
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="🔥 Marketing đốt tiền — Cần xử lý" badge={{ text: 'CRM staff', type: 'R' }}>
          <div className="flex flex-col mb-[10px] max-h-[min(280px,40vh)] overflow-y-auto">
            {loading && !rows.length ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[var(--text3)] text-[12px]">
                <Loader2 className="animate-spin" size={18} />
              </div>
            ) : burnList.length === 0 ? (
              <div className="text-[11px] text-[var(--text3)] py-6 text-center">
                Không có nhân sự trạng thái <span className="font-bold text-[var(--text2)]">Đốt tiền</span> (cập nhật tại /crm-admin/staff).
              </div>
            ) : (
              burnList.map((emp) => (
                <RankItem
                  key={emp.id}
                  rank="!"
                  avatar={initials(emp.name)}
                  avatarBg="linear-gradient(135deg, #ef4444, #dc2626)"
                  name={emp.name}
                  team={`${teamSubtitle(emp)} · Điểm ${emp.score.toLocaleString('vi-VN')}`}
                  value={emp.score.toLocaleString('vi-VN')}
                  badgeText="⚠ Đốt tiền"
                  badgeType="R"
                  rankColor="var(--R)"
                  nameColor="var(--R)"
                  valueColor="var(--R)"
                />
              ))
            )}
          </div>
          <div className="pt-[10px] border-t border-[var(--border)] text-[10px] text-[var(--text3)] space-y-2 leading-relaxed">
            <div className="text-[9.5px] font-extrabold uppercase tracking-[0.8px] text-[var(--text2)]">
              Đồng bộ với Bảng vinh danh
            </div>
            <p>
              Thứ hạng và cột điểm lấy từ bảng <code className="text-[var(--text)]">{EMPLOYEES_TABLE}</code>, sắp xếp{' '}
              <strong className="text-[var(--text2)]">score</strong> giảm dần — cùng logic với trang vinh danh sau đăng nhập.
            </p>
            <p>
              Danh sách đỏ bên trên: nhân sự có trạng thái <strong className="text-[var(--R)]">Đốt tiền</strong> trong Module 3.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
