/**
 * Test Fixtures - Centralized Test Data
 *
 * Exports all test fixtures and factory functions for creating test data.
 * All fixtures are exported from the main setup file for consistency.
 */

export {
  // Mock clients
  prismaMock,
  redisMock,
  queueMock,
  // Database utilities
  createTestWorkspace,
  createTestUser,
  createTestShopifyConnection,
  createTestEvent,
  createTestOpportunity,
  createTestActionDraft,
  createTestExecution,
  createTestWorkspaces,
  // Time utilities
  mockCurrentTime,
  restoreTime,
  // Assertion helpers
  assertMatchesShape,
  assertDateWithinRange,
  assertError,
  // Workspace isolation utilities
  validateWorkspaceOwnership,
  // Test framework
  vi,
  expect,
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '../setup';

// ============================================================================
// COMPREHENSIVE FIXTURE EXPORTS
// ============================================================================

// Shopify Webhooks
export * from './shopify-webhooks';

// Opportunities
export * from './opportunities';

// Events
export * from './events';

// Action Drafts
export * from './drafts';

// Executions
export * from './executions';

// Users, Workspaces, and Shopify Connections
export * from './users';

// ============================================================================
// ADDITIONAL FACTORY FUNCTIONS
// ============================================================================

/**
 * Create test Shopify webhook payload
 */
export function createShopifyOrderWebhook(overrides = {}) {
  return {
    id: 820982911946154508,
    email: 'customer@example.com',
    created_at: '2024-01-15T10:00:00-05:00',
    updated_at: '2024-01-15T10:00:00-05:00',
    number: 1,
    order_number: 1001,
    total_price: '199.99',
    subtotal_price: '199.99',
    total_tax: '0.00',
    currency: 'USD',
    financial_status: 'pending',
    fulfillment_status: null,
    customer: {
      id: 115310627314723954,
      email: 'customer@example.com',
      first_name: 'John',
      last_name: 'Doe',
    },
    line_items: [
      {
        id: 866445888,
        product_id: 632910392,
        variant_id: 808950810,
        title: 'Test Product',
        quantity: 1,
        price: '199.99',
      },
    ],
    ...overrides,
  };
}

/**
 * Create test Shopify product webhook payload
 */
export function createShopifyProductWebhook(overrides = {}) {
  return {
    id: 632910392,
    title: 'Test Product',
    body_html: '<p>Test product description</p>',
    vendor: 'Test Vendor',
    product_type: 'Test Type',
    created_at: '2024-01-01T00:00:00-05:00',
    handle: 'test-product',
    updated_at: '2024-01-15T10:00:00-05:00',
    published_at: '2024-01-01T00:00:00-05:00',
    status: 'active',
    published_scope: 'web',
    tags: 'test, product',
    variants: [
      {
        id: 808950810,
        product_id: 632910392,
        title: 'Default Title',
        price: '199.99',
        sku: 'TEST-SKU-001',
        inventory_quantity: 10,
        inventory_management: 'shopify',
        inventory_policy: 'deny',
        fulfillment_service: 'manual',
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-15T10:00:00-05:00',
      },
    ],
    ...overrides,
  };
}

/**
 * Create test inventory level webhook payload
 */
export function createShopifyInventoryLevelWebhook(overrides = {}) {
  return {
    inventory_item_id: 39072856,
    location_id: 905684977,
    available: 5,
    updated_at: '2024-01-15T10:00:00-05:00',
    ...overrides,
  };
}

/**
 * Create test discount code payload
 */
export function createDiscountPayload(overrides = {}) {
  return {
    discount_code: 'SALE15',
    discount_percent: 15,
    product_ids: ['gid://shopify/Product/123456'],
    starts_at: '2024-01-16T00:00:00Z',
    ends_at: '2024-01-22T23:59:59Z',
    usage_limit: 100,
    minimum_order_value: 0,
    ...overrides,
  };
}

/**
 * Create test win-back email payload
 */
export function createWinbackEmailPayload(overrides = {}) {
  return {
    customer_email: 'customer@example.com',
    customer_name: 'John Doe',
    subject: 'We miss you! Here\'s 15% off',
    body_html: '<p>Welcome back! Enjoy 15% off your next purchase.</p>',
    discount_code: 'WELCOME15',
    discount_percent: 15,
    send_at: '2024-01-16T09:00:00Z',
    ...overrides,
  };
}

/**
 * Create test pause product payload
 */
export function createPauseProductPayload(overrides = {}) {
  return {
    product_id: 'gid://shopify/Product/123456',
    reason: 'Out of stock - preventing oversells',
    resume_at: '2024-01-20T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create test opportunity explanations
 */
export function createOpportunityExplanations(overrides = {}) {
  return {
    why_now: 'Inventory dropped below threshold requiring immediate action',
    rationale: 'Low inventory creates holding cost risk and potential waste',
    counterfactual: 'Without action, inventory may sit for weeks tying up capital',
    impact_range: '5-15 units potentially cleared',
    ...overrides,
  };
}

/**
 * Create test outcome evidence
 */
export function createOutcomeEvidence(type: 'discount' | 'winback' | 'pause', overrides = {}) {
  const baseEvidence = {
    observation_start: '2024-01-15T12:00:00Z',
    observation_end: '2024-01-22T12:00:00Z',
    observation_window_days: 7,
    data_sources: ['orders', 'product_analytics'],
    computation_version: 'v1.0',
  };

  switch (type) {
    case 'discount':
      return {
        ...baseEvidence,
        baseline_conversion_rate: 0.02,
        campaign_conversion_rate: 0.045,
        uplift_percent: 125,
        orders_attributed: 8,
        revenue_generated: 640,
        revenue_baseline: 256,
        revenue_delta: 384,
        discount_code: 'SALE20',
        discount_percent: 20,
        ...overrides,
      };

    case 'winback':
      return {
        ...baseEvidence,
        emails_sent: 100,
        emails_opened: 35,
        emails_clicked: 12,
        orders_attributed: 4,
        open_rate: 0.35,
        click_rate: 0.12,
        conversion_rate: 0.04,
        revenue_generated: 320,
        ...overrides,
      };

    case 'pause':
      return {
        ...baseEvidence,
        stockouts_prevented: 1,
        backorders_avoided: 3,
        customer_frustration_score: 0.2,
        inventory_efficiency_gain: 0.15,
        ...overrides,
      };

    default:
      return { ...baseEvidence, ...overrides };
  }
}

/**
 * Create test Shopify OAuth token response
 */
export function createShopifyTokenResponse(overrides = {}) {
  return {
    access_token: 'shpat_test_token_' + Math.random().toString(36).substring(7),
    scope: 'read_products,write_products,read_orders,read_customers,read_inventory,write_price_rules,write_discounts',
    ...overrides,
  };
}

/**
 * Create test webhook headers
 */
export function createWebhookHeaders(overrides: Record<string, string> = {}) {
  return new Headers({
    'x-shopify-hmac-sha256': 'test-hmac-signature',
    'x-shopify-shop-domain': 'test-store.myshopify.com',
    'x-shopify-topic': 'orders/create',
    'x-shopify-api-version': '2024-01',
    'x-shopify-webhook-id': '12345',
    ...overrides,
  });
}

/**
 * Create test correlation ID
 */
export function createCorrelationId(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Create test idempotency key
 */
export function createIdempotencyKey(draftId: string) {
  return `draft_${draftId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Create multiple test events
 */
export function createTestEvents(count: number, baseOverrides = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `event-${i + 1}`,
    workspace_id: 'test-workspace-id',
    type: 'inventory_threshold_crossed' as const,
    occurred_at: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`),
    payload_json: {
      product_id: `gid://shopify/Product/${i + 1}`,
      current_inventory: 5 - i,
      threshold: 10,
    },
    dedupe_key: `inventory_threshold_crossed:${i + 1}:2024-01-${String(i + 1).padStart(2, '0')}`,
    source: 'webhook' as const,
    created_at: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T12:05:00Z`),
    ...baseOverrides,
  }));
}

/**
 * Create multiple test opportunities
 */
export function createTestOpportunities(count: number, baseOverrides = {}) {
  const types = ['inventory_clearance', 'winback_campaign', 'high_velocity_protection'] as const;
  const priorities = ['high', 'medium', 'low'] as const;

  return Array.from({ length: count }, (_, i) => ({
    id: `opp-${i + 1}`,
    workspace_id: 'test-workspace-id',
    type: types[i % types.length],
    priority_bucket: priorities[i % priorities.length],
    why_now: `Test opportunity ${i + 1} why now`,
    rationale: `Test opportunity ${i + 1} rationale`,
    impact_range: `${i + 1}-${i + 10} units`,
    counterfactual: `Test opportunity ${i + 1} counterfactual`,
    decay_at: new Date(Date.now() + (7 + i) * 24 * 60 * 60 * 1000),
    confidence: 0.5 + (i * 0.1) % 0.5,
    state: 'new' as const,
    created_at: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`),
    updated_at: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`),
    ...baseOverrides,
  }));
}

/**
 * Wait for a specified time (useful for async testing)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock fetch response
 */
export function createMockFetchResponse(data: any, options: { status?: number; ok?: boolean } = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

/**
 * Create test environment variables
 */
export function setupTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.SHOPIFY_API_KEY = 'test-api-key';
  process.env.SHOPIFY_API_SECRET = 'test-api-secret';
  process.env.SHOPIFY_APP_URL = 'https://app.merchops.test';
  process.env.SHOPIFY_SCOPES = 'read_products,write_products,read_orders';
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/merchops_test';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-key-for-testing';
  process.env.NEXTAUTH_URL = 'https://app.merchops.test';
}

/**
 * Clean up test environment
 */
export function cleanupTestEnv() {
  delete process.env.SHOPIFY_API_KEY;
  delete process.env.SHOPIFY_API_SECRET;
  delete process.env.SHOPIFY_APP_URL;
  delete process.env.SHOPIFY_SCOPES;
  delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
}

// Re-export all setup utilities
export * from '../setup';
