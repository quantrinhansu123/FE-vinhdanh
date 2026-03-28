/**
 * Quản lý nhân viên (bảng employees) — dùng trong CRM Team → Thành viên.
 */

import { useState, useRef } from 'react';
import { Settings, Upload, Plus, Save, Trash2, Loader2, Pencil } from 'lucide-react';
import { supabase } from '../../api/supabase';
import type { Employee } from '../../types';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const AVATARS_BUCKET = import.meta.env.VITE_SUPABASE_AVATARS_BUCKET?.trim() || 'avatars';

/** Gửi lên Supabase: chuỗi rỗng → null; email chữ thường (khớp unique index lower(email)) */
function employeePayloadFromForm(formData: {
  name: string;
  team: string;
  score: number;
  avatar_url: string | null;
  email: string;
  pass: string;
}) {
  const rawEmail = formData.email.trim();
  const pass = formData.pass.trim();
  return {
    name: formData.name.trim(),
    team: formData.team.trim(),
    score: Number.isFinite(formData.score) ? Math.round(formData.score) : 0,
    avatar_url: formData.avatar_url?.trim() || null,
    email: rawEmail ? rawEmail.toLowerCase() : null,
    pass: pass ? pass : null,
  };
}

/** Email đã dùng bởi nhân viên khác? (so khớp không phân biệt hoa thường) */
async function isEmailTakenByOther(
  email: string,
  excludeEmployeeId: string | null
): Promise<boolean> {
  const { data: rows, error } = await supabase.from(EMPLOYEES_TABLE).select('id, email');
  if (error) throw error;
  const want = email.toLowerCase();
  return (rows || []).some(
    (r) => r.id !== excludeEmployeeId && (r.email || '').trim().toLowerCase() === want
  );
}

function logSupabaseError(action: string, error: { code?: string; message?: string; details?: string; hint?: string } | null) {
  if (!error) return;
  console.error(`Error ${action}:`, {
    table: EMPLOYEES_TABLE,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  if (error.code === 'PGRST205') {
    console.error(
      `Supabase table "${EMPLOYEES_TABLE}" was not found in the exposed REST schema. Create the table in schema public or set VITE_SUPABASE_EMPLOYEES_TABLE correctly.`
    );
  }
}

export interface EmployeeTeamAdminPanelProps {
  employees: Employee[];
  onRefresh: () => void | Promise<void>;
}

export function EmployeeTeamAdminPanel({ employees, onRefresh }: EmployeeTeamAdminPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    team: '',
    score: 0,
    avatar_url: '' as string | null,
    email: '',
    pass: '',
  });

  const handleEdit = (emp: Employee) => {
    setEditId(emp.id);
    setFormData({
      name: emp.name,
      team: emp.team,
      score: emp.score,
      avatar_url: emp.avatar_url,
      email: emp.email || '',
      pass: emp.pass || '',
    });
  };

  const handleReset = () => {
    setEditId(null);
    setFormData({ name: '', team: '', score: 0, avatar_url: '', email: '', pass: '' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSubmitting(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);

      setFormData({ ...formData, avatar_url: publicUrl });
    } catch (error) {
      const supabaseError = error as { message?: string; code?: string };
      console.error('Error uploading image:', supabaseError);
      alert(
        `Lỗi khi tải ảnh lên. Hãy đảm bảo bucket "${AVATARS_BUCKET}" đã được tạo và có policy ghi. ${supabaseError?.message ? `Chi tiết: ${supabaseError.message}` : ''}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = employeePayloadFromForm(formData);

    try {
      if (payload.email) {
        const taken = await isEmailTakenByOther(payload.email, editId);
        if (taken) {
          alert('Email này đã được dùng cho nhân viên khác. Chọn email khác hoặc để trống.');
          return;
        }
      }

      if (editId) {
        const { error } = await supabase.from(EMPLOYEES_TABLE).update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(EMPLOYEES_TABLE).insert([payload]);
        if (error) throw error;
      }
      handleReset();
      await onRefresh();
    } catch (error) {
      const err = error as { code?: string; message?: string; details?: string };
      logSupabaseError('saving employee', err);
      const msg = err?.message || '';
      const isDuplicate = err?.code === '23505' || /duplicate key|unique constraint/i.test(msg);
      alert(
        isDuplicate
          ? 'Email đã tồn tại (hoặc trùng ràng buộc duy nhất). Dùng email khác hoặc để trống email.'
          : `Lỗi khi lưu dữ liệu.${msg ? `\n${msg}` : ''}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from(EMPLOYEES_TABLE).delete().eq('id', id);
      if (error) throw error;
      await onRefresh();
    } catch (error) {
      logSupabaseError('deleting employee', error as { code?: string; message?: string; details?: string; hint?: string });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="crm-team-members" className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30">
      <div className="px-6 lg:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30">
        <h2 className="text-xl font-bold text-crm-on-surface flex items-center gap-2 tracking-tight">
          <Settings className="text-crm-accent-warm shrink-0" size={22} />
          Quản lý nhân viên (Vinh danh)
        </h2>
        <p className="text-xs text-crm-on-surface-variant mt-1">Thêm, sửa, xóa thành viên và điểm bảng xếp hạng — đồng bộ với trang chủ.</p>
      </div>

      <div className="p-6 lg:p-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-xs font-extrabold text-crm-primary uppercase tracking-[0.2em] flex items-center gap-2">
            {editId ? <Save size={16} /> : <Plus size={16} />}
            {editId ? 'Sửa thông tin' : 'Thêm nhân viên mới'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center mb-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                className="w-24 h-24 rounded-full bg-crm-surface-accent/30 border-2 border-dashed border-crm-outline/50 hover:border-crm-primary/50 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group relative"
              >
                {formData.avatar_url ? (
                  <>
                    <img src={formData.avatar_url} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-crm-surface/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Upload size={20} className="text-crm-on-surface" />
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-crm-on-surface-variant/40" />
                    <span className="text-[10px] text-crm-on-surface-variant mt-1">Chọn ảnh</span>
                  </>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-crm-on-surface-variant uppercase font-bold px-1">Tên nhân viên</label>
              <input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface focus:border-crm-primary/50 outline-none transition-all"
                placeholder="VD: Ms Thái Minh Khuê"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-crm-on-surface-variant uppercase font-bold px-1">Team</label>
                <input
                  required
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  className="w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface focus:border-crm-primary/50 outline-none transition-all"
                  placeholder="VD: Alpha"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-crm-on-surface-variant uppercase font-bold px-1">Doanh số</label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  value={formData.score === 0 ? '' : formData.score.toLocaleString('vi-VN')}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, score: parseInt(val) || 0 });
                  }}
                  className="w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface focus:border-crm-primary/50 outline-none transition-all"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-crm-on-surface-variant uppercase font-bold px-1">Email (Đăng nhập)</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface focus:border-crm-primary/50 outline-none transition-all"
                placeholder="VD: user@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-crm-on-surface-variant uppercase font-bold px-1">Mật khẩu (Đăng nhập)</label>
              <input
                type="text"
                value={formData.pass}
                onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
                className="w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface focus:border-crm-primary/50 outline-none transition-all"
                placeholder="VD: 123456"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-crm-primary hover:bg-crm-primary/90 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(34,197,94,0.28)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {editId ? 'Cập nhật' : 'Lưu nhân viên'}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 bg-crm-surface-accent/50 hover:bg-crm-surface-accent text-crm-on-surface rounded-xl transition-all border border-crm-outline/50"
                >
                  Hủy
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="space-y-4 flex flex-col min-h-0">
          <h3 className="text-xs font-extrabold text-crm-on-surface-variant uppercase tracking-[0.15em]">Danh sách hiện tại</h3>
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[min(520px,55vh)] pr-1 custom-scrollbar">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="p-3 bg-crm-surface-accent/30 border border-crm-outline/50 rounded-xl flex items-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-crm-surface flex-shrink-0 border border-crm-outline/40">
                  <img src={emp.avatar_url || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-crm-on-surface font-bold truncate text-sm">{emp.name}</p>
                  <p className="text-crm-on-surface-variant text-xs">
                    {emp.team} • {emp.score.toLocaleString()} đ
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleEdit(emp)}
                    className="p-2 text-crm-primary hover:bg-crm-primary/10 rounded-lg"
                    title="Sửa"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(emp.id)}
                    className="p-2 text-crm-error hover:bg-crm-error/10 rounded-lg"
                    title="Xóa"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {employees.length === 0 && (
              <div className="text-center py-10 text-crm-on-surface-variant text-sm italic">Chưa có dữ liệu nhân viên</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
