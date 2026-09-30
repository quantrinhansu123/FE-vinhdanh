/**
 * Test phân cấp tài khoản:
 * - Giám đốc: xem được tất cả các dự án
 * - Quản lý dự án: xem được toàn bộ dự án
 * - Leader: xem được chỉ số của team mình
 * - Nhân viên: xem được chỉ số của team mình
 * Acc seed: scripts/seed-role-test-accounts.mjs (pass 123456).
 */
const { test, expect } = require('@playwright/test');

const SHOT = 'test-results/screenshots';

async function login(page, email, password = '123456') {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
}

async function projectNames(page) {
  // Cột tên dự án: lấy text các ô tên trong bảng (dòng dữ liệu, bỏ header)
  const cells = page.locator('tbody tr td:nth-child(2)');
  return cells.allTextContents();
}

test.describe('Phân cấp 4 vai trò', () => {
  test('Giám đốc: thấy TẤT CẢ dự án + có nút Thêm', async ({ page }) => {
    await login(page, 'giamdoc@test.com');
    await page.goto('/crm-admin/projects');
    await expect(page.getByText('Toàn bộ dự án (Giám đốc)')).toBeVisible({ timeout: 20000 });
    const names = await projectNames(page);
    expect(names.join('|')).toContain('Bất Động Sản Luxury A');
    expect(names.join('|')).toContain('Thời Trang Nữ Trendy');
    await expect(page.getByRole('button', { name: 'Thêm dự án' })).toBeVisible();
    await page.screenshot({ path: `${SHOT}/projects-giamdoc.png` });
  });

  test('Quản lý dự án: vào thẳng projects, thấy TOÀN BỘ + có nút Thêm', async ({ page }) => {
    await login(page, 'qldoan@test.com');
    // Sau login app về '/' — điều hướng tường minh tới projects (default view của QLDA)
    await page.goto('/crm-dashboard/x');
    await expect(page).toHaveURL(/\/crm-admin\/projects/, { timeout: 20000 });
    await page.goto('/crm-admin/projects');
    await expect(page.getByText('Toàn bộ dự án được giao (Quản lý dự án)')).toBeVisible({ timeout: 20000 });
    const names = await projectNames(page);
    expect(names.join('|')).toContain('Bất Động Sản Luxury A');
    expect(names.join('|')).toContain('Thời Trang Nữ Trendy');
    await expect(page.getByRole('button', { name: 'Thêm dự án' })).toBeVisible();
    await page.screenshot({ path: `${SHOT}/projects-qlda.png` });
  });

  test('Leader: projects CHỈ team mình, KHÔNG nút Thêm; leader-dash đúng team', async ({ page }) => {
    await login(page, 'leader@test.com');
    // Default view của Leader qua /crm-dashboard → leader-dash
    await page.goto('/crm-dashboard/');
    await expect(page).toHaveURL(/\/crm-admin\/leader-dash/, { timeout: 20000 });
    await page.goto('/crm-admin/leader-dash');
    await expect(page.getByText('Team Test').first()).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `${SHOT}/leader-dash-leader.png` });

    await page.goto('/crm-admin/projects');
    await expect(page.getByText(/Chỉ số team Team Test \(Leader\)/)).toBeVisible({ timeout: 20000 });
    // Scope bất đồng bộ: đợi banner chốt số lượng (1/2) rồi mới đọc bảng
    await expect(page.getByText('1/2 dự án')).toBeVisible({ timeout: 20000 });
    const names = await projectNames(page);
    expect(names.join('|')).toContain('Bất Động Sản Luxury A');
    expect(names.join('|')).not.toContain('Thời Trang Nữ Trendy');
    await expect(page.getByRole('button', { name: 'Thêm dự án' })).toHaveCount(0);
    await page.screenshot({ path: `${SHOT}/projects-leader.png` });
  });

  test('Nhân viên: projects CHỈ team mình (read-only); mkt-dash cá nhân', async ({ page }) => {
    await login(page, 'nv@test.com');
    // Default view của NV qua /crm-dashboard → mkt-dash
    await page.goto('/crm-dashboard/');
    await expect(page).toHaveURL(/\/crm-admin\/mkt-dash/, { timeout: 20000 });
    await page.screenshot({ path: `${SHOT}/mkt-dash-nv.png` });

    await page.goto('/crm-admin/projects');
    await expect(page.getByText(/Nhân viên/)).toBeVisible({ timeout: 20000 });
    // Scope bất đồng bộ: đợi banner chốt số lượng (1/2) rồi mới đọc bảng
    await expect(page.getByText('1/2 dự án')).toBeVisible({ timeout: 20000 });
    const names = await projectNames(page);
    expect(names.join('|')).toContain('Bất Động Sản Luxury A');
    expect(names.join('|')).not.toContain('Thời Trang Nữ Trendy');
    await expect(page.getByRole('button', { name: 'Thêm dự án' })).toHaveCount(0);
    await page.screenshot({ path: `${SHOT}/projects-nv.png` });
  });

  test('Leader KHÔNG vào được admin-dash (bị đá về leader-dash)', async ({ page }) => {
    await login(page, 'leader@test.com');
    await page.goto('/crm-admin/admin-dash');
    await expect(page).toHaveURL(/\/crm-admin\/leader-dash/, { timeout: 20000 });
    await page.screenshot({ path: `${SHOT}/guard-leader.png` });
  });
});
