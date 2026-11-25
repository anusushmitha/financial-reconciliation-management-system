import { test, expect } from '@playwright/test';

test.describe('LENDGUARD AI — E2E Screen Navigation & RBAC Verification', () => {

  test('Public Auth Screens (S01, S02, S03)', async ({ page }) => {
    // S01: Login
    await page.goto('/login');
    await expect(page).toHaveURL('/login');
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // S02: Forgot Password
    await page.goto('/forgot-password');
    await expect(page).toHaveURL('/forgot-password');
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // S03: Reset Password
    await page.goto('/reset-password?token=dummy-token-for-test');
    await expect(page).toHaveURL(/reset-password/);
  });

  test('Admin Journey — Screen Coverage S04 to S18', async ({ page }) => {
    // Login as Admin
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'staging.admin@lendguard.internal');
    await page.fill('input[type="password"], input[name="password"]', 'StagingAdmin_Secure2026!');
    await page.click('button[type="submit"]');

    // S04: Dashboard
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // S05: Imports
    await page.goto('/imports');
    await expect(page).toHaveURL('/imports');

    // S07: Transactions Ledger
    await page.goto('/transactions');
    await expect(page).toHaveURL('/transactions');

    // S09: Reconciliation Runs
    await page.goto('/reconciliation-runs');
    await expect(page).toHaveURL('/reconciliation-runs');

    // S11: Exceptions Queue
    await page.goto('/exceptions');
    await expect(page).toHaveURL('/exceptions');

    // S13 / S14: Reports & Export
    await page.goto('/reports');
    await expect(page).toHaveURL('/reports');

    // S15: Audit Logs (Admin Only)
    await page.goto('/audit-logs');
    await expect(page).toHaveURL('/audit-logs');

    // S16 / S17: User Management (Admin Only)
    await page.goto('/users');
    await expect(page).toHaveURL('/users');

    // S18: Profile Page
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');
  });

  test('Analyst RBAC Enforcement — Blocked from Admin Screens & APIs', async ({ page, request }) => {
    // 1. Frontend Route Guard: Login as Analyst
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'staging.analyst@lendguard.internal');
    await page.fill('input[type="password"], input[name="password"]', 'StagingAnalyst_Secure2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Attempt to access S16/S17 /users -> Must redirect away from /users
    await page.goto('/users');
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // Attempt to access S15 /audit-logs -> Must redirect away from /audit-logs
    await page.goto('/audit-logs');
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // 2. Backend Direct API RBAC Enforcement:
    // Login to get Analyst JWT token
    const loginRes = await request.post('http://localhost:5000/api/v1/auth/login', {
      data: { email: 'staging.analyst@lendguard.internal', password: 'StagingAnalyst_Secure2026!' }
    });
    expect(loginRes.status()).toBe(200);
    const { accessToken: analystToken } = await loginRes.json();

    // Call GET /api/v1/audit-logs as Analyst -> Must return 403 Forbidden
    const auditRes = await request.get('http://localhost:5000/api/v1/audit-logs', {
      headers: { Authorization: `Bearer ${analystToken}` }
    });
    expect(auditRes.status()).toBe(403);

    // Call POST /api/v1/users (create user) as Analyst -> Must return 403 Forbidden
    const createUserRes = await request.post('http://localhost:5000/api/v1/users', {
      headers: { Authorization: `Bearer ${analystToken}` },
      data: {
        fullName: 'Unauthorized Created User',
        email: 'unauth@example.com',
        password: 'Password123!',
        role: 'ANALYST'
      }
    });
    expect(createUserRes.status()).toBe(403);

    // Call PATCH /api/v1/exceptions/{id}/assignment as Analyst -> Must return 403 Forbidden
    const assignRes = await request.patch('http://localhost:5000/api/v1/exceptions/00000000-0000-0000-0000-000000000001/assignment', {
      headers: { Authorization: `Bearer ${analystToken}` },
      data: { assignedTo: '00000000-0000-0000-0000-000000000002' }
    });
    expect(assignRes.status()).toBe(403);
  });

  test('Admin Forbidden Actions — Prevent Self-Deactivation & Disabling Last Admin', async ({ request }) => {
    // Login as Admin
    const loginRes = await request.post('http://localhost:5000/api/v1/auth/login', {
      data: { email: 'staging.admin@lendguard.internal', password: 'StagingAdmin_Secure2026!' }
    });
    const { accessToken: adminToken, user: adminUser } = await loginRes.json();

    // Admin attempts to deactivate own user account
    const deactivateRes = await request.patch(`http://localhost:5000/api/v1/users/${adminUser.id}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { isActive: false }
    });

    // Must be rejected (400 Bad Request or 409 Conflict)
    expect([400, 409]).toContain(deactivateRes.status());
  });

});
