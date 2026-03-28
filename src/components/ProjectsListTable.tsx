/**
 * Danh sách dự án — đọc từ Supabase bảng du_an
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatVnd } from './dashboardAdminUtils';

const TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';

export type DuAnRow = {
  id: string;
  ma_du_an: string | null;
  ten_du_an: string;
  don_vi: string | null;
  mo_ta: string | null;
  ngan_sach_ke_hoach: number | null;
  chi_phi_marketing_thuc_te: number | null;
  tong_doanh_so: number | null;
  ty_le_ads_doanh_so: number | null;
  ngay_bat_dau: string | null;
  ngay_ket_thuc: string | null;
  trang_thai: string;
};

const TRANG_THAI_LABEL: Record<string, string> = {
  dang_chay: 'Đang chạy',
  tam_dung: 'Tạm dừng',
  ket_thuc: 'Kết thúc',
  huy: 'Hủy',
};

function badgeTrangThai(s: string): string {
  if (s === 'dang_chay') return 'bg-crm-success/15 text-crm-success border-crm-success/30';
  if (s === 'tam_dung') return 'bg-crm-warning/15 text-crm-warning border-crm-warning/30';
  if (s === 'ket_thuc') return 'bg-crm-on-surface-variant/20 text-crm-on-surface-variant border-crm-outline/40';
  if (s === 'huy') return 'bg-crm-error/15 text-crm-error border-crm-error/30';
  return 'bg-crm-surface-accent text-crm-on-surface border-crm-outline/40';
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleDateString('vi-VN');
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(2)}%`;
}

export function ProjectsListTable() {
  const [rows, setRows] = useState<DuAnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from(TABLE)
      .select(
        'id, ma_du_an, ten_du_an, don_vi, ngan_sach_ke_hoach, chi_phi_marketing_thuc_te, tong_doanh_so, ty_le_ads_doanh_so, ngay_bat_dau, ngay_ket_thuc, trang_thai'
      )
      .order('ten_du_an', { ascending: true });
    if (err) {
      console.error(err);
      setError(err.message || 'Không tải được danh sách dự án');
      setRows([]);
    } else {
      setRows((data || []) as DuAnRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return (
    <div className="w-full max-w-6xl mx-auto px-0 sm:px-1">
      <div id="crm-projects-list" className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30">
        <div className="px-5 sm:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-crm-on-surface tracking-tight">Danh sách dự án</h2>
            <p className="text-xs text-crm-on-surface-variant mt-1">Nguồn: bảng {TABLE}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchRows()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary/15 hover:bg-crm-primary/25 text-crm-primary text-xs font-bold uppercase tracking-wider border border-crm-primary/30 transition-colors disabled:opacity-50 self-center sm:self-auto"
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

        <div className="overflow-x-auto p-4 sm:p-6">
          {loading && rows.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-crm-primary w-10 h-10" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-crm-surface-accent/40 border-b border-crm-outline/40">
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                    Mã dự án
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider min-w-[160px]">
                    Tên dự án
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                    Đơn vị
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">
                    NS kế hoạch
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">
                    Chi phí MT
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">
                    Doanh số
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">
                    % Ads/DS
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                    Bắt đầu
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                    Kết thúc
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-outline/20">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-crm-on-surface-variant text-sm">
                      Chưa có dự án. Chạy SQL <code className="text-crm-primary">supabase/create_du_an_table.sql</code> trên Supabase (hoặc đồng bộ từ{' '}
                      <code className="text-crm-primary">create_du_an_tkqc.sql</code>).
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-crm-surface-accent/25 transition-colors">
                      <td className="px-3 py-3 text-sm font-mono text-crm-primary whitespace-nowrap">{r.ma_du_an || '—'}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-crm-on-surface">{r.ten_du_an}</td>
                      <td className="px-3 py-3 text-sm text-crm-on-surface-variant max-w-[140px] truncate" title={r.don_vi || ''}>
                        {r.don_vi || '—'}
                      </td>
                      <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums whitespace-nowrap">
                        {formatVnd(Number(r.ngan_sach_ke_hoach) || 0)}
                      </td>
                      <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums whitespace-nowrap">
                        {formatVnd(Number(r.chi_phi_marketing_thuc_te) || 0)}
                      </td>
                      <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums whitespace-nowrap">
                        {formatVnd(Number(r.tong_doanh_so) || 0)}
                      </td>
                      <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums whitespace-nowrap">{fmtPct(r.ty_le_ads_doanh_so)}</td>
                      <td className="px-3 py-3 text-sm text-crm-on-surface whitespace-nowrap">{fmtDate(r.ngay_bat_dau)}</td>
                      <td className="px-3 py-3 text-sm text-crm-on-surface whitespace-nowrap">{fmtDate(r.ngay_ket_thuc)}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeTrangThai(r.trang_thai)}`}
                        >
                          {TRANG_THAI_LABEL[r.trang_thai] || r.trang_thai}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
