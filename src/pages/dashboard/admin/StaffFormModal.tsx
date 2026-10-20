import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import { fetchAllRows } from '../../../api/fetchAllRows';
import { isVisibleTeam } from '../../../utils/managementVisibility';
import type { CrmTeamRow, Employee } from '../../../types';
import { STITCH_PORTAL_CLASS } from '../../../components/ui/StitchUI';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';
const AVATARS_BUCKET = import.meta.env.VITE_SUPABASE_AVATARS_BUCKET?.trim() || 'avatars';
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const AVATAR_FILE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const TRANG_THAI_OPTIONS = [
  { value: 'dang_lam', label: 'Đang làm' },
  { value: 'nghi', label: 'Nghỉ' },
  { value: 'tam_nghi', label: 'Tạm nghỉ' },
  { value: 'dot_tien', label: 'Đốt tiền' },
] as const;

/** Vị trí cố định (dropdown) */
const VI_TRI_OPTIONS = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Quản lý dự án', label: 'Quản lý dự án' },
  { value: 'Leader', label: 'Leader' },
  { value: 'Nhân viên MKT', label: 'Nhân viên MKT' },
] as const;

const FIELD_CLASS =
  'w-full min-h-[38px] rounded-[6px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] placeholder:text-[var(--text3)] text-[12px] px-3 py-2 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_rgba(61,142,240,0.28)] [color-scheme:dark]';

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]';

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}

function getSaveErrorMessage(err: unknown): string {
  const error = err && typeof err === 'object' ? err as {
    code?: unknown;
    message?: unknown;
  } : null;
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = typeof error?.message === 'string' ? error.message : '';

  if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|table .* not found/i.test(message)) {
    return 'Database chưa có bảng nhân sự. Chạy supabase/create_employees_table.sql trong Supabase SQL Editor rồi thử lại.';
  }
  if (code === '42703' || code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(message)) {
    return 'Database chưa có đủ cột nhân sự CRM. Chạy supabase/alter_employees_crm_staff_ui.sql trong Supabase SQL Editor rồi thử lại.';
  }
  if (code === '23505') {
    return 'Mã nhân sự hoặc email đã được sử dụng. Hãy kiểm tra và nhập giá trị khác.';
  }
  if (code === '23514') {
    return 'Một giá trị không hợp lệ (ví dụ trạng thái hoặc số fanpage). Hãy kiểm tra lại thông tin.';
  }
  if (message) return message;
  if (typeof err === 'string' && err.trim()) return err;
  return 'Lưu thất bại. Kiểm tra kết nối và cấu hình database rồi thử lại.';
}

function getAvatarUploadErrorMessage(err: unknown): string {
  const message = err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
    ? err.message
    : '';
  if (/bucket .*not found|bucket not found/i.test(message)) {
    return `Chưa tìm thấy kho ảnh “${AVATARS_BUCKET}”. Quản trị viên cần tạo bucket avatars và quyền upload trong Supabase.`;
  }
  if (/row-level security|permission|not authorized|unauthorized/i.test(message)) {
    return 'Supabase chưa cấp quyền tải ảnh lên. Quản trị viên cần kiểm tra policy của bucket avatars trong supabase/create_employees_table.sql.';
  }
  return message ? `Tải ảnh lên thất bại: ${message}` : 'Tải ảnh lên thất bại. Kiểm tra kết nối và cấu hình Supabase Storage.';
}

type Props = {
  open: boolean;
  initial: Employee | null;
  onClose: () => void;
  onSaved: () => void;
};

export const StaffFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const isEdit = Boolean(initial?.id);

  const [maNs, setMaNs] = useState('');
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [score, setScore] = useState('0');
  const [ngayBatDau, setNgayBatDau] = useState('');
  const [viTri, setViTri] = useState('');
  const [soFanpage, setSoFanpage] = useState('0');
  const [trangThai, setTrangThai] = useState('dang_lam');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [crmTeams, setCrmTeams] = useState<CrmTeamRow[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setAvatarError(null);
    setAvatarFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    if (initial) {
      setMaNs(initial.ma_ns || '');
      setName(initial.name || '');
      setTeam(initial.team || '');
      setEmail(initial.email || '');
      setPass('');
      setScore(String(initial.score ?? 0));
      setNgayBatDau(toInputDate(initial.ngay_bat_dau));
      setViTri(initial.vi_tri || '');
      setSoFanpage(String(initial.so_fanpage ?? 0));
      setTrangThai(initial.trang_thai || 'dang_lam');
      setAvatarPreview(initial.avatar_url || null);
    } else {
      setMaNs('');
      setName('');
      setTeam('');
      setEmail('');
      setPass('');
      setScore('0');
      setNgayBatDau('');
      setViTri('');
      setSoFanpage('0');
      setTrangThai('dang_lam');
      setAvatarPreview(null);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open || !avatarFile) return;
    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadTeams = async () => {
      setTeamsLoading(true);
      const { data, error } = await fetchAllRows<CrmTeamRow>(supabase
        .from(TEAMS_TABLE)
        .select('id, ma_team, ten_team')
        .order('ten_team', { ascending: true }));
      if (!cancelled) {
        if (error) {
          console.error('crm_teams for staff form:', error);
          setCrmTeams([]);
        } else {
          setCrmTeams(((data || []) as CrmTeamRow[]).filter(isVisibleTeam));
        }
        setTeamsLoading(false);
      }
    };
    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const teamKnownInCrm = useMemo(() => {
    const t = team.trim();
    if (!t) return true;
    return crmTeams.some((row) => (row.ten_team || '').trim() === t);
  }, [team, crmTeams]);

  const viTriInPreset = useMemo(
    () => VI_TRI_OPTIONS.some((o) => o.value === viTri.trim()),
    [viTri]
  );

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
    const ten = name.trim();
    const nhom = team.trim();
    if (!ten) {
      setFormError('Nhập họ tên.');
      return;
    }
    if (!nhom) {
      setFormError('Chọn team từ danh sách.');
      return;
    }
    if (avatarFile && avatarError) {
      setFormError(avatarError);
      return;
    }

    const scoreNum = parseOptionalInt(score) ?? 0;
    const fanpageNum = parseOptionalInt(soFanpage) ?? 0;

    const basePayload: Record<string, unknown> = {
      ma_ns: maNs.trim() || null,
      name: ten,
      team: nhom,
      email: email.trim() || null,
      score: scoreNum,
      ngay_bat_dau: ngayBatDau || null,
      vi_tri: viTri.trim() || null,
      so_fanpage: fanpageNum,
      trang_thai: trangThai,
    };

    if (!isEdit && pass.trim()) {
      basePayload.pass = pass.trim();
    }
    if (isEdit && pass.trim()) {
      basePayload.pass = pass.trim();
    }

    setSaving(true);
    let uploadedAvatarPath: string | null = null;
    try {
      const employeeId = isEdit && initial?.id ? initial.id : crypto.randomUUID();
      if (avatarFile) {
        const extension = AVATAR_FILE_EXTENSIONS[avatarFile.type];
        if (!extension) {
          throw new Error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.');
        }
        const path = `employees/${employeeId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(path, avatarFile, {
          cacheControl: '3600',
          contentType: avatarFile.type,
          upsert: false,
        });
        if (uploadError) throw new Error(getAvatarUploadErrorMessage(uploadError));
        uploadedAvatarPath = path;

        const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
        if (!data?.publicUrl) throw new Error('Đã tải ảnh lên nhưng chưa lấy được URL ảnh công khai.');
        basePayload.avatar_url = data.publicUrl;
      }

      if (isEdit && initial?.id) {
        const payload = { ...basePayload };
        if (!pass.trim()) {
          delete payload.pass;
        }
        const { error: uErr } = await supabase.from(EMPLOYEES_TABLE).update(payload).eq('id', initial.id);
        if (uErr) throw uErr;
      } else {
        const { error: iErr } = await supabase.from(EMPLOYEES_TABLE).insert({ ...basePayload, id: employeeId });
        if (iErr) throw iErr;
      }
    } catch (err: unknown) {
      if (uploadedAvatarPath) {
        const { error: cleanupError } = await supabase.storage.from(AVATARS_BUCKET).remove([uploadedAvatarPath]);
        if (cleanupError) console.warn('avatar upload cleanup:', cleanupError);
      }
      setFormError(getSaveErrorMessage(err));
      console.error('employees save:', err);
      return;
    } finally {
      setSaving(false);
    }
    onSaved();
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className={`${STITCH_PORTAL_CLASS} dash-theme crm-staff-module project-form-modal-root fixed inset-0 z-[10050] !bg-transparent font-[family-name:var(--f)]`}>
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-[3px]" aria-hidden onMouseDown={onClose} />
      <div className="pointer-events-none relative z-[1] flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6">
        <div
          className="project-form-modal-scroll pointer-events-auto w-full max-w-[520px] max-h-[min(90dvh,calc(100svh-2rem))] overflow-y-auto overflow-x-hidden rounded-[var(--r)] border border-[var(--border2)] bg-[var(--bg1)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-form-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-[14px_16px] border-b border-[var(--border2)] shrink-0 bg-[var(--bg1)]">
            <h2 id="staff-form-title" className="text-[13px] font-extrabold text-[var(--text)]">
              {isEdit ? 'Sửa nhân sự' : 'Thêm nhân sự'}
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
                <span className={LABEL_CLASS}>Mã NS (= Mã TK Ads báo cáo MKT)</span>
                <input value={maNs} onChange={(e) => setMaNs(e.target.value)} className={FIELD_CLASS} placeholder="VD: MK-001" />
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
                Họ tên <span className="text-[var(--R)]">*</span>
              </span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} required />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>
                  Team <span className="text-[var(--R)]">*</span>
                </span>
                <select
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className={FIELD_CLASS}
                  required
                  disabled={teamsLoading}
                >
                  <option value="">{teamsLoading ? 'Đang tải team…' : '— Chọn team —'}</option>
                  {!teamKnownInCrm && team.trim() ? (
                    <option value={team.trim()}>{team.trim()} (giữ giá trị cũ)</option>
                  ) : null}
                  {crmTeams.map((row) => {
                    const label = row.ma_team?.trim()
                      ? `${row.ma_team.trim()} · ${row.ten_team}`
                      : row.ten_team;
                    return (
                      <option key={row.id} value={row.ten_team}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                {!teamsLoading && crmTeams.length === 0 ? (
                  <p className="text-[10px] text-[var(--text3)] mt-1">
                    Chưa có team trong CRM. Thêm tại{' '}
                    <span className="text-[var(--text2)]">/crm-admin/teams</span> hoặc chạy{' '}
                    <code className="text-[var(--text2)]">create_crm_teams.sql</code>.
                  </p>
                ) : null}
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD_CLASS} />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Vị trí</span>
              <select
                value={viTriInPreset ? viTri.trim() : viTri.trim() ? `__legacy__:${viTri.trim()}` : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.startsWith('__legacy__:')) setViTri(v.slice('__legacy__:'.length));
                  else setViTri(v);
                }}
                className={FIELD_CLASS}
              >
                <option value="">— Chọn vị trí —</option>
                {!viTriInPreset && viTri.trim() ? (
                  <option value={`__legacy__:${viTri.trim()}`}>{viTri.trim()} (giữ giá trị cũ)</option>
                ) : null}
                {VI_TRI_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-start gap-[12px] sm:gap-[14px]">
              <div className="w-[64px] h-[64px] shrink-0 rounded-full overflow-hidden border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Ảnh đại diện xem trước"
                    className="w-full h-full object-cover"
                    onError={() => {
                      if (avatarFile) setAvatarError('Không thể xem trước tệp ảnh này. Hãy chọn một ảnh khác.');
                    }}
                  />
                ) : (
                  <span className="text-[10px] text-[var(--text3)]">Chưa có ảnh</span>
                )}
              </div>

              <div className="flex-1 space-y-[6px]">
                <label htmlFor="staff-avatar-file" className={LABEL_CLASS}>Ảnh đại diện</label>
                <input
                  ref={avatarInputRef}
                  id="staff-avatar-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!AVATAR_FILE_EXTENSIONS[file.type]) {
                      setAvatarFile(null);
                      setAvatarPreview(initial?.avatar_url || null);
                      setAvatarError('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.');
                      e.target.value = '';
                      return;
                    }
                    if (file.size > MAX_AVATAR_BYTES) {
                      setAvatarFile(null);
                      setAvatarPreview(initial?.avatar_url || null);
                      setAvatarError('Ảnh vượt quá 10 MB. Hãy chọn tệp nhỏ hơn.');
                      e.target.value = '';
                      return;
                    }
                    setAvatarFile(file);
                    setAvatarError(null);
                    setFormError(null);
                  }}
                  className={FIELD_CLASS}
                />
                <p className="text-[10px] text-[var(--text3)]">
                  Chọn ảnh từ thiết bị (JPG, PNG, WEBP hoặc GIF; tối đa 10 MB). Ảnh sẽ được tải trực tiếp lên hệ thống; không chọn ảnh thì giữ ảnh hiện tại nếu có.
                </p>
                {avatarFile ? (
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text2)]">
                    <span className="min-w-0 truncate">Đã chọn: {avatarFile.name}</span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview(initial?.avatar_url || null);
                        setAvatarError(null);
                        if (avatarInputRef.current) avatarInputRef.current.value = '';
                      }}
                      className="shrink-0 text-[var(--accent)] hover:underline disabled:opacity-50"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                ) : null}
                {avatarError ? <p className="text-[10px] text-[var(--R)]" role="alert">{avatarError}</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Điểm (score)</span>
                <input inputMode="numeric" value={score} onChange={(e) => setScore(e.target.value)} className={FIELD_CLASS} />
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Mật khẩu {isEdit ? '(để trống = giữ cũ)' : '(tuỳ chọn)'}</span>
                <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className={FIELD_CLASS} autoComplete="new-password" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Ngày bắt đầu</span>
                <input type="date" value={ngayBatDau} onChange={(e) => setNgayBatDau(e.target.value)} className={FIELD_CLASS} />
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Số fanpage</span>
                <input inputMode="numeric" value={soFanpage} onChange={(e) => setSoFanpage(e.target.value)} className={FIELD_CLASS} />
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
                disabled={saving || (Boolean(avatarFile) && Boolean(avatarError))}
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
