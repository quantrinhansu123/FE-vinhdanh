import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { AuthUser, Employee, ReportRow } from '../../../types';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';
import { fetchUpcareMktEmployees, isUpcareMktConfigured } from '../../../api/upcareCrm';
import {
  REPORTS_TABLE,
  toLocalYyyyMmDd,
  formatReportDateVi,
  formatCompactVnd,
  extractMaNvFromBracketPage,
  buildMaNsLookup,
  matchEmployeeByBracketTag,
  buildUpcareAmountLookup,
  resolveUpcareAmountForReportRow,
} from './mktDetailReportShared';
import { downloadMktReportExcelTemplate, parseMktReportExcelFile } from './mktHistoryExcel';

const PRODUCTS_TABLE = import.meta.env.VITE_SUPABASE_PRODUCTS_TABLE?.trim() || 'crm_products';
const MARKETS_TABLE = import.meta.env.VITE_SUPABASE_MARKETS_TABLE?.trim() || 'crm_markets';
const PAGE_SIZE = 10;

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function tyLeChot(row: ReportRow): number | null {
  const td = Number(row.tong_data_nhan);
  const ord = Number(row.order_count);
  const tl = Number(row.tong_lead);
  if (Number.isFinite(td) && td > 0 && Number.isFinite(ord)) return (ord / td) * 100;
  if (Number.isFinite(tl) && tl > 0 && Number.isFinite(ord)) return (ord / tl) * 100;
  return null;
}

function adsDt(row: ReportRow): number | null {
  const rev = Number(row.revenue);
  const ad = Number(row.ad_cost);
  if (Number.isFinite(rev) && rev > 0 && Number.isFinite(ad)) return (ad / rev) * 100;
  return null;
}

function truncateAccount(s: string | null | undefined, max = 6): string {
  const t = s?.trim() || '';
  if (!t) return '—';
  if (t.length <= max) return t;
  return `${t.slice(0, 3)}…`;
}

function productChip(text: string | null | undefined): string {
  const t = text?.trim() || '';
  if (!t) return '—';
  if (t.length <= 12) return t;
  return `${t.slice(0, 10)}…`;
}

function adsSpendTone(row: ReportRow, ads: number | null): string {
  const rev = Number(row.revenue);
  const ad = Number(row.ad_cost);
  if (Number.isFinite(rev) && rev <= 0 && Number.isFinite(ad) && ad > 0) {
    return 'text-[var(--ld-error)]';
  }
  if (ads == null) return 'text-[var(--ld-on-surface-variant)]';
  if (ads >= 45) return 'text-[var(--ld-error)]';
  if (ads >= 35) return 'text-[var(--ld-tertiary)]';
  return 'text-[var(--ld-secondary)]';
}

function adsDtPill(row: ReportRow, ads: number | null): { label: string; box: string } {
  const rev = Number(row.revenue);
  const ad = Number(row.ad_cost);
  if (Number.isFinite(rev) && rev <= 0 && Number.isFinite(ad) && ad > 0) {
    return {
      label: '∞%',
      box: 'bg-[color-mix(in_srgb,var(--ld-error-container)_20%,transparent)] text-[var(--ld-error)] border border-[color-mix(in_srgb,var(--ld-error)_20%,transparent)]',
    };
  }
  if (ads == null) {
    return { label: '—', box: 'bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)] border border-[var(--ld-outline-variant)]/20' };
  }
  if (ads >= 45) {
    return {
      label: `${ads.toFixed(1)}%`,
      box: 'bg-[color-mix(in_srgb,var(--ld-error-container)_20%,transparent)] text-[var(--ld-error)] border border-[color-mix(in_srgb,var(--ld-error)_20%,transparent)]',
    };
  }
  if (ads >= 35) {
    return {
      label: `${ads.toFixed(1)}%`,
      box: 'bg-[color-mix(in_srgb,var(--ld-tertiary-container)_20%,transparent)] text-[var(--ld-tertiary)] border border-[color-mix(in_srgb,var(--ld-tertiary)_20%,transparent)]',
    };
  }
  return {
    label: `${ads.toFixed(1)}%`,
    box: 'bg-[color-mix(in_srgb,var(--ld-secondary-container)_20%,transparent)] text-[var(--ld-secondary)] border border-[color-mix(in_srgb,var(--ld-secondary)_20%,transparent)]',
  };
}

const fieldBase =
  'w-full bg-[var(--ld-surface-container-highest)] border-none rounded-lg py-2 pl-9 pr-2 text-xs text-[var(--ld-on-surface)] focus:ring-1 focus:ring-[var(--ld-primary)] outline-none [color-scheme:dark]';
const selectField =
  'w-full bg-[var(--ld-surface-container-highest)] border-none rounded-lg py-2 px-3 text-xs text-[var(--ld-on-surface)] focus:ring-1 focus:ring-[var(--ld-primary)] outline-none [color-scheme:dark]';

export type MktHistoryViewProps = {
  reportUser?: AuthUser | null;
  employees?: Employee[];
};

export const MktHistoryView: React.FC<MktHistoryViewProps> = ({ reportUser = null, employees = [] }) => {
  const navigate = useNavigate();
  const defaultTo = toLocalYyyyMmDd(new Date());
  const defaultFrom = toLocalYyyyMmDd(addDays(new Date(), -90));

  const [draftFrom, setDraftFrom] = useState(defaultFrom);
  const [draftTo, setDraftTo] = useState(defaultTo);
  const [draftProduct, setDraftProduct] = useState('');
  const [draftMarket, setDraftMarket] = useState('');
  const [applied, setApplied] = useState({
    from: defaultFrom,
    to: defaultTo,
    product: '',
    market: '',
  });
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [marketOptions, setMarketOptions] = useState<string[]>([]);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelMsg, setExcelMsg] = useState<string | null>(null);
  const [upcareSyncBusy, setUpcareSyncBusy] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pSet = new Set<string>();
      const mSet = new Set<string>();
      const email = reportUser?.email?.trim().toLowerCase();

      const [pRes, mRes, rRes] = await Promise.all([
        supabase.from(PRODUCTS_TABLE).select('ten_san_pham').eq('trang_thai', 'dang_ban').order('ten_san_pham', { ascending: true }),
        supabase.from(MARKETS_TABLE).select('ten_thi_truong').eq('trang_thai', 'hoat_dong').order('ten_thi_truong', { ascending: true }),
        email
          ? supabase
              .from(REPORTS_TABLE)
              .select('product, market')
              .ilike('email', email)
              .order('report_date', { ascending: false })
              .limit(2000)
          : Promise.resolve({ data: [] as { product?: string | null; market?: string | null }[], error: null as null }),
      ]);

      if (cancelled) return;

      if (!pRes.error) {
        for (const r of pRes.data || []) {
          const t = (r as { ten_san_pham?: string }).ten_san_pham?.trim();
          if (t) pSet.add(t);
        }
      }
      if (!mRes.error) {
        for (const r of mRes.data || []) {
          const t = (r as { ten_thi_truong?: string }).ten_thi_truong?.trim();
          if (t) mSet.add(t);
        }
      }
      if (!rRes.error && rRes.data) {
        for (const r of rRes.data) {
          const pr = r.product?.trim();
          const mk = r.market?.trim();
          if (pr) pSet.add(pr);
          if (mk) mSet.add(mk);
        }
      }

      const sortVi = (a: string, b: string) => a.localeCompare(b, 'vi', { sensitivity: 'base' });
      setProductOptions(Array.from(pSet).sort(sortVi));
      setMarketOptions(Array.from(mSet).sort(sortVi));
    })();
    return () => {
      cancelled = true;
    };
  }, [reportUser?.email]);

  const productSelectList = useMemo(() => {
    if (draftProduct && !productOptions.includes(draftProduct)) {
      return [draftProduct, ...productOptions];
    }
    return productOptions;
  }, [productOptions, draftProduct]);

  const marketSelectList = useMemo(() => {
    if (draftMarket && !marketOptions.includes(draftMarket)) {
      return [draftMarket, ...marketOptions];
    }
    return marketOptions;
  }, [marketOptions, draftMarket]);

  const maNsLookup = useMemo(() => buildMaNsLookup(employees), [employees]);

  const load = useCallback(async () => {
    if (!reportUser?.email?.trim()) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const email = reportUser.email.trim().toLowerCase();
    let q = supabase
      .from(REPORTS_TABLE)
      .select(
        'id, report_date, product, market, page, ma_tkqc, ad_account, ad_cost, mess_comment_count, tong_data_nhan, revenue, order_count, tong_lead, team, created_at, name, email'
      )
      .ilike('email', email)
      .gte('report_date', applied.from)
      .lte('report_date', applied.to)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000);

    if (applied.product) q = q.eq('product', applied.product);
    if (applied.market) q = q.eq('market', applied.market);

    const { data, error: qErr } = await q;
    if (qErr) {
      console.error('mkt-history:', qErr);
      setError(
        qErr.message?.includes('tong_')
          ? `${qErr.message} — Chạy supabase/alter_detail_reports_mkt_form.sql nếu thiếu cột.`
          : qErr.message?.includes('ma_tkqc')
            ? `${qErr.message} — Chạy supabase/alter_detail_reports_ma_tkqc.sql.`
            : qErr.message || 'Không tải được lịch sử.'
      );
      setRows([]);
    } else {
      setRows((data || []) as ReportRow[]);
    }
    setLoading(false);
  }, [applied, reportUser?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [applied, reportUser?.email]);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(rows.map((r) => r.id).filter((id): id is string => Boolean(id?.trim())));
      let dropped = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else dropped = true;
      });
      return dropped ? next : prev;
    });
  }, [rows]);

  const rowIdsSelectable = useMemo(
    () => rows.map((r) => r.id).filter((id): id is string => Boolean(id && String(id).trim())),
    [rows]
  );

  const allVisibleSelected =
    rowIdsSelectable.length > 0 && rowIdsSelectable.every((id) => selectedIds.has(id));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return new Set();
      return new Set(rowIdsSelectable);
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !reportUser?.email?.trim()) return;
    if (!window.confirm(`Xóa ${ids.length} dòng báo cáo đã chọn? Thao tác không hoàn tác.`)) return;
    const email = reportUser.email.trim().toLowerCase();
    setDeleteBusy(true);
    try {
      const chunk = 80;
      let deleted = 0;
      for (let i = 0; i < ids.length; i += chunk) {
        const part = ids.slice(i, i + chunk);
        const { error: delErr } = await supabase
          .from(REPORTS_TABLE)
          .delete()
          .in('id', part)
          .ilike('email', email);
        if (delErr) {
          console.error('mkt-history bulk delete:', delErr);
          window.alert(delErr.message || 'Không xóa được.');
          await load();
          return;
        }
        deleted += part.length;
      }
      setSelectedIds(new Set());
      setExcelMsg(`Đã xóa ${deleted} dòng.`);
      await load();
    } finally {
      setDeleteBusy(false);
    }
  };

  const applyFilters = () => {
    setApplied({
      from: draftFrom,
      to: draftTo,
      product: draftProduct.trim(),
      market: draftMarket.trim(),
    });
  };

  const openReport = (row: ReportRow) => {
    const rd = row.report_date?.slice(0, 10) || '';
    const q = new URLSearchParams({ date: rd });
    if (row.id) q.set('id', row.id);
    navigate(`${crmAdminPathForView('mkt-report')}?${q.toString()}`);
  };

  const handleDownloadExcelTemplate = () => {
    setExcelMsg(null);
    downloadMktReportExcelTemplate();
    setExcelMsg('Đã tải file mẫu. Xóa dòng ví dụ (dòng 2) rồi điền dữ liệu từ dòng 2 trở đi, giữ nguyên thứ tự cột A–L.');
  };

  const handleSyncRevenueFromUpcare = async () => {
    setExcelMsg(null);
    if (!reportUser?.email?.trim()) {
      window.alert('Cần đăng nhập để đồng bộ.');
      return;
    }
    if (!isUpcareMktConfigured()) {
      window.alert('Chưa cấu hình Upcare (VITE_UPCARE_CRM_BEARER_TOKEN trong .env.local).');
      return;
    }
    if (rows.length === 0) {
      window.alert('Không có dòng nào trong danh sách đã lọc.');
      return;
    }

    const email = reportUser.email.trim().toLowerCase();
    const multiDay = applied.from !== applied.to;
    const warnMulti =
      multiDay &&
      !window.confirm(
        `Khoảng ngày ${applied.from} → ${applied.to}: API Upcare trả một mức doanh số / nhân viên cho cả khoảng.\n` +
          `Mọi dòng khớp Mã NV sẽ nhận cùng số đó (có thể trùng nếu nhiều dòng cùng NV).\n\nTiếp tục?`
      );
    if (warnMulti) return;

    setUpcareSyncBusy(true);
    try {
      const mktRows = await fetchUpcareMktEmployees({
        dateFrom: applied.from,
        dateTo: applied.to,
      });
      const lookup = buildUpcareAmountLookup(mktRows);

      const updates: { id: string; revenue: number }[] = [];
      let skippedNoTag = 0;
      let skippedNoMatch = 0;
      for (const row of rows) {
        const id = row.id?.trim();
        if (!id) continue;
        if (!extractMaNvFromBracketPage(row.page)) {
          skippedNoTag++;
          continue;
        }
        const revenue = resolveUpcareAmountForReportRow(row, lookup, maNsLookup);
        if (revenue == null) {
          skippedNoMatch++;
          continue;
        }
        updates.push({ id, revenue });
      }

      if (updates.length === 0) {
        window.alert(
          `Không có dòng nào khớp.\n` +
            `- Không có […] trong Page: ${skippedNoTag} dòng\n` +
            `- Có […] nhưng không khớp API (ID / tên): ${skippedNoMatch} dòng\n` +
            `Gợi ý: trong Page dùng [ID_Upcare] (số) hoặc [mã_ns] trùng bảng nhân sự + tên trùng Upcare.`
        );
        return;
      }

      if (
        !window.confirm(
          `Cập nhật doanh số (revenue) cho ${updates.length} dòng báo cáo theo Upcare CRM?\n` +
            `Khoảng API: ${applied.from} … ${applied.to}\n` +
            `Bỏ qua: không [Mã NV] trong Page ${skippedNoTag}, không khớp API ${skippedNoMatch}.`
        )
      ) {
        return;
      }

      const chunk = 12;
      let ok = 0;
      for (let i = 0; i < updates.length; i += chunk) {
        const part = updates.slice(i, i + chunk);
        const results = await Promise.all(
          part.map((u) =>
            supabase.from(REPORTS_TABLE).update({ revenue: u.revenue }).eq('id', u.id).ilike('email', email)
          )
        );
        for (const res of results) {
          if (res.error) {
            console.error('mkt-history upcare sync:', res.error);
            window.alert(`Lỗi khi cập nhật (đã ghi ${ok}/${updates.length}): ${res.error.message || 'Unknown'}`);
            await load();
            return;
          }
          ok++;
        }
      }

      setExcelMsg(`Đồng bộ Upcare: đã cập nhật doanh số cho ${ok} dòng (${applied.from} … ${applied.to}).`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định';
      window.alert(`Đồng bộ Upcare thất bại: ${msg}`);
    } finally {
      setUpcareSyncBusy(false);
    }
  };

  const handleExcelFile = async (file: File | null) => {
    setExcelMsg(null);
    if (!file?.name) return;
    if (!reportUser?.email?.trim()) {
      window.alert('Cần đăng nhập để nhập Excel.');
      return;
    }
    setExcelBusy(true);
    try {
      const { rows: parsed, errors } = await parseMktReportExcelFile(file);
      if (errors.length) {
        const head = errors
          .slice(0, 12)
          .map((e) => `Dòng ${e.row}: ${e.msg}`)
          .join('\n');
        window.alert(`Lỗi đọc file:\n${head}${errors.length > 12 ? `\n… +${errors.length - 12} lỗi` : ''}`);
        return;
      }
      if (parsed.length === 0) {
        window.alert('Không có dòng dữ liệu để nhập.');
        return;
      }
      if (!window.confirm(`Nhập ${parsed.length} dòng báo cáo vào hệ thống với email ${reportUser.email}?`)) return;

      const email = reportUser.email.trim().toLowerCase();
      const name = (reportUser.name || email).trim() || email;
      const team = reportUser.team?.trim() || null;

      const payloads = parsed.map((r) => ({
        ...r,
        name,
        email,
        team,
      }));

      const chunk = 80;
      let inserted = 0;
      for (let i = 0; i < payloads.length; i += chunk) {
        const part = payloads.slice(i, i + chunk);
        const { error: insErr } = await supabase.from(REPORTS_TABLE).insert(part);
        if (insErr) {
          console.error('mkt-history excel insert:', insErr);
          window.alert(
            `Lỗi khi ghi DB (đã nhập ${inserted}/${parsed.length} dòng): ${insErr.message || 'Unknown'}`
          );
          await load();
          return;
        }
        inserted += part.length;
      }

      setExcelMsg(`Đã nhập ${inserted} dòng từ Excel.`);
      await load();
    } finally {
      setExcelBusy(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page, totalPages]);

  const rowCountLabel =
    rows.length === 0
      ? 'Chưa có dòng dữ liệu trong khoảng đã lọc'
      : `${rows.length} dòng dữ liệu được ghi nhận`;

  const pageFrom = rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageTo = rows.length === 0 ? 0 : Math.min(safePage * PAGE_SIZE, rows.length);

  const cb =
    'rounded bg-[var(--ld-surface-container-highest)] border border-[var(--ld-outline-variant)]/30 text-[var(--ld-primary)] focus:ring-[var(--ld-primary)] accent-[var(--ld-primary)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="leader-dash-obsidian dash-fade-up text-[var(--ld-on-surface)] selection:bg-[color-mix(in_srgb,var(--ld-primary)_30%,transparent)] -m-[12px] px-4 sm:px-8 pb-20 pt-2 max-w-[1600px] mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
            Lịch sử Báo cáo
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-[var(--ld-secondary)] shadow-[0_0_8px_rgba(105,246,184,0.5)] shrink-0" />
            <p className="text-sm leader-dash-label text-[var(--ld-on-surface-variant)]">{rowCountLabel}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <section className="mb-8 p-6 bg-[var(--ld-surface-container-low)] rounded-xl border border-[var(--ld-outline-variant)]/10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div>
            <label className="block text-xs leader-dash-label text-[var(--ld-on-surface-variant)] mb-2 uppercase tracking-wider">
              Khoảng thời gian
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ld-on-surface-variant)] text-sm pointer-events-none">
                  calendar_today
                </span>
                <input
                  type="date"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value || defaultFrom)}
                  className={`${fieldBase} pl-9`}
                />
              </div>
              <span className="text-[var(--ld-on-surface-variant)] shrink-0">—</span>
              <div className="relative flex-1 min-w-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ld-on-surface-variant)] text-sm pointer-events-none">
                  calendar_today
                </span>
                <input
                  type="date"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value || defaultTo)}
                  className={`${fieldBase} pl-9`}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs leader-dash-label text-[var(--ld-on-surface-variant)] mb-2 uppercase tracking-wider">
              Sản phẩm (Product)
            </label>
            <select value={draftProduct} onChange={(e) => setDraftProduct(e.target.value)} className={selectField}>
              <option value="">Tất cả sản phẩm</option>
              {productSelectList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs leader-dash-label text-[var(--ld-on-surface-variant)] mb-2 uppercase tracking-wider">
              Thị trường (Market)
            </label>
            <select value={draftMarket} onChange={(e) => setDraftMarket(e.target.value)} className={selectField}>
              <option value="">Tất cả thị trường</option>
              {marketSelectList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyFilters()}
              disabled={loading}
              className="flex-1 min-w-0 bg-gradient-to-br from-[var(--ld-primary)] to-[var(--ld-primary-container)] text-[var(--ld-on-primary-container)] font-bold py-2 rounded-lg text-xs hover:opacity-90 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Áp dụng
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title="Tải lại"
              className="bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface)] px-3 py-2 rounded-lg hover:bg-[var(--ld-surface-bright)] transition-all disabled:opacity-50 inline-flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[var(--ld-outline-variant)]/10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate(crmAdminPathForView('mkt-report'))}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--ld-surface-container)] text-[var(--ld-on-surface-variant)] rounded-lg border border-[var(--ld-outline-variant)]/15 text-xs leader-dash-label hover:border-[color-mix(in_srgb,var(--ld-primary)_50%,transparent)] transition-all"
          >
            <span className="material-symbols-outlined text-sm">add_box</span>
            Nhập báo cáo
          </button>
          <button
            type="button"
            onClick={() => handleDownloadExcelTemplate()}
            disabled={excelBusy}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--ld-surface-container)] text-[var(--ld-on-surface-variant)] rounded-lg border border-[var(--ld-outline-variant)]/15 text-xs leader-dash-label hover:border-[color-mix(in_srgb,var(--ld-primary)_50%,transparent)] transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Tải mẫu Excel
          </button>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => void handleExcelFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => excelInputRef.current?.click()}
            disabled={excelBusy || !reportUser?.email}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--ld-surface-container)] text-[var(--ld-on-surface-variant)] rounded-lg border border-[var(--ld-outline-variant)]/15 text-xs leader-dash-label hover:border-[color-mix(in_srgb,var(--ld-primary)_50%,transparent)] transition-all disabled:opacity-50"
          >
            {excelBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="material-symbols-outlined text-sm">upload</span>}
            Tải lên Excel
          </button>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={deleteBusy || !reportUser?.email || selectedIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[color-mix(in_srgb,var(--ld-error)_35%,transparent)] text-[var(--ld-error)] text-xs leader-dash-label font-bold hover:bg-[color-mix(in_srgb,var(--ld-error)_10%,transparent)] transition-all disabled:opacity-40"
          >
            {deleteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="material-symbols-outlined text-sm">delete</span>}
            Xóa đã chọn ({selectedIds.size})
          </button>
          <button
            type="button"
            onClick={() => void handleSyncRevenueFromUpcare()}
            disabled={upcareSyncBusy || excelBusy || !reportUser?.email || rows.length === 0 || !isUpcareMktConfigured()}
            title={
              !isUpcareMktConfigured()
                ? 'Cần VITE_UPCARE_CRM_BEARER_TOKEN'
                : 'Gọi API Upcare /employee/mkt theo khoảng ngày đang lọc; khớp cột Mã NV với ID hoặc tên nhân viên'
            }
            className="flex items-center gap-2 px-4 py-2 bg-[color-mix(in_srgb,var(--ld-primary)_12%,transparent)] text-[var(--ld-primary)] rounded-lg border border-[color-mix(in_srgb,var(--ld-primary)_35%,transparent)] text-xs leader-dash-label font-bold hover:bg-[color-mix(in_srgb,var(--ld-primary)_18%,transparent)] transition-all disabled:opacity-40"
          >
            {upcareSyncBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-sm">cloud_sync</span>
            )}
            Đồng bộ doanh số (Upcare)
          </button>
        </div>

        {excelMsg && (
          <div className="mt-4 text-[11px] font-bold text-[var(--ld-secondary)] border border-[color-mix(in_srgb,var(--ld-secondary)_25%,transparent)] rounded-lg px-3 py-2 bg-[color-mix(in_srgb,var(--ld-secondary)_8%,transparent)]">
            {excelMsg}
          </div>
        )}
        <p className="mt-4 text-[10px] text-[var(--ld-on-surface-variant)] leading-relaxed max-w-[920px]">
          <span className="text-[var(--ld-on-surface)] font-bold">Đồng bộ doanh số (Upcare):</span> dùng khoảng ngày ở trên, gọi API cùng tham số; điền{' '}
          <span className="text-[var(--ld-on-surface)] font-bold">Doanh số</span> khi{' '}
          <span className="text-[var(--ld-on-surface)] font-bold">Mã NV</span> khớp —{' '}
          <span className="text-[var(--ld-on-surface)] font-bold">[số]</span> trong Page = ID nhân viên trên Upcare, hoặc{' '}
          <span className="text-[var(--ld-on-surface)] font-bold">[mã_ns]</span> khớp nhân sự CRM + tên khớp Upcare. Nhiều ngày: API là tổng khoảng; xác nhận trước khi ghi.
        </p>
        <p className="mt-2 text-[10px] text-[var(--ld-on-surface-variant)] leading-relaxed max-w-[920px]">
          Hai kiểu file: (1) Mẫu CRM — nút Tải mẫu Excel, cột ngày A–C. (2) Export Ads: chỉ nhập dòng có{' '}
          <span className="text-[var(--ld-on-surface)] font-bold">Bắt đầu báo cáo = Kết thúc báo cáo</span> (cùng một ngày); cột{' '}
          <span className="text-[var(--ld-on-surface)] font-bold">Tên quảng cáo</span> → trường Page khi file có tiêu đề cột đó.
          Doanh số, Đơn, Lead (số). Khi tải lên, các dòng ghi với{' '}
          <span className="text-[var(--ld-on-surface)] font-bold">email đang đăng nhập</span>.
        </p>
        {error && (
          <div className="mt-3 text-[11px] font-bold text-[var(--ld-error)] border border-[color-mix(in_srgb,var(--ld-error)_25%,transparent)] rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {!reportUser?.email && (
          <div className="mt-2 text-[10px] text-[var(--ld-on-surface-variant)]">Đăng nhập để xem lịch sử theo email nhân sự.</div>
        )}
      </section>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl bg-[var(--ld-surface-container-low)] border border-[var(--ld-outline-variant)]/10 leader-obsidian-scrollbar">
        {loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--ld-on-surface-variant)]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--ld-primary)]" />
            <span className="text-sm font-bold leader-dash-label">Đang tải…</span>
          </div>
        ) : (
          <table className="w-full text-left border-separate border-spacing-y-2 px-4 min-w-[1380px]">
            <thead>
              <tr className="text-[10px] leader-dash-label text-[var(--ld-on-surface-variant)] uppercase tracking-[0.15em]">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    className={cb}
                    checked={allVisibleSelected}
                    disabled={!reportUser?.email || rowIdsSelectable.length === 0}
                    onChange={toggleSelectAllVisible}
                    title="Chọn tất cả trong danh sách đã tải"
                    aria-label="Chọn tất cả"
                  />
                </th>
                <th className="p-3 whitespace-nowrap">Ngày</th>
                <th className="p-3 min-w-[72px]">SP</th>
                <th className="p-3 min-w-[56px]">TT</th>
                <th className="p-3 min-w-[88px]">Page</th>
                <th className="p-3 min-w-[64px]" title="Nội dung trong […] đầu tiên của Page">
                  Mã NV
                </th>
                <th className="p-3 min-w-[80px] whitespace-nowrap">TKQC</th>
                <th className="p-3 whitespace-nowrap">Mã TK</th>
                <th className="p-3 text-right whitespace-nowrap">Data</th>
                <th className="p-3 text-right whitespace-nowrap">Mess</th>
                <th className="p-3 text-right whitespace-nowrap">TLead</th>
                <th className="p-3 text-right whitespace-nowrap">Doanh số</th>
                <th className="p-3 text-right whitespace-nowrap">Ads</th>
                <th className="p-3 text-center whitespace-nowrap">Ads/DT</th>
                <th className="p-3 text-right whitespace-nowrap">Đơn</th>
                <th className="p-3 text-right whitespace-nowrap">Chốt%</th>
                <th className="p-3 whitespace-nowrap">Giờ nhập</th>
                <th className="p-3 w-14" />
              </tr>
            </thead>
            <tbody className="text-xs tabular-nums">
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={18} className="p-12 text-center text-[var(--ld-on-surface-variant)] font-bold leader-dash-label">
                    Không có báo cáo trong khoảng và bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => {
                  const chot = tyLeChot(row);
                  const ads = adsDt(row);
                  const rd = row.report_date?.slice(0, 10) || '';
                  const timeStr = row.created_at
                    ? new Date(row.created_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })
                    : '—';
                  const rowId = row.id?.trim() || '';
                  const canSelect = Boolean(rowId);
                  const bracketTag = extractMaNvFromBracketPage(row.page);
                  const maMatch = bracketTag ? matchEmployeeByBracketTag(bracketTag, maNsLookup) : null;
                  const pill = adsDtPill(row, ads);
                  const spendCls = adsSpendTone(row, ads);

                  return (
                    <tr
                      key={row.id || `${row.report_date}-${idx}`}
                      className="bg-[var(--ld-surface-container)] hover:bg-[var(--ld-surface-container-high)] transition-all group"
                    >
                      <td className="p-3 rounded-l-lg align-middle">
                        <input
                          type="checkbox"
                          className={cb}
                          checked={rowId ? selectedIds.has(rowId) : false}
                          disabled={!reportUser?.email || !canSelect}
                          onChange={() => rowId && toggleSelectOne(rowId)}
                          aria-label="Chọn dòng"
                        />
                      </td>
                      <td className="p-3 font-medium text-[var(--ld-on-surface)] whitespace-nowrap">{formatReportDateVi(rd)}</td>
                      <td className="p-3 max-w-[120px]" title={row.product || ''}>
                        <span className="px-2 py-0.5 bg-[var(--ld-surface-container-highest)] rounded text-[10px] text-[var(--ld-on-surface)] inline-block max-w-full truncate align-middle">
                          {productChip(row.product)}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--ld-on-surface-variant)] max-w-[100px] truncate" title={row.market || ''}>
                        {row.market?.trim() || '—'}
                      </td>
                      <td className="p-3 max-w-[120px] truncate text-[var(--ld-on-surface-variant)]" title={row.page || ''}>
                        {row.page?.trim() || '—'}
                      </td>
                      <td
                        className={`p-3 max-w-[88px] truncate font-mono text-[10px] font-bold ${
                          maMatch ? 'text-[var(--ld-primary)]' : 'text-[var(--ld-on-surface-variant)]'
                        }`}
                        title={
                          maMatch
                            ? `${maMatch.name} · Mã NS: ${maMatch.ma_ns}`
                            : bracketTag
                              ? `Trong Page: [${bracketTag}] — chưa khớp Mã NS`
                              : 'Không có […] đầu trong Page'
                        }
                      >
                        {maMatch ? maMatch.ma_ns : bracketTag || '—'}
                      </td>
                      <td className="p-3 max-w-[100px] truncate font-mono text-[10px] font-bold text-[var(--ld-primary)]" title={row.ma_tkqc || ''}>
                        {row.ma_tkqc?.trim() || '—'}
                      </td>
                      <td className="p-3 text-[var(--ld-on-surface-variant)] whitespace-nowrap" title={row.ad_account || ''}>
                        {truncateAccount(row.ad_account)}
                      </td>
                      <td className="p-3 text-right font-medium text-[var(--ld-on-surface)]">{row.tong_data_nhan ?? '—'}</td>
                      <td className="p-3 text-right text-[var(--ld-on-surface-variant)]">{row.mess_comment_count ?? '—'}</td>
                      <td className="p-3 text-right text-[var(--ld-on-surface)]">{row.tong_lead ?? '—'}</td>
                      <td className="p-3 text-right font-bold text-[var(--ld-primary)]">{formatCompactVnd(row.revenue)}</td>
                      <td className={`p-3 text-right font-medium ${spendCls}`}>{formatCompactVnd(row.ad_cost)}</td>
                      <td className="p-3">
                        <div
                          className={`mx-auto w-16 py-1 rounded text-center font-bold text-[10px] ${pill.box}`}
                        >
                          {pill.label}
                        </div>
                      </td>
                      <td className="p-3 text-right text-[var(--ld-on-surface)]">{row.order_count ?? '—'}</td>
                      <td className="p-3 text-right text-[var(--ld-on-surface-variant)]">
                        {chot != null ? (
                          <span className={chot >= 20 ? 'text-[var(--ld-secondary)] font-semibold' : ''}>{chot.toFixed(1)}%</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 text-[10px] text-[var(--ld-on-surface-variant)] whitespace-nowrap">{timeStr}</td>
                      <td className="p-3 rounded-r-lg text-right">
                        <button
                          type="button"
                          onClick={() => openReport(row)}
                          className="text-[var(--ld-primary)] hover:underline font-bold text-xs"
                        >
                          Mở
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {!loading && rows.length > 0 && (
          <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--ld-outline-variant)]/10">
            <div className="text-[10px] text-[var(--ld-on-surface-variant)] uppercase tracking-widest leader-dash-label">
              Hiển thị {pageFrom}-{pageTo} trong {rows.length} dòng
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 flex items-center justify-center rounded bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-primary)] transition-all disabled:opacity-30"
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
                      className={`w-8 h-8 flex items-center justify-center rounded text-[10px] font-bold transition-all ${
                        item === safePage
                          ? 'bg-[var(--ld-primary)] text-[var(--ld-on-primary-container)]'
                          : 'bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-primary)]'
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
                className="w-8 h-8 flex items-center justify-center rounded bg-[var(--ld-surface-container-highest)] text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-primary)] transition-all disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-6 right-6 md:hidden z-30">
        <button
          type="button"
          onClick={() => navigate(crmAdminPathForView('mkt-report'))}
          className="w-14 h-14 bg-[var(--ld-primary)] text-[var(--ld-on-primary-container)] rounded-full shadow-lg shadow-[color-mix(in_srgb,var(--ld-primary)_20%,transparent)] flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Nhập báo cáo"
        >
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            add
          </span>
        </button>
      </div>
    </div>
  );
};
