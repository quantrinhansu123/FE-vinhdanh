import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Download, Upload } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { AuthUser, ReportRow } from '../../../types';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';
import {
  REPORTS_TABLE,
  toLocalYyyyMmDd,
  formatReportDateVi,
  formatCompactVnd,
} from './mktDetailReportShared';
import { downloadMktReportExcelTemplate, parseMktReportExcelFile } from './mktHistoryExcel';

const PRODUCTS_TABLE = import.meta.env.VITE_SUPABASE_PRODUCTS_TABLE?.trim() || 'crm_products';
const MARKETS_TABLE = import.meta.env.VITE_SUPABASE_MARKETS_TABLE?.trim() || 'crm_markets';

const FILTER_SELECT_CLASS =
  'bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] text-[12px] p-[8px_10px] text-[var(--text)] outline-none focus:border-[var(--accent)] min-w-0 w-full max-w-[280px] [color-scheme:dark]';

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

export type MktHistoryViewProps = {
  reportUser?: AuthUser | null;
};

export const MktHistoryView: React.FC<MktHistoryViewProps> = ({ reportUser = null }) => {
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
  const excelInputRef = useRef<HTMLInputElement>(null);

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

  const handleExcelFile = async (file: File | null) => {
    setExcelMsg(null);
    if (!file?.name) return;
    if (!reportUser?.email?.trim()) {
      window.alert('Cần đăng nhập để nhập Excel.');
      return;
    }
    setExcelBusy(true);
    try {
      const { rows, errors } = await parseMktReportExcelFile(file);
      if (errors.length) {
        const head = errors
          .slice(0, 12)
          .map((e) => `Dòng ${e.row}: ${e.msg}`)
          .join('\n');
        window.alert(`Lỗi đọc file:\n${head}${errors.length > 12 ? `\n… +${errors.length - 12} lỗi` : ''}`);
        return;
      }
      if (rows.length === 0) {
        window.alert('Không có dòng dữ liệu để nhập.');
        return;
      }
      if (!window.confirm(`Nhập ${rows.length} dòng báo cáo vào hệ thống với email ${reportUser.email}?`)) return;

      const email = reportUser.email.trim().toLowerCase();
      const name = (reportUser.name || email).trim() || email;
      const team = reportUser.team?.trim() || null;

      const payloads = rows.map((r) => ({
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
            `Lỗi khi ghi DB (đã nhập ${inserted}/${rows.length} dòng): ${insErr.message || 'Unknown'}`
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

  const summary = useMemo(() => {
    let n = rows.length;
    return n === 0 ? 'Chưa có dòng' : `${n} dòng trong khoảng đã lọc`;
  }, [rows.length]);

  return (
    <div className="dash-fade-up">
      <SectionCard title="📅 Lịch sử báo cáo của tôi" subtitle={summary} bodyPadding={false}>
        <div className="p-[14px_16px] border-b border-[var(--border)] flex flex-col gap-[12px] bg-[var(--bg3)]">
          <div className="flex flex-wrap gap-[10px] items-end">
            <label className="flex flex-col gap-1 min-w-[140px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Từ ngày</span>
              <input
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value || defaultFrom)}
                className="bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] text-[12px] font-[var(--mono)] p-[8px_10px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-[140px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Đến ngày</span>
              <input
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value || defaultTo)}
                className="bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] text-[12px] font-[var(--mono)] p-[8px_10px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[160px] max-w-[280px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Sản phẩm (product)</span>
              <select
                value={draftProduct}
                onChange={(e) => setDraftProduct(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="">— Tất cả —</option>
                {productSelectList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[160px] max-w-[280px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Thị trường (market)</span>
              <select
                value={draftMarket}
                onChange={(e) => setDraftMarket(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="">— Tất cả —</option>
                {marketSelectList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => applyFilters()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--accent)] text-white px-4 py-2 text-[11px] font-black uppercase tracking-wide hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Áp dụng
            </button>
            <button
              type="button"
              onClick={() => navigate(crmAdminPathForView('mkt-report'))}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--text2)] px-3 py-2 text-[11px] font-bold hover:bg-[var(--bg4)]"
            >
              Nhập báo cáo
            </button>
            <button
              type="button"
              onClick={() => handleDownloadExcelTemplate()}
              disabled={excelBusy}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--text2)] px-3 py-2 text-[11px] font-bold hover:bg-[var(--bg4)] disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
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
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#10b981] text-[#34d399] px-3 py-2 text-[11px] font-bold hover:bg-[rgba(16,185,129,0.12)] disabled:opacity-50"
            >
              {excelBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Tải lên Excel
            </button>
          </div>
          {excelMsg && (
            <div className="text-[11px] text-[var(--G)] font-bold bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.25)] rounded-[8px] px-3 py-2">
              {excelMsg}
            </div>
          )}
          <p className="text-[10px] text-[var(--text3)] leading-relaxed max-w-[920px]">
            Excel: cột A = ngày (yyyy-mm-dd), B = SP, C = TT, D = Page, E = TKQC, F = Mã TK, G–L = Chi phí, Mess, Data,
            Doanh số, Đơn, Lead (số). Giữ đúng thứ tự như file mẫu. Khi tải lên, các dòng ghi với{' '}
            <span className="text-[var(--text2)] font-bold">email đang đăng nhập</span>.
          </p>
          {error && <div className="text-[11px] font-bold text-[var(--R)]">{error}</div>}
          {!reportUser?.email && (
            <div className="text-[10px] text-[var(--text3)]">Đăng nhập để xem lịch sử theo email nhân sự.</div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--text3)]">
              <Loader2 className="w-7 h-7 animate-spin opacity-60" />
              <span className="text-[12px] font-bold">Đang tải…</span>
            </div>
          ) : (
            <table className="w-full border-collapse min-w-[1280px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-extrabold tracking-[0.6px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[10px_12px] whitespace-nowrap">Ngày</th>
                  <th className="p-[10px_12px] min-w-[100px]">SP</th>
                  <th className="p-[10px_12px] min-w-[100px]">TT</th>
                  <th className="p-[10px_12px] min-w-[90px]">Page</th>
                  <th className="p-[10px_12px] min-w-[88px] whitespace-nowrap">TKQC</th>
                  <th className="p-[10px_12px] whitespace-nowrap">Mã TK</th>
                  <th className="p-[10px_12px] text-right whitespace-nowrap">Data</th>
                  <th className="p-[10px_12px] text-right whitespace-nowrap">Mess</th>
                  <th className="p-[10px_12px] text-right whitespace-nowrap">TLead</th>
                  <th className="p-[10px_12px] text-right whitespace-nowrap">Doanh số</th>
                  <th className="p-[10px_12px] text-right whitespace-nowrap">Ads</th>
                  <th className="p-[10px_12px] text-right whitespace-nowrap">Ads/DT</th>
                  <th className="p-[10px_12px] text-right whitespace-nowrap">Đơn</th>
                  <th className="p-[10px_12px] text-right whitespace-nowrap">Chốt%</th>
                  <th className="p-[10px_12px] text-center whitespace-nowrap">Giờ nhập</th>
                  <th className="p-[10px_12px] text-center whitespace-nowrap">Sửa</th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)] font-[var(--mono)]">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={16} className="p-10 text-center text-[var(--text3)] font-bold">
                      Không có báo cáo trong khoảng và bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const chot = tyLeChot(row);
                    const ads = adsDt(row);
                    const rd = row.report_date?.slice(0, 10) || '';
                    const timeStr = row.created_at
                      ? new Date(row.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                      : '—';
                    return (
                      <tr
                        key={row.id || `${row.report_date}-${idx}`}
                        className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                      >
                        <td className="p-[10px_12px] text-[var(--text)] font-bold whitespace-nowrap">{formatReportDateVi(rd)}</td>
                        <td className="p-[10px_12px] max-w-[140px] truncate" title={row.product || ''}>
                          {row.product?.trim() || '—'}
                        </td>
                        <td className="p-[10px_12px] max-w-[140px] truncate" title={row.market || ''}>
                          {row.market?.trim() || '—'}
                        </td>
                        <td className="p-[10px_12px] max-w-[120px] truncate text-[var(--text3)]" title={row.page || ''}>
                          {row.page?.trim() || '—'}
                        </td>
                        <td className="p-[10px_12px] max-w-[100px] truncate font-bold text-[var(--accent)]" title={row.ma_tkqc || ''}>
                          {row.ma_tkqc?.trim() || '—'}
                        </td>
                        <td className="p-[10px_12px] whitespace-nowrap">{row.ad_account?.trim() || '—'}</td>
                        <td className="p-[10px_12px] text-right">{row.tong_data_nhan ?? '—'}</td>
                        <td className="p-[10px_12px] text-right">{row.mess_comment_count ?? '—'}</td>
                        <td className="p-[10px_12px] text-right">{row.tong_lead ?? '—'}</td>
                        <td className="p-[10px_12px] text-right font-bold text-[var(--text)]">
                          {formatCompactVnd(row.revenue)}
                        </td>
                        <td className="p-[10px_12px] text-right">{formatCompactVnd(row.ad_cost)}</td>
                        <td className="p-[10px_12px] text-right">
                          {ads != null ? (
                            <Badge type={ads < 35 ? 'G' : ads < 45 ? 'Y' : 'R'}>{`${ads.toFixed(1)}%`}</Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-[10px_12px] text-right">{row.order_count ?? '—'}</td>
                        <td className="p-[10px_12px] text-right">
                          {chot != null ? <span className={chot >= 20 ? 'text-[var(--G)]' : ''}>{chot.toFixed(1)}%</span> : '—'}
                        </td>
                        <td className="p-[10px_12px] text-center text-[var(--text3)] text-[11px]">{timeStr}</td>
                        <td className="p-[10px_12px] text-center">
                          <button
                            type="button"
                            onClick={() => openReport(row)}
                            className="text-[10px] font-bold text-[var(--accent)] hover:underline"
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
        </div>
      </SectionCard>
    </div>
  );
};
