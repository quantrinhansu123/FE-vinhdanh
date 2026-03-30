import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { DuAnRow, Employee } from '../../../types';

const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';

const TRANG_THAI_OPTIONS: { value: string; label: string }[] = [
  { value: 'dang_chay', label: 'Active (đang chạy)' },
  { value: 'review', label: 'Review' },
  { value: 'tam_dung', label: 'Tạm dừng' },
  { value: 'ket_thuc', label: 'Kết thúc' },
  { value: 'huy', label: 'Huỷ' },
];

/** Biến CSS --* chỉ có trên .dash-theme — dùng chung cho input portal ra body */
const FIELD_CLASS =
  'w-full min-h-[38px] rounded-[6px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] placeholder:text-[var(--text3)] text-[12px] px-3 py-2 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_rgba(61,142,240,0.28)] [color-scheme:dark]';

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]';

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseSoMkt(raw: string): number {
  const n = parseOptionalNumber(raw);
  if (n == null) return 0;
  return Math.max(0, Math.floor(n));
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}

type Props = {
  open: boolean;
  initial: DuAnRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const ProjectFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const isEdit = Boolean(initial?.id);

  const [maDuAn, setMaDuAn] = useState('');
  const [tenDuAn, setTenDuAn] = useState('');
  const [donVi, setDonVi] = useState('');
  const [thiTruong, setThiTruong] = useState('');
  const [leader, setLeader] = useState('');
  const [soMkt, setSoMkt] = useState('');
  const [doanhThuThang, setDoanhThuThang] = useState('');
  const [moTa, setMoTa] = useState('');
  const [nsKeHoach, setNsKeHoach] = useState('');
  const [chiPhiMkt, setChiPhiMkt] = useState('');
  const [tongDoanhSo, setTongDoanhSo] = useState('');
  const [ngayBatDau, setNgayBatDau] = useState('');
  const [ngayKetThuc, setNgayKetThuc] = useState('');
  const [trangThai, setTrangThai] = useState('dang_chay');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [staffQuery, setStaffQuery] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (initial) {
      setMaDuAn(initial.ma_du_an || '');
      setTenDuAn(initial.ten_du_an || '');
      setDonVi(initial.don_vi || '');
      setThiTruong(initial.thi_truong || '');
      setLeader(initial.leader || '');
      setSoMkt(initial.so_mkt != null ? String(initial.so_mkt) : '');
      setDoanhThuThang(initial.doanh_thu_thang != null ? String(initial.doanh_thu_thang) : '');
      setMoTa(initial.mo_ta || '');
      setNsKeHoach(initial.ngan_sach_ke_hoach != null ? String(initial.ngan_sach_ke_hoach) : '');
      setChiPhiMkt(initial.chi_phi_marketing_thuc_te != null ? String(initial.chi_phi_marketing_thuc_te) : '');
      setTongDoanhSo(initial.tong_doanh_so != null ? String(initial.tong_doanh_so) : '');
      setNgayBatDau(toInputDate(initial.ngay_bat_dau));
      setNgayKetThuc(toInputDate(initial.ngay_ket_thuc));
      setTrangThai(initial.trang_thai || 'dang_chay');
      const staffIds = Array.isArray(initial.staff_ids)
        ? (initial.staff_ids as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      setSelectedStaffIds(staffIds);
    } else {
      setMaDuAn('');
      setTenDuAn('');
      setDonVi('');
      setThiTruong('');
      setLeader('');
      setSoMkt('');
      setDoanhThuThang('');
      setMoTa('');
      setNsKeHoach('');
      setChiPhiMkt('');
      setTongDoanhSo('');
      setNgayBatDau('');
      setNgayKetThuc('');
      setTrangThai('dang_chay');
      setSelectedStaffIds([]);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const loadEmployees = async () => {
      setEmployeesLoading(true);
      try {
        const { data, error } = await supabase
          .from(EMPLOYEES_TABLE)
          .select('id, name, team, email, avatar_url')
          .order('name', { ascending: true });

        if (error) throw error;
        if (!cancelled) setEmployees((data || []) as Employee[]);
      } catch (e) {
        console.error('Load employees for project form:', e);
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    };

    void loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredEmployees = employees.filter((emp) => {
    if (!staffQuery.trim()) return true;
    const q = staffQuery.trim().toLowerCase();
    const name = (emp.name || '').toLowerCase();
    const team = (emp.team || '').toLowerCase();
    const email = (emp.email || '').toLowerCase();
    return name.includes(q) || team.includes(q) || email.includes(q);
  });

  const toggleStaff = (id: string) => {
    setSelectedStaffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const ten = tenDuAn.trim();
    if (!ten) {
      setFormError('Nhập tên dự án.');
      return;
    }

    const payload = {
      ma_du_an: maDuAn.trim() || null,
      ten_du_an: ten,
      don_vi: donVi.trim() || null,
      thi_truong: thiTruong.trim() || null,
      leader: leader.trim() || null,
      so_mkt: parseSoMkt(soMkt),
      doanh_thu_thang: parseOptionalNumber(doanhThuThang) ?? 0,
      staff_ids: selectedStaffIds,
      mo_ta: moTa.trim() || null,
      ngan_sach_ke_hoach: parseOptionalNumber(nsKeHoach) ?? 0,
      chi_phi_marketing_thuc_te: parseOptionalNumber(chiPhiMkt) ?? 0,
      tong_doanh_so: parseOptionalNumber(tongDoanhSo) ?? 0,
      ngay_bat_dau: ngayBatDau || null,
      ngay_ket_thuc: ngayKetThuc || null,
      trang_thai: trangThai,
    };

    setSaving(true);
    try {
      if (isEdit && initial?.id) {
        const { error: uErr } = await supabase.from(DU_AN_TABLE).update(payload).eq('id', initial.id);
        if (uErr) throw uErr;
      } else {
        const { error: iErr } = await supabase.from(DU_AN_TABLE).insert(payload);
        if (iErr) throw iErr;
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lưu thất bại.';
      setFormError(msg);
      console.error('du_an save:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="dash-theme project-form-modal-root fixed inset-0 z-[200] !bg-transparent font-[family-name:var(--f)]">
      <div
        className="absolute inset-0 z-0 bg-black/60 backdrop-blur-[3px]"
        aria-hidden
        onMouseDown={onClose}
      />
      <div className="pointer-events-none relative z-[1] flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6">
        <div
          className="project-form-modal-scroll pointer-events-auto w-full max-w-[500px] max-h-[min(90dvh,calc(100svh-2rem))] overflow-y-auto overflow-x-hidden rounded-[var(--r)] border border-[var(--border2)] bg-[var(--bg1)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-form-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between p-[14px_16px] border-b border-[var(--border2)] shrink-0 bg-[var(--bg1)]">
          <h2 id="project-form-title" className="text-[13px] font-extrabold text-[var(--text)]">
            {isEdit ? 'Sửa dự án' : 'Thêm dự án'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-[var(--text2)] hover:bg-[var(--bg3)] hover:text-[var(--text)] transition-colors"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-[16px] space-y-[12px]">
          {formError && (
            <div className="text-[11px] text-[var(--R)] bg-[var(--Rd)]/30 border border-[rgba(224,61,61,0.2)] rounded-[6px] px-3 py-2">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Mã dự án</span>
              <input
                value={maDuAn}
                onChange={(e) => setMaDuAn(e.target.value)}
                className={FIELD_CLASS}
                placeholder="VD: DA-003"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Trạng thái</span>
              <select
                value={trangThai}
                onChange={(e) => setTrangThai(e.target.value)}
                className={FIELD_CLASS}
              >
                {TRANG_THAI_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className={LABEL_CLASS}>
              Tên dự án <span className="text-[var(--R)]">*</span>
            </span>
            <input
              value={tenDuAn}
              onChange={(e) => setTenDuAn(e.target.value)}
              className={FIELD_CLASS}
              placeholder="Tên hiển thị"
              required
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Thị trường</span>
              <input
                value={thiTruong}
                onChange={(e) => setThiTruong(e.target.value)}
                className={FIELD_CLASS}
                placeholder="VD: Việt Nam"
              />
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Leader</span>
              <input
                value={leader}
                onChange={(e) => setLeader(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Họ tên leader"
              />
            </label>
          </div>

          <div className="space-y-[8px]">
            <div className="flex items-center justify-between gap-3">
              <span className={LABEL_CLASS}>Nhân sự trong dự án</span>
              <span className="text-[10px] text-[var(--text3)] font-bold">
                {selectedStaffIds.length} đã chọn
              </span>
            </div>

            <input
              value={staffQuery}
              onChange={(e) => setStaffQuery(e.target.value)}
              className={FIELD_CLASS}
              placeholder="Tìm nhanh: tên / team / email"
              autoComplete="off"
            />

            <div className="project-form-modal-scroll max-h-[220px] overflow-y-auto rounded-[6px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-[8px]">
              {employeesLoading ? (
                <div className="flex items-center justify-center gap-2 text-[var(--text3)] py-6">
                  <Loader2 className="animate-spin" size={16} /> Đang tải…
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-[var(--text3)] text-[11px] py-3 text-center">
                  Không có nhân sự phù hợp.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const checked = selectedStaffIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-start gap-2 p-[8px] rounded-[6px] cursor-pointer transition-colors ${
                        checked ? 'bg-[rgba(61,142,240,0.12)] border border-[rgba(61,142,240,0.18)]' : 'hover:bg-[rgba(255,255,255,0.04)] border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStaff(emp.id)}
                        className="mt-[2px]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-extrabold text-[var(--text)] truncate">
                          {emp.name}
                        </div>
                        <div className="text-[10px] text-[var(--text3)] truncate">
                          {emp.team || '—'}
                          {emp.email ? ` · ${emp.email}` : ''}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Số MKT</span>
              <input
                inputMode="numeric"
                value={soMkt}
                onChange={(e) => setSoMkt(e.target.value)}
                className={FIELD_CLASS}
                placeholder="0"
              />
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>DT tháng (VND)</span>
              <input
                inputMode="numeric"
                value={doanhThuThang}
                onChange={(e) => setDoanhThuThang(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Doanh thu tháng"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className={LABEL_CLASS}>Đơn vị / Agency</span>
            <input
              value={donVi}
              onChange={(e) => setDonVi(e.target.value)}
              className={FIELD_CLASS}
              placeholder="Tùy chọn — nội bộ"
            />
          </label>

          <label className="block space-y-1.5">
            <span className={LABEL_CLASS}>Mô tả</span>
            <textarea
              value={moTa}
              onChange={(e) => setMoTa(e.target.value)}
              rows={2}
              className={`${FIELD_CLASS} resize-y min-h-[72px] py-2.5`}
              placeholder="Ghi chú ngắn"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[10px]">
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>NS kế hoạch</span>
              <input
                inputMode="numeric"
                value={nsKeHoach}
                onChange={(e) => setNsKeHoach(e.target.value)}
                className={FIELD_CLASS}
                placeholder="VND"
              />
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Chi phí MKT</span>
              <input
                inputMode="numeric"
                value={chiPhiMkt}
                onChange={(e) => setChiPhiMkt(e.target.value)}
                className={FIELD_CLASS}
                placeholder="VND"
              />
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Tổng doanh số (VND)</span>
              <input
                inputMode="numeric"
                value={tongDoanhSo}
                onChange={(e) => setTongDoanhSo(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Gộp / snapshot"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Ngày bắt đầu</span>
              <input
                type="date"
                value={ngayBatDau}
                onChange={(e) => setNgayBatDau(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Ngày kết thúc</span>
              <input
                type="date"
                value={ngayKetThuc}
                onChange={(e) => setNgayKetThuc(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
          </div>

          <div className="flex justify-end gap-[8px] pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="py-[8px] px-[14px] rounded-[6px] text-[11px] font-bold border border-[var(--border)] bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--bg2)] transition-colors disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 py-[8px] px-[14px] rounded-[6px] text-[11px] font-bold bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : null}
              {isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
