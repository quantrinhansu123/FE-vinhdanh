import type { Role, ViewId } from '../components/crm-dashboard/types';
import type { UserRole } from '../types';
import { viewToRole } from './crmAdminRoutes';

/** Quyền hiển thị nhóm tab CRM theo vị trí (employees.vi_tri) + super-admin đăng nhập */
export type CrmNavTier = 'admin' | 'leader' | 'mkt';

function norm(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

/** Admin / quản trị — full tab Admin + Leader + MKT */
export function isAdminViTriPosition(viTri: string | null | undefined): boolean {
  const t = norm(viTri);
  if (!t) return false;
  if (t === 'admin') return true;
  if (t.includes('quản trị') || t.includes('quantri')) return true;
  if (t.includes('giám đốc') || t.includes('giam doc') || t.includes('giamdoc')) return true;
  return false;
}

/** Leader / quản lý dự án — tab Leader + MKT (không gồm admin-only) */
export function isLeaderViTriPosition(viTri: string | null | undefined): boolean {
  if (isAdminViTriPosition(viTri)) return false;
  const t = viTri?.trim().toLowerCase();
  if (!t) return false;
  if (t.includes('quản lý dự án') || t.includes('quan ly du an')) return true;
  if (t.includes('leader')) return true;
  if (t.includes('trưởng nhóm') || t.includes('truong nhom')) return true;
  if (t.includes('team lead')) return true;
  return false;
}

/** Marketing — chỉ tab MKT */
export function isMktViTriPosition(viTri: string | null | undefined): boolean {
  const raw = (viTri || '').trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  if (t === 'nhân viên mkt' || t === 'nhan vien mkt') return true;
  const u = raw.toUpperCase();
  if (u === 'MKT' || u === 'MARKETING') return true;
  if (/\bMKT\b/.test(u)) return true;
  return u.startsWith('MKT/') || u.startsWith('MKT-');
}

/**
 * Thứ tự ưu tiên: super-admin đăng nhập → vị trí Admin → Leader → MKT → mặc định MKT (hạn chế nhất).
 */
export function crmNavTierFromUser(user: { role: UserRole; vi_tri?: string | null } | null): CrmNavTier {
  if (user?.role === 'admin') return 'admin';
  const vt = user?.vi_tri;
  if (isAdminViTriPosition(vt)) return 'admin';
  if (isLeaderViTriPosition(vt)) return 'leader';
  if (isMktViTriPosition(vt)) return 'mkt';
  return 'mkt';
}

export function crmAllowedRolesForTier(tier: CrmNavTier): Role[] {
  if (tier === 'admin') return ['admin', 'leader', 'mkt'];
  if (tier === 'leader') return ['leader', 'mkt'];
  return ['mkt'];
}

export function tierAllowsRole(tier: CrmNavTier, role: Role): boolean {
  return crmAllowedRolesForTier(tier).includes(role);
}

export function tierAllowsView(tier: CrmNavTier, view: ViewId): boolean {
  return tierAllowsRole(tier, viewToRole(view));
}

export function defaultViewForTier(tier: CrmNavTier): ViewId {
  if (tier === 'admin') return 'admin-dash';
  if (tier === 'leader') return 'leader-dash';
  return 'mkt-dash';
}
