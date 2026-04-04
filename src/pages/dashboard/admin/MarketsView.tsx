import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { CrmMarketRow } from '../../../types';
import { MarketFormModal } from './MarketFormModal';

const MARKETS_TABLE = import.meta.env.VITE_SUPABASE_MARKETS_TABLE?.trim() || 'crm_markets';

const SELECT = 'id, ma_thi_truong, ten_thi_truong, mo_ta, trang_thai';

const PAGE_SIZE = 10;

function statusPill(tt: string | undefined): { label: string; className: string } {
  switch (tt) {
    case 'hoat_dong':
      return {
        label: 'Hoạt động',
        className: 'bg-green-500/10 text-green-400',
      };
    case 'tam_dung':
      return {
        label: 'Tạm dừng',
        className: 'bg-yellow-500/10 text-yellow-500',
      };
    case 'ngung':
      return {
        label: 'Ngừng',
        className: 'bg-red-500/10 text-red-400',
      };
    default:
      return {
        label: tt?.trim() || '—',
        className: 'bg-[#31353c]/50 text-[#bac9cc]',
      };
  }
}

function nameSubtitle(row: CrmMarketRow): string {
  const m = row.mo_ta?.trim();
  if (!m) return '—';
  const line = m.split(/\n/)[0]?.trim() || m;
  if (line === row.ten_thi_truong?.trim()) return '—';
  return line.length > 56 ? `${line.slice(0, 54)}…` : line;
}

export const MarketsView: React.FC = () => {
  const [rows, setRows] = useState<CrmMarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmMarketRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const editingRef = useRef<CrmMarketRow | null>(null);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Obsidian Flux - Market Management';
    return () => {
      document.title = prev;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await supabase.from(MARKETS_TABLE).select(SELECT).order('ten_thi_truong', { ascending: true });

    if (res.error) {
      console.error('crm_markets:', res.error);
      setError(
        res.error.message.includes('does not exist') || res.error.message.includes('schema cache')
          ? `Chưa có bảng ${MARKETS_TABLE}. Chạy supabase/create_crm_markets.sql trên Supabase.`
          : res.error.message || 'Không tải được danh sách thị trường.'
      );
      setRows([]);
    } else {
      setRows((res.data || []) as CrmMarketRow[]);
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

  const openEdit = (e: React.MouseEvent, row: CrmMarketRow) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(row);
    setFormOpen(true);
  };

  const deleteRow = useCallback(
    async (row: CrmMarketRow) => {
      const label = row.ten_thi_truong?.trim() || row.ma_thi_truong;
      if (!window.confirm(`Xoá thị trường "${label}"? Thao tác không hoàn tác.`)) return;

      setDeletingId(row.id);
      setError(null);
      const { error: delErr } = await supabase.from(MARKETS_TABLE).delete().eq('id', row.id);
      setDeletingId(null);

      if (delErr) {
        console.error('crm_markets delete:', delErr);
        setError(delErr.message || 'Không xoá được.');
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

  const handleDelete = (e: React.MouseEvent, row: CrmMarketRow) => {
    e.preventDefault();
    e.stopPropagation();
    void deleteRow(row);
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const blob = [row.ma_thi_truong, row.ten_thi_truong, row.mo_ta, row.trang_thai]
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
    const active = rows.filter((r) => r.trang_thai === 'hoat_dong').length;
    const pct = total ? Math.round((active / total) * 1000) / 10 : 0;
    return { total, active, pct };
  }, [rows]);

  const monthChip = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, []);

  const shell =
    'flux-market-cc -m-3 min-h-[calc(100vh-5.5rem)] overflow-x-hidden bg-[#10141a] p-6 pb-28 selection:bg-[#00e5ff] selection:text-[#00626e] sm:p-8 font-[Inter,sans-serif] text-[#dfe2eb] antialiased flux-market-scroll';

  return (
    <div className={shell}>
      <div
        className={
          formOpen ? 'pointer-events-none select-none opacity-[0.32] transition-opacity duration-200' : ''
        }
      >
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#bac9cc]/50">
                search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Global Search…"
                className="w-full rounded-full border-none bg-[#0a0e14] py-2 pl-10 pr-4 text-sm text-[#dfe2eb] placeholder:text-[#bac9cc]/30 focus:outline-none focus:ring-1 focus:ring-[#c3f5ff]/40"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="flex items-center gap-1 rounded-lg bg-[#1c2026] px-3 py-1.5 text-[#bac9cc]">
                <span className="font-semibold text-[#c3f5ff]">Project:</span>
                <span className="max-w-[140px] truncate">CRM</span>
                <span className="material-symbols-outlined text-xs">expand_more</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-[#1c2026] px-3 py-1.5 text-[#bac9cc]">
                <span className="font-semibold text-[#c3f5ff]">Month:</span>
                <span>{monthChip}</span>
                <span className="material-symbols-outlined text-xs">expand_more</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-[#93000a]/10 px-3 py-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Live</span>
            </div>
          </div>
        </div>

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-[Manrope,sans-serif] text-3xl font-extrabold tracking-tight text-[#dfe2eb]">
              Thị trường
            </h2>
            <p className="mt-1 text-sm text-[#bac9cc]">Quản lý và điều phối các đơn vị thị trường khu vực.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-[#262a31] px-5 py-2.5 font-semibold text-[#dfe2eb] transition-all hover:bg-[#31353c] disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>
                {loading ? 'progress_activity' : 'refresh'}
              </span>
              Làm mới
            </button>
            <button
              type="button"
              onClick={() => openCreate()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00daf3] to-[#00e5ff] px-6 py-2.5 font-bold text-[#00363d] shadow-lg shadow-[#c3f5ff]/10 transition-all hover:opacity-90"
            >
              <span className="material-symbols-outlined text-xl">add</span>
              Thêm thị trường
            </button>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-2xl bg-[#181c22] p-6">
            <div className="absolute right-0 top-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
              <span className="material-symbols-outlined text-7xl text-[#bac9cc]">public</span>
            </div>
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[#bac9cc]">Total markets</p>
            <div className="flex items-end gap-3">
              <span className="font-[Manrope,sans-serif] text-5xl font-black text-[#dfe2eb]">
                {metrics.total}
              </span>
              {metrics.total > 0 ? (
                <div className="mb-1 flex items-center gap-1 rounded bg-green-400/10 px-2 py-0.5 text-xs text-green-400">
                  <span className="material-symbols-outlined text-sm">arrow_upward</span>
                  12%
                </div>
              ) : null}
            </div>
            <p className="mt-4 text-xs text-[#bac9cc]">Đồng bộ từ {MARKETS_TABLE}</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border-t-2 border-[#c3f5ff]/20 bg-[#181c22] p-6">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[#bac9cc]">Active markets</p>
            <div className="flex items-end gap-3">
              <span className="font-[Manrope,sans-serif] text-5xl font-black text-[#c3f5ff]">{metrics.active}</span>
              <span className="mb-1 pb-1 text-sm text-[#bac9cc]">Hoạt động</span>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="h-1 flex-1 rounded-full bg-[#c3f5ff]/30" />
              <div className="h-1 flex-1 rounded-full bg-[#c3f5ff]/30" />
              <div
                className="h-1 flex-1 rounded-full bg-[#c3f5ff]"
                style={{ opacity: metrics.total ? Math.max(0.35, metrics.active / metrics.total) : 0.2 }}
              />
              <div className="h-1 flex-1 rounded-full bg-[#c3f5ff]/10" />
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-[#181c22] p-6">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[#bac9cc]">Average performance</p>
            <div className="mb-4 flex items-end justify-between">
              <span className="font-[Manrope,sans-serif] text-5xl font-black text-[#dfe2eb]">{metrics.pct}%</span>
              <span className="material-symbols-outlined text-3xl text-[#c3f5ff]">bolt</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#31353c]">
              <div className="h-full bg-[#00daf3] transition-all" style={{ width: `${Math.min(100, metrics.pct)}%` }} />
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-[10px] text-[#bac9cc]">Efficiency level</span>
              <span className="text-[10px] font-bold text-[#00daf3]">
                {metrics.pct >= 80 ? 'Target reached' : 'Building'}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-[#181c22]">
          <div className="flex flex-col gap-4 border-b border-white/5 bg-[#262a31]/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <h3 className="font-[Manrope,sans-serif] text-xl font-bold text-[#dfe2eb]">Quản lý Thị trường</h3>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#31353c] text-[#bac9cc] transition-colors hover:text-[#c3f5ff]"
                title="Bộ lọc"
              >
                <span className="material-symbols-outlined text-lg">filter_list</span>
              </button>
              <button
                type="button"
                disabled
                className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg bg-[#31353c] text-[#bac9cc]/50"
                title="Tải xuống (sắp có)"
              >
                <span className="material-symbols-outlined text-lg">download</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="border-b border-white/5 bg-red-950/30 px-6 py-3 text-xs text-red-300">{error}</div>
          )}

          {loading && !rows.length ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#bac9cc]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Đang tải…
            </div>
          ) : (
            <div className="flux-market-scroll overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-[#bac9cc] sm:px-8">
                      Mã
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-[#bac9cc] sm:px-6">
                      Tên
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-[#bac9cc] sm:px-6">
                      Mô tả
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-[#bac9cc] sm:px-6">
                      Trạng thái
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-widest text-[#bac9cc] sm:px-8">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filteredRows.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-sm text-[#bac9cc]">
                        {formOpen ? (
                          <div className="font-bold text-[#dfe2eb]">Đang mở form thêm thị trường…</div>
                        ) : (
                          <div className="space-y-4">
                            <p>
                              Chưa có thị trường hoặc không khớp tìm kiếm. Chạy{' '}
                              <code className="text-[#00daf3]">supabase/create_crm_markets.sql</code> hoặc thêm mới.
                            </p>
                            <button
                              type="button"
                              onClick={() => openCreate()}
                              className="inline-flex rounded-xl bg-gradient-to-r from-[#00daf3] to-[#00e5ff] px-5 py-2 text-sm font-bold text-[#00363d]"
                            >
                              Thêm bản ghi đầu tiên
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const st = statusPill(row.trang_thai);
                      const sub = nameSubtitle(row);
                      return (
                        <tr key={row.id} className="group transition-colors hover:bg-[#31353c]/50">
                          <td className="px-4 py-5 font-mono font-bold text-[#00daf3] sm:px-8">
                            {row.ma_thi_truong}
                          </td>
                          <td className="px-4 py-5 sm:px-6">
                            <div className="flex flex-col">
                              <span className="font-semibold text-[#dfe2eb]">{row.ten_thi_truong}</span>
                              <span className="text-xs text-[#bac9cc]/60">{sub}</span>
                            </div>
                          </td>
                          <td className="max-w-[280px] px-4 py-5 text-sm text-[#bac9cc] sm:px-6">
                            <span className="line-clamp-2" title={row.mo_ta || ''}>
                              {row.mo_ta?.trim() || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-5 sm:px-6">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${st.className}`}
                            >
                              <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                              {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-5 text-right sm:px-8">
                            <div className="flex justify-end gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(e) => openEdit(e, row)}
                                disabled={deletingId === row.id}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#31353c] text-[#bac9cc] transition-all hover:text-[#c3f5ff] disabled:opacity-40"
                                title="Sửa"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDelete(e, row)}
                                disabled={deletingId === row.id}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#31353c] text-[#bac9cc] transition-all hover:text-[#ffb4ab] disabled:opacity-40"
                                title="Xoá"
                              >
                                {deletingId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <span className="material-symbols-outlined text-lg">delete</span>
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

          {filteredRows.length > 0 && (
            <div className="flex flex-col gap-4 border-t border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="text-xs text-[#bac9cc]">
                Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filteredRows.length)} of{' '}
                {filteredRows.length} markets
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#31353c] text-[#bac9cc] transition-colors hover:bg-[#1c2026] disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                  .map((n, idx, arr) => (
                    <React.Fragment key={n}>
                      {idx > 0 && arr[idx - 1] !== n - 1 && <span className="text-[#bac9cc]">…</span>}
                      <button
                        type="button"
                        onClick={() => setPage(n)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                          n === safePage
                            ? 'bg-[#00e5ff] text-[#00626e]'
                            : 'bg-[#1c2026] text-[#bac9cc] hover:bg-[#31353c]'
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#31353c] text-[#bac9cc] transition-colors hover:bg-[#1c2026] disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => openCreate()}
        className="group fixed bottom-8 right-8 z-50 flex items-center gap-3 rounded-2xl bg-white px-6 py-4 font-bold text-[#10141a] shadow-2xl transition-all hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined transition-transform group-hover:rotate-90">segment</span>
        New segment
      </button>

      <MarketFormModal
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
