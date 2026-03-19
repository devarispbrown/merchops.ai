/**
 * Unit tests for executeKlaviyoFlowTrigger()
 *
 * Covers:
 *   - Successful flow trigger with multiple profiles
 *   - Batching: concurrent chunk dispatch (CONCURRENCY_LIMIT = 10)
 *   - Partial failure: some profiles succeed, some fail → both counts stored
 *   - No Klaviyo connection → INVALID_TOKEN error returned
 *   - Empty segment → CUSTOMER_SEGMENT_EMPTY error returned
 *   - Invalid payload → INVALID_PAYLOAD error returned
 *   - All events fail → success: false with providerResponse
 *
 * All external dependencies (KlaviyoClient, getKlaviyoClient, getRecipients,
 * Prisma) are mocked — no real database or HTTP calls are made.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before importing the module under test so that vitest
// hoisting replaces the real modules with our fakes.
// ---------------------------------------------------------------------------

// Mock getKlaviyoClient from the connection module
vi.mock('../../../klaviyo/connection', () => ({
  getKlaviyoClient: vi.fn(),
}));

// Mock getRecipients from the email executor
vi.mock('../email', () => ({
  getRecipients: vi.fn(),
}));

import { getKlaviyoClient } from '../../../klaviyo/connection';
import { getRecipients } from '../email';
import { KlaviyoApiError } from '../../../klaviyo/client';
import { executeKlaviyoFlowTrigger } from '../klaviyo-flow';
import { ExecutionErrorCode } from '../../types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build a minimal Recipient object as returned by getRecipients(). */
function makeRecipient(email: string, id = `id-${email}`) {
  return { id, email, firstName: 'Test', lastName: 'User' };
}

/** Build the minimal KlaviyoClient mock we need. */
function makeClientMock(createEventImpl?: () => Promise<void>) {
  return {
    createEvent: vi.fn(createEventImpl ?? (() => Promise.resolve())),
  };
}

// ---------------------------------------------------------------------------
// Typed mock references for type-safe assertions
// ---------------------------------------------------------------------------

const mockGetKlaviyoClient = vi.mocked(getKlaviyoClient);
const mockGetRecipients = vi.mocked(getRecipients);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeKlaviyoFlowTrigger()', () => {
  const workspaceId = 'ws-test';

  const validPayload = {
    metric_name: 'Winback Campaign',
    recipient_segment: 'dormant_60',
    flow_id: 'FLOW123',
    properties: { campaign_id: 'c1' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Invalid payload
  // -------------------------------------------------------------------------

  describe('invalid payload', () => {
    test('returns INVALID_PAYLOAD error when metric_name is missing', async () => {
      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        // @ts-expect-error intentionally invalid
        payload: { recipient_segment: 'dormant_60' },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
      expect(result.error?.retryable).toBe(false);
      expect(result.providerResponse).toBeNull();
    });

    test('returns INVALID_PAYLOAD error when recipient_segment is empty', async () => {
      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        // @ts-expect-error intentionally invalid
        payload: { metric_name: 'WinbackFlow', recipient_segment: '' },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    });
  });

  // -------------------------------------------------------------------------
  // No connection
  // -------------------------------------------------------------------------

  describe('no Klaviyo connection', () => {
    test('returns INVALID_TOKEN when getKlaviyoClient throws "No Klaviyo connection"', async () => {
      mockGetKlaviyoClient.mockRejectedValueOnce(
        new Error('No Klaviyo connection found for workspace ws-test')
      );

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
      expect(result.error?.retryable).toBe(false);
      expect(result.providerResponse).toBeNull();
    });

    test('returns INVALID_TOKEN when connection is not active', async () => {
      mockGetKlaviyoClient.mockRejectedValueOnce(
        new Error('Klaviyo connection is not active for workspace ws-test (status: revoked)')
      );

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    });
  });

  // -------------------------------------------------------------------------
  // Empty segment
  // -------------------------------------------------------------------------

  describe('empty segment', () => {
    test('returns CUSTOMER_SEGMENT_EMPTY when getRecipients returns []', async () => {
      mockGetKlaviyoClient.mockResolvedValueOnce(makeClientMock() as any);
      mockGetRecipients.mockResolvedValueOnce([]);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.CUSTOMER_SEGMENT_EMPTY);
      expect(result.error?.retryable).toBe(false);
      expect(result.providerResponse).toBeNull();
    });

    test('does not call createEvent when segment is empty', async () => {
      const clientMock = makeClientMock();
      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce([]);

      await executeKlaviyoFlowTrigger({ workspaceId, payload: validPayload });

      expect(clientMock.createEvent).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Successful trigger with multiple profiles
  // -------------------------------------------------------------------------

  describe('successful flow trigger', () => {
    test('calls createEvent for each recipient and returns success', async () => {
      const recipients = [
        makeRecipient('alice@example.com'),
        makeRecipient('bob@example.com'),
        makeRecipient('carol@example.com'),
      ];
      const clientMock = makeClientMock();

      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce(recipients);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(clientMock.createEvent).toHaveBeenCalledTimes(3);
    });

    test('providerResponse contains correct counts', async () => {
      const recipients = [
        makeRecipient('a@example.com'),
        makeRecipient('b@example.com'),
      ];
      const clientMock = makeClientMock();

      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce(recipients);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.providerResponse).not.toBeNull();
      expect(result.providerResponse?.profileCount).toBe(2);
      expect(result.providerResponse?.successCount).toBe(2);
      expect(result.providerResponse?.failedCount).toBe(0);
      expect(result.providerResponse?.errors).toHaveLength(0);
    });

    test('providerResponse includes flowId and metricName from payload', async () => {
      mockGetKlaviyoClient.mockResolvedValueOnce(makeClientMock() as any);
      mockGetRecipients.mockResolvedValueOnce([makeRecipient('x@example.com')]);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.providerResponse?.flowId).toBe('FLOW123');
      expect(result.providerResponse?.metricName).toBe('Winback Campaign');
    });

    test('providerResponse flowId is null when flow_id not provided', async () => {
      mockGetKlaviyoClient.mockResolvedValueOnce(makeClientMock() as any);
      mockGetRecipients.mockResolvedValueOnce([makeRecipient('x@example.com')]);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: { metric_name: 'Flow Event', recipient_segment: 'all_customers' },
      });

      expect(result.providerResponse?.flowId).toBeNull();
    });

    test('createEvent is called with correct metric_name and profile_email', async () => {
      const clientMock = makeClientMock();
      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce([makeRecipient('test@example.com')]);

      await executeKlaviyoFlowTrigger({ workspaceId, payload: validPayload });

      expect(clientMock.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_name: 'Winback Campaign',
          profile_email: 'test@example.com',
        }),
        expect.any(String) // correlationId
      );
    });

    test('event properties include source=merchops and segment', async () => {
      const clientMock = makeClientMock();
      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce([makeRecipient('test@example.com')]);

      await executeKlaviyoFlowTrigger({ workspaceId, payload: validPayload });

      expect(clientMock.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            source: 'merchops',
            segment: 'dormant_60',
            flow_id: 'FLOW123',
            campaign_id: 'c1',
          }),
        }),
        expect.any(String)
      );
    });

    test('getRecipients is called with the correct workspaceId and segment', async () => {
      mockGetKlaviyoClient.mockResolvedValueOnce(makeClientMock() as any);
      mockGetRecipients.mockResolvedValueOnce([makeRecipient('r@example.com')]);

      await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: { metric_name: 'My Flow', recipient_segment: 'dormant_90' },
      });

      expect(mockGetRecipients).toHaveBeenCalledWith(workspaceId, 'dormant_90');
    });
  });

  // -------------------------------------------------------------------------
  // Batching
  // -------------------------------------------------------------------------

  describe('batching', () => {
    test('processes more than CONCURRENCY_LIMIT (10) profiles correctly', async () => {
      // 25 recipients — should produce 3 chunks: 10 + 10 + 5
      const recipients = Array.from({ length: 25 }, (_, i) =>
        makeRecipient(`user${i}@example.com`)
      );
      const clientMock = makeClientMock();

      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce(recipients);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(true);
      expect(clientMock.createEvent).toHaveBeenCalledTimes(25);
      expect(result.providerResponse?.profileCount).toBe(25);
      expect(result.providerResponse?.successCount).toBe(25);
      expect(result.providerResponse?.failedCount).toBe(0);
    });

    test('exactly CONCURRENCY_LIMIT (10) profiles fit in one batch', async () => {
      const recipients = Array.from({ length: 10 }, (_, i) =>
        makeRecipient(`user${i}@example.com`)
      );
      const clientMock = makeClientMock();

      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce(recipients);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(true);
      expect(clientMock.createEvent).toHaveBeenCalledTimes(10);
    });
  });

  // -------------------------------------------------------------------------
  // Partial failure
  // -------------------------------------------------------------------------

  describe('partial failure', () => {
    test('succeeds when at least one profile event succeeds', async () => {
      const recipients = [
        makeRecipient('good@example.com'),
        makeRecipient('bad@example.com'),
        makeRecipient('also-good@example.com'),
      ];

      // Second call (bad@example.com) rejects; first and third succeed
      const clientMock = {
        createEvent: vi
          .fn()
          .mockResolvedValueOnce(undefined)      // good@
          .mockRejectedValueOnce(new Error('Profile not found')) // bad@
          .mockResolvedValueOnce(undefined),     // also-good@
      };

      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce(recipients);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse?.profileCount).toBe(3);
      expect(result.providerResponse?.successCount).toBe(2);
      expect(result.providerResponse?.failedCount).toBe(1);
      expect(result.providerResponse?.errors).toHaveLength(1);
      expect(result.providerResponse?.errors[0].email).toBe('bad@example.com');
      expect(result.providerResponse?.errors[0].message).toBe('Profile not found');
    });

    test('stores all errors when multiple profiles fail', async () => {
      const recipients = [
        makeRecipient('a@example.com'),
        makeRecipient('b@example.com'),
        makeRecipient('c@example.com'),
      ];

      const clientMock = {
        createEvent: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Error B'))
          .mockRejectedValueOnce(new Error('Error C')),
      };

      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce(recipients);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse?.successCount).toBe(1);
      expect(result.providerResponse?.failedCount).toBe(2);
      const errorEmails = result.providerResponse?.errors.map((e) => e.email);
      expect(errorEmails).toContain('b@example.com');
      expect(errorEmails).toContain('c@example.com');
    });

    test('partial failure across two batches is correctly accumulated', async () => {
      // 12 recipients: batch 1 = [0..9], batch 2 = [10, 11]
      // batch 1: recipient[5] fails; batch 2: recipient[11] fails
      const recipients = Array.from({ length: 12 }, (_, i) =>
        makeRecipient(`user${i}@example.com`)
      );

      const createEvent = vi.fn().mockImplementation(
        (_event: { profile_email: string }) => {
          const email = _event.profile_email;
          if (email === 'user5@example.com' || email === 'user11@example.com') {
            return Promise.reject(new Error(`Rejected: ${email}`));
          }
          return Promise.resolve();
        }
      );

      mockGetKlaviyoClient.mockResolvedValueOnce({ createEvent } as any);
      mockGetRecipients.mockResolvedValueOnce(recipients);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse?.profileCount).toBe(12);
      expect(result.providerResponse?.successCount).toBe(10);
      expect(result.providerResponse?.failedCount).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // All events fail
  // -------------------------------------------------------------------------

  describe('all events fail', () => {
    test('returns success: false when every createEvent call rejects', async () => {
      const recipients = [
        makeRecipient('x@example.com'),
        makeRecipient('y@example.com'),
      ];

      const clientMock = {
        createEvent: vi
          .fn()
          .mockRejectedValue(new Error('Klaviyo is down')),
      };

      mockGetKlaviyoClient.mockResolvedValueOnce(clientMock as any);
      mockGetRecipients.mockResolvedValueOnce(recipients);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      expect(result.providerResponse?.successCount).toBe(0);
      expect(result.providerResponse?.failedCount).toBe(2);
    });

    test('single profile failure → success: false with providerResponse', async () => {
      mockGetKlaviyoClient.mockResolvedValueOnce({
        createEvent: vi.fn().mockRejectedValueOnce(new Error('Bad request')),
      } as any);
      mockGetRecipients.mockResolvedValueOnce([makeRecipient('only@example.com')]);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      // providerResponse is still populated so callers can inspect counts
      expect(result.providerResponse).not.toBeNull();
      expect(result.providerResponse?.successCount).toBe(0);
      expect(result.providerResponse?.failedCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Klaviyo API error classification
  // -------------------------------------------------------------------------

  describe('error classification from getKlaviyoClient', () => {
    test('401 KlaviyoApiError from client resolution → INVALID_TOKEN', async () => {
      mockGetKlaviyoClient.mockRejectedValueOnce(
        new KlaviyoApiError('Unauthorized', 401, [])
      );

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
      expect(result.error?.retryable).toBe(false);
    });

    test('429 KlaviyoApiError → RATE_LIMIT_EXCEEDED with retryable: true', async () => {
      mockGetKlaviyoClient.mockRejectedValueOnce(
        new KlaviyoApiError('Rate limited', 429, [])
      );

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.RATE_LIMIT_EXCEEDED);
      expect(result.error?.retryable).toBe(true);
    });

    test('500 KlaviyoApiError → NETWORK_ERROR with retryable: true', async () => {
      mockGetKlaviyoClient.mockRejectedValueOnce(
        new KlaviyoApiError('Internal Server Error', 500, [])
      );

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
      expect(result.error?.retryable).toBe(true);
    });

    test('400 KlaviyoApiError → INVALID_PAYLOAD with retryable: false', async () => {
      mockGetKlaviyoClient.mockRejectedValueOnce(
        new KlaviyoApiError('Bad Request', 400, [])
      );

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
      expect(result.error?.retryable).toBe(false);
    });

    test('ECONNREFUSED error → NETWORK_ERROR with retryable: true', async () => {
      const networkError = new Error('fetch failed: ECONNREFUSED');
      mockGetKlaviyoClient.mockRejectedValueOnce(networkError);

      const result = await executeKlaviyoFlowTrigger({
        workspaceId,
        payload: validPayload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
      expect(result.error?.retryable).toBe(true);
    });
  });
});
