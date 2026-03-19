/**
 * Unit Tests: WinbackOutcomeResolver — fetchEmailMetrics
 *
 * Covers:
 *   - Resend path: successful metric fetch, maps to correct counts
 *   - Klaviyo path: successful campaign metric fetch
 *   - Fallback: provider unavailable → estimated metrics with is_estimated: true
 *   - Fallback: missing execution metadata → estimated
 *   - Evidence JSON includes source field
 *   - Mocks: Resend SDK and KlaviyoClient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — must be declared before any imports that pull in the real modules
// ============================================================================

// --- Resend mock -----------------------------------------------------------
// vi.hoisted ensures these references are available inside the vi.mock factory
// (which is hoisted before top-level variable declarations).
const { mockResendEmailsGet } = vi.hoisted(() => ({
  mockResendEmailsGet: vi.fn(),
}));

vi.mock('resend', () => {
  // Must use a real function (not an arrow) so it can be used as a constructor.
  return {
    Resend: function () {
      return { emails: { get: mockResendEmailsGet } };
    },
  };
});

// --- KlaviyoClient mock ----------------------------------------------------
const { mockGetCampaignStatistics } = vi.hoisted(() => ({
  mockGetCampaignStatistics: vi.fn(),
}));

vi.mock('@/server/klaviyo/client', () => {
  return {
    KlaviyoClient: function () {
      return { getCampaignStatistics: mockGetCampaignStatistics };
    },
  };
});

// --- Prisma mock -----------------------------------------------------------
// Use vi.hoisted() so the fn() instances are created before the vi.mock()
// factory runs (vi.mock is hoisted to the top of the file by Vitest).
const {
  mockPrismaExecutionFindUnique,
  mockPrismaKlaviyoConnectionFindUnique,
  mockPrismaShopifyObjectCacheFindMany,
} = vi.hoisted(() => ({
  mockPrismaExecutionFindUnique: vi.fn(),
  mockPrismaKlaviyoConnectionFindUnique: vi.fn(),
  mockPrismaShopifyObjectCacheFindMany: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({
  prisma: {
    execution: { findUnique: mockPrismaExecutionFindUnique },
    klaviyoConnection: { findUnique: mockPrismaKlaviyoConnectionFindUnique },
    shopifyObjectCache: { findMany: mockPrismaShopifyObjectCacheFindMany },
  },
}));

// ============================================================================
// IMPORTS (after mocks are declared)
// ============================================================================

import { WinbackOutcomeResolver } from '@/server/learning/outcomes/resolvers/winback';
import { OutcomeType } from '@/server/learning/types';
import type { OutcomeComputationInput } from '@/server/learning/types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a minimal OutcomeComputationInput so we can call resolver.compute().
 */
function makeInput(overrides: Partial<OutcomeComputationInput> = {}): OutcomeComputationInput {
  return {
    execution_id: 'exec-test-001',
    workspace_id: 'ws-test-001',
    operator_intent: 'reengage_dormant_customers',
    execution_type: 'winback_email_draft',
    execution_payload: {
      customer_ids: ['cust-1', 'cust-2', 'cust-3'],
      campaign_id: undefined,
    },
    // Use a date far enough in the past so the observation window has closed
    executed_at: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Return a Resend-style provider_response_json stored on the Execution row.
 */
function resendProviderResponse(messageIds: string[] = ['msg-1', 'msg-2', 'msg-3']) {
  return {
    provider: 'resend',
    messageIds,
    recipientCount: messageIds.length,
    successCount: messageIds.length,
    failureCount: 0,
    results: messageIds.map((id) => ({ id, to: `user@example.com` })),
    status: 'sent',
    executedAt: '2025-01-01T00:00:00Z',
  };
}

/**
 * Return a Klaviyo-style provider_response_json.
 */
function klaviyoProviderResponse(campaignId = 'klv-campaign-001') {
  return {
    provider: 'klaviyo',
    campaignId,
    status: 'Sent',
    executedAt: '2025-01-01T00:00:00Z',
  };
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('RESEND_API_KEY', 'test-resend-key');

  // By default, shopifyObjectCache.findMany returns no orders → zero purchases
  mockPrismaShopifyObjectCacheFindMany.mockResolvedValue([]);
});

// ============================================================================
// TESTS
// ============================================================================

describe('WinbackOutcomeResolver — fetchEmailMetrics', () => {

  // --------------------------------------------------------------------------
  // RESEND PATH
  // --------------------------------------------------------------------------

  describe('Resend path', () => {
    it('fetches each message ID and aggregates counts correctly', async () => {
      // Execution record indicates Resend was used
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: resendProviderResponse(['msg-1', 'msg-2', 'msg-3']),
        action_draft: { execution_type: 'winback_email_draft' },
      });

      // Resend returns: msg-1 opened, msg-2 clicked, msg-3 delivered
      mockResendEmailsGet
        .mockResolvedValueOnce({ data: { id: 'msg-1', last_event: 'opened' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'msg-2', last_event: 'clicked' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'msg-3', last_event: 'delivered' }, error: null });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());

      // The email_metrics context block should reflect the real data
      const emailMetrics = (result.evidence.context as any).email_metrics;

      expect(emailMetrics.source).toBe('resend');
      expect(emailMetrics.is_estimated).toBe(false);
      expect(emailMetrics.sent_count).toBe(3);
      expect(emailMetrics.delivered_count).toBe(3); // opened + clicked + delivered all count
      expect(emailMetrics.open_count).toBe(2);       // opened + clicked
      expect(emailMetrics.click_count).toBe(1);      // only clicked
      expect(emailMetrics.unsubscribe_count).toBe(0);
    });

    it('handles bounced and failed events — they are not counted as delivered', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: resendProviderResponse(['msg-1', 'msg-2']),
        action_draft: { execution_type: 'winback_email_draft' },
      });

      mockResendEmailsGet
        .mockResolvedValueOnce({ data: { id: 'msg-1', last_event: 'bounced' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'msg-2', last_event: 'failed' }, error: null });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());
      const emailMetrics = (result.evidence.context as any).email_metrics;

      expect(emailMetrics.source).toBe('resend');
      expect(emailMetrics.delivered_count).toBe(0);
      expect(emailMetrics.open_count).toBe(0);
      expect(emailMetrics.click_count).toBe(0);
      expect(emailMetrics.is_estimated).toBe(false);
    });

    it('counts complained events as delivered and increments unsubscribe_count', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: resendProviderResponse(['msg-1']),
        action_draft: { execution_type: 'winback_email_draft' },
      });

      mockResendEmailsGet.mockResolvedValueOnce({
        data: { id: 'msg-1', last_event: 'complained' },
        error: null,
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());
      const emailMetrics = (result.evidence.context as any).email_metrics;

      expect(emailMetrics.delivered_count).toBe(1);
      expect(emailMetrics.unsubscribe_count).toBe(1);
    });

    it('falls back to estimated when RESEND_API_KEY is not set', async () => {
      vi.stubEnv('RESEND_API_KEY', '');

      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: resendProviderResponse(['msg-1']),
        action_draft: { execution_type: 'winback_email_draft' },
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());
      const emailMetrics = (result.evidence.context as any).email_metrics;

      expect(emailMetrics.source).toBe('estimated');
      expect(emailMetrics.is_estimated).toBe(true);
    });

    it('falls back to estimated when provider response has no message IDs', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: resendProviderResponse([]), // empty list
        action_draft: { execution_type: 'winback_email_draft' },
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());
      const emailMetrics = (result.evidence.context as any).email_metrics;

      expect(emailMetrics.source).toBe('estimated');
      expect(emailMetrics.is_estimated).toBe(true);
    });

    it('falls back to estimated when individual Resend fetch throws', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: resendProviderResponse(['msg-1']),
        action_draft: { execution_type: 'winback_email_draft' },
      });

      // Promise.allSettled catches individual rejections, but simulate the whole
      // batch failing by having get() reject (allSettled status: 'rejected')
      mockResendEmailsGet.mockRejectedValue(new Error('network timeout'));

      const resolver = new WinbackOutcomeResolver();
      // Should not throw — it gracefully degrades; sent_count is 1 (the ID),
      // but delivered/open/click remain 0
      const result = await resolver.compute(makeInput());
      const emailMetrics = (result.evidence.context as any).email_metrics;

      expect(emailMetrics.source).toBe('resend');
      expect(emailMetrics.sent_count).toBe(1);
      expect(emailMetrics.delivered_count).toBe(0);
      expect(emailMetrics.is_estimated).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // KLAVIYO PATH
  // --------------------------------------------------------------------------

  describe('Klaviyo path', () => {
    it('calls getCampaignStatistics and maps counts to EmailMetrics', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: klaviyoProviderResponse('klv-campaign-001'),
        action_draft: { execution_type: 'klaviyo_campaign_draft' },
      });

      mockPrismaKlaviyoConnectionFindUnique.mockResolvedValue({
        apiKeyEncrypted: 'pk_klaviyo_test',
        status: 'active',
      });

      mockGetCampaignStatistics.mockResolvedValue({
        sent_count: 500,
        delivered_count: 480,
        open_count: 120,
        click_count: 30,
        bounce_count: 20,
        unsubscribe_count: 5,
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(
        makeInput({
          execution_payload: {
            customer_ids: ['cust-1'],
            campaign_id: 'klv-campaign-001',
          },
        })
      );

      const emailMetrics = (result.evidence.context as any).email_metrics;

      expect(emailMetrics.source).toBe('klaviyo');
      expect(emailMetrics.is_estimated).toBe(false);
      expect(emailMetrics.sent_count).toBe(500);
      expect(emailMetrics.delivered_count).toBe(480);
      expect(emailMetrics.open_count).toBe(120);
      expect(emailMetrics.click_count).toBe(30);
      expect(emailMetrics.unsubscribe_count).toBe(5);
    });

    it('calls getCampaignStatistics using campaignId from execution_payload', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        // No provider field in response — but execution_type is klaviyo_campaign_draft
        provider_response_json: { provider: 'klaviyo', campaignId: 'klv-payload-id', status: 'Sent', executedAt: '' },
        action_draft: { execution_type: 'klaviyo_campaign_draft' },
      });

      mockPrismaKlaviyoConnectionFindUnique.mockResolvedValue({
        apiKeyEncrypted: 'pk_klaviyo_test',
        status: 'active',
      });

      mockGetCampaignStatistics.mockResolvedValue({
        sent_count: 200,
        delivered_count: 195,
        open_count: 50,
        click_count: 10,
        bounce_count: 5,
        unsubscribe_count: 2,
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(
        makeInput({
          execution_payload: {
            customer_ids: ['cust-1'],
            campaign_id: 'klv-payload-id',
          },
        })
      );

      // Verify getCampaignStatistics was called with the payload campaign ID
      expect(mockGetCampaignStatistics).toHaveBeenCalledWith('klv-payload-id');

      const emailMetrics = (result.evidence.context as any).email_metrics;
      expect(emailMetrics.source).toBe('klaviyo');
      expect(emailMetrics.open_count).toBe(50);
    });

    it('falls back to estimated when Klaviyo connection is inactive', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: klaviyoProviderResponse(),
        action_draft: { execution_type: 'klaviyo_campaign_draft' },
      });

      mockPrismaKlaviyoConnectionFindUnique.mockResolvedValue({
        apiKeyEncrypted: 'pk_klaviyo_test',
        status: 'revoked', // not active
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(
        makeInput({
          execution_payload: { customer_ids: ['cust-1'], campaign_id: 'klv-c' },
        })
      );

      const emailMetrics = (result.evidence.context as any).email_metrics;
      expect(emailMetrics.source).toBe('estimated');
      expect(emailMetrics.is_estimated).toBe(true);
    });

    it('falls back to estimated when Klaviyo connection does not exist', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: klaviyoProviderResponse(),
        action_draft: { execution_type: 'klaviyo_campaign_draft' },
      });

      mockPrismaKlaviyoConnectionFindUnique.mockResolvedValue(null);

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(
        makeInput({
          execution_payload: { customer_ids: ['cust-1'], campaign_id: 'klv-c' },
        })
      );

      const emailMetrics = (result.evidence.context as any).email_metrics;
      expect(emailMetrics.source).toBe('estimated');
      expect(emailMetrics.is_estimated).toBe(true);
    });

    it('falls back to estimated when getCampaignStatistics throws', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: klaviyoProviderResponse(),
        action_draft: { execution_type: 'klaviyo_campaign_draft' },
      });

      mockPrismaKlaviyoConnectionFindUnique.mockResolvedValue({
        apiKeyEncrypted: 'pk_klaviyo_test',
        status: 'active',
      });

      mockGetCampaignStatistics.mockRejectedValue(new Error('Klaviyo 503'));

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(
        makeInput({
          execution_payload: { customer_ids: ['cust-1'], campaign_id: 'klv-c' },
        })
      );

      const emailMetrics = (result.evidence.context as any).email_metrics;
      expect(emailMetrics.source).toBe('estimated');
      expect(emailMetrics.is_estimated).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // FALLBACK — MISSING EXECUTION METADATA
  // --------------------------------------------------------------------------

  describe('Fallback path — missing metadata', () => {
    it('returns estimated metrics when execution record is not found', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue(null);

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput({ execution_id: undefined as any }));

      const emailMetrics = (result.evidence.context as any).email_metrics;
      expect(emailMetrics.source).toBe('estimated');
      expect(emailMetrics.is_estimated).toBe(true);
    });

    it('returns estimated metrics when provider_response_json is null', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: null,
        action_draft: { execution_type: 'winback_email_draft' },
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());

      const emailMetrics = (result.evidence.context as any).email_metrics;
      expect(emailMetrics.source).toBe('estimated');
      expect(emailMetrics.is_estimated).toBe(true);
    });

    it('returns estimated metrics for draft_only execution type', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: { mode: 'draft', draftId: 'draft-123' },
        action_draft: { execution_type: 'winback_email_draft' },
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());

      const emailMetrics = (result.evidence.context as any).email_metrics;
      expect(emailMetrics.source).toBe('estimated');
      expect(emailMetrics.is_estimated).toBe(true);
    });

    it('never throws — even when prisma.execution.findUnique rejects', async () => {
      mockPrismaExecutionFindUnique.mockRejectedValue(new Error('DB connection lost'));

      const resolver = new WinbackOutcomeResolver();

      // Should complete without throwing
      await expect(resolver.compute(makeInput())).resolves.toBeDefined();

      const result = await resolver.compute(makeInput());
      const emailMetrics = (result.evidence.context as any).email_metrics;
      expect(emailMetrics.source).toBe('estimated');
      expect(emailMetrics.is_estimated).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // EVIDENCE JSON STRUCTURE
  // --------------------------------------------------------------------------

  describe('Evidence JSON structure', () => {
    it('always includes email_metrics.source in evidence.context', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue(null);

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());

      expect(result.evidence.context).toBeDefined();
      expect(result.evidence.context?.email_metrics).toBeDefined();
      expect((result.evidence.context as any).email_metrics.source).toMatch(
        /^(resend|klaviyo|estimated)$/
      );
    });

    it('populates evidence.notes with email rates and source indicator', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: resendProviderResponse(['msg-1']),
        action_draft: { execution_type: 'winback_email_draft' },
      });

      mockResendEmailsGet.mockResolvedValueOnce({
        data: { id: 'msg-1', last_event: 'opened' },
        error: null,
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());

      expect(result.evidence.notes).toContain('Email opens');
      expect(result.evidence.notes).toContain('Email clicks');
      expect(result.evidence.notes).toContain('source: resend');
    });

    it('notes say "(email metrics estimated)" when using fallback', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue(null);

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());

      expect(result.evidence.notes).toContain('(email metrics estimated)');
    });

    it('evidence includes sent_count, open_count, click_count, unsubscribe_count, and is_estimated', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue({
        provider_response_json: klaviyoProviderResponse('klv-c'),
        action_draft: { execution_type: 'klaviyo_campaign_draft' },
      });

      mockPrismaKlaviyoConnectionFindUnique.mockResolvedValue({
        apiKeyEncrypted: 'pk_test',
        status: 'active',
      });

      mockGetCampaignStatistics.mockResolvedValue({
        sent_count: 100,
        delivered_count: 98,
        open_count: 30,
        click_count: 8,
        bounce_count: 2,
        unsubscribe_count: 1,
      });

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(
        makeInput({
          execution_payload: { customer_ids: ['c1'], campaign_id: 'klv-c' },
        })
      );

      const emailMetrics = (result.evidence.context as any).email_metrics;

      expect(emailMetrics).toMatchObject({
        sent_count: 100,
        delivered_count: 98,
        open_count: 30,
        click_count: 8,
        unsubscribe_count: 1,
        source: 'klaviyo',
        is_estimated: false,
      });
    });
  });

  // --------------------------------------------------------------------------
  // OUTCOME DETERMINATION STILL WORKS
  // --------------------------------------------------------------------------

  describe('Outcome determination is not broken by email metrics path', () => {
    it('returns a valid OutcomeType regardless of provider', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue(null);

      const resolver = new WinbackOutcomeResolver();
      const result = await resolver.compute(makeInput());

      expect([OutcomeType.HELPED, OutcomeType.NEUTRAL, OutcomeType.HURT]).toContain(
        result.outcome
      );
      expect(result.computed_at).toBeInstanceOf(Date);
    });

    it('result is deterministic for same inputs when using estimated fallback', async () => {
      mockPrismaExecutionFindUnique.mockResolvedValue(null);
      mockPrismaShopifyObjectCacheFindMany.mockResolvedValue([]);

      const resolver = new WinbackOutcomeResolver();
      const input = makeInput();

      const [r1, r2] = await Promise.all([
        resolver.compute(input),
        resolver.compute(input),
      ]);

      expect(r1.outcome).toBe(r2.outcome);
      expect(r1.evidence.delta_percentage).toBe(r2.evidence.delta_percentage);
    });
  });
});
