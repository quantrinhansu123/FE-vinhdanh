import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import { fetchAllRows } from '../../../api/fetchAllRows';
import { STITCH_PORTAL_CLASS, StitchButton } from '../../../components/ui/StitchUI';
import '../../../styles/stitchSystem.css';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const KPI_STAFF_TABLE =
  import.meta.env.VITE_SUPABASE_KPI_STAFF_MONTHLY_TARGETS_TABLE?.trim() || 'kpi_staff_monthly_targets';

type StaffOption = { id: string; name: string; ma_ns: string | null };
type TargetRow = { employee_id: string; nam_thang: string; muc_tieu_vnd: number };

function currentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatVnd(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
}

export const AdminKpisView: React.FC = () => {
  const initialMonth = useMemo(() => currentMonth(), []);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [targetRows, setTargetRows] = useState<TargetRow[]>([]);
  const [targetMonth, setTargetMonth] = useState(initialMonth);
  const [showAddModal, setShowAddModal] = useState(false);
  const [draftMonth, setDraftMonth] = useState(initialMonth);
  const [draftEmployee, setDraftEmployee] = useState('');
  const [draftTarget, setDraftTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStaffError(null);
    const { data, error: queryError } = await fetchAllRows<StaffOption>(supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, ma_ns')
      .order('name'));

    if (queryError) {
      console.error('admin-kpis staff:', queryError);
      setStaffError(queryError.message || 'Không tải được danh sách nhân sự.');
      setStaff([]);
      setLoading(false);
      return;
    }

    setStaff((data || []) as StaffOption[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadTargets = useCallback(async (selectedMonth: string) => {
    const { data, error: queryError } = await supabase
      .from(KPI_STAFF_TABLE)
      .select('employee_id, nam_thang, muc_tieu_vnd')
      .eq('nam_thang', selectedMonth)
      .order('updated_at', { ascending: false });
    if (queryError) {
      console.error('admin-kpis targets:', queryError);
      setTargetError(queryError.message || 'Không tải được mục tiêu KPI.');
      setTargetRows([]);
      return;
    }
    setTargetError(null);
    setTargetRows((data || []) as TargetRow[]);
  }, []);

  useEffect(() => {
    void loadTargets(targetMonth);
  }, [loadTargets, targetMonth]);

  const saveTarget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetValue = Number(draftTarget);
    if (!draftMonth || !draftEmployee || !Number.isFinite(targetValue) || targetValue < 0) {
      setTargetError('Chọn tháng, nhân sự và nhập doanh số mục tiêu hợp lệ.');
      return;
    }
    setSaving(true);
    setTargetError(null);
    const { error: saveError } = await supabase.from(KPI_STAFF_TABLE).upsert(
      { nam_thang: draftMonth, employee_id: draftEmployee, muc_tieu_vnd: targetValue },
      { onConflict: 'nam_thang,employee_id' }
    );
    if (saveError) {
      console.error('admin-kpis save target:', saveError);
      setTargetError(saveError.message || 'Không lưu được KPI.');
      setSaving(false);
      return;
    }
    setTargetMonth(draftMonth);
    await loadTargets(draftMonth);
    setSaving(false);
    setShowAddModal(false);
    setDraftTarget('');
  };

  return (
    <div className="dash-fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#e2e8e5]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#191c1b] tracking-tight">KPIs</h1>
          <p className="mt-1 text-xs text-[#476355]">Mục tiêu doanh số theo nhân sự</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <StitchButton
            variant="secondary"
            size="small"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </StitchButton>
          <StitchButton
            variant="primary"
            size="small"
            onClick={() => { setDraftMonth(targetMonth); setDraftEmployee(''); setDraftTarget(''); setTargetError(null); setShowAddModal(true); }}
          >
            <Plus size={16} />
            Thêm KPI
          </StitchButton>
        </div>
      </div>

      {staffError && (
        <div className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs font-semibold text-[#e11d48]">
          {staffError}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#e2e8e5] bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8e5] px-5 py-4 bg-white">
          <div>
            <h2 className="text-base font-bold text-[#191c1b]">Mục tiêu KPI · {targetMonth}</h2>
            <p className="mt-0.5 text-xs text-[#476355]">Doanh số mục tiêu theo nhân sự</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-[#476355]">
            Tháng
            <input
              type="month"
              value={targetMonth}
              onChange={(event) => setTargetMonth(event.target.value)}
              className="rounded-lg border border-[#e2e8e5] bg-[#f8faf9] px-2.5 py-1 text-xs text-[#191c1b] font-medium outline-none focus:border-[#006e51] focus:bg-white transition-all"
            />
          </label>
        </div>
        {targetError && (
          <div className="mx-5 mt-4 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs font-semibold text-[#e11d48]">
            {targetError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead className="bg-[#f8faf9] text-xs font-bold uppercase tracking-wider text-[#476355] border-b border-[#e2e8e5]">
              <tr>
                <th className="px-5 py-3.5">Tháng</th>
                <th className="px-5 py-3.5">Nhân sự</th>
                <th className="px-5 py-3.5 text-right">Doanh số mục tiêu (VNĐ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8e5] text-sm text-[#191c1b]">
              {targetRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-[#476355] text-xs font-medium">
                    Chưa có mục tiêu KPI trong tháng này. Bấm “Thêm KPI” để tạo.
                  </td>
                </tr>
              ) : targetRows.map((row) => {
                const employee = staff.find((person) => person.id === row.employee_id);
                return (
                  <tr key={row.employee_id} className="hover:bg-[#f8faf9]/70 transition-colors">
                    <td className="px-5 py-3.5 font-medium">{row.nam_thang}</td>
                    <td className="px-5 py-3.5 font-semibold text-[#191c1b]">{employee?.name || 'Nhân sự không còn trong danh sách'}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-[#006e51]">{formatVnd(Number(row.muc_tieu_vnd) || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showAddModal ? (
        <div className={`${STITCH_PORTAL_CLASS} fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4`} role="presentation" onClick={() => !saving && setShowAddModal(false)}>
          <form className="w-full max-w-lg space-y-4 rounded-2xl border border-[#e2e8e5] bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="add-kpi-title" onSubmit={saveTarget} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#e2e8e5]">
              <h2 id="add-kpi-title" className="text-lg font-bold text-[#191c1b]">Thêm KPI doanh số</h2>
              <button type="button" onClick={() => setShowAddModal(false)} disabled={saving} aria-label="Đóng" className="rounded-lg p-1.5 text-[#476355] hover:bg-[#f0f4f1] transition-colors"><X size={18} /></button>
            </div>
            <label className="block space-y-1.5 text-xs font-bold text-[#476355]">
              Tháng
              <input required type="month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)} className="w-full rounded-xl border border-[#e2e8e5] bg-[#f8faf9] px-3.5 py-2.5 text-sm text-[#191c1b] focus:border-[#006e51] focus:bg-white outline-none transition-all" />
            </label>
            <label className="block space-y-1.5 text-xs font-bold text-[#476355]">
              Nhân sự
              <select required value={draftEmployee} onChange={(event) => setDraftEmployee(event.target.value)} className="w-full rounded-xl border border-[#e2e8e5] bg-[#f8faf9] px-3.5 py-2.5 text-sm text-[#191c1b] focus:border-[#006e51] focus:bg-white outline-none transition-all">
                <option value="">Chọn nhân sự</option>
                {staff.map((person) => <option key={person.id} value={person.id}>{person.name}{person.ma_ns ? ` · ${person.ma_ns}` : ''}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs font-bold text-[#476355]">
              Doanh số mục tiêu (VNĐ)
              <input required type="number" min="0" step="1000" value={draftTarget} onChange={(event) => setDraftTarget(event.target.value)} className="w-full rounded-xl border border-[#e2e8e5] bg-[#f8faf9] px-3.5 py-2.5 text-sm text-[#191c1b] focus:border-[#006e51] focus:bg-white outline-none transition-all font-mono" placeholder="50000000" />
            </label>
            {targetError && (
              <div className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs font-semibold text-[#e11d48]">
                {targetError}
              </div>
            )}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#e2e8e5]">
              <StitchButton type="button" variant="secondary" onClick={() => setShowAddModal(false)} disabled={saving}>Hủy</StitchButton>
              <StitchButton type="submit" variant="primary" disabled={saving || !staff.length}>{saving ? 'Đang lưu…' : 'Lưu KPI'}</StitchButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};
