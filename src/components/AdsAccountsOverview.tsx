/**
 * Tổng quan TKQC — biểu đồ doanh/chi, giá mess, top 5 (Supabase tkqc_accounts)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Flame, TrendingUp, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatVnd } from './dashboardAdminUtils';
import type { TkqcAccountRow } from './AdsTkqcAccountsTable';

const TABLE = import.meta.env.VITE_SUPABASE_TKQC_ACCOUNTS_TABLE?.trim() || 'tkqc_accounts';

function num(v: number | null | undefined): number {
  return v == null || Number.isNaN(Number(v)) ? 0 : Number(v);
}

type RowExtras = TkqcAccountRow & {
  chiPerMess: number | null;
  doanhPerMess: number | null;
};

function enrich(rows: TkqcAccountRow[]): RowExtras[] {
  return rows.map((r) => {
    const sm = num(r.so_mess);
    const chi = num(r.tong_chi);
    const ds = num(r.doanh_so);
    if (sm <= 0) return { ...r, chiPerMess: null, doanhPerMess: null };
    return { ...r, chiPerMess: chi / sm, doanhPerMess: ds / sm };
  });
}

function BarPair({
  label,
  aPct,
  bPct,
  aColor,
  bColor,
}: {
  label: string;
  aPct: number;
  bPct: number;
  aColor: string;
  bColor: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-crm-on-surface truncate" title={label}>
        {label}
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex-1 h-2.5 rounded-full bg-crm-surface-accent/80 overflow-hidden">
          <div className={`h-full ${aColor} rounded-full transition-all`} style={{ width: `${Math.min(100, aPct)}%` }} />
        </div>
        <div className="flex-1 h-2.5 rounded-full bg-crm-surface-accent/80 overflow-hidden">
          <div className={`h-full ${bColor} rounded-full transition-all`} style={{ width: `${Math.min(100, bPct)}%` }} />
        </div>
      </div>
    </div>
  );
}

export function AdsAccountsOverview() {
  const [rows, setRows] = useState<TkqcAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from(TABLE).select('*').order('tkqc', { ascending: true });
    if (err) {
      console.error(err);
      setError(err.message || 'Không tải được dữ liệu TKQC');
      setRows([]);
    } else {
      setRows((data || []) as TkqcAccountRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const enriched = useMemo(() => enrich(rows), [rows]);

  const chartRows = useMemo(() => {
    const list = [...enriched];
    list.sort((a, b) => num(b.doanh_so) + num(b.tong_chi) - (num(a.doanh_so) + num(a.tong_chi)));
    return list.slice(0, 10);
  }, [enriched]);

  const maxDoanhChi = useMemo(() => {
    let m = 0;
    for (const r of chartRows) {
      m = Math.max(m, num(r.doanh_so), num(r.tong_chi));
    }
    return m || 1;
  }, [chartRows]);

  const messChartRows = useMemo(() => {
    const withMess = enriched.filter((r) => r.chiPerMess != null && r.chiPerMess! > 0);
    withMess.sort((a, b) => num(b.doanh_so) + num(b.tong_chi) - (num(a.doanh_so) + num(a.tong_chi)));
    return withMess.slice(0, 10);
  }, [enriched]);

  const maxMessPair = useMemo(() => {
    let m = 0;
    for (const r of messChartRows) {
      m = Math.max(m, num(r.chiPerMess), num(r.doanhPerMess));
    }
    return m || 1;
  }, [messChartRows]);

  const topSpend = useMemo(() => {
    return [...enriched].sort((a, b) => num(b.tong_chi) - num(a.tong_chi)).slice(0, 5);
  }, [enriched]);

  const topRevenue = useMemo(() => {
    return [...enriched].sort((a, b) => num(b.doanh_so) - num(a.doanh_so)).slice(0, 5);
  }, [enriched]);

  /** Xếp theo giá mess (chi phí / tin nhắn) — thấp → cao */
  const byMessPrice = useMemo(() => {
    const ok = enriched.filter((r) => r.chiPerMess != null && num(r.so_mess) > 0);
    ok.sort((a, b) => num(a.chiPerMess) - num(b.chiPerMess));
    return ok;
  }, [enriched]);

  return (
    <div id="crm-ads-overview" className="w-full max-w-6xl mx-auto px-0 sm:px-1 space-y-6 pb-6">
      <div className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30">
        <div className="px-5 sm:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-crm-on-surface tracking-tight">Tổng quan tài khoản quảng cáo</h2>
            <p className="text-xs text-crm-on-surface-variant mt-1">
              Nguồn: <code className="text-crm-primary">{TABLE}</code> — so sánh doanh thu &amp; chi phí, giá mess, xếp hạng TKQC
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchRows()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary/15 hover:bg-crm-primary/25 text-crm-primary text-xs font-bold uppercase tracking-wider border border-crm-primary/30 transition-colors disabled:opacity-50"
          >
            <Loader2 className={loading ? 'animate-spin' : ''} size={16} />
            Làm mới
          </button>
        </div>

        {error && (
          <div className="mx-5 sm:mx-8 mt-4 px-4 py-3 rounded-xl border border-crm-error/50 bg-crm-error/10 text-sm text-crm-error">
            {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-crm-primary w-10 h-10" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-8 py-12 text-center text-crm-on-surface-variant text-sm">
            Chưa có dữ liệu TKQC. Thêm tại{' '}
            <span className="text-crm-primary font-medium">Tài khoản Ads → Danh sách TKQC</span> hoặc chạy SQL{' '}
            <code className="text-crm-primary">create_tkqc_accounts.sql</code>.
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="crm-glass-card rounded-xl border border-crm-outline/30 p-4 sm:p-5">
                <h3 className="text-sm font-bold text-crm-on-surface mb-1 flex items-center gap-2">
                  <TrendingUp size={18} className="text-crm-primary" />
                  So sánh doanh thu &amp; chi phí
                </h3>
                <p className="text-[11px] text-crm-on-surface-variant mb-4">
                  Top 10 TK theo quy mô (doanh + chi). Mỗi dòng: cột trái = doanh số, cột phải = tổng chi (tỷ lệ theo max trong nhóm).
                </p>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-crm-on-surface-variant mb-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-crm-primary" /> Doanh số
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/90" /> Chi phí QC
                  </span>
                </div>
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                  {chartRows.map((r) => (
                    <BarPair
                      key={r.id}
                      label={r.tkqc}
                      aPct={(num(r.doanh_so) / maxDoanhChi) * 100}
                      bPct={(num(r.tong_chi) / maxDoanhChi) * 100}
                      aColor="bg-crm-primary"
                      bColor="bg-amber-500/90"
                    />
                  ))}
                </div>
              </div>

              <div className="crm-glass-card rounded-xl border border-crm-outline/30 p-4 sm:p-5">
                <h3 className="text-sm font-bold text-crm-on-surface mb-1 flex items-center gap-2">
                  <MessageCircle size={18} className="text-crm-secondary" />
                  So sánh giá mess
                </h3>
                <p className="text-[11px] text-crm-on-surface-variant mb-4">
                  Chỉ TK có <strong className="text-crm-on-surface">số mess &gt; 0</strong>. Cột trái: chi phí / mess · Cột phải: doanh số / mess (VND/mess).
                </p>
                {messChartRows.length === 0 ? (
                  <p className="text-sm text-crm-on-surface-variant">Không có dòng nào có số mess để tính giá mess.</p>
                ) : (
                  <>
                    <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-crm-on-surface-variant mb-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-400/90" /> Chi / mess
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/90" /> Doanh / mess
                      </span>
                    </div>
                    <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                      {messChartRows.map((r) => (
                        <BarPair
                          key={r.id}
                          label={r.tkqc}
                          aPct={(num(r.chiPerMess) / maxMessPair) * 100}
                          bPct={(num(r.doanhPerMess) / maxMessPair) * 100}
                          aColor="bg-rose-400/90"
                          bColor="bg-emerald-400/90"
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="crm-glass-card rounded-xl border border-crm-error/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-crm-outline/30 bg-crm-error/5 flex items-center gap-2">
                  <Flame className="text-crm-error shrink-0" size={18} />
                  <h3 className="text-sm font-bold text-crm-on-surface">Top 5 TKQC đốt tiền (chi phí cao nhất)</h3>
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-crm-surface-accent/40 text-[10px] uppercase text-crm-on-surface-variant">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">TKQC</th>
                      <th className="px-3 py-2 hidden sm:table-cell">Đơn vị</th>
                      <th className="px-3 py-2 text-right">Tổng chi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-crm-outline/20">
                    {topSpend.map((r, i) => (
                      <tr key={r.id} className="hover:bg-crm-surface-accent/20">
                        <td className="px-3 py-2.5 tabular-nums text-crm-on-surface-variant">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-crm-on-surface">{r.tkqc}</td>
                        <td className="px-3 py-2.5 text-crm-on-surface-variant text-xs max-w-[140px] truncate hidden sm:table-cell">
                          {r.don_vi || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-crm-error/90">
                          {formatVnd(num(r.tong_chi))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="crm-glass-card rounded-xl border border-crm-primary/25 overflow-hidden">
                <div className="px-4 py-3 border-b border-crm-outline/30 bg-crm-primary/5 flex items-center gap-2">
                  <TrendingUp className="text-crm-primary shrink-0" size={18} />
                  <h3 className="text-sm font-bold text-crm-on-surface">Top 5 TKQC doanh số cao nhất</h3>
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-crm-surface-accent/40 text-[10px] uppercase text-crm-on-surface-variant">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">TKQC</th>
                      <th className="px-3 py-2 hidden sm:table-cell">Đơn vị</th>
                      <th className="px-3 py-2 text-right">Doanh số</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-crm-outline/20">
                    {topRevenue.map((r, i) => (
                      <tr key={r.id} className="hover:bg-crm-surface-accent/20">
                        <td className="px-3 py-2.5 tabular-nums text-crm-on-surface-variant">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-crm-on-surface">{r.tkqc}</td>
                        <td className="px-3 py-2.5 text-crm-on-surface-variant text-xs max-w-[140px] truncate hidden sm:table-cell">
                          {r.don_vi || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-crm-primary">
                          {formatVnd(num(r.doanh_so))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="crm-glass-card rounded-xl border border-crm-outline/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-crm-outline/30 bg-crm-surface-accent/30">
                <h3 className="text-sm font-bold text-crm-on-surface flex items-center gap-2">
                  <MessageCircle size={18} className="text-crm-accent-warm" />
                  Xếp theo giá mess (chi phí ÷ số mess)
                </h3>
                <p className="text-[11px] text-crm-on-surface-variant mt-1">
                  Thứ tự: <strong className="text-crm-on-surface">rẻ nhất → đắt nhất</strong> (VND / 1 tin nhắn). Chỉ các TK có số mess &gt; 0.
                </p>
              </div>
              <div className="overflow-x-auto max-h-[min(420px,50vh)] overflow-y-auto">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead className="sticky top-0 bg-crm-surface-accent/95 backdrop-blur-sm z-[1]">
                    <tr className="border-b border-crm-outline/40 text-[10px] uppercase text-crm-on-surface-variant">
                      <th className="px-3 py-2.5">Hạng</th>
                      <th className="px-3 py-2.5">TKQC</th>
                      <th className="px-3 py-2.5">Đơn vị</th>
                      <th className="px-3 py-2.5 text-right">Số mess</th>
                      <th className="px-3 py-2.5 text-right">Giá mess (chi)</th>
                      <th className="px-3 py-2.5 text-right">Doanh / mess</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-crm-outline/15">
                    {byMessPrice.map((r, i) => (
                      <tr key={r.id} className="hover:bg-crm-surface-accent/15">
                        <td className="px-3 py-2.5 tabular-nums text-crm-on-surface-variant">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-crm-on-surface whitespace-nowrap">{r.tkqc}</td>
                        <td className="px-3 py-2.5 text-crm-on-surface-variant text-xs max-w-[180px] truncate">{r.don_vi || '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{num(r.so_mess).toLocaleString('vi-VN')}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-rose-300/95">
                          {formatVnd(num(r.chiPerMess))}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-300/95">
                          {formatVnd(num(r.doanhPerMess))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {byMessPrice.length === 0 && (
                  <p className="px-4 py-8 text-center text-crm-on-surface-variant text-sm">Không có dữ liệu mess.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
