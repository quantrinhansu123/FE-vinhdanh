/**
 * Detect a missing tien_viet column when a database has not applied its migration.
 */
export function isMissingTienVietError(err: unknown): boolean {
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message || '')
      : String(err || '');
  const normalized = message.toLowerCase();
  return normalized.includes('tien_viet') && (
    normalized.includes('does not exist') ||
    normalized.includes('could not find') ||
    normalized.includes('column')
  );
}

/** Remove tien_viet from a select list for schemas that have not applied its migration. */
export function stripTienVietFromSelect(select: string): string {
  return select
    .split(',')
    .map((column) => column.trim())
    .filter((column) => column !== 'tien_viet')
    .join(', ');
}

/** Prefer tien_viet; fall back to revenue converted at 25,000 VND per unit. */
export function reportRevenueVndFallback(row: { tien_viet?: unknown; revenue?: unknown }): number {
  const tienViet = row?.tien_viet;
  if (tienViet != null && tienViet !== '') {
    const value = Number(String(tienViet).trim().replace(/[$,]/g, '').replace(/\s+/g, ''));
    if (Number.isFinite(value)) return value;
  }
  const revenue = row?.revenue;
  const value = revenue == null ? 0 : Number(String(revenue).trim().replace(/[$,]/g, '').replace(/\s+/g, ''));
  return Number.isFinite(value) && value !== 0 ? Math.round(value * 25000) : 0;
}
