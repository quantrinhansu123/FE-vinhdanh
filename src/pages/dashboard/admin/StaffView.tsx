import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { Employee } from '../../../types';
import { StaffFormModal } from './StaffFormModal';
import { StaffDetailModal } from './StaffDetailModal';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';

const STAFF_SELECT =
  'id, name, team, score, avatar_url, email, ma_ns, ngay_bat_dau, vi_tri, so_fanpage, trang_thai';

function formatDateVn(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function workDaysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const ms = today.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function displayMaNs(row: Employee): string {
  const m = row.ma_ns?.trim();
  if (m) return m;
  return row.id.slice(0, 8).toUpperCase();
}

function trangThaiCell(tt: string | null | undefined): React.ReactNode {
  switch (tt) {
    case 'dang_lam':
      return <Badge type="G">Đang làm</Badge>;
    case 'nghi':
      return <Badge type="default">Nghỉ</Badge>;
    case 'tam_nghi':
      return <Badge type="Y">Tạm nghỉ</Badge>;
    case 'dot_tien':
      return (
        <span className="inline-flex items-center gap-[4px] p-[2.5px_8px] bg-[rgba(224,61,61,0.12)] text-[var(--R)] rounded-[4px] text-[9.5px] font-extrabold border border-[rgba(224,61,61,0.2)]">
          ⚠ Đốt tiền
        </span>
      );
    default:
      return <Badge type="default">{tt || '—'}</Badge>;
  }
}

type StaffViewProps = {
  onEmployeesRefresh?: () => void | Promise<void>;
};

export const StaffView: React.FC<StaffViewProps> = ({ onEmployeesRefresh }) => {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const viewingRef = useRef<Employee | null>(null);
  const editingRef = useRef<Employee | null>(null);
  useEffect(() => {
    viewingRef.current = viewing;
  }, [viewing]);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await supabase.from(EMPLOYEES_TABLE).select(STAFF_SELECT).order('name', { ascending: true });

    if (res.error) {
      console.error('employees staff:', res.error);
      setError(res.error.message || 'Không tải được danh sách nhân sự.');
      setRows([]);
    } else {
      setRows((res.data || []) as Employee[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (e: React.MouseEvent, row: Employee) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(row);
    setFormOpen(true);
  };

  const openView = (e: React.MouseEvent, row: Employee) => {
    e.preventDefault();
    e.stopPropagation();
    setViewing(row);
    setDetailOpen(true);
  };

  const handleSaved = () => {
    void load();
    void onEmployeesRefresh?.();
  };

  const deleteRow = useCallback(
    async (row: Employee) => {
      const label = row.name?.trim() || displayMaNs(row);
      if (!window.confirm(`Xoá nhân sự "${label}"? Thao tác này không hoàn tác.`)) return;

      setDeletingId(row.id);
      setError(null);
      const { error: delErr } = await supabase.from(EMPLOYEES_TABLE).delete().eq('id', row.id);
      setDeletingId(null);

      if (delErr) {
        console.error('employees delete:', delErr);
        setError(delErr.message || 'Không xoá được nhân sự.');
        return;
      }

      if (viewingRef.current?.id === row.id) {
        setViewing(null);
        setDetailOpen(false);
      }
      if (editingRef.current?.id === row.id) {
        setEditing(null);
        setFormOpen(false);
      }

      void load();
      void onEmployeesRefresh?.();
    },
    [load, onEmployeesRefresh]
  );

  const handleDelete = (e: React.MouseEvent, row: Employee) => {
    e.preventDefault();
    e.stopPropagation();
    void deleteRow(row);
  };

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="👤 Module 3 — Quản lý Nhân sự Marketing"
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
              onClick={openCreate}
              className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]"
            >
              + Thêm nhân sự
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
            Đang tải nhân sự…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[12px_16px]">MÃ NS</th>
                  <th className="p-[12px_16px]">HỌ TÊN</th>
                  <th className="p-[12px_16px]">VỊ TRÍ</th>
                  <th className="p-[12px_16px]">NGÀY BẮT ĐẦU</th>
                  <th className="p-[12px_16px] text-right">NGÀY LÀM VIỆC</th>
                  <th className="p-[12px_16px]">TEAM</th>
                  <th className="p-[12px_16px]">FANPAGE</th>
                  <th className="p-[12px_16px]">TRẠNG THÁI</th>
                  <th className="p-[12px_16px]"></th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)]">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={9} className="p-[24px_16px] text-center text-[var(--text3)] space-y-3">
                      <div>
                        Chưa có nhân sự hoặc thiếu cột CRM. Chạy{' '}
                        <code className="text-[var(--text2)]">supabase/alter_employees_crm_staff_ui.sql</code> trên Supabase nếu
                        cần.
                      </div>
                      <button type="button" onClick={openCreate} className="inline-flex bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[8px] px-[16px] rounded-[6px] text-[11px] font-bold">
                        + Thêm nhân sự đầu tiên
                      </button>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const days = workDaysSince(row.ngay_bat_dau);
                    const fp = row.so_fanpage ?? 0;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors"
                      >
                        <td className="p-[12px_16px] font-bold text-[#3d8ef0]">{displayMaNs(row)}</td>
                        <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">{row.name}</td>
                        <td className="p-[12px_16px] max-w-[140px] truncate" title={row.vi_tri || ''}>
                          {row.vi_tri?.trim() || '—'}
                        </td>
                        <td className="p-[12px_16px]">{formatDateVn(row.ngay_bat_dau)}</td>
                        <td className="p-[12px_16px] text-right font-medium tabular-nums">
                          {days != null ? days : '—'}
                        </td>
                        <td className="p-[12px_16px] font-medium text-[var(--text2)] max-w-[200px] truncate" title={row.team}>
                          {row.team}
                        </td>
                        <td className="p-[12px_16px]">
                          <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">
                            {fp} fanpage
                          </span>
                        </td>
                        <td className="p-[12px_16px]">{trangThaiCell(row.trang_thai)}</td>
                        <td className="p-[12px_16px] text-right">
                          <div className="inline-flex items-center gap-[6px] justify-end">
                            <button
                              type="button"
                              onClick={(e) => openView(e, row)}
                              disabled={deletingId === row.id}
                              className="inline-flex items-center justify-center w-[30px] h-[26px] rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] text-[var(--text2)] hover:bg-[rgba(61,142,240,0.15)] hover:text-[#3d8ef0] hover:border-[rgba(61,142,240,0.35)] transition-all disabled:opacity-40"
                              title="Xem chi tiết"
                              aria-label="Xem chi tiết"
                            >
                              <Eye size={14} strokeWidth={2.25} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => openEdit(e, row)}
                              disabled={deletingId === row.id}
                              className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all disabled:opacity-40"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={(e) => void handleDelete(e, row)}
                              disabled={deletingId === row.id}
                              className="inline-flex items-center justify-center w-[30px] h-[26px] rounded-[4px] border border-[rgba(224,61,61,0.25)] bg-[rgba(224,61,61,0.08)] text-[var(--R)] hover:bg-[rgba(224,61,61,0.18)] hover:border-[rgba(224,61,61,0.45)] transition-all disabled:opacity-40"
                              title="Xoá"
                              aria-label="Xoá nhân sự"
                            >
                              {deletingId === row.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} strokeWidth={2.25} />
                              )}
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

      <StaffFormModal
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />

      <StaffDetailModal
        open={detailOpen}
        row={viewing}
        onDelete={deleteRow}
        deleting={Boolean(viewing && deletingId === viewing.id)}
        onClose={() => {
          setDetailOpen(false);
          setViewing(null);
        }}
      />
    </div>
  );
};
