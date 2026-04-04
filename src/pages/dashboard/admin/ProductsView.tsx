import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { CrmProductRow } from '../../../types';
import { ProductFormModal } from './ProductFormModal';

const PRODUCTS_TABLE = import.meta.env.VITE_SUPABASE_PRODUCTS_TABLE?.trim() || 'crm_products';

const SELECT =
  'id, ma_san_pham, ten_san_pham, mo_ta, danh_muc, gia_ban, don_vi_tinh, id_du_an, trang_thai, du_an ( id, ma_du_an, ten_du_an )';

const PAGE_SIZE = 10;

const HEATMAP_OPACITIES = [0.2, 0.4, 0.1, 0.8, 0.3, 0.6, 0.2, 0.1, 0.9, 0.4, 0.2, 0.5, 0.1, 0.3];

function formatVnd(n: number | null | undefined): string {
  if (n == null) return '—';
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('vi-VN');
}

function duAnLabel(row: CrmProductRow): string {
  const da = row.du_an;
  if (!da) return '—';
  return [da.ma_du_an, da.ten_du_an].filter(Boolean).join(' - ') || da.ten_du_an;
}

function statusPill(tt: string | undefined): { label: string; className: string } {
  switch (tt) {
    case 'dang_ban':
      return {
        label: 'Đang bán',
        className: 'bg-[#69f6b8]/15 text-[#69f6b8]',
      };
    case 'tam_ngung':
      return {
        label: 'Tạm ngừng',
        className: 'bg-[#ffb148]/15 text-[#ffb148]',
      };
    case 'ngung':
      return {
        label: 'Ngừng bán',
        className: 'bg-[#ff716c]/15 text-[#ff716c]',
      };
    default:
      return {
        label: tt?.trim() || '—',
        className: 'bg-[#a5aac2]/15 text-[#a5aac2]',
      };
  }
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export const ProductsView: React.FC = () => {
  const [rows, setRows] = useState<CrmProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmProductRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const editingRef = useRef<CrmProductRow | null>(null);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Product Management - Ad CRM';
    return () => {
      document.title = prev;
    };
  }, []);

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

  const openCreate = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (e: React.MouseEvent, row: CrmProductRow) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(row);
    setFormOpen(true);
  };

  const deleteRow = useCallback(
    async (row: CrmProductRow) => {
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
    },
    [load]
  );

  const handleDelete = (e: React.MouseEvent, row: CrmProductRow) => {
    e.preventDefault();
    e.stopPropagation();
    void deleteRow(row);
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const blob = [
        row.ma_san_pham,
        row.ten_san_pham,
        row.mo_ta,
        row.danh_muc,
        row.du_an?.ma_du_an,
        row.du_an?.ten_du_an,
        row.don_vi_tinh,
        row.trang_thai,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search, rows.length]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, safePage]);

  const metrics = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.trang_thai === 'dang_ban').length;
    const warn = rows.filter((r) => r.trang_thai === 'tam_ngung').length;
    const pct = total ? Math.round((active / total) * 100) : 0;
    return { total, active, warn, pct };
  }, [rows]);

  const heatMonthLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  }, []);

  const shellClass =
    'prod-mgmt-cc -m-3 min-h-[calc(100vh-5.5rem)] overflow-x-hidden bg-[#070d1f] p-6 pb-24 font-[Inter,sans-serif] text-[#dfe4fe] antialiased sm:p-8 prod-mgmt-scroll';

  return (
    <div className={shellClass}>
      <div
        className={
          formOpen ? 'pointer-events-none select-none opacity-[0.32] transition-opacity duration-200' : ''
        }
      >
        <div className="mb-8 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-[#dfe4fe] sm:text-4xl">
              Quản lý Sản phẩm
            </h2>
            <div className="flex items-center gap-2 text-sm text-[#a5aac2]">
              <span>Trang chủ</span>
              <span className="material-symbols-outlined text-[12px] text-[#a5aac2]">chevron_right</span>
              <span className="text-[#05a9e3]">Sản phẩm</span>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3bbffa] to-[#22b1ec] px-6 py-3 text-sm font-bold text-[#00121d] shadow-lg shadow-[#3bbffa]/20 transition-all duration-150 hover:scale-105"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Thêm sản phẩm
          </button>
        </div>

        <div className="mb-8 grid grid-cols-12 gap-6">
          <div className="group relative col-span-12 overflow-hidden rounded-xl bg-[#0c1326] p-6 md:col-span-4">
            <div className="absolute right-0 top-0 p-4 opacity-10 transition-opacity group-hover:opacity-20">
              <span className="material-symbols-outlined text-7xl text-[#a5aac2]">inventory_2</span>
            </div>
            <p className="mb-4 font-[Manrope,sans-serif] text-sm text-[#a5aac2]">Tổng SKU</p>
            <div className="flex items-baseline gap-2">
              <h3 className="font-[Inter,sans-serif] text-4xl font-bold text-[#dfe4fe]">
                {metrics.total.toLocaleString('vi-VN')}
              </h3>
              {metrics.total > 0 ? (
                <span className="font-[Manrope,sans-serif] text-xs text-[#69f6b8]">live</span>
              ) : null}
            </div>
          </div>
          <div className="col-span-12 rounded-xl bg-[#0c1326] p-6 md:col-span-3">
            <p className="mb-4 font-[Manrope,sans-serif] text-sm text-[#a5aac2]">Sản phẩm đang bán</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-[#dfe4fe]">{metrics.active.toLocaleString('vi-VN')}</h3>
              <span className="font-[Manrope,sans-serif] text-xs text-[#69f6b8]">{metrics.pct}%</span>
            </div>
          </div>
          <div className="col-span-12 flex items-center justify-between rounded-xl border-l-4 border-[#ffb148] bg-[#0c1326] p-6 md:col-span-5">
            <div>
              <p className="mb-2 font-[Manrope,sans-serif] text-sm text-[#a5aac2]">Thông báo tồn kho</p>
              <h3 className="text-xl font-semibold text-[#ffb148]">
                {metrics.warn > 0
                  ? `${metrics.warn} sản phẩm cần theo dõi (tạm ngừng)`
                  : 'Không có cảnh báo'}
              </h3>
            </div>
            <span className="material-symbols-outlined text-4xl text-[#ffb148]">warning</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-[#11192e] shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#171f36]/50 p-4 backdrop-blur-sm sm:p-6">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
              <div className="flex shrink-0 items-center rounded-lg border border-[#41475b]/10 bg-[#1c253e] px-3 py-1.5">
                <span className="material-symbols-outlined mr-2 text-sm text-[#a5aac2]">filter_alt</span>
                <span className="font-[Manrope,sans-serif] text-xs text-[#dfe4fe]">Bộ lọc</span>
              </div>
              <div className="relative min-w-[200px] max-w-md flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a5aac2] transition-colors group-focus-within:text-[#3bbffa]">
                  search
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm SKU, tên, danh mục…"
                  className="group w-full rounded-lg border-none bg-[#1c253e] py-2 pl-10 pr-4 text-sm text-[#dfe4fe] placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#3bbffa]"
                />
              </div>
              <p className="text-xs text-[#a5aac2]">
                Hiển thị{' '}
                <span className="font-bold text-[#dfe4fe]">
                  {filteredRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–
                  {Math.min(safePage * PAGE_SIZE, filteredRows.length)}
                </span>{' '}
                trong số <span className="font-bold text-[#dfe4fe]">{filteredRows.length}</span> sản phẩm
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`rounded-md p-2 transition-colors ${viewMode === 'grid' ? 'bg-[#1c253e] text-[#3bbffa]' : 'text-[#a5aac2] hover:text-[#3bbffa]'}`}
                title="Lưới"
              >
                <span className="material-symbols-outlined">grid_view</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded-md p-2 transition-colors ${viewMode === 'list' ? 'bg-[#1c253e] text-[#3bbffa]' : 'text-[#a5aac2] hover:text-[#3bbffa]'}`}
                title="Danh sách"
              >
                <span className="material-symbols-outlined">list</span>
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded-md p-2 text-[#a5aac2] transition-colors hover:text-[#3bbffa] disabled:opacity-40"
                title="Làm mới"
              >
                <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>
                  {loading ? 'progress_activity' : 'refresh'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="border-t border-[#41475b]/10 bg-red-950/40 px-6 py-3 text-xs text-red-300">{error}</div>
          )}

          {loading && !rows.length ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#a5aac2]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Đang tải…
            </div>
          ) : viewMode === 'list' ? (
            <div className="prod-mgmt-scroll overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#0c1326]/50">
                    <th className="px-4 py-4 font-[Manrope,sans-serif] text-[10px] font-extrabold uppercase tracking-widest text-[#a5aac2] sm:px-6">
                      MÃ SKU
                    </th>
                    <th className="px-4 py-4 font-[Manrope,sans-serif] text-[10px] font-extrabold uppercase tracking-widest text-[#a5aac2] sm:px-6">
                      TÊN
                    </th>
                    <th className="px-4 py-4 font-[Manrope,sans-serif] text-[10px] font-extrabold uppercase tracking-widest text-[#a5aac2] sm:px-6">
                      DANH MỤC
                    </th>
                    <th className="px-4 py-4 font-[Manrope,sans-serif] text-[10px] font-extrabold uppercase tracking-widest text-[#a5aac2] sm:px-6">
                      DỰ ÁN
                    </th>
                    <th className="px-4 py-4 font-[Manrope,sans-serif] text-[10px] font-extrabold uppercase tracking-widest text-[#a5aac2] sm:px-6">
                      GIÁ (VNĐ)
                    </th>
                    <th className="px-4 py-4 font-[Manrope,sans-serif] text-[10px] font-extrabold uppercase tracking-widest text-[#a5aac2] sm:px-6">
                      ĐVT
                    </th>
                    <th className="px-4 py-4 font-[Manrope,sans-serif] text-[10px] font-extrabold uppercase tracking-widest text-[#a5aac2] sm:px-6">
                      TRẠNG THÁI
                    </th>
                    <th className="px-4 py-4 text-right font-[Manrope,sans-serif] text-[10px] font-extrabold uppercase tracking-widest text-[#a5aac2] sm:px-6">
                      THAO TÁC
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-transparent">
                  {filteredRows.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-sm text-[#a5aac2]">
                        {formOpen ? (
                          <div className="font-bold text-[#dfe4fe]">Đang mở form thêm sản phẩm…</div>
                        ) : (
                          <div className="space-y-4">
                            <p>
                              Chưa có sản phẩm hoặc không khớp bộ lọc. Chạy{' '}
                              <code className="text-[#3bbffa]">supabase/create_crm_products.sql</code> hoặc thêm mới.
                            </p>
                            <button
                              type="button"
                              onClick={() => openCreate()}
                              className="inline-flex rounded-lg bg-gradient-to-br from-[#3bbffa] to-[#22b1ec] px-5 py-2 text-sm font-bold text-[#00121d]"
                            >
                              Thêm sản phẩm đầu tiên
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const st = statusPill(row.trang_thai);
                      return (
                        <tr
                          key={row.id}
                          className="group transition-colors duration-200 hover:bg-[#171f36]"
                        >
                          <td className="px-4 py-5 sm:px-6">
                            <span className="rounded border border-[#3bbffa]/20 bg-black px-2 py-1 font-mono text-xs text-[#3bbffa]">
                              {row.ma_san_pham}
                            </span>
                          </td>
                          <td className="px-4 py-5 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gradient-to-br from-[#1c253e] to-[#3bbffa]/30 text-xs font-bold text-[#dfe4fe]">
                                {initials(row.ten_san_pham || row.ma_san_pham)}
                              </div>
                              <div>
                                <span className="text-sm font-bold text-[#dfe4fe]">{row.ten_san_pham}</span>
                                {row.mo_ta?.trim() ? (
                                  <p className="mt-0.5 max-w-[200px] truncate text-[10px] text-[#a5aac2]" title={row.mo_ta}>
                                    {row.mo_ta}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5 text-sm text-[#a5aac2] sm:px-6">
                            {row.danh_muc?.trim() || '—'}
                          </td>
                          <td className="px-4 py-5 sm:px-6">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-base text-[#ffb148]">folder</span>
                              <span className="text-sm text-[#a5aac2]">{duAnLabel(row)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-5 text-sm font-bold tabular-nums text-[#dfe4fe] sm:px-6">
                            {formatVnd(row.gia_ban)}
                          </td>
                          <td className="px-4 py-5 text-sm text-[#a5aac2] sm:px-6">
                            {row.don_vi_tinh?.trim() || '—'}
                          </td>
                          <td className="px-4 py-5 sm:px-6">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-[Manrope,sans-serif] text-xs font-bold ${st.className}`}
                            >
                              <span className="mr-1.5 h-1 w-1 rounded-full bg-current opacity-80" />
                              {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-5 text-right sm:px-6">
                            <div className="flex justify-end gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(e) => openEdit(e, row)}
                                disabled={deletingId === row.id}
                                className="rounded bg-[#1c253e] p-2 text-[#05a9e3] transition-all hover:bg-[#3bbffa] hover:text-[#00121d] disabled:opacity-40"
                                title="Sửa"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDelete(e, row)}
                                disabled={deletingId === row.id}
                                className="rounded bg-[#1c253e] p-2 text-[#ff716c] transition-all hover:bg-[#9f0519] hover:text-[#ffa8a3] disabled:opacity-40"
                                title="Xoá"
                              >
                                {deletingId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <span className="material-symbols-outlined text-sm">delete</span>
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
          ) : (
            <div className="prod-mgmt-scroll grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
              {pageRows.map((row) => {
                const st = statusPill(row.trang_thai);
                return (
                  <div
                    key={row.id}
                    className="group rounded-xl border border-[#41475b]/20 bg-[#0c1326] p-4 transition-colors hover:border-[#3bbffa]/30"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <span className="rounded border border-[#3bbffa]/20 bg-black px-2 py-0.5 font-mono text-[10px] text-[#3bbffa]">
                        {row.ma_san_pham}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-[Manrope,sans-serif] text-[10px] font-bold ${st.className}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gradient-to-br from-[#1c253e] to-[#3bbffa]/30 text-sm font-bold">
                        {initials(row.ten_san_pham || row.ma_san_pham)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#dfe4fe]">{row.ten_san_pham}</p>
                        <p className="truncate text-xs text-[#a5aac2]">{row.danh_muc || '—'}</p>
                      </div>
                    </div>
                    <p className="mb-1 text-xs text-[#a5aac2]">{duAnLabel(row)}</p>
                    <p className="mb-4 text-lg font-bold tabular-nums text-[#dfe4fe]">{formatVnd(row.gia_ban)} VNĐ</p>
                    <div className="flex justify-end gap-2 border-t border-[#41475b]/20 pt-3">
                      <button
                        type="button"
                        onClick={(e) => openEdit(e, row)}
                        disabled={deletingId === row.id}
                        className="rounded bg-[#1c253e] p-2 text-[#05a9e3] hover:bg-[#3bbffa] hover:text-[#00121d] disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, row)}
                        disabled={deletingId === row.id}
                        className="rounded bg-[#1c253e] p-2 text-[#ff716c] hover:bg-[#9f0519] hover:text-[#ffa8a3] disabled:opacity-40"
                      >
                        {deletingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">delete</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredRows.length > 0 && (
            <div className="flex flex-col items-stretch justify-between gap-4 border-t border-[#41475b]/10 bg-[#0c1326]/30 p-4 sm:flex-row sm:items-center sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded bg-[#1c253e] text-[#a5aac2] transition-colors hover:text-[#3bbffa] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                  .map((n, idx, arr) => (
                    <React.Fragment key={n}>
                      {idx > 0 && arr[idx - 1] !== n - 1 && (
                        <span className="px-1 text-[#a5aac2]">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(n)}
                        className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold ${
                          n === safePage
                            ? 'bg-[#3bbffa] text-[#00121d]'
                            : 'bg-[#1c253e] text-[#a5aac2] hover:text-[#3bbffa]'
                        }`}
                      >
                        {n}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded bg-[#1c253e] text-[#a5aac2] transition-colors hover:text-[#3bbffa] disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
              <div className="font-[Manrope,sans-serif] text-xs text-[#a5aac2]">
                Trang {safePage} / {totalPages}
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <div className="rounded-xl border-l border-[#3bbffa]/20 bg-[#0c1326] p-6">
              <div className="mb-6 flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-widest text-[#3bbffa]">
                  Tần suất cập nhật sản phẩm
                </h4>
                <span className="text-[10px] text-[#a5aac2] capitalize">{heatMonthLabel}</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {HEATMAP_OPACITIES.map((op, i) => (
                  <div
                    key={i}
                    className={`h-6 rounded-sm bg-[#006c49] ${op >= 0.8 ? 'shadow-[0_0_8px_rgba(105,246,184,0.3)]' : ''}`}
                    style={{ opacity: op }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <div className="rounded-xl bg-[#0c1326] p-6">
              <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-[#dfe4fe]">
                Lịch sử thay đổi
              </h4>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="h-10 w-1 shrink-0 rounded-full bg-[#3bbffa]" />
                  <div>
                    <p className="text-sm font-bold text-[#dfe4fe]">Đồng bộ danh mục từ CRM</p>
                    <p className="text-[10px] text-[#a5aac2]">Hệ thống · {metrics.total} SKU</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-1 shrink-0 rounded-full bg-[#ffb148]" />
                  <div>
                    <p className="text-sm font-bold text-[#dfe4fe]">Trạng thái tồn kho / bán hàng</p>
                    <p className="text-[10px] text-[#a5aac2]">
                      {metrics.warn > 0 ? `${metrics.warn} mục tạm ngừng` : 'Không có mục tạm ngừng'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => openCreate()}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#3bbffa] text-[#00121d] shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Thêm sản phẩm"
      >
        <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          add
        </span>
      </button>

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
