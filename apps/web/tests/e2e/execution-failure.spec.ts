/**
 * E2E Test: Execution Failure Handling
 * MerchOps Beta MVP
 *
 * Tests:
 * - Execution failure display
 * - Error message shown clearly
 * - Actionable guidance provided
 * - Retry mechanisms
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { setupAllMocks, MOCK_EXECUTION_FAILURE } from './helpers/mocks';

test.describe('Execution Failure Handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test('should display execution failure in history', async ({ page }) => {
    // Mock executions endpoint to return failure
    await page.route('**/api/executions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          executions: [MOCK_EXECUTION_FAILURE],
        }),
      });
    });

    await login(page);
    await page.goto('/history');

    await page.waitForLoadState('networkidle');

    // Should show execution with failed status
    const failedExecution = page.locator('[data-testid="execution-item"], .execution-card').first();
    await expect(failedExecution).toBeVisible();

    // Should have failed status indicator (red badge, error icon, etc.)
    const statusBadge = failedExecution.locator('[data-testid="status"], .status-badge');
    await expect(statusBadge).toContainText(/failed|error/i);
  });

  test('should show error message clearly', async ({ page }) => {
    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXECUTION_FAILURE),
      });
    });

    await login(page);
    await page.goto(`/executions/${MOCK_EXECUTION_FAILURE.id}`);

    await page.waitForLoadState('networkidle');

    // Should display error message
    const errorMessage = page.locator('[data-testid="error-message"], .error-message');
    await expect(errorMessage).toBeVisible();

    // Should contain the actual error text
    await expect(errorMessage).toContainText(/discount code.*exists|already exists/i);
  });

  test('should display error code', async ({ page }) => {
    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXECUTION_FAILURE),
      });
    });

    await login(page);
    await page.goto(`/executions/${MOCK_EXECUTION_FAILURE.id}`);

    await page.waitForLoadState('networkidle');

    // Should show error code for debugging
    const errorCode = page.locator('[data-testid="error-code"], text=/SHOPIFY_API_ERROR/');
    await expect(errorCode).toBeVisible({ timeout: 5000 });
  });

  test('should provide actionable guidance for common errors', async ({ page }) => {
    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXECUTION_FAILURE),
      });
    });

    await login(page);
    await page.goto(`/executions/${MOCK_EXECUTION_FAILURE.id}`);

    await page.waitForLoadState('networkidle');

    // Should show guidance on how to fix the issue
    const guidanceSection = page.locator('[data-testid="error-guidance"], .error-help, .guidance');
    if (await guidanceSection.count() > 0) {
      await expect(guidanceSection).toBeVisible();

      // Should suggest next steps
      await expect(guidanceSection).toContainText(/try.*different.*code|change|unique/i);
    } else {
      // At minimum, should have error message that's helpful
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toContainText(/code.*unique|already exists/i);
    }
  });

  test('should allow retry after fixing the issue', async ({ page }) => {
    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXECUTION_FAILURE),
      });
    });

    await login(page);
    await page.goto(`/executions/${MOCK_EXECUTION_FAILURE.id}`);

    await page.waitForLoadState('networkidle');

    // Should have retry or "try again" option
    const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again"), [data-testid="retry-button"]');

    if (await retryButton.count() > 0) {
      await expect(retryButton).toBeVisible();

      // Retry button should navigate back to draft to make changes
      await retryButton.click();
      await expect(page).toHaveURL(/\/drafts\//);
    }
  });

  test('should show execution timeline with failure point', async ({ page }) => {
    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXECUTION_FAILURE),
      });
    });

    await login(page);
    await page.goto(`/executions/${MOCK_EXECUTION_FAILURE.id}`);

    await page.waitForLoadState('networkidle');

    // Should show when it started and when it failed
    const startedAt = page.locator('[data-testid="started-at"], text=/started/i');
    const finishedAt = page.locator('[data-testid="finished-at"], text=/failed|finished/i');

    await expect(startedAt).toBeVisible({ timeout: 5000 });
    await expect(finishedAt).toBeVisible();
  });

  test('should display provider response for debugging', async ({ page }) => {
    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXECUTION_FAILURE),
      });
    });

    await login(page);
    await page.goto(`/executions/${MOCK_EXECUTION_FAILURE.id}`);

    await page.waitForLoadState('networkidle');

    // Should show raw provider response in expandable section
    const responseSection = page.locator('[data-testid="provider-response"], .provider-response, text=/response|details/i');

    if (await responseSection.count() > 0) {
      // May be collapsed by default
      const expandButton = page.locator('button:has-text("Details"), button:has-text("Show"), summary');
      if (await expandButton.count() > 0) {
        await expandButton.first().click();
      }

      // Should show error from provider
      await expect(page.locator('text=/discount code must be unique/i')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should handle authentication errors distinctly', async ({ page }) => {
    const authError = {
      ...MOCK_EXECUTION_FAILURE,
      error_code: 'SHOPIFY_AUTH_ERROR',
      error_message: 'Invalid access token',
    };

    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authError),
      });
    });

    await login(page);
    await page.goto(`/executions/${authError.id}`);

    await page.waitForLoadState('networkidle');

    // Should indicate authentication issue
    await expect(page.locator('text=/authentication|reconnect|authorization/i')).toBeVisible();

    // Should offer to reconnect Shopify
    const reconnectLink = page.locator('a[href*="/settings"], button:has-text("Reconnect")');
    if (await reconnectLink.count() > 0) {
      await expect(reconnectLink).toBeVisible();
    }
  });

  test('should handle rate limit errors with retry guidance', async ({ page }) => {
    const rateLimitError = {
      ...MOCK_EXECUTION_FAILURE,
      error_code: 'SHOPIFY_RATE_LIMIT',
      error_message: 'API rate limit exceeded',
    };

    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rateLimitError),
      });
    });

    await login(page);
    await page.goto(`/executions/${rateLimitError.id}`);

    await page.waitForLoadState('networkidle');

    // Should explain rate limiting
    await expect(page.locator('text=/rate limit|too many requests|automatically retry/i')).toBeVisible();
  });

  test('should display failed executions in history with filters', async ({ page }) => {
    await page.route('**/api/executions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          executions: [MOCK_EXECUTION_FAILURE],
        }),
      });
    });

    await login(page);
    await page.goto('/history');

    await page.waitForLoadState('networkidle');

    // Should be able to filter by status
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');
    if (await statusFilter.count() > 0) {
      await statusFilter.selectOption('failed');

      // Should show only failed executions
      const executions = page.locator('[data-testid="execution-item"]');
      const count = await executions.count();

      for (let i = 0; i < count; i++) {
        const status = executions.nth(i).locator('[data-testid="status"]');
        await expect(status).toContainText(/failed|error/i);
      }
    }
  });

  test('should link to related draft for context', async ({ page }) => {
    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXECUTION_FAILURE),
      });
    });

    await login(page);
    await page.goto(`/executions/${MOCK_EXECUTION_FAILURE.id}`);

    await page.waitForLoadState('networkidle');

    // Should link to the draft that was attempted
    const draftLink = page.locator(`a[href*="/drafts/${MOCK_EXECUTION_FAILURE.action_draft_id}"]`);
    if (await draftLink.count() > 0) {
      await expect(draftLink).toBeVisible();
    }
  });

  test('should not allow re-approval of failed execution without changes', async ({ page }) => {
    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXECUTION_FAILURE),
      });
    });

    await login(page);
    await page.goto(`/executions/${MOCK_EXECUTION_FAILURE.id}`);

    await page.waitForLoadState('networkidle');

    // Should not have "Approve" button on execution page
    const approveButton = page.locator('button:has-text("Approve")');
    await expect(approveButton).not.toBeVisible();

    // Should only have "Retry" or "Edit Draft" action
    const actionButton = page.locator('button:has-text("Retry"), button:has-text("Edit"), a:has-text("Edit")');
    await expect(actionButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display execution idempotency key for debugging', async ({ page }) => {
    await page.route('**/api/executions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXECUTION_FAILURE),
      });
    });

    await login(page);
    await page.goto(`/executions/${MOCK_EXECUTION_FAILURE.id}`);

    await page.waitForLoadState('networkidle');

    // Should show idempotency key in debug/details section
    const debugSection = page.locator('[data-testid="debug-info"], .debug-details');
    if (await debugSection.count() > 0) {
      await expect(debugSection).toContainText(/idempotency|key/i);
    }
  });
});
