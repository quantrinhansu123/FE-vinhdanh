import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';

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
    const { data, error: queryError } = await supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, ma_ns')
      .order('name')
      .limit(8000);

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
    <div className="dash-fade-up">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[var(--ld-on-surface)] text-2xl font-extrabold">KPIs</h1>
          <p className="mt-1 text-sm text-[var(--ld-on-surface-variant)]">Mục tiêu doanh số theo nhân sự</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-[var(--ld-outline-variant)]/30 bg-[var(--ld-surface-container-highest)] px-4 py-2 text-sm font-semibold text-[var(--ld-on-surface)] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => { setDraftMonth(targetMonth); setDraftEmployee(''); setDraftTarget(''); setTargetError(null); setShowAddModal(true); }}
            className="flex items-center gap-2 rounded-lg bg-[var(--ld-primary)] px-4 py-2 text-sm font-bold text-[var(--ld-on-primary)]"
          >
            <Plus size={17} />
            Thêm KPI
          </button>
        </div>
      </div>

      {staffError ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{staffError}</div> : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--ld-outline-variant)]/15 bg-[var(--ld-surface-container)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ld-outline-variant)]/15 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--ld-on-surface)]">Mục tiêu KPI · {targetMonth}</h2>
            <p className="mt-1 text-sm text-[var(--ld-on-surface-variant)]">Doanh số mục tiêu theo nhân sự</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ld-on-surface-variant)]">
            Tháng
            <input type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} className="rounded-lg border border-[var(--ld-outline-variant)]/30 bg-[var(--ld-surface-container-high)] px-3 py-2 text-[var(--ld-on-surface)]" />
          </label>
        </div>
        {targetError ? <div className="mx-5 mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{targetError}</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead className="bg-[var(--ld-surface-container-high)] text-sm font-bold text-[var(--ld-on-surface-variant)]">
              <tr><th className="px-5 py-4">Tháng</th><th className="px-5 py-4">Nhân sự</th><th className="px-5 py-4 text-right">Doanh số mục tiêu (VNĐ)</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--ld-background)]/30 text-base font-semibold text-[var(--ld-on-surface)]">
              {targetRows.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-[var(--ld-on-surface-variant)]">Chưa có mục tiêu KPI trong tháng này. Bấm “Thêm KPI” để tạo.</td></tr>
              ) : targetRows.map((row) => {
                const employee = staff.find((person) => person.id === row.employee_id);
                return (
                  <tr key={row.employee_id} className="hover:bg-[var(--ld-surface-container-high)]/60">
                    <td className="px-5 py-4">{row.nam_thang}</td>
                    <td className="px-5 py-4">{employee?.name || 'Nhân sự không còn trong danh sách'}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-[var(--ld-primary)]">{formatVnd(Number(row.muc_tieu_vnd) || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showAddModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" role="presentation" onClick={() => !saving && setShowAddModal(false)}>
          <form className="w-full max-w-lg space-y-4 rounded-2xl border border-[var(--ld-outline-variant)]/25 bg-[var(--ld-surface-container)] p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="add-kpi-title" onSubmit={saveTarget} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="add-kpi-title" className="text-xl font-bold text-[var(--ld-on-surface)]">Thêm KPI doanh số</h2>
              <button type="button" onClick={() => setShowAddModal(false)} disabled={saving} aria-label="Đóng" className="rounded-lg p-2 text-[var(--ld-on-surface-variant)] hover:bg-[var(--ld-surface-container-high)]"><X size={20} /></button>
            </div>
            <label className="block space-y-1 text-sm font-semibold text-[var(--ld-on-surface-variant)]">
              Tháng
              <input required type="month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)} className="w-full rounded-lg border border-[var(--ld-outline-variant)]/30 bg-[var(--ld-surface-container-high)] px-3 py-2 text-[var(--ld-on-surface)]" />
            </label>
            <label className="block space-y-1 text-sm font-semibold text-[var(--ld-on-surface-variant)]">
              Nhân sự
              <select required value={draftEmployee} onChange={(event) => setDraftEmployee(event.target.value)} className="w-full rounded-lg border border-[var(--ld-outline-variant)]/30 bg-[var(--ld-surface-container-high)] px-3 py-2 text-[var(--ld-on-surface)]">
                <option value="">Chọn nhân sự</option>
                {staff.map((person) => <option key={person.id} value={person.id}>{person.name}{person.ma_ns ? ` · ${person.ma_ns}` : ''}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-semibold text-[var(--ld-on-surface-variant)]">
              Doanh số mục tiêu (VNĐ)
              <input required type="number" min="0" step="1000" value={draftTarget} onChange={(event) => setDraftTarget(event.target.value)} className="w-full rounded-lg border border-[var(--ld-outline-variant)]/30 bg-[var(--ld-surface-container-high)] px-3 py-2 text-[var(--ld-on-surface)]" placeholder="50000000" />
            </label>
            {targetError ? <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{targetError}</div> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} disabled={saving} className="rounded-lg border border-[var(--ld-outline-variant)]/30 px-4 py-2 text-sm font-semibold text-[var(--ld-on-surface)]">Hủy</button>
              <button type="submit" disabled={saving || !staff.length} className="rounded-lg bg-[var(--ld-primary)] px-4 py-2 text-sm font-bold text-[var(--ld-on-primary)] disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu KPI'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};
