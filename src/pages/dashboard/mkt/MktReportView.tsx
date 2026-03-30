import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Loader2 } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { AuthUser, ReportRow } from '../../../types';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';

const REPORTS_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

function toLocalYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIntVi(raw: string): number {
  const t = raw.replace(/\./g, '').replace(/\s/g, '');
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function formatIntVi(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) === 0) return '';
  return Math.round(Number(n)).toLocaleString('vi-VN');
}

/** AOV/CPO/CPL: gọn kiểu 1.127M / 171k */
function formatKpiMoney(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, '')}M`;
  }
  return `${Math.round(n / 1_000)}k`;
}

export type MktReportViewProps = {
  reportUser?: AuthUser | null;
};

export const MktReportView: React.FC<MktReportViewProps> = ({ reportUser = null }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [adAccount, setAdAccount] = useState('');
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

  const todayStr = useMemo(() => toLocalYyyyMmDd(new Date()), []);
  const titleDate = useMemo(
    () =>
      new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    []
  );

  const applyRow = useCallback((row: ReportRow | null) => {
    if (!row) {
      setReportId(null);
      setUpdatedAt(null);
      setAdAccount('');
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
    setProduct(row.product?.trim() || '');
    setMarket(row.market?.trim() || '');
    setAdCostStr(formatIntVi(row.ad_cost));
    setMessStr(formatIntVi(row.mess_comment_count));
    setTongDataStr(formatIntVi(row.tong_data_nhan));
    setRevenueStr(formatIntVi(row.revenue));
    setOrderStr(formatIntVi(row.order_count));
    setTongLeadStr(formatIntVi(row.tong_lead));
  }, []);

  const loadReport = useCallback(async () => {
    if (!reportUser?.email?.trim()) {
      applyRow(null);
      setLoading(false);
      setLoadErr(null);
      return;
    }
    setLoading(true);
    setLoadErr(null);
    const email = reportUser.email.trim().toLowerCase();
    const { data: rows, error } = await supabase
      .from(REPORTS_TABLE)
      .select('*')
      .ilike('email', email)
      .eq('report_date', todayStr)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('mkt-report load:', error);
      setLoadErr(
        error.message?.includes('tong_')
          ? `${error.message} — Chạy supabase/alter_detail_reports_mkt_form.sql nếu thiếu cột.`
          : error.message || 'Không tải được báo cáo.'
      );
      applyRow(null);
    } else {
      const row = (rows?.[0] as ReportRow | undefined) ?? null;
      applyRow(row);
    }
    setLoading(false);
  }, [applyRow, reportUser?.email, todayStr]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

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

  const buildPayload = useCallback(() => {
    const email = reportUser?.email?.trim().toLowerCase() || '';
    const name = (reportUser?.name || email).trim() || email;
    return {
      name,
      email,
      report_date: todayStr,
      team: reportUser?.team?.trim() || null,
      ad_account: adAccount.trim() || null,
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
    todayStr,
    adAccount,
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
        const { data: existingRows, error: selErr } = await supabase
          .from(REPORTS_TABLE)
          .select('id')
          .ilike('email', email)
          .eq('report_date', todayStr)
          .order('created_at', { ascending: false })
          .limit(1);
        if (selErr) throw selErr;
        const existingId = existingRows?.[0]?.id as string | undefined;

        if (opts?.orderOnly) {
          const n = orders;
          if (existingId) {
            const { error: upErr } = await supabase
              .from(REPORTS_TABLE)
              .update({ order_count: n })
              .eq('id', existingId);
            if (upErr) throw upErr;
            setSaveMsg('Đã cập nhật số đơn TT.');
          } else {
            const { error: insErr } = await supabase.from(REPORTS_TABLE).insert({
              name,
              email,
              report_date: todayStr,
              order_count: n,
              team: reportUser.team?.trim() || null,
            });
            if (insErr) throw insErr;
            setSaveMsg('Đã tạo báo cáo mới với số đơn TT.');
          }
          await loadReport();
          return;
        }

        const payload = buildPayload();
        if (existingId) {
          const { error: upErr } = await supabase.from(REPORTS_TABLE).update(payload).eq('id', existingId);
          if (upErr) throw upErr;
          setSaveMsg('Đã lưu báo cáo hôm nay.');
        } else {
          const { error: insErr } = await supabase.from(REPORTS_TABLE).insert(payload);
          if (insErr) throw insErr;
          setSaveMsg('Đã tạo và lưu báo cáo hôm nay.');
        }
        await loadReport();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không lưu được.';
        setSaveMsg(
          msg.includes('tong_') ? `${msg} — Chạy supabase/alter_detail_reports_mkt_form.sql.` : msg
        );
      } finally {
        if (opts?.orderOnly) setSyncing(false);
        else setSaving(false);
      }
    },
    [buildPayload, loadReport, orders, reportUser, todayStr]
  );

  const handleCapNhatSoDonTT = () => void persistReport({ orderOnly: true });

  const subtitleParts = [
    reportUser?.name,
    reportUser?.team,
    product.trim() || undefined,
    updatedAt
      ? `Cập nhật: ${new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
      : 'Chưa có bản ghi hôm nay',
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
        title={`✏️ Module 7 — Nhập báo cáo hôm nay · ${titleDate}`}
        subtitle={subtitleParts.join(' · ')}
        badge={{ text: reportId ? '✓ Đã có bản ghi' : '⏳ Chưa có bản ghi', type: reportId ? 'G' : 'Y' }}
      >
        {loadErr && (
          <div className="bg-[rgba(224,61,61,0.1)] border border-[var(--R)] rounded-[8px] p-[10px_13px] mb-[14px] text-[11px] text-[var(--R)]">
            {loadErr}
          </div>
        )}

        <div className="bg-[var(--bg3)] border border-[var(--Yb)] rounded-[8px] p-[10px_13px] mb-[14px] text-[11px] text-[var(--Y)]">
          ⚠ Nguyên tắc: Một email — một ngày — một dòng trong <code className="text-[10px]">{REPORTS_TABLE}</code>
          (theo index email + ngày). Lưu sẽ cập nhật dòng đó hoặc tạo mới.
        </div>

        <div className="flex flex-col gap-[10px] mb-[20px]">
          <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] p-[14px_16px] flex flex-col sm:flex-row sm:items-center gap-[12px]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-[12px] flex-1 min-w-0">
              <label className="font-[var(--mono)] text-[11px] text-[var(--accent)] font-extrabold w-full sm:w-[100px] shrink-0">
                <span className="text-[9px] text-[var(--text3)] block uppercase mb-1">Mã TK</span>
                <input
                  value={adAccount}
                  onChange={(e) => setAdAccount(e.target.value)}
                  placeholder="VD: TK-001"
                  className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] font-[var(--mono)] text-[11px] p-[7px_10px] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-[10px] text-[var(--text3)] uppercase font-bold">Tên / sản phẩm → product</div>
                <input
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="VD: FB Ads BK Main"
                  className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[12px] font-bold text-[var(--text)] p-[7px_10px] outline-none focus:border-[var(--accent)]"
                />
                <div className="text-[10px] text-[var(--text3)] uppercase font-bold">Ghi chú / thị trường → market</div>
                <input
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  placeholder="VD: Media One · VNĐ · BIOKAMA"
                  className="w-full bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[10px] text-[var(--text3)] p-[6px_10px] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <div className="flex gap-[12px] shrink-0 flex-wrap">
              <div className="text-right">
                <div className="text-[9px] text-[var(--text3)] mb-[4px] uppercase font-bold tracking-[0.5px]">Chi phí (VNĐ)</div>
                <input
                  inputMode="numeric"
                  value={adCostStr}
                  onChange={(e) => setAdCostStr(e.target.value)}
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
                  onChange={(e) => setMessStr(e.target.value)}
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
              onChange={(e) => setTongDataStr(e.target.value)}
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
              onChange={(e) => setRevenueStr(e.target.value)}
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
              onChange={(e) => setOrderStr(e.target.value)}
              placeholder="0"
              className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full"
            />
          </div>

          <div className="md:col-span-3 flex flex-col sm:flex-row gap-[12px] sm:items-end pt-[4px]">
            <label className="flex flex-col gap-[6px] flex-1 min-w-0">
              <span className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">
                Số đơn thanh toán (TT) — cùng cột <code className="text-[9px] normal-case">order_count</code>
              </span>
              <input
                inputMode="numeric"
                value={orderStr}
                onChange={(e) => setOrderStr(e.target.value)}
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
              onChange={(e) => setTongLeadStr(e.target.value)}
              placeholder="0"
              className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full"
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">Số data chưa chốt</div>
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] w-full">
              {tongData > 0 || orders > 0 ? dataChuaChot.toLocaleString('vi-VN') : '—'}
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
            Lưu báo cáo
          </button>
          <button
            type="button"
            onClick={() => navigate(crmAdminPathForView('mkt-bill'))}
            className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] flex-1 min-w-[140px] py-[10px] rounded-[10px] text-[13px] font-extrabold flex items-center justify-center gap-[6px] hover:bg-[var(--bg4)] transition-all"
          >
            📋 Xem bill
          </button>
          <button
            type="button"
            onClick={() => void loadReport()}
            className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] px-[14px] py-[10px] rounded-[10px] text-[12px] font-bold hover:bg-[var(--bg4)] transition-all"
          >
            Tải lại
          </button>
        </div>
      </SectionCard>
    </div>
  );
};
