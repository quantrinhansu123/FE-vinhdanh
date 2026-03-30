import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, AlertItem, BarRow } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { ReportRow } from '../../../types';
import { formatCompactVnd } from '../mkt/mktDetailReportShared';

/** Dashboard admin: mọi số liệu báo cáo MKT lấy từ bảng này (theo yêu cầu). */
const REPORTS_TABLE = 'detail_reports';

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

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function tyLeChot(tongData: number, orders: number, tongLead: number): number | null {
  if (tongData > 0 && Number.isFinite(orders)) return (orders / tongData) * 100;
  if (tongLead > 0 && Number.isFinite(orders)) return (orders / tongLead) * 100;
  return null;
}

type MarketerAgg = {
  key: string;
  displayName: string;
  team: string | null;
  revenue: number;
  adCost: number;
  tongLead: number;
  orders: number;
  tongData: number;
};

const ADS_DT_WARN = 45;
const ADS_DT_MED = 30;

export const AdminDashboardView: React.FC = () => {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthRef = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => toLocalYyyyMmDd(startOfMonth(monthRef)), [monthRef]);
  const monthEnd = useMemo(() => toLocalYyyyMmDd(endOfMonth(monthRef)), [monthRef]);
  const monthLabel = useMemo(
    () =>
      monthRef.toLocaleDateString('vi-VN', {
        month: '2-digit',
        year: 'numeric',
      }),
    [monthRef]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from(REPORTS_TABLE)
      .select(
        'report_date, name, email, team, ad_cost, revenue, order_count, tong_lead, tong_data_nhan'
      )
      .gte('report_date', monthStart)
      .lte('report_date', monthEnd)
      .limit(8000);

    if (qErr) {
      console.error('admin-dash detail_reports:', qErr);
      setError(qErr.message || 'Không tải được báo cáo.');
      setRows([]);
    } else {
      setRows((data || []) as ReportRow[]);
    }
    setLoading(false);
  }, [monthStart, monthEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const byMarketer = useMemo(() => {
    const map = new Map<string, MarketerAgg>();
    for (const r of rows) {
      const email = r.email?.trim().toLowerCase() || '';
      const nm = (r.name || '').trim();
      const key = email || nm || `anon-${map.size}`;
      const displayName = nm || email || '—';
      const cur =
        map.get(key) ||
        ({
          key,
          displayName,
          team: r.team?.trim() || null,
          revenue: 0,
          adCost: 0,
          tongLead: 0,
          orders: 0,
          tongData: 0,
        } satisfies MarketerAgg);
      cur.revenue += safeNum(r.revenue);
      cur.adCost += safeNum(r.ad_cost);
      cur.tongLead += safeNum(r.tong_lead);
      cur.orders += safeNum(r.order_count);
      cur.tongData += safeNum(r.tong_data_nhan);
      if (!cur.team && r.team?.trim()) cur.team = r.team.trim();
      if (cur.displayName === '—' && nm) cur.displayName = displayName;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  const totals = useMemo(() => {
    let revenue = 0;
    let adCost = 0;
    let tongLead = 0;
    let orders = 0;
    let tongData = 0;
    for (const r of rows) {
      revenue += safeNum(r.revenue);
      adCost += safeNum(r.ad_cost);
      tongLead += safeNum(r.tong_lead);
      orders += safeNum(r.order_count);
      tongData += safeNum(r.tong_data_nhan);
    }
    const adsDtPct = revenue > 0 ? (adCost / revenue) * 100 : null;
    const chotPct = tyLeChot(tongData, orders, tongLead);
    const aov = orders > 0 ? revenue / orders : null;
    return { revenue, adCost, tongLead, orders, tongData, adsDtPct, chotPct, aov };
  }, [rows]);

  const burnMarketers = useMemo(
    () =>
      byMarketer.filter((m) => {
        if (m.revenue <= 0 || m.adCost <= 0) return false;
        return (m.adCost / m.revenue) * 100 >= ADS_DT_WARN;
      }),
    [byMarketer]
  );

  const rankRows = useMemo(() => {
    return byMarketer.map((m, idx) => {
      const adsPct = m.revenue > 0 ? (m.adCost / m.revenue) * 100 : m.adCost > 0 ? 100 : 0;
      const cplDenom = m.tongLead > 0 ? m.tongLead : m.tongData > 0 ? m.tongData : 0;
      const cpl = cplDenom > 0 ? m.adCost / cplDenom : null;
      const cpo = m.orders > 0 ? m.adCost / m.orders : null;
      const chot = tyLeChot(m.tongData, m.orders, m.tongLead);
      let status: 'good' | 'med' | 'bad' = 'good';
      if (adsPct >= ADS_DT_WARN) status = 'bad';
      else if (adsPct >= ADS_DT_MED) status = 'med';
      const isBurn = status === 'bad' && m.revenue > 0;
      return { rank: idx + 1, m, adsPct, cpl, cpo, chot, status, isBurn };
    });
  }, [byMarketer]);

  const barLayer3Max = Math.max(totals.tongLead, totals.orders, 1);
  const barLayer1Declared = totals.adCost;

  if (loading) {
    return (
      <div className="dash-fade-up flex items-center justify-center min-h-[200px] gap-2 text-[var(--text2)]">
        <Loader2 className="animate-spin" size={20} />
        <span className="text-[12px]">Đang tải báo cáo từ {REPORTS_TABLE}…</span>
      </div>
    );
  }

  return (
    <div className="dash-fade-up">
      {error ? (
        <div className="mb-[14px] text-[12px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[8px] px-3 py-2 bg-[var(--Rd)]/15 flex flex-wrap items-center gap-3">
          {error}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline"
          >
            <RefreshCw size={12} /> Thử lại
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-[10px] mb-[14px]">
        <KpiCard
          label="Tổng DT (khai báo MKT)"
          value={formatVndDots(totals.revenue)}
          sub={`VNĐ · Tháng ${monthLabel} · ${REPORTS_TABLE}`}
          delta="Cộng revenue trong tháng"
          deltaType="nt"
          icon="💰"
          barColor="linear-gradient(90deg, var(--accent), #5b4dff)"
          animationDelay={0.03}
          valueSize="lg"
        />
        <KpiCard
          label="Tổng chi phí Ads khai báo"
          value={formatVndDots(totals.adCost)}
          sub={
            totals.adsDtPct != null
              ? `Ads/DT: ${totals.adsDtPct.toFixed(1)}%`
              : 'Ads/DT: — (chưa có DT)'
          }
          delta="Theo ad_cost trong tháng"
          deltaType="nt"
          icon="📢"
          barColor="linear-gradient(90deg, var(--R), #f97316)"
          animationDelay={0.06}
          valueSize="lg"
        />
        <KpiCard
          label="Ngân sách / Agency (nạp)"
          value="—"
          sub="Không có trong detail_reports"
          delta="Xem mục Ngân sách"
          deltaType="nt"
          icon="🏦"
          barColor="linear-gradient(90deg, var(--G), #06b6d4)"
          animationDelay={0.09}
          valueSize="lg"
        />
        <KpiCard
          label="Tổng lead / Chốt đơn"
          value={`${Math.round(totals.tongLead).toLocaleString('vi-VN')} / ${Math.round(totals.orders).toLocaleString('vi-VN')}`}
          sub={
            totals.chotPct != null
              ? `Tỷ lệ chốt: ${totals.chotPct.toFixed(1)}%`
              : 'Tỷ lệ chốt: —'
          }
          delta={
            totals.aov != null ? `AOV ~ ${formatVndDots(totals.aov)}đ` : 'AOV: —'
          }
          deltaType="up"
          icon="👥"
          barColor="linear-gradient(90deg, var(--P), #ec4899)"
          animationDelay={0.12}
          valueSize="lg"
        />
        <KpiCard
          label="Marketing ngưỡng Ads/DT đỏ"
          value={String(burnMarketers.length)}
          sub={`≥ ${ADS_DT_WARN}% · có DT & chi ads`}
          delta={burnMarketers.length ? 'Kiểm tra bảng hiệu suất' : 'Trong ngưỡng (theo dữ liệu)'}
          deltaType={burnMarketers.length ? 'dn' : 'nt'}
          icon="🔥"
          barColor="linear-gradient(90deg, var(--Y), var(--R))"
          animationDelay={0.15}
          valueColor={burnMarketers.length ? 'var(--R)' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[14px] items-stretch mb-[14px]">
        <div className="lg:col-span-2 flex">
          <SectionCard
            className="flex-1"
            title="📊 Hiệu suất Marketing — Gộp theo email / tên"
            subtitle={`Tháng ${monthLabel} · ${byMarketer.length} người có dòng · ${rows.length} dòng · ${REPORTS_TABLE}`}
            actions={
              <button
                type="button"
                onClick={() => void load()}
                className="btn-ghost py-[4.5px] px-[10px] text-[10.5px] rounded-[6px] flex items-center gap-[5px] bg-[rgba(255,255,255,0.05)] text-[var(--text2)] border-[var(--border)]"
              >
                <RefreshCw size={12} /> Làm mới
              </button>
            }
            bodyPadding={false}
          >
            <div className="overflow-x-auto h-full">
              {rankRows.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-[var(--text3)]">
                  Chưa có dòng nào trong {REPORTS_TABLE} cho tháng này.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                      <th className="p-[7px_12px] text-center">#</th>
                      <th className="p-[7px_12px]">Marketing</th>
                      <th className="p-[7px_12px] text-right">Doanh số</th>
                      <th className="p-[7px_12px] text-right">Chi phí</th>
                      <th className="p-[7px_12px] text-right">Ads/DT</th>
                      <th className="p-[7px_12px] text-right">CPL</th>
                      <th className="p-[7px_12px] text-right">CPO</th>
                      <th className="p-[7px_12px] text-right">Chốt%</th>
                      <th className="p-[7px_12px]">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11.5px] text-[var(--text2)]">
                    {rankRows.map(({ rank, m, adsPct, cpl, cpo, chot, status, isBurn }) => (
                      <tr
                        key={m.key}
                        className={
                          isBurn
                            ? 'border-b border-[rgba(224,61,61,0.08)] bg-[rgba(224,61,61,0.02)] hover:bg-[rgba(224,61,61,0.04)] transition-colors'
                            : 'border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.018)] transition-colors'
                        }
                      >
                        <td
                          className={`p-[9px_12px] text-center font-[var(--mono)] font-extrabold text-[12.5px] ${
                            rank <= 3 ? 'text-[var(--gold)]' : 'text-[var(--text3)]'
                          }`}
                        >
                          {isBurn ? <span className="text-[var(--R)]">!</span> : rank}
                        </td>
                        <td className="p-[9px_12px]">
                          <div className="font-bold text-[var(--text)] text-[11.5px]">{m.displayName}</div>
                          <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">
                            {m.team || '—'}
                          </div>
                        </td>
                        <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--G)] font-extrabold text-[11px]">
                          {formatCompactVnd(m.revenue)}
                        </td>
                        <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px] text-[var(--text2)]">
                          {formatCompactVnd(m.adCost)}
                        </td>
                        <td className="p-[9px_12px] text-right">
                          <span
                            className={`p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold ${
                              status === 'bad'
                                ? 'bg-[rgba(224,61,61,0.15)] text-[var(--R)]'
                                : status === 'med'
                                  ? 'bg-[rgba(91,77,255,0.15)] text-[var(--B)]'
                                  : 'bg-[rgba(15,168,109,0.12)] text-[var(--G)]'
                            }`}
                          >
                            {m.revenue > 0 ? `${adsPct.toFixed(1)}%` : m.adCost > 0 ? '—' : '0%'}
                          </span>
                        </td>
                        <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">
                          {cpl != null && Number.isFinite(cpl) ? formatCompactVnd(cpl) : '—'}
                        </td>
                        <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">
                          {cpo != null && Number.isFinite(cpo) ? formatCompactVnd(cpo) : '—'}
                        </td>
                        <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px] font-bold text-[var(--text)]">
                          {chot != null ? `${chot.toFixed(1)}%` : '—'}
                        </td>
                        <td className="p-[9px_12px]">
                          {status === 'bad' ? (
                            <span className="bg-[rgba(224,61,61,0.15)] text-[var(--R)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold flex items-center gap-[4px] w-fit">
                              ● Đắt tiền
                            </span>
                          ) : status === 'med' ? (
                            <span className="bg-[rgba(91,77,255,0.15)] text-[var(--B)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold flex items-center gap-[4px] w-fit">
                              ● Khá
                            </span>
                          ) : (
                            <span className="bg-[rgba(15,168,109,0.12)] text-[var(--G)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold flex items-center gap-[4px] w-fit">
                              ● Tốt
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-[14px]">
          <SectionCard
            title="🚨 Cảnh báo (theo Ads/DT trong tháng)"
            badge={{ text: `${burnMarketers.length} MKT`, type: burnMarketers.length ? 'R' : 'G' }}
          >
            <div className="flex flex-col gap-[7px]">
              {burnMarketers.length === 0 ? (
                <div className="text-[11px] text-[var(--text3)]">
                  Không có marketer nào vượt ngưỡng {ADS_DT_WARN}% (có đủ DT & chi ads) trong dữ liệu tháng này.
                </div>
              ) : (
                burnMarketers.slice(0, 6).map((m) => {
                  const pct = m.revenue > 0 ? (m.adCost / m.revenue) * 100 : 0;
                  return (
                    <AlertItem
                      key={m.key}
                      title={`${m.displayName} — Ads/DT ${pct.toFixed(0)}%`}
                      description={`Chi ${formatCompactVnd(m.adCost)} · DT ${formatCompactVnd(m.revenue)} · ${REPORTS_TABLE}`}
                      statusText="Ngưỡng đỏ"
                      statusType="R"
                    />
                  );
                })
              )}
            </div>
          </SectionCard>

          <SectionCard title="💰 Duyệt ngân sách" badge={{ text: 'Nguồn khác', type: 'Y' }}>
            <p className="text-[11px] text-[var(--text3)] leading-relaxed">
              Luồng nạp / duyệt agency không nằm trong <code className="text-[10px] text-[var(--text2)]">{REPORTS_TABLE}</code>.
              Mở mục <strong className="text-[var(--text)]">Ngân sách</strong> để xử lý yêu cầu.
            </p>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title={`⚖️ Tổng quan tháng ${monthLabel} — ${REPORTS_TABLE}`}
        subtitle="Chỉ số gộp từ báo cáo MKT; lớp nạp agency / Meta API cần nguồn khác."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
          <div>
            <div className="text-[9.5px] font-extrabold tracking-[1px] uppercase text-[var(--text3)] mb-[12px]">
              Lớp 1 — Nạp vs khai báo (chi)
            </div>
            <BarRow
              label="Đã nạp (Agency)"
              value="—"
              widthPercent={0}
              color="var(--text3)"
            />
            <BarRow
              label="MKT khai báo chi"
              value={formatCompactVnd(barLayer1Declared)}
              widthPercent={100}
              color="var(--G)"
            />
            <div className="text-[10px] text-[var(--text3)] mt-2">
              Cột &quot;Đã nạp&quot; không có trong <code className="text-[9px]">{REPORTS_TABLE}</code>.
            </div>
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold tracking-[1px] uppercase text-[var(--text3)] mb-[12px]">
              Lớp 2 — So với API ads
            </div>
            <p className="text-[11px] text-[var(--text3)]">
              So sánh với Meta/Google API không lấy được từ <code className="text-[10px] text-[var(--text2)]">{REPORTS_TABLE}</code> — cần tích hợp riêng.
            </p>
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold tracking-[1px] uppercase text-[var(--text3)] mb-[12px]">
              Lớp 3 — Lead / đơn / chốt (báo cáo)
            </div>
            <BarRow
              label="Tổng lead"
              value={Math.round(totals.tongLead).toLocaleString('vi-VN')}
              widthPercent={100}
              color="var(--P)"
            />
            <BarRow
              label="Đơn chốt"
              value={Math.round(totals.orders).toLocaleString('vi-VN')}
              widthPercent={barLayer3Max > 0 ? Math.min(100, (totals.orders / barLayer3Max) * 100) : 0}
              color="var(--G)"
            />
            <BarRow
              label="Tỷ lệ chốt TB"
              value={totals.chotPct != null ? `${totals.chotPct.toFixed(1)}%` : '—'}
              widthPercent={totals.chotPct != null ? Math.min(100, totals.chotPct) : 0}
              color="var(--accent)"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
