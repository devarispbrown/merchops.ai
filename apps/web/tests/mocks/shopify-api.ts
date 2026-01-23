/**
 * Shopify API Mock
 *
 * Mock implementation of Shopify API client for testing.
 */

import { vi } from 'vitest';
import {
  shopifyDiscountSuccessResponse,
  shopifyDiscountErrorResponse,
  shopifyPauseProductSuccessResponse,
  shopifyPauseProductErrorResponse,
  shopifyProductNotFoundResponse,
} from '../fixtures/executions';
import { shopifyStoreInfo } from '../fixtures/users';
import { productUpdatePayload } from '../fixtures/shopify-webhooks';

// ============================================================================
// MOCK SHOPIFY CLIENT
// ============================================================================

export class MockShopifyClient {
  private shop: string;
  private encryptedToken: string;
  private requestCount = 0;
  private shouldFail = false;
  private failureType: 'network' | 'rate_limit' | 'not_found' | 'validation' | null = null;

  constructor(shop: string, encryptedToken: string) {
    this.shop = shop;
    this.encryptedToken = encryptedToken;
  }

  /**
   * Configure mock to fail with specific error type
   */
  mockFailure(type: 'network' | 'rate_limit' | 'not_found' | 'validation') {
    this.shouldFail = true;
    this.failureType = type;
  }

  /**
   * Reset mock to success mode
   */
  mockSuccess() {
    this.shouldFail = false;
    this.failureType = null;
  }

  /**
   * Get request count (for testing rate limiting)
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request count
   */
  resetRequestCount() {
    this.requestCount = 0;
  }

  /**
   * Mock request method
   */
  async request<T>(
    endpoint: string,
    options?: {
      method?: string;
      body?: any;
      correlationId?: string;
    }
  ): Promise<T> {
    this.requestCount++;

    // Simulate failures
    if (this.shouldFail) {
      switch (this.failureType) {
        case 'network':
          throw new Error('Network error: Connection timeout');
        case 'rate_limit':
          throw new Error('Rate limit exceeded');
        case 'not_found':
          return shopifyProductNotFoundResponse as T;
        case 'validation':
          throw new Error('Validation error');
      }
    }

    const method = options?.method || 'GET';

    // Route to appropriate mock handler
    if (endpoint.includes('/price_rules.json')) {
      return this.handlePriceRules(method, options?.body) as T;
    } else if (endpoint.includes('/discount_codes.json')) {
      return this.handleDiscountCodes(method, options?.body) as T;
    } else if (endpoint.includes('/products/')) {
      return this.handleProducts(endpoint, method, options?.body) as T;
    } else if (endpoint.includes('/shop.json')) {
      return this.handleShop() as T;
    } else if (endpoint.includes('/webhooks.json')) {
      return this.handleWebhooks(method, options?.body) as T;
    }

    throw new Error(`Mock not implemented for endpoint: ${endpoint}`);
  }

  /**
   * Mock price rules endpoint
   */
  private handlePriceRules(method: string, body?: any) {
    if (method === 'POST') {
      // Check for duplicate code
      if (body?.price_rule?.title === 'Duplicate Discount') {
        return shopifyDiscountErrorResponse;
      }
      return shopifyDiscountSuccessResponse;
    } else if (method === 'GET') {
      return {
        price_rules: [shopifyDiscountSuccessResponse.price_rule],
      };
    }
  }

  /**
   * Mock discount codes endpoint
   */
  private handleDiscountCodes(method: string, body?: any) {
    if (method === 'POST') {
      return shopifyDiscountSuccessResponse;
    } else if (method === 'GET') {
      return {
        discount_codes: [shopifyDiscountSuccessResponse.discount_code],
      };
    }
  }

  /**
   * Mock products endpoint
   */
  private handleProducts(endpoint: string, method: string, body?: any) {
    if (method === 'PUT') {
      // Update product (e.g., pause/unpause)
      return {
        product: shopifyPauseProductSuccessResponse.product,
      };
    } else if (method === 'GET') {
      // Get single product
      return {
        product: productUpdatePayload,
      };
    } else if (method === 'POST' && endpoint.includes('/metafields.json')) {
      // Add metafield
      return {
        metafield: shopifyPauseProductSuccessResponse.metafield,
      };
    }
  }

  /**
   * Mock shop endpoint
   */
  private handleShop() {
    return shopifyStoreInfo;
  }

  /**
   * Mock webhooks endpoint
   */
  private handleWebhooks(method: string, body?: any) {
    if (method === 'POST') {
      return {
        webhook: {
          id: Math.floor(Math.random() * 1000000000),
          address: body?.webhook?.address || 'https://example.com/webhooks',
          topic: body?.webhook?.topic || 'orders/create',
          format: 'json',
          created_at: new Date().toISOString(),
        },
      };
    } else if (method === 'GET') {
      return {
        webhooks: [
          {
            id: 123456789,
            address: 'https://example.com/webhooks',
            topic: 'orders/create',
            format: 'json',
            created_at: '2024-01-01T10:00:00Z',
          },
        ],
      };
    } else if (method === 'DELETE') {
      return {};
    }
  }

  /**
   * Mock get products method
   */
  async getProducts(params?: {
    limit?: number;
    since_id?: string;
    fields?: string;
  }) {
    return this.request('/products.json', { method: 'GET' });
  }

  /**
   * Mock get product method
   */
  async getProduct(productId: string) {
    return this.request(`/products/${productId}.json`, { method: 'GET' });
  }

  /**
   * Mock update product method
   */
  async updateProduct(productId: string, updates: any) {
    return this.request(`/products/${productId}.json`, {
      method: 'PUT',
      body: { product: updates },
    });
  }

  /**
   * Mock create price rule method
   */
  async createPriceRule(priceRule: any) {
    return this.request('/price_rules.json', {
      method: 'POST',
      body: { price_rule: priceRule },
    });
  }

  /**
   * Mock create discount code method
   */
  async createDiscountCode(priceRuleId: string, code: any) {
    return this.request(`/price_rules/${priceRuleId}/discount_codes.json`, {
      method: 'POST',
      body: { discount_code: code },
    });
  }

  /**
   * Mock get shop method
   */
  async getShop() {
    return this.request('/shop.json', { method: 'GET' });
  }
}

// ============================================================================
// MOCK FACTORY
// ============================================================================

/**
 * Create a mock Shopify client
 */
export function createMockShopifyClient(
  shop: string = 'test-store.myshopify.com',
  encryptedToken: string = 'encrypted-test-token'
): MockShopifyClient {
  return new MockShopifyClient(shop, encryptedToken);
}

// ============================================================================
// VITEST MOCKS
// ============================================================================

/**
 * Mock the ShopifyClient class
 */
export function mockShopifyClient() {
  const mockClient = createMockShopifyClient();

  vi.mock('../../server/shopify/client', () => ({
    ShopifyClient: vi.fn(() => mockClient),
  }));

  return mockClient;
}

/**
 * Mock successful API responses
 */
export function mockShopifyApiSuccess() {
  const mockClient = createMockShopifyClient();
  mockClient.mockSuccess();

  vi.mock('../../server/shopify/client', () => ({
    ShopifyClient: vi.fn(() => mockClient),
  }));

  return mockClient;
}

/**
 * Mock API network error
 */
export function mockShopifyApiNetworkError() {
  const mockClient = createMockShopifyClient();
  mockClient.mockFailure('network');

  vi.mock('../../server/shopify/client', () => ({
    ShopifyClient: vi.fn(() => mockClient),
  }));

  return mockClient;
}

/**
 * Mock API rate limit error
 */
export function mockShopifyApiRateLimit() {
  const mockClient = createMockShopifyClient();
  mockClient.mockFailure('rate_limit');

  vi.mock('../../server/shopify/client', () => ({
    ShopifyClient: vi.fn(() => mockClient),
  }));

  return mockClient;
}

/**
 * Mock API not found error
 */
export function mockShopifyApiNotFound() {
  const mockClient = createMockShopifyClient();
  mockClient.mockFailure('not_found');

  vi.mock('../../server/shopify/client', () => ({
    ShopifyClient: vi.fn(() => mockClient),
  }));

  return mockClient;
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/**
 * Build a mock product response
 */
export function buildMockProduct(overrides?: Partial<typeof productUpdatePayload>) {
  return {
    ...productUpdatePayload,
    ...overrides,
  };
}

/**
 * Build a mock price rule response
 */
export function buildMockPriceRule(overrides?: any) {
  return {
    ...shopifyDiscountSuccessResponse.price_rule,
    ...overrides,
  };
}

/**
 * Build a mock discount code response
 */
export function buildMockDiscountCode(overrides?: any) {
  return {
    ...shopifyDiscountSuccessResponse.discount_code,
    ...overrides,
  };
}

// ============================================================================
// WEBHOOK MOCK
// ============================================================================

/**
 * Mock webhook verification
 */
export function mockWebhookVerification(isValid: boolean = true) {
  vi.mock('../../server/shopify/verify-webhook', () => ({
    verifyWebhookHmac: vi.fn(() => isValid),
  }));
}
