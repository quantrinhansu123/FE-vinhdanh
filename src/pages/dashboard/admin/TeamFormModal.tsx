import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { CrmTeamRow, DuAnRow, Employee } from '../../../types';
import { formatNumberDots, formatTypingGroupedInt } from '../mkt/mktDetailReportShared';

const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';

const TRANG_THAI_OPTIONS = [
  { value: 'hoat_dong', label: 'Hoạt động' },
  { value: 'tam_dung', label: 'Tạm dừng' },
  { value: 'ngung', label: 'Ngừng' },
] as const;

const FIELD_CLASS =
  'w-full min-h-[38px] rounded-[6px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] placeholder:text-[var(--text3)] text-[12px] px-3 py-2 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_rgba(61,142,240,0.28)] [color-scheme:dark]';

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]';

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function asStringIdArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

/** Nhân sự hiển thị trong dropdown Leader (cột vi_tri) */
function isLeaderViTri(viTri: string | null | undefined): boolean {
  const t = viTri?.trim().toLowerCase();
  if (!t) return false;
  if (t.includes('leader')) return true;
  if (t.includes('trưởng nhóm')) return true;
  if (t.includes('team lead')) return true;
  return false;
}

type Props = {
  open: boolean;
  initial: CrmTeamRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const TeamFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const isEdit = Boolean(initial?.id);

  const [maTeam, setMaTeam] = useState('');
  const [tenTeam, setTenTeam] = useState('');
  const [leader, setLeader] = useState('');
  const [doanhSoThang, setDoanhSoThang] = useState('');
  const [trangThai, setTrangThai] = useState('hoat_dong');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [duAns, setDuAns] = useState<DuAnRow[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedDuAnIds, setSelectedDuAnIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (initial) {
      setMaTeam(initial.ma_team || '');
      setTenTeam(initial.ten_team || '');
      setLeader(initial.leader || '');
      setDoanhSoThang(
        initial.doanh_so_thang != null ? formatNumberDots(Math.round(Number(initial.doanh_so_thang)), false) : ''
      );
      setTrangThai(initial.trang_thai || 'hoat_dong');
      setSelectedMemberIds(asStringIdArray(initial.member_ids));
      setSelectedDuAnIds(asStringIdArray(initial.du_an_ids));
    } else {
      setMaTeam('');
      setTenTeam('');
      setLeader('');
      setDoanhSoThang('');
      setTrangThai('hoat_dong');
      setSelectedMemberIds([]);
      setSelectedDuAnIds([]);
    }
    setMemberQuery('');
    setProjectQuery('');
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
    const load = async () => {
      setListsLoading(true);
      try {
        const [empRes, duRes] = await Promise.all([
          supabase
            .from(EMPLOYEES_TABLE)
            .select('id, name, team, email, vi_tri, ma_ns')
            .order('name', { ascending: true }),
          supabase.from(DU_AN_TABLE).select('id, ten_du_an, ma_du_an').order('ten_du_an', { ascending: true }),
        ]);
        if (empRes.error) throw empRes.error;
        if (duRes.error) throw duRes.error;
        if (!cancelled) {
          setEmployees((empRes.data || []) as Employee[]);
          setDuAns((duRes.data || []) as DuAnRow[]);
        }
      } catch (e) {
        console.error('TeamFormModal load lists:', e);
        if (!cancelled) {
          setEmployees([]);
          setDuAns([]);
        }
      } finally {
        if (!cancelled) setListsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const leaderCandidates = useMemo(() => employees.filter((e) => isLeaderViTri(e.vi_tri)), [employees]);

  const filteredMembers = employees.filter((emp) => {
    if (!memberQuery.trim()) return true;
    const q = memberQuery.trim().toLowerCase();
    return (
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.team || '').toLowerCase().includes(q) ||
      (emp.email || '').toLowerCase().includes(q)
    );
  });

  const filteredDuAns = duAns.filter((d) => {
    if (!projectQuery.trim()) return true;
    const q = projectQuery.trim().toLowerCase();
    return (
      (d.ten_du_an || '').toLowerCase().includes(q) ||
      (d.ma_du_an || '').toLowerCase().includes(q)
    );
  });

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleDuAn = (id: string) => {
    setSelectedDuAnIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const ten = tenTeam.trim();
    if (!ten) {
      setFormError('Nhập tên team.');
      return;
    }

    const memberIds = selectedMemberIds;
    const payload = {
      ma_team: maTeam.trim() || null,
      ten_team: ten,
      leader: leader.trim() || null,
      so_thanh_vien: memberIds.length,
      member_ids: memberIds,
      du_an_ids: selectedDuAnIds,
      doanh_so_thang: parseOptionalNumber(doanhSoThang) ?? 0,
      trang_thai: trangThai,
    };

    setSaving(true);
    try {
      if (isEdit && initial?.id) {
        const { error: uErr } = await supabase.from(TEAMS_TABLE).update(payload).eq('id', initial.id);
        if (uErr) throw uErr;
      } else {
        const { error: iErr } = await supabase.from(TEAMS_TABLE).insert(payload);
        if (iErr) throw iErr;
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lưu thất bại.';
      setFormError(msg);
      console.error('crm_teams save:', err);
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
          className="project-form-modal-scroll pointer-events-auto w-full max-w-[560px] max-h-[min(90dvh,calc(100svh-2rem))] overflow-y-auto overflow-x-hidden rounded-[var(--r)] border border-[var(--border2)] bg-[var(--bg1)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-form-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-[14px_16px] border-b border-[var(--border2)] shrink-0 bg-[var(--bg1)]">
            <h2 id="team-form-title" className="text-[13px] font-extrabold text-[var(--text)]">
              {isEdit ? 'Sửa team' : 'Thêm team'}
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
                <span className={LABEL_CLASS}>Mã team</span>
                <input value={maTeam} onChange={(e) => setMaTeam(e.target.value)} className={FIELD_CLASS} placeholder="VD: TEAM-A" />
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
                Tên team <span className="text-[var(--R)]">*</span>
              </span>
              <input value={tenTeam} onChange={(e) => setTenTeam(e.target.value)} className={FIELD_CLASS} required />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Leader</span>
                <select
                  value={leader}
                  onChange={(e) => setLeader(e.target.value)}
                  className={FIELD_CLASS}
                  disabled={listsLoading}
                >
                  <option value="">— Chọn leader (vị trí Leader trong nhân sự) —</option>
                  {leader.trim() &&
                  !leaderCandidates.some((e) => e.name.trim() === leader.trim()) ? (
                    <option value={leader.trim()}>{leader.trim()} (giữ giá trị cũ)</option>
                  ) : null}
                  {leaderCandidates.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name}
                      {emp.ma_ns?.trim() ? ` (${emp.ma_ns.trim()})` : ''}
                      {emp.vi_tri?.trim() ? ` — ${emp.vi_tri.trim()}` : ''}
                    </option>
                  ))}
                </select>
                {!listsLoading && leaderCandidates.length === 0 ? (
                  <p className="text-[10px] text-[var(--text3)] leading-snug">
                    Chưa có nhân sự nào: đặt cột <span className="font-bold">vi_tri</span> chứa «Leader», «Trưởng nhóm» hoặc «Team lead» trong{' '}
                    <span className="font-mono">/crm-admin/staff</span>.
                  </p>
                ) : null}
              </label>
              <label className="block space-y-1.5">
                <span className={LABEL_CLASS}>Doanh số tháng (VND)</span>
                <input
                  inputMode="numeric"
                  value={doanhSoThang}
                  onChange={(e) => setDoanhSoThang(formatTypingGroupedInt(e.target.value))}
                  className={FIELD_CLASS}
                  placeholder="VND"
                />
              </label>
            </div>

            <div className="space-y-[8px]">
              <div className="flex items-center justify-between gap-3">
                <span className={LABEL_CLASS}>Thành viên (nhân sự)</span>
                <span className="text-[10px] text-[var(--text3)] font-bold">{selectedMemberIds.length} đã chọn</span>
              </div>
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Tìm: tên / team / email"
              />
              <div className="project-form-modal-scroll max-h-[180px] overflow-y-auto rounded-[6px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-[8px]">
                {listsLoading ? (
                  <div className="flex items-center justify-center gap-2 text-[var(--text3)] py-6">
                    <Loader2 className="animate-spin" size={16} /> Đang tải…
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-[var(--text3)] text-[11px] py-3 text-center">Không có nhân sự phù hợp.</div>
                ) : (
                  filteredMembers.map((emp) => {
                    const checked = selectedMemberIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-start gap-2 p-[8px] rounded-[6px] cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[rgba(61,142,240,0.12)] border border-[rgba(61,142,240,0.18)]'
                            : 'hover:bg-[rgba(255,255,255,0.04)] border border-transparent'
                        }`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleMember(emp.id)} className="mt-[2px]" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-extrabold text-[var(--text)] truncate">{emp.name}</div>
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

            <div className="space-y-[8px]">
              <div className="flex items-center justify-between gap-3">
                <span className={LABEL_CLASS}>Dự án phụ trách</span>
                <span className="text-[10px] text-[var(--text3)] font-bold">{selectedDuAnIds.length} đã chọn</span>
              </div>
              <input
                value={projectQuery}
                onChange={(e) => setProjectQuery(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Tìm: tên dự án / mã"
              />
              <div className="project-form-modal-scroll max-h-[180px] overflow-y-auto rounded-[6px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-[8px]">
                {listsLoading ? (
                  <div className="flex items-center justify-center gap-2 text-[var(--text3)] py-6">
                    <Loader2 className="animate-spin" size={16} /> Đang tải…
                  </div>
                ) : filteredDuAns.length === 0 ? (
                  <div className="text-[var(--text3)] text-[11px] py-3 text-center">Không có dự án phù hợp.</div>
                ) : (
                  filteredDuAns.map((d) => {
                    const checked = selectedDuAnIds.includes(d.id);
                    const sub = [d.ma_du_an, d.ten_du_an].filter(Boolean).join(' · ');
                    return (
                      <label
                        key={d.id}
                        className={`flex items-start gap-2 p-[8px] rounded-[6px] cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[rgba(61,142,240,0.12)] border border-[rgba(61,142,240,0.18)]'
                            : 'hover:bg-[rgba(255,255,255,0.04)] border border-transparent'
                        }`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleDuAn(d.id)} className="mt-[2px]" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-extrabold text-[var(--text)] truncate">{d.ten_du_an}</div>
                          <div className="text-[10px] text-[var(--text3)] truncate">{sub}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
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
