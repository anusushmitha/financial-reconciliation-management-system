import { test, expect } from '@playwright/test';

test.describe('LENDGUARD AI — Full 18-Screen End-to-End Verification Suite', () => {
  let adminToken: string;
  let sampleBatchId: string = '';
  let sampleTxnId: string = '';
  let sampleRunId: string = '';
  let sampleExceptionId: string = '';

  test.beforeAll(async ({ request }) => {
    // 1. Authenticate via backend API to harvest live entity IDs for deep screen testing
    const loginRes = await request.post('http://localhost:5000/api/v1/auth/login', {
      data: { email: 'admin@example.com', password: 'Admin123!' }
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    adminToken = loginData.accessToken || loginData.token;

    // 2. Fetch sample batch ID
    const batchesRes = await request.get('http://localhost:5000/api/v1/imports?pageSize=5', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (batchesRes.status() === 200) {
      const batchesData = await batchesRes.json();
      if (batchesData.items && batchesData.items.length > 0) {
        sampleBatchId = batchesData.items[0].id;
      }
    }

    // 3. Fetch sample transaction ID
    const txnsRes = await request.get('http://localhost:5000/api/v1/transactions?pageSize=5', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (txnsRes.status() === 200) {
      const txnsData = await txnsRes.json();
      if (txnsData.items && txnsData.items.length > 0) {
        sampleTxnId = txnsData.items[0].id;
      }
    }

    // 4. Fetch sample reconciliation run ID
    const runsRes = await request.get('http://localhost:5000/api/v1/reconciliation-runs?pageSize=5', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (runsRes.status() === 200) {
      const runsData = await runsRes.json();
      if (runsData.items && runsData.items.length > 0) {
        sampleRunId = runsData.items[0].id;
      }
    }

    // 5. Fetch sample exception ID
    const exceptionsRes = await request.get('http://localhost:5000/api/v1/exceptions?pageSize=5', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (exceptionsRes.status() === 200) {
      const exData = await exceptionsRes.json();
      if (exData.items && exData.items.length > 0) {
        sampleExceptionId = exData.items[0].id;
      }
    }
  });

  test('Public Auth Screens — S01 (Login), S02 (Forgot Password), S03 (Reset Password)', async ({ page }) => {
    // S01: Login Screen (negative test: invalid password)
    await page.goto('/login');
    await expect(page).toHaveURL('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'WrongPassword999!');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('text=Email or password is incorrect.').or(page.locator('text=incorrect'))).toBeVisible({ timeout: 5000 });

    // S02: Forgot Password Screen
    await page.goto('/forgot-password');
    await expect(page).toHaveURL('/forgot-password');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Reset Instructions Sent')).toBeVisible({ timeout: 5000 });

    // S03: Reset Password Screen
    await page.goto('/reset-password?token=sample-reset-token-2026');
    await expect(page).toHaveURL(/reset-password/);
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Comprehensive Interactive Journey — S04 to S18', async ({ page }) => {
    // S01 -> S04: Login as Admin
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'admin@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // S04: Dashboard Screen Verification
    await expect(page.locator('text=Total Transactions').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Open Exceptions').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 5000 });

    // S05: Ingestion/Upload Screen
    await page.goto('/imports');
    await expect(page).toHaveURL('/imports');
    await expect(page.locator('h2:has-text("Transaction Imports")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Select Data Source Type')).toBeVisible();

    // S06: Batch Validation Results Screen
    if (sampleBatchId) {
      await page.goto(`/imports/${sampleBatchId}/validation`);
      await expect(page).toHaveURL(`/imports/${sampleBatchId}/validation`);
      await expect(page.locator('text=Batch Validation Results')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Total Rows Processed')).toBeVisible();
    }

    // S07: Transactions Ledger Screen
    await page.goto('/transactions');
    await expect(page).toHaveURL('/transactions');
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });

    // S08: Transaction Detail Screen
    if (sampleTxnId) {
      await page.goto(`/transactions/${sampleTxnId}`);
      await expect(page).toHaveURL(`/transactions/${sampleTxnId}`);
      await expect(page.locator('text=Transaction Detail').first()).toBeVisible({ timeout: 5000 });
    }

    // S09: Reconciliation Runs List & Start Modal
    await page.goto('/reconciliation-runs');
    await expect(page).toHaveURL('/reconciliation-runs');
    const startBtn = page.locator('button:has-text("New Reconciliation"), button:has-text("Start Reconciliation")');
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await expect(page.locator('text=Internal Lending Batch')).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
    }

    // S10: Reconciliation Run Detail Screen
    if (sampleRunId) {
      await page.goto(`/reconciliation-runs/${sampleRunId}`);
      await expect(page).toHaveURL(`/reconciliation-runs/${sampleRunId}`);
      await expect(page.locator('text=Reconciliation Run').first()).toBeVisible({ timeout: 5000 });
    }

    // S11: Exceptions Queue Screen
    await page.goto('/exceptions');
    await expect(page).toHaveURL('/exceptions');
    await expect(page.locator('h2:has-text("Discrepancy & Exception Queue")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });

    // S12: Exception Investigation Screen
    if (sampleExceptionId) {
      await page.goto(`/exceptions/${sampleExceptionId}`);
      await expect(page).toHaveURL(`/exceptions/${sampleExceptionId}`);
      await expect(page.locator('h3:has-text("AI Advisory Investigation Assistant")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('h3:has-text("Investigation Notes")')).toBeVisible({ timeout: 5000 });

      // Post Note Verification
      const noteInput = page.locator('textarea[placeholder*="note"], textarea[placeholder*="investigation"]');
      if (await noteInput.isVisible()) {
        const testNoteText = `E2E Live Audit Note [${Date.now()}]`;
        await noteInput.fill(testNoteText);
        await page.click('button:has-text("Post Note")');
        await expect(page.locator(`text=${testNoteText}`).first()).toBeVisible({ timeout: 5000 });
      }
    }

    // S13 & S14: Reports & Analytics Screens
    await page.goto('/reports');
    await expect(page).toHaveURL('/reports');
    await expect(page.locator('h2:has-text("Reports & Analytics")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Export Reconciliation CSV")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Export Exceptions CSV")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h3:has-text("Reconciliation Matching Performance")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h3:has-text("Exception Distribution by Discrepancy Type")')).toBeVisible({ timeout: 5000 });

    // S15: Audit History Screen (Admin Only)
    await page.goto('/audit-logs');
    await expect(page).toHaveURL('/audit-logs');
    await expect(page.locator('h2:has-text("Audit Trail & Compliance")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });

    // S16 & S17: User Management & Create User Modal (Admin Only)
    await page.goto('/users');
    await expect(page).toHaveURL('/users');
    await expect(page.locator('h2:has-text("User Management")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });

    // S17 Modal trigger
    await page.click('button:has-text("Create User")');
    await expect(page.locator('text=Create New User Account')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder*="Jane Doe"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Cancel")');

    // S18: Profile Screen & Secure Sign Out
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');
    await expect(page.locator('text=User ID:').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();

    await page.click('button:has-text("Sign Out")');
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/.*login/);
  });

  test('Analyst Role Restrictions — Route Guards & Backend RBAC', async ({ page, request }) => {
    // 1. Frontend Route Guard: Login as Analyst
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'analyst@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'Analyst123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Attempt to access S16 /users -> Must redirect to /dashboard
    await page.goto('/users');
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // Attempt to access S15 /audit-logs -> Must redirect to /dashboard
    await page.goto('/audit-logs');
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // 2. Direct API RBAC Protection
    const loginRes = await request.post('http://localhost:5000/api/v1/auth/login', {
      data: { email: 'analyst@example.com', password: 'Analyst123!' }
    });
    const { accessToken: analystToken } = await loginRes.json();

    const auditRes = await request.get('http://localhost:5000/api/v1/audit-logs', {
      headers: { Authorization: `Bearer ${analystToken}` }
    });
    expect(auditRes.status()).toBe(403);

    const createUserRes = await request.post('http://localhost:5000/api/v1/users', {
      headers: { Authorization: `Bearer ${analystToken}` },
      data: { email: 'forbidden@example.com', fullName: 'Hacker', role: 'ADMIN', password: 'Password123!' }
    });
    expect(createUserRes.status()).toBe(403);
  });
});
