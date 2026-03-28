export type NavChild = { id: string; label: string };
export type NavItem = {
  id: string;
  icon: string;
  label: string;
  children?: NavChild[];
};

/** Menu 2 cấp: mục cha + thanh con (sub) */
export const NAV: NavItem[] = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', children: [{ id: 'overview', label: 'Tổng quan' }, { id: 'alerts', label: 'Cảnh báo' }] },
  { id: 'projects', icon: 'folder_copy', label: 'Dự án', children: [{ id: 'list', label: 'Danh sách dự án' }, { id: 'allocation', label: 'Phân bổ ngân sách' }] },
  {
    id: 'team',
    icon: 'group',
    label: 'Team',
    children: [
      { id: 'members', label: 'Thành viên' },
      { id: 'progress', label: 'Tiến bộ' },
    ],
  },
  {
    id: 'ads',
    icon: 'ads_click',
    label: 'Tài khoản Ads',
    children: [
      { id: 'overview', label: 'Tổng quan & biểu đồ' },
      { id: 'accounts', label: 'Danh sách TKQC' },
    ],
  },
  { id: 'budget', icon: 'payments', label: 'Ngân sách', children: [{ id: 'summary', label: 'Tổng quan ngân sách' }] },
  {
    id: 'reports',
    icon: 'analytics',
    label: 'Báo cáo',
    children: [
      { id: 'daily', label: 'Báo cáo hàng ngày' },
      { id: 'summary', label: 'Tổng hợp' },
    ],
  },
  { id: 'reconcile', icon: 'account_balance_wallet', label: 'Đối chiếu', children: [{ id: 'table', label: 'Bảng đối chiếu' }, { id: 'history', label: 'Lịch sử chỉnh sửa' }] },
];

export const CRM_ADMIN_BASE = '/crm-admin';

/** `/crm-admin/team/members` → `team:members` */
export function pathToNavKey(pathname: string): string {
  const rest = pathname.replace(new RegExp(`^${CRM_ADMIN_BASE}/?`), '').split('/').filter(Boolean);
  if (rest.length === 0) return 'dashboard:overview';
  if (rest[0] === 'marketing') {
    if (rest.length === 1) return 'marketing';
    if (rest.length === 2 && (rest[1] === 'channels' || rest[1] === 'campaigns')) return `marketing:${rest[1]}`;
    return 'dashboard:overview';
  }
  if (rest.length === 1) {
    const parent = NAV.find((n) => n.id === rest[0]);
    if (!parent) return 'dashboard:overview';
    return rest[0];
  }
  const parent = NAV.find((n) => n.id === rest[0]);
  const child = parent?.children?.find((c) => c.id === rest[1]);
  if (!parent || !child) return 'dashboard:overview';
  return `${rest[0]}:${rest[1]}`;
}

export function isValidCrmAdminPath(pathname: string): boolean {
  if (!pathname.startsWith(CRM_ADMIN_BASE)) return false;
  const rest = pathname.replace(new RegExp(`^${CRM_ADMIN_BASE}/?`), '').split('/').filter(Boolean);
  if (rest.length === 0) return true;
  if (rest[0] === 'marketing') {
    if (rest.length === 1) return true;
    if (rest.length === 2) return rest[1] === 'channels' || rest[1] === 'campaigns';
    return false;
  }
  if (rest.length === 1) return NAV.some((n) => n.id === rest[0]);
  if (rest.length === 2) {
    const p = NAV.find((n) => n.id === rest[0]);
    return Boolean(p?.children?.some((c) => c.id === rest[1]));
  }
  return false;
}

/** `team:members` → `/crm-admin/team/members` */
export function navKeyToPath(navKey: string): string {
  if (!navKey.includes(':')) {
    return `${CRM_ADMIN_BASE}/${navKey}`;
  }
  const [parent, child] = navKey.split(':');
  return `${CRM_ADMIN_BASE}/${parent}/${child}`;
}

export function getNavPlaceholderText(activeNav: string): string | null {
  const parts = activeNav.split(':');
  const parent = NAV.find((n) => n.id === parts[0]);
  if (!parent) return null;
  if (parent.id === 'dashboard' || parent.id === 'reconcile') return null;
  if (activeNav === 'ads:overview') return null;
  if (activeNav === 'ads:accounts') return null;
  if (activeNav === 'budget:summary') return null;
  if (activeNav === 'projects:list') return null;
  if (activeNav === 'projects:allocation') return null;
  if (activeNav === 'marketing:channels') return null;
  if (activeNav === 'marketing:campaigns') return null;
  if (activeNav === 'team:progress') return null;
  if (activeNav === 'reports:daily') return null;
  if (parts.length === 1) {
    return parent.children?.length ? `${parent.label} — chọn mục con bên dưới` : null;
  }
  const child = parent.children?.find((c) => c.id === parts[1]);
  return child ? `${parent.label} → ${child.label}` : null;
}
