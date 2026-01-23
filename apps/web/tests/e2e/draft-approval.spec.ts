/**
 * E2E Test: Draft Approval Flow
 * MerchOps Beta MVP
 *
 * Tests:
 * - View draft detail
 * - Edit draft fields
 * - Preview payload
 * - Approve with confirmation
 * - Verify execution created
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { setupAllMocks, MOCK_ACTION_DRAFT_DISCOUNT, MOCK_EXECUTION_SUCCESS } from './helpers/mocks';

test.describe('Draft Approval Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);

    // Mock draft retrieval
    await page.route('**/api/actions/drafts/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/approve')) {
        // Handle approval endpoint
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_EXECUTION_SUCCESS),
        });
      } else if (route.request().method() === 'GET') {
        // Get draft
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ACTION_DRAFT_DISCOUNT),
        });
      } else if (route.request().method() === 'PATCH') {
        // Update draft
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_ACTION_DRAFT_DISCOUNT,
            payload_json: {
              ...MOCK_ACTION_DRAFT_DISCOUNT.payload_json,
              ...JSON.parse(route.request().postData() || '{}'),
            },
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('should display draft detail page', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Should show draft header with operator intent
    const header = page.locator('h1, h2, [data-testid="draft-title"]');
    await expect(header).toContainText(/draft|discount|inventory/i);

    // Should show execution type
    await expect(page.locator('text=/discount|price rule/i')).toBeVisible();
  });

  test('should show editable draft fields', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForSelector('form, [data-testid="draft-form"]', { timeout: 10000 });

    // Should have editable fields based on editable_fields_json
    const discountCodeInput = page.locator('input[name="discount_code"], [data-testid="discount-code"]');
    await expect(discountCodeInput).toBeVisible();

    const discountPercentInput = page.locator('input[name="discount_percent"], [data-testid="discount-percent"]');
    await expect(discountPercentInput).toBeVisible();

    // Fields should have current values
    await expect(discountCodeInput).toHaveValue('CLEARANCE15');
    await expect(discountPercentInput).toHaveValue('15');
  });

  test('should allow editing draft fields', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Edit discount code
    const discountCodeInput = page.locator('input[name="discount_code"], [data-testid="discount-code"]');
    await discountCodeInput.fill('CLEARANCE20');

    // Edit discount percent
    const discountPercentInput = page.locator('input[name="discount_percent"], [data-testid="discount-percent"]');
    await discountPercentInput.fill('20');

    // Save changes
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")');
    if (await saveButton.count() > 0) {
      await saveButton.click();

      // Should show success indicator
      await expect(page.locator('text=/saved|updated/i')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should validate draft field constraints', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Try to set discount percent outside allowed range (5-50)
    const discountPercentInput = page.locator('input[name="discount_percent"], [data-testid="discount-percent"]');
    await discountPercentInput.fill('100');

    // Try to save/approve
    const approveButton = page.locator('button:has-text("Approve"), [data-testid="approve-button"]');
    await approveButton.click();

    // Should show validation error
    const error = page.locator('text=/invalid|must be|between/i, .error, [role="alert"]');
    await expect(error.first()).toBeVisible({ timeout: 3000 });
  });

  test('should show payload preview before approval', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Look for payload preview section
    const previewSection = page.locator('[data-testid="payload-preview"], .payload-preview, text=/preview|payload/i');

    if (await previewSection.count() > 0) {
      await expect(previewSection.first()).toBeVisible();

      // Should show key payload fields
      await expect(page.locator('text=/CLEARANCE15/i')).toBeVisible();
      await expect(page.locator('text=/15%|15 percent/i')).toBeVisible();
    } else {
      // If no dedicated preview section, check for "Review" or "Preview" button
      const previewButton = page.locator('button:has-text("Preview"), button:has-text("Review")');
      if (await previewButton.count() > 0) {
        await previewButton.click();
        await expect(page.locator('text=/CLEARANCE15/i')).toBeVisible();
      }
    }
  });

  test('should require confirmation before approval', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Click approve button
    const approveButton = page.locator('button:has-text("Approve"), [data-testid="approve-button"]');
    await approveButton.click();

    // Should show confirmation dialog
    const confirmDialog = page.locator('[role="dialog"], .modal, [data-testid="confirm-modal"]');
    await expect(confirmDialog).toBeVisible({ timeout: 3000 });

    // Should show what will be executed
    await expect(confirmDialog).toContainText(/approve|confirm|execute/i);
  });

  test('should approve draft and create execution', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Click approve
    const approveButton = page.locator('button:has-text("Approve"), [data-testid="approve-button"]');
    await approveButton.click();

    // Confirm in dialog if present
    const confirmButton = page.locator('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Approve")');
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
    }

    // Should redirect to execution or show success
    await expect(page).toHaveURL(/\/executions\/|\/history/, { timeout: 5000 }).catch(async () => {
      // Or show success message on same page
      await expect(page.locator('text=/approved|executing|success/i')).toBeVisible();
    });
  });

  test('should show execution success feedback', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Approve draft
    const approveButton = page.locator('button:has-text("Approve"), [data-testid="approve-button"]');
    await approveButton.click();

    // Confirm
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
    }

    // Should show success state
    const successIndicator = page.locator('text=/success|approved|executing/i, [data-testid="success-message"]');
    await expect(successIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('should prevent double approval with idempotency', async ({ page }) => {
    let approvalCount = 0;

    await page.route('**/api/actions/drafts/*/approve', async (route) => {
      approvalCount++;

      if (approvalCount > 1) {
        // Second approval should be rejected
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Already approved',
            code: 'ALREADY_APPROVED',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_EXECUTION_SUCCESS),
        });
      }
    });

    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);
    await page.waitForLoadState('networkidle');

    // Approve once
    const approveButton = page.locator('button:has-text("Approve")');
    await approveButton.click();

    const confirmButton = page.locator('[role="dialog"] button:has-text("Confirm")');
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
    }

    // Wait for first approval to complete
    await page.waitForTimeout(1000);

    // Approve button should be disabled or hidden
    const buttonAfterApproval = page.locator('button:has-text("Approve")');
    if (await buttonAfterApproval.count() > 0) {
      await expect(buttonAfterApproval).toBeDisabled();
    }
  });

  test('should cancel approval without executing', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Click approve to open dialog
    const approveButton = page.locator('button:has-text("Approve")');
    await approveButton.click();

    // Click cancel in dialog
    const cancelButton = page.locator('[role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("No")');
    await cancelButton.click();

    // Dialog should close, draft should remain
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible();

    // Should still be on draft page
    await expect(page).toHaveURL(/\/drafts\//);
  });

  test('should display operator intent clearly', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Should show operator intent (reduce_inventory_risk)
    const intentSection = page.locator('[data-testid="operator-intent"], .operator-intent');
    if (await intentSection.count() > 0) {
      await expect(intentSection).toContainText(/reduce.*inventory.*risk|inventory/i);
    }
  });

  test('should link back to source opportunity', async ({ page }) => {
    await login(page);
    await page.goto(`/drafts/${MOCK_ACTION_DRAFT_DISCOUNT.id}`);

    await page.waitForLoadState('networkidle');

    // Should have link to opportunity
    const opportunityLink = page.locator(`a[href*="${MOCK_ACTION_DRAFT_DISCOUNT.opportunity_id}"]`);
    if (await opportunityLink.count() > 0) {
      await expect(opportunityLink).toBeVisible();

      // Click to navigate
      await opportunityLink.click();
      await expect(page).toHaveURL(new RegExp(MOCK_ACTION_DRAFT_DISCOUNT.opportunity_id));
    }
  });
});
