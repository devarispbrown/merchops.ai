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
