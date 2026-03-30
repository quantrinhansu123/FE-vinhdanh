import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { CrmProductRow } from '../../../types';
import { ProductFormModal } from './ProductFormModal';

const PRODUCTS_TABLE = import.meta.env.VITE_SUPABASE_PRODUCTS_TABLE?.trim() || 'crm_products';

const SELECT =
  'id, ma_san_pham, ten_san_pham, mo_ta, danh_muc, gia_ban, don_vi_tinh, id_du_an, trang_thai, du_an ( id, ma_du_an, ten_du_an )';

function formatVnd(n: number | null | undefined): string {
  if (n == null) return '—';
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('vi-VN');
}

function trangThaiCell(tt: string | undefined): React.ReactNode {
  switch (tt) {
    case 'dang_ban':
      return <Badge type="G">Đang bán</Badge>;
    case 'tam_ngung':
      return <Badge type="Y">Tạm ngừng</Badge>;
    case 'ngung':
      return <Badge type="default">Ngừng</Badge>;
    default:
      return <Badge type="default">{tt || '—'}</Badge>;
  }
}

export const ProductsView: React.FC = () => {
  const [rows, setRows] = useState<CrmProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmProductRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const editingRef = useRef<CrmProductRow | null>(null);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await supabase.from(PRODUCTS_TABLE).select(SELECT).order('ten_san_pham', { ascending: true });

    if (res.error) {
      console.error('crm_products:', res.error);
      setError(
        res.error.message.includes('does not exist') || res.error.message.includes('schema cache')
          ? `Chưa có bảng ${PRODUCTS_TABLE}. Chạy supabase/create_crm_products.sql trên Supabase.`
          : res.error.message || 'Không tải được danh sách sản phẩm.'
      );
      setRows([]);
    } else {
      setRows((res.data || []) as CrmProductRow[]);
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

  const openEdit = (e: React.MouseEvent, row: CrmProductRow) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(row);
    setFormOpen(true);
  };

  const deleteRow = useCallback(async (row: CrmProductRow) => {
    const label = row.ten_san_pham?.trim() || row.ma_san_pham;
    if (!window.confirm(`Xoá sản phẩm "${label}"? Thao tác không hoàn tác.`)) return;

    setDeletingId(row.id);
    setError(null);
    const { error: delErr } = await supabase.from(PRODUCTS_TABLE).delete().eq('id', row.id);
    setDeletingId(null);

    if (delErr) {
      console.error('crm_products delete:', delErr);
      setError(delErr.message || 'Không xoá được sản phẩm.');
      return;
    }

    if (editingRef.current?.id === row.id) {
      setEditing(null);
      setFormOpen(false);
    }
    void load();
  }, [load]);

  const handleDelete = (e: React.MouseEvent, row: CrmProductRow) => {
    e.preventDefault();
    e.stopPropagation();
    void deleteRow(row);
  };

  return (
    <div className="dash-fade-up">
      <SectionCard
        className={formOpen ? 'opacity-[0.32] pointer-events-none select-none transition-opacity duration-200' : ''}
        title="📦 Quản lý Sản phẩm"
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
              + Thêm sản phẩm
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
            Đang tải…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[12px_16px]">MÃ SKU</th>
                  <th className="p-[12px_16px]">TÊN</th>
                  <th className="p-[12px_16px]">DANH MỤC</th>
                  <th className="p-[12px_16px]">DỰ ÁN</th>
                  <th className="p-[12px_16px] text-right">GIÁ (VNĐ)</th>
                  <th className="p-[12px_16px]">ĐVT</th>
                  <th className="p-[12px_16px]">TRẠNG THÁI</th>
                  <th className="p-[12px_16px]"></th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)]">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="p-[24px_16px] text-center text-[var(--text3)] space-y-3">
                      {formOpen ? (
                        <div className="text-[12px] font-bold text-[var(--text2)] py-4">
                          Đang mở form thêm sản phẩm…
                        </div>
                      ) : (
                        <>
                          <div>
                            Chưa có sản phẩm. Chạy <code className="text-[var(--text2)]">supabase/create_crm_products.sql</code> hoặc
                            thêm qua nút bên dưới.
                          </div>
                          <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[8px] px-[16px] rounded-[6px] text-[11px] font-bold"
                          >
                            + Thêm sản phẩm đầu tiên
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const da = row.du_an;
                    const duAnLabel = da
                      ? [da.ma_du_an, da.ten_du_an].filter(Boolean).join(' · ') || da.ten_du_an
                      : '—';
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors"
                      >
                        <td className="p-[12px_16px] font-bold text-[#3d8ef0]">{row.ma_san_pham}</td>
                        <td className="p-[12px_16px]">
                          <div className="font-extrabold text-[#fff] tracking-[0.2px]">{row.ten_san_pham}</div>
                          {row.mo_ta?.trim() ? (
                            <div className="text-[9px] text-[var(--text3)] mt-0.5 max-w-[280px] truncate" title={row.mo_ta}>
                              {row.mo_ta}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-[12px_16px]">{row.danh_muc?.trim() || '—'}</td>
                        <td className="p-[12px_16px] max-w-[160px] truncate" title={duAnLabel}>
                          {duAnLabel}
                        </td>
                        <td className="p-[12px_16px] text-right tabular-nums font-medium">{formatVnd(row.gia_ban)}</td>
                        <td className="p-[12px_16px]">{row.don_vi_tinh?.trim() || '—'}</td>
                        <td className="p-[12px_16px]">{trangThaiCell(row.trang_thai)}</td>
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
                              aria-label="Xoá sản phẩm"
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

      <ProductFormModal
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
