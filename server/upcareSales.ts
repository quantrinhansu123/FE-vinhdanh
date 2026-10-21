import { createUpcareClient } from './upcareClient.js';

export const UPCARE_SALE_ONLY_EMPLOYEE_CODES = ['FBC.OldCustomer', 'FBC.Hotline'] as const;

export class UpcareSaleRequestError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

function normalizeCode(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function makeRequestPath(search: URLSearchParams, env: Record<string, string | undefined>): string {
  const dateFrom = search.get('date_from');
  const dateTo = search.get('date_to');
  if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo) {
    throw new UpcareSaleRequestError('Khoảng ngày Upcare không hợp lệ.', 400);
  }
  const from = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
  const to = new Date(`${dateTo}T00:00:00.000Z`).getTime();
  if ((to - from) / 86400000 > 369) {
    throw new UpcareSaleRequestError('Khoảng ngày Upcare không được vượt quá 370 ngày.', 400);
  }

  const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  const projectId = (env.UPCARE_CRM_PROJECT_UUID || env.VITE_UPCARE_CRM_PROJECT_UUID || '').trim();
  if (projectId && projectId.toLowerCase() !== 'none') {
    const projectParam = (env.UPCARE_CRM_PROJECT_PARAM || env.VITE_UPCARE_CRM_PROJECT_PARAM || 'project_id').trim();
    query.set(projectParam || 'project_id', projectId);
  }
  return `/api/employee/sale?${query.toString()}`;
}

function filterTargetRows(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new UpcareSaleRequestError('Nguồn Odoo Sales trả về cấu trúc không hợp lệ.');
  }
  const allowed = new Set(UPCARE_SALE_ONLY_EMPLOYEE_CODES.map(normalizeCode));
  return value.filter((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    const record = row as Record<string, unknown>;
    return allowed.has(normalizeCode(record.code ?? record.f99_uid));
  });
}

function filterPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) return filterTargetRows(payload);
  if (!payload || typeof payload !== 'object') {
    throw new UpcareSaleRequestError('Nguồn Odoo Sales trả về cấu trúc không hợp lệ.');
  }
  const entries = Object.entries(payload as Record<string, unknown>);
  if (!entries.every(([, rows]) => Array.isArray(rows))) {
    throw new UpcareSaleRequestError('Nguồn Odoo Sales trả về cấu trúc không hợp lệ.');
  }
  return Object.fromEntries(entries.map(([date, rows]) => [date, filterTargetRows(rows)]));
}

export async function requestUpcareSaleOnlyPayload(
  client: ReturnType<typeof createUpcareClient>,
  search: URLSearchParams,
  env: Record<string, string | undefined>
): Promise<unknown> {
  const response = await client.request(makeRequestPath(search, env));
  if (!response.ok) {
    await response.body?.cancel();
    throw new UpcareSaleRequestError(`Nguồn Odoo Sales trả HTTP ${response.status}.`);
  }
  if (!(response.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    await response.body?.cancel();
    throw new UpcareSaleRequestError('Nguồn Odoo Sales không trả JSON.');
  }
  const payload = await response.json().catch(() => null);
  return filterPayload(payload);
}
