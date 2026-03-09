/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Crown, Star, Medal, Settings, X, Upload, Plus, Save, Trash2, Loader2, User, LogOut, TrendingUp, Menu, EyeOff } from 'lucide-react';
import { supabase } from './lib/supabase';
import { ReportModal } from './components/ReportModal';
import { LoginView } from './components/LoginView';
import { ProgressDashboard } from './components/ProgressDashboard';

import backgroundImg from './assets/background.png';
import top1Img from './assets/top1.png';
import top2Img from './assets/top2.png';
import top3Img from './assets/top3.png';

interface Employee {
  id: string;
  name: string;
  team: string;
  score: number;
  avatar_url: string | null;
  email?: string;
  pass?: string;
  rank?: number;
}

type Role = 'admin' | 'manager' | 'director' | 'user';

interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  team: string;
  avatar_url: string | null;
}

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const AVATARS_BUCKET = import.meta.env.VITE_SUPABASE_AVATARS_BUCKET?.trim() || 'avatars';
const AUTH_STORAGE_KEY = 'fe_vinhdanh_auth_user';

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
      `Supabase table \"${EMPLOYEES_TABLE}\" was not found in the exposed REST schema. Create the table in schema public or set VITE_SUPABASE_EMPLOYEES_TABLE correctly.`
    );
  }
}

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showMenuBar, setShowMenuBar] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AuthUser;
        if (parsed?.email) {
          setAuthUser(parsed);
        }
      } catch (error) {
        console.warn('Invalid login cache, reset required.', error);
      }
    }
    setAuthChecking(false);
  }, []);

  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    fetchEmployees();
  }, [authUser]);

  const handleLogin = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, email, pass, team, avatar_url')
      .ilike('email', normalizedEmail)
      .eq('pass', password)
      .limit(1);

    if (error) {
      throw new Error(error.message || 'Không thể đăng nhập');
    }

    const user = (data || [])[0] as { id?: string; email?: string; name?: string; team?: string; avatar_url?: string | null } | undefined;
    if (!user?.email) {
      throw new Error('Sai email hoặc mật khẩu');
    }

    const nextUser: AuthUser = {
      id: String(user.id || ''),
      email: String(user.email),
      role: normalizedEmail === 'upedu2024@gmail.com' ? 'admin' : 'user',
      name: String(user.name || ''),
      team: String(user.team || ''),
      avatar_url: user.avatar_url || null,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    setAuthUser(nextUser);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setShowAdmin(false);
    setShowReport(false);
    setShowProgress(false);
    setAuthUser(null);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black text-white">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (!authUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(EMPLOYEES_TABLE)
      .select('*')
      .order('score', { ascending: false });

    if (error) {
      logSupabaseError('fetching employees', error);
    } else {
      // Assign ranks based on score
      const rankedData = (data || []).map((emp, index) => ({
        ...emp,
        rank: index + 1
      }));
      setEmployees(rankedData);
    }
    setLoading(false);
  };

  const top3 = employees.slice(0, 3);
  // Sort top3 to display Rank 3, Rank 1, Rank 2 order for the podium
  const podiumOrder = [
    top3.find(e => e.rank === 3),
    top3.find(e => e.rank === 1),
    top3.find(e => e.rank === 2),
  ].filter(Boolean) as Employee[];

  const others = employees.slice(3);

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-0 font-sans overflow-hidden relative">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `url(${backgroundImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* Menu Toggle Button */}
      <button
        onClick={() => setShowMenuBar(!showMenuBar)}
        className="absolute top-4 left-4 z-50 p-2 bg-black/40 hover:bg-black/60 text-white/70 hover:text-white rounded-full transition-all border border-white/10 backdrop-blur-md"
        title={showMenuBar ? "Ẩn menu" : "Hiện menu"}
      >
        {showMenuBar ? <EyeOff size={20} /> : <Menu size={20} />}
      </button>

      {/* Menu Buttons */}
      <AnimatePresence>
        {showMenuBar && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-4 left-16 z-50 flex gap-2"
          >
            <button
              onClick={() => setShowAdmin(true)}
              className="p-2 bg-black/40 hover:bg-black/60 text-white/70 hover:text-white rounded-full transition-all border border-white/10 backdrop-blur-md"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="px-3 py-2 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-xl transition-all border border-white/10 backdrop-blur-md text-xs font-semibold"
            >
              Bảng Báo cáo
            </button>
            <button
              onClick={() => setShowProgress(true)}
              className="px-3 py-2 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-xl transition-all border border-white/10 backdrop-blur-md text-xs font-semibold flex items-center gap-1"
            >
              <TrendingUp size={14} /> Tiến bộ
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 z-50 px-3 py-2 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-xl transition-all border border-white/10 backdrop-blur-md text-xs font-semibold flex items-center gap-1"
      >
        <LogOut size={14} /> Đăng xuất
      </button>

      {/* Header */}
      <header className="relative z-20 mb-4 w-full pt-6 pb-2 flex flex-col items-center justify-center">
        {/* Header content if needed */}
      </header>

      {/* Main Content */}
      <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center px-0 pb-0">
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-white">
            <Loader2 className="animate-spin text-yellow-400" size={48} />
            <p className="font-bold tracking-widest uppercase bg-black/20 px-4 py-1 rounded-full backdrop-blur-sm">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <>
            {/* Podium Area */}
            <div className="w-full flex flex-col items-center justify-center bg-transparent p-4 relative overflow-hidden flex-1">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />

              <div className="flex items-end justify-center gap-20 lg:gap-32 w-full h-full pb-12 lg:pb-32 relative z-10 transform translate-y-[90px] -translate-x-[120px]">
                {podiumOrder.map((winner) => (
                  <div key={winner.id} className={`${winner.rank === 1 ? 'order-2 -mt-4 z-20 transform -translate-y-12' : winner.rank === 2 ? 'order-3 transform translate-y-4' : 'order-1 transform translate-y-4'}`}>
                    <WinnerCard winner={winner} isCenter={winner.rank === 1} />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: List */}
            <div className="hidden lg:flex absolute right-4 top-4 bottom-4 w-[280px] xl:w-[320px] flex-col z-30">
              <div className="w-full bg-black/50 backdrop-blur-md rounded-2xl border border-white/15 overflow-hidden shadow-2xl flex flex-col h-full">
                <div className="px-3 py-2 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy size={14} className="text-yellow-400" />
                    Bảng Xếp Hạng
                  </h2>
                  <div className="text-white/40 text-[9px] font-mono">TOP 4 - {employees.length}</div>
                </div>

                <div className="grid grid-cols-12 gap-1 px-2.5 py-2 bg-black/20 text-yellow-400/80 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 backdrop-blur-sm shrink-0">
                  <div className="col-span-2 text-center">Rank</div>
                  <div className="col-span-6">Name</div>
                  <div className="col-span-4 text-right">Team</div>
                </div>

                <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent p-1.5">
                  <div className="space-y-0.5">
                    {others.map((winner, index) => (
                      <motion.div
                        key={winner.id}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.05 }}
                        className="grid grid-cols-12 gap-1 px-2 py-1.5 items-center bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all rounded-md group"
                      >
                        <div className="col-span-2 flex justify-center">
                          <div className="w-6 h-6 rounded-full bg-black/20 border border-white/10 group-hover:border-yellow-400/50 flex items-center justify-center text-white font-bold text-[11px] transition-colors">
                            {winner.rank}
                          </div>
                        </div>
                        <div className="col-span-6 flex items-center gap-2">
                          <img src={winner.avatar_url || 'https://via.placeholder.com/150'} alt={winner.name} className="w-6 h-6 rounded-full border border-white/20 object-cover flex-shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-semibold text-[12px] truncate">{winner.name}</span>
                          </div>
                        </div>
                        <div className="col-span-4 flex justify-end items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-emerald-200 text-[10px] font-medium truncate max-w-[60px] text-center">
                            {winner.team}
                          </span>
                          <span className="hidden xl:block text-yellow-400 font-mono font-bold text-[12px]">{winner.score.toLocaleString()}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Admin Modal */}
      <AnimatePresence>
        {showAdmin && (
          <AdminModal
            onClose={() => {
              setShowAdmin(false);
              fetchEmployees();
            }}
            employees={employees}
          />
        )}
        {showReport && (
          <ReportModal
            onClose={() => {
              setShowReport(false);
            }}
            currentUser={authUser}
          />
        )}
        {showProgress && (
          <ProgressDashboard
            onClose={() => {
              setShowProgress(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WinnerCard({ winner, isCenter = false }: { winner: Employee, isCenter?: boolean }) {
  const containerSize = isCenter ? "w-48 h-48 lg:w-60 lg:h-60" : "w-36 h-36 lg:w-44 lg:h-44";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: (winner.rank || 3) * 0.2, type: "spring", stiffness: 100 }}
      className="flex flex-col items-center relative z-10 group"
    >
      <div className={`relative ${containerSize} flex items-center justify-center`}>
        <div className="absolute inset-0 bg-[#FFD700]/5 rounded-full transform scale-125" />
        <div className="w-[84%] h-[84%] rounded-full p-0 relative z-0 top-[-14%]">
          <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 shadow-inner relative">
            <img
              src={winner.avatar_url || 'https://via.placeholder.com/300'}
              alt={winner.name}
              className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.6)] pointer-events-none" />
          </div>
        </div>

        <div className="absolute inset-[-42%] pointer-events-none z-10">
          <img
            src={winner.rank === 1 ? top1Img : winner.rank === 2 ? top2Img : top3Img}
            alt={`Rank ${winner.rank} frame`}
            className="w-full h-full object-contain drop-shadow-2xl"
          />
        </div>
        <div className={`absolute ${winner.rank === 1 ? "bottom-[calc(0%+10px)]" : "bottom-[3%]"} z-20 w-[120%] text-center`}>
          <h3 className={`text-[#4D3302] font-black ${winner.rank === 1 ? "text-[12px] lg:text-[15px]" : "text-[10px] lg:text-[12px]"} uppercase tracking-tighter truncate px-2`}>
            {winner.name}
          </h3>
        </div>

        <div className={`absolute ${winner.rank === 1 ? "bottom-[-26%]" : "bottom-[-26%]"} z-20 w-full text-center`}>
          <span className={`text-[#4D3302] font-bold ${winner.rank === 1 ? "text-[12px] lg:text-[15px]" : "text-[9px] lg:text-[12px]"} uppercase`}>
            Team {winner.team}
          </span>
        </div>
      </div>

      <div className={`${isCenter ? "mt-20" : "mt-14"} text-center flex flex-col items-center`}>
        <div className="mt-1 text-yellow-400 font-bold text-xs lg:text-sm bg-black/40 px-3 py-0.5 rounded-full border-2 border-white backdrop-blur-sm shadow-[0_0_20px_rgba(255,255,255,0.6),inset_0_0_10px_rgba(255,255,255,0.2)]">
          Doanh số: {winner.score.toLocaleString()}
        </div>
      </div>
    </motion.div>
  );
}

function AdminModal({ onClose, employees }: { onClose: () => void, employees: Employee[] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    team: '',
    score: 0,
    avatar_url: '' as string | null,
    email: '',
    pass: ''
  });

  const handleEdit = (emp: Employee) => {
    setEditId(emp.id);
    setFormData({
      name: emp.name,
      team: emp.team,
      score: emp.score,
      avatar_url: emp.avatar_url,
      email: emp.email || '',
      pass: emp.pass || ''
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

      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(AVATARS_BUCKET)
        .getPublicUrl(filePath);

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

    try {
      if (editId) {
        const { error } = await supabase
          .from(EMPLOYEES_TABLE)
          .update(formData)
          .eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(EMPLOYEES_TABLE)
          .insert([formData]);
        if (error) throw error;
      }
      handleReset();
      onClose();
    } catch (error) {
      logSupabaseError('saving employee', error as { code?: string; message?: string; details?: string; hint?: string });
      alert('Lỗi khi lưu dữ liệu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from(EMPLOYEES_TABLE)
        .delete()
        .eq('id', id);
      if (error) throw error;
      onClose(); // Refresh data
    } catch (error) {
      logSupabaseError('deleting employee', error as { code?: string; message?: string; details?: string; hint?: string });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="text-yellow-400" />
            Quản lý Nhân viên
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-yellow-400 flex items-center gap-2">
              {editId ? <Save size={18} /> : <Plus size={18} />}
              {editId ? 'Sửa thông tin' : 'Thêm nhân viên mới'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-center mb-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full bg-black/40 border-2 border-dashed border-white/20 hover:border-yellow-400/50 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group relative"
                >
                  {formData.avatar_url ? (
                    <>
                      <img src={formData.avatar_url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Upload size={20} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-white/20" />
                      <span className="text-[10px] text-white/40 mt-1">Chọn ảnh</span>
                    </>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/50 uppercase font-bold px-1">Tên nhân viên</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-yellow-400/50 outline-none transition-all"
                  placeholder="VD: Ms Thái Minh Khuê"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-white/50 uppercase font-bold px-1">Team</label>
                  <input
                    required
                    value={formData.team}
                    onChange={e => setFormData({ ...formData, team: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-yellow-400/50 outline-none transition-all"
                    placeholder="VD: Alpha"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/50 uppercase font-bold px-1">Doanh số</label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    value={formData.score === 0 ? '' : formData.score.toLocaleString('vi-VN')}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, score: parseInt(val) || 0 });
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-yellow-400/50 outline-none transition-all"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/50 uppercase font-bold px-1">Email (Đăng nhập)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-yellow-400/50 outline-none transition-all"
                  placeholder="VD: user@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/50 uppercase font-bold px-1">Mật khẩu (Đăng nhập)</label>
                <input
                  type="text"
                  value={formData.pass}
                  onChange={e => setFormData({ ...formData, pass: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-yellow-400/50 outline-none transition-all"
                  placeholder="VD: 123456"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {editId ? 'Cập nhật' : 'Lưu nhân viên'}
                </button>
                {editId && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List Section */}
          <div className="space-y-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white/60">Danh sách hiện tại</h3>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-white/10">
              {employees.map(emp => (
                <div key={emp.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-black/20 flex-shrink-0">
                    <img src={emp.avatar_url || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold truncate text-sm">{emp.name}</p>
                    <p className="text-white/40 text-xs">{emp.team} • {emp.score.toLocaleString()} đ</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(emp)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg">
                      <Settings size={16} />
                    </button>
                    <button onClick={() => handleDelete(emp.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {employees.length === 0 && (
                <div className="text-center py-10 text-white/20 italic">Chưa có dữ liệu nhân viên</div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
