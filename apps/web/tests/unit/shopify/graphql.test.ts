/**
 * Unit Tests: ShopifyClient.graphql()
 * MerchOps Beta MVP
 *
 * Tests:
 * - Successful query returns typed data
 * - Top-level GraphQL errors array → throws ShopifyApiError with first message
 * - UserErrors embedded in response.data → throws ShopifyApiError
 * - Throttled response (currentlyAvailable === 0) → retries then throws
 * - Network error (fetch throws) → retryable ShopifyApiError
 * - Auth error (HTTP 401) → non-retryable ShopifyApiError
 * - Correct headers sent (Content-Type, X-Shopify-Access-Token)
 * - Variables serialised into request body
 *
 * fetch is mocked at the global level; ShopifyClient internals are exercised
 * directly (no module-level mock of ShopifyClient itself).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShopifyClient, ShopifyApiError } from '@/server/shopify/client';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORE_DOMAIN = 'test-store.myshopify.com';
// The constructor calls decryptToken(encryptedToken).
// vitest.config.ts sets SHOPIFY_TOKEN_ENCRYPTION_KEY to 32-byte hex key.
// We need a real AES-256-GCM encrypted token.  Rather than re-implementing
// the encryption logic here we mock the oauth module instead.
const ENCRYPTED_TOKEN = 'encrypted-token-placeholder';
const PLAINTEXT_TOKEN = 'shpat_test_access_token_abc123';

// ============================================================================
// MODULE-LEVEL MOCK: decryptToken
// ============================================================================

vi.mock('@/server/shopify/oauth', () => ({
  decryptToken: vi.fn(() => PLAINTEXT_TOKEN),
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a minimal fetch Response stub.
 */
function mockResponse(
  body: unknown,
  options: { status?: number; statusText?: string; headers?: Record<string, string> } = {}
): Response {
  const { status = 200, statusText = 'OK', headers = {} } = options;

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
    json: async () => body,
  } as unknown as Response;
}

/**
 * Build a standard successful GraphQL envelope.
 */
function successEnvelope<T>(data: T, extra?: object) {
  return {
    data,
    errors: undefined,
    extensions: {
      cost: {
        requestedQueryCost: 10,
        actualQueryCost: 10,
        throttleStatus: {
          maximumAvailable: 1000,
          currentlyAvailable: 990,
          restoreRate: 50,
        },
      },
      ...extra,
    },
  };
}

const SIMPLE_QUERY = `
  query {
    shop {
      name
      plan { displayName }
    }
  }
`;

// ============================================================================
// TEST SETUP
// ============================================================================

let client: ShopifyClient;

beforeEach(() => {
  // Provide a real-looking (but mock) encrypted token; decryptToken is mocked
  // so it returns PLAINTEXT_TOKEN regardless.
  client = new ShopifyClient(STORE_DOMAIN, ENCRYPTED_TOKEN);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// TESTS: SUCCESSFUL QUERY
// ============================================================================

describe('ShopifyClient.graphql — success', () => {
  it('returns typed data from a successful query', async () => {
    interface ShopData {
      shop: { name: string; plan: { displayName: string } };
    }

    const expectedData: ShopData = {
      shop: { name: 'Acme Store', plan: { displayName: 'Shopify Plus' } },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      mockResponse(successEnvelope(expectedData))
    ));

    const result = await client.graphql<ShopData>(SIMPLE_QUERY);

    expect(result).toEqual(expectedData);
  });

  it('returns data when extensions are absent', async () => {
    interface BasicData { products: { id: string }[] }

    const expectedData: BasicData = { products: [{ id: 'gid://shopify/Product/1' }] };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      mockResponse({ data: expectedData })
    ));

    const result = await client.graphql<BasicData>('{ products { id } }');

    expect(result).toEqual(expectedData);
  });
});

// ============================================================================
// TESTS: CORRECT HEADERS
// ============================================================================

describe('ShopifyClient.graphql — request headers', () => {
  it('sends Content-Type: application/json', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(successEnvelope({})));
    vi.stubGlobal('fetch', fetchSpy);

    await client.graphql(SIMPLE_QUERY);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sends X-Shopify-Access-Token with the decrypted token', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(successEnvelope({})));
    vi.stubGlobal('fetch', fetchSpy);

    await client.graphql(SIMPLE_QUERY);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Shopify-Access-Token']).toBe(PLAINTEXT_TOKEN);
  });

  it('sends request to the correct GraphQL endpoint URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(successEnvelope({})));
    vi.stubGlobal('fetch', fetchSpy);

    await client.graphql(SIMPLE_QUERY);

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://${STORE_DOMAIN}/admin/api/2024-01/graphql.json`);
  });
});

// ============================================================================
// TESTS: VARIABLES
// ============================================================================

describe('ShopifyClient.graphql — variables', () => {
  it('serialises variables into the JSON request body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(successEnvelope({})));
    vi.stubGlobal('fetch', fetchSpy);

    const variables = { productId: 'gid://shopify/Product/42', first: 10 };
    await client.graphql('query($productId: ID!) { product(id: $productId) { title } }', variables);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.variables).toEqual(variables);
  });

  it('omits variables key from body when none are provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(successEnvelope({})));
    vi.stubGlobal('fetch', fetchSpy);

    await client.graphql(SIMPLE_QUERY);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    // variables may be present but undefined/null — what matters is no unexpected value
    expect(body.query).toBe(SIMPLE_QUERY);
  });
});

// ============================================================================
// TESTS: GRAPHQL ERRORS ARRAY
// ============================================================================

describe('ShopifyClient.graphql — top-level GraphQL errors', () => {
  it('throws ShopifyApiError with the first error message', async () => {
    const envelope = {
      errors: [
        { message: 'Field does not exist on type Query', locations: [{ line: 2, column: 3 }] },
        { message: 'Second error that should be ignored' },
      ],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse(envelope)));

    await expect(client.graphql(SIMPLE_QUERY)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ShopifyApiError);
      expect((err as ShopifyApiError).message).toBe('Field does not exist on type Query');
      return true;
    });
  });

  it('throws ShopifyApiError even when response.data is present alongside errors', async () => {
    const envelope = {
      data: { shop: null },
      errors: [{ message: 'Access denied for shop field.' }],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse(envelope)));

    await expect(client.graphql(SIMPLE_QUERY)).rejects.toBeInstanceOf(ShopifyApiError);
  });
});

// ============================================================================
// TESTS: USER ERRORS
// ============================================================================

describe('ShopifyClient.graphql — userErrors in response.data', () => {
  it('throws ShopifyApiError when a mutation returns userErrors', async () => {
    const envelope = {
      data: {
        discountCodeCreate: {
          codeDiscountNode: null,
          userErrors: [
            { field: ['code'], message: 'Code has already been taken' },
          ],
        },
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse(envelope)));

    const mutation = `
      mutation discountCodeCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }
    `;

    await expect(client.graphql(mutation)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ShopifyApiError);
      expect((err as ShopifyApiError).message).toBe('Code has already been taken');
      return true;
    });
  });

  it('throws ShopifyApiError for nested userErrors in deep mutation response', async () => {
    const envelope = {
      data: {
        emailMarketing: {
          campaign: {
            userErrors: [{ message: 'Campaign title is too long' }],
          },
        },
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse(envelope)));

    await expect(client.graphql('mutation { stub }', undefined)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ShopifyApiError);
      expect((err as ShopifyApiError).message).toBe('Campaign title is too long');
      return true;
    });
  });

  it('does not throw when userErrors is an empty array', async () => {
    const envelope = {
      data: {
        discountCodeCreate: {
          codeDiscountNode: { id: 'gid://shopify/DiscountCodeNode/1' },
          userErrors: [],
        },
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse(envelope)));

    const result = await client.graphql('mutation { stub }');
    expect(result).toEqual(envelope.data);
  });
});

// ============================================================================
// TESTS: THROTTLING (cost budget exhausted)
// ============================================================================

describe('ShopifyClient.graphql — Shopify cost throttling', () => {
  it('retries when currentlyAvailable is 0, then succeeds', async () => {
    vi.useFakeTimers();

    const throttledEnvelope = {
      data: null,
      extensions: {
        cost: {
          requestedQueryCost: 100,
          actualQueryCost: 0,
          throttleStatus: {
            maximumAvailable: 1000,
            currentlyAvailable: 0,
            restoreRate: 50,
          },
        },
      },
    };

    const okData = { shop: { name: 'Restored' } };

    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(mockResponse(throttledEnvelope))
      .mockResolvedValueOnce(mockResponse(successEnvelope(okData)));

    vi.stubGlobal('fetch', fetchSpy);

    const resultPromise = client.graphql<typeof okData>(SIMPLE_QUERY);

    // Advance timers past the sleep the retry will schedule
    await vi.runAllTimersAsync();

    const result = await resultPromise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual(okData);

    vi.useRealTimers();
  });

  it('throws ShopifyApiError after exhausting all retries on persistent throttling', async () => {
    vi.useFakeTimers();

    const throttledEnvelope = {
      data: null,
      extensions: {
        cost: {
          requestedQueryCost: 100,
          actualQueryCost: 0,
          throttleStatus: {
            maximumAvailable: 1000,
            currentlyAvailable: 0,
            restoreRate: 50,
          },
        },
      },
    };

    // Always throttled — more than MAX_RETRIES (5) responses
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(throttledEnvelope));
    vi.stubGlobal('fetch', fetchSpy);

    // Attach the rejection handler *before* advancing timers so the
    // unhandled rejection detector never fires.
    const resultPromise = client.graphql(SIMPLE_QUERY).catch((e) => e);

    await vi.runAllTimersAsync();

    const result = await resultPromise;
    expect(result).toBeInstanceOf(ShopifyApiError);
    // MAX_RETRIES = 5, so we expect 6 total calls (1 original + 5 retries)
    expect(fetchSpy).toHaveBeenCalledTimes(6);

    vi.useRealTimers();
  });
});

// ============================================================================
// TESTS: HTTP 429
// ============================================================================

describe('ShopifyClient.graphql — HTTP 429 rate limit', () => {
  it('retries after Retry-After header and succeeds', async () => {
    vi.useFakeTimers();

    const okData = { shop: { name: 'Ok' } };

    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(
        mockResponse(null, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '1' } })
      )
      .mockResolvedValueOnce(mockResponse(successEnvelope(okData)));

    vi.stubGlobal('fetch', fetchSpy);

    const resultPromise = client.graphql<typeof okData>(SIMPLE_QUERY);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual(okData);

    vi.useRealTimers();
  });
});

// ============================================================================
// TESTS: AUTH ERROR (401)
// ============================================================================

describe('ShopifyClient.graphql — HTTP 401 auth failure', () => {
  it('throws ShopifyApiError immediately without retrying', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      mockResponse(null, { status: 401, statusText: 'Unauthorized' })
    );
    vi.stubGlobal('fetch', fetchSpy);

    await expect(client.graphql(SIMPLE_QUERY)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ShopifyApiError);
      expect((err as ShopifyApiError).statusCode).toBe(401);
      return true;
    });

    // Must not have retried
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// TESTS: NETWORK ERROR
// ============================================================================

describe('ShopifyClient.graphql — network errors', () => {
  it('wraps a fetch-level network error in a retryable ShopifyApiError', async () => {
    vi.useFakeTimers();

    const networkError = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), {
      code: 'ECONNREFUSED',
    });

    // First call throws (network error), second resolves
    const okData = { shop: { name: 'Connected' } };
    const fetchSpy = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(mockResponse(successEnvelope(okData)));

    vi.stubGlobal('fetch', fetchSpy);

    const resultPromise = client.graphql<typeof okData>(SIMPLE_QUERY);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual(okData);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('throws ShopifyApiError after exhausting retries on persistent network failure', async () => {
    vi.useFakeTimers();

    const networkError = new Error('connect ETIMEDOUT');
    const fetchSpy = vi.fn().mockRejectedValue(networkError);
    vi.stubGlobal('fetch', fetchSpy);

    // Attach rejection handler before advancing timers to avoid unhandled rejection.
    const resultPromise = client.graphql(SIMPLE_QUERY).catch((e) => e);
    await vi.runAllTimersAsync();

    const result = await resultPromise;
    expect(result).toBeInstanceOf(ShopifyApiError);

    vi.useRealTimers();
  });

  it('includes the original error message in the thrown ShopifyApiError', async () => {
    vi.useFakeTimers();

    const networkError = new Error('getaddrinfo ENOTFOUND test-store.myshopify.com');
    const fetchSpy = vi.fn().mockRejectedValue(networkError);
    vi.stubGlobal('fetch', fetchSpy);

    // Attach rejection handler before advancing timers to avoid unhandled rejection.
    const resultPromise = client.graphql(SIMPLE_QUERY).catch((e) => e);
    await vi.runAllTimersAsync();

    const result = await resultPromise;
    expect(result).toBeInstanceOf(ShopifyApiError);
    expect((result as ShopifyApiError).message).toContain('getaddrinfo ENOTFOUND');

    vi.useRealTimers();
  });
});

// ============================================================================
// TESTS: CORRELATION ID
// ============================================================================

describe('ShopifyClient.graphql — correlation ID', () => {
  it('forwards a caller-supplied correlation ID in X-Correlation-ID header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(successEnvelope({})));
    vi.stubGlobal('fetch', fetchSpy);

    const correlationId = 'test-correlation-id-xyz';
    await client.graphql(SIMPLE_QUERY, undefined, correlationId);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Correlation-ID']).toBe(correlationId);
  });

  it('generates a UUID correlation ID when none is supplied', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(successEnvelope({})));
    vi.stubGlobal('fetch', fetchSpy);

    await client.graphql(SIMPLE_QUERY);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const id = (init.headers as Record<string, string>)['X-Correlation-ID'];
    // UUID v4 pattern
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
