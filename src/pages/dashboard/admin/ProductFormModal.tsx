import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { CrmProductRow } from '../../../types';
import { formatNumberDots, formatTypingGroupedInt } from '../mkt/mktDetailReportShared';

const PRODUCTS_TABLE = import.meta.env.VITE_SUPABASE_PRODUCTS_TABLE?.trim() || 'crm_products';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';

const TRANG_THAI_OPTIONS = [
  { value: 'dang_ban', label: 'Đang bán' },
  { value: 'tam_ngung', label: 'Tạm ngừng' },
  { value: 'ngung', label: 'Ngừng' },
] as const;

const FIELD_CLASS =
  'w-full min-h-[38px] rounded-[6px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] placeholder:text-[var(--text3)] text-[12px] px-3 py-2 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_rgba(61,142,240,0.28)] [color-scheme:dark]';

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]';

function parseMoney(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type DuAnOpt = { id: string; ma_du_an: string | null; ten_du_an: string };

type Props = {
  open: boolean;
  initial: CrmProductRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const ProductFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const isEdit = Boolean(initial?.id);

  const [maSp, setMaSp] = useState('');
  const [tenSp, setTenSp] = useState('');
  const [moTa, setMoTa] = useState('');
  const [danhMuc, setDanhMuc] = useState('');
  const [giaBan, setGiaBan] = useState('');
  const [donVi, setDonVi] = useState('cái');
  const [idDuAn, setIdDuAn] = useState('');
  const [trangThai, setTrangThai] = useState('dang_ban');
  const [duAnList, setDuAnList] = useState<DuAnOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadDuAn = useCallback(async () => {
    const res = await supabase.from(DU_AN_TABLE).select('id, ma_du_an, ten_du_an').order('ten_du_an', { ascending: true });
    if (res.error) {
      console.warn('du_an for product form:', res.error);
      setDuAnList([]);
      return;
    }
    setDuAnList((res.data || []) as DuAnOpt[]);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadDuAn();
  }, [open, loadDuAn]);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (initial) {
      setMaSp(initial.ma_san_pham || '');
      setTenSp(initial.ten_san_pham || '');
      setMoTa(initial.mo_ta || '');
      setDanhMuc(initial.danh_muc || '');
      setGiaBan(
        initial.gia_ban != null && Number.isFinite(Number(initial.gia_ban))
          ? formatNumberDots(Math.round(Number(initial.gia_ban)), false)
          : ''
      );
      setDonVi(initial.don_vi_tinh?.trim() || 'cái');
      setIdDuAn(initial.id_du_an || '');
      setTrangThai(initial.trang_thai || 'dang_ban');
    } else {
      setMaSp('');
      setTenSp('');
      setMoTa('');
      setDanhMuc('');
      setGiaBan('');
      setDonVi('cái');
      setIdDuAn('');
      setTrangThai('dang_ban');
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
    const ma = maSp.trim();
    const ten = tenSp.trim();
    if (!ma) {
      setFormError('Nhập mã sản phẩm.');
      return;
    }
    if (!ten) {
      setFormError('Nhập tên sản phẩm.');
      return;
    }
    const gia = parseMoney(giaBan);
    if (giaBan.trim() && gia == null) {
      setFormError('Giá bán không hợp lệ.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ma_san_pham: ma,
        ten_san_pham: ten,
        mo_ta: moTa.trim() || null,
        danh_muc: danhMuc.trim() || null,
        gia_ban: gia,
        don_vi_tinh: donVi.trim() || 'cái',
        id_du_an: idDuAn || null,
        trang_thai: trangThai,
      };

      if (isEdit && initial?.id) {
        const { error } = await supabase.from(PRODUCTS_TABLE).update(payload).eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(PRODUCTS_TABLE).insert(payload);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error('crm_products save:', err);
      const msg = err instanceof Error ? err.message : 'Không lưu được.';
      setFormError(
        msg.includes('does not exist') || msg.includes('schema cache')
          ? `Chạy supabase/create_crm_products.sql và bật bảng ${PRODUCTS_TABLE} trên Supabase.`
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
          className="pointer-events-auto w-full max-w-[480px] max-h-[min(90dvh,calc(100svh-2rem))] overflow-y-auto overflow-x-hidden rounded-[12px] border border-[var(--border2)] bg-[var(--bg1)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-form-title"
          onMouseDown={(ev) => ev.stopPropagation()}
        >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 bg-[var(--bg1)]">
          <h2 id="product-form-title" className="text-[14px] font-extrabold text-[var(--text)]">
            {isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
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
            <label className={LABEL_CLASS}>Mã sản phẩm (SKU)</label>
            <input
              className={`${FIELD_CLASS} mt-1`}
              value={maSp}
              onChange={(e) => setMaSp(e.target.value)}
              placeholder="SP-001"
              required
              disabled={isEdit}
            />
            {isEdit ? <p className="text-[9px] text-[var(--text3)] mt-1">Mã không đổi khi sửa.</p> : null}
          </div>

          <div>
            <label className={LABEL_CLASS}>Tên sản phẩm</label>
            <input className={`${FIELD_CLASS} mt-1`} value={tenSp} onChange={(e) => setTenSp(e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Danh mục</label>
              <input
                className={`${FIELD_CLASS} mt-1`}
                value={danhMuc}
                onChange={(e) => setDanhMuc(e.target.value)}
                placeholder="VD: Mỹ phẩm"
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Đơn vị</label>
              <input className={`${FIELD_CLASS} mt-1`} value={donVi} onChange={(e) => setDonVi(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Giá bán (VNĐ)</label>
            <input
              className={`${FIELD_CLASS} mt-1`}
              inputMode="numeric"
              value={giaBan}
              onChange={(e) => setGiaBan(formatTypingGroupedInt(e.target.value))}
              placeholder="VD: 1.250.000 — để trống nếu chưa có"
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Dự án (tùy chọn)</label>
            <select className={`${FIELD_CLASS} mt-1`} value={idDuAn} onChange={(e) => setIdDuAn(e.target.value)}>
              <option value="">— Không gắn —</option>
              {duAnList.map((d) => (
                <option key={d.id} value={d.id}>
                  {[d.ma_du_an, d.ten_du_an].filter(Boolean).join(' · ') || d.ten_du_an}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Mô tả</label>
            <textarea
              className={`${FIELD_CLASS} mt-1 min-h-[72px] resize-y`}
              value={moTa}
              onChange={(e) => setMoTa(e.target.value)}
              rows={3}
            />
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
