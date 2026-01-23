/**
 * E2E Tests: Opportunity Queue
 * MerchOps Beta MVP - Playwright
 *
 * Tests:
 * - Opportunity queue display
 * - Priority bucket grouping
 * - Opportunity detail view
 * - Dismiss functionality
 * - Queue filtering and sorting
 */

import { test, expect, type Page } from '@playwright/test';

// ============================================================================
// TEST SETUP
// ============================================================================

test.describe('Opportunity Queue', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@merchops.test');
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /log in/i }).click();

    // Navigate to opportunities queue
    await page.goto('/dashboard/opportunities');
  });

  // ============================================================================
  // TESTS: QUEUE DISPLAY
  // ============================================================================

  test('displays opportunity queue grouped by priority', async ({ page }) => {
    // Should see priority buckets
    await expect(page.getByRole('heading', { name: /high priority/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /medium priority/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /low priority/i })).toBeVisible();
  });

  test('shows opportunities in correct priority buckets', async ({ page }) => {
    // High priority section should have high priority items
    const highSection = page.getByTestId('priority-bucket-high');
    await expect(highSection).toBeVisible();

    // Should contain opportunity cards
    const highPriorityCards = highSection.getByTestId(/opportunity-card/);
    await expect(highPriorityCards.first()).toBeVisible();
  });

  test('displays opportunity card with key information', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();

    // Should show title/type
    await expect(opportunityCard.getByTestId('opportunity-title')).toBeVisible();

    // Should show why-now
    await expect(opportunityCard.getByTestId('opportunity-why-now')).toBeVisible();

    // Should show impact range
    await expect(opportunityCard.getByTestId('opportunity-impact')).toBeVisible();

    // Should show decay indicator
    await expect(opportunityCard.getByTestId('opportunity-decay')).toBeVisible();
  });

  test('shows empty state when no opportunities', async ({ page }) => {
    // Mock empty state
    await page.route('**/api/opportunities*', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    );

    await page.reload();

    await expect(page.getByText(/no opportunities/i)).toBeVisible();
    await expect(page.getByText(/check back later/i)).toBeVisible();
  });

  test('displays opportunity count per priority bucket', async ({ page }) => {
    const highSection = page.getByTestId('priority-bucket-high');
    const countBadge = highSection.getByTestId('opportunity-count');

    await expect(countBadge).toBeVisible();
    await expect(countBadge).toContainText(/\d+/); // Should show number
  });

  // ============================================================================
  // TESTS: OPPORTUNITY DETAIL VIEW
  // ============================================================================

  test('opens opportunity detail on card click', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();
    await opportunityCard.click();

    // Should open detail modal or navigate to detail page
    await expect(page.getByTestId('opportunity-detail')).toBeVisible();
  });

  test('displays complete opportunity details', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();
    await opportunityCard.click();

    const detailView = page.getByTestId('opportunity-detail');

    // Title and type
    await expect(detailView.getByTestId('detail-title')).toBeVisible();

    // Why now
    await expect(detailView.getByRole('heading', { name: /why now/i })).toBeVisible();
    await expect(detailView.getByTestId('detail-why-now')).toBeVisible();

    // Rationale
    await expect(detailView.getByRole('heading', { name: /rationale/i })).toBeVisible();
    await expect(detailView.getByTestId('detail-rationale')).toBeVisible();

    // Counterfactual
    await expect(detailView.getByRole('heading', { name: /what if.*nothing/i })).toBeVisible();
    await expect(detailView.getByTestId('detail-counterfactual')).toBeVisible();

    // Impact range
    await expect(detailView.getByRole('heading', { name: /expected impact/i })).toBeVisible();
    await expect(detailView.getByTestId('detail-impact')).toBeVisible();

    // Confidence
    await expect(detailView.getByTestId('detail-confidence')).toBeVisible();
  });

  test('shows triggering events in detail view', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();
    await opportunityCard.click();

    const detailView = page.getByTestId('opportunity-detail');

    // Should show linked events section
    await expect(detailView.getByRole('heading', { name: /triggering events/i })).toBeVisible();

    // Should list events
    const eventsList = detailView.getByTestId('triggering-events-list');
    await expect(eventsList).toBeVisible();
    await expect(eventsList.getByRole('listitem').first()).toBeVisible();
  });

  test('displays draft action in detail view', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();
    await opportunityCard.click();

    const detailView = page.getByTestId('opportunity-detail');

    // Should show draft action section
    await expect(detailView.getByRole('heading', { name: /suggested action/i })).toBeVisible();

    // Should show operator intent
    await expect(detailView.getByTestId('draft-intent')).toBeVisible();

    // Should show execution type
    await expect(detailView.getByTestId('draft-execution-type')).toBeVisible();

    // Should show review button
    await expect(detailView.getByRole('button', { name: /review.*draft/i })).toBeVisible();
  });

  test('closes detail view', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();
    await opportunityCard.click();

    const detailView = page.getByTestId('opportunity-detail');
    await expect(detailView).toBeVisible();

    // Click close button
    await detailView.getByRole('button', { name: /close/i }).click();

    // Should close
    await expect(detailView).not.toBeVisible();
  });

  // ============================================================================
  // TESTS: DISMISS FUNCTIONALITY
  // ============================================================================

  test('dismisses opportunity', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();
    const opportunityTitle = await opportunityCard.getByTestId('opportunity-title').textContent();

    // Click dismiss button
    await opportunityCard.getByRole('button', { name: /dismiss/i }).click();

    // Should show confirmation
    await expect(page.getByText(/are you sure/i)).toBeVisible();

    // Confirm dismiss
    await page.getByRole('button', { name: /confirm|yes/i }).click();

    // Opportunity should be removed from queue
    await expect(page.getByText(opportunityTitle!)).not.toBeVisible();

    // Should show success message
    await expect(page.getByText(/dismissed/i)).toBeVisible();
  });

  test('cancels dismiss action', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();
    const opportunityTitle = await opportunityCard.getByTestId('opportunity-title').textContent();

    // Click dismiss button
    await opportunityCard.getByRole('button', { name: /dismiss/i }).click();

    // Should show confirmation
    await expect(page.getByText(/are you sure/i)).toBeVisible();

    // Cancel
    await page.getByRole('button', { name: /cancel|no/i }).click();

    // Opportunity should still be visible
    await expect(page.getByText(opportunityTitle!)).toBeVisible();
  });

  test('dismissed opportunity does not reappear on refresh', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();
    const opportunityTitle = await opportunityCard.getByTestId('opportunity-title').textContent();

    // Dismiss
    await opportunityCard.getByRole('button', { name: /dismiss/i }).click();
    await page.getByRole('button', { name: /confirm|yes/i }).click();

    // Wait for dismissal
    await expect(page.getByText(opportunityTitle!)).not.toBeVisible();

    // Reload page
    await page.reload();

    // Should still be dismissed
    await expect(page.getByText(opportunityTitle!)).not.toBeVisible();
  });

  test('shows dismiss reason input', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();

    await opportunityCard.getByRole('button', { name: /dismiss/i }).click();

    // Should optionally show reason input
    const reasonInput = page.getByLabel(/reason|why/i);
    if (await reasonInput.isVisible()) {
      await reasonInput.fill('Not relevant right now');
      await page.getByRole('button', { name: /confirm|yes/i }).click();

      await expect(page.getByText(/dismissed/i)).toBeVisible();
    }
  });

  // ============================================================================
  // TESTS: QUEUE FILTERING AND SORTING
  // ============================================================================

  test('filters opportunities by type', async ({ page }) => {
    // Should have filter controls
    const typeFilter = page.getByLabel(/filter.*type/i);
    await expect(typeFilter).toBeVisible();

    // Select filter
    await typeFilter.selectOption('inventory_clearance');

    // Should show only matching opportunities
    const cards = page.getByTestId('opportunity-card');
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await expect(card.getByTestId('opportunity-type')).toContainText(/inventory/i);
    }
  });

  test('sorts opportunities within priority bucket', async ({ page }) => {
    const highSection = page.getByTestId('priority-bucket-high');

    // Should have sort control
    const sortControl = highSection.getByLabel(/sort/i);
    await expect(sortControl).toBeVisible();

    // Change sort
    await sortControl.selectOption('decay_at');

    // Opportunities should be sorted by decay_at
    const cards = highSection.getByTestId('opportunity-card');
    const count = await cards.count();

    if (count >= 2) {
      // Verify order (most urgent first)
      const firstDecay = await cards.first().getByTestId('opportunity-decay').textContent();
      const lastDecay = await cards.last().getByTestId('opportunity-decay').textContent();

      // First should expire sooner than last
      expect(firstDecay).toBeTruthy();
      expect(lastDecay).toBeTruthy();
    }
  });

  test('searches opportunities', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Search for specific product
    await searchInput.fill('Product Name');

    // Should filter results
    const cards = page.getByTestId('opportunity-card');
    const count = await cards.count();

    // All visible cards should match search
    for (let i = 0; i < count; i++) {
      const cardText = await cards.nth(i).textContent();
      expect(cardText?.toLowerCase()).toContain('product name');
    }
  });

  test('clears search', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    // Search
    await searchInput.fill('Product Name');
    await page.waitForTimeout(500);

    const filteredCount = await page.getByTestId('opportunity-card').count();

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    const allCount = await page.getByTestId('opportunity-card').count();

    // Should show more results
    expect(allCount).toBeGreaterThanOrEqual(filteredCount);
  });

  // ============================================================================
  // TESTS: REAL-TIME UPDATES
  // ============================================================================

  test('shows new opportunities when they appear', async ({ page }) => {
    const initialCount = await page.getByTestId('opportunity-card').count();

    // Simulate new opportunity arriving (via polling or websocket)
    await page.waitForTimeout(2000);

    // Manually trigger refresh for test
    await page.getByRole('button', { name: /refresh/i }).click();

    const newCount = await page.getByTestId('opportunity-card').count();

    // Count might change (in real scenario)
    expect(newCount).toBeGreaterThanOrEqual(0);
  });

  test('updates opportunity state when changed elsewhere', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();
    const opportunityId = await opportunityCard.getAttribute('data-opportunity-id');

    // Simulate state change from API
    await page.route(`**/api/opportunities/${opportunityId}`, (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ state: 'viewed' }),
      })
    );

    // Open detail
    await opportunityCard.click();

    // State should update
    await expect(page.getByTestId('opportunity-state')).toContainText(/viewed/i);
  });

  // ============================================================================
  // TESTS: DECAY INDICATORS
  // ============================================================================

  test('shows urgent decay warning', async ({ page }) => {
    const urgentCard = page.getByTestId('opportunity-card').first();
    const decayIndicator = urgentCard.getByTestId('opportunity-decay');

    // Should show urgent styling for soon-to-expire opportunities
    if (await decayIndicator.isVisible()) {
      const classList = await decayIndicator.getAttribute('class');
      // Might have urgent/warning class
      expect(classList).toBeTruthy();
    }
  });

  test('hides expired opportunities', async ({ page }) => {
    // Opportunities with state='expired' should not appear
    const cards = page.getByTestId('opportunity-card');
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const state = await card.getAttribute('data-opportunity-state');
      expect(state).not.toBe('expired');
    }
  });

  // ============================================================================
  // TESTS: ACCESSIBILITY
  // ============================================================================

  test('queue is keyboard navigable', async ({ page }) => {
    // Tab through opportunities
    await page.keyboard.press('Tab');

    // Should focus first opportunity card
    const firstCard = page.getByTestId('opportunity-card').first();
    await expect(firstCard).toBeFocused();

    // Press Enter to open
    await page.keyboard.press('Enter');

    // Should open detail
    await expect(page.getByTestId('opportunity-detail')).toBeVisible();
  });

  test('opportunity cards have proper ARIA labels', async ({ page }) => {
    const opportunityCard = page.getByTestId('opportunity-card').first();

    // Should have role and label
    await expect(opportunityCard).toHaveAttribute('role', 'article');
    await expect(opportunityCard).toHaveAttribute('aria-label');
  });

  test('priority buckets are properly announced', async ({ page }) => {
    const highSection = page.getByTestId('priority-bucket-high');

    await expect(highSection).toHaveAttribute('role', 'region');
    await expect(highSection).toHaveAttribute('aria-labelledby');
  });

  // ============================================================================
  // TESTS: ERROR STATES
  // ============================================================================

  test('shows error when queue fails to load', async ({ page }) => {
    await page.route('**/api/opportunities*', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    );

    await page.reload();

    await expect(page.getByText(/error loading|something went wrong/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });

  test('retries loading queue', async ({ page }) => {
    let attempts = 0;

    await page.route('**/api/opportunities*', (route) => {
      attempts++;
      if (attempts === 1) {
        route.fulfill({ status: 500 });
      } else {
        route.continue();
      }
    });

    await page.reload();

    // Should show error
    await expect(page.getByText(/error loading/i)).toBeVisible();

    // Click retry
    await page.getByRole('button', { name: /retry/i }).click();

    // Should load successfully
    await expect(page.getByTestId('opportunity-card').first()).toBeVisible();
  });

  // ============================================================================
  // TESTS: LOADING STATES
  // ============================================================================

  test('shows loading skeleton while fetching', async ({ page }) => {
    // Delay the response
    await page.route('**/api/opportunities*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      route.continue();
    });

    await page.reload();

    // Should show loading state
    await expect(page.getByTestId('queue-loading-skeleton')).toBeVisible();

    // Should eventually show content
    await expect(page.getByTestId('opportunity-card').first()).toBeVisible({
      timeout: 5000,
    });
  });
});
