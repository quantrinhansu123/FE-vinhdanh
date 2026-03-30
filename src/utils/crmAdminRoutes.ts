import type { Role, ViewId } from '../components/crm-dashboard/types';

export const CRM_ADMIN_BASE = '/crm-admin';

const ADMIN_VIEWS = new Set<ViewId>([
  'admin-dash',
  'burn-detect',
  'alerts',
  'projects',
  'teams',
  'staff',
  'ad-accounts',
  'agencies',
  'budget',
  'reconcile',
  'admin-ranking',
  'compare',
]);

const LEADER_VIEWS = new Set<ViewId>([
  'leader-dash',
  'leader-rank',
  'heatmap',
  'leader-mkt',
  'leader-budget',
  'kpi-target',
]);

const MKT_VIEWS = new Set<ViewId>([
  'mkt-dash',
  'mkt-report',
  'mkt-bill',
  'mkt-history',
  'mkt-accounts',
]);

const ALL_VIEWS = new Set<ViewId>([...ADMIN_VIEWS, ...LEADER_VIEWS, ...MKT_VIEWS]);

/** Old 2-segment paths from links / redirects → role + view */
const LEGACY_TWO_SEGMENT: Record<string, { role: Role; view: ViewId }> = {
  'dashboard/overview': { role: 'admin', view: 'admin-dash' },
  'team/members': { role: 'admin', view: 'teams' },
  'team/progress': { role: 'leader', view: 'leader-dash' },
  'reports/daily': { role: 'mkt', view: 'mkt-report' },
  'marketing/channels': { role: 'leader', view: 'leader-mkt' },
};

export function viewToRole(view: ViewId): Role {
  if (LEADER_VIEWS.has(view)) return 'leader';
  if (MKT_VIEWS.has(view)) return 'mkt';
  return 'admin';
}

export function parseCrmAdminPath(pathname: string):
  | { ok: true; role: Role; view: ViewId; legacyTwoSegment?: boolean }
  | { ok: false; redirect: ViewId } {
  const normalized = pathname.replace(/\/+$/, '');
  if (!normalized.startsWith(CRM_ADMIN_BASE)) {
    return { ok: false, redirect: 'admin-dash' };
  }

  let rest = normalized.slice(CRM_ADMIN_BASE.length).replace(/^\//, '');
  if (!rest) {
    return { ok: false, redirect: 'admin-dash' };
  }

  const segments = rest.split('/').filter(Boolean);

  if (segments.length === 1) {
    const v = segments[0] as ViewId;
    if (!ALL_VIEWS.has(v)) {
      return { ok: false, redirect: 'admin-dash' };
    }
    return { ok: true, role: viewToRole(v), view: v };
  }

  if (segments.length === 2) {
    const key = `${segments[0]}/${segments[1]}`;
    const mapped = LEGACY_TWO_SEGMENT[key];
    if (mapped) {
      return { ok: true, role: mapped.role, view: mapped.view, legacyTwoSegment: true };
    }
  }

  return { ok: false, redirect: 'admin-dash' };
}

export function crmAdminPathForView(view: ViewId): string {
  return `${CRM_ADMIN_BASE}/${view}`;
}

export function defaultViewForRole(role: Role): ViewId {
  if (role === 'leader') return 'leader-dash';
  if (role === 'mkt') return 'mkt-dash';
  return 'admin-dash';
}
