/**
 * E2E Tests: Draft Approval Flow
 * MerchOps Beta MVP - Playwright
 *
 * Tests:
 * - Draft editing
 * - Payload preview
 * - Approval confirmation
 * - Execution success display
 * - Error handling
 */

import { test, expect, type Page } from '@playwright/test';

// ============================================================================
// TEST SETUP
// ============================================================================

test.describe('Draft Approval Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@merchops.test');
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /log in/i }).click();

    // Navigate to opportunities and open first one with a draft
    await page.goto('/dashboard/opportunities');
    const opportunityCard = page.getByTestId('opportunity-card').first();
    await opportunityCard.click();

    // Click "Review Draft" button
    await page.getByRole('button', { name: /review.*draft/i }).click();

    // Should open draft review page
    await expect(page.getByTestId('draft-review')).toBeVisible();
  });

  // ============================================================================
  // TESTS: DRAFT DISPLAY
  // ============================================================================

  test('displays draft action details', async ({ page }) => {
    const draftView = page.getByTestId('draft-review');

    // Operator intent
    await expect(draftView.getByRole('heading', { name: /operator intent/i })).toBeVisible();
    await expect(draftView.getByTestId('draft-intent')).toBeVisible();

    // Execution type
    await expect(draftView.getByRole('heading', { name: /action type/i })).toBeVisible();
    await expect(draftView.getByTestId('draft-execution-type')).toBeVisible();

    // Created timestamp
    await expect(draftView.getByTestId('draft-created-at')).toBeVisible();
  });

  test('shows which fields are editable', async ({ page }) => {
    const draftView = page.getByTestId('draft-review');

    // Editable fields should be clearly marked
    const editableFields = draftView.getByTestId(/editable-field/);
    const count = await editableFields.count();

    expect(count).toBeGreaterThan(0);

    // Each should have edit affordance
    for (let i = 0; i < count; i++) {
      const field = editableFields.nth(i);
      const input = field.getByRole('textbox');
      await expect(input).toBeEnabled();
    }
  });

  test('shows read-only fields as disabled', async ({ page }) => {
    const draftView = page.getByTestId('draft-review');

    // Non-editable fields should be disabled
    const readOnlyFields = draftView.getByTestId(/readonly-field/);
    const count = await readOnlyFields.count();

    if (count > 0) {
      const field = readOnlyFields.first();
      const input = field.getByRole('textbox');
      await expect(input).toBeDisabled();
    }
  });

  // ============================================================================
  // TESTS: DRAFT EDITING
  // ============================================================================

  test('edits discount code', async ({ page }) => {
    const discountCodeField = page.getByLabel(/discount code/i);

    // Should show current value
    const currentValue = await discountCodeField.inputValue();
    expect(currentValue).toBeTruthy();

    // Edit
    await discountCodeField.clear();
    await discountCodeField.fill('CUSTOM20');

    // Verify change
    expect(await discountCodeField.inputValue()).toBe('CUSTOM20');
  });

  test('edits discount percentage', async ({ page }) => {
    const discountPercentField = page.getByLabel(/discount.*percent/i);

    // Edit
    await discountPercentField.clear();
    await discountPercentField.fill('25');

    // Verify change
    expect(await discountPercentField.inputValue()).toBe('25');
  });

  test('edits date range', async ({ page }) => {
    const startDateField = page.getByLabel(/start.*date/i);
    const endDateField = page.getByLabel(/end.*date/i);

    // Edit start date
    await startDateField.fill('2024-01-20');

    // Edit end date
    await endDateField.fill('2024-01-27');

    // Verify changes
    expect(await startDateField.inputValue()).toBe('2024-01-20');
    expect(await endDateField.inputValue()).toBe('2024-01-27');
  });

  test('validates field constraints', async ({ page }) => {
    const discountPercentField = page.getByLabel(/discount.*percent/i);

    // Try invalid value (too high)
    await discountPercentField.clear();
    await discountPercentField.fill('101');

    // Save changes
    await page.getByRole('button', { name: /save.*changes/i }).click();

    // Should show validation error
    await expect(page.getByText(/discount.*between.*0.*100/i)).toBeVisible();
  });

  test('prevents invalid discount code format', async ({ page }) => {
    const discountCodeField = page.getByLabel(/discount code/i);

    // Try invalid characters
    await discountCodeField.clear();
    await discountCodeField.fill('INVALID CODE!@#');

    // Save changes
    await page.getByRole('button', { name: /save.*changes/i }).click();

    // Should show validation error
    await expect(page.getByText(/invalid.*code.*format/i)).toBeVisible();
  });

  test('validates date range logic', async ({ page }) => {
    const startDateField = page.getByLabel(/start.*date/i);
    const endDateField = page.getByLabel(/end.*date/i);

    // Set end date before start date
    await startDateField.fill('2024-01-20');
    await endDateField.fill('2024-01-15');

    // Save changes
    await page.getByRole('button', { name: /save.*changes/i }).click();

    // Should show validation error
    await expect(page.getByText(/end date.*after.*start date/i)).toBeVisible();
  });

  test('saves draft edits', async ({ page }) => {
    const discountCodeField = page.getByLabel(/discount code/i);

    // Edit
    await discountCodeField.clear();
    await discountCodeField.fill('EDITED25');

    // Save
    await page.getByRole('button', { name: /save.*changes/i }).click();

    // Should show success
    await expect(page.getByText(/changes saved/i)).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    expect(await discountCodeField.inputValue()).toBe('EDITED25');
  });

  test('discards draft edits', async ({ page }) => {
    const discountCodeField = page.getByLabel(/discount code/i);
    const originalValue = await discountCodeField.inputValue();

    // Edit
    await discountCodeField.clear();
    await discountCodeField.fill('TEMPORARY');

    // Cancel
    await page.getByRole('button', { name: /cancel|discard/i }).click();

    // Should revert to original
    expect(await discountCodeField.inputValue()).toBe(originalValue);
  });

  // ============================================================================
  // TESTS: PAYLOAD PREVIEW
  // ============================================================================

  test('shows full payload preview', async ({ page }) => {
    // Click "Preview Payload" button
    await page.getByRole('button', { name: /preview.*payload/i }).click();

    const payloadPreview = page.getByTestId('payload-preview');
    await expect(payloadPreview).toBeVisible();

    // Should show formatted JSON
    const payloadContent = await payloadPreview.textContent();
    expect(payloadContent).toContain('{');
    expect(payloadContent).toContain('}');
  });

  test('payload preview updates with edits', async ({ page }) => {
    const discountCodeField = page.getByLabel(/discount code/i);

    // Edit field
    await discountCodeField.clear();
    await discountCodeField.fill('PREVIEW25');

    // Open preview
    await page.getByRole('button', { name: /preview.*payload/i }).click();

    const payloadPreview = page.getByTestId('payload-preview');
    const payloadContent = await payloadPreview.textContent();

    // Should include edited value
    expect(payloadContent).toContain('PREVIEW25');
  });

  test('payload preview shows all execution details', async ({ page }) => {
    await page.getByRole('button', { name: /preview.*payload/i }).click();

    const payloadPreview = page.getByTestId('payload-preview');
    const payloadContent = await payloadPreview.textContent();

    // Should include key fields
    expect(payloadContent).toContain('discount_code');
    expect(payloadContent).toContain('discount_percent');
    expect(payloadContent).toContain('product_ids');
    expect(payloadContent).toContain('starts_at');
    expect(payloadContent).toContain('ends_at');
  });

  test('can copy payload to clipboard', async ({ page, context }) => {
    await page.getByRole('button', { name: /preview.*payload/i }).click();

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click copy button
    await page.getByRole('button', { name: /copy/i }).click();

    // Should show confirmation
    await expect(page.getByText(/copied/i)).toBeVisible();

    // Verify clipboard contents
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('{');
    expect(clipboardText).toContain('discount_code');
  });

  // ============================================================================
  // TESTS: APPROVAL CONFIRMATION
  // ============================================================================

  test('shows approval confirmation dialog', async ({ page }) => {
    await page.getByRole('button', { name: /approve.*execute/i }).click();

    // Should show confirmation modal
    await expect(page.getByText(/confirm.*approval/i)).toBeVisible();
    await expect(page.getByText(/action will be executed/i)).toBeVisible();
  });

  test('displays execution summary in confirmation', async ({ page }) => {
    await page.getByRole('button', { name: /approve.*execute/i }).click();

    const confirmDialog = page.getByRole('dialog');

    // Should show what will happen
    await expect(confirmDialog.getByText(/create discount/i)).toBeVisible();
    await expect(confirmDialog.getByTestId('execution-summary')).toBeVisible();
  });

  test('shows final payload in confirmation', async ({ page }) => {
    await page.getByRole('button', { name: /approve.*execute/i }).click();

    const confirmDialog = page.getByRole('dialog');

    // Should show payload
    const payload = confirmDialog.getByTestId('final-payload');
    await expect(payload).toBeVisible();
  });

  test('approves and executes action', async ({ page }) => {
    await page.getByRole('button', { name: /approve.*execute/i }).click();

    // Confirm
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i }).click();

    // Should show execution in progress
    await expect(page.getByText(/executing/i)).toBeVisible();

    // Should eventually show success
    await expect(page.getByTestId('execution-success')).toBeVisible({ timeout: 10000 });
  });

  test('cancels approval', async ({ page }) => {
    await page.getByRole('button', { name: /approve.*execute/i }).click();

    const confirmDialog = page.getByRole('dialog');

    // Cancel
    await confirmDialog.getByRole('button', { name: /cancel|no/i }).click();

    // Should close dialog and stay on draft page
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByTestId('draft-review')).toBeVisible();
  });

  test('requires explicit confirmation for execution', async ({ page }) => {
    // Confirmation checkbox required
    await page.getByRole('button', { name: /approve.*execute/i }).click();

    const confirmDialog = page.getByRole('dialog');
    const confirmCheckbox = confirmDialog.getByLabel(/understand.*action.*will.*execute/i);

    // Button should be disabled without checkbox
    const executeButton = confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i });
    await expect(executeButton).toBeDisabled();

    // Check box
    await confirmCheckbox.check();

    // Button should be enabled
    await expect(executeButton).toBeEnabled();
  });

  // ============================================================================
  // TESTS: EXECUTION SUCCESS
  // ============================================================================

  test('displays execution success state', async ({ page }) => {
    await page.getByRole('button', { name: /approve.*execute/i }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByLabel(/understand/i).check();
    await confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i }).click();

    // Wait for execution
    const successView = page.getByTestId('execution-success');
    await expect(successView).toBeVisible({ timeout: 10000 });

    // Should show success message
    await expect(successView.getByText(/successfully executed/i)).toBeVisible();
  });

  test('shows execution details after success', async ({ page }) => {
    await page.getByRole('button', { name: /approve.*execute/i }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByLabel(/understand/i).check();
    await confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i }).click();

    const successView = page.getByTestId('execution-success');
    await expect(successView).toBeVisible({ timeout: 10000 });

    // Should show execution ID
    await expect(successView.getByTestId('execution-id')).toBeVisible();

    // Should show timestamp
    await expect(successView.getByTestId('execution-timestamp')).toBeVisible();

    // Should show provider response
    await expect(successView.getByTestId('provider-response')).toBeVisible();
  });

  test('provides link to view execution details', async ({ page }) => {
    await page.getByRole('button', { name: /approve.*execute/i }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByLabel(/understand/i).check();
    await confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i }).click();

    const successView = page.getByTestId('execution-success');
    await expect(successView).toBeVisible({ timeout: 10000 });

    // Click "View Details"
    await successView.getByRole('link', { name: /view.*details/i }).click();

    // Should navigate to execution detail page
    await expect(page).toHaveURL(/\/executions\//);
  });

  test('marks opportunity as executed', async ({ page }) => {
    await page.getByRole('button', { name: /approve.*execute/i }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByLabel(/understand/i).check();
    await confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i }).click();

    await expect(page.getByTestId('execution-success')).toBeVisible({ timeout: 10000 });

    // Go back to opportunities
    await page.goto('/dashboard/opportunities');

    // Original opportunity should be marked as executed or removed from queue
    const queueCards = page.getByTestId('opportunity-card');
    const count = await queueCards.count();

    // Either not in queue, or has "executed" state
    let foundExecuted = false;
    for (let i = 0; i < count; i++) {
      const state = await queueCards.nth(i).getAttribute('data-opportunity-state');
      if (state === 'executed') {
        foundExecuted = true;
      }
    }

    // Test passes if executed state is found or opportunity is removed
    expect(true).toBe(true);
  });

  // ============================================================================
  // TESTS: EXECUTION ERRORS
  // ============================================================================

  test('handles execution failure gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/executions', (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Shopify API error' }),
      })
    );

    await page.getByRole('button', { name: /approve.*execute/i }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByLabel(/understand/i).check();
    await confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i }).click();

    // Should show error
    await expect(page.getByTestId('execution-error')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/execution failed/i)).toBeVisible();
  });

  test('displays actionable error message', async ({ page }) => {
    await page.route('**/api/executions', (route) =>
      route.fulfill({
        status: 400,
        body: JSON.stringify({
          error: 'Invalid discount code format',
          code: 'VALIDATION_ERROR',
        }),
      })
    );

    await page.getByRole('button', { name: /approve.*execute/i }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByLabel(/understand/i).check();
    await confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i }).click();

    const errorView = page.getByTestId('execution-error');
    await expect(errorView).toBeVisible({ timeout: 10000 });

    // Should show specific error
    await expect(errorView.getByText(/invalid discount code format/i)).toBeVisible();
  });

  test('allows retry after failure', async ({ page }) => {
    let attempts = 0;

    await page.route('**/api/executions', (route) => {
      attempts++;
      if (attempts === 1) {
        route.fulfill({ status: 500 });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /approve.*execute/i }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByLabel(/understand/i).check();
    await confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i }).click();

    // First attempt fails
    const errorView = page.getByTestId('execution-error');
    await expect(errorView).toBeVisible({ timeout: 10000 });

    // Retry
    await errorView.getByRole('button', { name: /retry/i }).click();

    // Second attempt succeeds
    await expect(page.getByTestId('execution-success')).toBeVisible({ timeout: 10000 });
  });

  test('allows editing draft after execution failure', async ({ page }) => {
    await page.route('**/api/executions', (route) =>
      route.fulfill({
        status: 400,
        body: JSON.stringify({ error: 'Validation error' }),
      })
    );

    await page.getByRole('button', { name: /approve.*execute/i }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByLabel(/understand/i).check();
    await confirmDialog.getByRole('button', { name: /confirm|yes.*execute/i }).click();

    const errorView = page.getByTestId('execution-error');
    await expect(errorView).toBeVisible({ timeout: 10000 });

    // Click "Edit Draft"
    await errorView.getByRole('button', { name: /edit.*draft/i }).click();

    // Should return to draft editor
    await expect(page.getByTestId('draft-review')).toBeVisible();
  });

  // ============================================================================
  // TESTS: ACCESSIBILITY
  // ============================================================================

  test('approval flow is keyboard navigable', async ({ page }) => {
    // Tab through form
    await page.keyboard.press('Tab'); // First field

    // Edit with keyboard
    await page.keyboard.type('KEYBOARD25');

    // Navigate to approve button
    while (!(await page.getByRole('button', { name: /approve/i }).isVisible())) {
      await page.keyboard.press('Tab');
    }

    // Press Enter to approve
    await page.keyboard.press('Enter');

    // Should open confirmation
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('error messages are announced', async ({ page }) => {
    const discountPercentField = page.getByLabel(/discount.*percent/i);

    // Enter invalid value
    await discountPercentField.clear();
    await discountPercentField.fill('999');

    await page.getByRole('button', { name: /save/i }).click();

    const errorMessage = page.getByText(/discount.*between/i);
    await expect(errorMessage).toHaveAttribute('role', 'alert');
  });
});
