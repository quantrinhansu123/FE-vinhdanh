/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from './api/supabase';
import { LoginPage } from './pages/LoginPage';
import { DashboardAdminLayout } from './pages/DashboardAdminLayout';
import { LeaderboardPage } from './pages/LeaderboardPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import type { Employee, AuthUser } from './types';

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

    if (error) {
      logSupabaseError('fetching employees', error);
    } else {
      const rankedData = (data || []).map((emp, index) => ({
        ...emp,
        rank: index + 1,
      }));
      setEmployees(rankedData);
    }
    setLoading(false);
  };

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
    navigate('/', { replace: true });
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthUser(null);
    navigate('/login', { replace: true });
  };

  if (authChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black text-white">
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
              employees={employees}
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
        element={<DashboardPage />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
