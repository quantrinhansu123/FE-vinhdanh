/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './api/supabase';
import { fetchAllRows } from './api/fetchAllRows';
import {
  defaultUpcareMktDateRange,
  fetchUpcareMktEmployees,
  isUpcareLeaderboardEnabled,
  mapUpcareMktRowsToLeaderboardEmployees,
} from './api/upcareCrm';
import { LoginPage } from './pages/LoginPage';
import { DashboardAdminLayout } from './pages/DashboardAdminLayout';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { MetaAdsLeaderboardPage } from './pages/MetaAdsLeaderboardPage';
import type { Employee, AuthUser, UserRole } from './types';
import { crmAdminPathForView } from './utils/crmAdminRoutes';
import { crmNavTierFromUser, defaultViewForTier } from './utils/crmNavAccess';

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const USER_ROLES: UserRole[] = ['admin', 'director', 'project_manager', 'manager', 'leader', 'mkt', 'user'];

function roleFromSession(session: Session): UserRole {
  const role = session.user.app_metadata?.role;
  return USER_ROLES.includes(role as UserRole) ? role as UserRole : 'user';
}

async function employeeProfileForSession(session: Session): Promise<AuthUser> {
  const email = session.user.email?.trim().toLowerCase();
  if (!email) throw new Error('Tài khoản Supabase Auth chưa có email.');

  const fallbackProfile = (): AuthUser => ({
    id: session.user.id,
    email,
    role: roleFromSession(session),
    name: String(session.user.user_metadata?.name || session.user.user_metadata?.full_name || email),
    team: '',
    avatar_url: null,
    employeeProfileAvailable: false,
  });

  const { data, error } = await supabase
    .from(EMPLOYEES_TABLE)
    .select('id, name, email, team, avatar_url, vi_tri, ma_ns')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') return fallbackProfile();
    logSupabaseError('loading signed-in employee', error);
    throw new Error('Không tải được hồ sơ nhân viên từ Supabase.');
  }
  if (!data?.email) return fallbackProfile();

  return {
    id: String(data.id || session.user.id),
    email: String(data.email),
    role: roleFromSession(session),
    name: String(data.name || ''),
    team: String(data.team || ''),
    avatar_url: data.avatar_url || null,
    employeeProfileAvailable: true,
    vi_tri: data.vi_tri?.trim() ? data.vi_tri.trim() : null,
    ma_ns: data.ma_ns?.trim() ? data.ma_ns.trim() : null,
  };
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
      `Supabase table \"${EMPLOYEES_TABLE}\" was not found in the exposed REST schema. Create the table in schema public or set VITE_SUPABASE_EMPLOYEES_TABLE correctly.`
    );
  }
}

function AppRoutes() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  /** BXH trang chủ: Fabico MKT API nếu bật, không thì cùng nguồn Supabase employees */
  const [boardEmployees, setBoardEmployees] = useState<Employee[]>([]);
  const [boardSource, setBoardSource] = useState<'upcare' | 'supabase'>('supabase');
  const [loading, setLoading] = useState(true);
  const [showMenuBar, setShowMenuBar] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authProfileLoading, setAuthProfileLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
      setAuthChecking(false);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.warn('Supabase Auth session:', error.message);
      setAuthSession(data.session);
      setAuthChecking(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!authSession) {
      setAuthUser(null);
      setAuthProfileLoading(false);
      return;
    }
    setAuthProfileLoading(true);
    void employeeProfileForSession(authSession)
      .then((profile) => { if (active) setAuthUser(profile); })
      .catch((error: unknown) => {
        if (active) {
          setAuthUser(null);
          console.warn('[Auth] Employee profile is unavailable:', error instanceof Error ? error.message : 'unknown error');
        }
      })
      .finally(() => { if (active) setAuthProfileLoading(false); });
    return () => { active = false; };
  }, [authSession?.user.id]);

  useEffect(() => {
    if (!authUser || !authUser.employeeProfileAvailable) {
      setEmployees([]);
      setBoardEmployees([]);
      setLoading(false);
      return;
    }
    fetchEmployees();
  }, [authUser]);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await fetchAllRows<Employee>(supabase
      .from(EMPLOYEES_TABLE)
      .select('id, name, team, score, avatar_url, email, ma_ns, ngay_bat_dau, leader, du_an_ten, vi_tri, so_fanpage, trang_thai')
      .order('score', { ascending: false }));

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
        // Không dùng avatar từ API Fabico
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
        console.warn('[BXH] Fabico employee/mkt:', e);
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
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error || !data.session) throw new Error('Sai email/mật khẩu hoặc tài khoản Supabase Auth chưa được tạo.');

    try {
      const profile = await employeeProfileForSession(data.session);
      setAuthSession(data.session);
      setAuthUser(profile);
    } catch (profileError) {
      await supabase.auth.signOut();
      throw profileError;
    }
    navigate(profile.employeeProfileAvailable ? '/' : '/meta', { replace: true });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthSession(null);
    setAuthUser(null);
    navigate('/login', { replace: true });
  };

  if (authChecking || authProfileLoading) {
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
          authUser?.employeeProfileAvailable ? (
            <LeaderboardPage
              employees={boardEmployees}
              boardSource={boardSource}
              loading={loading}
              showMenuBar={showMenuBar}
              setShowMenuBar={setShowMenuBar}
              onLogout={handleLogout}
            />
          ) : authUser ? <Navigate to="/meta" replace /> : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/meta"
        element={authUser ? <MetaAdsLeaderboardPage onLogout={handleLogout} hasEmployeeProfile={Boolean(authUser.employeeProfileAvailable)} /> : <Navigate to="/login" replace />}
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
          authUser?.employeeProfileAvailable ? (
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
          ) : authUser ? <Navigate to="/meta" replace /> : <Navigate to="/login" replace />
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
