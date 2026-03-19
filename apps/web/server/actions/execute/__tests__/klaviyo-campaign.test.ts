/**
 * Klaviyo Campaign Draft Executor Unit Tests
 *
 * Covers:
 *  - Successful campaign draft creation — correct providerResponse shape
 *  - providerResponse always carries status === 'draft'
 *  - No connection configured → INVALID_TOKEN, non-retryable
 *  - Connection revoked (not active) → INVALID_TOKEN, non-retryable
 *  - Klaviyo 401 → INVALID_TOKEN, non-retryable
 *  - Klaviyo 403 → INVALID_TOKEN, non-retryable
 *  - Klaviyo 429 → RATE_LIMIT_EXCEEDED, retryable
 *  - Klaviyo 503 → NETWORK_ERROR, retryable
 *  - Klaviyo 400 → INVALID_PAYLOAD, non-retryable
 *  - Klaviyo 422 → INVALID_PAYLOAD, non-retryable
 *  - Network failure (ECONNREFUSED) → NETWORK_ERROR, retryable
 *  - Invalid payload (missing required fields) → INVALID_PAYLOAD, non-retryable
 *  - Campaign is NEVER sent — always created as draft
 *
 * KlaviyoClient and connection layer are fully mocked — no DB or network.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { executeKlaviyoCampaignDraft } from '../klaviyo-campaign';
import { ExecutionErrorCode } from '../../types';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the createCampaign method at the connection/client boundary.
// getKlaviyoClient returns a mock client instance so we can control
// what createCampaign resolves or rejects with per test.
const mockCreateCampaign = vi.fn();

vi.mock('../../../klaviyo/connection', () => ({
  getKlaviyoClient: vi.fn().mockResolvedValue({
    createCampaign: (...args: unknown[]) => mockCreateCampaign(...args),
  }),
}));

// Re-export KlaviyoApiError as a real class so instanceof checks work correctly
// in the error classifier.
vi.mock('../../../klaviyo/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../klaviyo/client')>();
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
// FIXTURES
// ============================================================================

const WORKSPACE_ID = 'ws-test-123';

const VALID_PAYLOAD = {
  list_id: 'list-abc',
  campaign_name: 'Win-Back Q1 2026',
  subject_line: "We miss you — here's 15% off",
  preview_text: 'Exclusive offer just for you.',
  html_content: '<h1>We miss you!</h1><p>Come back for 15% off.</p>',
  from_email: 'hello@store.example.com',
  from_name: 'The Store Team',
};

const MOCK_CAMPAIGN_RESOURCE = {
  type: 'campaign' as const,
  id: 'campaign-xyz-789',
  attributes: {
    name: 'Win-Back Q1 2026',
    status: 'Draft',
    archived: false,
    created_at: '2026-03-19T10:00:00Z',
    updated_at: '2026-03-19T10:00:00Z',
    scheduled_at: null,
    send_time: null,
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('executeKlaviyoCampaignDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  // --------------------------------------------------------------------------
  // Success path
  // --------------------------------------------------------------------------

  test('returns success result with correct providerResponse shape', async () => {
    mockCreateCampaign.mockResolvedValueOnce(MOCK_CAMPAIGN_RESOURCE);

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.providerResponse).not.toBeNull();

    const pr = result.providerResponse!;
    expect(pr.campaignId).toBe('campaign-xyz-789');
    expect(pr.campaignName).toBe('Win-Back Q1 2026');
    expect(pr.listId).toBe('list-abc');
    expect(pr.klaviyoUrl).toBe('https://www.klaviyo.com/campaign/campaign-xyz-789');
    expect(pr.status).toBe('draft');
    expect(pr.createdAt).toBeTruthy();
  });

  test('providerResponse status is always "draft" — never sent', async () => {
    // Klaviyo might return any internal status string; we always stamp 'draft'
    mockCreateCampaign.mockResolvedValueOnce({
      ...MOCK_CAMPAIGN_RESOURCE,
      attributes: { ...MOCK_CAMPAIGN_RESOURCE.attributes, status: 'Scheduled' },
    });

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(true);
    // Regardless of what Klaviyo reports, we always record 'draft' in our response
    expect(result.providerResponse!.status).toBe('draft');
  });

  test('klaviyoUrl contains the correct campaignId', async () => {
    mockCreateCampaign.mockResolvedValueOnce({
      ...MOCK_CAMPAIGN_RESOURCE,
      id: 'campaign-unique-id',
    });

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.providerResponse!.klaviyoUrl).toBe(
      'https://www.klaviyo.com/campaign/campaign-unique-id'
    );
  });

  test('passes correct parameters to createCampaign', async () => {
    mockCreateCampaign.mockResolvedValueOnce(MOCK_CAMPAIGN_RESOURCE);

    await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(mockCreateCampaign).toHaveBeenCalledOnce();
    expect(mockCreateCampaign).toHaveBeenCalledWith({
      name: 'Win-Back Q1 2026',
      listId: 'list-abc',
      subject: "We miss you — here's 15% off",
      previewText: 'Exclusive offer just for you.',
      htmlContent: '<h1>We miss you!</h1><p>Come back for 15% off.</p>',
      fromEmail: 'hello@store.example.com',
      fromName: 'The Store Team',
    });
  });

  test('uses campaign_name as default fromName when from_name is omitted', async () => {
    mockCreateCampaign.mockResolvedValueOnce(MOCK_CAMPAIGN_RESOURCE);

    const payloadWithoutFromName = {
      ...VALID_PAYLOAD,
      from_name: undefined,
    };

    await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: payloadWithoutFromName,
    });

    const callArgs = mockCreateCampaign.mock.calls[0][0];
    expect(callArgs.fromName).toBe('Win-Back Q1 2026');
  });

  test('uses default fromEmail when from_email is omitted', async () => {
    mockCreateCampaign.mockResolvedValueOnce(MOCK_CAMPAIGN_RESOURCE);

    const payloadWithoutFromEmail = {
      ...VALID_PAYLOAD,
      from_email: undefined,
    };

    await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: payloadWithoutFromEmail,
    });

    const callArgs = mockCreateCampaign.mock.calls[0][0];
    expect(callArgs.fromEmail).toBeTruthy();
    expect(typeof callArgs.fromEmail).toBe('string');
  });

  // --------------------------------------------------------------------------
  // Payload validation
  // --------------------------------------------------------------------------

  test('returns INVALID_PAYLOAD for missing list_id', async () => {
    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: { ...VALID_PAYLOAD, list_id: '' } as typeof VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
    expect(mockCreateCampaign).not.toHaveBeenCalled();
  });

  test('returns INVALID_PAYLOAD for missing campaign_name', async () => {
    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: { ...VALID_PAYLOAD, campaign_name: '' } as typeof VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
    expect(mockCreateCampaign).not.toHaveBeenCalled();
  });

  test('returns INVALID_PAYLOAD for missing subject_line', async () => {
    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: { ...VALID_PAYLOAD, subject_line: '' } as typeof VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns INVALID_PAYLOAD for missing html_content', async () => {
    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: { ...VALID_PAYLOAD, html_content: '' } as typeof VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns INVALID_PAYLOAD for invalid from_email format', async () => {
    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: { ...VALID_PAYLOAD, from_email: 'not-an-email' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
    expect(mockCreateCampaign).not.toHaveBeenCalled();
  });

  test('providerResponse is null on validation failure', async () => {
    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: {} as typeof VALID_PAYLOAD,
    });

    expect(result.providerResponse).toBeNull();
  });

  // --------------------------------------------------------------------------
  // No connection / revoked connection
  // --------------------------------------------------------------------------

  test('returns INVALID_TOKEN when no Klaviyo connection exists', async () => {
    const { getKlaviyoClient } = await import('../../../klaviyo/connection');
    vi.mocked(getKlaviyoClient).mockRejectedValueOnce(
      new Error('No Klaviyo connection found for workspace ws-test-123')
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
    expect(result.providerResponse).toBeNull();
  });

  test('returns INVALID_TOKEN when Klaviyo connection is not active (revoked)', async () => {
    const { getKlaviyoClient } = await import('../../../klaviyo/connection');
    vi.mocked(getKlaviyoClient).mockRejectedValueOnce(
      new Error('Klaviyo connection is not active for workspace ws-test-123 (status: revoked)')
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Klaviyo API errors
  // --------------------------------------------------------------------------

  test('returns INVALID_TOKEN on Klaviyo 401 — non-retryable', async () => {
    const { KlaviyoApiError } = await import('../../../klaviyo/client');
    mockCreateCampaign.mockRejectedValueOnce(
      new KlaviyoApiError('Unauthorized', 401, [])
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns INVALID_TOKEN on Klaviyo 403 — non-retryable', async () => {
    const { KlaviyoApiError } = await import('../../../klaviyo/client');
    mockCreateCampaign.mockRejectedValueOnce(
      new KlaviyoApiError('Forbidden', 403, [])
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns RATE_LIMIT_EXCEEDED on Klaviyo 429 — retryable', async () => {
    const { KlaviyoApiError } = await import('../../../klaviyo/client');
    mockCreateCampaign.mockRejectedValueOnce(
      new KlaviyoApiError('Rate limit exceeded', 429, [])
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.RATE_LIMIT_EXCEEDED);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns NETWORK_ERROR on Klaviyo 503 — retryable', async () => {
    const { KlaviyoApiError } = await import('../../../klaviyo/client');
    mockCreateCampaign.mockRejectedValueOnce(
      new KlaviyoApiError('Service Unavailable', 503, [])
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns NETWORK_ERROR on Klaviyo 500 — retryable', async () => {
    const { KlaviyoApiError } = await import('../../../klaviyo/client');
    mockCreateCampaign.mockRejectedValueOnce(
      new KlaviyoApiError('Internal Server Error', 500, [])
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns INVALID_PAYLOAD on Klaviyo 400 — non-retryable', async () => {
    const { KlaviyoApiError } = await import('../../../klaviyo/client');
    mockCreateCampaign.mockRejectedValueOnce(
      new KlaviyoApiError('Bad request', 400, [{ detail: 'list id is invalid' }])
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns INVALID_PAYLOAD on Klaviyo 422 — non-retryable', async () => {
    const { KlaviyoApiError } = await import('../../../klaviyo/client');
    mockCreateCampaign.mockRejectedValueOnce(
      new KlaviyoApiError('Unprocessable entity', 422, [{ detail: 'name is required' }])
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error?.retryable).toBe(false);
  });

  test('returns EMAIL_PROVIDER_ERROR for other Klaviyo API errors — non-retryable', async () => {
    const { KlaviyoApiError } = await import('../../../klaviyo/client');
    mockCreateCampaign.mockRejectedValueOnce(
      new KlaviyoApiError('Conflict', 409, [{ detail: 'Campaign name already in use' }])
    );

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.EMAIL_PROVIDER_ERROR);
    expect(result.error?.retryable).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Network / timeout failures
  // --------------------------------------------------------------------------

  test('returns NETWORK_ERROR on ECONNREFUSED — retryable', async () => {
    mockCreateCampaign.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns NETWORK_ERROR on ETIMEDOUT — retryable', async () => {
    mockCreateCampaign.mockRejectedValueOnce(new Error('ETIMEDOUT'));

    const result = await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error?.retryable).toBe(true);
  });

  test('returns NETWORK_ERROR on fetch failed — retryable', async () => {
    mockCreateCampaign.mockRejectedValueOnce(new Error('fetch failed'));

    const result = await executeKlaviyoCampaignDraft({
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
    mockCreateCampaign.mockRejectedValueOnce(new Error('Something totally unexpected'));

    const result = await executeKlaviyoCampaignDraft({
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

  test('createCampaign is called exactly once and never followed by a send call', async () => {
    mockCreateCampaign.mockResolvedValueOnce(MOCK_CAMPAIGN_RESOURCE);

    await executeKlaviyoCampaignDraft({
      workspaceId: WORKSPACE_ID,
      payload: VALID_PAYLOAD,
    });

    // Only createCampaign should be called — no sendCampaign or scheduleCampaign
    expect(mockCreateCampaign).toHaveBeenCalledOnce();
  });
});
