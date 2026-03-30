export type Role = 'admin' | 'leader' | 'mkt';

export type ViewId = 
  | 'admin-dash' | 'burn-detect' | 'alerts' | 'projects' | 'teams' | 'staff' 
  | 'ad-accounts' | 'agencies' | 'products' | 'markets' | 'budget' | 'reconcile' | 'admin-ranking' | 'compare'
  | 'leader-dash' | 'leader-rank' | 'heatmap' | 'leader-mkt' | 'leader-budget' | 'kpi-target'
  | 'mkt-dash' | 'mkt-report' | 'mkt-bill' | 'mkt-history' | 'mkt-accounts';

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
  badge?: {
    text: string;
    type?: 'r' | 'y' | 'b'; // red, yellow, blue (accent)
  };
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface UserInfo {
  name: string;
  role: string;
  avatar: string;
  avatarBg?: string;
}

export interface KpiData {
  label: string;
  value: string | number;
  sub?: string;
  delta?: string;
  deltaType?: 'up' | 'dn' | 'nt';
  icon?: string;
  barColor?: string;
  animationDelay?: string;
  valueColor?: string;
}
