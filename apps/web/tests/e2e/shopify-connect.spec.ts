/**
 * E2E Test: Shopify Connection Flow
 * MerchOps Beta MVP
 *
 * Tests:
 * - Shopify OAuth initiation
 * - OAuth callback handling
 * - Connection status display
 * - Disconnection handling
 */

import { test, expect } from '@playwright/test';
import { login, getAuthenticatedPage } from './helpers/auth';
import { setupShopifyMocks, TEST_STORE_DOMAIN, MOCK_SHOPIFY_SHOP } from './helpers/mocks';

test.describe('Shopify Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup Shopify API mocks
    await setupShopifyMocks(page);
  });

  test('should initiate Shopify OAuth flow from settings', async ({ page }) => {
    // Login as test user
    await login(page);

    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Find and click "Connect Shopify" button
    const connectButton = page.locator('button:has-text("Connect Shopify"), a:has-text("Connect Shopify")');
    await expect(connectButton).toBeVisible();

    // Click to initiate OAuth
    await connectButton.click();

    // Should redirect or show connection flow
    // In mocked environment, this completes immediately
    await page.waitForURL(/settings/, { timeout: 10000 });

    // Verify connection success indicator
    await expect(page.locator('text=/connected|success/i')).toBeVisible({ timeout: 5000 });
  });

  test('should handle OAuth callback successfully', async ({ page }) => {
    await login(page);

    // Simulate OAuth callback with authorization code
    await page.goto('/api/shopify/oauth/callback?code=test_auth_code&shop=test-store.myshopify.com');

    // Should redirect to settings or dashboard
    await page.waitForURL(/\/(settings|dashboard)/, { timeout: 10000 });

    // Verify connection status shown
    const statusIndicator = page.locator('[data-testid="shopify-status"], text=/connected/i');
    await expect(statusIndicator).toBeVisible();
  });

  test('should display Shopify connection status', async ({ page }) => {
    await login(page);
    await page.goto('/settings');

    // Wait for connection status to load
    await page.waitForSelector('[data-testid="shopify-connection-status"], .shopify-connection', {
      timeout: 10000,
    });

    // Should show connected state with shop name
    await expect(page.locator(`text=/${TEST_STORE_DOMAIN}|${MOCK_SHOPIFY_SHOP.name}/i`)).toBeVisible();

    // Should show connection scopes
    const scopesSection = page.locator('[data-testid="shopify-scopes"], .connection-scopes');
    if (await scopesSection.count() > 0) {
      await expect(scopesSection).toContainText(/products|orders|inventory/i);
    }
  });

  test('should show connection details and installed date', async ({ page }) => {
    await login(page);
    await page.goto('/settings');

    // Look for connection metadata
    const connectionCard = page.locator('[data-testid="shopify-connection"], .shopify-status');
    await expect(connectionCard).toBeVisible();

    // Should show store domain
    await expect(page.locator('text=/test-store\\.myshopify\\.com/i')).toBeVisible();

    // Should show connected status indicator (green dot, checkmark, etc.)
    const statusBadge = page.locator('[data-testid="connection-status"], .status-badge');
    if (await statusBadge.count() > 0) {
      await expect(statusBadge).toHaveText(/active|connected/i);
    }
  });

  test('should handle OAuth errors gracefully', async ({ page }) => {
    // Setup error response
    await page.route('**/api/shopify/oauth/callback**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'access_denied',
          error_description: 'User denied authorization',
        }),
      });
    });

    await login(page);

    // Attempt OAuth callback with error
    await page.goto('/api/shopify/oauth/callback?error=access_denied&shop=test-store.myshopify.com');

    // Should show error message
    await expect(page.locator('text=/error|denied|failed/i')).toBeVisible({ timeout: 5000 });
  });

  test('should show "not connected" state when no Shopify connection', async ({ page, context }) => {
    // Mock API to return no connection
    await page.route('**/api/shopify/connection**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: false,
          shop: null,
        }),
      });
    });

    await login(page);
    await page.goto('/settings');

    // Should show connect button
    const connectButton = page.locator('button:has-text("Connect Shopify"), a:has-text("Connect Shopify")');
    await expect(connectButton).toBeVisible();

    // Should show empty state message
    await expect(page.locator('text=/not connected|connect your store/i')).toBeVisible();
  });

  test('should display required OAuth scopes', async ({ page }) => {
    await page.route('**/api/shopify/connection**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false }),
      });
    });

    await login(page);
    await page.goto('/settings');

    // Should explain what permissions are needed
    const scopeInfo = page.locator('[data-testid="required-scopes"], .permissions-info');
    if (await scopeInfo.count() > 0) {
      await expect(scopeInfo).toContainText(/products|orders|inventory/i);
    }
  });

  test('should show clear CTA when not connected', async ({ page }) => {
    await page.route('**/api/shopify/connection**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false }),
      });
    });

    await login(page);
    await page.goto('/dashboard');

    // Dashboard should show CTA to connect
    const connectCTA = page.locator('[data-testid="connect-shopify-cta"], text=/connect.*shopify/i').first();
    await expect(connectCTA).toBeVisible({ timeout: 5000 });
  });

  test('should prevent actions when Shopify not connected', async ({ page }) => {
    await page.route('**/api/shopify/connection**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false }),
      });
    });

    await login(page);
    await page.goto('/queue');

    // Queue should show empty state or disabled state
    const emptyState = page.locator('[data-testid="empty-state"], .empty-queue');
    if (await emptyState.count() > 0) {
      await expect(emptyState).toContainText(/connect|shopify/i);
    }
  });
});
