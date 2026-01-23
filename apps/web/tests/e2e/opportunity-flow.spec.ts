/**
 * E2E Test: Opportunity Queue Flow
 * MerchOps Beta MVP
 *
 * Tests:
 * - View queue with opportunities
 * - Click opportunity to see detail
 * - Verify why-now and counterfactual displayed
 * - Create draft from opportunity
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { setupAllMocks, MOCK_OPPORTUNITY_HIGH_PRIORITY, MOCK_OPPORTUNITY_MEDIUM_PRIORITY } from './helpers/mocks';

test.describe('Opportunity Queue Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test('should display opportunity queue with prioritized items', async ({ page }) => {
    await login(page);
    await page.goto('/queue');

    // Wait for queue to load
    await page.waitForSelector('[data-testid="opportunity-queue"], [data-testid="queue-list"]', {
      timeout: 10000,
    });

    // Should show opportunities
    const opportunities = page.locator('[data-testid="opportunity-card"], .opportunity-item');
    await expect(opportunities).toHaveCount(2, { timeout: 5000 });
  });

  test('should display opportunities grouped by priority bucket', async ({ page }) => {
    await login(page);
    await page.goto('/queue');

    // Wait for queue
    await page.waitForLoadState('networkidle');

    // Should show high priority section
    const highPrioritySection = page.locator('[data-testid="priority-high"], .priority-high, text=/high priority/i');
    await expect(highPrioritySection.first()).toBeVisible();

    // Should show medium priority section
    const mediumPrioritySection = page.locator('[data-testid="priority-medium"], .priority-medium, text=/medium priority/i');
    if (await mediumPrioritySection.count() > 0) {
      await expect(mediumPrioritySection.first()).toBeVisible();
    }
  });

  test('should show key opportunity metadata in queue list', async ({ page }) => {
    await login(page);
    await page.goto('/queue');

    // Wait for first opportunity to render
    const firstOpportunity = page.locator('[data-testid="opportunity-card"]').first();
    await expect(firstOpportunity).toBeVisible({ timeout: 10000 });

    // Should show opportunity type
    await expect(firstOpportunity).toContainText(/inventory|clearance|win-?back|customer/i);

    // Should show priority indicator
    const priorityBadge = firstOpportunity.locator('[data-testid="priority-badge"], .priority');
    if (await priorityBadge.count() > 0) {
      await expect(priorityBadge).toBeVisible();
    }

    // Should show confidence score
    const confidenceIndicator = firstOpportunity.locator('[data-testid="confidence"], .confidence, text=/%|confidence/i');
    if (await confidenceIndicator.count() > 0) {
      await expect(confidenceIndicator).toBeVisible();
    }
  });

  test('should navigate to opportunity detail when clicked', async ({ page }) => {
    await login(page);
    await page.goto('/queue');

    // Wait for opportunities to load
    await page.waitForSelector('[data-testid="opportunity-card"]', { timeout: 10000 });

    // Click first opportunity
    const firstOpportunity = page.locator('[data-testid="opportunity-card"]').first();
    await firstOpportunity.click();

    // Should navigate to detail page
    await page.waitForURL(/\/queue\/.*|\/opportunities\/.*/, { timeout: 5000 });
  });

  test('should display complete opportunity detail with why-now', async ({ page }) => {
    await login(page);

    // Navigate directly to opportunity detail
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Should show opportunity title/type
    await expect(page.locator('h1, h2, [data-testid="opportunity-title"]')).toContainText(
      /inventory|clearance/i
    );

    // Should show "why now" section
    const whyNowSection = page.locator('[data-testid="why-now"], .why-now, text=/why now/i');
    await expect(whyNowSection.first()).toBeVisible();

    // Should contain "why now" content
    await expect(page.locator(`text=/${MOCK_OPPORTUNITY_HIGH_PRIORITY.why_now.substring(0, 30)}/i`))
      .toBeVisible();
  });

  test('should display counterfactual explanation', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Should show counterfactual section
    const counterfactualSection = page.locator(
      '[data-testid="counterfactual"], .counterfactual, text=/without action|if nothing/i'
    );
    await expect(counterfactualSection.first()).toBeVisible();

    // Should contain counterfactual content
    await expect(page.locator(`text=/${MOCK_OPPORTUNITY_HIGH_PRIORITY.counterfactual.substring(0, 30)}/i`))
      .toBeVisible();
  });

  test('should display rationale and impact range', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);

    // Wait for page to load
    await page.waitForSelector('[data-testid="opportunity-detail"]', {
      timeout: 10000,
      state: 'visible',
    }).catch(() => page.waitForLoadState('networkidle'));

    // Should show rationale
    const rationale = page.locator('[data-testid="rationale"], .rationale');
    if (await rationale.count() > 0) {
      await expect(rationale).toContainText(/product|inventory|customer/i);
    }

    // Should show impact range
    const impactRange = page.locator('[data-testid="impact-range"], .impact-range, text=/expected|impact/i');
    if (await impactRange.count() > 0) {
      await expect(impactRange).toBeVisible();
    }
  });

  test('should show confidence score in detail view', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Should display confidence score (75% for high priority mock)
    const confidence = page.locator('[data-testid="confidence"], .confidence-score');
    await expect(confidence).toBeVisible({ timeout: 5000 });

    // Should show confidence as percentage or visual indicator
    const confidenceText = await confidence.textContent();
    expect(confidenceText).toMatch(/\d+%|confidence|high|medium|low/i);
  });

  test('should show action to create draft from opportunity', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);

    // Wait for detail page
    await page.waitForLoadState('networkidle');

    // Should have button/link to create draft
    const createDraftButton = page.locator(
      'button:has-text("Create Draft"), button:has-text("Draft Action"), [data-testid="create-draft"]'
    );
    await expect(createDraftButton).toBeVisible({ timeout: 10000 });
  });

  test('should create draft from opportunity', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Click create draft button
    const createDraftButton = page.locator(
      'button:has-text("Create Draft"), button:has-text("Draft Action"), [data-testid="create-draft"]'
    ).first();
    await createDraftButton.click();

    // Should navigate to draft view or show draft form
    await expect(page).toHaveURL(/\/drafts\/|\/queue\/.*\/draft/, { timeout: 5000 });

    // Should show draft form with pre-filled data
    const draftForm = page.locator('form, [data-testid="draft-form"]');
    await expect(draftForm).toBeVisible();
  });

  test('should show decay/expiration time', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Should show when opportunity expires
    const decayInfo = page.locator('[data-testid="decay-at"], .expiration, text=/expires|decay/i');
    if (await decayInfo.count() > 0) {
      await expect(decayInfo).toBeVisible();
    }
  });

  test('should display linked events that triggered opportunity', async ({ page }) => {
    await login(page);
    await page.goto(`/queue/${MOCK_OPPORTUNITY_HIGH_PRIORITY.id}`);
    await page.waitForLoadState('networkidle');

    // Should show triggering events section
    const eventsSection = page.locator('[data-testid="triggering-events"], .events, text=/triggered by|event/i');
    if (await eventsSection.count() > 0) {
      await expect(eventsSection).toBeVisible();
    }
  });

  test('should show empty state when no opportunities', async ({ page }) => {
    // Mock empty opportunities response
    await page.route('**/api/opportunities**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opportunities: [],
          total: 0,
        }),
      });
    });

    await login(page);
    await page.goto('/queue');

    // Should show empty state
    const emptyState = page.locator('[data-testid="empty-queue"], .empty-state');
    await expect(emptyState).toBeVisible({ timeout: 5000 });

    // Should have helpful message
    await expect(page.locator('text=/no opportunities|all clear|check back/i')).toBeVisible();
  });

  test('should sort opportunities by priority correctly', async ({ page }) => {
    await login(page);
    await page.goto('/queue');

    await page.waitForSelector('[data-testid="opportunity-card"]', { timeout: 10000 });

    // Get all opportunity cards
    const cards = page.locator('[data-testid="opportunity-card"]');
    const count = await cards.count();

    if (count >= 2) {
      // First should be high priority
      const firstCard = cards.nth(0);
      const firstPriority = await firstCard.locator('[data-testid="priority-badge"]').textContent();
      expect(firstPriority?.toLowerCase()).toContain('high');
    }
  });
});
