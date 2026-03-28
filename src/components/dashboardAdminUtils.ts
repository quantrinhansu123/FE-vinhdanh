/** Helpers for DashboardAdmin — aggregations from detail_reports */

export type ReportRow = {
  report_date: string;
  name?: string | null;
  email?: string | null;
  team?: string | null;
  product?: string | null;
  market?: string | null;
  ad_account?: string | null;
  ad_cost?: number | null;
  mess_comment_count?: number | null;
  order_count?: number | null;
  revenue?: number | null;
};

const BUDGET_FACTOR = 1.15;
export const ADS_THRESHOLD_OK = 39;
export const ADS_THRESHOLD_WARN = 45;

export function sumReports(rows: ReportRow[]) {
  let revenue = 0;
  let adCost = 0;
  for (const r of rows) {
    revenue += Number(r.revenue) || 0;
    adCost += Number(r.ad_cost) || 0;
  }
  return { revenue, adCost };
}

/** Kỳ liền trước cùng độ dài (để so sánh %). */
export function previousDateRange(from: string, to: string): { from: string; to: string } {
  const start = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  const len = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - len);
  return {
    from: prevStart.toISOString().slice(0, 10),
    to: prevEnd.toISOString().slice(0, 10),
  };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/** Ngân sách ước tính từ doanh số (không có cột budget trong DB). */
export function plannedBudgetFromRevenue(totalRevenue: number) {
  return totalRevenue * BUDGET_FACTOR;
}

export type ChartGranularity = 'day' | 'week' | 'month' | 'year';

export function aggregateRevenueByPeriod(
  rows: ReportRow[],
  from: string,
  to: string,
  granularity: ChartGranularity
): { label: string; revenue: number; sortKey: string }[] {
  const map = new Map<string, { revenue: number; sortKey: string; label: string }>();

  const inRange = (d: string) => d >= from && d <= to;

  for (const r of rows) {
    const d = r.report_date?.slice(0, 10);
    if (!d || !inRange(d)) continue;
    const rev = Number(r.revenue) || 0;
    let key: string;
    let sortKey: string;
    let label: string;

    if (granularity === 'day') {
      key = d;
      sortKey = d;
      label = formatDayLabel(d);
    } else if (granularity === 'week') {
      const startMs = new Date(from + 'T12:00:00').getTime();
      const tMs = new Date(d + 'T12:00:00').getTime();
      const idx = Math.max(0, Math.floor((tMs - startMs) / (7 * 86400000)));
      key = `wk${idx}`;
      sortKey = String(idx).padStart(6, '0');
      label = `Giai đoạn ${idx + 1}`;
    } else if (granularity === 'month') {
      key = d.slice(0, 7);
      sortKey = key + '-01';
      label = formatMonthLabel(key);
    } else {
      key = d.slice(0, 4);
      sortKey = key + '-01-01';
      label = key;
    }

    const cur = map.get(key) || { revenue: 0, sortKey, label };
    cur.revenue += rev;
    map.set(key, cur);
  }

  return Array.from(map.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((x) => ({ label: x.label, revenue: x.revenue, sortKey: x.sortKey }));
}

function formatDayLabel(iso: string) {
  const [y, m, day] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, day);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return `${days[dt.getDay()]} ${day}/${m}`;
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `T${m}/${y}`;
}

export type ChannelAgg = {
  key: string;
  label: string;
  revenue: number;
  adCost: number;
  adsPct: number;
};

/** Gom theo thị trường (market) hoặc sản phẩm (product). */
export function aggregateByChannel(rows: ReportRow[]): ChannelAgg[] {
  const map = new Map<string, { revenue: number; adCost: number; label: string }>();

  for (const r of rows) {
    const market = String(r.market || '').trim();
    const product = String(r.product || '').trim();
    const label = market || product || 'Khác';
    const key = label.toLowerCase();

    const cur = map.get(key) || { revenue: 0, adCost: 0, label };
    cur.revenue += Number(r.revenue) || 0;
    cur.adCost += Number(r.ad_cost) || 0;
    cur.label = label;
    map.set(key, cur);
  }

  return Array.from(map.entries()).map(([key, v]) => ({
    key,
    label: v.label,
    revenue: v.revenue,
    adCost: v.adCost,
    adsPct: v.revenue > 0 ? (v.adCost / v.revenue) * 100 : v.adCost > 0 ? 100 : 0,
  }));
}

export type ProjectRow = {
  project: string;
  agency: string;
  budget: number;
  spend: number;
  diffPct: number;
  adsPct: number;
};

export function aggregateByProject(rows: ReportRow[]): ProjectRow[] {
  const map = new Map<string, { revenue: number; adCost: number; team: string }>();

  for (const r of rows) {
    const product = String(r.product || '').trim() || '(Chưa gán dự án)';
    const team = String(r.team || '').trim() || '—';
    const key = `${product}|||${team}`;

    const cur = map.get(key) || { revenue: 0, adCost: 0, team };
    cur.revenue += Number(r.revenue) || 0;
    cur.adCost += Number(r.ad_cost) || 0;
    cur.team = team;
    map.set(key, cur);
  }

  return Array.from(map.entries()).map(([compound, v]) => {
    const [project] = compound.split('|||');
    const budget = plannedBudgetFromRevenue(v.revenue);
    const spend = v.adCost;
    const diffPct = budget > 0 ? ((spend - budget) / budget) * 100 : 0;
    const adsPct = v.revenue > 0 ? (spend / v.revenue) * 100 : spend > 0 ? 100 : 0;
    return {
      project,
      agency: v.team,
      budget,
      spend,
      diffPct,
      adsPct,
    };
  });
}

export function formatCompactM(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + 'B';
  if (abs >= 1e6) return (v / 1e6).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
  if (abs >= 1e3) return (v / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'K';
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

/** VND làm tròn số nguyên, phân cách hàng nghìn kiểu Việt Nam (dấu chấm). */
export function formatVnd(v: number): string {
  return Math.round(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

export function formatSignedPct(p: number | null): string {
  if (p === null || Number.isNaN(p)) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

/** SVG path cho area chart (điểm doanh số). */
export function buildSmoothChartPath(values: number[], width = 700, height = 200) {
  const padY = 24;
  const h = height - padY * 2;
  const n = values.length;
  if (n === 0) {
    return { areaD: '', lineD: '', circles: [] as { cx: number; cy: number }[] };
  }
  const maxY = Math.max(...values, 1);
  const coords = values.map((v, i) => ({
    x: n === 1 ? width / 2 : (i / Math.max(n - 1, 1)) * width,
    y: padY + h - (v / maxY) * h,
  }));

  let lineD = `M ${coords[0].x},${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const p0 = coords[i - 1];
    const p1 = coords[i];
    const cx = (p0.x + p1.x) / 2;
    lineD += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
  }

  const last = coords[coords.length - 1];
  const first = coords[0];
  const areaD = `${lineD} L ${last.x},${height} L ${first.x},${height} Z`;

  const step = Math.max(1, Math.floor(n / 5));
  const circles = coords
    .filter((_, i) => i % step === 0 || i === n - 1)
    .slice(-4)
    .map((c) => ({ cx: c.x, cy: c.y }));

  return { areaD, lineD, circles, coords };
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (c: string | number) => {
    const s = String(c);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
