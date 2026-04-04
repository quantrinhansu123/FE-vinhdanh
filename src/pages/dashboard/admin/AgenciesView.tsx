import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { CrmAgencyRow } from '../../../types';
import { AgencyFormModal } from './AgencyFormModal';

const AGENCIES_TABLE = import.meta.env.VITE_SUPABASE_AGENCIES_TABLE?.trim() || 'crm_agencies';

const SELECT =
  'id, ma_agency, ten_agency, lien_he, telegram, tk_cung_cap, du_an, tong_da_nap, cong_no, trang_thai, created_at, updated_at';

const PAGE_SIZE = 10;

const HEATMAP_BG: string[] = [
  'bg-[#006c49]/40',
  'bg-[#006c49]',
  'bg-[#f8a010]',
  'bg-[#006c49]/40',
  'bg-[#9f0519]',
  'bg-[#006c49]',
  'bg-[#f8a010]',
  'bg-[#006c49]',
  'bg-[#9f0519]',
  'bg-[#006c49]/20',
  'bg-[#006c49]',
  'bg-[#006c49]',
  'bg-[#006c49]',
  'bg-[#006c49]',
  'bg-[#006c49]/40',
  'bg-[#9f0519]',
  'bg-[#f8a010]',
  'bg-[#006c49]/60',
  'bg-[#006c49]',
  'bg-[#9f0519]',
  'bg-[#006c49]/10',
  'bg-[#006c49]',
  'bg-[#f8a010]',
  'bg-[#006c49]',
];

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

function contactInitials(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function projectChips(duAn: string | null | undefined): string[] {
  if (!duAn?.trim()) return [];
  return duAn
    .split(/[,，;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.length <= 4 ? s.toUpperCase() : s.slice(0, 2).toUpperCase()));
}

function statusPill(tt: string | undefined): { label: string; className: string } {
  switch (tt) {
    case 'active':
      return { label: 'Active', className: 'bg-[#69f6b8]/15 text-[#69f6b8]' };
    case 'theo_doi':
      return { label: 'Theo dõi', className: 'bg-[#ffb148]/15 text-[#ffb148]' };
    case 'tam_dung':
      return { label: 'Tạm dừng', className: 'bg-[#a5aac2]/15 text-[#a5aac2]' };
    case 'ngung':
      return { label: 'Ngừng', className: 'bg-[#ff716c]/15 text-[#ff716c]' };
    default:
      return { label: tt?.trim() || '—', className: 'bg-[#41475b]/30 text-[#a5aac2]' };
  }
}

export const AgenciesView: React.FC = () => {
  const [rows, setRows] = useState<CrmAgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmAgencyRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const editingRef = useRef<CrmAgencyRow | null>(null);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Obsidian Prism | Agency Management';
    return () => {
      document.title = prev;
    };
  }, []);

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

  const openCreate = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (e: React.MouseEvent, row: CrmAgencyRow) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(row);
    setFormOpen(true);
  };

  const deleteRow = useCallback(
    async (row: CrmAgencyRow) => {
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
    },
    [load]
  );

  const handleDelete = (e: React.MouseEvent, row: CrmAgencyRow) => {
    e.preventDefault();
    e.stopPropagation();
    void deleteRow(row);
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const blob = [
        row.ma_agency,
        row.ten_agency,
        row.lien_he,
        row.telegram,
        row.tk_cung_cap,
        row.du_an,
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

  const weekAgo = useMemo(() => Date.now() - 7 * 86400000, []);

  const metrics = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.trang_thai === 'active').length;
    const debtSum = rows.reduce((s, r) => s + (Number(r.cong_no) || 0), 0);
    const depositSum = rows.reduce((s, r) => s + (Number(r.tong_da_nap) || 0), 0);
    const newWeek = rows.filter(
      (r) => r.created_at && !Number.isNaN(new Date(r.created_at).getTime()) && new Date(r.created_at).getTime() > weekAgo
    ).length;
    const ratio = total ? active / total : 0;
    return { total, active, debtSum, depositSum, newWeek, ratio };
  }, [rows, weekAgo]);

  const worstDebt = useMemo(() => {
    let max = 0;
    let label = '';
    for (const r of rows) {
      const n = Number(r.cong_no) || 0;
      if (n > max) {
        max = n;
        label = r.ma_agency;
      }
    }
    return { max, label };
  }, [rows]);

  const footerYear = new Date().getFullYear();

  const dim = formOpen ? 'pointer-events-none select-none opacity-[0.32] transition-opacity duration-200' : '';

  return (
    <div className="flex min-h-[calc(100vh-5.5rem)] flex-col overflow-x-hidden bg-[#070d1f] font-[Inter,sans-serif] text-[#dfe4fe] antialiased -m-3 ag-prism-scroll">
      <div className={`flex-1 ${dim}`}>
        <div className="mx-auto w-full max-w-[1600px] space-y-8 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <nav className="mb-2 flex items-center gap-2 font-[Manrope,sans-serif] text-[10px] uppercase tracking-[0.2em] text-[#a5aac2]">
                <span>Management</span>
                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                <span className="font-bold text-[#3bbffa]">Agency (Module 5)</span>
              </nav>
              <h2 className="text-3xl font-bold tracking-tight text-[#dfe4fe]">Agency Ecosystem</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-[#41475b]/20 bg-[#0c1326] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-[#a5aac2] transition-colors hover:text-[#3bbffa] disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>
                  {loading ? 'progress_activity' : 'refresh'}
                </span>
                Làm mới
              </button>
              <button
                type="button"
                onClick={() => openCreate()}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3bbffa] to-[#22b1ec] px-6 py-3 text-sm font-bold text-[#00121d] shadow-[0_8px_20px_rgba(59,191,250,0.15)] transition-all hover:brightness-110 active:scale-95"
              >
                <span className="material-symbols-outlined font-bold">add</span>
                + Thêm agency
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="group relative overflow-hidden rounded-xl border-l-4 border-[#3bbffa]/40 bg-[#0c1326] p-6 transition-all hover:bg-[#171f36]">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-[#3bbffa]/10 p-2 text-[#3bbffa]">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    groups
                  </span>
                </div>
                <span className="rounded-full bg-[#69f6b8]/10 px-2 py-0.5 text-[10px] font-bold text-[#69f6b8]">
                  {metrics.newWeek > 0 ? `+${metrics.newWeek} New` : 'Synced'}
                </span>
              </div>
              <p className="mb-1 font-[Manrope,sans-serif] text-[11px] uppercase tracking-wider text-[#a5aac2]">
                Total agencies
              </p>
              <h3 className="text-3xl font-black text-[#dfe4fe]">{metrics.total}</h3>
              <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-5 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-[120px] text-[#a5aac2]">groups</span>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-xl border-l-4 border-[#69f6b8]/40 bg-[#0c1326] p-6 transition-all hover:bg-[#171f36]">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-[#69f6b8]/10 p-2 text-[#69f6b8]">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    bolt
                  </span>
                </div>
                <span className="rounded-full bg-[#69f6b8]/10 px-2 py-0.5 text-[10px] font-bold text-[#69f6b8]">
                  {metrics.ratio >= 0.5 ? 'Optimal' : 'Review'}
                </span>
              </div>
              <p className="mb-1 font-[Manrope,sans-serif] text-[11px] uppercase tracking-wider text-[#a5aac2]">
                Active agencies
              </p>
              <h3 className="text-3xl font-black text-[#dfe4fe]">{String(metrics.active).padStart(2, '0')}</h3>
              <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-5 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-[120px]">bolt</span>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-xl border-l-4 border-[#ff716c]/40 bg-[#0c1326] p-6 transition-all hover:bg-[#171f36]">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-[#ff716c]/10 p-2 text-[#ff716c]">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    account_balance
                  </span>
                </div>
                <span className="rounded-full bg-[#ff716c]/10 px-2 py-0.5 text-[10px] font-bold text-[#ff716c]">
                  {metrics.debtSum > 0 ? 'Due' : 'Clear'}
                </span>
              </div>
              <p className="mb-1 font-[Manrope,sans-serif] text-[11px] uppercase tracking-wider text-[#a5aac2]">
                Total debt
              </p>
              <h3 className="text-3xl font-black text-[#dfe4fe]">
                {formatCompactVnd(metrics.debtSum)}{' '}
                <span className="text-sm font-medium text-[#a5aac2]">VND</span>
              </h3>
              <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-5 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-[120px]">account_balance</span>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-xl border-l-4 border-[#ffb148]/40 bg-[#0c1326] p-6 transition-all hover:bg-[#171f36]">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-[#ffb148]/10 p-2 text-[#ffb148]">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    trending_up
                  </span>
                </div>
                <span className="rounded-full bg-[#ffb148]/10 px-2 py-0.5 text-[10px] font-bold text-[#ffb148]">
                  +14.2%
                </span>
              </div>
              <p className="mb-1 font-[Manrope,sans-serif] text-[11px] uppercase tracking-wider text-[#a5aac2]">
                Total deposited
              </p>
              <h3 className="text-3xl font-black text-[#dfe4fe]">
                {formatCompactVnd(metrics.depositSum)}{' '}
                <span className="text-sm font-medium text-[#a5aac2]">VND</span>
              </h3>
              <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-5 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-[120px]">trending_up</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-[#0c1326] shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-[#41475b]/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
                <div className="relative w-full max-w-md">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#a5aac2]">
                    search
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search agencies, IDs, or contacts…"
                    className="w-full rounded-lg border-none bg-[#0c1326] py-2 pl-10 pr-4 text-sm text-[#dfe4fe] ring-1 ring-[#41475b]/20 placeholder:text-[#a5aac2]/50 focus:outline-none focus:ring-[#3bbffa]/50"
                  />
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 font-[Manrope,sans-serif] text-xs font-bold uppercase tracking-widest text-[#a5aac2] transition-colors hover:text-[#3bbffa]"
                >
                  <span className="material-symbols-outlined text-sm">filter_list</span>
                  Filter
                </button>
                <button
                  type="button"
                  disabled
                  className="flex cursor-not-allowed items-center gap-2 font-[Manrope,sans-serif] text-xs font-bold uppercase tracking-widest text-[#a5aac2]/40"
                  title="Sắp có"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Export
                </button>
              </div>
              <p className="text-xs text-[#a5aac2]">
                Showing <span className="font-bold text-[#dfe4fe]">{filteredRows.length}</span> agencies
              </p>
            </div>

            {error && (
              <div className="border-b border-[#41475b]/10 bg-red-950/30 px-6 py-3 text-xs text-red-300">{error}</div>
            )}

            {loading && !rows.length ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#a5aac2]">
                <Loader2 className="h-5 w-5 animate-spin" />
                Đang tải agency…
              </div>
            ) : (
              <div className="ag-prism-scroll overflow-x-auto px-2 pb-2 sm:px-4">
                <table className="w-full border-separate border-spacing-y-2 text-left">
                  <thead>
                    <tr className="font-[Manrope,sans-serif] text-[11px] font-black uppercase tracking-[0.15em] text-[#a5aac2]">
                      <th className="px-4 py-4">Mã (ID)</th>
                      <th className="px-4 py-4">Tên Agency</th>
                      <th className="px-4 py-4">Liên hệ</th>
                      <th className="px-4 py-4">Telegram</th>
                      <th className="px-4 py-4">TK cung cấp</th>
                      <th className="px-4 py-4">Dự án</th>
                      <th className="px-4 py-4 text-right">Tổng đã nạp</th>
                      <th className="px-4 py-4 text-right">Công nợ</th>
                      <th className="px-4 py-4 text-center">Trạng thái</th>
                      <th className="px-4 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 && !loading ? (
                      <tr>
                        <td colSpan={10} className="rounded-lg bg-[#11192e] px-6 py-16 text-center text-sm text-[#a5aac2]">
                          <div className="space-y-4">
                            <p>
                              Chưa có agency hoặc không khớp tìm kiếm. Chạy{' '}
                              <code className="text-[#3bbffa]">supabase/create_crm_agencies.sql</code> hoặc thêm mới.
                            </p>
                            <button
                              type="button"
                              onClick={() => openCreate()}
                              className="inline-flex rounded-lg bg-gradient-to-br from-[#3bbffa] to-[#22b1ec] px-5 py-2 text-sm font-bold text-[#00121d]"
                            >
                              + Thêm agency đầu tiên
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row) => {
                        const nap = row.tong_da_nap ?? 0;
                        const no = row.cong_no ?? 0;
                        const st = statusPill(row.trang_thai);
                        const chips = projectChips(row.du_an);
                        const tg = row.telegram?.trim() || '—';
                        return (
                          <tr
                            key={row.id}
                            className="group bg-[#11192e] transition-colors hover:bg-[#1c253e]"
                          >
                            <td className="rounded-l-lg border-l-2 border-transparent px-4 py-4 group-hover:border-[#3bbffa]">
                              <span className="text-sm font-bold text-[#3bbffa]">{row.ma_agency}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm font-semibold text-[#dfe4fe]">{row.ten_agency}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#222b47] text-[10px] font-bold text-[#dfe4fe]">
                                  {contactInitials(row.lien_he)}
                                </div>
                                <span className="text-sm text-[#a5aac2]">{row.lien_he?.trim() || '—'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-[#22b1ec]">{tg}</td>
                            <td className="px-4 py-4">
                              {row.tk_cung_cap?.trim() ? (
                                <span className="rounded bg-[#1c253e] px-2 py-1 text-[10px] font-bold text-[#dfe4fe]">
                                  {row.tk_cung_cap}
                                </span>
                              ) : (
                                <span className="text-[#a5aac2]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1">
                                {chips.length ? (
                                  chips.map((c) => (
                                    <span
                                      key={c}
                                      className="rounded bg-[#41475b]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#dfe4fe]"
                                    >
                                      {c}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-[#a5aac2]">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right font-mono text-sm text-[#69f6b8] tabular-nums">
                              {formatCompactVnd(nap)}
                            </td>
                            <td
                              className={`px-4 py-4 text-right font-mono text-sm tabular-nums ${
                                no > 0 ? 'font-semibold text-[#ff716c]' : 'text-[#a5aac2]'
                              }`}
                            >
                              {formatCompactVnd(no)}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span
                                className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${st.className}`}
                              >
                                {st.label}
                              </span>
                            </td>
                            <td className="rounded-r-lg px-4 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => openEdit(e, row)}
                                  disabled={deletingId === row.id}
                                  className="rounded-md p-1.5 text-[#a5aac2] transition-colors hover:bg-[#3bbffa]/20 hover:text-[#3bbffa] disabled:opacity-40"
                                  title="Sửa"
                                >
                                  <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(e, row)}
                                  disabled={deletingId === row.id}
                                  className="rounded-md p-1.5 text-[#a5aac2] transition-colors hover:bg-[#ff716c]/20 hover:text-[#ff716c] disabled:opacity-40"
                                  title="Xoá"
                                >
                                  {deletingId === row.id ? (
                                    <Loader2 className="h-[22px] w-[22px] animate-spin" />
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
              <div className="flex justify-center border-t border-[#41475b]/10 p-4">
                <nav className="flex flex-wrap items-center justify-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded text-[#a5aac2] transition-colors hover:bg-[#222b47] disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                    .map((n, idx, arr) => (
                      <React.Fragment key={n}>
                        {idx > 0 && arr[idx - 1] !== n - 1 && (
                          <span className="flex h-8 w-8 items-center justify-center text-xs text-[#a5aac2]">…</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setPage(n)}
                          className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold ${
                            n === safePage
                              ? 'bg-[#22b1ec] text-[#002b3d]'
                              : 'text-[#a5aac2] hover:bg-[#222b47]'
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
                    className="flex h-8 w-8 items-center justify-center rounded text-[#a5aac2] transition-colors hover:bg-[#222b47] disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </nav>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="relative overflow-hidden rounded-xl bg-[#0c1326] p-6 lg:col-span-2">
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <h4 className="flex items-center gap-2 font-bold text-[#dfe4fe]">
                  <span className="material-symbols-outlined text-[#3bbffa]">analytics</span>
                  Deposit performance heatmap
                </h4>
                <div className="flex flex-wrap gap-3">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#a5aac2]">
                    <span className="h-2 w-2 rounded-sm bg-[#006c49]" />
                    Low
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#a5aac2]">
                    <span className="h-2 w-2 rounded-sm bg-[#f8a010]" />
                    Med
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#a5aac2]">
                    <span className="h-2 w-2 rounded-sm bg-[#9f0519]" />
                    High
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-1.5">
                {HEATMAP_BG.map((cls, i) => (
                  <div
                    key={i}
                    className={`h-8 rounded-sm transition-transform duration-200 hover:scale-105 ${cls}`}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#3bbffa]/10 bg-gradient-to-br from-[#0c1326] to-[#171f36] p-6 shadow-lg">
              <h4 className="mb-6 flex items-center gap-2 font-bold text-[#dfe4fe]">
                <span className="material-symbols-outlined text-[#3bbffa]">verified_user</span>
                Security log
              </h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3 border-b border-[#41475b]/10 pb-3">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#69f6b8]" />
                  <div>
                    <p className="text-xs font-semibold text-[#dfe4fe]">Registry sync</p>
                    <p className="text-[10px] text-[#a5aac2]">
                      {metrics.total} agency · bảng {AGENCIES_TABLE}
                    </p>
                  </div>
                </div>
                {worstDebt.max > 0 ? (
                  <div className="flex items-start gap-3 border-b border-[#41475b]/10 pb-3">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffb148]" />
                    <div>
                      <p className="text-xs font-semibold text-[#dfe4fe]">Balance threshold</p>
                      <p className="text-[10px] text-[#a5aac2]">
                        {worstDebt.label} · {formatCompactVnd(worstDebt.max)} VND công nợ
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3bbffa]" />
                  <div>
                    <p className="text-xs font-semibold text-[#dfe4fe]">Module status</p>
                    <p className="text-[10px] text-[#a5aac2]">Agency Module 5 · read/write OK</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-auto flex flex-col gap-2 border-t border-[#41475b]/5 bg-black/80 px-6 py-2 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-wrap items-center gap-4 font-[Manrope,sans-serif] text-[10px] font-bold uppercase tracking-widest text-[#a5aac2]/60 sm:gap-6">
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#69f6b8]" />
            System live
          </span>
          <span>API: connected</span>
        </div>
        <div className="font-[Manrope,sans-serif] text-[10px] font-bold uppercase tracking-widest text-[#a5aac2]/60">
          © {footerYear} Obsidian Prism v5.0.2
        </div>
      </footer>

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
