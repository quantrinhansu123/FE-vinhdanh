export type PeriodKey = 'today' | 'week' | 'month';
export type SaleStatus = 'achieved' | 'watch';

export interface AvatarCrop {
  x: number;
  y: number;
  size: number;
}

export interface SaleRow {
  id: string;
  name: string;
  bu: string;
  leads: number;
  orders: number;
  revenue: number;
  conversion: number;
  kpi: number;
  growth: number;
  returnRate: number;
  avatar: string;
  trend: number[];
  status: SaleStatus;
  avatarCrop?: AvatarCrop | null;
}

export interface DashboardData {
  sales: SaleRow[];
  summary: {
    revenue: number;
    received: number;
    conversion: number;
    leads: number;
    returnRate: number;
    kpi: number;
  };
  buRanking: { name: string; revenue: number; kpi: number }[];
  target: { amount: number; achieved: number; neededLeads: number; neededOrders: number };
  updatedAt?: string;
}

export const ASSET_BASE = '/pages/fabico-sale-arena';

export const FABICO_CONFIG = {
  apiUrl: '',
  credentials: 'same-origin' as RequestCredentials,
  timeoutMs: 15000,
  companyName: 'FABICO',
  arenaQuote: 'MỖI CUỘC GỌI\nLÀ MỘT CƠ HỘI\nTẠO NÊN KẾT QUẢ\nPHI THƯỜNG',
};

const RAW_ROWS: Array<[string, string, string, number, number, number, number, number, number]> = [
  ['sokha', 'Sokha', 'FALCON', 302, 91, 11480, 143.5, 38, 1.8],
  ['dara', 'Dara', 'LION', 286, 79, 10230, 127.9, 42, 2.1],
  ['sreyneang', 'Sreyneang', 'PHOENIX', 324, 82, 9650, 120.6, 31, 1.9],
  ['vanny', 'Vanny', 'TITAN', 298, 77, 9080, 113.5, 35, 2.4],
  ['sovann', 'Sovann', 'WOLF', 300, 71, 8860, 110.8, 28, 6.8],
  ['pisey', 'Pisey', 'FALCON', 282, 68, 8290, 103.6, 45, 2.2],
  ['makara', 'Makara', 'LION', 296, 61, 7810, 97.6, 178, 2.3],
  ['rithy', 'Rithy', 'TITAN', 305, 60, 7490, 93.6, 124, 2.0],
  ['bopha', 'Bopha', 'PHOENIX', 340, 64, 7160, 89.5, 32, 2.5],
  ['chenda', 'Chenda', 'WOLF', 289, 54, 6830, 85.4, 27, 0.8],
  ['nita', 'Nita', 'FALCON', 250, 52, 6210, 77.6, 152, 2.1],
  ['sambath', 'Sambath', 'WOLF', 273, 49, 6080, 76, 24, 1.1],
  ['kanha', 'Kanha', 'LION', 252, 47, 5800, 72.5, 23, 1.6],
];

const CROPS: Record<string, AvatarCrop> = {
  sokha: { x: 420, y: 45, size: 84 },
  dara: { x: 163, y: 65, size: 76 },
  sreyneang: { x: 691, y: 70, size: 74 },
};

function demoBase(): DashboardData {
  const sales: SaleRow[] = RAW_ROWS.map((r, i) => ({
    id: r[0],
    name: r[1],
    bu: r[2],
    leads: r[3],
    orders: r[4],
    revenue: r[5],
    conversion: Math.round((r[4] / r[3]) * 1000) / 10,
    kpi: r[6],
    growth: r[7],
    returnRate: r[8],
    avatar: `${ASSET_BASE}/avatar-${i % 4}.svg`,
    trend: [8, 12, 10, 22, 18, 23, 31, 28, 40, 47].map((v, j) => v + ((i * 7 + j * 3) % 11)),
    status: r[8] > 5 ? 'watch' : 'achieved',
  }));
  for (const sale of sales) {
    const crop = CROPS[sale.id];
    if (crop) {
      sale.avatar = `${ASSET_BASE}/top3-reference.png`;
      sale.avatarCrop = crop;
    }
  }
  return {
    sales,
    summary: { revenue: 109480, received: 97227, conversion: 21.7, leads: 887, returnRate: 6.3, kpi: 103.6 },
    buRanking: [
      { name: 'FALCON', revenue: 32810, kpi: 108 },
      { name: 'PHOENIX', revenue: 24650, kpi: 105 },
      { name: 'LION', revenue: 18920, kpi: 98 },
      { name: 'TITAN', revenue: 16480, kpi: 94 },
      { name: 'WOLF', revenue: 15320, kpi: 86 },
    ],
    target: { amount: 112000, achieved: 99456, neededLeads: 282, neededOrders: 3 },
    updatedAt: '2024-01-17T14:28:36+07:00',
  };
}

function finite(record: object, keys: string[]) {
  return keys.every((key) => Number.isFinite((record as Record<string, number>)[key]));
}

export function validateDashboard(data: DashboardData) {
  if (!data || !Array.isArray(data.sales) || !Array.isArray(data.buRanking) || !data.summary || !data.target) {
    throw new Error('Dữ liệu API thiếu sales, buRanking, summary hoặc target.');
  }
  if (
    !finite(data.summary, ['revenue', 'received', 'conversion', 'leads', 'returnRate', 'kpi']) ||
    !finite(data.target, ['amount', 'achieved', 'neededLeads', 'neededOrders'])
  ) {
    throw new Error('Các chỉ số tổng quan phải là số.');
  }
  const ids = new Set<string>();
  for (const sale of data.sales) {
    if (
      typeof sale.id !== 'string' ||
      ids.has(sale.id) ||
      typeof sale.name !== 'string' ||
      typeof sale.bu !== 'string' ||
      !finite(sale, ['revenue', 'leads', 'orders', 'conversion', 'kpi', 'growth', 'returnRate']) ||
      !Array.isArray(sale.trend) ||
      !sale.trend.every((value) => Number.isFinite(value))
    ) {
      throw new Error('Bản ghi nhân viên không đúng hợp đồng dữ liệu.');
    }
    ids.add(sale.id);
  }
  if (!data.buRanking.every((bu) => typeof bu.name === 'string' && finite(bu, ['revenue', 'kpi']))) {
    throw new Error('Dữ liệu BU không hợp lệ.');
  }
}

function demoData({ period = 'today', bu = 'all' }: { period?: PeriodKey; bu?: string } = {}): DashboardData {
  const data = structuredClone(demoBase());
  const factor = period === 'week' ? 6.4 : period === 'month' ? 23.2 : 1;
  data.sales = data.sales
    .filter((sale) => bu === 'all' || sale.bu === bu)
    .map((sale) => ({
      ...sale,
      revenue: Math.round(sale.revenue * factor),
      leads: Math.round(sale.leads * factor),
      orders: Math.round(sale.orders * factor),
      trend: sale.trend.map((value) => value * factor),
    }));
  data.buRanking = data.buRanking
    .filter((item) => bu === 'all' || item.name === bu)
    .map((item) => ({ ...item, revenue: Math.round(item.revenue * factor) }));
  if (bu === 'all') {
    data.summary.revenue = Math.round(data.summary.revenue * factor);
    data.summary.received = Math.round(data.summary.received * factor);
    data.summary.leads = Math.round(data.summary.leads * factor);
  } else {
    const sum = (key: 'revenue' | 'leads' | 'orders' | 'kpi' | 'returnRate') =>
      data.sales.reduce((total, sale) => total + sale[key], 0);
    const leads = sum('leads');
    data.summary = {
      revenue: sum('revenue'),
      received: Math.round(sum('revenue') * 0.89),
      leads,
      conversion: leads ? (sum('orders') / leads) * 100 : 0,
      kpi: sum('kpi') / (data.sales.length || 1),
      returnRate: sum('returnRate') / (data.sales.length || 1),
    };
  }
  data.target.amount = Math.round(data.target.amount * factor * (bu === 'all' ? 1 : 0.2));
  data.target.achieved = bu === 'all' ? Math.round(data.target.achieved * factor) : data.summary.revenue;
  return data;
}

export function createDemoDashboard({ period = 'today', bu = 'all' }: { period?: PeriodKey; bu?: string } = {}) {
  return demoData({ period, bu });
}

export async function loadDashboard({ period = 'today', bu = 'all' }: { period?: PeriodKey; bu?: string } = {}) {
  if (!FABICO_CONFIG.apiUrl) return demoData({ period, bu });
  const url = new URL(FABICO_CONFIG.apiUrl, window.location.href);
  url.searchParams.set('period', period);
  url.searchParams.set('bu', bu);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FABICO_CONFIG.timeoutMs || 15000);
  try {
    const response = await fetch(url, {
      credentials: FABICO_CONFIG.credentials || 'same-origin',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
    const data = (await response.json()) as DashboardData;
    validateDashboard(data);
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}

export function sortSales(sales: SaleRow[]) {
  return [...sales].sort((a, b) => b.revenue - a.revenue || a.id.localeCompare(b.id));
}

export const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export const number = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

export const pct = (value: number) => `${Number(value).toFixed(1)}%`;

export const clamp = (value: number) => Math.min(100, Math.max(0, value));

export const KPI_SPARK = [5, 12, 22, 14, 12, 18, 16, 21, 17, 14, 19, 24, 20, 27, 23, 32, 45];

export const BU_COLORS = ['#ffd55e', '#ae72fa', '#13bafb', '#20cbe8', '#fa6baa'];
