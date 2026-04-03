/** Chung cho MKT report / history — bảng detail_reports */

export const REPORTS_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

export function toLocalYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Ngày hôm qua theo lịch local (yyyy-mm-dd) */
export function localYesterdayYyyyMmDd(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return toLocalYyyyMmDd(d);
}

/** dd/mm/yyyy từ chuỗi yyyy-mm-dd */
export function formatReportDateVi(isoDate: string): string {
  const s = isoDate?.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return isoDate || '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function parseIntVi(raw: string): number {
  const t = raw.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '');
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Nhóm hàng nghìn bằng dấu chấm (VN), ví dụ 12400000 → 12.400.000 */
export function formatNumberDots(n: number | null | undefined, emptyWhenZero = true): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = Math.round(Number(n));
  if (emptyWhenZero && v === 0) return '';
  if (v === 0) return '0';
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatIntVi(n: number | null | undefined): string {
  return formatNumberDots(n, true);
}

/** Khi đang gõ: chỉ giữ số, hiển thị có dấu chấm ngăn cách hàng nghìn */
export function formatTypingGroupedInt(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n === 0) return '0';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatKpiMoney(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, '')}M`;
  }
  return `${Math.round(n / 1_000)}k`;
}

/** Gọn cho bảng doanh số / ads */
export function formatCompactVnd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) === 0) return '—';
  const x = Number(n);
  const abs = Math.abs(x);
  if (abs >= 1_000_000_000) {
    const v = x / 1_000_000_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    const v = x / 1_000_000;
    return `${v >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(2).replace(/\.?0+$/, '')}M`;
  }
  if (abs >= 1_000) return `${Math.round(x / 1_000)}k`;
  return `${Math.round(x)}`;
}
