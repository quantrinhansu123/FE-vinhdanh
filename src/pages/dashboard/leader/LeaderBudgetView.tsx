import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { BudgetRequestFormModal } from '../../../components/crm-dashboard/BudgetRequestFormModal';
import { supabase } from '../../../api/supabase';
import type { BudgetRequestRow, BudgetRequestStatus, ReportRow } from '../../../types';
import { formatNumberDots } from '../mkt/mktDetailReportShared';

const BUDGET_TABLE = import.meta.env.VITE_SUPABASE_BUDGET_REQUESTS_TABLE?.trim() || 'budget_requests';
const REPORTS_TABLE = 'detail_reports';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';
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
  updated_at,
  giam_doc_da_duyet,
  giam_doc_duyet_boi,
  giam_doc_duyet_at,
  ke_toan_da_duyet,
  ke_toan_duyet_boi,
  ke_toan_duyet_at,
  da_giai_ngan,
  giai_ngan_boi,
  giai_ngan_at,
  anh_giai_ngan_urls,
  tkqc_accounts ( id, don_vi, tkqc, page ),
  tkqc ( id, ma_tkqc, ten_pae, du_an ( ten_du_an, don_vi ) ),
  du_an ( id, ten_du_an, ma_du_an, don_vi ),
  crm_agencies ( id, ten_agency )
`;

type DuAnOpt = { id: string; ma_du_an: string | null; ten_du_an: string };
type TkqcOpt = {
  id: string;
  ma_tkqc: string;
  ten_pae: string | null;
  du_an?: { ten_du_an: string; ma_du_an: string | null } | null;
};

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
  if (!Number.isFinite(n)) return '—';
  const s = formatNumberDots(Math.round(n), false);
  return s === '' ? '0' : s;
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function displayMa(id: string): string {
  return `YC-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function formatReqDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatByAt(by?: string | null, at?: string | null): string {
  const byText = by?.trim() || '';
  const atText = at ? formatReqDate(at) : '';
  if (byText && atText) return `${byText} · ${atText}`;
  if (byText) return byText;
  if (atText) return atText;
  return '—';
}

function budgetAgencyLabel(r: BudgetRequestRow): string {
  const t = r.tkqc;
  if (t?.du_an?.don_vi?.trim()) return t.du_an.don_vi.trim();
  const a = r.tkqc_accounts;
  if (a?.don_vi?.trim()) return a.don_vi.trim();
  const ag = r.crm_agencies?.ten_agency?.trim();
  if (ag) return ag;
  return '—';
}

function statusBadgeObsidian(trangThai: BudgetRequestStatus) {
  if (trangThai === 'cho_phe_duyet') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[color-mix(in_srgb,var(--ld-tertiary)_12%,transparent)] text-[var(--ld-tertiary)] border border-[var(--ld-tertiary)]/25 shrink-0">
        <span className="material-symbols-outlined text-[12px]">schedule</span>
        Chờ duyệt
      </span>
    );
  }
  if (trangThai === 'dong_y') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[color-mix(in_srgb,var(--ld-secondary)_12%,transparent)] text-[var(--ld-secondary)] border border-[var(--ld-secondary)]/25 shrink-0">
        <span className="material-symbols-outlined text-[12px]">check_circle</span>
        Đã duyệt
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[color-mix(in_srgb,var(--ld-error)_12%,transparent)] text-[var(--ld-error)] border border-[var(--ld-error)]/25 shrink-0">
      <span className="material-symbols-outlined text-[12px]">cancel</span>
      Từ chối
    </span>
  );
}

function ApprovalStepBadge({ label, done, by, at }: { label: string; done: boolean; by?: string | null; at?: string | null }) {
  const tooltip = done && (by || at) ? `${label}: ${by || ''} ${at ? '(' + formatReqDate(at) + ')' : ''}` : label;
  return (
    <div className="flex flex-col items-center gap-0.5 group/step relative" title={tooltip}>
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
          done
            ? 'bg-[var(--ld-secondary)] border-[var(--ld-secondary)] text-[var(--ld-on-secondary)]'
            : 'bg-transparent border-[var(--ld-outline-variant)] text-[var(--ld-on-surface-variant)] opacity-40'
        }`}
      >
        <span className="material-symbols-outlined text-[14px]">{done ? 'check' : 'radio_button_unchecked'}</span>
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-tighter ${done ? 'text-[var(--ld-secondary)]' : 'text-[var(--ld-on-surface-variant)] opacity-40'}`}>
        {label === 'Giám đốc' ? 'GĐ' : label === 'Kế toán' ? 'KT' : 'GN'}
      </span>
    </div>
  );
}

const SummaryCard: React.FC<{
  label: string;
  badge?: React.ReactNode;
  valueMain: string;
  valueSub: React.ReactNode;
  footnote: string;
  footnoteItalic?: boolean;
  icon: string;
}> = ({ label, badge, valueMain, valueSub, footnote, footnoteItalic, icon }) => (
  <div className="bg-[var(--ld-surface-container-low)] p-6 rounded-xl ld-ghost-border relative overflow-hidden group hover:bg-[var(--ld-surface-container)] transition-colors">
    <div className="flex justify-between items-start mb-4 gap-2">
      <span className="leader-dash-label text-[var(--ld-on-surface-variant)] text-xs uppercase tracking-widest font-bold">
        {label}
      </span>
      {badge}
    </div>
    <div className="flex flex-col gap-1 relative z-[1]">
      <span className="text-3xl font-extrabold text-[var(--ld-on-surface)]">{valueMain}</span>
      <div className="text-lg font-semibold">{valueSub}</div>
      <span className={`text-xs text-[var(--ld-on-surface-variant)] mt-2 ${footnoteItalic ? 'italic' : ''}`}>{footnote}</span>
    </div>
    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
      <span className="material-symbols-outlined text-8xl text-[var(--ld-on-surface)]">{icon}</span>
    </div>
  </div>
);

export const LeaderBudgetView: React.FC = () => {
  const [duAnList, setDuAnList] = useState<DuAnOpt[]>([]);
  const [tkqcList, setTkqcList] = useState<TkqcOpt[]>([]);
  const [requests, setRequests] = useState<BudgetRequestRow[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [clockTick, setClockTick] = useState(0);

  const [idDuAn, setIdDuAn] = useState('');

  const monthBounds = useMemo(() => {
    const t = new Date();
    return { start: toLocalYyyyMmDd(startOfMonth(t)), end: toLocalYyyyMmDd(endOfMonth(t)), label: t.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }) };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setClockTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const headerNow = useMemo(
    () =>
      new Date().toLocaleString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [clockTick]
  );

  const loadRefs = useCallback(async () => {
    const dRes = await supabase.from(DU_AN_TABLE).select('id, ma_du_an, ten_du_an').order('ten_du_an', { ascending: true });
    if (dRes.error) console.error('du_an (leader budget):', dRes.error);
    else setDuAnList((dRes.data || []) as DuAnOpt[]);
  }, []);

  const loadTkqc = useCallback(async (projectId: string) => {
    if (!projectId) {
      setTkqcList([]);
      return;
    }
    const q = await supabase
      .from(TKQC_TABLE)
      .select('id, ma_tkqc, ten_pae, du_an ( ten_du_an, ma_du_an )')
      .eq('id_du_an', projectId)
      .order('ma_tkqc', { ascending: true });
    if (q.error) {
      console.error('tkqc (leader budget):', q.error);
      setTkqcList([]);
      return;
    }
    setTkqcList((q.data || []) as TkqcOpt[]);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [q, repRes] = await Promise.all([
      supabase.from(BUDGET_TABLE).select(BUDGET_SELECT).order('ngay_gio_xin', { ascending: false }).limit(200),
      supabase
        .from(REPORTS_TABLE)
        .select('report_date, ad_cost, ma_tkqc')
        .gte('report_date', monthBounds.start)
        .lte('report_date', monthBounds.end)
        .limit(8000),
    ]);

    if (q.error) {
      console.error('budget_requests (leader):', q.error);
      const em = q.error.message || '';
      setError(
        em.includes('tkqc_id') || em.includes('tkqc')
          ? 'Thiếu cột hoặc quan hệ tkqc trên budget_requests — chạy supabase/alter_budget_requests_tkqc_id.sql trên Supabase.'
          : em || 'Không tải được lịch sử yêu cầu.'
      );
      setRequests([]);
    } else {
      setRequests((q.data || []) as BudgetRequestRow[]);
    }

    if (repRes.error) {
      console.warn('leader-budget detail_reports:', repRes.error);
      setReportRows([]);
    } else {
      setReportRows((repRes.data || []) as ReportRow[]);
    }

    setLoading(false);
  }, [monthBounds.start, monthBounds.end]);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadTkqc(idDuAn);
  }, [idDuAn, loadTkqc]);

  const filteredHistory = useMemo(() => {
    if (!idDuAn) return requests;
    const allowed = new Set(tkqcList.map((t) => t.id));
    return requests.filter((r) => {
      if (r.id_du_an === idDuAn) return true;
      return Boolean(r.tkqc_id && allowed.has(r.tkqc_id));
    });
  }, [requests, idDuAn, tkqcList]);

  const maTkqcSet = useMemo(
    () => new Set(tkqcList.map((t) => t.ma_tkqc?.trim()).filter(Boolean) as string[]),
    [tkqcList]
  );

  const adCostMonthScoped = useMemo(() => {
    if (idDuAn && maTkqcSet.size > 0) {
      return reportRows.reduce((acc, r) => {
        const ma = r.ma_tkqc?.trim();
        if (!ma || !maTkqcSet.has(ma)) return acc;
        return acc + safeNum(r.ad_cost);
      }, 0);
    }
    return reportRows.reduce((acc, r) => acc + safeNum(r.ad_cost), 0);
  }, [reportRows, idDuAn, maTkqcSet]);

  const kpi = useMemo(() => {
    const list = filteredHistory;
    const pending = list.filter((r) => r.trang_thai === 'cho_phe_duyet');
    const pendingSum = pending.reduce((a, r) => a + safeNum(r.ngan_sach_xin), 0);
    const { start, end } = monthBounds;
    const approved = list.filter((r) => {
      if (r.trang_thai !== 'dong_y') return false;
      const u = (r.updated_at || r.ngay_gio_xin || '').slice(0, 10);
      return u && u >= start && u <= end;
    });
    const approvedSum = approved.reduce((a, r) => a + safeNum(r.ngan_sach_xin), 0);
    const diff = approvedSum - adCostMonthScoped;
    return {
      pendingCount: pending.length,
      pendingSum,
      approvedCount: approved.length,
      approvedSum,
      diff,
    };
  }, [filteredHistory, monthBounds, adCostMonthScoped]);

  const scopeBadgeText = idDuAn ? 'Theo dự án đã chọn' : '200 yêu cầu mới nhất';

  return (
    <div className="leader-dash-obsidian dash-fade-up text-[var(--ld-on-surface)] -m-[12px] p-6 sm:p-8 min-h-[min(100%,calc(100vh-8rem))] leader-obsidian-scrollbar overflow-y-auto">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--ld-on-surface)] tracking-tight" style={{ fontFamily: '"Inter", sans-serif' }}>
            Quản lý ngân sách
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="leader-dash-label text-[var(--ld-on-surface-variant)] text-sm uppercase tracking-widest">{headerNow}</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)] border border-[var(--ld-secondary)]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ld-secondary)] animate-pulse" />
              <span className="text-[10px] font-bold text-[var(--ld-secondary)] uppercase">Live</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="ld-glass-chip ld-ghost-border rounded-lg px-4 py-2 flex items-center gap-3 min-w-[min(100%,280px)]">
            <span className="material-symbols-outlined text-[var(--ld-primary)] text-sm shrink-0">filter_alt</span>
            <select
              value={idDuAn}
              onChange={(e) => setIdDuAn(e.target.value)}
              className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-sm leader-dash-label text-[var(--ld-on-surface)] cursor-pointer outline-none"
              aria-label="Phạm vi dự án"
            >
              <option value="" className="bg-[var(--ld-surface-container)] text-[var(--ld-on-surface)]">
                — Tất cả dự án —
              </option>
              {duAnList.map((d) => (
                <option key={d.id} value={d.id} className="bg-[var(--ld-surface-container)] text-[var(--ld-on-surface)]">
                  {[d.ma_du_an, d.ten_du_an].filter(Boolean).join(' · ') || d.ten_du_an}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined text-[var(--ld-on-surface-variant)] text-xs shrink-0">expand_more</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[var(--ld-on-surface-variant)] leading-relaxed mb-8 max-w-4xl">
        <strong className="text-[var(--ld-on-surface)]">Nguồn:</strong>{' '}
        <code className="text-[var(--ld-primary)]/90">{BUDGET_TABLE}</code> ·{' '}
        <code className="text-[var(--ld-primary)]/90">{REPORTS_TABLE}</code> (ad_cost){idDuAn ? ', lọc ma_tkqc theo dự án' : ''} ·{' '}
        <code className="text-[var(--ld-primary)]/90">{TKQC_TABLE}</code>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <SummaryCard
          label="Chờ duyệt"
          badge={
            <div className="bg-[color-mix(in_srgb,var(--ld-primary)_10%,transparent)] px-2 py-0.5 rounded text-[10px] font-bold text-[var(--ld-primary)] border border-[var(--ld-primary)]/20 shrink-0">
              {scopeBadgeText}
            </div>
          }
          valueMain={String(kpi.pendingCount)}
          valueSub={<span className="text-[var(--ld-primary)]">VND {formatVndDots(kpi.pendingSum)}</span>}
          footnote="Trong phạm vi bảng"
          footnoteItalic
          icon="pending_actions"
        />
        <SummaryCard
          label="Đã duyệt tháng này"
          valueMain={String(kpi.approvedCount)}
          valueSub={<span className="text-[var(--ld-secondary)]">VND {formatVndDots(kpi.approvedSum)}</span>}
          footnote={`Tháng ${monthBounds.label}`}
          icon="check_circle"
        />
        <SummaryCard
          label="Chi ads khai báo (tháng)"
          valueMain={formatVndDots(adCostMonthScoped)}
          valueSub={<span className="text-[var(--ld-tertiary)]">VNĐ</span>}
          footnote={idDuAn ? 'Theo ma_tkqc TKQC dự án' : 'Mọi dòng trong tháng'}
          icon="campaign"
        />
        <SummaryCard
          label="Đã duyệt − chi khai báo"
          badge={
            <div className="bg-[color-mix(in_srgb,var(--ld-secondary)_10%,transparent)] px-2 py-0.5 rounded text-[10px] font-bold text-[var(--ld-secondary)] border border-[var(--ld-secondary)]/20 shrink-0">
              {kpi.diff >= 0 ? 'Dư / chưa chi hết' : 'Chi vượt duyệt'}
            </div>
          }
          valueMain={formatVndDots(kpi.diff)}
          valueSub={<span className="text-[var(--ld-on-surface-variant)] text-sm font-normal">VNĐ ước lượng</span>}
          footnote="Cùng phạm vi lọc"
          footnoteItalic
          icon="account_balance_wallet"
        />
      </div>

      {error && (
        <div className="mb-6 text-[11px] font-semibold text-[var(--ld-error)] border border-[var(--ld-error)]/25 rounded-xl px-4 py-3 bg-[color-mix(in_srgb,var(--ld-error)_12%,transparent)]">
          {error}
        </div>
      )}

      <BudgetRequestFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmitted={() => void loadData()} />

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-9">
          <div className="bg-[var(--ld-surface-container-low)] rounded-2xl p-6 sm:p-8 min-h-[400px] flex flex-col border border-[var(--ld-outline-variant)]/10">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-xl font-bold text-[var(--ld-on-surface)]" style={{ fontFamily: '"Inter", sans-serif' }}>
                  Lịch sử yêu cầu
                </h2>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  disabled={loading}
                  className="flex items-center gap-2 text-[var(--ld-primary)] hover:text-[var(--ld-primary-container)] text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  Làm mới
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-2 px-4 sm:px-6 py-4 bg-[color-mix(in_srgb,var(--ld-surface-container-highest)_30%,transparent)] rounded-t-lg mb-2 text-left max-sm:hidden">
              <span className="text-xs leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-widest">Mã YC</span>
              <span className="text-xs leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-widest">Agency / đơn vị</span>
              <span className="text-xs leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-widest text-right">
                Số tiền
              </span>
              <span className="text-xs leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-widest">Ngày gửi</span>
              <span className="text-xs leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-widest text-center">Tiến độ duyệt</span>
              <span className="text-xs leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-widest">Trạng thái</span>
              <span className="text-xs leader-dash-label font-bold text-[var(--ld-on-surface-variant)] uppercase tracking-widest">Chi tiết duyệt / giải ngân</span>
            </div>

            {loading && !filteredHistory.length ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-20 text-[var(--ld-on-surface-variant)]">
                <Loader2 className="animate-spin" size={28} />
                <span className="text-sm font-semibold">Đang tải…</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 sm:py-20">
                <div className="w-28 h-32 sm:w-32 sm:h-32 bg-[var(--ld-surface-container)] mb-6 rounded-full flex items-center justify-center border border-[var(--ld-outline-variant)]/10">
                  <span className="material-symbols-outlined text-5xl text-[var(--ld-outline-variant)]">find_in_page</span>
                </div>
                <h3 className="text-[var(--ld-on-surface-variant)] font-semibold mb-1 text-center" style={{ fontFamily: '"Inter", sans-serif' }}>
                  Chưa có yêu cầu
                </h3>
                <p className="text-[var(--ld-on-surface-variant)] text-sm text-center max-w-sm px-4">
                  {idDuAn
                    ? 'Không có yêu cầu cho dự án đã chọn (theo id_du_an hoặc TKQC thuộc dự án).'
                    : 'Bắt đầu bằng việc tạo yêu cầu ngân sách mới.'}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto leader-dash-no-scrollbar -mx-2">
                <div className="min-w-[980px] space-y-2 px-2">
                  {filteredHistory.map((r) => {
                    const disbursementUrls = (r.anh_giai_ngan_urls || []).filter((u) => typeof u === 'string' && u.trim().length > 0);
                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-2 items-center px-4 sm:px-6 py-3.5 rounded-xl bg-[color-mix(in_srgb,var(--ld-surface-container-highest)_25%,transparent)] border border-[var(--ld-outline-variant)]/10 hover:border-[var(--ld-primary)]/15 transition-colors"
                      >
                        <span className="font-bold text-[var(--ld-primary)] text-sm">{displayMa(r.id)}</span>
                        <span className="text-sm text-[var(--ld-on-surface)] truncate" title={budgetAgencyLabel(r)}>
                          {budgetAgencyLabel(r)}
                        </span>
                        <span className="text-sm font-mono font-bold text-[var(--ld-on-surface)] text-right tabular-nums">
                          {formatVndDots(Number(r.ngan_sach_xin))}
                        </span>
                        <span className="text-xs text-[var(--ld-on-surface-variant)]">{formatReqDate(r.ngay_gio_xin)}</span>

                        <div className="flex items-center justify-center gap-4 border-x border-[var(--ld-outline-variant)]/10 px-2">
                          <ApprovalStepBadge label="Giám đốc" done={!!r.giam_doc_da_duyet} by={r.giam_doc_duyet_boi} at={r.giam_doc_duyet_at} />
                          <ApprovalStepBadge label="Kế toán" done={!!r.ke_toan_da_duyet} by={r.ke_toan_duyet_boi} at={r.ke_toan_duyet_at} />
                          <ApprovalStepBadge label="Giải ngân" done={!!r.da_giai_ngan} by={r.giai_ngan_boi} at={r.giai_ngan_at} />
                        </div>

                        <div className="flex justify-start">{statusBadgeObsidian(r.trang_thai)}</div>

                        <div className="text-[10px] leading-relaxed text-[var(--ld-on-surface-variant)] space-y-0.5">
                          <p>
                            <span className="text-[var(--ld-on-surface)] font-semibold">GĐ:</span> {formatByAt(r.giam_doc_duyet_boi, r.giam_doc_duyet_at)}
                          </p>
                          <p>
                            <span className="text-[var(--ld-on-surface)] font-semibold">KT:</span> {formatByAt(r.ke_toan_duyet_boi, r.ke_toan_duyet_at)}
                          </p>
                          <p>
                            <span className="text-[var(--ld-on-surface)] font-semibold">GN:</span> {formatByAt(r.giai_ngan_boi, r.giai_ngan_at)}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[var(--ld-on-surface)] font-semibold">Ảnh GN:</span>
                            {disbursementUrls.length === 0 ? (
                              <span>0</span>
                            ) : (
                              <>
                                <span>{disbursementUrls.length}</span>
                                {disbursementUrls.slice(0, 2).map((url, idx) => (
                                  <a
                                    key={`${r.id}-proof-${idx}`}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[var(--ld-primary)] hover:underline"
                                    title={url}
                                  >
                                    Xem {idx + 1}
                                  </a>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="w-full min-h-[6rem] bg-gradient-to-br from-[var(--ld-primary)] to-[var(--ld-primary-container)] text-[var(--ld-on-primary-container)] rounded-2xl flex flex-col items-center justify-center gap-2 group hover:shadow-[0_0_20px_rgba(59,191,250,0.3)] transition-all px-4 py-4 border border-[var(--ld-primary-container)]/30"
          >
            <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">add_circle</span>
            <span className="font-bold text-base text-center leading-snug">Tạo yêu cầu xin ngân sách</span>
          </button>

          <div className="bg-[var(--ld-surface-container)] p-6 rounded-2xl border border-[var(--ld-outline-variant)]/10">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-[var(--ld-tertiary)]">info</span>
              <h4 className="font-bold text-[var(--ld-on-surface)] text-sm" style={{ fontFamily: '"Inter", sans-serif' }}>
                Hướng dẫn nhanh
              </h4>
            </div>
            <p className="text-[var(--ld-on-surface-variant)] text-xs leading-relaxed">
              Form đầy đủ: dự án, đơn vị thụ hưởng, thông tin chuyển khoản, hạng mục, chứng từ. Chọn đúng phạm vi dự án ở lọc phía trên trước khi đối chiếu KPI và lịch sử.
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden aspect-square border border-[var(--ld-outline-variant)]/10 bg-gradient-to-br from-[var(--ld-surface-container-highest)] via-[var(--ld-surface-container)] to-[var(--ld-surface-container-low)]">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(circle at 25% 20%, color-mix(in srgb, var(--ld-primary) 35%, transparent) 0%, transparent 45%), radial-gradient(circle at 80% 70%, color-mix(in srgb, var(--ld-secondary) 20%, transparent) 0%, transparent 40%)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--ld-background)]/90 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <span className="text-[10px] text-[var(--ld-primary)] uppercase font-bold tracking-widest mb-1 block">Live monitoring</span>
              <p className="text-xs text-[var(--ld-on-surface)] font-medium leading-snug">
                Đồng bộ {BUDGET_TABLE} và chi ads theo tháng hiện tại.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
