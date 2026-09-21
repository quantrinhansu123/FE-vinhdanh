import type { AuthUser, UserRole } from '../types';
import type { CrmNavTier } from './crmNavAccess';
import { crmNavTierFromUser } from './crmNavAccess';

/** Chuẩn hóa alias manager -> project_manager */
export function normalizeUserRole(role: UserRole | string | null | undefined): UserRole {
  if (role === 'manager') return 'project_manager';
  if (
    role === 'admin' ||
    role === 'director' ||
    role === 'project_manager' ||
    role === 'leader' ||
    role === 'mkt' ||
    role === 'user'
  )
    return role;
  return 'user';
}

export function tierOf(user: Pick<AuthUser, 'role' | 'vi_tri'> | null): CrmNavTier {
  if (!user) return 'mkt';
  return crmNavTierFromUser({ role: normalizeUserRole(user.role), vi_tri: user.vi_tri });
}

/** Được xem tất cả dự án: admin / giám đốc / quản lý dự án */
export function canViewAllProjects(user: Pick<AuthUser, 'role' | 'vi_tri'> | null): boolean {
  const t = tierOf(user);
  return t === 'admin' || t === 'director' || t === 'project_manager';
}

/** Được xem tất cả team/nhân sự (màn teams/staff): cùng 3 vai trò trên */
export function canViewAllTeams(user: Pick<AuthUser, 'role' | 'vi_tri'> | null): boolean {
  return canViewAllProjects(user);
}

/** Được tạo/sửa/xóa dự án-team-nhân sự-TKQC: admin / giám đốc / QLDA. Leader + NV chỉ xem. */
export function canEditProjects(user: Pick<AuthUser, 'role' | 'vi_tri'> | null): boolean {
  return canViewAllProjects(user);
}

/** Vai trò đặc quyền xem số liệu toàn hệ (leader-dash/mkt coi như admin cũ) */
export function isPrivilegedViewer(user: Pick<AuthUser, 'role' | 'vi_tri'> | null): boolean {
  return canViewAllProjects(user);
}

/** Phạm vi chỉ số: all (GĐ/QLDA/admin) | team (leader) | self (nhân viên) */
export function metricScopeOf(user: Pick<AuthUser, 'role' | 'vi_tri'> | null): 'all' | 'team' | 'self' {
  const t = tierOf(user);
  if (t === 'admin' || t === 'director' || t === 'project_manager') return 'all';
  if (t === 'leader') return 'team';
  return 'self';
}

export function scopeBannerText(user: Pick<AuthUser, 'role' | 'vi_tri' | 'team'> | null): string | null {
  if (!user) return null;
  const t = tierOf(user);
  if (t === 'admin') return 'Toàn bộ hệ thống (Admin)';
  if (t === 'director') return 'Toàn bộ dự án (Giám đốc)';
  if (t === 'project_manager') return 'Toàn bộ dự án được giao (Quản lý dự án)';
  if (t === 'leader') return `Chỉ số team ${user.team?.trim() || 'của bạn'} (Leader)`;
  return `Chỉ số của bạn${user.team?.trim() ? ` · team ${user.team.trim()}` : ''} (Nhân viên)`;
}
