import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import { fetchAllRows } from '../../../api/fetchAllRows';
import type { CrmTeamRow, DuAnRow, Employee } from '../../../types';
import { formatNumberDots, formatTypingGroupedInt } from '../mkt/mktDetailReportShared';
import { StitchButton, StitchInput, StitchModalFrame, StitchSelect, StitchState } from '../../../components/ui/StitchUI';

const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';
const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';

const TRANG_THAI_OPTIONS = [
  { value: 'hoat_dong', label: 'Hoạt động' },
  { value: 'tam_dung', label: 'Tạm dừng' },
  { value: 'ngung', label: 'Ngừng' },
] as const;

const LABEL_CLASS = 'stitch-label';

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
  if (t === 'admin') return true;
  if (t.includes('quản lý dự án')) return true;
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
          fetchAllRows<Employee>(supabase
            .from(EMPLOYEES_TABLE)
            .select('id, name, team, email, vi_tri, ma_ns')
            .order('name', { ascending: true })),
          fetchAllRows<DuAnRow>(supabase.from(DU_AN_TABLE).select('id, ten_du_an, ma_du_an').order('ten_du_an', { ascending: true })),
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
    <StitchModalFrame labelledBy="team-form-title" onClose={onClose}>
          <div className="stitch-modal-header">
            <div><h2 id="team-form-title">{isEdit ? 'Sửa team' : 'Thêm team'}</h2><p>{isEdit ? 'Cập nhật thông tin và phân công của team.' : 'Tạo team và phân công người phụ trách.'}</p></div>
            <button
              type="button"
              onClick={onClose}
              className="stitch-icon-button"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="stitch-modal-body space-y-[18px]">
            {formError && (
              <StitchState tone="error" role="alert">{formError}</StitchState>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
              <label className="block">
                <span className={LABEL_CLASS}>Mã team</span>
                <StitchInput value={maTeam} onChange={(e) => setMaTeam(e.target.value)} placeholder="VD: TEAM-A" />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Trạng thái</span>
                <StitchSelect value={trangThai} onChange={(e) => setTrangThai(e.target.value)}>
                  {TRANG_THAI_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </StitchSelect>
              </label>
            </div>

            <label className="block">
              <span className={LABEL_CLASS}>
                Tên team <span className="stitch-label-required">*</span>
              </span>
              <StitchInput value={tenTeam} onChange={(e) => setTenTeam(e.target.value)} required />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
              <label className="block">
                <span className={LABEL_CLASS}>Leader</span>
                <StitchSelect
                  value={leader}
                  onChange={(e) => setLeader(e.target.value)}
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
                </StitchSelect>
                {!listsLoading && leaderCandidates.length === 0 ? (
                  <p className="mt-2 text-[10px] text-[var(--stitch-text-muted)] leading-snug">
                    Chưa có nhân sự nào: đặt <span className="font-bold">vi_tri</span> là Admin, Quản lý dự án, Leader (hoặc «Trưởng nhóm» / «Team lead») trong{' '}
                    <span className="font-mono">/crm-admin/staff</span>.
                  </p>
                ) : null}
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Doanh số tháng (VND)</span>
                <StitchInput
                  inputMode="numeric"
                  value={doanhSoThang}
                  onChange={(e) => setDoanhSoThang(formatTypingGroupedInt(e.target.value))}
                  placeholder="VND"
                />
              </label>
            </div>

            <div className="space-y-[8px]">
              <div className="flex items-center justify-between gap-3">
                <span className={LABEL_CLASS}>Thành viên (nhân sự)</span>
                <span className="text-[10px] text-[var(--stitch-text-muted)] font-bold">{selectedMemberIds.length} đã chọn</span>
              </div>
              <StitchInput
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Tìm: tên / team / email"
              />
              <div className="stitch-choice-list">
                {listsLoading ? (
                  <StitchState tone="loading"><Loader2 className="animate-spin" size={16} /> Đang tải…</StitchState>
                ) : filteredMembers.length === 0 ? (
                  <StitchState tone="empty">Không có nhân sự phù hợp.</StitchState>
                ) : (
                  filteredMembers.map((emp) => {
                    const checked = selectedMemberIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className={`stitch-choice ${checked ? 'is-selected' : ''}`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleMember(emp.id)} className="mt-[2px]" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-extrabold text-[var(--stitch-text)] truncate">{emp.name}</div>
                          <div className="text-[10px] text-[var(--stitch-text-muted)] truncate">
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
                <span className="text-[10px] text-[var(--stitch-text-muted)] font-bold">{selectedDuAnIds.length} đã chọn</span>
              </div>
              <StitchInput
                value={projectQuery}
                onChange={(e) => setProjectQuery(e.target.value)}
                placeholder="Tìm: tên dự án / mã"
              />
              <div className="stitch-choice-list">
                {listsLoading ? (
                  <StitchState tone="loading"><Loader2 className="animate-spin" size={16} /> Đang tải…</StitchState>
                ) : filteredDuAns.length === 0 ? (
                  <StitchState tone="empty">Không có dự án phù hợp.</StitchState>
                ) : (
                  filteredDuAns.map((d) => {
                    const checked = selectedDuAnIds.includes(d.id);
                    const sub = [d.ma_du_an, d.ten_du_an].filter(Boolean).join(' · ');
                    return (
                      <label
                        key={d.id}
                        className={`stitch-choice ${checked ? 'is-selected' : ''}`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleDuAn(d.id)} className="mt-[2px]" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-extrabold text-[var(--stitch-text)] truncate">{d.ten_du_an}</div>
                          <div className="text-[10px] text-[var(--stitch-text-muted)] truncate">{sub}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="stitch-modal-footer">
              <StitchButton
                type="button"
                onClick={onClose}
                disabled={saving}
                variant="secondary"
              >
                Huỷ
              </StitchButton>
              <StitchButton
                type="submit"
                disabled={saving}
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : null}
                {isEdit ? 'Cập nhật' : 'Tạo mới'}
              </StitchButton>
            </div>
          </form>
    </StitchModalFrame>,
    document.body
  );
};
