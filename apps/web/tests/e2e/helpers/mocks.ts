/**
 * E2E Test Mock Data
 * MerchOps Beta MVP - Mock data and API responses for testing
 *
 * Provides:
 * - Shopify API response mocks
 * - Webhook payload mocks
 * - Opportunity data mocks
 * - Test user constants
 */

import { Page, Route } from '@playwright/test';

// ============================================================================
// TEST CONSTANTS
// ============================================================================

export const TEST_USER_EMAIL = 'test@merchops.local';
export const TEST_USER_PASSWORD = 'TestPassword123!';
export const TEST_WORKSPACE_ID = 'test-workspace-e2e';
export const TEST_STORE_DOMAIN = 'test-store.myshopify.com';

// ============================================================================
// SHOPIFY MOCK DATA
// ============================================================================

/**
 * Mock Shopify OAuth callback response
 */
export const MOCK_SHOPIFY_OAUTH_RESPONSE = {
  access_token: 'shpat_test_token_123456789',
  scope: 'read_products,write_products,read_orders,write_orders,read_inventory',
  expires_in: null,
  associated_user_scope: 'read_products,write_products',
  associated_user: {
    id: 987654321,
    first_name: 'Test',
    last_name: 'User',
    email: 'shop@test-store.myshopify.com',
    email_verified: true,
    account_owner: true,
    locale: 'en',
  },
};

/**
 * Mock Shopify shop data
 */
export const MOCK_SHOPIFY_SHOP = {
  id: 'gid://shopify/Shop/123456789',
  name: 'Test Store',
  email: 'shop@test-store.myshopify.com',
  domain: 'test-store.myshopify.com',
  myshopify_domain: 'test-store.myshopify.com',
  plan_name: 'professional',
  currency: 'USD',
  money_format: '${{amount}}',
  timezone: 'America/New_York',
  iana_timezone: 'America/New_York',
  country_code: 'US',
  created_at: '2024-01-01T00:00:00Z',
};

/**
 * Mock Shopify product data
 */
export const MOCK_SHOPIFY_PRODUCT = {
  id: 'gid://shopify/Product/123456',
  title: 'Test Product - Premium Widget',
  handle: 'test-product-premium-widget',
  status: 'active',
  variants: [
    {
      id: 'gid://shopify/ProductVariant/789012',
      title: 'Default',
      price: '49.99',
      sku: 'TEST-WIDGET-001',
      inventory_quantity: 5,
      inventory_management: 'shopify',
    },
  ],
  images: [
    {
      id: 'gid://shopify/ProductImage/345678',
      src: 'https://cdn.shopify.com/test-product.jpg',
      alt: 'Test Product',
    },
  ],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
};

/**
 * Mock Shopify discount code response
 */
export const MOCK_SHOPIFY_DISCOUNT = {
  id: 'gid://shopify/PriceRule/555666',
  title: 'CLEARANCE15',
  value_type: 'percentage',
  value: '-15.0',
  customer_selection: 'all',
  target_type: 'line_item',
  target_selection: 'entitled',
  allocation_method: 'across',
  starts_at: '2024-01-16T00:00:00Z',
  ends_at: '2024-01-22T23:59:59Z',
  created_at: '2024-01-15T12:20:00Z',
};

// ============================================================================
// WEBHOOK MOCK PAYLOADS
// ============================================================================

/**
 * Mock orders/create webhook
 */
export const MOCK_WEBHOOK_ORDER_CREATED = {
  id: 'gid://shopify/Order/999888777',
  email: 'customer@example.com',
  created_at: '2024-01-15T14:00:00Z',
  total_price: '149.97',
  subtotal_price: '149.97',
  total_tax: '0.00',
  currency: 'USD',
  financial_status: 'pending',
  fulfillment_status: null,
  line_items: [
    {
      id: 'gid://shopify/LineItem/111222333',
      product_id: 'gid://shopify/Product/123456',
      variant_id: 'gid://shopify/ProductVariant/789012',
      title: 'Test Product - Premium Widget',
      quantity: 3,
      price: '49.99',
    },
  ],
};

/**
 * Mock inventory_levels/update webhook
 */
export const MOCK_WEBHOOK_INVENTORY_UPDATE = {
  inventory_item_id: 'gid://shopify/InventoryItem/789012',
  location_id: 'gid://shopify/Location/123456',
  available: 5,
  updated_at: '2024-01-15T12:00:00Z',
};

/**
 * Mock products/update webhook
 */
export const MOCK_WEBHOOK_PRODUCT_UPDATE = {
  id: 'gid://shopify/Product/123456',
  title: 'Test Product - Premium Widget',
  status: 'active',
  updated_at: '2024-01-15T12:00:00Z',
  variants: [
    {
      id: 'gid://shopify/ProductVariant/789012',
      inventory_quantity: 5,
    },
  ],
};

// ============================================================================
// OPPORTUNITY MOCK DATA
// ============================================================================

/**
 * Mock high-priority opportunity (inventory clearance)
 */
export const MOCK_OPPORTUNITY_HIGH_PRIORITY = {
  id: 'opp-high-001',
  type: 'inventory_clearance',
  priority_bucket: 'high',
  why_now: 'Inventory at critical threshold: only 5 units remain with average daily sales of 2 units. Next restock in 7 days.',
  rationale: 'Product "Test Product - Premium Widget" is at risk of stockout before next restock. Historical data shows this product sells 2 units per day on average. A strategic discount can accelerate clearance and prevent lost sales.',
  impact_range: 'Expected: 5-15 units sold, $200-$600 revenue protection',
  counterfactual: 'Without action: Likely stockout in 2-3 days leading to 4-5 days of lost sales (estimated $400-$500 revenue loss) and potential backorders.',
  decay_at: '2024-01-22T12:00:00Z',
  confidence: 0.78,
  state: 'new',
  created_at: '2024-01-15T12:10:00Z',
  updated_at: '2024-01-15T12:10:00Z',
};

/**
 * Mock medium-priority opportunity (win-back)
 */
export const MOCK_OPPORTUNITY_MEDIUM_PRIORITY = {
  id: 'opp-med-001',
  type: 'customer_winback',
  priority_bucket: 'medium',
  why_now: '127 customers crossed the 60-day inactivity threshold this week, representing $12,400 in prior 90-day purchase value.',
  rationale: 'A cohort of previously active customers has become dormant. Win-back campaigns for similar cohorts historically achieve 8-12% reactivation rates within 14 days.',
  impact_range: 'Expected: 10-15 customers reactivated, $800-$1,500 incremental revenue',
  counterfactual: 'Without action: Natural reactivation rate for 60-90 day dormant customers is 2-3%, resulting in potential $10,000+ lifetime value erosion.',
  decay_at: '2024-01-25T12:00:00Z',
  confidence: 0.65,
  state: 'new',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

/**
 * Mock action draft (discount)
 */
export const MOCK_ACTION_DRAFT_DISCOUNT = {
  id: 'draft-001',
  opportunity_id: 'opp-high-001',
  operator_intent: 'reduce_inventory_risk',
  execution_type: 'discount_draft',
  payload_json: {
    discount_code: 'CLEARANCE15',
    discount_percent: 15,
    product_ids: ['gid://shopify/Product/123456'],
    starts_at: '2024-01-16T00:00:00Z',
    ends_at: '2024-01-22T23:59:59Z',
    title: 'Inventory Clearance - Premium Widget',
  },
  editable_fields_json: {
    discount_code: { type: 'string', max_length: 50 },
    discount_percent: { type: 'number', min: 5, max: 50 },
    starts_at: { type: 'datetime' },
    ends_at: { type: 'datetime' },
  },
  state: 'draft',
  created_at: '2024-01-15T12:15:00Z',
  updated_at: '2024-01-15T12:15:00Z',
};

/**
 * Mock execution (success)
 */
export const MOCK_EXECUTION_SUCCESS = {
  id: 'exec-001',
  action_draft_id: 'draft-001',
  status: 'success',
  started_at: '2024-01-15T12:20:00Z',
  finished_at: '2024-01-15T12:20:15Z',
  request_payload_json: {
    discount_code: 'CLEARANCE15',
    discount_percent: 15,
    product_ids: ['gid://shopify/Product/123456'],
  },
  provider_response_json: MOCK_SHOPIFY_DISCOUNT,
  idempotency_key: 'exec:draft-001:1705322400000',
};

/**
 * Mock execution (failure)
 */
export const MOCK_EXECUTION_FAILURE = {
  id: 'exec-002',
  action_draft_id: 'draft-002',
  status: 'failed',
  started_at: '2024-01-15T13:00:00Z',
  finished_at: '2024-01-15T13:00:05Z',
  error_code: 'SHOPIFY_API_ERROR',
  error_message: 'Discount code already exists',
  request_payload_json: {
    discount_code: 'EXISTING_CODE',
    discount_percent: 20,
  },
  provider_response_json: {
    errors: ['Discount code must be unique'],
  },
  idempotency_key: 'exec:draft-002:1705324800000',
};

// ============================================================================
// MOCK API INTERCEPTORS
// ============================================================================

/**
 * Setup Shopify API mocks for a page
 */
export async function setupShopifyMocks(page: Page): Promise<void> {
  // Mock Shopify OAuth endpoints
  await page.route('**/api/shopify/oauth/initiate', async (route: Route) => {
    await route.fulfill({
      status: 302,
      headers: {
        Location: '/settings?shopify_connected=true',
      },
    });
  });

  await page.route('**/api/shopify/oauth/callback**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        shop: MOCK_SHOPIFY_SHOP,
      }),
    });
  });

  // Mock Shopify connection status
  await page.route('**/api/shopify/connection**', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          shop: MOCK_SHOPIFY_SHOP,
          scopes: MOCK_SHOPIFY_OAUTH_RESPONSE.scope.split(','),
        }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Setup opportunity API mocks
 */
export async function setupOpportunityMocks(page: Page): Promise<void> {
  await page.route('**/api/opportunities**', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opportunities: [
            MOCK_OPPORTUNITY_HIGH_PRIORITY,
            MOCK_OPPORTUNITY_MEDIUM_PRIORITY,
          ],
          total: 2,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock individual opportunity detail
  await page.route('**/api/opportunities/*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_OPPORTUNITY_HIGH_PRIORITY),
    });
  });
}

/**
 * Setup action draft API mocks
 */
export async function setupActionMocks(page: Page): Promise<void> {
  await page.route('**/api/actions/drafts**', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ACTION_DRAFT_DISCOUNT),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/actions/drafts/*/approve', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_EXECUTION_SUCCESS),
    });
  });
}

/**
 * Setup execution API mocks (including failures)
 */
export async function setupExecutionMocks(page: Page, shouldFail: boolean = false): Promise<void> {
  await page.route('**/api/executions**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        executions: [
          shouldFail ? MOCK_EXECUTION_FAILURE : MOCK_EXECUTION_SUCCESS,
        ],
      }),
    });
  });
}

/**
 * Setup all common mocks for E2E tests
 */
export async function setupAllMocks(page: Page): Promise<void> {
  await setupShopifyMocks(page);
  await setupOpportunityMocks(page);
  await setupActionMocks(page);
  await setupExecutionMocks(page);
}
