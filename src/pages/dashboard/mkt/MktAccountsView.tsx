import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { AuthUser, TkqcAdListRow } from '../../../types';

const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';
const MARKETING_STAFF_TABLE = import.meta.env.VITE_SUPABASE_MARKETING_STAFF_TABLE?.trim() || 'marketing_staff';

const TKQC_SELECT = `
  id,
  id_du_an,
  ma_tkqc,
  ten_tkqc,
  ten_pae,
  nen_tang,
  ngan_sach_phan_bo,
  ngay_bat_dau,
  trang_thai_tkqc,
  agency,
  id_marketing_staff,
  du_an ( id, ma_du_an, ten_du_an, don_vi, ngay_bat_dau ),
  marketing_staff ( id_ns, name )
`;

function formatDateVn(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function effectiveTkqcTrangThai(row: TkqcAdListRow): 'active' | 'thieu_thiet_lap' {
  return row.trang_thai_tkqc === 'thieu_thiet_lap' ? 'thieu_thiet_lap' : 'active';
}

function tkqcStatusBadge(row: TkqcAdListRow): React.ReactNode {
  if (effectiveTkqcTrangThai(row) === 'thieu_thiet_lap') {
    return (
      <span className="inline-flex items-center gap-[4px] p-[2.5px_8px] bg-[rgba(224,61,61,0.12)] text-[var(--R)] rounded-[4px] text-[9.5px] font-extrabold border border-[rgba(224,61,61,0.2)]">
        Thiếu thiết lập
      </span>
    );
  }
  return <Badge type="G">Active</Badge>;
}

export type MktAccountsViewProps = {
  reportUser?: AuthUser | null;
};

export const MktAccountsView: React.FC<MktAccountsViewProps> = ({ reportUser = null }) => {
  const [rows, setRows] = useState<TkqcAdListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!reportUser?.id?.trim()) {
      setRows([]);
      setLoading(false);
      setError('Cần đăng nhập CRM (bảng employees) để xem TKQC được gán cho bạn.');
      return;
    }

    const empId = reportUser.id.trim();
    const emailLower = reportUser.email?.trim().toLowerCase() || '';

    let staffIds: string[] = [];
    const byEmp = await supabase.from(MARKETING_STAFF_TABLE).select('id').eq('employee_id', empId);
    if (byEmp.error) {
      console.warn('mkt-accounts marketing_staff by employee_id:', byEmp.error);
    } else {
      staffIds = (byEmp.data || []).map((r) => String((r as { id: string }).id));
    }

    if (staffIds.length === 0 && emailLower) {
      const byEmail = await supabase.from(MARKETING_STAFF_TABLE).select('id').ilike('email', emailLower);
      if (byEmail.error) {
        console.warn('mkt-accounts marketing_staff by email:', byEmail.error);
      } else {
        staffIds = (byEmail.data || []).map((r) => String((r as { id: string }).id));
      }
    }

    if (staffIds.length === 0) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    const { data, error: qErr } = await supabase
      .from(TKQC_TABLE)
      .select(TKQC_SELECT)
      .in('id_marketing_staff', staffIds)
      .order('ten_tkqc', { ascending: true, nullsFirst: false })
      .order('ma_tkqc', { ascending: true });

    if (qErr) {
      console.error('mkt-accounts tkqc:', qErr);
      setError(
        qErr.message.includes('does not exist') || qErr.message.includes('schema cache')
          ? `Chưa có bảng ${TKQC_TABLE} hoặc FK embed. Chạy script Supabase tkqc/marketing_staff.`
          : qErr.message || 'Không tải được danh sách TKQC.'
      );
      setRows([]);
    } else {
      setRows((data || []) as TkqcAdListRow[]);
    }
    setLoading(false);
  }, [reportUser?.id, reportUser?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="🎯 Tài khoản Ads của tôi"
        subtitle="Dữ liệu từ Supabase · tkqc theo marketing_staff (employee_id / email)"
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[var(--text2)] py-[6px] px-[10px] rounded-[6px] text-[11px] font-bold border border-[rgba(255,255,255,0.08)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        }
      >
        {error && (
          <div className="mb-3 text-[11px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[8px] px-3 py-2 bg-[rgba(224,61,61,0.06)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[var(--text3)] text-[12px]">
            <Loader2 className="animate-spin" size={20} />
            Đang tải TKQC…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-[12px] text-[var(--text3)] py-8 text-center font-bold space-y-2">
            <p>Chưa có tài khoản QC nào gán cho bạn.</p>
            <p className="text-[10px] font-normal text-[var(--text2)] max-w-[480px] mx-auto">
              Admin cần tạo dòng trong <code className="text-[var(--text)]">marketing_staff</code> (trùng{' '}
              <code className="text-[var(--text)]">employee_id</code> với nhân sự đăng nhập hoặc cùng email) và chọn MKT trên
              TKQC.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-[12px]">
            {rows.map((row) => {
              const duAn = row.du_an;
              const agency = row.agency?.trim() || duAn?.don_vi?.trim() || '—';
              const displayName = row.ten_tkqc?.trim() || row.ten_pae?.trim() || row.ma_tkqc;
              const fanpage = row.ten_pae?.trim() || '—';
              const nenTang = row.nen_tang?.trim() || '';
              const start = formatDateVn(row.ngay_bat_dau || duAn?.ngay_bat_dau);

              return (
                <div
                  key={row.id}
                  className="bg-[var(--bg3)] border border-[var(--border)] rounded-[12px] p-[16px_20px] flex items-center gap-[24px] transition-all hover:bg-[rgba(255,255,255,0.015)] hover:border-[rgba(61,142,240,0.3)] group"
                >
                  <div className="font-[var(--mono)] text-[11.5px] text-[var(--accent)] font-black w-[80px] shrink-0 truncate" title={row.ma_tkqc}>
                    {row.ma_tkqc}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-black text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                      {displayName}
                    </div>
                    <div className="text-[10.5px] text-[var(--text3)] mt-[4px] flex items-center gap-[6px] overflow-hidden flex-wrap">
                      <span>{agency}</span>
                      {nenTang ? (
                        <>
                          <span className="opacity-30">·</span>
                          <span>{nenTang}</span>
                        </>
                      ) : null}
                      <span className="opacity-30">·</span>
                      <span>VNĐ</span>
                      <span className="opacity-30">·</span>
                      <span>Fanpage / PAE: {fanpage}</span>
                      <span className="opacity-30">·</span>
                      <span>Bắt đầu: {start}</span>
                      {duAn?.ten_du_an ? (
                        <>
                          <span className="opacity-30">·</span>
                          <span className="truncate max-w-[200px]" title={duAn.ten_du_an}>
                            DA: {duAn.ma_du_an ? `${duAn.ma_du_an} · ` : ''}
                            {duAn.ten_du_an}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0">{tkqcStatusBadge(row)}</div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
};
