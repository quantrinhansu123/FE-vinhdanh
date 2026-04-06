import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Save, Upload, X } from 'lucide-react';
import { supabase } from '../../api/supabase';
import type { CrmAgencyRow } from '../../types';
import { formatTypingGroupedInt } from '../../pages/dashboard/mkt/mktDetailReportShared';

const BUDGET_TABLE = import.meta.env.VITE_SUPABASE_BUDGET_REQUESTS_TABLE?.trim() || 'budget_requests';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';
const AGENCIES_TABLE = import.meta.env.VITE_SUPABASE_AGENCIES_TABLE?.trim() || 'crm_agencies';
const BUDGET_ATTACHMENTS_BUCKET =
  import.meta.env.VITE_SUPABASE_BUDGET_ATTACHMENTS_BUCKET?.trim() || 'budget-attachments';
const FIN_AUDIT_TABLE =
  import.meta.env.VITE_SUPABASE_FINANCE_AUDIT_TABLE?.trim() || 'finance_audit_logs';
const FIN_ACCOUNTS_TABLE =
  import.meta.env.VITE_SUPABASE_FINANCE_ACCOUNTS_TABLE?.trim() || 'finance_accounts';

const EXPENSE_CATEGORIES = [
  'Nạp quỹ ADS ZENO AGENCY',
  'Nạp quỹ ADS (khác)',
  'Thanh toán dịch vụ / phí nền tảng',
  'Thanh toán agency / đối tác',
  'Khác',
] as const;

type DuAnOpt = { id: string; ma_du_an: string | null; ten_du_an: string };
type TkqcOpt = {
  id: string;
  ma_tkqc: string;
  ten_pae: string | null;
};
type FinanceAccount = {
  id: string;
  account_number: string | null;
  bank_name: string | null;
  account_name: string | null;
};

const FIELD_CLASS =
  'w-full min-h-[40px] rounded-[8px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] placeholder:text-[var(--text3)] text-[12px] px-3 py-2.5 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_rgba(61,142,240,0.28)] [color-scheme:dark]';

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]';

const ACCEPT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function parseVndInput(raw: string): number | null {
  const t = raw.replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

export const BudgetRequestFormModal: React.FC<Props> = ({ open, onClose, onSubmitted }) => {
  const [duAnList, setDuAnList] = useState<DuAnOpt[]>([]);
  const [tkqcList, setTkqcList] = useState<TkqcOpt[]>([]);
  const [agencies, setAgencies] = useState<CrmAgencyRow[]>([]);
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);

  const [idDuAn, setIdDuAn] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [tkqcId, setTkqcId] = useState('');
  const [nganHang, setNganHang] = useState('');
  const [soTk, setSoTk] = useState('');
  const [chuTk, setChuTk] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [hangMuc, setHangMuc] = useState('');
  const [noiDungCk, setNoiDungCk] = useState('');
  const [mucDich, setMucDich] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const loadRefs = useCallback(async () => {
    const [dRes, aRes, fRes] = await Promise.all([
      supabase.from(DU_AN_TABLE).select('id, ma_du_an, ten_du_an').order('ten_du_an', { ascending: true }),
      supabase.from(AGENCIES_TABLE).select('id, ma_agency, ten_agency').order('ten_agency', { ascending: true }),
      supabase
        .from(FIN_ACCOUNTS_TABLE)
        .select('id, account_number, bank_name, account_name')
        .order('account_name', { ascending: true }),
    ]);
    if (dRes.error) console.error('BudgetRequestFormModal du_an:', dRes.error);
    else setDuAnList((dRes.data || []) as DuAnOpt[]);
    if (aRes.error) {
      console.warn('BudgetRequestFormModal agencies:', aRes.error);
      setAgencies([]);
    } else {
      setAgencies((aRes.data || []) as CrmAgencyRow[]);
    }
    if (fRes.error) {
      console.warn('BudgetRequestFormModal finance_accounts:', fRes.error);
      setFinanceAccounts([]);
    } else {
      setFinanceAccounts((fRes.data || []) as FinanceAccount[]);
    }
  }, []);

  const loadTkqc = useCallback(async (projectId: string) => {
    if (!projectId) {
      setTkqcList([]);
      return;
    }
    const q = await supabase
      .from(TKQC_TABLE)
      .select('id, ma_tkqc, ten_pae')
      .eq('id_du_an', projectId)
      .order('ma_tkqc', { ascending: true });
    if (q.error) {
      console.error('BudgetRequestFormModal tkqc:', q.error);
      setTkqcList([]);
      return;
    }
    setTkqcList((q.data || []) as TkqcOpt[]);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setAttempted(false);
    void loadRefs();
  }, [open, loadRefs]);

  useEffect(() => {
    if (!open) return;
    void loadTkqc(idDuAn);
    setTkqcId('');
  }, [idDuAn, loadTkqc, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const resetForm = () => {
    setIdDuAn('');
    setAgencyId('');
    setTkqcId('');
    setNganHang('');
    setSoTk('');
    setChuTk('');
    setAmountStr('');
    setHangMuc('');
    setNoiDungCk('');
    setMucDich('');
    setFiles([]);
    setFormError(null);
    setAttempted(false);
  };

  const addFiles = (list: FileList | File[]) => {
    const next: File[] = [...files];
    const arr = Array.from(list);
    for (const f of arr) {
      if (!ACCEPT_MIME.has(f.type) && !f.name.toLowerCase().endsWith('.pdf')) {
        setFormError(`Không hỗ trợ loại file: ${f.name} (chỉ JPG, PNG, PDF).`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFormError(`File quá lớn (tối đa 15MB): ${f.name}`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    setFormError(null);
  };

  const uploadAttachments = async (requestId: string): Promise<string[]> => {
    const urls: string[] = [];
    if (files.length === 0) return urls;
    for (const f of files) {
      const safeName = f.name.replace(/[^\w.\u00C0-\u024F-]/g, '_');
      const path = `${requestId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUDGET_ATTACHMENTS_BUCKET).upload(path, f, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) {
        console.warn('budget attachment upload:', upErr);
        continue;
      }
      const { data } = supabase.storage.from(BUDGET_ATTACHMENTS_BUCKET).getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setFormError(null);

    const amount = parseVndInput(amountStr);
    if (!idDuAn) {
      setFormError('Chọn dự án áp dụng.');
      return;
    }
    if (!agencyId) {
      setFormError('Chọn đơn vị thụ hưởng (agency).');
      return;
    }
    if (!hangMuc.trim()) {
      setFormError('Chọn hoặc nhập hạng mục chi phí.');
      return;
    }
    if (amount == null) {
      setFormError('Nhập số tiền đề xuất hợp lệ (VNĐ).');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ngan_sach_xin: amount,
        trang_thai: 'cho_phe_duyet',
        id_du_an: idDuAn,
        agency_id: agencyId,
        tkqc_id: tkqcId || null,
        ngan_hang: emptyToNull(nganHang),
        so_tai_khoan: emptyToNull(soTk),
        chu_tai_khoan: emptyToNull(chuTk),
        loai_tien: 'VND',
        hang_muc_chi_phi: hangMuc.trim(),
        noi_dung_chuyen_khoan: emptyToNull(noiDungCk),
        muc_dich_chi_tiet: emptyToNull(mucDich),
      };

      const { data: inserted, error: insErr } = await supabase.from(BUDGET_TABLE).insert(payload).select('id').single();
      if (insErr) throw insErr;
      const rid = inserted?.id as string | undefined;
      if (!rid) throw new Error('Không lấy được id yêu cầu.');

      let attachWarn: string | null = null;
      let urls: string[] = [];
      if (files.length > 0) {
        try {
          urls = await uploadAttachments(rid);
        } catch (upFail) {
          console.warn('upload attachments:', upFail);
        }
        if (urls.length > 0) {
          const { error: u2 } = await supabase.from(BUDGET_TABLE).update({ chung_tu_urls: urls }).eq('id', rid);
          if (u2) console.warn('update chung_tu_urls:', u2);
        } else {
          attachWarn =
            'Đã tạo yêu cầu nhưng không tải được chứng từ. Tạo bucket Storage `budget-attachments` (public) hoặc đặt VITE_SUPABASE_BUDGET_ATTACHMENTS_BUCKET.';
        }
      }

      // Ghi log tài chính (audit) — hiển thị kết quả rõ ràng
      try {
        const userAgent =
          typeof navigator !== 'undefined' && navigator?.userAgent ? navigator.userAgent : null;
        const auditRow: Record<string, unknown> = {
          action: 'create_budget_request',
          user_id: null, // có thể điền id người gửi yêu cầu nếu có auth
          target_id: rid,
          details: {
            amount_vnd: amount,
            du_an_id: idDuAn,
            agency_id: agencyId,
            tkqc_id: tkqcId || null,
            category: hangMuc.trim(),
            content: emptyToNull(noiDungCk),
            purpose: emptyToNull(mucDich),
            attachments_count: (urls || []).length,
            attachments_urls: urls || [],
          },
          // Một số schema đặt NOT NULL cho ip → điền 'unknown' nếu không xác định được
          ip: 'unknown',
          location: null,
          user_agent: userAgent,
          logged_at: new Date().toISOString(),
        };
        const { data: logInserted, error: logErr } = await supabase
          .from(FIN_AUDIT_TABLE)
          .insert(auditRow)
          .select('id')
          .single();
        if (logErr) {
          setFormError(`Ghi log tài chính thất bại: ${logErr.message || 'Unknown error'}`);
          return; // không đóng modal — để người dùng thấy lỗi
        } else if (!logInserted?.id) {
          setFormError('Ghi log tài chính thất bại: không nhận được id.');
          return;
        } else {
          window.alert('Đã ghi log tài chính thành công.');
        }
      } catch (logEx) {
        const msg = logEx instanceof Error ? logEx.message : String(logEx);
        setFormError(`Ghi log tài chính thất bại: ${msg}`);
        return; // không đóng modal
      }

      resetForm();
      onSubmitted();
      onClose();
      if (attachWarn) window.alert(attachWarn);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gửi yêu cầu thất bại.';
      setFormError(
        msg.includes('id_du_an') || msg.includes('agency_id') || msg.includes('column')
          ? `${msg} — Chạy supabase/alter_budget_requests_extended_form.sql trên Supabase.`
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  const projectInvalid = attempted && !idDuAn;
  const agencyInvalid = attempted && !agencyId;
  const amountInvalid = attempted && parseVndInput(amountStr) == null;
  const hangMucInvalid = attempted && !hangMuc.trim();

  if (!open) return null;

  return createPortal(
    <div className="dash-theme project-form-modal-root fixed inset-0 z-[10050] !bg-transparent font-[family-name:var(--f)]">
      <div className="absolute inset-0 z-0 bg-black/65 backdrop-blur-[4px]" aria-hidden onMouseDown={onClose} />
      <div className="pointer-events-none relative z-[1] flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6">
        <div
          className="project-form-modal-scroll pointer-events-auto w-full max-w-[640px] max-h-[min(92dvh,calc(100svh-1.5rem))] overflow-y-auto overflow-x-hidden rounded-[var(--r)] border border-[var(--border2)] bg-[var(--bg1)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-req-modal-title"
          onMouseDown={(ev) => ev.stopPropagation()}
        >
          <div className="flex items-center justify-between p-[14px_18px] border-b border-[var(--border2)] shrink-0 bg-[var(--bg1)]">
            <h2 id="budget-req-modal-title" className="text-[14px] font-extrabold text-[var(--text)] tracking-tight">
              Tạo Yêu Cầu Xin Ngân Sách
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[8px] text-[var(--text2)] hover:bg-[var(--bg3)] hover:text-[var(--text)] transition-colors"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="p-[18px] space-y-[14px] pb-[20px]">
            {/* Gợi ý tài khoản mẫu: chọn để tự điền ngân hàng + chủ TK + số TK */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[var(--text2)]">Tài khoản mẫu (tự điền)</span>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const acc = financeAccounts.find((x) => x.id === val);
                    if (acc) {
                      setNganHang(acc.bank_name || '');
                      setChuTk(acc.account_name || '');
                      setSoTk(acc.account_number || '');
                    }
                  }}
                  defaultValue=""
                  className="rounded-[8px] bg-[var(--bg2)] border border-[var(--border2)] p-2 text-[13px] outline-none focus:border-[var(--accent)]"
                >
                  <option value="">— Chọn tài khoản mẫu —</option>
                  {financeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {[acc.account_name, acc.bank_name, acc.account_number].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {formError && (
              <div className="text-[11px] text-[var(--R)] bg-[var(--Rd)]/25 border border-[rgba(224,61,61,0.25)] rounded-[8px] px-3 py-2.5">
                {formError}
              </div>
            )}

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>
                Dự án áp dụng <span className="text-[var(--R)]">*</span>
              </span>
              <select
                value={idDuAn}
                onChange={(e) => setIdDuAn(e.target.value)}
                className={`${FIELD_CLASS} ${projectInvalid ? 'border-[var(--R)] ring-1 ring-[rgba(224,61,61,0.35)]' : ''}`}
              >
                <option value="">-- Chọn Dự Án --</option>
                {duAnList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {[d.ma_du_an, d.ten_du_an].filter(Boolean).join(' · ') || d.ten_du_an}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>
                Đơn vị thụ hưởng <span className="text-[var(--R)]">*</span>
              </span>
              <select
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
                className={`${FIELD_CLASS} ${agencyInvalid ? 'border-[var(--R)] ring-1 ring-[rgba(224,61,61,0.35)]' : ''}`}
              >
                <option value="">-- Chọn Công Ty / Agency --</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.ten_agency}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-[10px] border border-[var(--border2)] bg-[var(--bg2)]/80 p-[14px] space-y-3">
              <div className="text-[10px] font-extrabold tracking-[0.12em] text-[var(--text3)] uppercase">
                Thông tin chuyển khoản
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1.5 sm:col-span-1">
                  <span className={LABEL_CLASS}>Ngân hàng</span>
                  <input
                    value={nganHang}
                    onChange={(e) => setNganHang(e.target.value)}
                    className={FIELD_CLASS}
                    placeholder="Tên ngân hàng"
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-1">
                  <span className={LABEL_CLASS}>Số tài khoản</span>
                  <input
                    value={soTk}
                    onChange={(e) => setSoTk(e.target.value)}
                    className={FIELD_CLASS}
                    placeholder="STK"
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-1">
                  <span className={LABEL_CLASS}>Chủ tài khoản</span>
                  <input
                    value={chuTk}
                    onChange={(e) => setChuTk(e.target.value)}
                    className={`${FIELD_CLASS} uppercase`}
                    placeholder="TÊN CHỦ TÀI KHOẢN"
                  />
                </label>
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>
                Số tiền đề xuất <span className="text-[var(--R)]">*</span>
              </span>
              <div className="flex rounded-[8px] border border-[var(--border2)] bg-[var(--bg2)] overflow-hidden focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_1px_rgba(61,142,240,0.28)]">
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => setAmountStr(formatTypingGroupedInt(e.target.value))}
                  placeholder="0"
                  className={`flex-1 min-h-[40px] bg-transparent text-[12px] font-[var(--mono)] text-[var(--text)] px-3 py-2.5 outline-none border-0 ${
                    amountInvalid ? 'text-[var(--R)]' : ''
                  }`}
                />
                <span className="flex items-center px-3 text-[11px] font-bold text-[var(--R)] shrink-0 border-l border-[var(--border2)]">
                  VND
                </span>
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>
                Tài khoản TKQC <span className="text-[var(--text3)] font-semibold normal-case">(tùy chọn)</span>
              </span>
              <select
                value={tkqcId}
                onChange={(e) => setTkqcId(e.target.value)}
                disabled={!idDuAn}
                className={`${FIELD_CLASS} disabled:opacity-45`}
              >
                <option value="">{idDuAn ? '— Không chọn / chọn sau —' : 'Chọn dự án trước'}</option>
                {tkqcList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.ma_tkqc}
                    {t.ten_pae ? ` · ${t.ten_pae}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>
                Hạng mục chi phí <span className="text-[var(--R)]">*</span>
              </span>
              <select
                value={hangMuc}
                onChange={(e) => setHangMuc(e.target.value)}
                className={`${FIELD_CLASS} ${hangMucInvalid ? 'border-[var(--R)] ring-1 ring-[rgba(224,61,61,0.35)]' : ''}`}
              >
                <option value="">-- Chọn hạng mục --</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Nội dung chuyển khoản</span>
              <input
                value={noiDungCk}
                onChange={(e) => setNoiDungCk(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Ví dụ: Thanh toan HD QC Thang 2..."
              />
            </label>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Mục đích sử dụng (chi tiết)</span>
              <textarea
                value={mucDich}
                onChange={(e) => setMucDich(e.target.value)}
                rows={4}
                className={`${FIELD_CLASS} min-h-[100px] resize-y`}
                placeholder="Mô tả chi tiết mục đích sử dụng ngân sách này..."
              />
            </label>

            <div className="space-y-2">
              <span className={LABEL_CLASS}>Chứng từ đề xuất (báo giá, hợp đồng, hóa đơn…)</span>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[var(--accent)] bg-[rgba(61,142,240,0.08)]'
                    : 'border-[var(--border2)] bg-[var(--bg2)]/50 hover:border-[var(--text3)]'
                }`}
              >
                <Upload className="w-8 h-8 text-[var(--text3)]" strokeWidth={1.25} />
                <p className="text-[12px] font-bold text-[var(--text2)] text-center">
                  Click để chọn file hoặc kéo thả vào đây
                </p>
                <p className="text-[10px] text-[var(--text3)]">Hỗ trợ JPG, PNG, PDF · tối đa 15MB/file</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
              {files.length > 0 && (
                <ul className="text-[11px] text-[var(--text2)] space-y-1 pl-1">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        className="shrink-0 text-[var(--R)] font-bold hover:underline"
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      >
                        Gỡ
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border2)]">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                disabled={saving}
                className="py-2.5 px-4 rounded-[8px] text-[12px] font-bold text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--bg3)] transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 py-2.5 px-5 rounded-[8px] text-[12px] font-bold bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white shadow-[0_4px_16px_rgba(61,142,240,0.35)] transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} strokeWidth={2.25} />}
                Gửi Yêu Cầu
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
