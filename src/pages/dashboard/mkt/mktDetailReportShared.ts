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

/**
 * Từ Page / tên quảng cáo dạng "[HaiLe] [X9000] - 28/03 - Pur - …" → "HaiLe" (nội dung trong [...] đầu tiên).
 */
export function extractMaNvFromBracketPage(text: string | null | undefined): string | null {
  const t = (text || '').trim();
  if (!t) return null;
  const m = t.match(/\[([^\]]+)\]/);
  if (!m) return null;
  const inner = m[1].trim();
  return inner || null;
}

/** Nhân viên khớp khi so sánh nội dung […] với employees.ma_ns (không phân biệt hoa thường). */
export type MaNsLookupMatch = { id: string; name: string; ma_ns: string };

export function buildMaNsLookup(
  rows: { id: string; name?: string; ma_ns?: string | null }[]
): Map<string, MaNsLookupMatch> {
  const m = new Map<string, MaNsLookupMatch>();
  for (const r of rows) {
    const raw = r.ma_ns?.trim();
    if (!raw) continue;
    m.set(raw.toLowerCase(), { id: r.id, name: (r.name || '').trim() || '—', ma_ns: raw });
  }
  return m;
}

/** Khớp chuỗi trong ngoặc (vd. từ Page) với map ma_ns. */
export function matchEmployeeByBracketTag(
  tag: string | null | undefined,
  lookup: Map<string, MaNsLookupMatch>
): MaNsLookupMatch | null {
  const t = tag?.trim();
  if (!t) return null;
  return lookup.get(t.toLowerCase()) ?? null;
}

/** Chuẩn hoá tên để khớp lỏng (API Upcare vs employees). */
export function normalizePersonNameKey(raw: string | null | undefined): string {
  const s = (raw || '').trim().toLowerCase().normalize('NFKC').replace(/\s+/g, ' ');
  return s;
}

/**
 * Map amount theo id Upcare (số) và theo tên (đã chuẩn hoá).
 * Dùng cho đồng bộ doanh số từ /api/employee/mkt.
 */
export function buildUpcareAmountLookup(
  rows: { id: number; name: string; amount: number | string }[]
): { byId: Map<number, number>; byNameNorm: Map<string, number> } {
  const byId = new Map<number, number>();
  const byNameNorm = new Map<string, number>();
  for (const r of rows) {
    const amt = Number(r.amount);
    if (!Number.isFinite(amt)) continue;
    byId.set(r.id, amt);
    const k = normalizePersonNameKey(r.name);
    if (k) byNameNorm.set(k, amt);
  }
  return { byId, byNameNorm };
}

/**
 * Gán amount từ lookup Upcare cho một dòng báo cáo:
 * 1) [số] trong Page → id nhân viên Upcare
 * 2) [mã_ns] khớp bảng employees → khớp tên với Upcare
 * 3) [text] là tên (hoặc tag) → khớp tên Upcare đã chuẩn hoá
 */
export function resolveUpcareAmountForReportRow(
  row: { page?: string | null },
  lookup: { byId: Map<number, number>; byNameNorm: Map<string, number> },
  maNsLookup: Map<string, MaNsLookupMatch>
): number | null {
  const tag = extractMaNvFromBracketPage(row.page);
  if (!tag) return null;
  const t = tag.trim();
  if (/^\d+$/.test(t)) {
    const id = Number(t);
    if (lookup.byId.has(id)) return lookup.byId.get(id)!;
  }
  const ma = matchEmployeeByBracketTag(t, maNsLookup);
  if (ma) {
    const nk = normalizePersonNameKey(ma.name);
    if (lookup.byNameNorm.has(nk)) return lookup.byNameNorm.get(nk)!;
  }
  const nkTag = normalizePersonNameKey(t);
  if (nkTag && lookup.byNameNorm.has(nkTag)) return lookup.byNameNorm.get(nkTag)!;
  return null;
}
