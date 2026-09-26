import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, EyeOff, FileSpreadsheet, Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { Employee } from '../../../types';
import { StaffFormModal } from './StaffFormModal';
import { StaffDetailModal } from './StaffDetailModal';
import { downloadStaffExcelTemplate, parseStaffExcelFile, type StaffImportRow } from './staffExcel';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const PAGE_SIZE = 10;

const STAFF_SELECT =
  'id, name, team, score, avatar_url, email, pass, ma_ns, vi_tri, du_an_ten';

function displayMaNs(row: Employee): string {
  const m = row.ma_ns?.trim();
  if (m) return m;
  return row.id.slice(0, 8).toUpperCase();
}

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function downloadStaffCsv(rows: Employee[]) {
  const headers = ['ma_ns', 'name', 'team', 'vi_tri', 'leader', 'du_an_ten', 'so_fanpage', 'trang_thai', 'email', 'ngay_bat_dau'];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        esc(displayMaNs(r)),
        esc(r.name || ''),
        esc(r.team || ''),
        esc(r.vi_tri || ''),
        esc(r.leader || ''),
        esc(r.du_an_ten || ''),
        esc(String(r.so_fanpage ?? '')),
        esc(r.trang_thai || ''),
        esc(r.email || ''),
        esc(r.ngay_bat_dau?.slice(0, 10) || ''),
      ].join(',')
    ),
  ];
  const blob = new Blob(['\ufeff', lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nhan-su-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [importRows, setImportRows] = useState<StaffImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectPageRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.team, r.ma_ns, r.email, r.vi_tri, r.leader, r.du_an_ten]
        .map((x) => (x || '').toLowerCase())
        .some((s) => s.includes(q))
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page, totalPages]);
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));
  const somePageSelected = pageRows.some((row) => selectedIds.has(row.id));

  useEffect(() => {
    if (selectPageRef.current) {
      selectPageRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((r) => r.trang_thai === 'dang_lam').length;
    const scoreVals = filtered.map((r) => Number(r.score)).filter((n) => Number.isFinite(n) && n >= 0);
    let perf: number | null = null;
    if (scoreVals.length > 0) {
      perf = Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length);
      perf = Math.min(100, perf);
    } else if (total > 0) {
      perf = Math.round((active / total) * 100);
    }
    return { total, active, perf };
  }, [filtered]);

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

  const handleExcelSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportMessage(null);
    setImportRows([]);
    setImportErrors([]);
    setError(null);
    setImportBusy(true);
    try {
      const parsed = await parseStaffExcelFile(file);
      setImportRows(parsed.rows);
      setImportErrors(parsed.errors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được file Excel.');
    } finally {
      setImportBusy(false);
    }
  };

  const commitExcelImport = async () => {
    if (!importRows.length || importErrors.length || importBusy) return;
    setImportBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      const existing: { ma_ns?: string | null; email?: string | null }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error: readError } = await supabase
          .from(EMPLOYEES_TABLE)
          .select('ma_ns, email')
          .range(from, from + 999);
        if (readError) throw readError;
        existing.push(...(data || []));
        if (!data || data.length < 1000) break;
      }

      const knownCodes = new Set(existing.map((row) => row.ma_ns?.trim().toLowerCase()).filter(Boolean));
      const knownEmails = new Set(existing.map((row) => row.email?.trim().toLowerCase()).filter(Boolean));
      const freshRows = importRows.filter((row) => {
        const code = row.ma_ns?.trim().toLowerCase();
        const email = row.email?.trim().toLowerCase();
        if ((code && knownCodes.has(code)) || (email && knownEmails.has(email))) return false;
        if (code) knownCodes.add(code);
        if (email) knownEmails.add(email);
        return true;
      });
      const skipped = importRows.length - freshRows.length;

      if (!freshRows.length) {
        setImportMessage(`Không có dòng mới để thêm; đã bỏ qua ${skipped} dòng trùng Mã NS hoặc Email.`);
        setImportRows([]);
        return;
      }

      const { error: insertError } = await supabase.from(EMPLOYEES_TABLE).insert(freshRows);
      if (insertError) throw insertError;
      setImportMessage(`Đã thêm ${freshRows.length} nhân sự${skipped ? `, bỏ qua ${skipped} dòng trùng` : ''}.`);
      setImportRows([]);
      setImportErrors([]);
      await load();
      await onEmployeesRefresh?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể nhập dữ liệu Excel.';
      setError(message);
    } finally {
      setImportBusy(false);
    }
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

      setSelectedIds((current) => {
        if (!current.has(row.id)) return current;
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });

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

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) pageRows.forEach((row) => next.delete(row.id));
      else pageRows.forEach((row) => next.add(row.id));
      return next;
    });
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length || bulkDeleting) return;
    if (!window.confirm(`Bạn có chắc muốn xóa ${ids.length} nhân sự đã chọn? Thao tác này không thể hoàn tác.`)) return;

    setBulkDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase.from(EMPLOYEES_TABLE).delete().in('id', ids);
    setBulkDeleting(false);
    if (deleteError) {
      console.error('employees bulk delete:', deleteError);
      setError(deleteError.message || 'Không xóa được các nhân sự đã chọn.');
      return;
    }

    if (viewingRef.current && ids.includes(viewingRef.current.id)) {
      setViewing(null);
      setDetailOpen(false);
    }
    if (editingRef.current && ids.includes(editingRef.current.id)) {
      setEditing(null);
      setFormOpen(false);
    }
    setSelectedIds(new Set());
    void load();
    void onEmployeesRefresh?.();
  };

  const iconBtn =
    'p-2 rounded-lg text-[var(--hrm-on-variant)] transition-colors active:scale-95 disabled:opacity-40';

  return (
    <div className="staff-hrm-flux dash-fade-up text-[var(--hrm-on-surface)] selection:bg-[color-mix(in_srgb,var(--hrm-primary)_30%,transparent)] -m-[12px] px-4 sm:px-8 pb-8 pt-2 max-w-[1600px] mx-auto w-full flex flex-col min-h-0">
      <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleExcelSelected(event)} />
      {/* Sticky mini bar — chỉ nội dung module (shell đã có sidebar) */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 py-4 -mx-4 px-4 sm:-mx-8 sm:px-8 mb-2 bg-[color-mix(in_srgb,var(--hrm-bg)_92%,transparent)] backdrop-blur-md border-b border-white/[0.06]">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-[var(--hrm-primary)] tracking-tight staff-hrm-headline shrink-0">
            HRM Module
          </h1>
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#1c222c] border-none rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 focus:ring-1 focus:ring-[var(--hrm-primary)] w-56 lg:w-64 transition-all outline-none placeholder:text-slate-500"
              placeholder="Tìm nhanh…"
              type="search"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            title="Tải mẫu Excel nhân sự"
            onClick={downloadStaffExcelTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[var(--hrm-on-variant)] transition hover:border-[var(--hrm-primary)]/50 hover:text-[var(--hrm-primary)]"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Tải mẫu Excel</span>
          </button>
          <button
            type="button"
            title="Nhập danh sách nhân sự từ Excel"
            onClick={() => importInputRef.current?.click()}
            disabled={importBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[var(--hrm-on-variant)] transition hover:border-[var(--hrm-primary)]/50 hover:text-[var(--hrm-primary)] disabled:opacity-50"
          >
            {importBusy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            <span className="hidden sm:inline">Nhập Excel</span>
          </button>
          <button
            type="button"
            title="Tải CSV (bộ lọc hiện tại)"
            onClick={() => downloadStaffCsv(filtered)}
            disabled={filtered.length === 0}
            className={`${iconBtn} hover:bg-[#1c222c] hover:text-[var(--hrm-primary)]`}
          >
            <FileSpreadsheet size={18} />
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`${iconBtn} hover:bg-[#1c222c] hover:text-[var(--hrm-primary)]`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="material-symbols-outlined">refresh</span>}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="bg-[var(--hrm-primary-container)] text-[var(--hrm-on-primary-container)] px-4 sm:px-5 py-2 rounded-lg font-bold text-sm transition-all hover:brightness-110 active:scale-95 staff-hrm-headline whitespace-nowrap"
          >
            Thêm nhân sự
          </button>
        </div>
      </header>

      <div className="space-y-8 flex-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold staff-hrm-headline text-[var(--hrm-on-surface)] tracking-tight">
            Nhân sự (Module 3) — Quản lý Nhân sự Marketing
          </h2>
          <p className="text-sm text-[var(--hrm-on-variant)]">
            Tổng quan và quản lý đội ngũ marketing — đồng bộ mã NS, fanpage, trạng thái với báo cáo MKT.
          </p>
        </div>

        {error && (
          <div className="text-[11px] text-red-300 border border-red-500/25 rounded-xl px-4 py-3 bg-red-500/10">{error}</div>
        )}

        {importMessage && (
          <div className="text-sm text-emerald-200 border border-emerald-400/20 rounded-xl px-4 py-3 bg-emerald-400/[0.07]">
            {importMessage}
          </div>
        )}
        {(importRows.length > 0 || importErrors.length > 0) && (
          <section className="rounded-xl border border-white/10 bg-[var(--hrm-surface-low)] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--hrm-on-surface)]">Kiểm tra file Excel</h3>
                <p className="mt-1 text-xs text-[var(--hrm-on-variant)]">
                  {importRows.length} dòng hợp lệ{importErrors.length ? ` · ${importErrors.length} lỗi` : ''}. Nhân sự trùng Mã NS hoặc Email sẽ được bỏ qua.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setImportRows([]); setImportErrors([]); }}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[var(--hrm-on-variant)] hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void commitExcelImport()}
                  disabled={!importRows.length || Boolean(importErrors.length) || importBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--hrm-primary)] px-3 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importBusy && <Loader2 size={14} className="animate-spin" />}
                  Thêm {importRows.length} nhân sự
                </button>
              </div>
            </div>
            {importErrors.length > 0 && (
              <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto border-t border-white/[0.06] pt-3 text-xs text-red-200">
                {importErrors.slice(0, 8).map((item, index) => (
                  <li key={`${item.row}-${index}`}>{item.row > 0 ? `Dòng ${item.row}: ` : ''}{item.message}</li>
                ))}
                {importErrors.length > 8 && <li>… và {importErrors.length - 8} lỗi khác</li>}
                <li className="pt-1 text-red-100/70">Sửa các lỗi trong file rồi chọn lại để nhập.</li>
              </ul>
            )}
          </section>
        )}

        {/* Stats — 3 ô bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[var(--hrm-surface-low)] p-6 rounded-2xl flex items-center justify-between group hover:bg-[var(--hrm-surface)] transition-colors duration-300 border border-white/[0.06]">
            <div>
              <p className="text-xs text-[var(--hrm-on-variant)] font-medium uppercase tracking-wider staff-hrm-headline">
                Tổng nhân sự
              </p>
              <h3 className="text-4xl font-extrabold staff-hrm-headline text-[var(--hrm-on-surface)] mt-1 tabular-nums">{stats.total}</h3>
              <p className="text-xs text-[var(--hrm-primary)] font-medium mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">trending_up</span>
                Theo kết quả tìm kiếm / danh sách
              </p>
            </div>
            <div className="h-16 w-16 bg-[color-mix(in_srgb,var(--hrm-primary)_10%,transparent)] rounded-2xl flex items-center justify-center text-[var(--hrm-primary-container)] shrink-0">
              <span className="material-symbols-outlined text-3xl">groups</span>
            </div>
          </div>

          <div className="bg-[var(--hrm-surface-low)] p-6 rounded-2xl flex items-center justify-between group hover:bg-[var(--hrm-surface)] transition-colors duration-300 border border-white/[0.06]">
            <div>
              <p className="text-xs text-[var(--hrm-on-variant)] font-medium uppercase tracking-wider staff-hrm-headline">
                Đang làm việc
              </p>
              <h3 className="text-4xl font-extrabold staff-hrm-headline text-[var(--hrm-on-surface)] mt-1 tabular-nums">{stats.active}</h3>
              <p className="text-xs text-[#abd5ff] font-medium mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                Trạng thái &quot;đang làm&quot;
              </p>
            </div>
            <div className="h-16 w-16 bg-[color-mix(in_srgb,#abd5ff_10%,transparent)] rounded-2xl flex items-center justify-center text-[#96ccff] shrink-0">
              <span className="material-symbols-outlined text-3xl">person_play</span>
            </div>
          </div>

          <div className="bg-[var(--hrm-surface-low)] p-6 rounded-2xl flex items-center justify-between group hover:bg-[var(--hrm-surface)] transition-colors duration-300 border border-white/[0.06]">
            <div>
              <p className="text-xs text-[var(--hrm-on-variant)] font-medium uppercase tracking-wider staff-hrm-headline">
                Hiệu suất TB
              </p>
              <h3 className="text-4xl font-extrabold staff-hrm-headline text-[var(--hrm-primary)] mt-1 tabular-nums">
                {stats.perf != null ? `${stats.perf}%` : '—'}
              </h3>
              <p className="text-xs text-[var(--hrm-on-variant)] font-medium mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">star</span>
                Điểm score trung bình hoặc tỷ lệ đang làm
              </p>
            </div>
            <div className="h-16 w-16 bg-[var(--hrm-surface-highest)] rounded-2xl flex items-center justify-center text-[var(--hrm-primary)] shrink-0">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                bolt
              </span>
            </div>
          </div>
        </div>

        {/* Bảng chính */}
        <div className="bg-[var(--hrm-surface-low)] rounded-3xl overflow-hidden shadow-2xl shadow-black/20 border border-white/[0.06]">
          <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06]">
            <div className="relative flex-1 max-w-md w-full md:block">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--hrm-on-variant)] pointer-events-none">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[var(--hrm-surface-lowest)] border-none rounded-xl py-3 pl-12 pr-4 text-sm text-[var(--hrm-on-surface)] focus:ring-1 focus:ring-[var(--hrm-primary)] outline-none transition-all placeholder:text-[var(--hrm-on-variant)]/50"
                placeholder="Tìm kiếm mã nhân sự, họ tên…"
                type="search"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => void deleteSelected()}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  {bulkDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Xóa đã chọn ({selectedIds.size})
                </button>
              )}
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkDeleting}
                  className="rounded-xl px-2.5 py-2 text-xs font-medium text-[var(--hrm-on-variant)] hover:bg-white/5 disabled:opacity-50"
                >
                  Bỏ chọn
                </button>
              )}
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[var(--hrm-on-variant)] font-medium text-sm hover:bg-[var(--hrm-surface)] transition-colors active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <span className="material-symbols-outlined text-lg">refresh</span>}
                <span>Làm mới</span>
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--hrm-primary)] text-[var(--hrm-on-primary)] font-bold text-sm hover:brightness-110 shadow-lg shadow-[color-mix(in_srgb,var(--hrm-primary)_10%,transparent)] transition-all active:scale-95 staff-hrm-headline"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Thêm nhân sự
              </button>
            </div>
          </div>

          <div className="overflow-x-auto staff-hrm-flux-scroll">
            {loading && !rows.length ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--hrm-on-variant)]">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--hrm-primary)]" />
                <span className="text-sm font-medium">Đang tải nhân sự…</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[1120px]">
                <thead>
                  <tr className="bg-[var(--hrm-surface-low)]">
                    <th className="w-12 px-4 py-4 text-center">
                      <input
                        ref={selectPageRef}
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={togglePageSelection}
                        aria-label="Chọn tất cả nhân sự đang hiển thị"
                        className="h-4 w-4 cursor-pointer accent-[#75a9f5]"
                      />
                    </th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--hrm-on-variant)]">Mã NS</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--hrm-on-variant)]">Họ tên</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--hrm-on-variant)]">Team</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--hrm-on-variant)]">Vị trí</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--hrm-on-variant)]">Dự án</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--hrm-on-variant)]">Email</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--hrm-on-variant)]">Mật khẩu</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--hrm-on-variant)] text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filtered.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-14 text-center text-[var(--hrm-on-variant)] space-y-4">
                        <p>
                          Chưa có nhân sự hoặc thiếu cột CRM. Chạy{' '}
                          <code className="text-[var(--hrm-on-surface)]">supabase/alter_employees_crm_staff_ui.sql</code> nếu cần.
                        </p>
                        <button
                          type="button"
                          onClick={openCreate}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--hrm-primary)] text-[var(--hrm-on-primary)] font-bold text-sm"
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                          Thêm nhân sự đầu tiên
                        </button>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr
                        key={row.id}
                        className="group hover:bg-[color-mix(in_srgb,var(--hrm-surface-highest)_30%,transparent)] transition-colors duration-200"
                      >
                        <td className="w-12 px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelected(row.id)}
                            aria-label={`Chọn ${row.name || displayMaNs(row)}`}
                            className="h-4 w-4 cursor-pointer accent-[#75a9f5]"
                          />
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-[var(--hrm-primary-dim)] font-mono">{displayMaNs(row)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full border border-[var(--hrm-outline-variant)]/30 overflow-hidden shrink-0 bg-[var(--hrm-surface-highest)] flex items-center justify-center text-xs font-bold text-[var(--hrm-on-variant)]">
                              {row.avatar_url ? <img src={row.avatar_url} alt="" className="h-full w-full object-cover" /> : initialsFromName(row.name || '?')}
                            </div>
                            <span className="text-sm font-semibold text-[var(--hrm-on-surface)] truncate" title={row.name}>{row.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 max-w-[180px]">
                          {row.team?.trim() ? (
                            <span className="inline-flex max-w-full truncate rounded-md bg-[var(--hrm-surface-highest)] px-2.5 py-1 text-xs font-medium text-[var(--hrm-on-surface)]">{row.team}</span>
                          ) : <span className="text-[var(--hrm-on-variant)]">—</span>}
                        </td>
                        <td className="px-5 py-4 max-w-[170px] truncate text-sm text-[var(--hrm-on-variant)]" title={row.vi_tri || ''}>{row.vi_tri?.trim() || '—'}</td>
                        <td className="px-5 py-4 max-w-[200px] truncate text-sm text-[var(--hrm-on-variant)]" title={row.du_an_ten || ''}>{row.du_an_ten?.trim() || '—'}</td>
                        <td className="px-5 py-4 max-w-[230px] truncate text-sm text-[var(--hrm-on-variant)]" title={row.email || ''}>{row.email?.trim() || '—'}</td>
                        <td className="px-5 py-4">
                          {row.pass?.trim() ? (
                            <div className="flex items-center gap-2">
                              <code className="max-w-[150px] truncate rounded bg-[var(--hrm-surface-lowest)] px-2 py-1 text-xs text-[var(--hrm-on-variant)]">
                                {visiblePasswords.has(row.id) ? row.pass : '••••••••'}
                              </code>
                              <button
                                type="button"
                                onClick={() => setVisiblePasswords((current) => {
                                  const next = new Set(current);
                                  if (next.has(row.id)) next.delete(row.id);
                                  else next.add(row.id);
                                  return next;
                                })}
                                className="rounded p-1 text-[var(--hrm-on-variant)] hover:bg-white/5 hover:text-[var(--hrm-on-surface)]"
                                title={visiblePasswords.has(row.id) ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                aria-label={visiblePasswords.has(row.id) ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                              >
                                {visiblePasswords.has(row.id) ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          ) : <span className="text-xs text-[var(--hrm-on-variant)]">Chưa đặt</span>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={(e) => openView(e, row)} disabled={deletingId === row.id} className={`${iconBtn} hover:text-[var(--hrm-primary)] hover:bg-[color-mix(in_srgb,var(--hrm-primary)_10%,transparent)]`} title="Xem" aria-label="Xem">
                              <span className="material-symbols-outlined text-lg">visibility</span>
                            </button>
                            <button type="button" onClick={(e) => openEdit(e, row)} disabled={deletingId === row.id} className={`${iconBtn} hover:text-[var(--hrm-primary)] hover:bg-[color-mix(in_srgb,var(--hrm-primary)_10%,transparent)]`} title="Sửa" aria-label="Sửa">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button type="button" onClick={(e) => void handleDelete(e, row)} disabled={deletingId === row.id} className={`${iconBtn} hover:text-[var(--hrm-error)] hover:bg-[color-mix(in_srgb,var(--hrm-error)_10%,transparent)]`} title="Xóa" aria-label="Xóa">
                              {deletingId === row.id ? <Loader2 size={18} className="animate-spin" /> : <span className="material-symbols-outlined text-lg">delete</span>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {!loading && filtered.length > 0 && (
            <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.06]">
              <p className="text-xs text-[var(--hrm-on-variant)]">
                Hiển thị{' '}
                <span className="text-[var(--hrm-on-surface)] font-bold">
                  {(safePage - 1) * PAGE_SIZE + 1} – {Math.min(safePage * PAGE_SIZE, filtered.length)}
                </span>{' '}
                trong <span className="text-[var(--hrm-on-surface)] font-bold">{filtered.length}</span> nhân sự
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--hrm-on-variant)] hover:bg-[var(--hrm-surface)] transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-xl">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                  .reduce<(number | 'dots')[]>((acc, n, i, arr) => {
                    if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('dots');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === 'dots' ? (
                      <span key={`d-${i}`} className="px-2 text-[var(--hrm-on-variant)] text-xs">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                          item === safePage
                            ? 'bg-[var(--hrm-primary)] text-[var(--hrm-on-primary)]'
                            : 'text-[var(--hrm-on-variant)] hover:bg-[var(--hrm-surface)]'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--hrm-on-variant)] hover:bg-[var(--hrm-surface)] transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-xl">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] text-[var(--hrm-on-variant)]/50 tracking-widest uppercase font-bold border-t border-white/[0.05]">
        <div>Obsidian Flux HRM · Module 3</div>
        <div className="flex gap-6">
          <span className="hidden sm:inline">CRM Marketing</span>
        </div>
      </footer>

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
