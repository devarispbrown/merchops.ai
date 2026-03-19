/**
 * Unit Tests: Discount Execution
 * MerchOps Beta MVP
 *
 * Tests:
 * - Successful discount creation flow (price rule + discount code)
 * - Rate limit error (429) → retryable classification
 * - 404 → non-retryable classification
 * - 422 validation error → non-retryable classification
 * - Rollback / disable flow (delete price rule)
 * - No active Shopify connection error
 * - Network error → retryable classification
 *
 * The ShopifyClient is mocked at the module level; no HTTP layer is touched.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionErrorCode } from '@/server/actions/types';

// ============================================================================
// MODULE-LEVEL MOCKS
// ============================================================================

// Mock instances are shared so individual tests can reconfigure them.
const mockCreatePriceRule = vi.fn();
const mockCreateDiscountCode = vi.fn();
const mockDeletePriceRule = vi.fn();

const mockShopifyClientInstance = {
  createPriceRule: mockCreatePriceRule,
  createDiscountCode: mockCreateDiscountCode,
  deletePriceRule: mockDeletePriceRule,
};

// ShopifyApiError is a real class; keep a reference so tests can construct it.
class MockShopifyApiError extends Error {
  statusCode?: number;
  responseBody?: unknown;
  correlationId?: string;

  constructor(
    message: string,
    statusCode?: number,
    responseBody?: unknown,
    correlationId?: string
  ) {
    super(message);
    this.name = 'ShopifyApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.correlationId = correlationId;
  }
}

vi.mock('@/server/shopify/client', () => ({
  // Must be a class/constructor so `new ShopifyClient(...)` works.
  ShopifyClient: vi.fn(function () {
    return mockShopifyClientInstance;
  }),
  ShopifyApiError: MockShopifyApiError,
}));

// Mock database — returns an active connection by default.
const mockFindFirst = vi.fn();

vi.mock('@/server/db', () => ({
  db: {
    shopifyConnection: {
      findFirst: mockFindFirst,
    },
  },
}));

// ============================================================================
// FIXTURES
// ============================================================================

const TEST_WORKSPACE_ID = 'workspace-test-123';

const testConnection = {
  id: 'conn-1',
  workspace_id: TEST_WORKSPACE_ID,
  store_domain: 'test-store.myshopify.com',
  access_token_encrypted: 'encrypted-token-xyz',
  scopes: 'read_products,write_products,write_price_rules,write_discounts',
  status: 'active' as const,
  installed_at: new Date('2024-01-01T00:00:00Z'),
  revoked_at: null,
};

const testPayload = {
  title: 'Winter Clearance 25%',
  code: 'WINTER25',
  discount_type: 'percentage' as const,
  value: 25,
  target_type: 'entire_order' as const,
  starts_at: '2024-01-16T00:00:00.000Z',
  ends_at: '2024-01-31T23:59:59.000Z',
  usage_limit: 500,
  minimum_purchase_amount: 50,
};

const shopifyPriceRuleResponse = {
  price_rule: {
    id: 987654321098,
    title: 'Winter Clearance 25%',
    target_type: 'line_item',
    target_selection: 'all',
    allocation_method: 'across',
    value_type: 'percentage',
    value: '-25.0',
    customer_selection: 'all',
    starts_at: '2024-01-16T00:00:00Z',
    ends_at: '2024-01-31T23:59:59Z',
    usage_limit: 500,
    created_at: '2024-01-15T13:00:15Z',
    updated_at: '2024-01-15T13:00:15Z',
  },
};

const shopifyDiscountCodeResponse = {
  discount_code: {
    id: 123456789012,
    price_rule_id: 987654321098,
    code: 'WINTER25',
    usage_count: 0,
    created_at: '2024-01-15T13:00:16Z',
    updated_at: '2024-01-15T13:00:16Z',
  },
};

// ============================================================================
// TEST SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  // Default: active connection exists
  mockFindFirst.mockResolvedValue(testConnection);

  // Default: successful API calls
  mockCreatePriceRule.mockResolvedValue(shopifyPriceRuleResponse);
  mockCreateDiscountCode.mockResolvedValue(shopifyDiscountCodeResponse);
  mockDeletePriceRule.mockResolvedValue(undefined);
});

// ============================================================================
// TESTS: SUCCESSFUL DISCOUNT CREATION
// ============================================================================

describe('executeDiscount — success path', () => {
  it('returns success with real price rule and discount code from Shopify', async () => {
    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.providerResponse.provider).toBe('shopify');
    expect(result.providerResponse.priceRule).toEqual(shopifyPriceRuleResponse.price_rule);
    expect(result.providerResponse.discountCode).toEqual(shopifyDiscountCodeResponse.discount_code);
    expect(result.providerResponse.createdAt).toBeDefined();
  });

  it('calls ShopifyClient constructor with shop domain and encrypted token', async () => {
    const { ShopifyClient } = await import('@/server/shopify/client');
    const { executeDiscount } = await import('@/server/actions/execute/discount');

    await executeDiscount({ workspaceId: TEST_WORKSPACE_ID, payload: testPayload });

    expect(ShopifyClient).toHaveBeenCalledWith(
      testConnection.store_domain,
      testConnection.access_token_encrypted
    );
  });

  it('creates price rule with correct Shopify field mapping', async () => {
    const { executeDiscount } = await import('@/server/actions/execute/discount');

    await executeDiscount({ workspaceId: TEST_WORKSPACE_ID, payload: testPayload });

    expect(mockCreatePriceRule).toHaveBeenCalledOnce();

    const [priceRuleArg] = mockCreatePriceRule.mock.calls[0] as [Record<string, unknown>];
    expect(priceRuleArg.title).toBe(testPayload.title);
    expect(priceRuleArg.value_type).toBe('percentage');
    expect(priceRuleArg.value).toBe('-25');
    expect(priceRuleArg.target_type).toBe('line_item');
    expect(priceRuleArg.allocation_method).toBe('across');
    expect(priceRuleArg.starts_at).toBe(testPayload.starts_at);
    expect(priceRuleArg.ends_at).toBe(testPayload.ends_at);
    expect(priceRuleArg.usage_limit).toBe(testPayload.usage_limit);
    expect((priceRuleArg.prerequisite_subtotal_range as any).greater_than_or_equal_to).toBe('50');
  });

  it('maps fixed_amount discount type with negated cent value', async () => {
    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const fixedPayload = { ...testPayload, discount_type: 'fixed_amount' as const, value: 10 };
    await executeDiscount({ workspaceId: TEST_WORKSPACE_ID, payload: fixedPayload });

    const [priceRuleArg] = mockCreatePriceRule.mock.calls[0] as [Record<string, unknown>];
    expect(priceRuleArg.value_type).toBe('fixed_amount');
    expect(priceRuleArg.value).toBe('-1000.00');
  });

  it('creates discount code under the correct price rule ID', async () => {
    const { executeDiscount } = await import('@/server/actions/execute/discount');

    await executeDiscount({ workspaceId: TEST_WORKSPACE_ID, payload: testPayload });

    expect(mockCreateDiscountCode).toHaveBeenCalledOnce();
    const [priceRuleId, codeArg] = mockCreateDiscountCode.mock.calls[0] as [
      number,
      Record<string, unknown>
    ];
    expect(priceRuleId).toBe(shopifyPriceRuleResponse.price_rule.id);
    expect(codeArg.code).toBe(testPayload.code);
  });

  it('generates a discount code when payload.code is not provided', async () => {
    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const payloadWithoutCode = { ...testPayload, code: undefined };
    await executeDiscount({ workspaceId: TEST_WORKSPACE_ID, payload: payloadWithoutCode });

    const [, codeArg] = mockCreateDiscountCode.mock.calls[0] as [
      number,
      Record<string, unknown>
    ];
    expect(typeof codeArg.code).toBe('string');
    expect((codeArg.code as string).length).toBeGreaterThan(0);
  });

  it('sets entitled_product_ids when target_type is product and target_ids provided', async () => {
    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const productPayload = {
      ...testPayload,
      target_type: 'product' as const,
      target_ids: ['123', '456'],
    };
    await executeDiscount({ workspaceId: TEST_WORKSPACE_ID, payload: productPayload });

    const [priceRuleArg] = mockCreatePriceRule.mock.calls[0] as [Record<string, unknown>];
    expect(priceRuleArg.target_selection).toBe('entitled');
    expect(priceRuleArg.entitled_product_ids).toEqual(['123', '456']);
  });

  it('omits optional fields when not provided', async () => {
    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const minimalPayload = {
      title: 'Minimal Discount',
      discount_type: 'percentage' as const,
      value: 10,
      target_type: 'entire_order' as const,
      starts_at: '2024-02-01T00:00:00.000Z',
    };
    await executeDiscount({ workspaceId: TEST_WORKSPACE_ID, payload: minimalPayload });

    const [priceRuleArg] = mockCreatePriceRule.mock.calls[0] as [Record<string, unknown>];
    expect(priceRuleArg.ends_at).toBeUndefined();
    expect(priceRuleArg.usage_limit).toBeUndefined();
    expect(priceRuleArg.prerequisite_subtotal_range).toBeUndefined();
  });
});

// ============================================================================
// TESTS: NO CONNECTION ERROR
// ============================================================================

describe('executeDiscount — no active Shopify connection', () => {
  it('returns failure when no active connection found', async () => {
    mockFindFirst.mockResolvedValue(null);

    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(false);
    expect(result.providerResponse).toBeNull();
    // Error falls through to the default SHOPIFY_API_ERROR classification
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// TESTS: ERROR CLASSIFICATION
// ============================================================================

describe('executeDiscount — rate limit (429) → retryable', () => {
  it('classifies a 429 ShopifyApiError as RATE_LIMIT_EXCEEDED and retryable', async () => {
    const rateLimitError = new MockShopifyApiError(
      'Rate limit exceeded',
      429,
      undefined,
      'corr-abc'
    );
    mockCreatePriceRule.mockRejectedValue(rateLimitError);

    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.RATE_LIMIT_EXCEEDED);
    expect(result.error?.retryable).toBe(true);
  });

  it('classifies a 429 on discount code creation as retryable', async () => {
    // Price rule succeeds; discount code creation gets rate-limited.
    const rateLimitError = new MockShopifyApiError('Rate limit exceeded', 429);
    mockCreateDiscountCode.mockRejectedValue(rateLimitError);

    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.RATE_LIMIT_EXCEEDED);
    expect(result.error?.retryable).toBe(true);
  });
});

describe('executeDiscount — 404 Not Found → non-retryable', () => {
  it('classifies a 404 ShopifyApiError as non-retryable', async () => {
    const notFoundError = new MockShopifyApiError(
      'Shopify API error: Not Found',
      404,
      { errors: 'Not Found' },
      'corr-404'
    );
    mockCreatePriceRule.mockRejectedValue(notFoundError);

    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.SHOPIFY_API_ERROR);
    expect(result.error?.retryable).toBe(false);
  });
});

describe('executeDiscount — 422 Validation → non-retryable', () => {
  it('classifies a 422 as INVALID_PAYLOAD and non-retryable', async () => {
    const validationError = new MockShopifyApiError(
      'Shopify API error: Unprocessable Entity',
      422,
      { errors: { code: ['has already been taken'] } },
      'corr-422'
    );
    mockCreateDiscountCode.mockRejectedValue(validationError);

    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
    expect(result.error?.message).toContain('already been taken');
  });

  it('classifies a 422 with string error body', async () => {
    const validationError = new MockShopifyApiError(
      'Shopify API error: Unprocessable Entity',
      422,
      { errors: 'Title has already been taken' }
    );
    mockCreatePriceRule.mockRejectedValue(validationError);

    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.message).toContain('already been taken');
  });
});

describe('executeDiscount — 401 Auth → non-retryable', () => {
  it('classifies a 401 as INVALID_TOKEN and non-retryable', async () => {
    const authError = new MockShopifyApiError(
      'Shopify API error: Unauthorized',
      401,
      undefined,
      'corr-401'
    );
    mockCreatePriceRule.mockRejectedValue(authError);

    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });
});

describe('executeDiscount — network error → retryable', () => {
  it('classifies ECONNREFUSED as NETWORK_ERROR and retryable', async () => {
    const networkError = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    mockCreatePriceRule.mockRejectedValue(networkError);

    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  it('classifies ETIMEDOUT as NETWORK_ERROR and retryable', async () => {
    const timeoutError = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
    mockCreatePriceRule.mockRejectedValue(timeoutError);

    const { executeDiscount } = await import('@/server/actions/execute/discount');

    const result = await executeDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      payload: testPayload,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });
});

// ============================================================================
// TESTS: ROLLBACK / DISABLE
// ============================================================================

describe('rollbackDiscount', () => {
  it('deletes the price rule via ShopifyClient.deletePriceRule', async () => {
    const { rollbackDiscount } = await import('@/server/actions/execute/discount');

    await rollbackDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      providerResponse: {
        priceRule: { id: 987654321098 },
        discountCode: { id: 123456789012, code: 'WINTER25' },
      },
    });

    expect(mockDeletePriceRule).toHaveBeenCalledOnce();
    expect(mockDeletePriceRule).toHaveBeenCalledWith(987654321098);
  });

  it('does not throw and logs a warning when priceRule ID is missing', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rollbackDiscount } = await import('@/server/actions/execute/discount');

    await expect(
      rollbackDiscount({
        workspaceId: TEST_WORKSPACE_ID,
        providerResponse: {},
      })
    ).resolves.not.toThrow();

    expect(mockDeletePriceRule).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[ROLLBACK] No price rule ID found in provider response'
    );

    consoleWarnSpy.mockRestore();
  });

  it('propagates errors from deletePriceRule', async () => {
    const deleteError = new MockShopifyApiError('Shopify API error: Not Found', 404);
    mockDeletePriceRule.mockRejectedValue(deleteError);

    const { rollbackDiscount } = await import('@/server/actions/execute/discount');

    await expect(
      rollbackDiscount({
        workspaceId: TEST_WORKSPACE_ID,
        providerResponse: { priceRule: { id: 987654321098 } },
      })
    ).rejects.toThrow();
  });

  it('instantiates ShopifyClient with the workspace connection for rollback', async () => {
    const { ShopifyClient } = await import('@/server/shopify/client');
    const { rollbackDiscount } = await import('@/server/actions/execute/discount');

    await rollbackDiscount({
      workspaceId: TEST_WORKSPACE_ID,
      providerResponse: { priceRule: { id: 987654321098 } },
    });

    expect(ShopifyClient).toHaveBeenCalledWith(
      testConnection.store_domain,
      testConnection.access_token_encrypted
    );
  });
});
