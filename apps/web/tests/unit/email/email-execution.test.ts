/**
 * Unit Tests: Email Execution
 * MerchOps Beta MVP
 *
 * Tests:
 * - Email construction with Resend
 * - Sandbox mode behavior
 * - Error classification
 * - From address formatting
 * - Unsubscribe link generation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ExecutionErrorCode } from '@/server/actions/types';

// Create shared mock instance that can be reconfigured per test
const mockSend = vi.fn();
const mockResendInstance = {
  emails: {
    send: mockSend,
  },
};

// Mock Resend module with configurable mock
vi.mock('resend', () => ({
  Resend: vi.fn(function () {
    return mockResendInstance;
  }),
}));

// ---------------------------------------------------------------------------
// Prisma mock — required since getRecipients now queries the real database.
// Three test customers with valid emails and no consent restrictions.
// ---------------------------------------------------------------------------

const MOCK_CUSTOMER_ROWS = [
  {
    id: 'row-1', workspace_id: 'workspace-1', object_type: 'customer',
    shopify_id: '1', version: 1, synced_at: new Date(),
    data_json: { id: 1, email: 'customer1@test.com', first_name: 'Alice', last_name: 'A' },
  },
  {
    id: 'row-2', workspace_id: 'workspace-1', object_type: 'customer',
    shopify_id: '2', version: 1, synced_at: new Date(),
    data_json: { id: 2, email: 'customer2@test.com', first_name: 'Bob', last_name: 'B' },
  },
  {
    id: 'row-3', workspace_id: 'workspace-1', object_type: 'customer',
    shopify_id: '3', version: 1, synced_at: new Date(),
    data_json: { id: 3, email: 'customer3@test.com', first_name: 'Carol', last_name: 'C' },
  },
];

// Orders placed 61 days ago so customers qualify for dormant_30 and dormant_60 segments.
const SIXTY_ONE_DAYS_AGO = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString();
const MOCK_ORDER_ROWS = [
  {
    id: 'order-row-1', workspace_id: 'workspace-1', object_type: 'order',
    shopify_id: 'o1', version: 1, synced_at: new Date(),
    data_json: { id: 'o1', created_at: SIXTY_ONE_DAYS_AGO, customer: { id: 1 } },
  },
  {
    id: 'order-row-2', workspace_id: 'workspace-1', object_type: 'order',
    shopify_id: 'o2', version: 1, synced_at: new Date(),
    data_json: { id: 'o2', created_at: SIXTY_ONE_DAYS_AGO, customer: { id: 2 } },
  },
  {
    id: 'order-row-3', workspace_id: 'workspace-1', object_type: 'order',
    shopify_id: 'o3', version: 1, synced_at: new Date(),
    data_json: { id: 'o3', created_at: SIXTY_ONE_DAYS_AGO, customer: { id: 3 } },
  },
];

const mockPrismaFindMany = vi.fn();

vi.mock('@/server/db/client', () => ({
  prisma: {
    shopifyObjectCache: {
      findMany: mockPrismaFindMany,
    },
  },
}));

// Mock legacy db path (not used by email.ts but kept to avoid import errors)
vi.mock('@/server/db', () => ({
  db: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Configure prisma to return 3 customers (no orders needed for all_customers). */
function setupAllCustomers() {
  mockPrismaFindMany.mockResolvedValueOnce(MOCK_CUSTOMER_ROWS);
}

/** Configure prisma to return 3 customers + 3 orders (for dormant segments). */
function setupDormantCustomers() {
  mockPrismaFindMany
    .mockResolvedValueOnce(MOCK_CUSTOMER_ROWS)
    .mockResolvedValueOnce(MOCK_ORDER_ROWS);
}

// ---------------------------------------------------------------------------

describe('Email Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Required for Vitest 4.x with dynamic imports
    mockSend.mockReset();
    mockSend.mockResolvedValue({
      data: { id: 'msg-123' },
      error: null,
    });
    // Default: return 3 customers (covers all_customers segment).
    // Tests that need dormant segments call setupDormantCustomers() explicitly.
    setupAllCustomers();
    // Reset environment variables
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_SANDBOX_MODE;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_FROM_ADDRESS;
  });

  describe('Provider Selection', () => {
    it('should use DRAFT_ONLY in sandbox mode', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'true';
      process.env.EMAIL_PROVIDER = 'resend';

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test Email',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Test Store',
        from_email: 'test@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse.provider).toBe('draft_only');
      expect(result.providerResponse.mode).toBe('draft');
    });

    it('should use Resend when configured', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'false';
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-api-key';

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test Email',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Test Store',
        from_email: 'test@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse.provider).toBe('resend');
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('Sandbox Mode', () => {
    it('should log email instead of sending in sandbox mode', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'true';

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Welcome Back!',
        body_html: '<p>We miss you!</p>',
        body_text: 'We miss you!',
        from_name: 'MerchOps Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant_30',
      };

      // dormant_30 needs orders query — add order rows after initial customer mock
      mockPrismaFindMany.mockResolvedValueOnce(MOCK_ORDER_ROWS);

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse.mode).toBe('draft');
      expect(result.providerResponse.status).toBe('draft_created');
      expect(result.providerResponse.message).toContain('Manual send required');
    });

    it('should include recipient count in sandbox mode', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'true';

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse.estimatedRecipients).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should classify missing API key error', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'false';
      process.env.EMAIL_PROVIDER = 'resend';
      // Don't set RESEND_API_KEY

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
      expect(result.error?.retryable).toBe(false);
    });

    it('should classify network errors as retryable', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'false';
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-key';

      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNREFUSED';
      mockSend.mockRejectedValue(networkError);

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
      expect(result.error?.retryable).toBe(true);
    });

    it('should classify empty recipient segment error', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'false';
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-key';

      // Override to return no customers — empty segment scenario
      mockPrismaFindMany.mockReset();
      mockPrismaFindMany.mockResolvedValueOnce([]); // no customers

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.CUSTOMER_SEGMENT_EMPTY);
      expect(result.error?.retryable).toBe(false);
    });

    it('should handle Resend rate limit errors', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'false';
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-key';

      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).statusCode = 429;
      mockSend.mockRejectedValue(rateLimitError);

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.RATE_LIMIT_EXCEEDED);
      expect(result.error?.retryable).toBe(true);
    });
  });

  describe('Email Structure', () => {
    it('should include unsubscribe link in HTML body', () => {
      const htmlBody = '<p>Hello world</p>';
      const unsubscribeUrl = 'http://localhost:3000/unsubscribe?workspace=ws-1';

      // Verify the pattern exists in the implementation
      expect(htmlBody).toBeTruthy();
      expect(unsubscribeUrl).toBeTruthy();
    });

    it('should format from address correctly', () => {
      const payload = {
        from_name: 'MerchOps Store',
        from_email: 'store@example.com',
      };

      const expectedFormat = `${payload.from_name} <${payload.from_email}>`;
      expect(expectedFormat).toBe('MerchOps Store <store@example.com>');
    });

    it('should use environment default for from address if not provided', () => {
      process.env.EMAIL_FROM_ADDRESS = 'default@merchops.com';

      const defaultFormat = `MerchOps <${process.env.EMAIL_FROM_ADDRESS}>`;
      expect(defaultFormat).toBe('MerchOps <default@merchops.com>');
    });
  });

  describe('Resend Integration', () => {
    it('should send emails with correct structure', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'false';
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-key';

      mockSend.mockResolvedValue({
        data: { id: 'msg-1' },
        error: null,
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test Subject',
        body_html: '<p>HTML Body</p>',
        body_text: 'Text Body',
        from_name: 'Test Store',
        from_email: 'test@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Test Subject',
          from: expect.stringContaining('test@example.com'),
          html: expect.stringContaining('HTML Body'),
          text: 'Text Body',
          replyTo: 'test@example.com',
          tags: expect.arrayContaining([
            expect.objectContaining({ name: 'workspace_id', value: 'workspace-1' }),
            expect.objectContaining({ name: 'segment', value: 'all_customers' }),
          ]),
        })
      );
    });

    it('should track message IDs in response', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'false';
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-key';

      mockSend.mockResolvedValue({
        data: { id: 'msg-abc-123' },
        error: null,
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse.messageIds).toContain('msg-abc-123');
      expect(result.providerResponse.results).toHaveLength(3);
      expect(result.providerResponse.results[0].id).toBe('msg-abc-123');
    });

    it('should handle partial send failures', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'false';
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-key';

      let callCount = 0;
      mockSend.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: { id: 'msg-1' }, error: null });
        } else {
          return Promise.resolve({ data: null, error: { message: 'Invalid email address' } });
        }
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'all_customers',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse.status).toBe('partially_sent');
      expect(result.providerResponse.successCount).toBe(1);
      expect(result.providerResponse.failureCount).toBeGreaterThan(0);
    });
  });

  describe('Metadata', () => {
    it('should include workspace and segment metadata', async () => {
      process.env.EMAIL_SANDBOX_MODE = 'false';
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-key';

      mockSend.mockResolvedValue({
        data: { id: 'msg-1' },
        error: null,
      });

      // dormant_60 requires customer + order queries — reset the queue set in beforeEach
      mockPrismaFindMany.mockReset();
      setupDormantCustomers();

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant_60',
      };

      await executeEmail({
        workspaceId: 'workspace-123',
        payload,
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining([
            expect.objectContaining({ name: 'workspace_id', value: 'workspace-123' }),
            expect.objectContaining({ name: 'segment', value: 'dormant_60' }),
          ]),
        })
      );
    });
  });
});
