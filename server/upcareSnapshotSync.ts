import { createUpcareClient, UpcareAuthError } from './upcareClient';
import { createSupabaseAdminClient } from './supabaseAdmin';
import type { MetaEnvironment } from './metaAdsClient';

const SNAPSHOT_TABLE = 'upcare_mkt_sales_snapshots';

type UpcareMktEmployee = {
  id?: string | number;
  code?: string | number | boolean | null;
  name?: string;
  avatar?: string | null;
  amount?: string | number | null;
  count?: string | number | null;
};

function amount(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function syncUpcareMktSnapshot(
  env: MetaEnvironment,
  dateFrom: string,
  dateTo: string,
  adminClient = createSupabaseAdminClient(env),
  upcare = createUpcareClient(env)
) {
  const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  let response: Response;
  try {
    response = await upcare.request(`/api/employee/mkt?${query.toString()}`);
  } catch (error) {
    if (error instanceof UpcareAuthError) throw error;
    throw new Error('Không kết nối được API nhân viên MKT của Odoo.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Odoo MKT trả HTTP ${response.status}. Kiểm tra quyền API hoặc phiên đăng nhập.`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    await response.body?.cancel();
    throw new Error('API Odoo MKT không trả JSON.');
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Không đọc được JSON từ API Odoo MKT.');
  }
  if (!Array.isArray(payload)) throw new Error('API Odoo MKT không trả về mảng nhân viên.');

  const syncedAt = new Date().toISOString();
  const rows = (payload as UpcareMktEmployee[])
    .filter((row) => row && row.id != null && String(row.id).trim() && Number.isFinite(Number(row.id)))
    .map((row) => ({
      odoo_employee_id: String(row.id).trim(),
      employee_code: typeof row.code === 'string' || typeof row.code === 'number' ? String(row.code) : null,
      employee_name: typeof row.name === 'string' ? row.name : 'Chưa có tên',
      avatar_url: typeof row.avatar === 'string' ? row.avatar : null,
      amount: amount(row.amount),
      order_count: amount(row.count),
      date_from: dateFrom,
      date_to: dateTo,
      synced_at: syncedAt,
      updated_at: syncedAt,
    }));

  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await adminClient.from(SNAPSHOT_TABLE)
      .upsert(rows.slice(offset, offset + 500), { onConflict: 'odoo_employee_id,date_from,date_to' });
    if (error) throw new Error(`Supabase ghi snapshot Odoo thất bại (${error.code || 'unknown'}).`);
  }

  return { ok: true, dateFrom, dateTo, fetchedRows: payload.length, savedRows: rows.length, syncedAt };
}

export async function readUpcareMktSnapshot(
  env: MetaEnvironment,
  dateFrom: string,
  dateTo: string,
  adminClient = createSupabaseAdminClient(env)
) {
  const { data, error } = await adminClient
    .from(SNAPSHOT_TABLE)
    .select('odoo_employee_id, employee_code, employee_name, avatar_url, amount, order_count, synced_at')
    .eq('date_from', dateFrom)
    .eq('date_to', dateTo)
    .order('amount', { ascending: false })
    .order('employee_name', { ascending: true });
  if (error) throw new Error(`Supabase đọc snapshot Odoo thất bại (${error.code || 'unknown'}).`);

  const employees = (data || []).map((row) => ({
    id: Number(row.odoo_employee_id),
    code: row.employee_code,
    name: row.employee_name,
    avatar: row.avatar_url,
    amount: amount(row.amount as string | number | null),
    count: amount(row.order_count as string | number | null),
  }));
  const lastSyncedAt = (data || []).reduce<string | null>((latest, row) => {
    const current = typeof row.synced_at === 'string' ? row.synced_at : null;
    return current && (!latest || current > latest) ? current : latest;
  }, null);
  return { employees, lastSyncedAt };
}
