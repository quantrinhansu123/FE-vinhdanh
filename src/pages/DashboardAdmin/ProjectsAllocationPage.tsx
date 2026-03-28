/**
 * Phân bổ ngân sách — ngân sách dự án (du_an) phân bổ tới từng TKQC
 * Ưu tiên bảng `tkqc` (create_du_an_tkqc.sql). Nếu chưa tạo bảng đó, fallback: `tkqc_accounts` khớp `don_vi` với `du_an`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, PieChart } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { formatVnd } from '../../utils/dashboardAdminUtils';
import type { DuAnRow, TkqcRow } from '../../types';

const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_PROJECT_TABLE?.trim() || 'tkqc';
const TKQC_ACCOUNTS_TABLE = import.meta.env.VITE_SUPABASE_TKQC_ACCOUNTS_TABLE?.trim() || 'tkqc_accounts';

type AllocationSource = 'tkqc' | 'tkqc_accounts';


type MergedTkqc = TkqcRow & {
  du_an: DuAnRow | null;
};

function num(v: number | null | undefined): number {
  return v == null || Number.isNaN(Number(v)) ? 0 : Number(v);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(2)}%`;
}

function normalizeDonVi(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase();
}

/** PostgREST khi bảng chưa tồn tại / chưa vào schema cache */
function isTableMissingInSchemaCache(err: { message?: string } | null): boolean {
  const m = (err?.message ?? '').toLowerCase();
  return m.includes('could not find') && m.includes('table') && m.includes('schema cache');
}

export function ProjectsAllocationPage() {
  const [rows, setRows] = useState<MergedTkqc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allocationSource, setAllocationSource] = useState<AllocationSource | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAllocationSource(null);

    const tkqcRes = await supabase.from(TKQC_TABLE).select('*').order('ma_tkqc', { ascending: true });
    let tkqcList: TkqcRow[] = [];

    if (tkqcRes.error) {
      if (isTableMissingInSchemaCache(tkqcRes.error)) {
        const { data: accData, error: accErr } = await supabase
          .from(TKQC_ACCOUNTS_TABLE)
          .select('id, tkqc, page, don_vi, ngan_sach, tong_chi, doanh_so')
          .order('tkqc', { ascending: true });
        if (accErr) {
          console.error(accErr);
          setError(
            accErr.message ||
            `Không đọc được ${TKQC_TABLE} và ${TKQC_ACCOUNTS_TABLE}. Chạy supabase/create_du_an_tkqc.sql (bảng tkqc) hoặc create_tkqc_accounts.sql.`
          );
          setRows([]);
          setLoading(false);
          return;
        }
        const { data: allDuAn, error: duErr } = await supabase.from(DU_AN_TABLE).select('id, don_vi');
        if (duErr) {
          console.error(duErr);
          setError(duErr.message || 'Không tải được danh sách dự án để ghép đơn vị');
          setRows([]);
          setLoading(false);
          return;
        }
        const byDonVi = new Map<string, string>();
        for (const d of allDuAn || []) {
          const key = normalizeDonVi((d as { don_vi?: string | null }).don_vi);
          if (key && !byDonVi.has(key)) byDonVi.set(key, (d as { id: string }).id);
        }
        tkqcList = (accData || [])
          .map((a) => {
            const row = a as {
              id: string;
              tkqc: string;
              page: string | null;
              don_vi: string | null;
              ngan_sach: number | null;
              tong_chi: number | null;
              doanh_so: number | null;
            };
            const key = normalizeDonVi(row.don_vi);
            const id_du_an = key ? byDonVi.get(key) : undefined;
            if (!id_du_an) return null;
            const ds = num(row.doanh_so);
            const chi = num(row.tong_chi);
            const tyLe = ds > 0 ? (chi / ds) * 100 : null;
            return {
              id: row.id,
              id_du_an,
              ma_tkqc: row.tkqc,
              ten_tkqc: row.tkqc,
              ten_pae: row.page,
              nen_tang: null,
              ngan_sach_phan_bo: row.ngan_sach,
              chi_phi_thuc_te: row.tong_chi,
              tong_doanh_so: row.doanh_so,
              ty_le_ads_doanh_so: tyLe,
            } as TkqcRow;
          })
          .filter((x): x is TkqcRow => x != null);
        setAllocationSource('tkqc_accounts');
      } else {
        console.error(tkqcRes.error);
        setError(tkqcRes.error.message || 'Không tải được bảng TKQC');
        setRows([]);
        setLoading(false);
        return;
      }
    } else {
      tkqcList = (tkqcRes.data || []) as TkqcRow[];
      setAllocationSource('tkqc');
    }
    const duAnIds = [...new Set(tkqcList.map((t) => t.id_du_an).filter(Boolean))];
    let duAnMap = new Map<string, DuAnRow>();

    if (duAnIds.length > 0) {
      const { data: duAnData, error: duAnErr } = await supabase
        .from(DU_AN_TABLE)
        .select('id, ma_du_an, ten_du_an, don_vi, ngan_sach_ke_hoach')
        .in('id', duAnIds);
      if (duAnErr) {
        console.error(duAnErr);
        setError(duAnErr.message || 'Không tải được dự án');
      } else {
        (duAnData || []).forEach((d) => duAnMap.set((d as DuAnRow).id, d as DuAnRow));
      }
    }

    const merged: MergedTkqc[] = tkqcList.map((t) => ({
      ...t,
      du_an: duAnMap.get(t.id_du_an) ?? null,
    }));
    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Gom theo dự án: tổng NS phân bổ cho các TKQC thuộc dự án */
  const reportByProject = useMemo(() => {
    const m = new Map<
      string,
      {
        du_an: DuAnRow | null;
        sumPhanBo: number;
        sumChiPhi: number;
        sumDoanhSo: number;
        soTkqc: number;
      }
    >();
    for (const r of rows) {
      const id = r.id_du_an;
      if (!m.has(id)) {
        m.set(id, {
          du_an: r.du_an,
          sumPhanBo: 0,
          sumChiPhi: 0,
          sumDoanhSo: 0,
          soTkqc: 0,
        });
      }
      const e = m.get(id)!;
      e.sumPhanBo += num(r.ngan_sach_phan_bo);
      e.sumChiPhi += num(r.chi_phi_thuc_te);
      e.sumDoanhSo += num(r.tong_doanh_so);
      e.soTkqc += 1;
      if (!e.du_an && r.du_an) e.du_an = r.du_an;
    }
    return Array.from(m.entries()).map(([id_du_an, v]) => ({
      id_du_an,
      ...v,
      keHoach: num(v.du_an?.ngan_sach_ke_hoach),
      conLai: num(v.du_an?.ngan_sach_ke_hoach) - v.sumPhanBo,
      tyLePhanBo:
        num(v.du_an?.ngan_sach_ke_hoach) > 0 ? (v.sumPhanBo / num(v.du_an?.ngan_sach_ke_hoach)) * 100 : null,
    }));
  }, [rows]);

  const totals = useMemo(() => {
    const tongPhanBo = rows.reduce((s, r) => s + num(r.ngan_sach_phan_bo), 0);
    const tongKeHoach = reportByProject.reduce((s, r) => s + r.keHoach, 0);
    const tongConLai = reportByProject.reduce((s, r) => s + r.conLai, 0);
    return { tongPhanBo, tongKeHoach, tongConLai };
  }, [rows, reportByProject]);

  return (
    <div className="w-full space-y-6 pb-4">
      <div id="crm-projects-allocation" className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30">
        <div className="px-6 lg:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-crm-on-surface tracking-tight flex items-center justify-center sm:justify-start gap-2">
              <PieChart className="text-crm-accent-warm shrink-0" size={22} />
              Phân bổ ngân sách dự án → TKQC
            </h2>
            <p className="text-xs text-crm-on-surface-variant mt-1">
              Báo cáo dựa trên <code className="text-crm-primary">{DU_AN_TABLE}</code> &{' '}
              <code className="text-crm-primary">
                {allocationSource === 'tkqc_accounts' ? TKQC_ACCOUNTS_TABLE : TKQC_TABLE}
              </code>{' '}
              (cột ngân sách phân bổ)
            </p>
            {allocationSource === 'tkqc_accounts' && (
              <p className="text-xs text-crm-accent-warm mt-2 max-w-[56ch] leading-relaxed">
                Bảng <code className="text-crm-primary">{TKQC_TABLE}</code> chưa có trên Supabase — đang ghép{' '}
                <code className="text-crm-primary">{TKQC_ACCOUNTS_TABLE}</code> với dự án theo trùng khớp{' '}
                <code className="text-crm-primary">don_vi</code>. Muốn phân bổ theo schema đầy đủ, chạy{' '}
                <code className="text-crm-primary">supabase/create_du_an_tkqc.sql</code>.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary/15 hover:bg-crm-primary/25 text-crm-primary text-xs font-bold uppercase tracking-wider border border-crm-primary/30 transition-colors disabled:opacity-50 self-center sm:self-auto"
          >
            <Loader2 className={loading ? 'animate-spin' : ''} size={16} />
            Làm mới
          </button>
        </div>

        {error && (
          <div className="mx-6 lg:mx-8 mt-4 px-4 py-3 rounded-xl border border-crm-error/50 bg-crm-error/10 text-sm text-crm-error">{error}</div>
        )}

        {/* Báo cáo tổng */}
        <div className="px-6 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-crm-outline/20">
          <div className="crm-glass-card rounded-xl p-4 border border-crm-outline/30 text-center sm:text-left">
            <p className="text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Tổng NS kế hoạch (dự án có TKQC)</p>
            <p className="text-xl font-extrabold text-crm-on-surface tabular-nums mt-1">{formatVnd(totals.tongKeHoach)}</p>
          </div>
          <div className="crm-glass-card rounded-xl p-4 border border-crm-primary/25 text-center sm:text-left">
            <p className="text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Tổng đã phân bổ cho TKQC</p>
            <p className="text-xl font-extrabold text-crm-primary tabular-nums mt-1">{formatVnd(totals.tongPhanBo)}</p>
          </div>
          <div className="crm-glass-card rounded-xl p-4 border border-crm-secondary/25 text-center sm:text-left">
            <p className="text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Chênh (KH − phân bổ)</p>
            <p
              className={`text-xl font-extrabold tabular-nums mt-1 ${totals.tongConLai >= 0 ? 'text-crm-success' : 'text-crm-error'
                }`}
            >
              {formatVnd(totals.tongConLai)}
            </p>
          </div>
        </div>

        {/* Theo từng dự án */}
        <div className="px-6 lg:px-8 py-6">
          <h3 className="text-sm font-bold text-crm-on-surface mb-3">Báo cáo theo dự án</h3>
          <div className="overflow-x-auto rounded-xl border border-crm-outline/30">
            <table className="w-full text-left border-collapse min-w-[880px]">
              <thead>
                <tr className="bg-crm-surface-accent/40 border-b border-crm-outline/40">
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase">Dự án</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase">Đơn vị</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase text-right">NS kế hoạch</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase text-right">Tổng phân bổ TKQC</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase text-right">Còn lại</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase text-right">% đã phân bổ</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase text-center">Số TKQC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-outline/20">
                {reportByProject.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-crm-on-surface-variant text-sm">
                      {loading
                        ? 'Đang tải…'
                        : allocationSource === 'tkqc_accounts'
                          ? 'Chưa có dòng nào: cần ít nhất một tài khoản trong tkqc_accounts có don_vi trùng với don_vi của một dự án, hoặc tạo bảng tkqc (create_du_an_tkqc.sql).'
                          : 'Chưa có dữ liệu phân bổ. Thêm dòng vào bảng tkqc (xem create_du_an_tkqc.sql).'}
                    </td>
                  </tr>
                ) : (
                  reportByProject.map((r) => (
                    <tr key={r.id_du_an} className="hover:bg-crm-surface-accent/20">
                      <td className="px-3 py-2.5 text-sm text-crm-on-surface">
                        <span className="font-mono text-crm-primary text-xs mr-1">{r.du_an?.ma_du_an || '—'}</span>
                        {r.du_an?.ten_du_an || '(Không tìm thấy dự án)'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-crm-on-surface-variant max-w-[120px] truncate">{r.du_an?.don_vi || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums">{formatVnd(r.keHoach)}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums font-semibold text-crm-primary">{formatVnd(r.sumPhanBo)}</td>
                      <td
                        className={`px-3 py-2.5 text-sm text-right tabular-nums font-medium ${r.conLai >= 0 ? 'text-crm-success' : 'text-crm-error'
                          }`}
                      >
                        {formatVnd(r.conLai)}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums text-crm-on-surface-variant">
                        {r.tyLePhanBo != null ? `${r.tyLePhanBo.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-center tabular-nums">{r.soTkqc}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chi tiết từng TKQC */}
        <div className="px-6 lg:px-8 py-8 border-t border-crm-outline/20">
          <h3 className="text-sm font-bold text-crm-on-surface mb-3">Chi tiết từng tài khoản TKQC</h3>
          <div className="overflow-x-auto rounded-xl border border-crm-outline/30">
            {loading && rows.length === 0 ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-crm-primary w-10 h-10" />
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-crm-surface-accent/40 border-b border-crm-outline/40">
                    <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase whitespace-nowrap">Mã dự án</th>
                    <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase min-w-[140px]">Tên dự án</th>
                    <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase whitespace-nowrap">Mã TKQC</th>
                    <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase">Tên TK / Page</th>
                    <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase whitespace-nowrap">Nền tảng</th>
                    <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase text-right">NS phân bổ</th>
                    <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase text-right">Chi phí thực</th>
                    <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase text-right">Doanh số</th>
                    <th className="px-3 py-2.5 text-[10px] font-extrabold text-crm-on-surface-variant uppercase text-right">% Ads/DS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-outline/20">
                  {rows.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-crm-on-surface-variant text-sm">
                        {allocationSource === 'tkqc_accounts' ? (
                          <>
                            Không có tài khoản nào khớp <code className="text-crm-primary">don_vi</code> với dự án. Kiểm tra{' '}
                            <code className="text-crm-primary">{TKQC_ACCOUNTS_TABLE}</code> và{' '}
                            <code className="text-crm-primary">{DU_AN_TABLE}</code>, hoặc chạy{' '}
                            <code className="text-crm-primary">create_du_an_tkqc.sql</code> để dùng bảng{' '}
                            <code className="text-crm-primary">{TKQC_TABLE}</code>.
                          </>
                        ) : (
                          <>
                            Chưa có dòng trong <code className="text-crm-primary">{TKQC_TABLE}</code>. Chạy{' '}
                            <code className="text-crm-primary">create_du_an_tkqc.sql</code> và thêm dữ liệu.
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="hover:bg-crm-surface-accent/20">
                        <td className="px-3 py-2.5 text-xs font-mono text-crm-primary whitespace-nowrap">{r.du_an?.ma_du_an || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-crm-on-surface">{r.du_an?.ten_du_an || '—'}</td>
                        <td className="px-3 py-2.5 text-sm font-medium text-crm-on-surface whitespace-nowrap">{r.ma_tkqc}</td>
                        <td className="px-3 py-2.5 text-xs text-crm-on-surface-variant max-w-[200px]">
                          <div className="font-medium text-crm-on-surface">{r.ten_tkqc || '—'}</div>
                          {r.ten_pae && <div className="opacity-80 truncate">{r.ten_pae}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-crm-on-surface-variant whitespace-nowrap">{r.nen_tang || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-right tabular-nums text-crm-primary font-semibold">{formatVnd(num(r.ngan_sach_phan_bo))}</td>
                        <td className="px-3 py-2.5 text-sm text-right tabular-nums">{formatVnd(num(r.chi_phi_thuc_te))}</td>
                        <td className="px-3 py-2.5 text-sm text-right tabular-nums">{formatVnd(num(r.tong_doanh_so))}</td>
                        <td className="px-3 py-2.5 text-sm text-right tabular-nums text-crm-on-surface-variant">{fmtPct(r.ty_le_ads_doanh_so)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
