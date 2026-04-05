import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { ReportRow } from '../../../types';

const REPORTS_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';
const PAGE_SIZE = 50;

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const ReportsRawView: React.FC = () => {
  const today = toYmd(new Date());
  const monthAgo = toYmd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [draftFrom, setDraftFrom] = useState(monthAgo);
  const [draftTo, setDraftTo] = useState(today);
  const [draftEmail, setDraftEmail] = useState('');
  const [draftCode, setDraftCode] = useState('');
  const [draftSearch, setDraftSearch] = useState('');

  const [applied, setApplied] = useState({ from: monthAgo, to: today, email: '', code: '', q: '' });
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from(REPORTS_TABLE)
      .select(
        'id, report_date, name, email, team, product, market, page, ma_tkqc, ad_account, ad_cost, revenue, mess_comment_count, order_count, tong_lead, tong_data_nhan, code'
      )
      .gte('report_date', applied.from)
      .lte('report_date', applied.to)
      .order('report_date', { ascending: false })
      .limit(5000);
    if (applied.email) q = q.ilike('email', `%${applied.email}%`);
    if (applied.code) q = q.ilike('code', `%${applied.code}%`);
    if (applied.q) {
      q = q.or(
        [
          `name.ilike.%${applied.q}%`,
          `product.ilike.%${applied.q}%`,
          `market.ilike.%${applied.q}%`,
          `page.ilike.%${applied.q}%`,
          `ad_account.ilike.%${applied.q}%`,
          `team.ilike.%${applied.q}%`,
        ].join(',')
      );
    }
    const { data, error: qErr } = await q;
    if (qErr) {
      setError(qErr.message || 'Không tải được dữ liệu.');
      setRows([]);
    } else {
      setRows((data || []) as ReportRow[]);
    }
    setLoading(false);
    setPage(1);
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page, totalPages]);

  const apply = () => {
    setApplied({
      from: draftFrom,
      to: draftTo,
      email: draftEmail.trim().toLowerCase(),
      code: draftCode.trim(),
      q: draftSearch.trim(),
    });
  };

  const toggleSelectOne = (id: string | undefined) => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = pageRows.map((r) => r.id).filter(Boolean) as string[];
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Xóa ${ids.length} dòng khỏi ${REPORTS_TABLE}?`)) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase.from(REPORTS_TABLE).delete().in('id', ids);
      if (delErr) {
        window.alert(`Lỗi xóa: ${delErr.message}`);
        return;
      }
      setRows((prev) => prev.filter((r) => !r.id || !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } finally {
      setDeleting(false);
    }
  };

  const deleteAllFiltered = async () => {
    if (!rows.length) return;
    const msg =
      applied.q || applied.email || applied.code || applied.from !== monthAgo || applied.to !== today
        ? `Xóa TOÀN BỘ ${rows.length} dòng khớp bộ lọc hiện tại?`
        : `Xóa TOÀN BỘ dữ liệu trong ${REPORTS_TABLE}?`;
    if (!window.confirm(msg)) return;
    setDeletingAll(true);
    try {
      let q = supabase
        .from(REPORTS_TABLE)
        .delete()
        .gte('report_date', applied.from)
        .lte('report_date', applied.to);
      if (applied.email) q = q.ilike('email', `%${applied.email}%`);
      if (applied.code) q = q.ilike('code', `%${applied.code}%`);
      if (applied.q) {
        q = q.or(
          [
            `name.ilike.%${applied.q}%`,
            `product.ilike.%${applied.q}%`,
            `market.ilike.%${applied.q}%`,
            `page.ilike.%${applied.q}%`,
            `ad_account.ilike.%${applied.q}%`,
            `team.ilike.%${applied.q}%`,
          ].join(',')
        );
      }
      const { error: delErr } = await q;
      if (delErr) {
        window.alert(`Lỗi xóa toàn bộ: ${delErr.message}`);
        return;
      }
      setRows([]);
      setSelectedIds(new Set());
      setPage(1);
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="dash-fade-up">
      <div className="flex items-end flex-wrap gap-3 mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)]">Từ ngày</span>
          <input
            type="date"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="bg-[var(--ld-surface-container-highest)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)]">Đến ngày</span>
          <input
            type="date"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
            className="bg-[var(--ld-surface-container-highest)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)]">Email</span>
          <input
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            placeholder="contains…"
            className="bg-[var(--ld-surface-container-highest)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)]">Code</span>
          <input
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value)}
            placeholder="e.g. DucNT"
            className="bg-[var(--ld-surface-container-highest)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 min-w-[220px] flex-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--ld-primary)]">Tìm nhanh</span>
          <input
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            placeholder="name / product / market / page / ad_account / team…"
            className="bg-[var(--ld-surface-container-highest)] border border-[var(--ld-outline-variant)]/20 rounded-lg text-sm text-[var(--ld-on-surface)] px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={() => apply()}
          className="rounded-lg bg-[var(--ld-primary)] text-[var(--ld-on-primary)] px-4 py-2 text-sm font-bold uppercase tracking-widest"
        >
          Áp dụng
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-[var(--ld-outline-variant)]/25 bg-[var(--ld-surface-container)] text-[var(--ld-on-surface-variant)] px-3 py-2 text-sm font-bold"
          title="Làm mới"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={() => void deleteAllFiltered()}
          disabled={loading || deletingAll || rows.length === 0}
          className="rounded-lg border border-[var(--ld-error)]/40 text-[var(--ld-error)] px-3 py-2 text-sm font-bold hover:bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)] disabled:opacity-50"
          title="Xóa toàn bộ dòng khớp bộ lọc hiện tại"
        >
          {deletingAll ? 'Đang xóa toàn bộ…' : 'Xóa toàn bộ (lọc)'}
        </button>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-[var(--ld-on-surface-variant)] p-6">
            <Loader2 className="animate-spin" size={18} /> Đang tải…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-[var(--ld-on-surface-variant)]">Không có dòng nào.</div>
        ) : (
          <table className="w-full border-collapse min-w-[1400px] text-left">
            <thead>
              <tr className="border-b border-[var(--ld-outline-variant)]/15 text-[10px] font-extrabold uppercase tracking-widest text-[var(--ld-on-surface-variant)]">
                <th className="p-2 w-[36px]">
                  <input
                    type="checkbox"
                    aria-label="select all"
                    onChange={toggleSelectAllOnPage}
                    checked={pageRows.length > 0 && pageRows.every((r) => r.id && selectedIds.has(r.id))}
                    className="accent-[var(--ld-primary)]"
                  />
                </th>
                <th className="p-2">Ngày</th>
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Team</th>
                <th className="p-2">Product</th>
                <th className="p-2">Market</th>
                <th className="p-2">Page</th>
                <th className="p-2">Code</th>
                <th className="p-2">TK</th>
                <th className="p-2 text-right">Ads chi</th>
                <th className="p-2 text-right">Revenue</th>
                <th className="p-2 text-right">Mess</th>
                <th className="p-2 text-right">Đơn</th>
                <th className="p-2 text-right">Lead</th>
              </tr>
            </thead>
            <tbody className="text-[12px] text-[var(--ld-on-surface)]">
              {pageRows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--ld-outline-variant)]/7">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={!!(r.id && selectedIds.has(r.id))}
                      onChange={() => toggleSelectOne(r.id)}
                      className="accent-[var(--ld-primary)]"
                    />
                  </td>
                  <td className="p-2">{r.report_date?.slice(0, 10)}</td>
                  <td className="p-2 max-w-[200px] truncate" title={r.name || ''}>{r.name || '—'}</td>
                  <td className="p-2 max-w-[220px] truncate" title={r.email || ''}>{r.email || '—'}</td>
                  <td className="p-2">{r.team || '—'}</td>
                  <td className="p-2 max-w-[220px] truncate" title={r.product || ''}>{r.product || '—'}</td>
                  <td className="p-2">{r.market || '—'}</td>
                  <td className="p-2 max-w-[260px] truncate" title={r.page || ''}>{r.page || '—'}</td>
                  <td className="p-2">{(r as any).code || '—'}</td>
                  <td className="p-2 max-w-[220px] truncate" title={r.ad_account || ''}>{r.ad_account || '—'}</td>
                  <td className="p-2 text-right">{Number(r.ad_cost || 0).toLocaleString('vi-VN')}</td>
                  <td className="p-2 text-right">{Number(r.revenue || 0).toLocaleString('vi-VN')}</td>
                  <td className="p-2 text-right">{r.mess_comment_count ?? '—'}</td>
                  <td className="p-2 text-right">{r.order_count ?? '—'}</td>
                  <td className="p-2 text-right">{r.tong_lead ?? r.tong_data_nhan ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-[var(--ld-on-surface-variant)] text-sm">
          <div className="flex items-center gap-3">
            <span>
              Trang {page}/{totalPages} · {rows.length} dòng
            </span>
            <span className="text-[var(--ld-primary)]">
              Đã chọn: {selectedIds.size}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded border border-[var(--ld-outline-variant)]/30 hover:bg-[var(--ld-surface-container)]"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Trước
            </button>
            <button
              className="px-3 py-1 rounded border border-[var(--ld-outline-variant)]/30 hover:bg-[var(--ld-surface-container)]"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sau →
            </button>
            <button
              className="ml-3 px-3 py-1 rounded border border-[var(--ld-error)]/40 text-[var(--ld-error)] hover:bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)] disabled:opacity-50"
              disabled={selectedIds.size === 0 || deleting}
              onClick={() => void deleteSelected()}
              title="Xóa các dòng đã chọn"
            >
              {deleting ? 'Đang xóa…' : 'Xóa đã chọn'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

