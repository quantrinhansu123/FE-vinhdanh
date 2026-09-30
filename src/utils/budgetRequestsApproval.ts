/**
 * Fallback khi DB chưa chạy migration supabase/alter_budget_requests_approval_flow.sql.
 * Supabase/PostgREST trả lỗi dạng:
 *  - "column budget_requests.giam_doc_da_duyet does not exist"
 *  - "Could not find the 'anh_giai_ngan_urls' column..."
 */

const APPROVAL_COLUMNS = [
  'giam_doc_da_duyet',
  'giam_doc_duyet_boi',
  'giam_doc_duyet_at',
  'ke_toan_da_duyet',
  'ke_toan_duyet_boi',
  'ke_toan_duyet_at',
  'da_giai_ngan',
  'giai_ngan_boi',
  'giai_ngan_at',
  'anh_giai_ngan_urls',
];

export function isMissingBudgetApprovalColumn(err: unknown): boolean {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message || '')
      : String(err || '');
  const m = msg.toLowerCase();
  const mentionsColumn =
    m.includes('does not exist') || m.includes('could not find') || m.includes('column');
  if (!mentionsColumn) return false;
  return APPROVAL_COLUMNS.some((c) => m.includes(c));
}

/** Bỏ các cột duyệt nhiều bước khỏi chuỗi select để query lại khi DB chưa migrate. */
export function stripBudgetApprovalColumns(select: string): string {
  const drop = new Set(APPROVAL_COLUMNS);
  return select
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !drop.has(s))
    .join(', ');
}
