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

  test('01. Showcase Architecture Tour Modal & Topbar Controls', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await expect(page.getByText('AI CLUSTER ONLINE')).toBeVisible();
    await page.getByRole('button', { name: /Showcase Tour/i }).click();

    await expect(page.getByText('LendGuard Enterprise Architecture & Feature Walkthrough')).toBeVisible();
    await expect(page.getByText(/High-Throughput Ingestion/i)).toBeVisible();
    await expect(page.getByText(/Dual-Engine AI Intelligence/i)).toBeVisible();
    await expect(page.getByText(/Prescriptive Accounting Journals/i)).toBeVisible();

    await page.getByRole('button', { name: /Start Exploring LendGuard/i }).click();
    await expect(page.getByText('LendGuard Enterprise Architecture & Feature Walkthrough')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('02. Policy & Reconciliation Rule Builder (/rules) Presets & Persistence', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/rules`);
    await expect(page.getByText('Reconciliation Policy & Rule Engine')).toBeVisible();

    // Select Strict Banking preset
    await page.getByText('Strict Banking Policy').click();
    // Save policy and check confirmation
    await page.getByRole('button', { name: /Save & Calibrate Engine/i }).click();

    const saved = await page.evaluate(() => localStorage.getItem('lendguard_matching_policy'));
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.selectedPreset).toBe('strict');
    expect(parsed.fixedRupeeTolerance).toBe(0);

    // Switch to High-Velocity Fintech preset
    await page.getByText('High-Velocity Fintech').click();
    await page.getByRole('button', { name: /Save & Calibrate Engine/i }).click();

    const updated = await page.evaluate(() => localStorage.getItem('lendguard_matching_policy'));
    expect(JSON.parse(updated!).selectedPreset).toBe('fintech');
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

    // Verify Pre-Flight Schema Inspector renders ONCE cleanly under dropzone
    const verifiedBadge = page.getByText('Pre-Flight Schema Verified • Ready for Ingestion');
    await expect(verifiedBadge).toHaveCount(1);
    await expect(verifiedBadge).toBeVisible();
    await expect(page.getByText('TX-PREFLIGHT-001')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('04. Exception Detail Dual-Engine AI & Prescriptive Double-Entry Journal', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/exceptions`);
    await page.waitForTimeout(800);

    // Open first exception detail row
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    await page.waitForURL('**/exceptions/**', { timeout: 10000 });
    await expect(page.getByText('Dual-Engine AI Intelligence Center')).toBeVisible();
    await expect(page.getByText('Prescriptive Double-Entry Accounting Journal Suggestion')).toBeVisible();
    await expect(page.getByText('GAAP / IFRS COMPLIANT')).toBeVisible();
    await expect(page.getByText(/Dual-Entry Trial Balance Verified \(Variance: 0\.00\)/i)).toBeVisible();

    // Trigger AI Diagnostics if available
    const runAiBtn = page.getByRole('button', { name: /Full AI Diagnostics/i }).first();
    if (await runAiBtn.isVisible()) {
      await runAiBtn.click();
      await page.waitForTimeout(2500);
    }

    await expect(page.getByText(/Engine 1: IsolationForest/i).or(page.getByText(/Anomaly Outlier/i)).first()).toBeVisible({ timeout: 10000 });
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
});
