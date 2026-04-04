import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { DuAnRow } from '../../../types';
import { ProjectFormModal } from './ProjectFormModal';

const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const PAGE_SIZE = 10;

const ROW_ICONS = ['package_2', 'rocket_launch', 'hub', 'energy_savings_leaf', 'token', 'assignment'] as const;

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

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function tableMa(row: DuAnRow): string {
  const m = row.ma_du_an?.trim();
  if (m) return m.length > 14 ? `${m.slice(0, 14)}…` : m.toUpperCase();
  return `DA-${row.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function statusUi(trangThai: string | undefined): {
  label: string;
  cls: string;
  pulse: boolean;
} {
  switch (trangThai) {
    case 'dang_chay':
      return {
        label: 'Active',
        cls: 'bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)] text-[var(--ld-secondary)] border-[var(--ld-secondary)]/20',
        pulse: true,
      };
    case 'tam_dung':
      return {
        label: 'Tạm dừng',
        cls: 'bg-[color-mix(in_srgb,var(--ld-tertiary)_10%,transparent)] text-[var(--ld-tertiary)] border-[var(--ld-tertiary)]/20',
        pulse: false,
      };
    case 'review':
      return {
        label: 'Review',
        cls: 'bg-[color-mix(in_srgb,var(--ld-tertiary)_10%,transparent)] text-[var(--ld-tertiary)] border-[var(--ld-tertiary)]/20',
        pulse: false,
      };
    case 'ket_thuc':
      return {
        label: 'Kết thúc',
        cls: 'bg-[color-mix(in_srgb,var(--ld-on-surface-variant)_8%,transparent)] text-[var(--ld-on-surface-variant)] border-[var(--ld-outline-variant)]/20',
        pulse: false,
      };
    case 'huy':
      return {
        label: 'Huỷ',
        cls: 'bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)] text-[var(--ld-error)] border-[var(--ld-error)]/20',
        pulse: false,
      };
    default:
      return {
        label: trangThai?.trim() || '—',
        cls: 'bg-[color-mix(in_srgb,var(--ld-on-surface-variant)_8%,transparent)] text-[var(--ld-on-surface-variant)] border-[var(--ld-outline-variant)]/20',
        pulse: false,
      };
  }
}

export const ProjectsView: React.FC = () => {
  const [rows, setRows] = useState<DuAnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<DuAnRow | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'dang_chay' | 'tam_dung'>('all');
  const [page, setPage] = useState(1);

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

  const marketsCount = useMemo(() => {
    const s = new Set<string>();
    for (const p of rows) {
      const t = p.thi_truong?.trim();
      if (t) s.add(t);
    }
    return s.size;
  }, [rows]);

  const revenueSum = useMemo(() => rows.reduce((a, p) => a + safeNum(p.doanh_thu_thang ?? p.tong_doanh_so), 0), [rows]);

  const runningCount = useMemo(() => rows.filter((p) => p.trang_thai === 'dang_chay').length, [rows]);
  const runningPct = useMemo(
    () => (rows.length ? Math.round((runningCount / rows.length) * 100) : 0),
    [rows.length, runningCount]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (tab === 'dang_chay' && p.trang_thai !== 'dang_chay') return false;
      if (tab === 'tam_dung' && p.trang_thai !== 'tam_dung') return false;
      if (!q) return true;
      return (
        p.ten_du_an.toLowerCase().includes(q) ||
        (p.ma_du_an || '').toLowerCase().includes(q) ||
        (p.thi_truong || '').toLowerCase().includes(q) ||
        (p.leader || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, tab]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const marketDot = (i: number) =>
    i % 2 === 0 ? 'bg-[color-mix(in_srgb,var(--ld-primary)_40%,transparent)]' : 'bg-[color-mix(in_srgb,var(--ld-tertiary)_40%,transparent)]';

  if (loading && !rows.length) {
    return (
      <div className="leader-dash-obsidian dash-fade-up flex items-center justify-center min-h-[240px] gap-3 text-[var(--ld-on-surface-variant)]">
        <Loader2 className="animate-spin text-[var(--ld-primary)]" size={24} />
        <span className="text-sm font-semibold">Đang tải {DU_AN_TABLE}…</span>
      </div>
    );
  }

  return (
    <div className="leader-dash-obsidian dash-fade-up text-[var(--ld-on-surface)] selection:bg-[color-mix(in_srgb,var(--ld-primary)_30%,transparent)] -m-[12px] px-4 sm:px-8 pb-20 pt-2 max-w-[1600px] mx-auto">
      {error ? (
        <div className="mb-6 text-[12px] text-[var(--ld-error)] border border-[var(--ld-error)]/25 rounded-xl px-4 py-3 bg-[color-mix(in_srgb,var(--ld-error)_12%,transparent)] flex flex-wrap items-center gap-3">
          {error}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ld-primary)] hover:underline"
          >
            <RefreshCw size={12} /> Thử lại
          </button>
        </div>
      ) : null}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <nav className="flex items-center gap-2 text-xs leader-dash-label text-[var(--ld-on-surface-variant)] mb-2">
            <span>Hệ thống</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-[var(--ld-primary)]/90">Quản lý dự án</span>
          </nav>
          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
            Dự án (Module 1)
          </h2>
          <p className="text-sm text-[var(--ld-on-surface-variant)] mt-1 leader-dash-label">Nguồn: {DU_AN_TABLE}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-sm border border-[var(--ld-outline-variant)]/30 text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-on-surface)] hover:bg-[var(--ld-surface-container-highest)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingProject(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 bg-[var(--ld-primary)] text-[var(--ld-on-primary-container)] px-6 py-3 rounded-lg font-bold shadow-lg shadow-[color-mix(in_srgb,var(--ld-primary)_20%,transparent)] hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Thêm dự án
          </button>
        </div>
      </div>

      <div className="relative mb-8 max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ld-on-surface-variant)] text-sm pointer-events-none">
          search
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[var(--ld-surface-container-highest)] border-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-[var(--ld-on-surface)] focus:ring-2 focus:ring-[var(--ld-primary)] outline-none placeholder:text-[var(--ld-on-surface-variant)]/50"
          placeholder="Tìm dự án, thị trường, leader…"
          type="search"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-10">
        <div className="p-6 rounded-xl bg-[var(--ld-surface-container-low)] flex flex-col gap-4 relative overflow-hidden group border border-[var(--ld-outline-variant)]/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--ld-primary)]/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none" />
          <div className="flex items-center justify-between relative z-[1]">
            <span className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--ld-primary)_10%,transparent)] text-[var(--ld-primary)]">
              <span className="material-symbols-outlined">folder_managed</span>
            </span>
            <span className="text-[10px] font-bold text-[var(--ld-secondary)] flex items-center gap-1 leader-dash-label">
              <span className="material-symbols-outlined text-[12px]">trending_up</span>
              {runningPct}% đang chạy
            </span>
          </div>
          <div className="relative z-[1]">
            <p className="text-[var(--ld-on-surface-variant)] text-xs leader-dash-label uppercase tracking-wider font-bold">Tổng dự án</p>
            <h3 className="text-4xl font-extrabold text-[var(--ld-on-surface)] mt-1" style={{ fontFamily: '"Inter", sans-serif' }}>
              {rows.length}
            </h3>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-[var(--ld-surface-container-low)] flex flex-col gap-4 relative overflow-hidden group border border-[var(--ld-outline-variant)]/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--ld-tertiary)]/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none" />
          <div className="flex items-center justify-between relative z-[1]">
            <span className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--ld-tertiary)_10%,transparent)] text-[var(--ld-tertiary)]">
              <span className="material-symbols-outlined">public</span>
            </span>
            <span className="text-[10px] font-bold text-[var(--ld-on-surface-variant)] leader-dash-label">Thị trường</span>
          </div>
          <div className="relative z-[1]">
            <p className="text-[var(--ld-on-surface-variant)] text-xs leader-dash-label uppercase tracking-wider font-bold">Active markets</p>
            <h3 className="text-4xl font-extrabold text-[var(--ld-on-surface)] mt-1" style={{ fontFamily: '"Inter", sans-serif' }}>
              {String(marketsCount).padStart(2, '0')}
            </h3>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-[var(--ld-surface-container-low)] flex flex-col gap-4 relative overflow-hidden md:col-span-1 lg:col-span-2 border-l-4 border-[color-mix(in_srgb,var(--ld-primary)_30%,transparent)] border border-[var(--ld-outline-variant)]/5">
          <div className="absolute inset-0 bg-gradient-to-r from-[color-mix(in_srgb,var(--ld-primary)_5%,transparent)] to-transparent opacity-50 pointer-events-none" />
          <div className="flex items-center justify-between relative z-[1]">
            <span className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)] text-[var(--ld-secondary)]">
              <span className="material-symbols-outlined">payments</span>
            </span>
            <div className="flex -space-x-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border-2 border-[var(--ld-surface-container-low)] bg-[color-mix(in_srgb,var(--ld-primary)_15%,transparent)] flex items-center justify-center text-[8px] font-bold text-[var(--ld-primary)]"
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              <div className="w-6 h-6 rounded-full border-2 border-[var(--ld-surface-container-low)] bg-[var(--ld-surface-container-highest)] flex items-center justify-center text-[8px] font-bold text-[var(--ld-on-surface-variant)]">
                +{Math.max(0, rows.length - 3)}
              </div>
            </div>
          </div>
          <div className="relative z-[1] flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-[var(--ld-on-surface-variant)] text-xs leader-dash-label uppercase tracking-wider font-bold">Doanh thu gộp (DT tháng / tổng)</p>
              <h3 className="text-4xl font-extrabold text-[var(--ld-on-surface)] mt-1 flex flex-wrap items-baseline gap-2" style={{ fontFamily: '"Inter", sans-serif' }}>
                {formatCompactVnd(revenueSum)}
                <span className="text-lg text-[var(--ld-secondary)] font-medium">VNĐ</span>
              </h3>
            </div>
            <div className="hidden lg:block h-12 w-32 bg-[var(--ld-surface-container-highest)] rounded-lg overflow-hidden">
              <div className="w-full h-full bg-gradient-to-t from-[color-mix(in_srgb,var(--ld-primary)_20%,transparent)] to-transparent flex items-end gap-1 px-2 pb-1">
                {[40, 60, 30, 85, 55].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[color-mix(in_srgb,var(--ld-primary)_50%,transparent)] rounded-t-sm"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--ld-surface-container-low)] rounded-2xl overflow-hidden shadow-2xl border border-[var(--ld-outline-variant)]/10">
        <div className="p-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ld-outline-variant)]/10">
          <div className="flex flex-wrap items-center gap-4">
            <h4 className="text-lg font-bold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
              Danh sách dự án
            </h4>
            <span className="px-2 py-0.5 rounded-md bg-[var(--ld-surface-container-highest)] text-[var(--ld-primary)] text-[10px] font-bold">
              {filtered.length} TOTAL
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-[var(--ld-surface-container-highest)] rounded-lg p-1">
              {(
                [
                  { id: 'all' as const, label: 'Tất cả' },
                  { id: 'dang_chay' as const, label: 'Đang chạy' },
                  { id: 'tam_dung' as const, label: 'Tạm dừng' },
                ]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    tab === t.id
                      ? 'bg-[var(--ld-surface-container)] text-[var(--ld-primary)] shadow-sm border border-[var(--ld-outline-variant)]/10'
                      : 'text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-on-surface)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              title="Làm mới danh sách"
              onClick={() => void load()}
              className="w-10 h-10 flex items-center justify-center bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-primary)] rounded-lg transition-all"
            >
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto leader-dash-no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[color-mix(in_srgb,var(--ld-surface-container-highest)_30%,transparent)]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ld-on-surface-variant)] leader-dash-label">
                  Mã (ID)
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ld-on-surface-variant)] leader-dash-label">
                  Tên dự án
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ld-on-surface-variant)] leader-dash-label">
                  Thị trường
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ld-on-surface-variant)] leader-dash-label">
                  Leader
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ld-on-surface-variant)] leader-dash-label text-center">
                  MKT
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ld-on-surface-variant)] leader-dash-label text-right">
                  DT tháng
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ld-on-surface-variant)] leader-dash-label text-center">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--ld-on-surface-variant)] leader-dash-label text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ld-outline-variant)]/5">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-sm text-[var(--ld-on-surface-variant)]">
                    {rows.length === 0 ? (
                      <div className="space-y-4">
                        <p>Chưa có dự án trong {DU_AN_TABLE}.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProject(null);
                            setFormOpen(true);
                          }}
                          className="inline-flex items-center gap-2 bg-[var(--ld-primary)] text-[var(--ld-on-primary-container)] px-5 py-2.5 rounded-lg text-sm font-bold"
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                          Thêm dự án đầu tiên
                        </button>
                      </div>
                    ) : (
                      'Không khớp tìm kiếm / bộ lọc.'
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => {
                  const st = statusUi(row.trang_thai);
                  const icon = ROW_ICONS[(idx + row.id.length) % ROW_ICONS.length];
                  const rev = row.doanh_thu_thang ?? row.tong_doanh_so;
                  const globalIdx = (safePage - 1) * PAGE_SIZE + idx;
                  return (
                    <tr key={row.id} className="hover:bg-[color-mix(in_srgb,var(--ld-surface-container-high)_50%,transparent)] transition-all group">
                      <td className="px-6 py-5 font-mono text-xs text-[var(--ld-primary)]/90 font-bold">{tableMa(row)}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded bg-[var(--ld-surface-container-highest)] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <span className="material-symbols-outlined text-sm text-[var(--ld-on-surface-variant)]">{icon}</span>
                          </div>
                          <span className="font-bold text-[var(--ld-on-surface)] truncate" style={{ fontFamily: '"Inter", sans-serif' }}>
                            {row.ten_du_an}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${marketDot(globalIdx)}`} />
                          <span className="text-sm text-[var(--ld-on-surface-variant)] font-medium truncate">{row.thi_truong || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-[color-mix(in_srgb,var(--ld-primary)_20%,transparent)] flex items-center justify-center text-[10px] font-bold text-[var(--ld-primary)] shrink-0">
                            {initials(row.leader || row.ten_du_an || '?')}
                          </div>
                          <span className="text-xs font-semibold text-[var(--ld-on-surface)] truncate">{row.leader || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="px-2 py-1 rounded bg-[color-mix(in_srgb,var(--ld-primary)_5%,transparent)] text-[var(--ld-primary)] text-xs font-bold tabular-nums inline-block">
                          {row.so_mkt != null ? row.so_mkt : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-sm font-extrabold text-[var(--ld-on-surface)] tabular-nums">{formatCompactVnd(rev)}</span>
                        <span className="text-[10px] text-[var(--ld-on-surface-variant)] block">VNĐ</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${st.cls}`}
                        >
                          {st.pulse ? (
                            <span className="w-1 h-1 rounded-full bg-[var(--ld-secondary)] animate-pulse" />
                          ) : (
                            <span className="w-1 h-1 rounded-full bg-current opacity-60" />
                          )}
                          {st.label}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          title="Sửa"
                          onClick={() => {
                            setEditingProject(row);
                            setFormOpen(true);
                          }}
                          className="text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-primary)] transition-colors p-1"
                        >
                          <span className="material-symbols-outlined text-xl">edit_square</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-[var(--ld-outline-variant)]/10">
          <span className="text-xs text-[var(--ld-on-surface-variant)] leader-dash-label">
            Hiển thị {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} trong số{' '}
            {filtered.length} dự án
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)] hover:bg-[var(--ld-surface-container-high)] disabled:opacity-30 transition-all"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
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
                  <span key={`d-${i}`} className="px-1 text-[var(--ld-on-surface-variant)] text-xs">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                      item === safePage
                        ? 'bg-[var(--ld-primary)] text-[var(--ld-on-primary-container)]'
                        : 'bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)] hover:bg-[var(--ld-surface-container-high)]'
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
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)] hover:bg-[var(--ld-surface-container-high)] disabled:opacity-30 transition-all"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        title="Tải lại & tổng quan"
        onClick={() => void load()}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[var(--ld-primary)] rounded-full flex items-center justify-center shadow-2xl shadow-[color-mix(in_srgb,var(--ld-primary)_40%,transparent)] hover:scale-110 active:scale-95 transition-all z-30 border border-[var(--ld-primary-container)]/40"
      >
        <span className="material-symbols-outlined text-[var(--ld-on-primary-container)] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          insights
        </span>
      </button>

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
