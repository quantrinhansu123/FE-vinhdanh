/**
 * Module 6 — Ngân sách (admin) · AdCRM Pro / Obsidian Flux UI
 *
 * @see file header trong git history cho mô tả nguồn dữ liệu & migration.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BudgetRequestFormModal } from '../../../components/crm-dashboard/BudgetRequestFormModal';
import { supabase } from '../../../api/supabase';
import type { BudgetRequestRow, ReportRow } from '../../../types';

const BUDGET_TABLE = import.meta.env.VITE_SUPABASE_BUDGET_REQUESTS_TABLE?.trim() || 'budget_requests';
const REPORTS_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

const BUDGET_SELECT = `
  id,
  ngan_sach_xin,
  ngay_gio_xin,
  trang_thai,
  ly_do_tu_choi,
  ghi_chu,
  tkqc_account_id,
  tkqc_id,
  id_du_an,
  agency_id,
  ngan_hang,
  so_tai_khoan,
  chu_tai_khoan,
  loai_tien,
  hang_muc_chi_phi,
  noi_dung_chuyen_khoan,
  muc_dich_chi_tiet,
  chung_tu_urls,
  updated_at,
  tkqc_accounts ( id, don_vi, tkqc, page ),
  tkqc ( id, ma_tkqc, ten_pae, du_an ( ten_du_an, don_vi ) ),
  du_an ( id, ten_du_an, ma_du_an, don_vi ),
  crm_agencies ( id, ten_agency )
`;

function budgetDisplayAcc(
  r: BudgetRequestRow
): { don_vi: string | null; tkqc: string; page: string | null } | null {
  const t = r.tkqc;
  if (t) {
    return {
      don_vi: t.du_an?.don_vi ?? null,
      tkqc: t.ma_tkqc,
      page: t.ten_pae ?? null,
    };
  }
  if (r.tkqc_accounts) return r.tkqc_accounts;
  const ag = r.crm_agencies?.ten_agency?.trim();
  const du = r.du_an;
  if (ag || du) {
    return {
      don_vi: ag || du?.don_vi?.trim() || null,
      tkqc: r.hang_muc_chi_phi?.trim() || '—',
      page: du?.ten_du_an?.trim() || null,
    };
  }
  return null;
}

function toLocalYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatVndDots(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('vi-VN');
}

function displayMa(id: string): string {
  return `REQ-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function formatReqDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return 'Vừa xong';
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} giờ trước`;
  if (sec < 172800) return 'Hôm qua';
  return formatDateOnly(iso);
}

function priorityLabel(amount: number): string {
  return amount >= 100_000_000 ? 'Cao' : 'TB';
}

function sumAdCostThisMonth(rows: ReportRow[]): number {
  const today = new Date();
  const a = toLocalYyyyMmDd(startOfMonth(today));
  const b = toLocalYyyyMmDd(endOfMonth(today));
  return rows.reduce((acc, r) => {
    const d = r.report_date?.slice(0, 10);
    if (!d || d < a || d > b) return acc;
    const v = Number(r.ad_cost);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
}

function rowMatchesSearch(r: BudgetRequestRow, q: string): boolean {
  if (!q) return true;
  const acc = budgetDisplayAcc(r);
  const hay = [
    displayMa(r.id),
    r.id,
    acc?.don_vi,
    acc?.tkqc,
    acc?.page,
    r.ghi_chu,
    r.hang_muc_chi_phi,
  ]
    .map((x) => (x || '').toLowerCase())
    .join(' ');
  return hay.includes(q);
}

function downloadHistoryCsv(rows: BudgetRequestRow[]) {
  const headers = ['ma_yc', 'agency', 'tkqc', 'page', 'so_tien', 'cap_nhat', 'trang_thai'];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((r) => {
      const acc = budgetDisplayAcc(r);
      const ok = r.trang_thai === 'dong_y';
      return [
        esc(displayMa(r.id)),
        esc(acc?.don_vi?.trim() || ''),
        esc(acc?.tkqc || ''),
        esc(acc?.page?.trim() || ''),
        esc(String(r.ngan_sach_xin ?? '')),
        esc((r.updated_at || r.ngay_gio_xin || '').slice(0, 19)),
        esc(ok ? 'dong_y' : 'tu_choi'),
      ].join(',');
    }),
  ];
  const blob = new Blob(['\ufeff', lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lich-su-ngan-sach-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const BudgetView: React.FC = () => {
  const [requests, setRequests] = useState<BudgetRequestRow[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const pendingPanelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBannerDismissed(false);
    const since = new Date();
    since.setMonth(since.getMonth() - 2);
    const sinceStr = toLocalYyyyMmDd(since);

    const [budRes, repRes] = await Promise.all([
      supabase.from(BUDGET_TABLE).select(BUDGET_SELECT).order('ngay_gio_xin', { ascending: false }).limit(200),
      supabase.from(REPORTS_TABLE).select('report_date, ad_cost').gte('report_date', sinceStr),
    ]);

    if (budRes.error) {
      console.error('budget_requests:', budRes.error);
      setError(budRes.error.message || 'Không tải được yêu cầu ngân sách.');
      setRequests([]);
    } else {
      setRequests((budRes.data || []) as BudgetRequestRow[]);
    }

    if (repRes.error) {
      console.warn('budget KPI reports:', repRes.error);
      setReportRows([]);
    } else {
      setReportRows((repRes.data || []) as ReportRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = search.trim().toLowerCase();

  const monthBounds = useMemo(() => {
    const t = new Date();
    return { start: startOfMonth(t), end: endOfMonth(t) };
  }, []);

  const kpis = useMemo(() => {
    const start = toLocalYyyyMmDd(monthBounds.start);
    const end = toLocalYyyyMmDd(monthBounds.end);

    const pending = requests.filter((r) => r.trang_thai === 'cho_phe_duyet');
    const pendingSum = pending.reduce((a, r) => a + Number(r.ngan_sach_xin || 0), 0);

    const approvedThisMonth = requests.filter((r) => {
      if (r.trang_thai !== 'dong_y') return false;
      const u = r.updated_at || r.ngay_gio_xin;
      const d = u?.slice(0, 10);
      return d && d >= start && d <= end;
    });
    const approvedSum = approvedThisMonth.reduce((a, r) => a + Number(r.ngan_sach_xin || 0), 0);

    const adMonth = sumAdCostThisMonth(reportRows);
    const diff = approvedSum - adMonth;
    const diffBarPct =
      approvedSum > 0 ? Math.min(100, Math.round((adMonth / approvedSum) * 100)) : adMonth > 0 ? 100 : 0;

    return {
      pendingSum,
      pendingCount: pending.length,
      approvedSum,
      approvedCount: approvedThisMonth.length,
      adMonth,
      diff,
      diffBarPct,
    };
  }, [requests, reportRows, monthBounds.start, monthBounds.end]);

  const pendingList = useMemo(
    () =>
      requests
        .filter((r) => r.trang_thai === 'cho_phe_duyet')
        .filter((r) => rowMatchesSearch(r, q))
        .sort((a, b) => (a.ngay_gio_xin < b.ngay_gio_xin ? 1 : -1)),
    [requests, q]
  );

  const historyFull = useMemo(
    () =>
      requests
        .filter((r) => r.trang_thai === 'dong_y' || r.trang_thai === 'tu_choi')
        .filter((r) => rowMatchesSearch(r, q))
        .sort((a, b) => {
          const ta = (a.updated_at || a.ngay_gio_xin || '').slice(0, 19);
          const tb = (b.updated_at || b.ngay_gio_xin || '').slice(0, 19);
          return ta < tb ? 1 : -1;
        }),
    [requests, q]
  );

  const historyList = useMemo(
    () => (historyExpanded ? historyFull : historyFull.slice(0, 12)),
    [historyFull, historyExpanded]
  );

  const agencyDist = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of requests) {
      const acc = budgetDisplayAcc(r);
      const k = acc?.don_vi?.trim() || 'Khác';
      m.set(k, (m.get(k) || 0) + 1);
    }
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const tot = arr.reduce((s, [, n]) => s + n, 0) || 1;
    const cols = ['bg-[var(--ld-primary)]', 'bg-[var(--ld-tertiary)]', 'bg-[var(--ld-secondary)]'] as const;
    return arr.map(([name, n], i) => ({
      name,
      pct: Math.round((100 * n) / tot),
      dot: cols[i % 3],
    }));
  }, [requests]);

  const forecastHeights = [30, 45, 60, 40, 55, 70, 85, 50, 40, 30, 65, 45];

  const setStatus = async (id: string, trang_thai: 'dong_y' | 'tu_choi', lyDo?: string) => {
    setActionId(id);
    try {
      const payload: Record<string, unknown> = { trang_thai };
      if (trang_thai === 'tu_choi') payload.ly_do_tu_choi = lyDo?.trim() || 'Từ chối từ CRM Admin';
      const { error: uErr } = await supabase.from(BUDGET_TABLE).update(payload).eq('id', id);
      if (uErr) throw uErr;
      await load();
    } catch (e) {
      console.error('budget update:', e);
      window.alert(e instanceof Error ? e.message : 'Cập nhật thất bại.');
    } finally {
      setActionId(null);
    }
  };

  const onApprove = (id: string) => void setStatus(id, 'dong_y');
  const onReject = (id: string) => {
    const ly = window.prompt('Lý do từ chối (bắt buộc theo DB):');
    if (ly == null) return;
    if (!ly.trim()) {
      window.alert('Cần nhập lý do.');
      return;
    }
    void setStatus(id, 'tu_choi', ly);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(`Xóa yêu cầu ${displayMa(id)}? Hành động không thể hoàn tác.`)) return;
    setActionId(id);
    try {
      const { error: delErr } = await supabase.from(BUDGET_TABLE).delete().eq('id', id);
      if (delErr) throw delErr;
      await load();
    } catch (e) {
      console.error('budget delete:', e);
      window.alert(e instanceof Error ? e.message : 'Xóa thất bại.');
    } finally {
      setActionId(null);
    }
  };

  const scrollToPending = () => pendingPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const showErrorBanner = Boolean(error) && !bannerDismissed;
  const isRelError = error?.toLowerCase().includes('relationship') || error?.toLowerCase().includes('schema cache');

  return (
    <div className="leader-dash-obsidian dash-fade-up text-[var(--ld-on-surface)] selection:bg-[color-mix(in_srgb,var(--ld-primary)_30%,transparent)] -m-[12px] px-4 sm:px-8 pb-24 pt-2 max-w-[1600px] mx-auto w-full space-y-8">
      {/* Toolbar nội dung (không lặp sidebar shell) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[var(--ld-on-surface)] tracking-tight" style={{ fontFamily: '"Inter", sans-serif' }}>
            Budget Central
          </h1>
          <p className="text-[11px] text-[var(--ld-on-surface-variant)] leader-dash-label mt-1">
            <code className="text-[var(--ld-primary)]/90">{BUDGET_TABLE}</code> ·{' '}
            <code className="text-[var(--ld-primary)]/90">{REPORTS_TABLE}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ld-on-surface-variant)] text-sm pointer-events-none">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--ld-surface-container-highest)] border-none rounded-full pl-10 pr-4 py-2 text-sm text-[var(--ld-on-surface)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ld-primary)_50%,transparent)] outline-none leader-dash-label placeholder:text-[var(--ld-on-surface-variant)]/50"
              placeholder="Tìm agency, TK, page…"
              type="search"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[var(--ld-on-surface-variant)] font-medium text-sm hover:bg-[var(--ld-surface-container)] border border-[var(--ld-outline-variant)]/20 transition-colors disabled:opacity-50 leader-dash-label"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="material-symbols-outlined text-lg">refresh</span>}
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-br from-[var(--ld-primary)] to-[var(--ld-primary-container)] text-[var(--ld-on-primary-container)] font-bold text-sm shadow-lg shadow-[color-mix(in_srgb,var(--ld-primary)_15%,transparent)] hover:brightness-110 active:scale-95 transition-all leader-dash-label"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Tạo yêu cầu
          </button>
        </div>
      </div>

      {showErrorBanner && (
        <div className="bg-[color-mix(in_srgb,var(--ld-error-container)_20%,transparent)] border-l-4 border-[var(--ld-error)] p-4 rounded-lg flex items-center gap-4">
          <span className="material-symbols-outlined text-[var(--ld-error)] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--ld-on-error-container)]" style={{ fontFamily: '"Inter", sans-serif' }}>
              {isRelError ? 'Cảnh báo đồng bộ schema' : 'Không tải được dữ liệu'}
            </p>
            <p className="text-xs leader-dash-label text-[var(--ld-on-error-container)]/80 mt-0.5 break-words">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="material-symbols-outlined text-[var(--ld-on-error-container)]/60 hover:text-[var(--ld-on-error-container)] shrink-0"
            aria-label="Đóng"
          >
            close
          </button>
        </div>
      )}

      {/* KPI bento */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl relative overflow-hidden border border-[var(--ld-outline-variant)]/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-wider mb-1">
                Đã duyệt tháng này
              </p>
              <h3 className="text-2xl font-black text-[var(--ld-on-surface)] mt-1 tabular-nums" style={{ fontFamily: '"Inter", sans-serif' }}>
                {loading ? '…' : `${formatVndDots(kpis.approvedSum)} VNĐ`}
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[var(--ld-secondary)] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--ld-secondary)] shadow-[0_0_8px_#69f6b8]" />
            <span className="text-[10px] leader-dash-label text-[var(--ld-secondary)] uppercase font-bold">
              {kpis.approvedCount} yêu cầu
            </span>
          </div>
        </div>

        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl relative overflow-hidden border border-[var(--ld-outline-variant)]/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-wider mb-1">
                Chi Ads tháng này (BC)
              </p>
              <h3 className="text-2xl font-black text-[var(--ld-on-surface)] mt-1 tabular-nums" style={{ fontFamily: '"Inter", sans-serif' }}>
                {loading ? '…' : `${formatVndDots(kpis.adMonth)} VNĐ`}
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--ld-tertiary)_10%,transparent)] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[var(--ld-tertiary)] text-sm">monitoring</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="bg-[color-mix(in_srgb,var(--ld-tertiary)_15%,transparent)] text-[var(--ld-tertiary)] px-2 py-0.5 rounded-full text-[10px] font-bold leader-dash-label uppercase">
              Theo dõi
            </span>
          </div>
        </div>

        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl relative overflow-hidden border border-[color-mix(in_srgb,var(--ld-primary)_8%,transparent)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-wider mb-1">
                Đang chờ duyệt
              </p>
              <h3 className="text-2xl font-black text-[var(--ld-on-surface)] mt-1 tabular-nums" style={{ fontFamily: '"Inter", sans-serif' }}>
                {loading ? '…' : `${formatVndDots(kpis.pendingSum)} VNĐ`}
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--ld-primary)_10%,transparent)] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[var(--ld-primary)] text-sm">hourglass_empty</span>
            </div>
          </div>
          <button
            type="button"
            onClick={scrollToPending}
            className="mt-4 inline-flex items-center gap-1 text-[10px] leader-dash-label text-[var(--ld-primary)] hover:underline font-bold uppercase"
          >
            Xem yêu cầu
            <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
          </button>
        </div>

        <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl relative overflow-hidden border border-[var(--ld-outline-variant)]/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-wider mb-1">
                Chênh lệch (Duyệt − Ads)
              </p>
              <h3 className="text-2xl font-black text-[var(--ld-on-surface)] mt-1 tabular-nums" style={{ fontFamily: '"Inter", sans-serif' }}>
                {loading ? '…' : `${kpis.diff >= 0 ? '' : '−'}${formatVndDots(Math.abs(kpis.diff))} VNĐ`}
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--ld-outline-variant)_20%,transparent)] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[var(--ld-on-surface-variant)] text-sm">balance</span>
            </div>
          </div>
          <div className="mt-4 h-1 w-full bg-[var(--ld-surface-container-highest)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--ld-primary-dim)] transition-all duration-700 rounded-full"
              style={{ width: `${kpis.diffBarPct}%` }}
            />
          </div>
        </div>
      </div>

      {loading && !requests.length ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--ld-on-surface-variant)]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--ld-primary)]" />
          <span className="text-sm font-bold leader-dash-label">Đang tải…</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* Lịch sử */}
            <div className="xl:col-span-8 bg-[var(--ld-surface-container-low)] rounded-xl overflow-hidden shadow-2xl border border-[var(--ld-outline-variant)]/10">
              <div className="px-6 py-5 border-b border-[var(--ld-outline-variant)]/10 flex justify-between items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
                  Lịch sử phê duyệt
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    title="Lọc: dùng ô tìm kiếm phía trên"
                    className="bg-[var(--ld-surface-container-highest)] p-1.5 rounded text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-on-surface)] transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">filter_list</span>
                  </button>
                  <button
                    type="button"
                    title="Tải CSV"
                    onClick={() => downloadHistoryCsv(historyFull)}
                    disabled={historyFull.length === 0}
                    className="bg-[var(--ld-surface-container-highest)] p-1.5 rounded text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-on-surface)] transition-colors disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto leader-obsidian-scrollbar">
                <table className="w-full text-left border-separate border-spacing-y-2 px-4 min-w-[780px]">
                  <thead>
                    <tr className="text-[10px] leader-dash-label font-black text-[var(--ld-on-surface-variant)] uppercase tracking-widest">
                      <th className="px-4 py-3">Mã YC</th>
                      <th className="px-4 py-3">Agency / TK</th>
                      <th className="px-4 py-3">Page</th>
                      <th className="px-4 py-3 text-right">Số tiền</th>
                      <th className="px-4 py-3">Cập nhật</th>
                      <th className="px-4 py-3">TT</th>
                      <th className="px-4 py-3 text-right">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {historyList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-[var(--ld-on-surface-variant)] leader-dash-label text-xs">
                          Chưa có lịch sử duyệt / từ chối.
                        </td>
                      </tr>
                    ) : (
                      historyList.map((r) => {
                        const acc = budgetDisplayAcc(r);
                        const ok = r.trang_thai === 'dong_y';
                        return (
                          <tr
                            key={r.id}
                            className="bg-[var(--ld-surface-container)] hover:bg-[var(--ld-surface-container-high)] transition-colors group"
                          >
                            <td className="px-4 py-4 rounded-l-lg font-mono text-[var(--ld-primary)] text-xs">#{displayMa(r.id)}</td>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-[var(--ld-on-surface)] truncate max-w-[200px]" title={acc?.don_vi || ''}>
                                {acc?.don_vi?.trim() || '—'}
                              </p>
                              <p className="text-[10px] text-[var(--ld-on-surface-variant)] leader-dash-label">
                                TK: {acc?.tkqc?.trim() || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-[var(--ld-on-surface-variant)] leader-dash-label max-w-[160px] truncate" title={acc?.page || ''}>
                              {acc?.page?.trim() || '—'}
                            </td>
                            <td className="px-4 py-4 text-right font-bold text-[var(--ld-on-surface)] tabular-nums">
                              {formatVndDots(Number(r.ngan_sach_xin))}
                            </td>
                            <td className="px-4 py-4 text-[var(--ld-on-surface-variant)] text-xs leader-dash-label whitespace-nowrap">
                              {formatRelativeTime(r.updated_at || r.ngay_gio_xin)}
                            </td>
                            <td className="px-4 py-4 rounded-r-lg">
                              {ok ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)] text-[var(--ld-secondary)] border border-[color-mix(in_srgb,var(--ld-secondary)_20%,transparent)]">
                                  Approved
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)] text-[var(--ld-error)] border border-[color-mix(in_srgb,var(--ld-error)_20%,transparent)]">
                                  Rejected
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                title="Xóa yêu cầu"
                                onClick={() => void onDelete(r.id)}
                                className="bg-[var(--ld-surface-container-highest)] p-1.5 rounded text-[var(--ld-error)] hover:brightness-110 border border-[var(--ld-outline-variant)]/20"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {historyFull.length > 12 && (
                <div className="p-4 border-t border-[var(--ld-outline-variant)]/5 text-center">
                  <button
                    type="button"
                    onClick={() => setHistoryExpanded((v) => !v)}
                    className="text-xs leader-dash-label text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-primary)] transition-colors"
                  >
                    {historyExpanded ? 'Thu gọn' : 'Xem tất cả lịch sử'}
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="xl:col-span-4 space-y-6">
              <div
                ref={pendingPanelRef}
                id="budget-pending-panel"
                className="bg-[var(--ld-surface-container-high)] rounded-xl p-6 shadow-xl border border-[color-mix(in_srgb,var(--ld-primary)_10%,transparent)] relative scroll-mt-24"
              >
                <h3 className="text-base font-bold text-[var(--ld-on-surface)] mb-6 flex items-center gap-2" style={{ fontFamily: '"Inter", sans-serif' }}>
                  <span className="material-symbols-outlined text-[var(--ld-primary)] text-lg">notifications_active</span>
                  Yêu cầu nạp ngân sách
                </h3>
                {pendingList.length === 0 ? (
                  <div className="bg-[color-mix(in_srgb,#000_35%,transparent)] rounded-lg p-10 flex flex-col items-center text-center border border-dashed border-[var(--ld-outline-variant)]/30">
                    <div className="w-12 h-12 bg-[var(--ld-surface-container)] rounded-full flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-[var(--ld-on-surface-variant)]/40 text-3xl">inventory_2</span>
                    </div>
                    <p className="text-xs leader-dash-label text-[var(--ld-on-surface-variant)] leading-relaxed">
                      Không có yêu cầu chờ duyệt trong <br />
                      <span className="text-[var(--ld-primary)] font-mono font-bold">{BUDGET_TABLE}</span>
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3 max-h-[420px] overflow-y-auto leader-obsidian-scrollbar pr-1">
                    {pendingList.map((r) => {
                      const acc = budgetDisplayAcc(r);
                      const busy = actionId === r.id;
                      return (
                        <li
                          key={r.id}
                          className="bg-[var(--ld-surface-container-low)] rounded-lg p-4 border border-[var(--ld-outline-variant)]/10"
                        >
                          <div className="flex justify-between gap-2 items-start">
                            <div className="min-w-0">
                              <p className="text-xs font-mono text-[var(--ld-primary)]">#{displayMa(r.id)}</p>
                              <p className="text-sm font-bold text-[var(--ld-on-surface)] truncate">{acc?.don_vi?.trim() || '—'}</p>
                              <p className="text-[10px] text-[var(--ld-on-surface-variant)] leader-dash-label truncate">
                                {formatVndDots(Number(r.ngan_sach_xin))} đ · {priorityLabel(Number(r.ngan_sach_xin))}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onApprove(r.id)}
                              className="flex-1 py-2 rounded-lg bg-[color-mix(in_srgb,var(--ld-secondary)_12%,transparent)] text-[var(--ld-secondary)] text-[10px] font-bold leader-dash-label border border-[color-mix(in_srgb,var(--ld-secondary)_25%,transparent)] hover:brightness-110 disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onReject(r.id)}
                              className="flex-1 py-2 rounded-lg bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)] text-[var(--ld-error)] text-[10px] font-bold leader-dash-label border border-[color-mix(in_srgb,var(--ld-error)_20%,transparent)] hover:brightness-110 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onDelete(r.id)}
                              className="p-2 rounded-lg bg-[var(--ld-surface-container-highest)] text-[var(--ld-error)] text-[10px] font-bold leader-dash-label border border-[var(--ld-outline-variant)]/20 hover:brightness-110 disabled:opacity-50"
                              title="Xóa yêu cầu"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const parts: string[] = [];
                              const g = r.ghi_chu?.trim();
                              if (g) parts.push(g);
                              if (r.noi_dung_chuyen_khoan?.trim()) parts.push(`Nội dung CK: ${r.noi_dung_chuyen_khoan.trim()}`);
                              if (r.muc_dich_chi_tiet?.trim()) parts.push(`Mục đích: ${r.muc_dich_chi_tiet.trim()}`);
                              window.alert(parts.length ? parts.join('\n\n') : 'Không có chi tiết thêm.');
                            }}
                            className="w-full mt-2 text-[10px] text-[var(--ld-primary)] leader-dash-label font-bold hover:underline"
                          >
                            Chi tiết
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="w-full mt-6 py-3 bg-[var(--ld-primary)] text-[var(--ld-on-primary)] font-black rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-[var(--ld-primary-container)] transition-all active:scale-95 shadow-[0_8px_20px_-4px_rgba(59,191,250,0.3)] leader-dash-label"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Tạo yêu cầu xin ngân sách
                </button>
              </div>

              <div className="bg-[var(--ld-surface-container)] p-6 rounded-xl space-y-4 border border-[var(--ld-outline-variant)]/10">
                <h4 className="text-xs leader-dash-label font-black text-[var(--ld-on-surface-variant)] uppercase tracking-widest">
                  Health check
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs leader-dash-label">
                    <span className="text-[var(--ld-on-surface-variant)]">Bản ghi đã tải</span>
                    <span className="text-[var(--ld-secondary)] font-bold">{requests.length}</span>
                  </div>
                  <div className="w-full h-1 bg-[var(--ld-surface-container-highest)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--ld-secondary)] transition-all"
                      style={{ width: `${Math.min(100, requests.length > 0 ? 100 : 0)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs leader-dash-label mt-4">
                    <span className="text-[var(--ld-on-surface-variant)]">Báo cáo Ads (mẫu)</span>
                    <span className="text-[var(--ld-primary)] font-bold">{reportRows.length ? 'OK' : '—'}</span>
                  </div>
                  <div className="w-full h-1 bg-[var(--ld-surface-container-highest)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--ld-primary)]"
                      style={{ width: reportRows.length ? '92%' : '12%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast + phân bổ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-[var(--ld-surface-container-low)] rounded-xl p-6 h-64 relative overflow-hidden border border-[var(--ld-outline-variant)]/10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
                  Forecast variance
                </h3>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[var(--ld-primary)]" />
                  <span className="text-[10px] leader-dash-label text-[var(--ld-on-surface-variant)] uppercase">Ước lượng</span>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 w-full px-4 h-32 flex items-end justify-between gap-1">
                {forecastHeights.map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${i % 3 === 2 ? 'bg-[color-mix(in_srgb,var(--ld-primary)_20%,transparent)] border-t-2 border-[var(--ld-primary)]' : 'bg-[var(--ld-surface-container-highest)]'}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="bg-[var(--ld-surface-container)] rounded-xl p-6 flex flex-col justify-between border border-[var(--ld-outline-variant)]/10">
              <div>
                <h3 className="font-bold text-[var(--ld-on-surface)] mb-2" style={{ fontFamily: '"Inter", sans-serif' }}>
                  Agency distribution
                </h3>
                <p className="text-xs leader-dash-label text-[var(--ld-on-surface-variant)]">Theo số yêu cầu (top 3 đơn vị).</p>
              </div>
              <div className="space-y-4 mt-4">
                {agencyDist.length === 0 ? (
                  <p className="text-xs text-[var(--ld-on-surface-variant)] leader-dash-label">Chưa có dữ liệu.</p>
                ) : (
                  agencyDist.map((row) => (
                    <div key={row.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
                        <span className="text-xs leader-dash-label truncate">{row.name}</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums">{row.pct}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <BudgetRequestFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmitted={() => void load()} />

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        title="Tạo yêu cầu"
        className="fixed bottom-8 right-8 w-14 h-14 bg-[var(--ld-primary)] text-[var(--ld-on-primary)] rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-30 border border-[color-mix(in_srgb,var(--ld-primary-container)_40%,transparent)] md:hidden"
      >
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          add
        </span>
      </button>
    </div>
  );
};
