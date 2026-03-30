import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { CrmTeamRow, DuAnRow } from '../../../types';
import { TeamFormModal } from './TeamFormModal';

const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';

function formatCompactVnd(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs >= 1_000_000_000) {
    const v = x / 1_000_000_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    const v = x / 1_000_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) return `${Math.round(x / 1_000)}K`;
  return `${Math.round(x)}`;
}

function asStringIdArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function teamBadge(trangThai: string | undefined): { label: string; type: 'G' | 'Y' | 'R' | 'default' } {
  switch (trangThai) {
    case 'hoat_dong':
      return { label: 'Hoạt động', type: 'G' };
    case 'tam_dung':
      return { label: 'Tạm dừng', type: 'Y' };
    case 'ngung':
      return { label: 'Ngừng', type: 'default' };
    default:
      return { label: trangThai || '—', type: 'default' };
  }
}

export const TeamsView: React.FC = () => {
  const [rows, setRows] = useState<CrmTeamRow[]>([]);
  const [duAnById, setDuAnById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmTeamRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [teamsRes, duRes] = await Promise.all([
      supabase
        .from(TEAMS_TABLE)
        .select('id, ma_team, ten_team, leader, so_thanh_vien, member_ids, du_an_ids, doanh_so_thang, trang_thai')
        .order('ten_team', { ascending: true }),
      supabase.from(DU_AN_TABLE).select('id, ten_du_an'),
    ]);

    if (teamsRes.error) {
      console.error('crm_teams:', teamsRes.error);
      setError(teamsRes.error.message || 'Không tải được danh sách team.');
      setRows([]);
    } else {
      setRows((teamsRes.data || []) as CrmTeamRow[]);
    }

    if (!duRes.error && duRes.data) {
      const m: Record<string, string> = {};
      for (const d of duRes.data as DuAnRow[]) {
        m[d.id] = d.ten_du_an;
      }
      setDuAnById(m);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const projectLabel = useMemo(() => {
    return (ids: unknown) => {
      const arr = asStringIdArray(ids);
      if (arr.length === 0) return '—';
      const names = arr.map((id) => duAnById[id] || id.slice(0, 8)).filter(Boolean);
      return names.join(', ');
    };
  }, [duAnById]);

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="👥 Module 2 — Quản lý Team"
        actions={
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold transition-all border border-[rgba(255,255,255,0.08)] disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]"
            >
              + Thêm team
            </button>
          </div>
        }
        bodyPadding={false}
      >
        {error && (
          <div className="p-[14px_16px] text-[11px] text-[var(--R)] border-b border-[var(--border)]">{error}</div>
        )}
        {loading && !rows.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--text3)] text-[12px]">
            <Loader2 className="animate-spin" size={20} />
            Đang tải team…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[12px_16px]">MÃ TEAM</th>
                  <th className="p-[12px_16px]">TÊN TEAM</th>
                  <th className="p-[12px_16px]">LEADER</th>
                  <th className="p-[12px_16px] text-center">SỐ THÀNH VIÊN</th>
                  <th className="p-[12px_16px]">DỰ ÁN PHỤ TRÁCH</th>
                  <th className="p-[12px_16px] text-right">DOANH SỐ THÁNG</th>
                  <th className="p-[12px_16px]">TRẠNG THÁI</th>
                  <th className="p-[12px_16px]"></th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)]">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="p-[24px_16px] text-center text-[var(--text3)] space-y-3">
                      <div>
                        Chưa có team. Chạy SQL <code className="text-[var(--text2)]">supabase/create_crm_teams.sql</code> hoặc
                        thêm bảng <code className="text-[var(--text2)]">{TEAMS_TABLE}</code>.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setFormOpen(true);
                        }}
                        className="inline-flex bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[8px] px-[16px] rounded-[6px] text-[11px] font-bold"
                      >
                        + Thêm team đầu tiên
                      </button>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const st = teamBadge(row.trang_thai);
                    const memCount =
                      row.so_thanh_vien != null
                        ? row.so_thanh_vien
                        : asStringIdArray(row.member_ids).length;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors"
                      >
                        <td className="p-[12px_16px] font-bold text-[#3d8ef0]">{row.ma_team || '—'}</td>
                        <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">{row.ten_team}</td>
                        <td className="p-[12px_16px] max-w-[130px] truncate" title={row.leader || ''}>
                          {row.leader || '—'}
                        </td>
                        <td className="p-[12px_16px] text-center font-medium tabular-nums">{memCount}</td>
                        <td
                          className="p-[12px_16px] font-medium text-[var(--text2)] max-w-[220px] truncate"
                          title={projectLabel(row.du_an_ids)}
                        >
                          {projectLabel(row.du_an_ids)}
                        </td>
                        <td className="p-[12px_16px] text-right font-bold text-[#0fa86d] tabular-nums">
                          {formatCompactVnd(row.doanh_so_thang)}
                        </td>
                        <td className="p-[12px_16px]">
                          <Badge type={st.type}>{st.label}</Badge>
                        </td>
                        <td className="p-[12px_16px] text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(row);
                              setFormOpen(true);
                            }}
                            className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all"
                          >
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
        )}
      </SectionCard>

      <TeamFormModal
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => void load()}
      />
    </div>
  );
};
