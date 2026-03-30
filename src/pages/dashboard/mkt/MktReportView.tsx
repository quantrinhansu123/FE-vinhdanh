import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, Loader2, Plus } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { AuthUser, ReportRow } from '../../../types';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';
import {
  REPORTS_TABLE,
  toLocalYyyyMmDd,
  formatReportDateVi,
  parseIntVi,
  formatIntVi,
  formatKpiMoney,
  formatTypingGroupedInt,
  formatNumberDots,
} from './mktDetailReportShared';

const PRODUCTS_TABLE = import.meta.env.VITE_SUPABASE_PRODUCTS_TABLE?.trim() || 'crm_products';
const MARKETS_TABLE = import.meta.env.VITE_SUPABASE_MARKETS_TABLE?.trim() || 'crm_markets';

type CatalogProduct = { ma_san_pham: string; ten_san_pham: string };
type CatalogMarket = { ma_thi_truong: string; ten_thi_truong: string };

function initialReportDateFromUrl(): string {
  const d =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('date')?.trim() : '';
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return toLocalYyyyMmDd(new Date());
}

function initialDraftLineIdFromUrl(): string | null {
  const id =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id')?.trim() : '';
  return id || null;
}

export type MktReportViewProps = {
  reportUser?: AuthUser | null;
};

export const MktReportView: React.FC<MktReportViewProps> = ({ reportUser = null }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [dayRows, setDayRows] = useState<ReportRow[]>([]);
  /** null = đang nhập dòng mới; uuid = sửa dòng đó */
  const [draftLineId, setDraftLineId] = useState<string | null>(initialDraftLineIdFromUrl);
  const [reportId, setReportId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [reportDateStr, setReportDateStr] = useState(initialReportDateFromUrl);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogMarkets, setCatalogMarkets] = useState<CatalogMarket[]>([]);
  const [catalogErr, setCatalogErr] = useState<string | null>(null);

  const [adAccount, setAdAccount] = useState('');
  const [maTkqcStr, setMaTkqcStr] = useState('');
  const [pageStr, setPageStr] = useState('');
  const [product, setProduct] = useState('');
  const [market, setMarket] = useState('');
  const [adCostStr, setAdCostStr] = useState('');
  const [messStr, setMessStr] = useState('');
  const [tongDataStr, setTongDataStr] = useState('');
  const [revenueStr, setRevenueStr] = useState('');
  const [orderStr, setOrderStr] = useState('');
  const [tongLeadStr, setTongLeadStr] = useState('');

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!saveMsg) return;
    const t = window.setTimeout(() => setSaveMsg(null), 4500);
    return () => window.clearTimeout(t);
  }, [saveMsg]);

  useEffect(() => {
    const d = searchParams.get('date')?.trim();
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setReportDateStr(d);
  }, [searchParams]);

  /** Đồng bộ ?id= khi mở từ Lịch sử / đổi query (component có thể không remount). */
  useEffect(() => {
    const id = searchParams.get('id')?.trim() || null;
    setDraftLineId((prev) => (prev === id ? prev : id));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setCatalogErr(null);
    void (async () => {
      const [pRes, mRes] = await Promise.all([
        supabase
          .from(PRODUCTS_TABLE)
          .select('ma_san_pham, ten_san_pham')
          .eq('trang_thai', 'dang_ban')
          .order('ten_san_pham', { ascending: true }),
        supabase
          .from(MARKETS_TABLE)
          .select('ma_thi_truong, ten_thi_truong')
          .eq('trang_thai', 'hoat_dong')
          .order('ten_thi_truong', { ascending: true }),
      ]);
      if (cancelled) return;
      let missingTbl: string | null = null;
      if (pRes.error) {
        console.warn('mkt-report products catalog:', pRes.error);
        setCatalogProducts([]);
        if (pRes.error.message?.includes('does not exist') || pRes.error.message?.includes('schema cache')) {
          missingTbl = PRODUCTS_TABLE;
        }
      } else {
        setCatalogProducts((pRes.data || []) as CatalogProduct[]);
      }
      if (mRes.error) {
        console.warn('mkt-report markets catalog:', mRes.error);
        setCatalogMarkets([]);
        if (mRes.error.message?.includes('does not exist') || mRes.error.message?.includes('schema cache')) {
          missingTbl = missingTbl ? `${missingTbl}, ${MARKETS_TABLE}` : MARKETS_TABLE;
        }
      } else {
        setCatalogMarkets((mRes.data || []) as CatalogMarket[]);
      }
      setCatalogErr(
        missingTbl
          ? `Thiếu bảng: ${missingTbl}. Admin chạy supabase/create_crm_products.sql và/hoặc create_crm_markets.sql.`
          : null
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productSelectOptions = useMemo(() => {
    const opts = catalogProducts.map((r) => ({
      value: r.ten_san_pham,
      label: [r.ma_san_pham, r.ten_san_pham].filter(Boolean).join(' · '),
    }));
    const t = product.trim();
    if (t && !opts.some((o) => o.value === t)) {
      opts.unshift({ value: t, label: `${t} (không trong danh mục)` });
    }
    return opts;
  }, [catalogProducts, product]);

  const marketSelectOptions = useMemo(() => {
    const opts = catalogMarkets.map((r) => ({
      value: r.ten_thi_truong,
      label: [r.ma_thi_truong, r.ten_thi_truong].filter(Boolean).join(' · '),
    }));
    const t = market.trim();
    if (t && !opts.some((o) => o.value === t)) {
      opts.unshift({ value: t, label: `${t} (không trong danh mục)` });
    }
    return opts;
  }, [catalogMarkets, market]);

  const applyRow = useCallback((row: ReportRow | null) => {
    if (!row) {
      setReportId(null);
      setUpdatedAt(null);
      setAdAccount('');
      setMaTkqcStr('');
      setPageStr('');
      setProduct('');
      setMarket('');
      setAdCostStr('');
      setMessStr('');
      setTongDataStr('');
      setRevenueStr('');
      setOrderStr('');
      setTongLeadStr('');
      return;
    }
    setReportId(row.id ?? null);
    setUpdatedAt(row.created_at ?? null);
    setAdAccount(row.ad_account?.trim() || '');
    setMaTkqcStr(row.ma_tkqc?.trim() || '');
    setPageStr(row.page?.trim() || '');
    setProduct(row.product?.trim() || '');
    setMarket(row.market?.trim() || '');
    setAdCostStr(formatIntVi(row.ad_cost));
    setMessStr(formatIntVi(row.mess_comment_count));
    setTongDataStr(formatIntVi(row.tong_data_nhan));
    setRevenueStr(formatIntVi(row.revenue));
    setOrderStr(formatIntVi(row.order_count));
    setTongLeadStr(formatIntVi(row.tong_lead));
  }, []);

  const loadReport = useCallback(
    async (options?: { silent?: boolean }): Promise<ReportRow[]> => {
      const silent = options?.silent === true;
      if (!reportUser?.email?.trim()) {
        setDayRows([]);
        applyRow(null);
        setLoading(false);
        setLoadErr(null);
        return [];
      }
      if (!silent) setLoading(true);
      setLoadErr(null);
      const email = reportUser.email.trim().toLowerCase();
      const { data: rows, error } = await supabase
        .from(REPORTS_TABLE)
        .select('*')
        .ilike('email', email)
        .eq('report_date', reportDateStr)
        .order('created_at', { ascending: false })
        .limit(200);

      let list: ReportRow[] = [];
      if (error) {
        console.error('mkt-report load:', error);
        const msg = error.message || 'Không tải được báo cáo.';
        setLoadErr(
          msg.includes('tong_')
            ? `${msg} — Chạy supabase/alter_detail_reports_mkt_form.sql nếu thiếu cột.`
            : msg.includes('ma_tkqc') || (msg.includes('column') && msg.toLowerCase().includes('ma_tkqc'))
              ? `${msg} — Chạy supabase/alter_detail_reports_ma_tkqc.sql.`
              : msg.includes('page') || msg.includes('column')
                ? `${msg} — Chạy supabase/alter_detail_reports_page_multiline.sql (cột page).`
                : msg
        );
        setDayRows([]);
      } else {
        list = (rows || []) as ReportRow[];
        setDayRows(list);
      }
      if (!silent) setLoading(false);
      return list;
    },
    [applyRow, reportUser?.email, reportDateStr]
  );

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (loading || !draftLineId || !reportUser?.email?.trim()) return;
    const row = dayRows.find((r) => r.id === draftLineId);
    if (row) applyRow(row);
    else {
      setDraftLineId(null);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete('id');
          return p;
        },
        { replace: true }
      );
      applyRow(null);
    }
  }, [loading, draftLineId, dayRows, reportUser?.email, applyRow, setSearchParams]);

  const setDateAndUrl = (iso: string) => {
    setReportDateStr(iso);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('date', iso);
        p.delete('id');
        return p;
      },
      { replace: true }
    );
    setDraftLineId(null);
    applyRow(null);
  };

  const selectLine = (id: string | null) => {
    setDraftLineId(id);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('date', reportDateStr);
        if (id) p.set('id', id);
        else p.delete('id');
        return p;
      },
      { replace: true }
    );
    if (id) {
      const row = dayRows.find((r) => r.id === id);
      if (row) applyRow(row);
    } else {
      applyRow(null);
    }
  };

  const startNewLine = () => selectLine(null);

  const adCost = parseIntVi(adCostStr);
  const mess = parseIntVi(messStr);
  const tongData = parseIntVi(tongDataStr);
  const revenue = parseIntVi(revenueStr);
  const orders = parseIntVi(orderStr);
  const tongLead = parseIntVi(tongLeadStr);

  const dataChuaChot = Math.max(0, tongData - orders);
  const tyLeChotPct =
    tongData > 0 ? (orders / tongData) * 100 : tongLead > 0 ? (orders / tongLead) * 100 : null;
  const tyLeXinSoPct = tongData > 0 && tongLead > 0 ? (tongLead / tongData) * 100 : null;
  const adsDsPct = revenue > 0 ? (adCost / revenue) * 100 : null;
  const aov = orders > 0 ? revenue / orders : null;
  const cpo = orders > 0 ? adCost / orders : null;
  const cplDenom = tongLead > 0 ? tongLead : mess > 0 ? mess : 0;
  const cpl = cplDenom > 0 ? adCost / cplDenom : null;

  const todayStr = toLocalYyyyMmDd(new Date());
  const isPastDate = reportDateStr < todayStr;

  const buildPayload = useCallback(() => {
    const email = reportUser?.email?.trim().toLowerCase() || '';
    const name = (reportUser?.name || email).trim() || email;
    return {
      name,
      email,
      report_date: reportDateStr,
      team: reportUser?.team?.trim() || null,
      ad_account: adAccount.trim() || null,
      ma_tkqc: maTkqcStr.trim() || null,
      page: pageStr.trim() || null,
      product: product.trim() || null,
      market: market.trim() || null,
      ad_cost: adCost,
      mess_comment_count: mess,
      revenue,
      order_count: orders,
      tong_data_nhan: tongData,
      tong_lead: tongLead,
    };
  }, [
    reportUser?.email,
    reportUser?.name,
    reportUser?.team,
    reportDateStr,
    adAccount,
    maTkqcStr,
    pageStr,
    product,
    market,
    adCost,
    mess,
    revenue,
    orders,
    tongData,
    tongLead,
  ]);

  const persistReport = useCallback(
    async (opts?: { orderOnly?: boolean }) => {
      if (!reportUser?.email?.trim()) {
        window.alert('Cần đăng nhập để lưu báo cáo.');
        return;
      }
      setSaveMsg(null);
      if (opts?.orderOnly) setSyncing(true);
      else setSaving(true);
      try {
        const email = reportUser.email.trim().toLowerCase();
        const name = (reportUser.name || email).trim() || email;
        if (opts?.orderOnly) {
          const n = orders;
          const targetId = draftLineId || dayRows[0]?.id;
          if (targetId) {
            const { error: upErr } = await supabase.from(REPORTS_TABLE).update({ order_count: n }).eq('id', targetId);
            if (upErr) throw upErr;
            setSaveMsg('Đã cập nhật số đơn TT.');
          } else {
            const { error: insErr } = await supabase.from(REPORTS_TABLE).insert({
              name,
              email,
              report_date: reportDateStr,
              order_count: n,
              team: reportUser.team?.trim() || null,
            });
            if (insErr) throw insErr;
            setSaveMsg('Đã tạo báo cáo mới với số đơn TT.');
          }
          const fresh = await loadReport({ silent: true });
          let tid: string | undefined = (draftLineId || dayRows[0]?.id) ?? undefined;
          if (!tid && fresh.length > 0) tid = fresh[0].id;
          if (tid) {
            const r = fresh.find((x) => x.id === tid);
            if (r) applyRow(r);
          }
          return;
        }

        const payload = buildPayload();
        if (draftLineId) {
          const { error: upErr } = await supabase.from(REPORTS_TABLE).update(payload).eq('id', draftLineId);
          if (upErr) throw upErr;
          setSaveMsg(`Đã cập nhật dòng báo cáo · ${formatReportDateVi(reportDateStr)}.`);
          const fresh = await loadReport({ silent: true });
          const r = fresh.find((x) => x.id === draftLineId);
          if (r) applyRow(r);
        } else {
          const { error: insErr } = await supabase.from(REPORTS_TABLE).insert(payload);
          if (insErr) throw insErr;
          setSaveMsg(`Đã thêm dòng mới · ${formatReportDateVi(reportDateStr)}.`);
          await loadReport({ silent: true });
          selectLine(null);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không lưu được.';
        setSaveMsg(
          msg.includes('tong_')
            ? `${msg} — Chạy supabase/alter_detail_reports_mkt_form.sql.`
            : msg.includes('unique') && msg.includes('detail_reports')
              ? `${msg} — Chạy supabase/alter_detail_reports_page_multiline.sql để cho nhiều dòng/ngày.`
              : msg.includes('ma_tkqc') || (msg.includes('column') && msg.toLowerCase().includes('ma_tkqc'))
                ? `${msg} — Chạy supabase/alter_detail_reports_ma_tkqc.sql.`
                : msg.includes('page') || (msg.includes('column') && msg.includes('schema'))
                  ? `${msg} — Chạy supabase/alter_detail_reports_page_multiline.sql.`
                  : msg
        );
      } finally {
        if (opts?.orderOnly) setSyncing(false);
        else setSaving(false);
      }
    },
    [
      buildPayload,
      loadReport,
      orders,
      reportUser,
      reportDateStr,
      draftLineId,
      dayRows,
      applyRow,
      selectLine,
    ]
  );

  const handleCapNhatSoDonTT = () => void persistReport({ orderOnly: true });

  const subtitleParts = [
    reportUser?.name,
    reportUser?.team,
    `${dayRows.length} dòng trong ngày`,
    draftLineId ? 'Đang sửa dòng đã lưu' : 'Dòng mới (lưu để ghi DB)',
    product.trim() || undefined,
    pageStr.trim() || undefined,
    updatedAt
      ? `Cập nhật: ${new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
      : null,
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="dash-fade-up max-w-[700px] mx-auto flex flex-col items-center justify-center min-h-[200px] gap-3 text-[var(--text3)]">
        <Loader2 className="w-8 h-8 animate-spin opacity-60" />
        <span className="text-[12px] font-bold">Đang tải báo cáo từ Supabase…</span>
      </div>
    );
  }

  return (
    <div className="dash-fade-up max-w-[700px] mx-auto">
      <SectionCard
        title={`✏️ Module 7 — Báo cáo · ${formatReportDateVi(reportDateStr)}`}
        subtitle={subtitleParts.join(' · ')}
        badge={{
          text: draftLineId ? `✓ Dòng đã lưu (${dayRows.length} trong ngày)` : `➕ Dòng mới · ${dayRows.length} dòng đã có`,
          type: draftLineId ? 'G' : 'Y',
        }}
      >
        {(loadErr || catalogErr) && (
          <div className="bg-[rgba(224,61,61,0.1)] border border-[var(--R)] rounded-[8px] p-[10px_13px] mb-[14px] text-[11px] text-[var(--R)] space-y-1">
            {loadErr ? <div>{loadErr}</div> : null}
            {catalogErr ? <div>{catalogErr}</div> : null}
          </div>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap gap-[10px] mb-[14px] p-[12px] bg-[var(--bg3)] border border-[var(--border)] rounded-[10px]">
          <label className="flex flex-col gap-1 min-w-[160px] flex-1">
            <span className="text-[9px] font-extrabold uppercase text-[var(--text3)] tracking-wide">Ngày báo cáo</span>
            <input
              type="date"
              value={reportDateStr}
              onChange={(e) => setDateAndUrl(e.target.value || toLocalYyyyMmDd(new Date()))}
              className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] text-[13px] font-[var(--mono)] p-[8px_10px] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setReportDateStr(todayStr)}
              className="text-[10px] font-bold px-3 py-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg4)] text-[var(--text2)] hover:bg-[var(--bg2)]"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => void loadReport()}
              className="text-[10px] font-bold px-3 py-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg4)] text-[var(--text2)] hover:bg-[var(--bg2)]"
            >
              Tải lại
            </button>
            <button
              type="button"
              onClick={() => navigate(crmAdminPathForView('mkt-history'))}
              className="text-[10px] font-bold px-3 py-2 rounded-[8px] border border-[var(--accent)] text-[var(--accent)] hover:bg-[rgba(61,142,240,0.08)]"
            >
              Lịch sử
            </button>
          </div>
          {isPastDate && (
            <p className="w-full text-[10px] text-[var(--Y)] font-bold mt-[-4px]">
              Đang sửa ngày trong quá khứ — Lưu sẽ cập nhật đúng dòng {reportDateStr}.
            </p>
          )}
        </div>

        <div className="bg-[var(--bg3)] border border-[var(--Yb)] rounded-[8px] p-[10px_13px] mb-[14px] text-[11px] text-[var(--Y)]">
          ⚠ Nhiều dòng / ngày / email trong <code className="text-[10px]">{REPORTS_TABLE}</code> — cần chạy{' '}
          <code className="text-[10px]">alter_detail_reports_page_multiline.sql</code>. SP/TT từ{' '}
          <code className="text-[10px]">{PRODUCTS_TABLE}</code> / <code className="text-[10px]">{MARKETS_TABLE}</code> (lưu{' '}
          <strong>tên</strong> vào <code className="text-[10px]">product</code> / <code className="text-[10px]">market</code>). Cột{' '}
          <code className="text-[10px]">page</code> (Page), <code className="text-[10px]">ma_tkqc</code> (TKQC). Migration:{' '}
          <code className="text-[10px]">alter_detail_reports_ma_tkqc.sql</code>.
        </div>

        {reportUser?.email && (
          <div className="mb-[14px] flex flex-col gap-[8px]">
            <div className="flex flex-wrap items-center justify-between gap-[10px]">
              <span className="text-[10px] font-extrabold uppercase text-[var(--text3)] tracking-wide">
                Dòng báo cáo trong ngày ({dayRows.length})
              </span>
              <button
                type="button"
                onClick={() => startNewLine()}
                className="inline-flex items-center gap-[6px] text-[10px] font-bold px-3 py-2 rounded-[8px] bg-[#10b981] text-white hover:brightness-110"
              >
                <Plus size={14} />
                Thêm dòng mới
              </button>
            </div>
            {dayRows.length > 0 ? (
              <div className="flex flex-wrap gap-[6px]">
                {dayRows.map((r) => {
                  const active = draftLineId === r.id;
                  const label =
                    [r.product, r.ma_tkqc, r.ad_account, r.page].filter(Boolean).join(' · ') || r.id?.slice(0, 8) || '—';
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => selectLine(r.id || null)}
                      className={`max-w-[220px] truncate text-[10px] font-bold px-2 py-1.5 rounded-[6px] border transition-all ${
                        active
                          ? 'border-[var(--accent)] bg-[rgba(61,142,240,0.15)] text-[var(--accent)]'
                          : 'border-[var(--border)] bg-[var(--bg4)] text-[var(--text2)] hover:bg-[var(--bg2)]'
                      }`}
                      title={label}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
              !loading && (
                <p className="text-[10px] text-[var(--text3)]">Chưa có dòng nào — điền form và bấm Lưu, hoặc Thêm dòng mới.</p>
              )
            )}
          </div>
        )}

        <div className="flex flex-col gap-[10px] mb-[20px]">
          <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] p-[14px_16px] flex flex-col sm:flex-row sm:items-center gap-[12px]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-[12px] flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row gap-[10px] shrink-0 w-full sm:w-auto">
                <label className="font-[var(--mono)] text-[11px] text-[var(--accent)] font-extrabold w-full sm:w-[100px] shrink-0">
                  <span className="text-[9px] text-[var(--text3)] block uppercase mb-1">TKQC</span>
                  <input
                    value={maTkqcStr}
                    onChange={(e) => setMaTkqcStr(e.target.value)}
                    placeholder="VD: QC-A01"
                    className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] font-[var(--mono)] text-[11px] p-[7px_10px] outline-none focus:border-[var(--accent)]"
                  />
                  <span className="text-[8px] text-[var(--text3)] block mt-1">ma_tkqc</span>
                </label>
                <label className="font-[var(--mono)] text-[11px] text-[var(--accent)] font-extrabold w-full sm:w-[100px] shrink-0">
                  <span className="text-[9px] text-[var(--text3)] block uppercase mb-1">Mã TK</span>
                  <input
                    value={adAccount}
                    onChange={(e) => setAdAccount(e.target.value)}
                    placeholder="VD: TK-001"
                    className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] font-[var(--mono)] text-[11px] p-[7px_10px] outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>
              <div className="flex-1 min-w-0 space-y-[10px]">
                <label className="block space-y-1">
                  <span className="text-[10px] text-[var(--text3)] uppercase font-bold">Sản phẩm → product</span>
                  <select
                    value={productSelectOptions.some((o) => o.value === product) ? product : ''}
                    onChange={(e) => setProduct(e.target.value)}
                    className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[12px] font-bold text-[var(--text)] p-[7px_10px] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">— Chọn sản phẩm —</option>
                    {productSelectOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] text-[var(--text3)] uppercase font-bold">Thị trường → market</span>
                  <select
                    value={marketSelectOptions.some((o) => o.value === market) ? market : ''}
                    onChange={(e) => setMarket(e.target.value)}
                    className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[12px] font-bold text-[var(--text)] p-[7px_10px] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">— Chọn thị trường —</option>
                    {marketSelectOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] text-[var(--text3)] uppercase font-bold">Page → page</span>
                  <input
                    value={pageStr}
                    onChange={(e) => setPageStr(e.target.value)}
                    placeholder="VD: Fanpage ABC · FB"
                    className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[12px] font-bold text-[var(--text)] p-[7px_10px] outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-[12px] shrink-0 flex-wrap">
              <div className="text-right">
                <div className="text-[9px] text-[var(--text3)] mb-[4px] uppercase font-bold tracking-[0.5px]">Chi phí (VNĐ)</div>
                <input
                  inputMode="numeric"
                  value={adCostStr}
                  onChange={(e) => setAdCostStr(formatTypingGroupedInt(e.target.value))}
                  placeholder="0"
                  className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] font-[var(--mono)] text-[12px] p-[7px_12px] outline-none w-[120px] text-right focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all"
                />
                <div className="text-[8px] text-[var(--text3)] mt-1">ad_cost</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-[var(--text3)] mb-[4px] uppercase font-bold tracking-[0.5px]">Số mess</div>
                <input
                  inputMode="numeric"
                  value={messStr}
                  onChange={(e) => setMessStr(formatTypingGroupedInt(e.target.value))}
                  placeholder="0"
                  className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] font-[var(--mono)] text-[12px] p-[7px_12px] outline-none w-[100px] text-right focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all"
                />
                <div className="text-[8px] text-[var(--text3)] mt-1">mess_comment_count</div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-[1px] bg-[var(--border)] my-[12px]" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-[12px] gap-y-[14px]">
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">
              Tổng data nhận → tong_data_nhan
            </div>
            <input
              inputMode="numeric"
              value={tongDataStr}
              onChange={(e) => setTongDataStr(formatTypingGroupedInt(e.target.value))}
              placeholder="0"
              className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full"
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">
              Doanh số chốt (VNĐ) → revenue
            </div>
            <input
              inputMode="numeric"
              value={revenueStr}
              onChange={(e) => setRevenueStr(formatTypingGroupedInt(e.target.value))}
              placeholder="0"
              className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full"
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">
              Số đơn chốt → order_count
            </div>
            <input
              inputMode="numeric"
              value={orderStr}
              onChange={(e) => setOrderStr(formatTypingGroupedInt(e.target.value))}
              placeholder="0"
              className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full"
            />
          </div>

          <div className="md:col-span-3 flex flex-col sm:flex-row gap-[12px] sm:items-end pt-[4px]">
            <label className="flex flex-col gap-[6px] flex-1 min-w-0">
              <span className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">
                Số đơn thanh toán (TT) — <code className="text-[9px] normal-case">order_count</code>
              </span>
              <input
                inputMode="numeric"
                value={orderStr}
                onChange={(e) => setOrderStr(formatTypingGroupedInt(e.target.value))}
                placeholder="Trùng với số đơn chốt nếu cùng nghiệp vụ"
                className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleCapNhatSoDonTT()}
              disabled={syncing || saving || !reportUser?.email}
              className="shrink-0 flex items-center justify-center gap-[8px] bg-[#3d8ef0] hover:bg-[#2e7dd1] disabled:opacity-50 text-white py-[11px] px-[18px] rounded-[10px] text-[13px] font-black shadow-lg shadow-[rgba(61,142,240,0.3)] transition-all whitespace-nowrap"
            >
              {syncing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Cập nhật Số đơn TT
            </button>
          </div>
          {saveMsg && (
            <div className="md:col-span-3 text-[11px] text-[var(--text2)] bg-[rgba(61,142,240,0.08)] border border-[rgba(61,142,240,0.2)] rounded-[8px] px-3 py-2">
              {saveMsg}
            </div>
          )}
          {!reportUser?.email && (
            <div className="md:col-span-3 text-[10px] text-[var(--text3)]">
              Đăng nhập qua CRM để đồng bộ (email nhân sự + ngày báo cáo).
            </div>
          )}
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">
              Tổng Lead → tong_lead
            </div>
            <input
              inputMode="numeric"
              value={tongLeadStr}
              onChange={(e) => setTongLeadStr(formatTypingGroupedInt(e.target.value))}
              placeholder="0"
              className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full"
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">Số data chưa chốt</div>
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] w-full">
              {tongData > 0 || orders > 0 ? formatNumberDots(dataChuaChot, false) : '—'}
            </div>
            <div className="text-[8px] text-[var(--text3)]">max(0, tong_data_nhan − order_count)</div>
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">Tỷ lệ chốt</div>
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--G)] font-[var(--mono)] text-[13px] font-bold p-[10px_14px] w-full flex items-center">
              {tyLeChotPct != null && Number.isFinite(tyLeChotPct) ? `${tyLeChotPct.toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>

        <div className="h-[1px] bg-[var(--border)] my-[12px]" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-[10px] mt-[12px]">
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">Ads / Doanh số</div>
            <div className={`text-[16px] font-bold font-[var(--mono)] ${adsDsPct != null && adsDsPct <= 35 ? 'text-[var(--G)]' : 'text-[var(--text)]'}`}>
              {adsDsPct != null ? `${adsDsPct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">Tỷ lệ xin số</div>
            <div className="text-[16px] font-bold text-[var(--text)] font-[var(--mono)]">
              {tyLeXinSoPct != null ? `${tyLeXinSoPct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">Tỷ lệ chốt</div>
            <div className="text-[16px] font-bold text-[var(--G)] font-[var(--mono)]">
              {tyLeChotPct != null ? `${tyLeChotPct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">AOV</div>
            <div className="text-[16px] font-bold text-[var(--text)] font-[var(--mono)]">{formatKpiMoney(aov ?? 0)}</div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">CPO</div>
            <div className="text-[16px] font-bold text-[var(--text)] font-[var(--mono)]">{formatKpiMoney(cpo ?? 0)}</div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">CPL</div>
            <div className="text-[16px] font-bold text-[var(--text)] font-[var(--mono)]">{formatKpiMoney(cpl ?? 0)}</div>
          </div>
        </div>

        <div className="mt-[24px] flex gap-[12px] flex-wrap">
          <button
            type="button"
            disabled={saving || syncing || !reportUser?.email}
            onClick={() => void persistReport()}
            className="bg-[var(--accent)] text-[#fff] flex-1 min-w-[140px] py-[11px] rounded-[10px] text-[13px] font-black flex items-center justify-center gap-[8px] shadow-lg shadow-[rgba(61,142,240,0.3)] hover:brightness-110 active:scale-[0.98] transition-all whitespace-nowrap disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : '💾'}
            {draftLineId ? 'Lưu dòng này' : 'Thêm & lưu dòng'}
          </button>
          <button
            type="button"
            onClick={() => navigate(crmAdminPathForView('mkt-bill'))}
            className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] flex-1 min-w-[140px] py-[10px] rounded-[10px] text-[13px] font-extrabold flex items-center justify-center gap-[6px] hover:bg-[var(--bg4)] transition-all"
          >
            📋 Xem bill
          </button>
        </div>
      </SectionCard>
    </div>
  );
};
