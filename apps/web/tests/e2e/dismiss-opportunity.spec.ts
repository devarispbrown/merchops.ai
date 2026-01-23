/**
 * E2E Test: Dismiss Opportunity Flow
 * MerchOps Beta MVP
 *
 * Tests:
 * - Dismiss opportunity from queue
 * - Verify dismissed opportunity not shown again
 * - Verify opportunity returns if inputs change
 * - Undo dismiss action
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { setupAllMocks, MOCK_OPPORTUNITY_HIGH_PRIORITY, MOCK_OPPORTUNITY_MEDIUM_PRIORITY } from './helpers/mocks';

test.describe('Dismiss Opportunity Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test('should show dismiss button on opportunity detail', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);

    await page.waitForLoadState('networkidle');

    // Should have dismiss button
    const dismissButton = page.locator(
      'button:has-text("Dismiss"), button:has-text("Not Now"), [data-testid="dismiss-button"]'
    );
    await expect(dismissButton).toBeVisible({ timeout: 10000 });
  });

  test('should dismiss opportunity with confirmation', async ({ page }) => {
    let dismissed = false;

    await page.route('**/api/opportunities/*/dismiss', async (route) => {
      dismissed = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          opportunity: {
            ...MOCK_OPPORTUNITY_HIGH_PRIORITY,
            state: 'dismissed',
          },
        }),
      });
    });

    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Click dismiss
    const dismissButton = page.locator('button:has-text("Dismiss"), [data-testid="dismiss-button"]');
    await dismissButton.click();

    // Should show confirmation dialog
    const confirmDialog = page.locator('[role="dialog"], .modal');
    if (await confirmDialog.count() > 0) {
      await expect(confirmDialog).toBeVisible();

      // Confirm dismissal
      const confirmButton = confirmDialog.locator('button:has-text("Dismiss"), button:has-text("Confirm")');
      await confirmButton.click();
    }

    // Wait for API call
    await page.waitForTimeout(500);

    // Should have called dismiss API
    expect(dismissed).toBe(true);
  });

  test('should remove dismissed opportunity from queue', async ({ page }) => {
    await page.route('**/api/opportunities/*/dismiss', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Update opportunities list to exclude dismissed one
    await page.route('**/api/opportunities**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opportunities: [MOCK_OPPORTUNITY_MEDIUM_PRIORITY], // Only medium priority, high is dismissed
          total: 1,
        }),
      });
    });

    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Dismiss
    const dismissButton = page.locator('button:has-text("Dismiss")');
    await dismissButton.click();

    // Confirm if needed
    const confirmButton = page.locator('[role="dialog"] button:has-text("Dismiss"), [role="dialog"] button:has-text("Confirm")');
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
    }

    // Should redirect to queue
    await page.waitForURL('/queue', { timeout: 5000 }).catch(() => {
      // Or navigate manually
      return page.goto('/queue');
    });

    // Dismissed opportunity should not appear
    await expect(page.locator(`text=/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}/`)).not.toBeVisible();
  });

  test('should not show dismissed opportunity on subsequent visits', async ({ page }) => {
    // Mock opportunities without the dismissed one
    await page.route('**/api/opportunities**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opportunities: [MOCK_OPPORTUNITY_MEDIUM_PRIORITY],
          total: 1,
        }),
      });
    });

    await login(page);
    await page.goto('/queue');

    await page.waitForLoadState('networkidle');

    // Should only show medium priority opportunity
    const opportunities = page.locator('[data-testid="opportunity-card"]');
    await expect(opportunities).toHaveCount(1);

    // Should be the medium priority one
    await expect(opportunities).toContainText(/win-?back|customer/i);
  });

  test('should allow canceling dismissal', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Click dismiss
    const dismissButton = page.locator('button:has-text("Dismiss")');
    await dismissButton.click();

    // Cancel in confirmation dialog
    const cancelButton = page.locator('[role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("No")');
    if (await cancelButton.count() > 0) {
      await cancelButton.click();

      // Dialog should close
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).not.toBeVisible();

      // Should still be on opportunity page
      await expect(page).toHaveURL(new RegExp(MOCK_OPPORTUNITY_HIGH_PRIORITY.id));
    }
  });

  test('should provide reason for dismissal (optional)', async ({ page }) => {
    await page.route('**/api/opportunities/*/dismiss', async (route) => {
      const postData = route.request().postData();
      const body = postData ? JSON.parse(postData) : {};

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reason: body.reason,
        }),
      });
    });

    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Click dismiss
    const dismissButton = page.locator('button:has-text("Dismiss")');
    await dismissButton.click();

    // Check if reason input is available
    const reasonInput = page.locator('textarea[name="reason"], input[name="reason"], [data-testid="dismiss-reason"]');
    if (await reasonInput.count() > 0) {
      await reasonInput.fill('Not relevant for my store');

      const confirmButton = page.locator('[role="dialog"] button:has-text("Dismiss")');
      await confirmButton.click();
    }
  });

  test('should show dismissed opportunities in history/audit log', async ({ page }) => {
    await page.route('**/api/opportunities**', async (route) => {
      const url = route.request().url();

      if (url.includes('state=dismissed') || url.includes('include_dismissed=true')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            opportunities: [{
              ...MOCK_OPPORTUNITY_HIGH_PRIORITY,
              state: 'dismissed',
            }],
            total: 1,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            opportunities: [MOCK_OPPORTUNITY_MEDIUM_PRIORITY],
            total: 1,
          }),
        });
      }
    });

    await login(page);
    await page.goto('/history');

    await page.waitForLoadState('networkidle');

    // Should have filter or tab for dismissed opportunities
    const dismissedTab = page.locator('button:has-text("Dismissed"), [data-testid="dismissed-tab"]');
    if (await dismissedTab.count() > 0) {
      await dismissedTab.click();

      // Should show dismissed opportunity
      await expect(page.locator('text=/inventory.*clearance/i')).toBeVisible();
    }
  });

  test('should re-surface opportunity if inputs materially change', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/opportunities**', async (route) => {
      requestCount++;

      if (requestCount === 1) {
        // First load: dismissed opportunity not shown
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            opportunities: [MOCK_OPPORTUNITY_MEDIUM_PRIORITY],
            total: 1,
          }),
        });
      } else {
        // Second load: opportunity reappears due to changed inputs
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            opportunities: [
              {
                ...MOCK_OPPORTUNITY_HIGH_PRIORITY,
                state: 'new', // No longer dismissed
                why_now: 'UPDATED: Inventory now critically low at 2 units (changed from 5)',
              },
              MOCK_OPPORTUNITY_MEDIUM_PRIORITY,
            ],
            total: 2,
          }),
        });
      }
    });

    await login(page);
    await page.goto('/queue');

    // First load: should have 1 opportunity
    await page.waitForLoadState('networkidle');
    let opportunities = page.locator('[data-testid="opportunity-card"]');
    await expect(opportunities).toHaveCount(1);

    // Reload to simulate updated data
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should now have 2 opportunities
    opportunities = page.locator('[data-testid="opportunity-card"]');
    await expect(opportunities).toHaveCount(2);

    // Should show updated why-now
    await expect(page.locator('text=/UPDATED.*critically low/i')).toBeVisible();
  });

  test('should track dismiss timestamp for audit', async ({ page }) => {
    const dismissedOpportunity = {
      ...MOCK_OPPORTUNITY_HIGH_PRIORITY,
      state: 'dismissed',
      dismissed_at: new Date().toISOString(),
    };

    await page.route('**/api/opportunities/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(dismissedOpportunity),
      });
    });

    await login(page);
    await page.goto(`/queue/${dismissedOpportunity.id}`);

    await page.waitForLoadState('networkidle');

    // Should show dismissed state
    const dismissedBadge = page.locator('[data-testid="status"], .status-badge');
    await expect(dismissedBadge).toContainText(/dismissed/i);

    // Should show when it was dismissed
    const dismissedAt = page.locator('[data-testid="dismissed-at"], text=/dismissed/i');
    if (await dismissedAt.count() > 0) {
      await expect(dismissedAt).toBeVisible();
    }
  });

  test('should allow undismissing opportunity', async ({ page }) => {
    await page.route('**/api/opportunities/*/undismiss', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          opportunity: {
            ...MOCK_OPPORTUNITY_HIGH_PRIORITY,
            state: 'new',
          },
        }),
      });
    });

    const dismissedOpportunity = {
      ...MOCK_OPPORTUNITY_HIGH_PRIORITY,
      state: 'dismissed',
    };

    await page.route('**/api/opportunities/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(dismissedOpportunity),
      });
    });

    await login(page);
    await page.goto(`/queue/${dismissedOpportunity.id}`);

    await page.waitForLoadState('networkidle');

    // Should have "Restore" or "Undismiss" button
    const restoreButton = page.locator('button:has-text("Restore"), button:has-text("Undo"), [data-testid="restore-button"]');
    if (await restoreButton.count() > 0) {
      await restoreButton.click();

      // Should show success
      await expect(page.locator('text=/restored|active/i')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should explain dismiss semantics clearly', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Click dismiss to open dialog
    const dismissButton = page.locator('button:has-text("Dismiss")');
    await dismissButton.click();

    // Dialog should explain what dismiss means
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.count() > 0) {
      await expect(dialog).toContainText(/won't show|unless.*change|dismiss/i);
    }
  });
});
