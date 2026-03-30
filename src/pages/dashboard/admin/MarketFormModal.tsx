import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { CrmMarketRow } from '../../../types';

const MARKETS_TABLE = import.meta.env.VITE_SUPABASE_MARKETS_TABLE?.trim() || 'crm_markets';

const TRANG_THAI_OPTIONS = [
  { value: 'hoat_dong', label: 'Hoạt động' },
  { value: 'tam_dung', label: 'Tạm dừng' },
  { value: 'ngung', label: 'Ngừng' },
] as const;

const FIELD_CLASS =
  'w-full min-h-[38px] rounded-[6px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] placeholder:text-[var(--text3)] text-[12px] px-3 py-2 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_rgba(61,142,240,0.28)] [color-scheme:dark]';

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]';

type Props = {
  open: boolean;
  initial: CrmMarketRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const MarketFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const isEdit = Boolean(initial?.id);

  const [ma, setMa] = useState('');
  const [ten, setTen] = useState('');
  const [moTa, setMoTa] = useState('');
  const [trangThai, setTrangThai] = useState('hoat_dong');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (initial) {
      setMa(initial.ma_thi_truong || '');
      setTen(initial.ten_thi_truong || '');
      setMoTa(initial.mo_ta || '');
      setTrangThai(initial.trang_thai || 'hoat_dong');
    } else {
      setMa('');
      setTen('');
      setMoTa('');
      setTrangThai('hoat_dong');
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
    const maT = ma.trim();
    const tenT = ten.trim();
    if (!maT) {
      setFormError('Nhập mã thị trường.');
      return;
    }
    if (!tenT) {
      setFormError('Nhập tên thị trường.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ma_thi_truong: maT,
        ten_thi_truong: tenT,
        mo_ta: moTa.trim() || null,
        trang_thai: trangThai,
      };

      if (isEdit && initial?.id) {
        const { error } = await supabase.from(MARKETS_TABLE).update(payload).eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(MARKETS_TABLE).insert(payload);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error('crm_markets save:', err);
      const msg = err instanceof Error ? err.message : 'Không lưu được.';
      setFormError(
        msg.includes('does not exist') || msg.includes('schema cache')
          ? `Chạy supabase/create_crm_markets.sql và bật bảng ${MARKETS_TABLE} trên Supabase.`
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="dash-theme project-form-modal-root fixed inset-0 z-[10050] font-[family-name:var(--f)]"
      role="presentation"
    >
      <div
        className="absolute inset-0 z-0 bg-[rgba(4,6,10,0.94)] backdrop-blur-[8px]"
        aria-hidden
        onMouseDown={onClose}
      />
      <div className="pointer-events-none relative z-[1] flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6">
        <div
          className="pointer-events-auto w-full max-w-[440px] max-h-[min(90dvh,calc(100svh-2rem))] overflow-y-auto overflow-x-hidden rounded-[12px] border border-[var(--border2)] bg-[var(--bg1)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="market-form-title"
          onMouseDown={(ev) => ev.stopPropagation()}
        >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 bg-[var(--bg1)]">
          <h2 id="market-form-title" className="text-[14px] font-extrabold text-[var(--text)]">
            {isEdit ? 'Sửa thị trường' : 'Thêm thị trường'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-[6px] text-[var(--text3)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text)]"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-3">
          {formError ? (
            <div className="text-[11px] text-[var(--R)] border border-[rgba(224,61,61,0.25)] rounded-[6px] px-3 py-2 bg-[var(--Rd)]/15">
              {formError}
            </div>
          ) : null}

          <div>
            <label className={LABEL_CLASS}>Mã thị trường</label>
            <input
              className={`${FIELD_CLASS} mt-1`}
              value={ma}
              onChange={(e) => setMa(e.target.value)}
              placeholder="TT-VN"
              required
              disabled={isEdit}
            />
            {isEdit ? <p className="text-[9px] text-[var(--text3)] mt-1">Mã không đổi khi sửa.</p> : null}
          </div>

          <div>
            <label className={LABEL_CLASS}>Tên thị trường</label>
            <input className={`${FIELD_CLASS} mt-1`} value={ten} onChange={(e) => setTen(e.target.value)} required />
          </div>

          <div>
            <label className={LABEL_CLASS}>Mô tả</label>
            <textarea className={`${FIELD_CLASS} mt-1 min-h-[64px] resize-y`} value={moTa} onChange={(e) => setMoTa(e.target.value)} rows={2} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Trạng thái</label>
            <select className={`${FIELD_CLASS} mt-1`} value={trangThai} onChange={(e) => setTrangThai(e.target.value)}>
              {TRANG_THAI_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[6px] text-[12px] font-bold border border-[var(--border)] text-[var(--text2)] hover:bg-[rgba(255,255,255,0.05)]"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-[12px] font-bold bg-[#3d8ef0] text-white hover:bg-[#2e7dd1] disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Lưu
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
