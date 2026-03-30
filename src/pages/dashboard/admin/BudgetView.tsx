/**
 * Module 6 — Ngân sách (admin)
 *
 * Nguồn dữ liệu hợp lý:
 * - Danh sách yêu cầu / lịch sử duyệt: bảng `budget_requests` (+ embed `tkqc` qua `tkqc_id` hoặc `tkqc_accounts` qua `tkqc_account_id`).
 * - KPI “Đã duyệt tháng này” / “Chờ duyệt”: tổng hợp từ `budget_requests` (trang_thai, updated_at).
 * - KPI “Chi ads tháng này” (MKT khai báo): `detail_reports.ad_cost` theo `report_date` trong tháng hiện tại.
 * - “Chênh lệch tồn” (gợi ý): đã duyệt tháng − chi ads tháng (cùng kỳ, mang tính ước lượng).
 *
 * Migration: `supabase/alter_budget_requests_tkqc_id.sql` thêm `tkqc_id` → `public.tkqc` (Module 4).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, BudgetCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
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
  updated_at,
  tkqc_accounts ( id, don_vi, tkqc, page ),
  tkqc ( id, ma_tkqc, ten_pae, du_an ( ten_du_an, don_vi ) )
`;

/** Hiển thị giống shape tkqc_accounts: ưu tiên embed Module 4 (`tkqc`). */
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
  return r.tkqc_accounts ?? null;
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
  return `YC-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
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

export const BudgetView: React.FC = () => {
  const [requests, setRequests] = useState<BudgetRequestRow[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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

    return {
      pendingSum,
      pendingCount: pending.length,
      approvedSum,
      approvedCount: approvedThisMonth.length,
      adMonth,
      diff,
    };
  }, [requests, reportRows, monthBounds.start, monthBounds.end]);

  const pendingList = useMemo(
    () => requests.filter((r) => r.trang_thai === 'cho_phe_duyet').sort((a, b) => (a.ngay_gio_xin < b.ngay_gio_xin ? 1 : -1)),
    [requests]
  );

  const historyList = useMemo(
    () =>
      requests
        .filter((r) => r.trang_thai === 'dong_y' || r.trang_thai === 'tu_choi')
        .sort((a, b) => {
          const ta = (a.updated_at || a.ngay_gio_xin || '').slice(0, 19);
          const tb = (b.updated_at || b.ngay_gio_xin || '').slice(0, 19);
          return ta < tb ? 1 : -1;
        })
        .slice(0, 50),
    [requests]
  );

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

  return (
    <div className="dash-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-[14px]">
        <p className="text-[10px] text-[var(--text3)] max-w-[640px] leading-relaxed">
          <strong className="text-[var(--text2)]">Nguồn:</strong>{' '}
          <code className="text-[var(--text)]">{BUDGET_TABLE}</code> (xin / duyệt, liên kết{' '}
          <code className="text-[var(--text)]">tkqc</code> / <code className="text-[var(--text)]">tkqc_accounts</code>) · KPI chi phí tháng:{' '}
          <code className="text-[var(--text)]">{REPORTS_TABLE}</code> (<code>ad_cost</code>).
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold border border-[rgba(255,255,255,0.08)] disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="mb-[12px] text-[11px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[var(--r)] px-3 py-2 bg-[var(--Rd)]/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-[10px] mb-[18px]">
        <KpiCard
          label="ĐÃ DUYỆT THÁNG NÀY"
          value={loading ? '…' : formatVndDots(kpis.approvedSum)}
          sub={`VNĐ · ${kpis.approvedCount} yêu cầu · ${BUDGET_TABLE}`}
          barColor="#3d8ef0"
          valueSize="lg"
        />
        <KpiCard
          label="CHI ADS THÁNG NÀY (BC)"
          value={loading ? '…' : formatVndDots(kpis.adMonth)}
          sub={`VNĐ · ${REPORTS_TABLE}.ad_cost`}
          barColor="#10b981"
          valueSize="lg"
        />
        <KpiCard
          label="ĐANG CHỜ DUYỆT"
          value={loading ? '…' : formatVndDots(kpis.pendingSum)}
          sub={`VNĐ · ${kpis.pendingCount} yêu cầu`}
          barColor="#f59e0b"
          valueSize="lg"
        />
        <KpiCard
          label="CHÊNH LỆCH (DUYỆT − ADS)"
          value={loading ? '…' : `${kpis.diff >= 0 ? '' : '−'}${formatVndDots(Math.abs(kpis.diff))}`}
          sub="VNĐ · cùng tháng, ước lượng"
          barColor={kpis.diff >= 0 ? '#10b981' : '#ef4444'}
          valueSize="lg"
        />
      </div>

      {loading && !requests.length ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--text3)] text-[12px]">
          <Loader2 className="animate-spin" size={20} />
          Đang tải…
        </div>
      ) : (
        <>
          <SectionCard
            title="📋 Yêu cầu nạp ngân sách — Đang chờ duyệt"
            badge={{ text: `${pendingList.length} yêu cầu`, type: 'Y' }}
          >
            {pendingList.length === 0 ? (
              <div className="text-[11px] text-[var(--text3)] py-6 text-center">
                Không có yêu cầu chờ duyệt trong <code className="text-[var(--text2)]">{BUDGET_TABLE}</code>.
              </div>
            ) : (
              <div className="flex flex-col gap-[10px]">
                {pendingList.map((r) => {
                  const acc = budgetDisplayAcc(r);
                  const busy = actionId === r.id;
                  return (
                    <BudgetCard
                      key={r.id}
                      id={displayMa(r.id)}
                      agency={acc?.don_vi?.trim() || '—'}
                      team="—"
                      project={acc?.page?.trim() || acc?.tkqc?.trim() || '—'}
                      accounts={acc?.tkqc?.trim() || '—'}
                      priority={priorityLabel(Number(r.ngan_sach_xin))}
                      date={formatReqDate(r.ngay_gio_xin)}
                      amount={`${formatVndDots(Number(r.ngan_sach_xin))}đ`}
                      isPending
                      onApprove={busy ? undefined : () => onApprove(r.id)}
                      onReject={busy ? undefined : () => onReject(r.id)}
                      onDetail={() => {
                        const g = r.ghi_chu?.trim();
                        window.alert(g || 'Không có ghi chú.');
                      }}
                    />
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div className="mt-[20px]">
            <SectionCard title="✅ Lịch sử duyệt / từ chối" bodyPadding={false}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                      <th className="p-[12px_16px]">MÃ YC</th>
                      <th className="p-[12px_16px]">AGENCY / TK</th>
                      <th className="p-[12px_16px]">PAGE</th>
                      <th className="p-[12px_16px] text-right">SỐ TIỀN</th>
                      <th className="p-[12px_16px]">CẬP NHẬT</th>
                      <th className="p-[12px_16px]">TT</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11.5px] text-[var(--text2)]">
                    {historyList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-[20px_16px] text-center text-[var(--text3)] text-[11px]">
                          Chưa có lịch sử duyệt.
                        </td>
                      </tr>
                    ) : (
                      historyList.map((r) => {
                        const acc = budgetDisplayAcc(r);
                        const ok = r.trang_thai === 'dong_y';
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors"
                          >
                            <td className="p-[12px_16px] font-bold text-[#3d8ef0]">{displayMa(r.id)}</td>
                            <td className="p-[12px_16px]">{acc?.don_vi?.trim() || '—'}</td>
                            <td className="p-[12px_16px] max-w-[180px] truncate" title={acc?.page || acc?.tkqc || ''}>
                              {acc?.page?.trim() || acc?.tkqc || '—'}
                            </td>
                            <td className="p-[12px_16px] text-right font-medium text-[var(--text)]">
                              {formatVndDots(Number(r.ngan_sach_xin))}
                            </td>
                            <td className="p-[12px_16px]">{formatDateOnly(r.updated_at || r.ngay_gio_xin)}</td>
                            <td className="p-[12px_16px]">
                              {ok ? (
                                <span className="p-[2.5px_8px] bg-[rgba(16,185,129,0.12)] text-[#10b981] rounded-[4px] text-[9.5px] font-bold border border-[rgba(16,185,129,0.2)]">
                                  Đã duyệt
                                </span>
                              ) : (
                                <span className="p-[2.5px_8px] bg-[rgba(224,61,61,0.12)] text-[#ef4444] rounded-[4px] text-[9.5px] font-bold border border-[rgba(224,61,61,0.2)]">
                                  Từ chối
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
};
