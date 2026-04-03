import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { CrmTeamRow, TkqcAdListRow } from '../../../types';
import { AdAccountFormModal } from './AdAccountFormModal';

const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';
const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';

const TKQC_SELECT = `
  id,
  id_du_an,
  ma_tkqc,
  ten_tkqc,
  ten_quang_cao,
  ten_pae,
  nen_tang,
  ngan_sach_phan_bo,
  id_marketing_staff,
  ngay_bat_dau,
  id_crm_team,
  trang_thai_tkqc,
  agency,
  du_an ( id, ma_du_an, ten_du_an, don_vi, ngay_bat_dau, trang_thai ),
  marketing_staff ( id_ns, name )
`;

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

function formatDateVn(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function effectiveTkqcTrangThai(row: TkqcAdListRow): 'active' | 'thieu_thiet_lap' {
  return row.trang_thai_tkqc === 'thieu_thiet_lap' ? 'thieu_thiet_lap' : 'active';
}

function tkqcTrangThaiCell(row: TkqcAdListRow): React.ReactNode {
  if (effectiveTkqcTrangThai(row) === 'thieu_thiet_lap') {
    return (
      <span className="inline-flex items-center gap-[4px] p-[2.5px_8px] bg-[rgba(224,61,61,0.12)] text-[var(--R)] rounded-[4px] text-[9.5px] font-extrabold border border-[rgba(224,61,61,0.2)]">
        Thiếu thiết lập
      </span>
    );
  }
  return <Badge type="G">Active</Badge>;
}

function teamProjectLabel(row: TkqcAdListRow, teams: CrmTeamRow[]): string {
  const duAn = row.du_an;
  const proj = duAn
    ? [duAn.ma_du_an, duAn.ten_du_an].filter(Boolean).join(' · ') || duAn.ten_du_an
    : '—';

  if (row.id_crm_team) {
    const t = teams.find((x) => x.id === row.id_crm_team);
    const label = t?.ten_team || t?.ma_team;
    if (label) return proj === '—' ? label : `${label} · ${proj}`;
  }

  if (!duAn) return proj === '—' ? '—' : proj;
  const teamNames: string[] = [];
  for (const t of teams) {
    const ids = t.du_an_ids;
    if (!Array.isArray(ids)) continue;
    if (ids.some((x) => String(x) === duAn.id)) {
      const label = t.ten_team || t.ma_team;
      if (label) teamNames.push(label);
    }
  }
  if (teamNames.length) return `${teamNames.join(' · ')} · ${proj}`;
  return proj;
}

export const AdAccountsView: React.FC = () => {
  const [rows, setRows] = useState<TkqcAdListRow[]>([]);
  const [teams, setTeams] = useState<CrmTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TkqcAdListRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from(TEAMS_TABLE)
      .select('id, ma_team, ten_team, du_an_ids')
      .order('ten_team', { ascending: true });
    if (qErr) {
      console.error('crm_teams for ad accounts:', qErr);
      setTeams([]);
    } else {
      setTeams((data || []) as CrmTeamRow[]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from(TKQC_TABLE)
      .select(TKQC_SELECT)
      .order('ma_tkqc', { ascending: true });

    if (qErr) {
      console.error('Supabase tkqc:', qErr);
      setError(qErr.message || 'Không tải được danh sách tài khoản Ads.');
      setRows([]);
    } else {
      setRows((data || []) as TkqcAdListRow[]);
    }
    await loadTeams();
    setLoading(false);
  }, [loadTeams]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (row: TkqcAdListRow) => {
      const label = [row.ma_tkqc, row.ten_tkqc].filter(Boolean).join(' · ') || row.id;
      if (!window.confirm(`Xoá tài khoản Ads «${label}»? Không hoàn tác.`)) return;
      setDeletingId(row.id);
      setError(null);
      const closeForm = editing?.id === row.id;
      try {
        const { error: delErr } = await supabase.from(TKQC_TABLE).delete().eq('id', row.id);
        if (delErr) throw delErr;
        if (closeForm) {
          setEditing(null);
          setFormOpen(false);
        }
        await load();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không xoá được.';
        setError(msg);
      } finally {
        setDeletingId(null);
      }
    },
    [load, editing?.id]
  );

  const rowNeedsSetup = useCallback((row: TkqcAdListRow) => effectiveTkqcTrangThai(row) === 'thieu_thiet_lap', []);

  const emptyHint = useMemo(
    () => (
      <span>
        Chưa có bản ghi. Thêm trong bảng <code className="text-[var(--text2)]">{TKQC_TABLE}</code> hoặc dùng nút bên dưới.
      </span>
    ),
    []
  );

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="🎯 Module 4 — Quản lý Tài khoản Quảng cáo"
        actions={
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold transition-all border border-[rgba(255,255,255,0.08)] disabled:opacity-50"
              title="Tải lại"
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
              + Thêm tài khoản
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
            Đang tải tài khoản Ads…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[12px_16px]">MÃ TK</th>
                  <th className="p-[12px_16px]">TÊN TK ADS</th>
                  <th className="p-[12px_16px]">TÊN QUẢNG CÁO</th>
                  <th className="p-[12px_16px]">MARKETING</th>
                  <th className="p-[12px_16px]">TEAM/DỰ ÁN</th>
                  <th className="p-[12px_16px]">AGENCY</th>
                  <th className="p-[12px_16px]">LOẠI TIỀN</th>
                  <th className="p-[12px_16px] text-right">HẠN MỨC</th>
                  <th className="p-[12px_16px]">FANPAGE</th>
                  <th className="p-[12px_16px]">NGÀY BĐ</th>
                  <th className="p-[12px_16px]">TRẠNG THÁI</th>
                  <th className="p-[12px_16px]" />
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)]">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={11} className="p-[24px_16px] text-center text-[var(--text3)] space-y-3">
                      <div>{emptyHint}</div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setFormOpen(true);
                        }}
                        className="inline-flex bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[8px] px-[16px] rounded-[6px] text-[11px] font-bold"
                      >
                        + Thêm tài khoản đầu tiên
                      </button>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const warn = rowNeedsSetup(row);
                    const mkt = row.marketing_staff;
                    const mktCell = mkt ? `${mkt.name} (${mkt.id_ns})` : '—';
                    const agency = row.agency?.trim() || row.du_an?.don_vi?.trim();
                    const agencyCell = agency ? (
                      agency
                    ) : (
                      <span className="text-[var(--R)] font-bold">⚠ Chưa gắn</span>
                    );
                    const tp = teamProjectLabel(row, teams);

                    return (
                      <tr
                        key={row.id}
                        className={
                          warn
                            ? 'border-b border-[rgba(224,61,61,0.1)] bg-[rgba(224,61,61,0.03)] hover:bg-[rgba(224,61,61,0.05)] transition-colors'
                            : 'border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors'
                        }
                      >
                        <td className={`p-[12px_16px] font-bold ${warn ? 'text-[var(--R)]' : 'text-[#3d8ef0]'}`}>
                          {row.ma_tkqc}
                        </td>
                        <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">
                          {row.ten_tkqc || '—'}
                        </td>
                        <td
                          className="p-[12px_16px] max-w-[180px] truncate text-[var(--text2)]"
                          title={row.ten_quang_cao?.trim() || ''}
                        >
                          {row.ten_quang_cao?.trim() || '—'}
                        </td>
                        <td className={`p-[12px_16px] ${!mkt ? 'text-[var(--text3)]' : ''}`}>{mktCell}</td>
                        <td className="p-[12px_16px] max-w-[200px] truncate" title={tp}>
                          {tp}
                        </td>
                        <td className="p-[12px_16px]">{agencyCell}</td>
                        <td className="p-[12px_16px]">
                          <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">
                            VNĐ
                          </span>
                        </td>
                        <td className="p-[12px_16px] text-right font-bold text-[var(--text)] tabular-nums">
                          {formatCompactVnd(row.ngan_sach_phan_bo)}
                        </td>
                        <td className="p-[12px_16px] text-[var(--text3)] max-w-[140px] truncate" title={row.ten_pae || ''}>
                          {row.ten_pae || '—'}
                        </td>
                        <td className="p-[12px_16px]">{formatDateVn(row.ngay_bat_dau || row.du_an?.ngay_bat_dau)}</td>
                        <td className="p-[12px_16px]">{tkqcTrangThaiCell(row)}</td>
                        <td className="p-[12px_16px] text-right">
                          <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(row);
                                setFormOpen(true);
                              }}
                              disabled={deletingId === row.id}
                              className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all disabled:opacity-40"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(row)}
                              disabled={deletingId !== null || loading}
                              className="inline-flex items-center gap-1 bg-[rgba(224,61,61,0.1)] hover:bg-[rgba(224,61,61,0.18)] text-[var(--R)] text-[10px] font-bold p-[4px_10px] rounded-[4px] border border-[rgba(224,61,61,0.28)] transition-all disabled:opacity-40"
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="animate-spin shrink-0" size={12} />
                              ) : (
                                <Trash2 className="shrink-0" size={12} />
                              )}
                              Xoá
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
        )}
      </SectionCard>

      <AdAccountFormModal
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
