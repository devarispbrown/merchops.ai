/**
 * KlaviyoSegment Executor Unit Tests
 *
 * Covers:
 *  - Success path: correct providerResponse shape
 *  - No connection error → INVALID_TOKEN, non-retryable
 *  - Revoked connection → INVALID_TOKEN, non-retryable
 *  - Klaviyo 401 → INVALID_TOKEN, non-retryable
 *  - Klaviyo 429 → RATE_LIMIT_EXCEEDED, retryable
 *  - Klaviyo 5xx → NETWORK_ERROR, retryable
 *  - Invalid payload (missing segment_type) → INVALID_PAYLOAD
 *  - Network failure → NETWORK_ERROR, retryable
 *
 * syncSegmentToKlaviyo is mocked — no DB or network.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { executeKlaviyoSegment } from '../../actions/execute/klaviyo-segment';
import { ExecutionErrorCode } from '../../actions/types';

// ============================================================================
// MOCKS
// ============================================================================

const mockSyncSegment = vi.fn();

vi.mock('../../klaviyo/segments', () => ({
  syncSegmentToKlaviyo: (...args: unknown[]) => mockSyncSegment(...args),
}));

// Provide KlaviyoApiError as a real class so instanceof checks work
vi.mock('../../klaviyo/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../klaviyo/client')>();
  return {
    ...original,
    KlaviyoApiError: class KlaviyoApiError extends Error {
      constructor(
        message: string,
        public status: number,
        public errors: unknown[] = [],
        public correlationId?: string
      ) {
        super(message);
        this.name = 'KlaviyoApiError';
      }
    },
  };
});

// ============================================================================
// HELPERS
// ============================================================================

const WORKSPACE_ID = 'ws-test';

// ============================================================================
// TESTS
// ============================================================================

describe('executeKlaviyoSegment', () => {
  beforeEach(() => vi.clearAllMocks());

  // --------------------------------------------------------------------------
  // Success path
  // --------------------------------------------------------------------------
  test('returns success result with correct providerResponse shape', async () => {
    mockSyncSegment.mockResolvedValueOnce({
      listId: 'list-abc',
      listName: 'MerchOps - Dormant 60 Days',
      profileCount: 42,
    });

    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_60' },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.providerResponse).not.toBeNull();
    expect(result.providerResponse!.listId).toBe('list-abc');
    expect(result.providerResponse!.listName).toBe('MerchOps - Dormant 60 Days');
    expect(result.providerResponse!.profileCount).toBe(42);
    expect(result.providerResponse!.klaviyoUrl).toContain('list-abc');
    expect(result.providerResponse!.syncedAt).toBeTruthy();
  });

  test('passes list_name override to syncSegmentToKlaviyo', async () => {
    mockSyncSegment.mockResolvedValueOnce({
      listId: 'list-xyz',
      listName: 'My Custom List',
      profileCount: 10,
    });

    await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_30', list_name: 'My Custom List' },
    });

    expect(mockSyncSegment).toHaveBeenCalledWith(
      WORKSPACE_ID,
      'dormant_30',
      'My Custom List'
    );
  });

  // --------------------------------------------------------------------------
  // Payload validation
  // --------------------------------------------------------------------------
  test('returns INVALID_PAYLOAD for missing segment_type', async () => {
    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: {} as { segment_type: string },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
    expect(mockSyncSegment).not.toHaveBeenCalled();
  });

  test('returns INVALID_PAYLOAD for empty segment_type', async () => {
    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: '' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
  });

  // --------------------------------------------------------------------------
  // No connection
  // --------------------------------------------------------------------------
  test('returns INVALID_TOKEN when no Klaviyo connection exists', async () => {
    mockSyncSegment.mockRejectedValueOnce(
      new Error('No Klaviyo connection found for workspace ws-test')
    );

    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_60' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns INVALID_TOKEN when connection is not active', async () => {
    mockSyncSegment.mockRejectedValueOnce(
      new Error('Klaviyo connection is not active for workspace ws-test (status: revoked)')
    );

    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_60' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Klaviyo API errors
  // --------------------------------------------------------------------------
  test('returns INVALID_TOKEN on Klaviyo 401', async () => {
    const { KlaviyoApiError } = await import('../../klaviyo/client');
    mockSyncSegment.mockRejectedValueOnce(
      new KlaviyoApiError('Unauthorized', 401, [])
    );

    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_60' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns RATE_LIMIT_EXCEEDED on Klaviyo 429 and is retryable', async () => {
    const { KlaviyoApiError } = await import('../../klaviyo/client');
    mockSyncSegment.mockRejectedValueOnce(
      new KlaviyoApiError('Rate limit exceeded', 429, [])
    );

    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_60' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.RATE_LIMIT_EXCEEDED);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns NETWORK_ERROR on Klaviyo 503 and is retryable', async () => {
    const { KlaviyoApiError } = await import('../../klaviyo/client');
    mockSyncSegment.mockRejectedValueOnce(
      new KlaviyoApiError('Service Unavailable', 503, [])
    );

    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_60' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns INVALID_PAYLOAD on Klaviyo 400', async () => {
    const { KlaviyoApiError } = await import('../../klaviyo/client');
    mockSyncSegment.mockRejectedValueOnce(
      new KlaviyoApiError('Bad request', 400, [{ detail: 'email is required' }])
    );

    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_60' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Network failure
  // --------------------------------------------------------------------------
  test('returns NETWORK_ERROR on fetch failure and is retryable', async () => {
    mockSyncSegment.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_60' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  // --------------------------------------------------------------------------
  // providerResponse null on failure
  // --------------------------------------------------------------------------
  test('providerResponse is null on failure', async () => {
    mockSyncSegment.mockRejectedValueOnce(new Error('No Klaviyo connection found for workspace ws-test'));

    const result = await executeKlaviyoSegment({
      workspaceId: WORKSPACE_ID,
      payload: { segment_type: 'dormant_60' },
    });

    expect(result.providerResponse).toBeNull();
  });
});
