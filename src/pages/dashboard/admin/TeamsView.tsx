import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Edit3, Loader2, Plus, RefreshCw, Search, Users } from 'lucide-react';
import { StitchBadge, StitchButton, StitchCard, StitchInput, StitchState, StitchTable } from '../../../components/ui/StitchUI';
import { supabase } from '../../../api/supabase';
import type { AuthUser, CrmTeamRow, DuAnRow } from '../../../types';
import { TeamFormModal } from './TeamFormModal';
import { canEditProjects, canViewAllTeams, scopeBannerText } from '../../../utils/roleScope';
import './stitchTeams.css';

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

export const TeamsView: React.FC<{ viewer?: AuthUser | null }> = ({ viewer = null }) => {
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
    const canViewAll = canViewAllTeams(viewer);
    const vName = viewer?.name?.trim() || '';
    const vId = viewer?.id || '';
    const vTeam = viewer?.team?.trim() || '';
    const scoped = canViewAll
      ? rows
      : rows.filter((r) => {
          if (vName && r.leader?.trim() === vName) return true;
          const mids = asStringIdArray(r.member_ids).map(String);
          if (vId && mids.includes(String(vId))) return true;
          if (vTeam && r.ten_team?.trim() === vTeam) return true;
          return false;
        });
    if (!q) return scoped;
    return scoped.filter((r) => {
      const hay = [r.ma_team, r.ten_team, r.leader, projectLabel(r.du_an_ids)]
        .map((x) => (x || '').toString().toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [rows, search, projectLabel, viewer?.id, viewer?.name, viewer?.role, viewer?.team, viewer?.vi_tri]);

  return (
    <div className="stitch-teams dash-fade-up">
      <div className="stitch-teams-header">
        <div className="stitch-teams-heading">
          <span className="stitch-teams-eyebrow">QUẢN TRỊ HỆ THỐNG <span>/</span> MODULE 2</span>
          <h1>Quản lý Team</h1>
          <p>Quản lý thành viên, người phụ trách và các dự án của từng team.</p>
          {scopeBannerText(viewer) ? <p className="stitch-teams-scope">{scopeBannerText(viewer)} · {filtered.length}/{rows.length} team</p> : null}
        </div>
        <div className="stitch-teams-actions">
          <StitchButton variant="secondary" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Làm mới
          </StitchButton>
          {canEditProjects(viewer) ? (
            <StitchButton type="button" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={16} /> Thêm team
            </StitchButton>
          ) : null}
        </div>
      </div>

      <StitchCard className="stitch-teams-filter">
        <div className="stitch-teams-filter-copy">
          <span className="stitch-teams-filter-icon"><Users size={17} /></span>
          <div><strong>Danh sách team</strong><small>{filtered.length} team hiển thị</small></div>
        </div>
        <div className="stitch-teams-search">
          <Search size={16} aria-hidden="true" />
          <StitchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã, tên team, leader hoặc dự án…" aria-label="Tìm kiếm team" type="search" />
        </div>
      </StitchCard>

      <StitchCard className="stitch-teams-table-card">
        {error ? <StitchState tone="error" role="alert"><AlertCircle size={16} />{error}</StitchState> : null}
        {loading && !rows.length ? (
          <StitchState tone="loading" role="status"><Loader2 className="animate-spin" size={20} />Đang tải team…</StitchState>
        ) : (
          <div className="stitch-table-wrap">
            <StitchTable className="stitch-teams-table">
              <thead><tr>
                <th>Mã Team</th><th>Tên Team</th><th>Leader</th>
                <th className="stitch-align-center">Số thành viên</th><th>Dự án phụ trách</th>
                <th className="stitch-align-right">Doanh số tháng</th><th>Trạng thái</th><th className="stitch-align-right">Thao tác</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 && !loading ? (
                  <tr><td colSpan={8}><StitchState tone="empty">Không tìm thấy team phù hợp.</StitchState></td></tr>
                ) : filtered.map((row) => {
                  const st = teamBadge(row.trang_thai);
                  const memCount = row.so_thanh_vien != null ? row.so_thanh_vien : asStringIdArray(row.member_ids).length;
                  return (
                    <tr key={row.id}>
                      <td><span className="stitch-team-code">{row.ma_team || '—'}</span></td>
                      <td><strong className="stitch-team-name">{row.ten_team}</strong></td>
                      <td title={row.leader || ''}><span className="stitch-team-leader"><span className="stitch-team-avatar">{(row.leader || '—').trim().slice(0, 1).toUpperCase()}</span><span>{row.leader || '—'}</span></span></td>
                      <td className="stitch-align-center stitch-team-number">{memCount}</td>
                      <td title={projectLabel(row.du_an_ids)}><span className="stitch-team-projects">{projectLabel(row.du_an_ids)}</span></td>
                      <td className="stitch-align-right stitch-team-revenue">{formatCompactVnd(row.doanh_so_thang)}</td>
                      <td><StitchBadge tone={st.type === 'G' ? 'success' : st.type === 'Y' ? 'warning' : st.type === 'R' ? 'danger' : 'neutral'}>{st.label}</StitchBadge></td>
                      <td className="stitch-align-right">
                        {canEditProjects(viewer) ? (
                          <StitchButton variant="quiet" size="small" type="button" onClick={() => { setEditing(row); setFormOpen(true); }}><Edit3 size={13} /> Sửa</StitchButton>
                        ) : <span className="stitch-team-readonly">Chỉ xem</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </StitchTable>
          </div>
        )}
        <div className="stitch-teams-table-footer"><span>Hiển thị {filtered.length} / {rows.length} team</span><span className="stitch-teams-swipe-hint">Vuốt ngang để xem đầy đủ bảng →</span></div>
      </StitchCard>

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
