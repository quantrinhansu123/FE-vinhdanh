import { supabase } from './supabase';

export type EmployeeAuthAccountInput = {
  email: string;
  oldEmail?: string | null;
  password?: string;
  name?: string;
};

type EmployeeAuthAccountResult = {
  email: string;
  ok: boolean;
  status?: 'created' | 'updated' | 'no_account';
  error?: string;
};

export async function syncEmployeeAuthAccounts(accounts: EmployeeAuthAccountInput[]): Promise<EmployeeAuthAccountResult[]> {
  if (!accounts.length) return [];
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (error || !accessToken) throw new Error('Phiên đăng nhập hết hạn. Hãy đăng nhập lại rồi thử đồng bộ tài khoản.');

  const results: EmployeeAuthAccountResult[] = [];
  for (let offset = 0; offset < accounts.length; offset += 100) {
    let response: Response;
    try {
      response = await fetch('/api/employee-auth-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accounts: accounts.slice(offset, offset + 100) }),
      });
    } catch {
      throw new Error('Không kết nối được API đồng bộ tài khoản Supabase Auth.');
    }

    const payload = await response.json().catch(() => ({})) as {
      message?: string;
      results?: EmployeeAuthAccountResult[];
    };
    if (!response.ok) throw new Error(payload.message || 'Không đồng bộ được tài khoản Supabase Auth.');
    results.push(...(payload.results || []));
  }
  return results;
}
