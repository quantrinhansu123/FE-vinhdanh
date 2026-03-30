import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { CrmAgencyRow } from '../../../types';

const AGENCIES_TABLE = import.meta.env.VITE_SUPABASE_AGENCIES_TABLE?.trim() || 'crm_agencies';

const TRANG_THAI_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'theo_doi', label: 'Theo dõi' },
  { value: 'tam_dung', label: 'Tạm dừng' },
  { value: 'ngung', label: 'Ngừng' },
] as const;

const FIELD_CLASS =
  'w-full min-h-[38px] rounded-[6px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] placeholder:text-[var(--text3)] text-[12px] px-3 py-2 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_rgba(61,142,240,0.28)] [color-scheme:dark]';

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]';

function parseMoney(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

type Props = {
  open: boolean;
  initial: CrmAgencyRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const AgencyFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const isEdit = Boolean(initial?.id);

  const [maAgency, setMaAgency] = useState('');
  const [tenAgency, setTenAgency] = useState('');
  const [lienHe, setLienHe] = useState('');
  const [telegram, setTelegram] = useState('');
  const [tkCungCap, setTkCungCap] = useState('');
  const [duAn, setDuAn] = useState('');
  const [tongDaNap, setTongDaNap] = useState('');
  const [congNo, setCongNo] = useState('');
  const [trangThai, setTrangThai] = useState('active');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (initial) {
      setMaAgency(initial.ma_agency || '');
      setTenAgency(initial.ten_agency || '');
      setLienHe(initial.lien_he || '');
      setTelegram(initial.telegram || '');
      setTkCungCap(initial.tk_cung_cap || '');
      setDuAn(initial.du_an || '');
      setTongDaNap(
        initial.tong_da_nap != null && Number.isFinite(Number(initial.tong_da_nap))
          ? String(initial.tong_da_nap)
          : ''
      );
      setCongNo(
        initial.cong_no != null && Number.isFinite(Number(initial.cong_no)) ? String(initial.cong_no) : ''
      );
      setTrangThai(initial.trang_thai || 'active');
    } else {
      setMaAgency('');
      setTenAgency('');
      setLienHe('');
      setTelegram('');
      setTkCungCap('');
      setDuAn('');
      setTongDaNap('');
      setCongNo('');
      setTrangThai('active');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const ma = maAgency.trim();
    const ten = tenAgency.trim();
    if (!ma) {
      setFormError('Nhập mã agency.');
      return;
    }
    if (!ten) {
      setFormError('Nhập tên agency.');
      return;
    }

    const nap = parseMoney(tongDaNap) ?? 0;
    const no = parseMoney(congNo) ?? 0;

    const payload: Record<string, unknown> = {
      ma_agency: ma,
      ten_agency: ten,
      lien_he: lienHe.trim() || null,
      telegram: telegram.trim() || null,
      tk_cung_cap: tkCungCap.trim() || null,
      du_an: duAn.trim() || null,
      tong_da_nap: nap,
      cong_no: no,
      trang_thai: trangThai,
    };

    setSaving(true);
    try {
      if (isEdit && initial?.id) {
        const { error } = await supabase.from(AGENCIES_TABLE).update(payload).eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(AGENCIES_TABLE).insert(payload);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lưu thất bại.';
      setFormError(msg);
      console.error('crm_agencies save:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="dash-theme project-form-modal-root fixed inset-0 z-[10050] !bg-transparent font-[family-name:var(--f)]">
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-[3px]" aria-hidden onMouseDown={onClose} />
      <div className="pointer-events-none relative z-[1] flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6">
        <div
          className="project-form-modal-scroll pointer-events-auto w-full max-w-[520px] max-h-[min(90dvh,calc(100svh-2rem))] overflow-y-auto overflow-x-hidden rounded-[var(--r)] border border-[var(--border2)] bg-[var(--bg1)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agency-form-title"
          onMouseDown={(ev) => ev.stopPropagation()}
        >
          <div className="flex items-center justify-between p-[14px_16px] border-b border-[var(--border2)] shrink-0 bg-[var(--bg1)]">
            <h2 id="agency-form-title" className="text-[13px] font-extrabold text-[var(--text)]">
              {isEdit ? 'Sửa agency' : 'Thêm agency'}
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
                <span className={LABEL_CLASS}>
                  Mã agency <span className="text-[var(--R)]">*</span>
                </span>
                <input
                  value={maAgency}
                  onChange={(e) => setMaAgency(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="VD: AG-01"
                  required
                  disabled={isEdit}
                />
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Trạng thái</span>
                <select value={trangThai} onChange={(e) => setTrangThai(e.target.value)} className={FIELD_CLASS}>
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
                Tên agency <span className="text-[var(--R)]">*</span>
              </span>
              <input value={tenAgency} onChange={(e) => setTenAgency(e.target.value)} className={FIELD_CLASS} required />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Liên hệ</span>
                <input value={lienHe} onChange={(e) => setLienHe(e.target.value)} className={FIELD_CLASS} />
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Telegram</span>
                <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className={FIELD_CLASS} placeholder="@user" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>TK cung cấp</span>
                <input value={tkCungCap} onChange={(e) => setTkCungCap(e.target.value)} className={FIELD_CLASS} placeholder="FB VNĐ" />
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Dự án</span>
                <input value={duAn} onChange={(e) => setDuAn(e.target.value)} className={FIELD_CLASS} placeholder="BK, FB" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Tổng đã nạp (VND)</span>
                <input inputMode="numeric" value={tongDaNap} onChange={(e) => setTongDaNap(e.target.value)} className={FIELD_CLASS} />
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Công nợ (VND)</span>
                <input inputMode="numeric" value={congNo} onChange={(e) => setCongNo(e.target.value)} className={FIELD_CLASS} />
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
