/**
 * E2E Smoke Tests
 * MerchOps Beta MVP - Basic connectivity and page load tests
 *
 * These tests verify the app is running and basic pages load.
 * More comprehensive E2E tests are skipped until features are fully implemented.
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page loads', async ({ page }) => {
    const response = await page.goto('/login');
    // Accept any 2xx or 3xx response (redirects are OK)
    expect(response?.status()).toBeLessThan(400);
  });

  test('signup page loads', async ({ page }) => {
    const response = await page.goto('/signup');
    expect(response?.status()).toBeLessThan(400);
  });

  test('API health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');
    // Accept 200 or 503 (both are valid health check responses)
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    // Just verify we get a status field back
    expect(body).toHaveProperty('status');
  });
});

test.describe('Landing Page Smoke Tests', () => {
  test('landing page loads with correct hero copy', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);

    // Verify exact Magic Patterns hero copy in the h1 heading
    await expect(page.getByRole('heading', { name: /Campaigns ready to send.*Not another dashboard/i })).toBeVisible();
  });

  test('landing page has MerchOps.ai logo', async ({ page }) => {
    await page.goto('/');
    // Select the nav logo specifically
    await expect(page.getByRole('navigation').getByText('MerchOps.ai')).toBeVisible();
  });

  test('hero Join the beta CTA navigates to signup', async ({ page }) => {
    await page.goto('/');
    // Click the hero CTA button
    await page.click('button:has-text("Join the beta")');
    // Verify navigation to signup with returnTo param
    await expect(page).toHaveURL(/\/signup.*returnTo/);
  });

  test('nav Join the beta CTA navigates to signup', async ({ page }) => {
    await page.goto('/');
    // Click the nav button (first Join the beta in nav)
    const navButton = page.locator('nav button:has-text("Join the beta")');
    await navButton.click();
    await expect(page).toHaveURL(/\/signup.*returnTo/);
  });

  test('pricing Start free trial CTA navigates to signup', async ({ page }) => {
    await page.goto('/');
    // Scroll to pricing section
    await page.evaluate(() => {
      document.getElementById('pricing')?.scrollIntoView();
    });
    // Click first pricing CTA
    const pricingCta = page.locator('#pricing a:has-text("Start free trial")').first();
    await pricingCta.click();
    await expect(page).toHaveURL(/\/signup.*returnTo/);
  });

  test('final CTA navigates to signup', async ({ page }) => {
    await page.goto('/');
    // Scroll to CTA section
    await page.evaluate(() => {
      document.getElementById('cta')?.scrollIntoView();
    });
    // Click the final CTA button
    await page.click('#cta button:has-text("Start your free trial")');
    await expect(page).toHaveURL(/\/signup.*returnTo/);
  });
});
