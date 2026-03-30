import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { CrmAgencyRow } from '../../../types';
import { AgencyFormModal } from './AgencyFormModal';

const AGENCIES_TABLE = import.meta.env.VITE_SUPABASE_AGENCIES_TABLE?.trim() || 'crm_agencies';

const SELECT =
  'id, ma_agency, ten_agency, lien_he, telegram, tk_cung_cap, du_an, tong_da_nap, cong_no, trang_thai';

function formatCompactVnd(n: number | null | undefined): string {
  if (n == null) return '—';
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
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

function agencyTrangThaiCell(tt: string | undefined): React.ReactNode {
  switch (tt) {
    case 'active':
      return <Badge type="G">Active</Badge>;
    case 'theo_doi':
      return <Badge type="Y">Theo dõi</Badge>;
    case 'tam_dung':
      return <Badge type="Y">Tạm dừng</Badge>;
    case 'ngung':
      return <Badge type="default">Ngừng</Badge>;
    default:
      return <Badge type="default">{tt || '—'}</Badge>;
  }
}

export const AgenciesView: React.FC = () => {
  const [rows, setRows] = useState<CrmAgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmAgencyRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const editingRef = useRef<CrmAgencyRow | null>(null);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await supabase.from(AGENCIES_TABLE).select(SELECT).order('ten_agency', { ascending: true });

    if (res.error) {
      console.error('crm_agencies:', res.error);
      setError(res.error.message || 'Không tải được danh sách agency.');
      setRows([]);
    } else {
      setRows((res.data || []) as CrmAgencyRow[]);
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

  const openEdit = (e: React.MouseEvent, row: CrmAgencyRow) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(row);
    setFormOpen(true);
  };

  const deleteRow = useCallback(async (row: CrmAgencyRow) => {
    const label = row.ten_agency?.trim() || row.ma_agency;
    if (!window.confirm(`Xoá agency "${label}"? Thao tác này không hoàn tác.`)) return;

    setDeletingId(row.id);
    setError(null);
    const { error: delErr } = await supabase.from(AGENCIES_TABLE).delete().eq('id', row.id);
    setDeletingId(null);

    if (delErr) {
      console.error('crm_agencies delete:', delErr);
      setError(delErr.message || 'Không xoá được agency.');
      return;
    }

    if (editingRef.current?.id === row.id) {
      setEditing(null);
      setFormOpen(false);
    }
    void load();
  }, [load]);

  const handleDelete = (e: React.MouseEvent, row: CrmAgencyRow) => {
    e.preventDefault();
    e.stopPropagation();
    void deleteRow(row);
  };

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="🏢 Module 5 — Quản lý Agency"
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
              + Thêm agency
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
            Đang tải agency…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[12px_16px]">MÃ</th>
                  <th className="p-[12px_16px]">TÊN AGENCY</th>
                  <th className="p-[12px_16px]">LIÊN HỆ</th>
                  <th className="p-[12px_16px]">TELEGRAM</th>
                  <th className="p-[12px_16px]">TK CUNG CẤP</th>
                  <th className="p-[12px_16px]">DỰ ÁN</th>
                  <th className="p-[12px_16px] text-right">TỔNG ĐÃ NẠP</th>
                  <th className="p-[12px_16px] text-right">CÔNG NỢ</th>
                  <th className="p-[12px_16px]">TRẠNG THÁI</th>
                  <th className="p-[12px_16px]"></th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)]">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={10} className="p-[24px_16px] text-center text-[var(--text3)] space-y-3">
                      <div>
                        Chưa có agency. Chạy <code className="text-[var(--text2)]">supabase/create_crm_agencies.sql</code> trên
                        Supabase hoặc thêm bảng <code className="text-[var(--text2)]">{AGENCIES_TABLE}</code>.
                      </div>
                      <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[8px] px-[16px] rounded-[6px] text-[11px] font-bold"
                      >
                        + Thêm agency đầu tiên
                      </button>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const nap = row.tong_da_nap ?? 0;
                    const no = row.cong_no ?? 0;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors"
                      >
                        <td className="p-[12px_16px] font-bold text-[#3d8ef0]">{row.ma_agency}</td>
                        <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">{row.ten_agency}</td>
                        <td className="p-[12px_16px]">{row.lien_he || '—'}</td>
                        <td className="p-[12px_16px] text-[#3d8ef0] font-medium">{row.telegram || '—'}</td>
                        <td className="p-[12px_16px]">
                          {row.tk_cung_cap ? (
                            <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">
                              {row.tk_cung_cap}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-[12px_16px]">{row.du_an || '—'}</td>
                        <td className="p-[12px_16px] text-right text-[var(--G)] font-extrabold tabular-nums">
                          {formatCompactVnd(nap)}
                        </td>
                        <td
                          className={`p-[12px_16px] text-right font-medium tabular-nums ${
                            no > 0 ? 'text-[var(--Y)] font-bold' : ''
                          }`}
                        >
                          {formatCompactVnd(no)}
                        </td>
                        <td className="p-[12px_16px]">{agencyTrangThaiCell(row.trang_thai)}</td>
                        <td className="p-[12px_16px] text-right">
                          <div className="inline-flex items-center gap-[6px] justify-end">
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
                              onClick={(e) => handleDelete(e, row)}
                              disabled={deletingId === row.id}
                              className="inline-flex items-center justify-center w-[30px] h-[26px] rounded-[4px] border border-[rgba(224,61,61,0.25)] bg-[rgba(224,61,61,0.08)] text-[var(--R)] hover:bg-[rgba(224,61,61,0.18)] transition-all disabled:opacity-40"
                              title="Xoá"
                              aria-label="Xoá agency"
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

      <AgencyFormModal
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
