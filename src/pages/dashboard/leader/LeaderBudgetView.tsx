import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { BudgetRequestRow, BudgetRequestStatus, CrmAgencyRow, ReportRow } from '../../../types';
import { formatNumberDots, formatTypingGroupedInt } from '../mkt/mktDetailReportShared';

const BUDGET_TABLE = import.meta.env.VITE_SUPABASE_BUDGET_REQUESTS_TABLE?.trim() || 'budget_requests';
const REPORTS_TABLE = 'detail_reports';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';
const AGENCIES_TABLE = import.meta.env.VITE_SUPABASE_AGENCIES_TABLE?.trim() || 'crm_agencies';

const BUDGET_SELECT = `
  id,
  ngan_sach_xin,
  ngay_gio_xin,
  trang_thai,
  ly_do_tu_choi,
  ghi_chu,
  tkqc_account_id,
  tkqc_id,
  updated_at,
  tkqc_accounts ( id, don_vi, tkqc, page ),
  tkqc ( id, ma_tkqc, ten_pae, du_an ( ten_du_an, don_vi ) )
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

function parseVndInput(raw: string): number | null {
  const t = raw.replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function budgetAgencyLabel(r: BudgetRequestRow): string {
  const t = r.tkqc;
  if (t?.du_an?.don_vi?.trim()) return t.du_an.don_vi.trim();
  const a = r.tkqc_accounts;
  if (a?.don_vi?.trim()) return a.don_vi.trim();
  return '—';
}

function statusBadge(trangThai: BudgetRequestStatus) {
  if (trangThai === 'cho_phe_duyet') return <Badge type="Y">⏳ Chờ duyệt</Badge>;
  if (trangThai === 'dong_y') return <Badge type="G">✓ Đã duyệt</Badge>;
  return <Badge type="R">✕ Từ chối</Badge>;
}

export const LeaderBudgetView: React.FC = () => {
  const [duAnList, setDuAnList] = useState<DuAnOpt[]>([]);
  const [tkqcList, setTkqcList] = useState<TkqcOpt[]>([]);
  const [agencies, setAgencies] = useState<CrmAgencyRow[]>([]);
  const [requests, setRequests] = useState<BudgetRequestRow[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [idDuAn, setIdDuAn] = useState('');
  const [tkqcId, setTkqcId] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [priority, setPriority] = useState('Trung bình');
  const [amountStr, setAmountStr] = useState('');
  const [lyDo, setLyDo] = useState('');

  const monthBounds = useMemo(() => {
    const t = new Date();
    return { start: toLocalYyyyMmDd(startOfMonth(t)), end: toLocalYyyyMmDd(endOfMonth(t)), label: t.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }) };
  }, []);

  const loadRefs = useCallback(async () => {
    const [dRes, aRes] = await Promise.all([
      supabase.from(DU_AN_TABLE).select('id, ma_du_an, ten_du_an').order('ten_du_an', { ascending: true }),
      supabase.from(AGENCIES_TABLE).select('id, ma_agency, ten_agency').order('ten_agency', { ascending: true }),
    ]);
    if (dRes.error) console.error('du_an (leader budget):', dRes.error);
    else setDuAnList((dRes.data || []) as DuAnOpt[]);
    if (aRes.error) {
      console.warn('agencies (leader budget):', aRes.error);
      setAgencies([]);
    } else {
      setAgencies((aRes.data || []) as CrmAgencyRow[]);
    }
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
    setTkqcId('');
  }, [idDuAn, loadTkqc]);

  const filteredHistory = useMemo(() => {
    if (!idDuAn) return requests;
    const allowed = new Set(tkqcList.map((t) => t.id));
    return requests.filter((r) => r.tkqc_id && allowed.has(r.tkqc_id));
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

  const onSubmit = async () => {
    const amount = parseVndInput(amountStr);
    if (!idDuAn) {
      window.alert('Chọn dự án.');
      return;
    }
    if (!tkqcId) {
      window.alert('Chọn tài khoản TKQC.');
      return;
    }
    if (amount == null) {
      window.alert('Nhập số tiền hợp lệ (VNĐ, có thể dùng dấu chấm phân cách).');
      return;
    }
    const agencyName = agencies.find((a) => a.id === agencyId)?.ten_agency?.trim();
    const lines: string[] = [];
    if (agencyName) lines.push(`Agency: ${agencyName}`);
    lines.push(`Ưu tiên: ${priority}`);
    if (lyDo.trim()) lines.push(`Lý do: ${lyDo.trim()}`);
    const ghiChu = lines.length ? lines.join('\n') : null;

    setSubmitting(true);
    try {
      const { error: insErr } = await supabase.from(BUDGET_TABLE).insert({
        ngan_sach_xin: amount,
        ghi_chu: ghiChu,
        tkqc_id: tkqcId,
        trang_thai: 'cho_phe_duyet',
      });
      if (insErr) throw insErr;
      setAmountStr('');
      setLyDo('');
      await loadData();
    } catch (e) {
      console.error('budget insert (leader):', e);
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(
        msg.includes('tkqc_id') || msg.includes('tkqc')
          ? 'CSDL chưa có cột tkqc_id — chạy supabase/alter_budget_requests_tkqc_id.sql trên Supabase.'
          : msg || 'Gửi yêu cầu thất bại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dash-fade-up space-y-[14px]">
      <p className="text-[10px] text-[var(--text3)] leading-relaxed">
        <strong className="text-[var(--text2)]">Nguồn số liệu:</strong>{' '}
        <code className="text-[var(--text2)]">{BUDGET_TABLE}</code> (xin / duyệt) · Chi ads khai báo tháng{' '}
        <code className="text-[var(--text2)]">{REPORTS_TABLE}</code> (<code>ad_cost</code>
        {idDuAn ? ', lọc theo mã TKQC của dự án đã chọn' : ', toàn hệ thống'}). TKQC:{' '}
        <code className="text-[var(--text2)]">{TKQC_TABLE}</code>.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[10px]">
        <KpiCard
          label="Chờ duyệt"
          value={String(kpi.pendingCount)}
          sub={formatVndDots(kpi.pendingSum) + ' VNĐ · trong phạm vi bảng'}
          delta={idDuAn ? 'Theo dự án đã chọn' : '200 yêu cầu mới nhất'}
          deltaType="nt"
          barColor="var(--Y)"
          animationDelay={0}
        />
        <KpiCard
          label="Đã duyệt tháng này"
          value={String(kpi.approvedCount)}
          sub={formatVndDots(kpi.approvedSum) + ' VNĐ'}
          delta={`Tháng ${monthBounds.label}`}
          deltaType="nt"
          barColor="var(--G)"
          animationDelay={0.03}
        />
        <KpiCard
          label="Chi ads khai báo (tháng)"
          value={formatVndDots(adCostMonthScoped)}
          sub="VNĐ · cộng ad_cost"
          delta={idDuAn ? 'Theo ma_tkqc TKQC dự án' : 'Mọi dòng trong tháng'}
          deltaType="nt"
          barColor="var(--accent)"
          animationDelay={0.06}
        />
        <KpiCard
          label="Đã duyệt − chi khai báo"
          value={formatVndDots(kpi.diff)}
          sub="VNĐ · ước lượng (cùng phạm vi)"
          delta={kpi.diff >= 0 ? 'Dư / chưa chi hết' : 'Chi khai báo vượt duyệt'}
          deltaType={kpi.diff >= 0 ? 'up' : 'dn'}
          barColor="var(--P)"
          animationDelay={0.09}
        />
      </div>

      {error && (
        <div className="text-[11px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[var(--r)] px-3 py-2 bg-[var(--Rd)]/20">
          {error}
        </div>
      )}

      <SectionCard title="💰 Tạo yêu cầu nạp ngân sách">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mb-[20px]">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Dự án</label>
            <select
              value={idDuAn}
              onChange={(e) => setIdDuAn(e.target.value)}
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
            >
              <option value="">— Chọn dự án —</option>
              {duAnList.map((d) => (
                <option key={d.id} value={d.id}>
                  {[d.ma_du_an, d.ten_du_an].filter(Boolean).join(' · ') || d.ten_du_an}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Agency (ghi chú)</label>
            <select
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
            >
              <option value="">— Không chọn —</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ten_agency}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Mức độ ưu tiên</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
            >
              <option>Cao</option>
              <option>Trung bình</option>
              <option>Thấp</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mb-[20px]">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Tài khoản TKQC</label>
            <select
              value={tkqcId}
              onChange={(e) => setTkqcId(e.target.value)}
              disabled={!idDuAn}
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all disabled:opacity-50"
            >
              <option value="">{idDuAn ? '— Chọn TKQC —' : 'Chọn dự án trước'}</option>
              {tkqcList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ma_tkqc}
                  {t.ten_pae ? ` · ${t.ten_pae}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Đơn vị</label>
            <div className="flex items-center h-[42px] px-[14px] text-[12px] text-[var(--text2)] border border-[var(--border)] rounded-[8px] bg-[var(--bg3)]/50">
              VNĐ
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mb-[24px]">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Số tiền đề nghị nạp</label>
            <input
              type="text"
              inputMode="numeric"
              value={amountStr}
              onChange={(e) => setAmountStr(formatTypingGroupedInt(e.target.value))}
              placeholder="VD: 150.000.000"
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] font-[var(--mono)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Lý do nạp</label>
            <input
              type="text"
              value={lyDo}
              onChange={(e) => setLyDo(e.target.value)}
              placeholder="Mô tả lý do…"
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => void onSubmit()}
          className="flex items-center gap-[8px] bg-[#3d8ef0] hover:bg-[#2e7dd1] disabled:opacity-50 text-white p-[10px_24px] rounded-[8px] text-[12px] font-bold transition-all shadow-[0_4px_16px_rgba(61,142,240,0.3)]"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          📩 Gửi yêu cầu lên Admin
        </button>
      </SectionCard>

      <SectionCard
        title="📋 Lịch sử yêu cầu"
        actions={
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold border border-[rgba(255,255,255,0.08)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        }
        bodyPadding={false}
      >
        <div className="overflow-x-auto">
          {loading && !filteredHistory.length ? (
            <div className="flex items-center justify-center gap-2 py-14 text-[var(--text3)] text-[12px]">
              <Loader2 className="animate-spin" size={20} />
              Đang tải…
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[14px_16px]">Mã YC</th>
                  <th className="p-[14px_16px]">Agency / đơn vị</th>
                  <th className="p-[14px_16px] text-right">Số tiền</th>
                  <th className="p-[14px_16px]">Ngày gửi</th>
                  <th className="p-[14px_16px]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)]">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-[20px_16px] text-center text-[var(--text3)] text-[11px]">
                      {idDuAn ? 'Không có yêu cầu cho dự án đã chọn (hoặc chưa có bản ghi tkqc_id).' : 'Chưa có yêu cầu.'}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors"
                    >
                      <td className="p-[14px_16px] font-bold text-[#3d8ef0]">{displayMa(r.id)}</td>
                      <td className="p-[14px_16px]">{budgetAgencyLabel(r)}</td>
                      <td className="p-[14px_16px] text-right font-[var(--mono)] font-bold text-[var(--text)]">
                        {formatVndDots(Number(r.ngan_sach_xin))}
                      </td>
                      <td className="p-[14px_16px] text-[var(--text3)]">{formatReqDate(r.ngay_gio_xin)}</td>
                      <td className="p-[14px_16px]">{statusBadge(r.trang_thai)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>
    </div>
  );
};
