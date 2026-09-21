/**
 * Fallback khi DB chưa chạy migration supabase/alter_detail_reports_tien_viet.sql.
 * Supabase/PostgREST trả lỗi dạng:
 *  - "column detail_reports.tien_viet does not exist"
 *  - "Could not find the 'tien_viet' column..."
 */

export function isMissingTienVietError(err: unknown): boolean {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message || '')
      : String(err || '');
  const m = msg.toLowerCase();
  return m.includes('tien_viet') && (m.includes('does not exist') || m.includes('could not find') || m.includes('column'));
}

/** Bỏ `tien_viet` khỏi chuỗi select để query lại khi cột chưa tồn tại. */
export function stripTienVietFromSelect(select: string): string {
  return select
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== 'tien_viet')
    .join(', ');
}

/** Doanh thu VND: ưu tiên tien_viet, fallback revenue * 25,000 (dùng khi cột chưa có). */
export function reportRevenueVndFallback(row: { tien_viet?: unknown; revenue?: unknown }): number {
  const tv = row?.tien_viet;
  if (tv != null && tv !== '') {
    const n = Number(String(tv).trim().replace(/[\$,]/g, '').replace(/\s+/g, ''));
    if (Number.isFinite(n)) return n;
  }
  const r = row?.revenue;
  const rn = r == null ? 0 : Number(String(r).trim().replace(/[\$,]/g, '').replace(/\s+/g, ''));
  if (!Number.isFinite(rn) || rn === 0) return 0;
  return Math.round(rn * 25000);
}
