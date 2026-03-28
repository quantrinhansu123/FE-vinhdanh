/**
 * Bảng danh sách TKQC — nguồn Supabase bảng tkqc_accounts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { formatVnd } from '../../utils/dashboardAdminUtils';
import type { TkqcAccountRow } from '../../types';

const TABLE = import.meta.env.VITE_SUPABASE_TKQC_ACCOUNTS_TABLE?.trim() || 'tkqc_accounts';
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';


type EmployeeOption = { id: string; name: string; team: string };

function num(v: number | null | undefined): number {
  return v == null || Number.isNaN(Number(v)) ? 0 : Number(v);
}

function formatDigitsDisplay(digitsRaw: string): string {
  const d = digitsRaw.replace(/\D/g, '');
  if (!d) return '';
  return Number(d).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

function parseDigitsToInt(digitsRaw: string): number {
  return parseInt(digitsRaw.replace(/\D/g, ''), 10) || 0;
}

/** Giá trị đặc biệt trong select: dòng chưa có đơn vị */
const FILTER_EMPTY_DON_VI = '__EMPTY_DON_VI__';

export function AdsAccountsPage() {
  const [rows, setRows] = useState<TkqcAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fTkqc, setFTkqc] = useState('');
  const [fPage, setFPage] = useState('');
  const [fDonVi, setFDonVi] = useState('');
  const [fNs, setFNs] = useState('');
  const [fTongChi, setFTongChi] = useState('');
  const [fDoanhSo, setFDoanhSo] = useState('');
  const [fMess, setFMess] = useState('');
  const [fDon, setFDon] = useState('');
  const [fEmployeeId, setFEmployeeId] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [updatingEmployeeRowId, setUpdatingEmployeeRowId] = useState<string | null>(null);
  const [filterDonVi, setFilterDonVi] = useState<string>('');

  const donViFilterOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rows) {
      const d = (r.don_vi || '').trim();
      keys.add(d ? d : FILTER_EMPTY_DON_VI);
    }
    return Array.from(keys).sort((a, b) => {
      if (a === FILTER_EMPTY_DON_VI) return 1;
      if (b === FILTER_EMPTY_DON_VI) return -1;
      return a.localeCompare(b, 'vi');
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filterDonVi === '') return rows;
    if (filterDonVi === FILTER_EMPTY_DON_VI) return rows.filter((r) => !(r.don_vi || '').trim());
    return rows.filter((r) => (r.don_vi || '').trim() === filterDonVi);
  }, [rows, filterDonVi]);

  const filterStats = useMemo(() => {
    const soTk = filteredRows.length;
    const soPageCoTen = filteredRows.filter((r) => (r.page || '').trim() !== '').length;
    const tongChi = filteredRows.reduce((s, r) => s + num(r.tong_chi), 0);
    const tongDoanhSo = filteredRows.reduce((s, r) => s + num(r.doanh_so), 0);
    return { soTk, soPageCoTen, tongChi, tongDoanhSo };
  }, [filteredRows]);

  const fetchEmployees = useCallback(async () => {
    const { data, error: err } = await supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, team')
      .order('name', { ascending: true });
    if (err) {
      console.error(err);
      setEmployees([]);
      return;
    }
    setEmployees((data || []) as EmployeeOption[]);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from(TABLE).select('*').order('tkqc', { ascending: true });
    if (err) {
      console.error(err);
      setError(err.message || 'Không tải được danh sách TKQC');
      setRows([]);
    } else {
      setRows(
        (data || []).map((row) => ({
          ...row,
          employee_id: (row as { employee_id?: string | null }).employee_id ?? null,
        })) as TkqcAccountRow[]
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
    fetchEmployees();
  }, [fetchRows, fetchEmployees]);

  function resetForm() {
    setFTkqc('');
    setFPage('');
    setFDonVi('');
    setFNs('');
    setFTongChi('');
    setFDoanhSo('');
    setFMess('');
    setFDon('');
    setFEmployeeId('');
  }

  async function handleEmployeeChange(rowId: string, value: string) {
    const next = value === '' ? null : value;
    setUpdatingEmployeeRowId(rowId);
    const { error: err } = await supabase.from(TABLE).update({ employee_id: next }).eq('id', rowId);
    setUpdatingEmployeeRowId(null);
    if (err) {
      alert(err.message || 'Không cập nhật được nhân sự');
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, employee_id: next } : r))
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const tkqc = fTkqc.trim();
    if (!tkqc) {
      alert('Nhập mã / tên TKQC');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from(TABLE).insert({
      tkqc,
      page: fPage.trim() || null,
      don_vi: fDonVi.trim() || null,
      employee_id: fEmployeeId || null,
      ngan_sach: parseDigitsToInt(fNs),
      tong_chi: parseDigitsToInt(fTongChi),
      doanh_so: parseDigitsToInt(fDoanhSo),
      so_mess: Math.max(0, parseInt(fMess.replace(/\D/g, ''), 10) || 0),
      so_don: Math.max(0, parseInt(fDon.replace(/\D/g, ''), 10) || 0),
    });
    setSaving(false);
    if (err) {
      alert(err.message || 'Không thêm được');
      return;
    }
    setCreateOpen(false);
    resetForm();
    fetchRows();
  }

  return (
    <div id="crm-ads-tkqc-accounts" className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30">
      <div className="px-6 lg:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-crm-on-surface tracking-tight">Danh sách TKQC</h2>
          <p className="text-xs text-crm-on-surface-variant mt-1">Bảng: {TABLE}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_16px_rgba(34,197,94,0.25)] hover:bg-crm-primary/90 transition-colors"
          >
            <Plus size={16} />
            Thêm TKQC
          </button>
          <button
            type="button"
            onClick={() => {
              fetchRows();
              fetchEmployees();
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary/15 hover:bg-crm-primary/25 text-crm-primary text-xs font-bold uppercase tracking-wider border border-crm-primary/30 transition-colors disabled:opacity-50"
          >
            <Loader2 className={`${loading ? 'animate-spin' : ''}`} size={16} />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl border border-crm-error/50 bg-crm-error/10 text-sm text-crm-error">{error}</div>
      )}

      {!loading && rows.length > 0 && (
        <div className="mx-4 lg:mx-6 mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
            <div className="min-w-[200px]">
              <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase tracking-wider">Đơn vị quảng cáo</label>
              <select
                value={filterDonVi}
                onChange={(e) => setFilterDonVi(e.target.value)}
                className="mt-1 w-full sm:w-auto min-w-[220px] bg-crm-surface-accent/50 border border-crm-outline/50 rounded-xl px-3 py-2.5 text-sm text-crm-on-surface focus:outline-none focus:ring-2 focus:ring-crm-primary/30"
              >
                <option value="">Tất cả đơn vị</option>
                {donViFilterOptions.map((key) => (
                  <option key={key} value={key}>
                    {key === FILTER_EMPTY_DON_VI ? '(Chưa gán đơn vị)' : key}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="crm-glass-card rounded-xl p-4 border border-crm-outline/30">
              <p className="text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Số Page / TKQC</p>
              <p className="text-lg font-extrabold text-crm-on-surface tabular-nums mt-1">{filterStats.soTk.toLocaleString('vi-VN')}</p>
              <p className="text-[11px] text-crm-on-surface-variant mt-1">
                Page có tên:{' '}
                <span className="text-crm-on-surface font-semibold tabular-nums">
                  {filterStats.soPageCoTen.toLocaleString('vi-VN')}
                </span>
              </p>
            </div>
            <div className="crm-glass-card rounded-xl p-4 border border-crm-primary/25">
              <p className="text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Chi phí quảng cáo đã chi</p>
              <p className="text-lg font-extrabold text-crm-primary tabular-nums mt-1">{formatVnd(filterStats.tongChi)}</p>
              <p className="text-[11px] text-crm-on-surface-variant mt-1">Cột Tổng chi (theo bộ lọc)</p>
            </div>
            <div className="crm-glass-card rounded-xl p-4 border border-crm-secondary/25">
              <p className="text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Tổng doanh số</p>
              <p className="text-lg font-extrabold text-crm-on-surface tabular-nums mt-1">{formatVnd(filterStats.tongDoanhSo)}</p>
              <p className="text-[11px] text-crm-on-surface-variant mt-1">Cột Doanh số (theo bộ lọc)</p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto p-4 lg:p-6">
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-crm-primary w-10 h-10" />
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[1120px]">
            <thead>
              <tr className="bg-crm-surface-accent/40 border-b border-crm-outline/40">
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">ID</th>
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">TKQC</th>
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">Page</th>
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">Đơn vị</th>
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider min-w-[200px]">
                  Nhân sự phụ trách
                </th>
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">Ngân sách</th>
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">Tổng chi</th>
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">Doanh số</th>
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">Số mess</th>
                <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">Số đơn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-crm-outline/20">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-crm-on-surface-variant text-sm">
                    Chưa có dòng nào. Chạy script SQL <code className="text-crm-primary">supabase/create_tkqc_accounts.sql</code> trên Supabase.
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-crm-on-surface-variant text-sm">
                    Không có tài khoản nào khớp bộ lọc đơn vị. Chọn &quot;Tất cả đơn vị&quot; hoặc đơn vị khác.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-crm-surface-accent/25 transition-colors">
                    <td className="px-3 py-3 text-[11px] font-mono text-crm-on-surface-variant max-w-[100px] truncate" title={r.id}>
                      {r.id.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-crm-on-surface whitespace-nowrap">{r.tkqc}</td>
                    <td className="px-3 py-3 text-sm text-crm-on-surface max-w-[200px] truncate" title={r.page || ''}>
                      {r.page || '—'}
                    </td>
                    <td className="px-3 py-3 text-sm text-crm-on-surface-variant max-w-[160px] truncate" title={r.don_vi || ''}>
                      {r.don_vi || '—'}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <select
                        value={r.employee_id ?? ''}
                        onChange={(e) => handleEmployeeChange(r.id, e.target.value)}
                        disabled={updatingEmployeeRowId === r.id || employees.length === 0}
                        title={employees.length === 0 ? `Chưa tải được ${EMPLOYEES_TABLE}` : undefined}
                        className="w-full max-w-[220px] bg-crm-surface-accent/50 border border-crm-outline/50 rounded-lg px-2 py-1.5 text-xs text-crm-on-surface focus:outline-none focus:ring-2 focus:ring-crm-primary/30 disabled:opacity-50"
                      >
                        <option value="">— Chọn nhân sự —</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}
                            {emp.team ? ` (${emp.team})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums">{formatVnd(num(r.ngan_sach))}</td>
                    <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums">{formatVnd(num(r.tong_chi))}</td>
                    <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums">{formatVnd(num(r.doanh_so))}</td>
                    <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums">{num(r.so_mess).toLocaleString('vi-VN')}</td>
                    <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums">{num(r.so_don).toLocaleString('vi-VN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ads-tkqc-modal-title"
        >
          <form
            onSubmit={handleCreate}
            className="crm-glass-card w-full max-w-3xl rounded-2xl border border-crm-outline/40 p-8 sm:p-10 shadow-2xl my-auto max-h-[min(92vh,900px)] overflow-y-auto"
          >
            <h3 id="ads-tkqc-modal-title" className="text-xl sm:text-2xl font-bold text-crm-on-surface mb-6 sm:mb-8">
              Thêm tài khoản TKQC
            </h3>
            <div className="space-y-4 sm:space-y-5 text-sm sm:text-base">
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">TKQC *</label>
                <input
                  required
                  value={fTkqc}
                  onChange={(e) => setFTkqc(e.target.value)}
                  className="mt-1.5 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-3 text-crm-on-surface"
                  placeholder="Mã hoặc tên TK"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Page</label>
                <input
                  value={fPage}
                  onChange={(e) => setFPage(e.target.value)}
                  className="mt-1.5 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-3 text-crm-on-surface"
                  placeholder="Tên Page"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Đơn vị</label>
                <input
                  value={fDonVi}
                  onChange={(e) => setFDonVi(e.target.value)}
                  className="mt-1.5 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-3 text-crm-on-surface"
                  placeholder="Đơn vị / dự án"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Nhân sự phụ trách</label>
                <select
                  value={fEmployeeId}
                  onChange={(e) => setFEmployeeId(e.target.value)}
                  className="mt-1.5 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-3 text-crm-on-surface"
                >
                  <option value="">— Chọn nhân sự —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                      {emp.team ? ` (${emp.team})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Ngân sách</label>
                  <input
                    value={formatDigitsDisplay(fNs)}
                    onChange={(e) => setFNs(e.target.value.replace(/\D/g, ''))}
                    className="mt-1.5 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-3 text-crm-on-surface text-right tabular-nums"
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Tổng chi</label>
                  <input
                    value={formatDigitsDisplay(fTongChi)}
                    onChange={(e) => setFTongChi(e.target.value.replace(/\D/g, ''))}
                    className="mt-1.5 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-3 text-crm-on-surface text-right tabular-nums"
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Doanh số</label>
                  <input
                    value={formatDigitsDisplay(fDoanhSo)}
                    onChange={(e) => setFDoanhSo(e.target.value.replace(/\D/g, ''))}
                    className="mt-1.5 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-3 text-crm-on-surface text-right tabular-nums"
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Số mess</label>
                  <input
                    value={fMess}
                    onChange={(e) => setFMess(e.target.value.replace(/\D/g, ''))}
                    className="mt-1.5 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-3 text-crm-on-surface text-right tabular-nums"
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Số đơn</label>
                  <input
                    value={fDon}
                    onChange={(e) => setFDon(e.target.value.replace(/\D/g, ''))}
                    className="mt-1.5 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-3 text-crm-on-surface text-right tabular-nums"
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 sm:mt-10 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
                className="flex-1 py-3.5 rounded-xl border border-crm-outline/50 text-crm-on-surface font-semibold text-base"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3.5 rounded-xl bg-crm-primary text-white font-bold disabled:opacity-50 text-base"
              >
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
