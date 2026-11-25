import { test, expect } from '@playwright/test';

test.describe('LENDGUARD AI — Enterprise Max-Roof Capabilities E2E Verification', () => {
  const ADMIN_EMAIL = 'staging.admin@lendguard.internal';
  const ADMIN_PASS = 'StagingAdmin_Secure2026!';
  const BASE_URL = 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('01. Brand Title, Live Telemetry Pill, Notification Inbox, Tour & Demo Reset Modal', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await expect(page).toHaveTitle(/LendGuard AI/i);
    await expect(page.getByText(/AI CLUSTER ONLINE • \d+ms/i)).toBeVisible({ timeout: 8000 });

    // Open Notification Bell drawer
    await page.locator('button[title="Live Notifications & Event Feed"]').click();
    await expect(page.getByText(/Notification Feed/i)).toBeVisible();
    await page.locator('button[title="Live Notifications & Event Feed"]').click();

    // Open Re-Seed Confirm Modal (non-blocking Astryx modal) & cancel cleanly
    await page.getByRole('button', { name: /Re-Seed Demo/i }).click();
    await expect(page.getByText('Confirm Showcase Demo Reset')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Showcase Tour Modal
    await page.getByRole('button', { name: /Showcase Tour/i }).click();
    await expect(page.getByText('LendGuard Enterprise Architecture & Feature Walkthrough')).toBeVisible();
    await expect(page.getByText(/High-Throughput Ingestion/i)).toBeVisible();
    await expect(page.getByText(/Dual-Engine AI Intelligence/i)).toBeVisible();
    await expect(page.getByText(/Prescriptive Accounting Journals/i)).toBeVisible();

    await page.getByRole('button', { name: /Start Exploring LendGuard/i }).click();
    await expect(page.getByText('LendGuard Enterprise Architecture & Feature Walkthrough')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('02. Policy & Reconciliation Rule Builder (/rules) Database Persistence & Reload', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/rules`);
    await expect(page.getByText('Reconciliation Policy & Rule Engine')).toBeVisible();

    // Switch to High-Velocity Fintech preset & persist to PostgreSQL via API
    await page.getByText('High-Velocity Fintech').click();
    const putPromise = page.waitForResponse((res) => res.url().includes('/api/v1/system/policy') && res.request().method() === 'PUT');
    await page.getByRole('button', { name: /Save & Calibrate Engine/i }).click();
    const putRes = await putPromise;
    expect(putRes.status()).toBe(200);

    // Full page reload must hydrate fintech preset directly from PostgreSQL backend
    await page.reload();
    await expect(page.getByText('High-Velocity Fintech')).toBeVisible();
    const saved = await page.evaluate(() => localStorage.getItem('lendguard_matching_policy'));
    expect(JSON.parse(saved!).selectedPreset).toBe('fintech');

    // Restore Strict Banking baseline policy cleanly
    await page.getByRole('button', { name: /Restore Defaults/i }).click();
    await page.waitForTimeout(400);
    const restored = await page.evaluate(() => localStorage.getItem('lendguard_matching_policy'));
    expect(JSON.parse(restored!).selectedPreset).toBe('strict');
    expect(errors).toEqual([]);
  });

  test('03. Imports Page Client-Side Pre-Flight CSV Schema Inspector', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/imports`);
    await expect(page.getByText(/Upload Transaction Batch/i)).toBeVisible();

    const sampleCsv = [
      'transaction_reference,transaction_date,amount,currency,transaction_type,external_reference',
      'TX-PREFLIGHT-001,2026-11-25,12500.00,INR,LOAN_REPAYMENT,EXT-PF-001',
      'TX-PREFLIGHT-002,2026-11-25,8400.50,INR,INTEREST_PAYMENT,EXT-PF-002',
    ].join('\n');

    await page.setInputFiles('#csvFileInput', {
      name: 'preflight_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(sampleCsv),
    });

    const verifiedBadge = page.getByText('Pre-Flight Schema Verified • Ready for Ingestion');
    await expect(verifiedBadge).toHaveCount(1);
    await expect(verifiedBadge).toBeVisible();
    await expect(page.getByText('TX-PREFLIGHT-001')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('04. Exception Detail Dual-Engine AI, GL Posting & Prescriptive Double-Entry Journal', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/exceptions`);
    await page.waitForTimeout(800);

    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    await page.waitForURL('**/exceptions/**', { timeout: 10000 });
    await expect(page.getByText('Dual-Engine AI Intelligence Center')).toBeVisible();
    await expect(page.getByText('Prescriptive Double-Entry Accounting Journal Suggestion')).toBeVisible();
    await expect(page.getByText('GAAP / IFRS COMPLIANT')).toBeVisible();
    await expect(page.getByText(/Dual-Entry Trial Balance Verified \(Variance: 0\.00\)/i)).toBeVisible();

    // Post balanced GL journal entry to immutable PostgreSQL audit ledger
    const postBtn = page.getByRole('button', { name: /Post to Immutable GL Log/i });
    await expect(postBtn).toBeVisible();
    const journalPromise = page.waitForResponse((res) => res.url().includes('/journal') && res.request().method() === 'POST');
    await postBtn.click();
    const journalRes = await journalPromise;
    expect(journalRes.status()).toBe(200);
    await expect(page.getByText(/POSTED: JE-LG-/i)).toBeVisible({ timeout: 5000 });

    // Trigger AI Diagnostics and wait for live Dual-Engine response
    const runAiBtn = page.getByRole('button', { name: /Full AI Diagnostics/i }).first();
    if (await runAiBtn.isVisible()) {
      const aiPromise = page.waitForResponse((res) => res.url().includes('/analysis') && res.request().method() === 'POST', { timeout: 20000 });
      await runAiBtn.click();
      const aiRes = await aiPromise;
      expect([200, 201, 202]).toContain(aiRes.status());
    }

    await expect(page.getByText(/Engine 1: ML Anomaly Detector/i).or(page.getByText(/Calculated Anomaly Score/i)).first()).toBeVisible({ timeout: 15000 });
    expect(errors).toEqual([]);
  });

  test('05. Reports Executive Statement PDF Dossier Modal & SOX Attestation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/reports`);
    await expect(page.getByRole('button', { name: /Generate Executive Statement \(PDF Dossier\)/i })).toBeVisible();

    await page.getByRole('button', { name: /Generate Executive Statement \(PDF Dossier\)/i }).click();
    const dossier = page.locator('#printable-dossier');
    await expect(dossier.getByText('LENDGUARD FINANCIAL INTELLIGENCE')).toBeVisible();
    await expect(dossier.getByText('REGULATORY AUDIT CERTIFICATION & CONTROLS ATTESTATION')).toBeVisible();
    await expect(dossier.getByText('Anu Sushmitha').first()).toBeVisible();
    await expect(dossier.getByText('Visva').first()).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
    expect(errors).toEqual([]);
  });

  test('06. New Reconciliation Run Modal Populates Real IMPORTED Batches & Active DB Policy', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/reconciliation-runs`);
    await expect(page.getByText('Reconciliation Execution History')).toBeVisible();

    await page.getByRole('button', { name: /New Reconciliation Run/i }).click();
    await expect(page.getByText('Execute Reconciliation Run')).toBeVisible();
    await expect(page.getByText(/Active Policy Profile:/i)).toBeVisible();

    // Verify genuine IMPORTED batches appear in both Internal and External selects (not broken "CONFIRMED" empty state)
    const internalOptions = await page.locator('form select').nth(0).locator('option').allTextContents();
    const externalOptions = await page.locator('form select').nth(1).locator('option').allTextContents();
    expect(internalOptions.length).toBeGreaterThan(0);
    expect(externalOptions.length).toBeGreaterThan(0);
    expect(internalOptions[0]).not.toContain('No confirmed internal batches available');
    expect(externalOptions[0]).not.toContain('No confirmed external batches available');

    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(errors).toEqual([]);
  });
});
