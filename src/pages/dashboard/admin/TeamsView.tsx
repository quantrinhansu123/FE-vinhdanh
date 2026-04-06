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
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.ma_team, r.ten_team, r.leader, projectLabel(r.du_an_ids)]
        .map((x) => (x || '').toString().toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [rows, search, projectLabel]);

  return (
    <div className="dash-fade-up">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div className="space-y-1">
          <p className="text-[var(--ld-primary)] font-bold text-[11px] uppercase tracking-widest">Enterprise Tier</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ld-on-surface)] tracking-tight">Module 2 — Quản lý Team</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 bg-[var(--ld-surface-container)] px-3 py-2 rounded-xl text-[var(--ld-on-surface-variant)] border border-[var(--ld-outline-variant)]/20 hover:text-[var(--ld-on-surface)] disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <span className="material-symbols-outlined text-sm">refresh</span>}
            Làm mới
          </button>
          <button
            className="bg-[var(--ld-primary)] text-[var(--ld-on-primary)] px-4 py-2 rounded-xl font-bold hover:brightness-110 active:scale-95"
            onClick={() => { setEditing(null); setFormOpen(true); }}
            type="button"
          >
            <span className="material-symbols-outlined text-sm align-[-3px] mr-1">add_circle</span>
            Thêm team
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-[var(--ld-surface-container-low)] rounded-xl p-3 mb-4 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ld-outline)]">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo tên team, leader hoặc dự án…"
            className="w-full bg-[var(--ld-surface-container-highest)] border-none rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--ld-on-surface)] focus:ring-1 focus:ring-[var(--ld-primary)]"
            type="text"
          />
        </div>
      </div>

      <SectionCard bodyPadding={false}>
        {error && <div className="p-[14px_16px] text-[11px] text-[var(--R)] border-b border-[var(--border)]">{error}</div>}
        {loading && !rows.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--text3)] text-[12px]">
            <Loader2 className="animate-spin" size={20} />
            Đang tải team…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] font-bold tracking-widest uppercase text-[var(--text3)] text-left">
                  <th className="p-[12px_16px]">Mã Team</th>
                  <th className="p-[12px_16px]">Tên Team</th>
                  <th className="p-[12px_16px]">Leader</th>
                  <th className="p-[12px_16px] text-center">Số thành viên</th>
                  <th className="p-[12px_16px]">Dự án phụ trách</th>
                  <th className="p-[12px_16px] text-right">Doanh số tháng</th>
                  <th className="p-[12px_16px]">Trạng thái</th>
                  <th className="p-[12px_16px] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-[12px] text-[var(--text2)]">
                {filtered.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="p-[24px_16px] text-center text-[var(--text3)] space-y-3">
                      Không tìm thấy team phù hợp.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const st = teamBadge(row.trang_thai);
                    const memCount =
                      row.so_thanh_vien != null
                        ? row.so_thanh_vien
                        : asStringIdArray(row.member_ids).length;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                      >
                        <td className="p-[12px_16px] font-bold text-[var(--ld-primary)]">{row.ma_team || '—'}</td>
                        <td className="p-[12px_16px] font-extrabold text-[var(--ld-on-surface)] tracking-[0.2px]">{row.ten_team}</td>
                        <td className="p-[12px_16px] max-w-[180px] truncate" title={row.leader || ''}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[var(--ld-primary-container)] flex items-center justify-center text-[10px] font-bold text-[var(--ld-on-primary-container)]">
                              {(row.leader || '—').trim().slice(0, 1).toUpperCase()}
                            </div>
                            <span>{row.leader || '—'}</span>
                          </div>
                        </td>
                        <td className="p-[12px_16px] text-center font-medium tabular-nums">{memCount}</td>
                        <td
                          className="p-[12px_16px] font-medium text-[var(--text2)] max-w-[220px] truncate"
                          title={projectLabel(row.du_an_ids)}
                        >
                          {projectLabel(row.du_an_ids)}
                        </td>
                        <td className="p-[12px_16px] text-right font-bold text-[var(--ld-secondary)] tabular-nums">
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
                            className="text-[var(--ld-primary)] hover:bg-[color-mix(in_srgb,var(--ld-primary)_10%,transparent)] p-[6px_10px] rounded-lg border border-[var(--ld-outline-variant)]/20 text-[11px] font-bold"
                          >
                            <span className="material-symbols-outlined text-sm align-[-3px] mr-1">edit</span>
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
