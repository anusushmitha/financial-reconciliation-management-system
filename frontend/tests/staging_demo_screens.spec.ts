import { test, expect } from '@playwright/test';

test.describe('LENDGUARD AI — Staging Stakeholder Demonstration Browser Verification', () => {
  const ADMIN_EMAIL = 'staging.admin@lendguard.internal';
  const ADMIN_PASS = 'StagingAdmin_Secure2026!';
  const ANALYST_EMAIL = 'staging.analyst@lendguard.internal';
  const ANALYST_PASS = 'StagingAnalyst_Secure2026!';
  const BASE_URL = 'http://localhost:5173';
  const API_URL = 'http://localhost:5000';

  let adminToken: string;
  let sampleExceptionId: string = '';

  test.beforeAll(async ({ request }) => {
    // Authenticate Admin via API to get token and entity IDs
    const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASS }
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    adminToken = loginData.accessToken;

    // Get an exception ID
    const excsRes = await request.get(`${API_URL}/api/v1/exceptions?pageSize=5`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (excsRes.status() === 200) {
      const excData = await excsRes.json();
      if (excData.items && excData.items.length > 0) {
        sampleExceptionId = excData.items[0].id;
      }
    }
  });

  test('01. Dev Seed Lockout Verification in Browser', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Expect error alert or message
    await expect(page.locator('div[style*="background-color: rgb(254, 242, 242)"], div:has-text("Login failed"), div:has-text("credentials")').first()).toBeVisible({ timeout: 5000 });
  });

  test('02. Staging Admin Login & Dashboard Rendering', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');

    // Expect navigation to Dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Dashboard/i }).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/demo_01_dashboard.png' });
  });

  test('03. Imports Page Rendering', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/imports`);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Import/i }).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/demo_02_imports.png' });
  });

  test('04. Reconciliation Runs Page Rendering', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/reconciliation-runs`);
    await expect(page).toHaveURL(/reconciliation-runs/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Reconciliation/i }).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/demo_03_reconciliation.png' });
  });

  test('05. Exceptions Queue & Detail Page Rendering', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/exceptions`);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Exception/i }).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/demo_04_exceptions.png' });

    if (sampleExceptionId) {
      await page.goto(`${BASE_URL}/exceptions/${sampleExceptionId}`);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/demo_05_exception_detail.png' });
    }
  });

  test('06. Audit History Page Rendering (Admin)', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/audit-logs`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/demo_06_audit_history.png' });
  });

  test('07. Reports Page Rendering', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/reports`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/demo_07_reports.png' });
  });

  test('08. User Management Page Rendering', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/users`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/demo_08_users.png' });
  });

  test('09. Analyst RBAC Isolation in Browser', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ANALYST_EMAIL);
    await page.fill('input[type="password"]', ANALYST_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Attempt to navigate to /users
    await page.goto(`${BASE_URL}/users`);
    await page.waitForTimeout(1000);
    // User should either be redirected or shown Access Denied
    const currentUrl = page.url();
    const pageContent = await page.textContent('body');
    const isProtected = currentUrl.includes('dashboard') || 
                        pageContent?.includes('Access Denied') || 
                        pageContent?.includes('Unauthorized') || 
                        pageContent?.includes('Forbidden');
    expect(isProtected).toBe(true);
    await page.screenshot({ path: 'test-results/demo_09_analyst_blocked.png' });
  });
});
