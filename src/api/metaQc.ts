export class MetaQcError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(method: 'GET' | 'POST', body?: unknown, action = ''): Promise<T> {
  const response = await fetch(`/api/meta-qc${action ? `?action=${action}` : ''}`, {
    method, credentials: 'same-origin',
    headers: { 'X-Meta-QC-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(65000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages: Record<string, string> = {
      meta_not_configured: 'Chưa cấu hình META_ACCESS_TOKEN trên server.',
      meta_auth_failed: 'Token Meta đã hết hạn hoặc thiếu quyền truy cập. Hãy kiểm tra cấu hình server.',
      meta_page_limit: 'Dữ liệu quá lớn. Hãy chọn khoảng ngày ngắn hơn.',
      invalid_date_range: 'Chọn khoảng ngày hợp lệ, tối đa 31 ngày.',
      meta_connection_failed: 'Kết nối Meta bị gián đoạn. Hãy thử lại với khoảng ngày ngắn hơn.',
      meta_request_failed: 'Meta từ chối yêu cầu. Kiểm tra token, quyền tài khoản và phiên bản API trên server.',
    };
    throw new MetaQcError(response.status, messages[data.error] || data.message || 'Không lấy được dữ liệu Meta.');
  }
  return data as T;
}

export const getMetaQcAccounts = () => request<{ accounts: string[] }>('GET');
export const loginMetaQc = (email: string, password: string) =>
  request<{ accounts: string[] }>('POST', { email, password }, 'login');
export const importMetaQc = (account_id: string, since: string, until: string) =>
  request<{ account_id: string; rows_saved: number; missing_employee_code: number; account_timezone: string }>(
    'POST', { account_id, since, until });
