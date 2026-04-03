import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { CrmTeamRow, DuAnRow, Employee, TkqcAdListRow } from '../../../types';

const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const MKT_STAFF_TABLE = import.meta.env.VITE_SUPABASE_MARKETING_STAFF_TABLE?.trim() || 'marketing_staff';
const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';

const TRANG_THAI_TKQC_OPTIONS: { value: 'active' | 'thieu_thiet_lap'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'thieu_thiet_lap', label: 'Thiếu thiết lập' },
];

const FIELD_CLASS =
  'w-full min-h-[38px] rounded-[6px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] placeholder:text-[var(--text3)] text-[12px] px-3 py-2 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_rgba(61,142,240,0.28)] [color-scheme:dark]';

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]';

type MktStaffRow = { id: string; id_ns: string; name: string; employee_id?: string | null };

function isMktEmployee(viTri: string | null | undefined): boolean {
  const raw = (viTri || '').trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  if (t === 'nhân viên mkt') return true;
  const u = raw.toUpperCase();
  if (u === 'MKT' || u === 'MARKETING') return true;
  if (/\bMKT\b/.test(u)) return true;
  return u.startsWith('MKT/') || u.startsWith('MKT-');
}

async function ensureMarketingStaffForEmployee(
  empId: string,
  emps: Pick<Employee, 'id' | 'name' | 'ma_ns' | 'email'>[]
): Promise<string> {
  const { data: existing, error: exErr } = await supabase
    .from(MKT_STAFF_TABLE)
    .select('id')
    .eq('employee_id', empId)
    .maybeSingle();
  if (exErr) throw exErr;
  if (existing?.id) return existing.id as string;

  const emp = emps.find((e) => e.id === empId);
  if (!emp) throw new Error('Không tìm thấy nhân sự MKT.');

  const baseNs = (emp.ma_ns || '').trim() || `EMP-${emp.id.replace(/-/g, '').slice(0, 12)}`;
  const emailPrimary = (emp.email || '').trim();

  for (let attempt = 0; attempt < 6; attempt++) {
    const id_ns = attempt === 0 ? baseNs : `${baseNs}-${attempt}`;
    const email =
      attempt === 0 && emailPrimary
        ? emailPrimary
        : `mkt.${emp.id}${attempt ? `.${attempt}` : ''}@crm-employee.local`;

    const ins = await supabase
      .from(MKT_STAFF_TABLE)
      .insert({
        id_ns,
        name: emp.name,
        email,
        employee_id: empId,
      })
      .select('id')
      .single();

    if (!ins.error && ins.data?.id) return ins.data.id as string;
    if (ins.error?.code !== '23505') {
      throw new Error(ins.error.message || 'Không tạo được bản ghi marketing_staff.');
    }
  }
  throw new Error('Không tạo được marketing_staff (trùng id_ns/email).');
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}

type Props = {
  open: boolean;
  initial: TkqcAdListRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const AdAccountFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const isEdit = Boolean(initial?.id);

  const [idDuAn, setIdDuAn] = useState('');
  const [maTkqc, setMaTkqc] = useState('');
  const [tenTkqc, setTenTkqc] = useState('');
  const [tenQuangCao, setTenQuangCao] = useState('');
  const [tenPae, setTenPae] = useState('');
  const [nenTang, setNenTang] = useState('');
  const [nganSach, setNganSach] = useState('');
  /** '' | `emp:${uuid}` | `ms:${uuid}` (marketing_staff) */
  const [mktValue, setMktValue] = useState('');
  const [idCrmTeam, setIdCrmTeam] = useState('');
  const [ngayBatDau, setNgayBatDau] = useState('');
  const [trangThaiTkqc, setTrangThaiTkqc] = useState<'active' | 'thieu_thiet_lap'>('active');
  const [projects, setProjects] = useState<DuAnRow[]>([]);
  const [mktStaffRows, setMktStaffRows] = useState<MktStaffRow[]>([]);
  const [mktEmployees, setMktEmployees] = useState<Employee[]>([]);
  const [teamList, setTeamList] = useState<CrmTeamRow[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setListsLoading(true);
      setFormError(null);

      if (initial) {
        setIdDuAn(initial.id_du_an);
        setMaTkqc(initial.ma_tkqc || '');
        setTenTkqc(initial.ten_tkqc || '');
        setTenQuangCao(initial.ten_quang_cao?.trim() ? initial.ten_quang_cao.trim() : '');
        setTenPae(initial.ten_pae || '');
        setNenTang(initial.nen_tang || '');
        setNganSach(
          initial.ngan_sach_phan_bo != null && Number.isFinite(Number(initial.ngan_sach_phan_bo))
            ? String(initial.ngan_sach_phan_bo)
            : ''
        );
        setIdCrmTeam(initial.id_crm_team || '');
        setNgayBatDau(toInputDate(initial.ngay_bat_dau));
        setTrangThaiTkqc(initial.trang_thai_tkqc === 'thieu_thiet_lap' ? 'thieu_thiet_lap' : 'active');
      } else {
        setIdDuAn('');
        setMaTkqc('');
        setTenTkqc('');
        setTenQuangCao('');
        setTenPae('');
        setNenTang('');
        setNganSach('');
        setIdCrmTeam('');
        setNgayBatDau('');
        setTrangThaiTkqc('active');
      }

      const [pRes, mRes, tRes, eRes] = await Promise.all([
        supabase.from(DU_AN_TABLE).select('id, ma_du_an, ten_du_an').order('ten_du_an', { ascending: true }),
        supabase.from(MKT_STAFF_TABLE).select('id, id_ns, name, employee_id').order('name', { ascending: true }),
        supabase.from(TEAMS_TABLE).select('id, ma_team, ten_team').order('ten_team', { ascending: true }),
        supabase
          .from(EMPLOYEES_TABLE)
          .select('id, name, ma_ns, email, vi_tri')
          .order('name', { ascending: true }),
      ]);
      if (cancelled) return;
      if (pRes.error) console.error('du_an for tkqc form:', pRes.error);
      if (mRes.error) console.error('marketing_staff for tkqc form:', mRes.error);
      if (tRes.error) console.error('crm_teams for tkqc form:', tRes.error);
      if (eRes.error) console.error('employees for tkqc MKT:', eRes.error);

      setProjects((pRes.data || []) as DuAnRow[]);
      const msRows = (mRes.data || []) as MktStaffRow[];
      setMktStaffRows(msRows);
      setTeamList((tRes.data || []) as CrmTeamRow[]);

      const allEmps = (eRes.data || []) as Employee[];
      setMktEmployees(allEmps.filter((e) => isMktEmployee(e.vi_tri)));

      let mv = '';
      if (initial?.id_marketing_staff) {
        const ms = msRows.find((m) => m.id === initial.id_marketing_staff);
        if (ms?.employee_id) mv = `emp:${ms.employee_id}`;
        else mv = `ms:${initial.id_marketing_staff}`;
      }
      setMktValue(mv);
      setListsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initial?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const ma = maTkqc.trim();
    if (!ma) {
      setFormError('Nhập mã TKQC.');
      return;
    }
    if (!isEdit && !idDuAn) {
      setFormError('Chọn dự án.');
      return;
    }
    const ns = parseOptionalNumber(nganSach);
    setSaving(true);
    try {
      let id_marketing_staff: string | null = null;
      if (mktValue) {
        if (mktValue.startsWith('emp:')) {
          id_marketing_staff = await ensureMarketingStaffForEmployee(mktValue.slice(4), mktEmployees);
        } else if (mktValue.startsWith('ms:')) {
          id_marketing_staff = mktValue.slice(3);
        } else {
          id_marketing_staff = mktValue;
        }
      }

      if (isEdit && initial?.id) {
        const { error } = await supabase
          .from(TKQC_TABLE)
          .update({
            ten_tkqc: tenTkqc.trim() || null,
            ten_quang_cao: tenQuangCao.trim() || null,
            ten_pae: tenPae.trim() || null,
            nen_tang: nenTang.trim() || null,
            ngan_sach_phan_bo: ns ?? 0,
            id_marketing_staff,
            id_crm_team: idCrmTeam || null,
            ngay_bat_dau: ngayBatDau.trim() || null,
            trang_thai_tkqc: trangThaiTkqc,
          })
          .eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(TKQC_TABLE).insert({
          id_du_an: idDuAn,
          ma_tkqc: ma,
          ten_tkqc: tenTkqc.trim() || null,
          ten_quang_cao: tenQuangCao.trim() || null,
          ten_pae: tenPae.trim() || null,
          nen_tang: nenTang.trim() || null,
          ngan_sach_phan_bo: ns ?? 0,
          id_marketing_staff,
          id_crm_team: idCrmTeam || null,
          ngay_bat_dau: ngayBatDau.trim() || null,
          trang_thai_tkqc: trangThaiTkqc,
        });
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lưu thất bại.';
      setFormError(msg);
      console.error('tkqc save:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="dash-theme project-form-modal-root fixed inset-0 z-[200] !bg-transparent font-[family-name:var(--f)]">
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-[3px]" aria-hidden onMouseDown={onClose} />
      <div className="pointer-events-none relative z-[1] flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6">
        <div
          className="project-form-modal-scroll pointer-events-auto w-full max-w-[500px] max-h-[min(90dvh,calc(100svh-2rem))] overflow-y-auto overflow-x-hidden rounded-[var(--r)] border border-[var(--border2)] bg-[var(--bg1)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ad-acc-form-title"
          onMouseDown={(ev) => ev.stopPropagation()}
        >
          <div className="flex items-center justify-between p-[14px_16px] border-b border-[var(--border2)] shrink-0 bg-[var(--bg1)]">
            <h2 id="ad-acc-form-title" className="text-[13px] font-extrabold text-[var(--text)]">
              {isEdit ? 'Sửa tài khoản Ads' : 'Thêm tài khoản Ads'}
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

            {!isEdit && (
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>
                  Dự án <span className="text-[var(--R)]">*</span>
                </span>
                <select
                  value={idDuAn}
                  onChange={(e) => setIdDuAn(e.target.value)}
                  className={FIELD_CLASS}
                  required
                  disabled={listsLoading}
                >
                  <option value="">— Chọn dự án —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {[p.ma_du_an, p.ten_du_an].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>
                Mã TKQC <span className="text-[var(--R)]">*</span>
              </span>
              <input
                value={maTkqc}
                onChange={(e) => setMaTkqc(e.target.value)}
                className={FIELD_CLASS}
                placeholder="VD: FB-123456"
                required
                disabled={isEdit}
                autoComplete="off"
              />
            </label>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Tên TK Ads</span>
              <input
                value={tenTkqc}
                onChange={(e) => setTenTkqc(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Tên hiển thị"
                autoComplete="off"
              />
            </label>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Tên quảng cáo</span>
              <input
                value={tenQuangCao}
                onChange={(e) => setTenQuangCao(e.target.value)}
                className={FIELD_CLASS}
                placeholder="VD: FABICO - 122120954511034419"
                autoComplete="off"
              />
            </label>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Fanpage / tên Page</span>
              <input
                value={tenPae}
                onChange={(e) => setTenPae(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Tên page"
                autoComplete="off"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Nền tảng</span>
                <input
                  value={nenTang}
                  onChange={(e) => setNenTang(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="Facebook, Google…"
                />
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Hạn mức (VND)</span>
                <input
                  inputMode="numeric"
                  value={nganSach}
                  onChange={(e) => setNganSach(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="Ngân sách phân bổ"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Trạng thái</span>
              <select
                value={trangThaiTkqc}
                onChange={(e) => setTrangThaiTkqc(e.target.value as 'active' | 'thieu_thiet_lap')}
                className={FIELD_CLASS}
              >
                {TRANG_THAI_TKQC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Team</span>
                <select
                  value={idCrmTeam}
                  onChange={(e) => setIdCrmTeam(e.target.value)}
                  className={FIELD_CLASS}
                  disabled={listsLoading}
                >
                  <option value="">— Chọn team —</option>
                  {teamList.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {[tm.ma_team, tm.ten_team].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Ngày bắt đầu</span>
                <input
                  type="date"
                  value={ngayBatDau}
                  onChange={(e) => setNgayBatDau(e.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className={LABEL_CLASS}>Marketing (nhân sự MKT)</span>
              <select
                value={mktValue}
                onChange={(e) => setMktValue(e.target.value)}
                className={FIELD_CLASS}
                disabled={listsLoading}
              >
                <option value="">— Không gắn —</option>
                {mktEmployees.map((emp) => {
                  const head = [emp.ma_ns?.trim(), emp.name].filter(Boolean).join(' · ') || emp.name;
                  const tail = emp.vi_tri?.trim() ? ` — ${emp.vi_tri.trim()}` : '';
                  return (
                    <option key={emp.id} value={`emp:${emp.id}`}>
                      {head}
                      {tail}
                    </option>
                  );
                })}
                {mktStaffRows
                  .filter((m) => !m.employee_id)
                  .map((m) => (
                    <option key={m.id} value={`ms:${m.id}`}>
                      {m.name} ({m.id_ns}) · CRM (chưa gắn nhân sự)
                    </option>
                  ))}
              </select>
              {!listsLoading && mktEmployees.length === 0 ? (
                <p className="text-[10px] text-[var(--text3)] mt-1">
                  Chưa có nhân sự MKT: đặt <span className="text-[var(--text2)]">Vị trí</span> chứa &quot;MKT&quot; tại{' '}
                  <span className="text-[var(--text2)]">/crm-admin/staff</span>, rồi chạy SQL{' '}
                  <code className="text-[var(--text2)]">alter_marketing_staff_employee_id.sql</code> nếu cột{' '}
                  <code className="text-[var(--text2)]">employee_id</code> chưa có.
                </p>
              ) : null}
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-3 rounded-[6px] text-[12px] font-bold border border-[var(--border2)] text-[var(--text2)] hover:bg-[var(--bg3)]"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={saving || listsLoading}
                className="flex items-center gap-2 py-2 px-4 rounded-[6px] text-[12px] font-bold bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : null}
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
