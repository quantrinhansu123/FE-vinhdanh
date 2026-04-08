/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from './api/supabase';
import {
  defaultUpcareMktDateRange,
  fetchUpcareMktEmployees,
  isUpcareLeaderboardEnabled,
  mapUpcareMktRowsToLeaderboardEmployees,
} from './api/upcareCrm';
import { LoginPage } from './pages/LoginPage';
import { DashboardAdminLayout } from './pages/DashboardAdminLayout';
import { LeaderboardPage } from './pages/LeaderboardPage';
import type { Employee, AuthUser } from './types';
import { crmAdminPathForView } from './utils/crmAdminRoutes';
import { crmNavTierFromUser, defaultViewForTier } from './utils/crmNavAccess';

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

function AppRoutes() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  /** BXH trang chủ: Upcare MKT API nếu bật, không thì cùng nguồn Supabase employees */
  const [boardEmployees, setBoardEmployees] = useState<Employee[]>([]);
  const [boardSource, setBoardSource] = useState<'upcare' | 'supabase'>('supabase');
  const [loading, setLoading] = useState(true);
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

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(EMPLOYEES_TABLE).select('*').order('score', { ascending: false });

    let rankedData: Employee[] = [];
    if (error) {
      logSupabaseError('fetching employees', error);
    } else {
      rankedData = (data || []).map((emp, index) => ({
        ...emp,
        rank: index + 1,
      }));
      setEmployees(rankedData);
    }

    let board = rankedData;
    let source: 'upcare' | 'supabase' = 'supabase';
    if (isUpcareLeaderboardEnabled()) {
      try {
        const { dateFrom, dateTo } = defaultUpcareMktDateRange();
        const mktRows = await fetchUpcareMktEmployees({ dateFrom, dateTo });
        board = mapUpcareMktRowsToLeaderboardEmployees(mktRows);
        // Không dùng avatar từ API Upcare
        board = board.map((b) => ({ ...b, avatar_url: null }));
        // Ưu tiên avatar theo code ↔ ma_ns trong bảng employees (dùng rankedData vừa fetch để tránh lệch state)
        if (rankedData.length > 0) {
          const normalize = (s: string | null | undefined) => (s ? s.trim().toLowerCase() : '');
          const codeVariants = (raw: string | null | undefined): string[] => {
            const k = normalize(raw);
            if (!k) return [];
            const variants = new Set<string>();
            variants.add(k);
            // Nếu có dạng tiền tố như "fbc.ducnt" → lấy phần sau dấu chấm
            if (k.includes('.')) {
              variants.add(k.split('.').pop() || k);
            }
            // Bỏ ký tự không phải chữ-số (giữ lại chữ và số)
            variants.add(k.replace(/[^a-z0-9]/g, ''));
            return Array.from(variants).filter(Boolean);
          };
          const byMaNs = new Map<string, { avatar_url: string | null; team: string | null }>();
          const byEmail = new Map<string, { avatar_url: string | null; team: string | null }>();
          for (const e of rankedData) {
            const k = normalize(e.ma_ns);
            if (k) {
              byMaNs.set(k, { avatar_url: e.avatar_url || null, team: e.team || null });
              byMaNs.set(k.replace(/[^a-z0-9]/g, ''), { avatar_url: e.avatar_url || null, team: e.team || null });
            }
            const em = e.email?.trim()?.toLowerCase();
            if (em) byEmail.set(em, { avatar_url: e.avatar_url || null, team: e.team || null });
          }
          board = board.map((b) => {
            const variants = codeVariants(b.code ? String(b.code) : '');
            for (const v of variants) {
              if (byMaNs.has(v)) {
                const hit = byMaNs.get(v);
                const av = hit?.avatar_url || null;
                const team = hit?.team || null;
                return { ...b, avatar_url: av || b.avatar_url || null, team: team ?? b.team ?? null };
              }
            }
            // Dự phòng: so khớp theo email nếu có
            const em = b.email?.trim()?.toLowerCase();
            if (em && byEmail.has(em)) {
              const hit = byEmail.get(em);
              const av = hit?.avatar_url || null;
              const team = hit?.team || null;
              return { ...b, avatar_url: av || b.avatar_url || null, team: team ?? b.team ?? null };
            }
            return b;
          });
        }
        // Đảm bảo thứ tự Top sau khi override dữ liệu
        board = [...board]
          .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
          .map((e, i) => ({ ...e, rank: i + 1 }));
        source = 'upcare';
      } catch (e) {
        console.warn('[BXH] Upcare employee/mkt:', e);
        board = rankedData;
        source = 'supabase';
      }
    }
    setBoardEmployees(board);
    setBoardSource(source);

    setLoading(false);
  };

  const handleLogin = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, email, pass, team, avatar_url, vi_tri, ma_ns')
      .ilike('email', normalizedEmail)
      .eq('pass', password)
      .limit(1);

    if (error) {
      throw new Error(error.message || 'Không thể đăng nhập');
    }

    const user = (data || [])[0] as {
      id?: string;
      email?: string;
      name?: string;
      team?: string;
      avatar_url?: string | null;
      vi_tri?: string | null;
      ma_ns?: string | null;
    } | undefined;
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
      vi_tri: user.vi_tri?.trim() ? user.vi_tri.trim() : null,
      ma_ns: user.ma_ns?.trim() ? user.ma_ns.trim() : null,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    setAuthUser(nextUser);
    navigate('/', { replace: true });
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthUser(null);
    navigate('/login', { replace: true });
  };

  if (authChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black text-white font-sans antialiased">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={authUser ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />}
      />

      <Route
        path="/"
        element={
          authUser ? (
            <LeaderboardPage
              employees={boardEmployees}
              boardSource={boardSource}
              loading={loading}
              showMenuBar={showMenuBar}
              setShowMenuBar={setShowMenuBar}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="/admin" element={<Navigate to="/crm-admin/teams" replace />} />

      <Route
        path="/bao-cao"
        element={authUser ? <Navigate to="/crm-admin/mkt-report" replace /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/tien-bo"
        element={authUser ? <Navigate to="/crm-admin/leader-dash" replace /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/marketing"
        element={
          authUser ? <Navigate to="/crm-admin/leader-mkt" replace /> : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/crm-admin/*"
        element={
          authUser ? (
            <DashboardAdminLayout
              employees={employees}
              onEmployeesRefresh={fetchEmployees}
              onClose={() => navigate('/')}
              onLogout={handleLogout}
              userName={authUser.name || 'Admin User'}
              userSubtitle={authUser.role === 'admin' ? 'Hệ thống cấp cao' : authUser.team || 'Người dùng'}
              avatarUrl={authUser.avatar_url}
              reportUser={authUser}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/crm-dashboard/*"
        element={
          authUser ? (
            <Navigate to={crmAdminPathForView(defaultViewForTier(crmNavTierFromUser(authUser)))} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
