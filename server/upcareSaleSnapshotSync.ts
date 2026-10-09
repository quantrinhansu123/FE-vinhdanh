import { createUpcareClient, UpcareAuthError } from './upcareClient';
import { createSupabaseAdminClient } from './supabaseAdmin';
import type { MetaEnvironment } from './metaAdsClient';

const SNAPSHOT_TABLE = 'upcare_sale_snapshots';

type UpcareSaleEmployee = {
  id?: string | number | boolean | null;
  code?: string | number | boolean | null;
  name?: string | null;
  avatar?: string | null;
  amount?: string | number | null;
  count?: string | number | null;
  [key: string]: unknown;
};

function amount(value: unknown): number {
  if (value == null || value === '' || value === false) return 0;
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractRows(payload: unknown): UpcareSaleEmployee[] {
  if (Array.isArray(payload)) {
    if (!payload.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
      throw new Error('API Odoo Sale có dòng dữ liệu không đúng định dạng.');
    }
    return payload as UpcareSaleEmployee[];
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if ('id' in record) return [record as UpcareSaleEmployee];
    for (const [key, value] of Object.entries(record)) {
      if (['data', 'result', 'records', 'employees', 'items'].includes(key.toLowerCase())) {
        try {
          return extractRows(value);
        } catch { /* Try the next documented wrapper key. */ }
      }
    }
  }
  throw new Error('API Odoo Sale không trả về danh sách nhân viên nhận diện được.');
}

export async function syncUpcareSaleSnapshot(
  env: MetaEnvironment,
  dateFrom: string,
  dateTo: string,
  adminClient = createSupabaseAdminClient(env),
  upcare = createUpcareClient(env)
) {
  const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  let response: Response;
  try {
    response = await upcare.request(`/api/employee/sale?${query.toString()}`);
  } catch (error) {
    if (error instanceof UpcareAuthError) throw error;
    throw new Error('Không kết nối được API nhân viên Sale của Odoo.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Odoo Sale trả HTTP ${response.status}. Kiểm tra quyền API hoặc phiên đăng nhập.`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    await response.body?.cancel();
    throw new Error('API Odoo Sale không trả JSON.');
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Không đọc được JSON từ API Odoo Sale.');
  }
  const employees = extractRows(payload);
  const syncedAt = new Date().toISOString();
  const rows = employees
    .filter((row) => row.id != null && row.id !== false && String(row.id).trim())
    .map((row) => ({
      odoo_employee_id: String(row.id).trim(),
      employee_code: row.code == null || row.code === false ? null : String(row.code),
      employee_name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Chưa có tên',
      avatar_url: typeof row.avatar === 'string' ? row.avatar : null,
      amount: amount(row.amount),
      sale_count: amount(row.count),
      date_from: dateFrom,
      date_to: dateTo,
      raw_payload: row,
      synced_at: syncedAt,
      updated_at: syncedAt,
    }));

  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await adminClient.from(SNAPSHOT_TABLE)
      .upsert(rows.slice(offset, offset + 500), { onConflict: 'odoo_employee_id,date_from,date_to' });
    if (error) throw new Error(`Supabase ghi snapshot Odoo Sale thất bại (${error.code || 'unknown'}).`);
  }

  return { ok: true, dateFrom, dateTo, fetchedRows: employees.length, savedRows: rows.length, syncedAt };
}

export async function readUpcareSaleSnapshot(
  env: MetaEnvironment,
  dateFrom: string,
  dateTo: string,
  adminClient = createSupabaseAdminClient(env)
) {
  const { data, error } = await adminClient
    .from(SNAPSHOT_TABLE)
    .select('odoo_employee_id, employee_code, employee_name, avatar_url, amount, sale_count, synced_at')
    .eq('date_from', dateFrom)
    .eq('date_to', dateTo)
    .order('amount', { ascending: false })
    .order('employee_name', { ascending: true })
    .limit(20);
  if (error) throw new Error(`Supabase đọc snapshot Odoo Sale thất bại (${error.code || 'unknown'}).`);

  const employees = (data || []).map((row) => ({
    id: Number(row.odoo_employee_id),
    code: row.employee_code,
    name: row.employee_name,
    avatar: row.avatar_url,
    amount: amount(row.amount as string | number | null),
    count: amount(row.sale_count as string | number | null),
  }));
  const lastSyncedAt = (data || []).reduce<string | null>((latest, row) => {
    const current = typeof row.synced_at === 'string' ? row.synced_at : null;
    return current && (!latest || current > latest) ? current : latest;
  }, null);
  return { employees, lastSyncedAt };
}
