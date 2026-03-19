/**
 * Shopify Email Draft Executor Unit Tests
 *
 * Covers:
 *  - Successful draft creation — correct providerResponse shape
 *  - providerResponse always carries status === 'draft'
 *  - providerResponse includes activityId and shopifyAdminUrl
 *  - No ShopifyConnection configured → INVALID_TOKEN, non-retryable
 *  - Connection not active (revoked) → INVALID_TOKEN, non-retryable
 *  - Shopify 401 → INVALID_TOKEN, non-retryable
 *  - Shopify 403 → INVALID_TOKEN, non-retryable
 *  - Shopify 429 → RATE_LIMIT_EXCEEDED, retryable
 *  - Shopify 400 → INVALID_PAYLOAD, non-retryable
 *  - Shopify 422 → INVALID_PAYLOAD, non-retryable
 *  - Shopify 500 → NETWORK_ERROR, retryable
 *  - Shopify 503 → NETWORK_ERROR, retryable
 *  - Network failure (ECONNREFUSED) → NETWORK_ERROR, retryable
 *  - Network failure (ETIMEDOUT) → NETWORK_ERROR, retryable
 *  - Invalid payload (missing required fields) → INVALID_PAYLOAD, non-retryable
 *  - Draft is NEVER sent — always created as draft
 *
 * createShopifyEmailDraft and ShopifyApiError are fully mocked — no DB or network.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { executeShopifyEmailDraft } from '../shopify-email';
import { ExecutionErrorCode } from '../../types';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the createShopifyEmailDraft function from the shopify/email module.
// We control what it resolves or rejects with per test.
const mockCreateShopifyEmailDraft = vi.fn();

vi.mock('../../../shopify/email', () => ({
  createShopifyEmailDraft: (...args: unknown[]) =>
    mockCreateShopifyEmailDraft(...args),
}));

// Re-export ShopifyApiError as a real class so instanceof checks work correctly
// in the error classifier within shopify-email.ts.
vi.mock('../../../shopify/client', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../shopify/client')>();
  return {
    ...original,
    ShopifyApiError: class ShopifyApiError extends Error {
      constructor(
        message: string,
        public statusCode?: number,
        public responseBody?: unknown,
        public correlationId?: string
      ) {
        super(message);
        this.name = 'ShopifyApiError';
      }
    },
  };
});

// ============================================================================
// FIXTURES
// ============================================================================

const WORKSPACE_ID = 'ws-shopify-test-456';

const VALID_PAYLOAD = {
  subject: "We miss you — here's 15% off",
  preview_text: 'Exclusive offer just for you.',
  html_content: '<h1>We miss you!</h1><p>Come back for 15% off.</p>',
  from_name: 'The Store Team',
  recipient_segment: 'dormant_60',
};

const MOCK_DRAFT_RESULT = {
  activityId: 'gid://shopify/EmailMarketingActivity/123456',
  title: "We miss you — here's 15% off",
  status: 'draft' as const,
  recipientCount: 342,
  shopifyAdminUrl: 'https://test-store.myshopify.com/admin/email',
  createdAt: '2026-03-19T10:00:00Z',
};

// ============================================================================
// TESTS
// ============================================================================

describe('executeShopifyEmailDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  // --------------------------------------------------------------------------
  // Success path
  // --------------------------------------------------------------------------

  test('returns success result with correct providerResponse shape', async () => {
    mockCreateShopifyEmailDraft.mockResolvedValueOnce(MOCK_DRAFT_RESULT);

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.providerResponse).not.toBeNull();

    const pr = result.providerResponse!;
    expect(pr.activityId).toBe('gid://shopify/EmailMarketingActivity/123456');
    expect(pr.title).toBe("We miss you — here's 15% off");
    expect(pr.recipientCount).toBe(342);
    expect(pr.shopifyAdminUrl).toBe(
      'https://test-store.myshopify.com/admin/email'
    );
    expect(pr.createdAt).toBe('2026-03-19T10:00:00Z');
  });

  test('providerResponse status is always "draft" — never sent', async () => {
    // Even if the upstream module returns a different status, we always stamp 'draft'
    mockCreateShopifyEmailDraft.mockResolvedValueOnce({
      ...MOCK_DRAFT_RESULT,
      status: 'sent', // Should never happen per contract, but we guard against it
    });

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(true);
    expect(result.providerResponse!.status).toBe('draft');
  });

  test('providerResponse includes activityId', async () => {
    mockCreateShopifyEmailDraft.mockResolvedValueOnce({
      ...MOCK_DRAFT_RESULT,
      activityId: 'gid://shopify/EmailMarketingActivity/999',
    });

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.providerResponse!.activityId).toBe(
      'gid://shopify/EmailMarketingActivity/999'
    );
  });

  test('providerResponse includes shopifyAdminUrl', async () => {
    mockCreateShopifyEmailDraft.mockResolvedValueOnce({
      ...MOCK_DRAFT_RESULT,
      shopifyAdminUrl: 'https://my-store.myshopify.com/admin/email',
    });

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.providerResponse!.shopifyAdminUrl).toBe(
      'https://my-store.myshopify.com/admin/email'
    );
  });

  test('passes correct parameters to createShopifyEmailDraft', async () => {
    mockCreateShopifyEmailDraft.mockResolvedValueOnce(MOCK_DRAFT_RESULT);

    await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(mockCreateShopifyEmailDraft).toHaveBeenCalledOnce();
    expect(mockCreateShopifyEmailDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      subject: "We miss you — here's 15% off",
      previewText: 'Exclusive offer just for you.',
      htmlBody: '<h1>We miss you!</h1><p>Come back for 15% off.</p>',
      fromName: 'The Store Team',
      recipientSegment: 'dormant_60',
    });
  });

  test('omits fromName when from_name is not provided', async () => {
    mockCreateShopifyEmailDraft.mockResolvedValueOnce(MOCK_DRAFT_RESULT);

    const payloadWithoutFromName = {
      ...VALID_PAYLOAD,
      from_name: undefined,
    };

    await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: payloadWithoutFromName,
    });

    const callArgs = mockCreateShopifyEmailDraft.mock.calls[0][0];
    expect(callArgs.fromName).toBeUndefined();
  });

  test('preview_text defaults to empty string when omitted', async () => {
    mockCreateShopifyEmailDraft.mockResolvedValueOnce(MOCK_DRAFT_RESULT);

    const payloadWithoutPreview = {
      subject: 'Hello',
      html_content: '<p>Hello</p>',
      recipient_segment: 'dormant_30',
      // preview_text deliberately omitted — schema default is ''
    };

    await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: payloadWithoutPreview,
    });

    const callArgs = mockCreateShopifyEmailDraft.mock.calls[0][0];
    expect(callArgs.previewText).toBe('');
  });

  // --------------------------------------------------------------------------
  // Payload validation
  // --------------------------------------------------------------------------

  test('returns INVALID_PAYLOAD for missing subject', async () => {
    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: { ...VALID_PAYLOAD, subject: '' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
    expect(mockCreateShopifyEmailDraft).not.toHaveBeenCalled();
  });

  test('returns INVALID_PAYLOAD for missing html_content', async () => {
    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: { ...VALID_PAYLOAD, html_content: '' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
    expect(mockCreateShopifyEmailDraft).not.toHaveBeenCalled();
  });

  test('returns INVALID_PAYLOAD for missing recipient_segment', async () => {
    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: { ...VALID_PAYLOAD, recipient_segment: '' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
    expect(mockCreateShopifyEmailDraft).not.toHaveBeenCalled();
  });

  test('returns INVALID_PAYLOAD for completely empty payload', async () => {
    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
    expect(result.providerResponse).toBeNull();
  });

  // --------------------------------------------------------------------------
  // No connection / revoked connection
  // --------------------------------------------------------------------------

  test('returns INVALID_TOKEN when no Shopify connection exists', async () => {
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new Error('No Shopify connection found for workspace ws-shopify-test-456')
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
    expect(result.providerResponse).toBeNull();
  });

  test('returns INVALID_TOKEN when Shopify connection is not active (revoked)', async () => {
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new Error(
        'Shopify connection is not active for workspace ws-shopify-test-456 (status: revoked)'
      )
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Shopify API errors
  // --------------------------------------------------------------------------

  test('returns INVALID_TOKEN on Shopify 401 — non-retryable', async () => {
    const { ShopifyApiError } = await import('../../../shopify/client');
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new ShopifyApiError('Unauthorized', 401)
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns INVALID_TOKEN on Shopify 403 — non-retryable', async () => {
    const { ShopifyApiError } = await import('../../../shopify/client');
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new ShopifyApiError('Forbidden', 403)
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns RATE_LIMIT_EXCEEDED on Shopify 429 — retryable', async () => {
    const { ShopifyApiError } = await import('../../../shopify/client');
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new ShopifyApiError('Rate limit exceeded', 429)
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.RATE_LIMIT_EXCEEDED);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns INVALID_PAYLOAD on Shopify 400 — non-retryable', async () => {
    const { ShopifyApiError } = await import('../../../shopify/client');
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new ShopifyApiError('Bad request: subject is required', 400)
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns INVALID_PAYLOAD on Shopify 422 — non-retryable', async () => {
    const { ShopifyApiError } = await import('../../../shopify/client');
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new ShopifyApiError('Unprocessable entity: html_body is invalid', 422)
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns NETWORK_ERROR on Shopify 500 — retryable', async () => {
    const { ShopifyApiError } = await import('../../../shopify/client');
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new ShopifyApiError('Internal Server Error', 500)
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns NETWORK_ERROR on Shopify 503 — retryable', async () => {
    const { ShopifyApiError } = await import('../../../shopify/client');
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new ShopifyApiError('Service Unavailable', 503)
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Network / timeout failures
  // --------------------------------------------------------------------------

  test('returns NETWORK_ERROR on ECONNREFUSED — retryable', async () => {
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new Error('ECONNREFUSED')
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns NETWORK_ERROR on ETIMEDOUT — retryable', async () => {
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(new Error('ETIMEDOUT'));

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns NETWORK_ERROR on fetch failed — retryable', async () => {
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new Error('fetch failed')
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Unknown errors
  // --------------------------------------------------------------------------

  test('returns UNKNOWN_ERROR for unexpected errors — non-retryable', async () => {
    mockCreateShopifyEmailDraft.mockRejectedValueOnce(
      new Error('Something totally unexpected')
    );

    const result = await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.UNKNOWN_ERROR);
    expect(result.error?.retryable).toBe(false);
    expect(result.providerResponse).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Draft safety guarantee
  // --------------------------------------------------------------------------

  test('createShopifyEmailDraft is called exactly once and never followed by a send', async () => {
    mockCreateShopifyEmailDraft.mockResolvedValueOnce(MOCK_DRAFT_RESULT);

    await executeShopifyEmailDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    // Only createShopifyEmailDraft should be called — no send trigger
    expect(mockCreateShopifyEmailDraft).toHaveBeenCalledOnce();
  });
});
