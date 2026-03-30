import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { DuAnRow } from '../../../types';
import { ProjectFormModal } from './ProjectFormModal';

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

function badgeForStatus(trangThai: string | undefined): { label: string; type: 'G' | 'Y' | 'R' | 'default' } {
  switch (trangThai) {
    case 'dang_chay':
      return { label: 'Active', type: 'G' };
    case 'review':
      return { label: 'Review', type: 'Y' };
    case 'tam_dung':
      return { label: 'Tạm dừng', type: 'Y' };
    case 'ket_thuc':
      return { label: 'Kết thúc', type: 'default' };
    case 'huy':
      return { label: 'Huỷ', type: 'R' };
    default:
      return { label: trangThai || '—', type: 'default' };
  }
}

function displayMa(ma: string | null, ten: string): string {
  if (ma?.trim()) {
    const t = ma.trim();
    if (t.length <= 4) return t.toUpperCase();
    return t.slice(0, 2).toUpperCase();
  }
  const w = ten.trim();
  if (w.length < 2) return w.toUpperCase() || '—';
  return w.slice(0, 2).toUpperCase();
}

export const ProjectsView: React.FC = () => {
  const [rows, setRows] = useState<DuAnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<DuAnRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from(DU_AN_TABLE)
      .select(
        'id, ma_du_an, ten_du_an, don_vi, mo_ta, thi_truong, leader, so_mkt, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, doanh_thu_thang, ty_le_ads_doanh_so, ngay_bat_dau, ngay_ket_thuc, trang_thai, staff_ids'
      )
      .order('ten_du_an', { ascending: true });

    if (qErr) {
      console.error('Supabase du_an:', qErr);
      setError(qErr.message || 'Không tải được danh sách dự án.');
      setRows([]);
    } else {
      setRows((data || []) as DuAnRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="📁 Module 1 — Quản lý Dự án"
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
                setEditingProject(null);
                setFormOpen(true);
              }}
              className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]"
            >
              + Thêm dự án
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
            Đang tải dự án…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[12px_16px]">MÃ</th>
                  <th className="p-[12px_16px]">TÊN DỰ ÁN</th>
                  <th className="p-[12px_16px]">THỊ TRƯỜNG</th>
                  <th className="p-[12px_16px]">LEADER</th>
                  <th className="p-[12px_16px] text-center">MKT</th>
                  <th className="p-[12px_16px] text-right">DT THÁNG</th>
                  <th className="p-[12px_16px]">TRẠNG THÁI</th>
                  <th className="p-[12px_16px]"></th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)]">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="p-[24px_16px] text-center text-[var(--text3)] space-y-3">
                      <div>
                        Chưa có dự án. Bạn có thể tạo mới ở đây hoặc thêm trong bảng{' '}
                        <code className="text-[var(--text2)]">{DU_AN_TABLE}</code>.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProject(null);
                          setFormOpen(true);
                        }}
                        className="inline-flex bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[8px] px-[16px] rounded-[6px] text-[11px] font-bold"
                      >
                        + Thêm dự án đầu tiên
                      </button>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const st = badgeForStatus(row.trang_thai);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors"
                      >
                        <td className="p-[12px_16px] font-bold text-[#3d8ef0]">{displayMa(row.ma_du_an, row.ten_du_an)}</td>
                        <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">{row.ten_du_an}</td>
                        <td className="p-[12px_16px] max-w-[120px] truncate" title={row.thi_truong || ''}>
                          {row.thi_truong || '—'}
                        </td>
                        <td className="p-[12px_16px] max-w-[130px] truncate" title={row.leader || ''}>
                          {row.leader || '—'}
                        </td>
                        <td className="p-[12px_16px] text-center tabular-nums">
                          {row.so_mkt != null ? row.so_mkt : '—'}
                        </td>
                        <td className="p-[12px_16px] text-right font-bold text-[#0fa86d] tabular-nums">
                          {formatCompactVnd(row.doanh_thu_thang ?? row.tong_doanh_so)}
                        </td>
                        <td className="p-[12px_16px]">
                          <Badge type={st.type}>{st.label}</Badge>
                        </td>
                        <td className="p-[12px_16px] text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProject(row);
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

      <ProjectFormModal
        open={formOpen}
        initial={editingProject}
        onClose={() => {
          setFormOpen(false);
          setEditingProject(null);
        }}
        onSaved={() => void load()}
      />
    </div>
  );
};
