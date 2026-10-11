import type { User } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from './supabaseAdmin';
import { requireSupabaseAdmin } from './metaAdsLeaderboard';

export type EmployeeAuthAccountInput = {
  email: string;
  oldEmail?: string | null;
  password?: string;
  name?: string;
};

export class EmployeeAuthAccountError extends Error {}

export type EmployeeAuthAccountResult = {
  email: string;
  ok: boolean;
  status?: 'created' | 'updated' | 'no_account';
  error?: string;
};

function normalizedEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function listUsersByEmail(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
): Promise<Map<string, User>> {
  const users = new Map<string, User>();
  const perPage = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new EmployeeAuthAccountError('Không tra được người dùng trong Supabase Auth.');
    for (const user of data.users) {
      const email = normalizedEmail(user.email);
      if (email) users.set(email, user);
    }
    if (data.users.length < perPage) return users;
  }
  throw new EmployeeAuthAccountError('Danh sách tài khoản Auth vượt giới hạn tìm kiếm an toàn.');
}

export async function syncEmployeeAuthAccounts(
  env: Record<string, string | undefined>,
  accessToken: string,
  inputs: EmployeeAuthAccountInput[],
): Promise<EmployeeAuthAccountResult[]> {
  await requireSupabaseAdmin(env, accessToken);
  const adminClient = createSupabaseAdminClient(env);
  const users = await listUsersByEmail(adminClient);
  const results: EmployeeAuthAccountResult[] = [];
  const requestedEmails = new Set<string>();

  for (const input of inputs) {
    const email = normalizedEmail(input.email);
    const oldEmail = normalizedEmail(input.oldEmail);
    const password = typeof input.password === 'string' ? input.password : '';
    const name = typeof input.name === 'string' ? input.name.trim().slice(0, 160) : '';
    try {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new EmployeeAuthAccountError('Email tài khoản không hợp lệ.');
      if (requestedEmails.has(email)) throw new EmployeeAuthAccountError('Email bị lặp trong yêu cầu đồng bộ.');
      requestedEmails.add(email);
      if (password && password.length < 6) throw new EmployeeAuthAccountError('Mật khẩu Supabase Auth cần tối thiểu 6 ký tự.');

      const existing = (oldEmail && users.get(oldEmail)) || users.get(email) || null;
      if (!existing && !password) {
        results.push({ email, ok: true, status: 'no_account' });
        continue;
      }

      if (existing) {
        const existingEmail = normalizedEmail(existing.email);
        const attributes: { email?: string; email_confirm?: boolean; password?: string; user_metadata?: Record<string, unknown> } = {};
        if (existingEmail !== email) {
          attributes.email = email;
          attributes.email_confirm = true;
        }
        if (password) attributes.password = password;
        if (name) attributes.user_metadata = { ...existing.user_metadata, name };
        if (Object.keys(attributes).length) {
          const { data, error } = await adminClient.auth.admin.updateUserById(existing.id, attributes);
          if (error) throw new EmployeeAuthAccountError('Không cập nhật được tài khoản trong Supabase Auth.');
          if (existingEmail) users.delete(existingEmail);
          if (data.user) users.set(email, data.user);
        }
        results.push({ email, ok: true, status: 'updated' });
        continue;
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: name ? { name } : {},
      });
      if (error || !data.user) throw new EmployeeAuthAccountError('Không tạo được tài khoản trong Supabase Auth. Kiểm tra email đã dùng chưa.');
      users.set(email, data.user);
      results.push({ email, ok: true, status: 'created' });
    } catch (error) {
      results.push({
        email,
        ok: false,
        error: error instanceof EmployeeAuthAccountError ? error.message : 'Không đồng bộ được tài khoản Supabase Auth.',
      });
    }
  }
  return results;
}
