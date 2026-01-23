/**
 * Integration Tests: Resend Email Integration
 * MerchOps Beta MVP
 *
 * Tests:
 * - Full email send flow with mocked Resend API
 * - Error handling and retry logic
 * - Provider response storage
 * - Execution status tracking
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ExecutionErrorCode } from '@/server/actions/types';

// Shared mock instances at the top level
const mockSend = vi.fn();
const mockResendInstance = {
  emails: {
    send: mockSend,
  },
};

// Mock Resend with shared instance
vi.mock('resend', () => ({
  Resend: vi.fn(function () {
    return mockResendInstance;
  }),
}));

describe('Resend Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSend.mockReset();
    mockSend.mockResolvedValue({
      data: { id: 'msg-123' },
      error: null,
    });
    process.env.EMAIL_SANDBOX_MODE = 'false';
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM_ADDRESS = 'noreply@merchops.com';
  });

  describe('Successful Email Send', () => {
    it('should send email and store provider response', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'abc-123-def-456' },
        error: null,
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'We miss you!',
        preview_text: 'Come back for exclusive offers',
        body_html: '<h1>Welcome Back!</h1><p>We have exciting offers for you.</p>',
        body_text: 'Welcome Back! We have exciting offers for you.',
        from_name: 'MerchOps Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant_30_days',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse).toMatchObject({
        provider: 'resend',
        status: 'sent',
        successCount: 3,
        failureCount: 0,
      });
      expect(result.providerResponse.messageIds).toContain('abc-123-def-456');
      expect(result.providerResponse.results[0]).toMatchObject({
        id: 'abc-123-def-456',
        to: expect.any(String),
      });
    });

    it('should include tags for tracking', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-1' },
        error: null,
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'workspace_id', value: 'workspace-1' }),
          expect.objectContaining({ name: 'segment', value: 'test' }),
        ])
      );
    });

    it('should include reply-to address', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-1' },
        error: null,
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.replyTo).toBe('store@example.com');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle Resend API authentication error', async () => {
      const authError = new Error('Invalid API token');
      (authError as any).statusCode = 401;
      mockSend.mockRejectedValue(authError);

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
      expect(result.error?.retryable).toBe(false);
    });

    it('should handle invalid email address error', async () => {
      const invalidEmailError = new Error('Invalid recipient email');
      (invalidEmailError as any).statusCode = 422;
      mockSend.mockRejectedValue(invalidEmailError);

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
      expect(result.error?.retryable).toBe(false);
    });

    it('should handle service unavailable error as retryable', async () => {
      const serviceError = new Error('Service temporarily unavailable');
      (serviceError as any).statusCode = 503;
      mockSend.mockRejectedValue(serviceError);

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
      expect(result.error?.retryable).toBe(true);
    });

    it('should handle timeout error as retryable', async () => {
      const timeoutError = new Error('Connection timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      mockSend.mockRejectedValue(timeoutError);

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
      expect(result.error?.retryable).toBe(true);
    });
  });

  describe('Parallel Email Handling', () => {
    it('should send to multiple recipients in parallel', async () => {
      mockSend.mockImplementation(() =>
        Promise.resolve({
          data: { id: 'msg-' + Math.random() },
          error: null,
        })
      );

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse.recipientCount).toBe(3);
      expect(result.providerResponse.successCount).toBe(3);
      expect(result.providerResponse.messageIds).toHaveLength(3);
    });

    it('should handle mixed success and failure results', async () => {
      let callCount = 0;
      mockSend.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({
            data: null,
            error: { message: 'Invalid email' },
          });
        }
        return Promise.resolve({
          data: { id: 'msg-' + callCount },
          error: null,
        });
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      const result = await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      expect(result.success).toBe(true);
      expect(result.providerResponse.status).toBe('partially_sent');
      expect(result.providerResponse.successCount).toBe(2);
      expect(result.providerResponse.failureCount).toBe(1);
    });
  });

  describe('Unsubscribe Link', () => {
    it('should append unsubscribe link to HTML body', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-1' },
        error: null,
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Original content</p>',
        body_text: 'Original content',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      const callArgs = mockSend.mock.calls[0][0];
      const sentHtml = callArgs.html;

      expect(sentHtml).toContain('Original content');
      expect(sentHtml).toContain('Unsubscribe');
      expect(sentHtml).toContain('/unsubscribe?workspace=workspace-1');
    });

    it('should insert unsubscribe before closing body tag if present', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-1' },
        error: null,
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<html><body><p>Content</p></body></html>',
        body_text: 'Content',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'test',
      };

      await executeEmail({
        workspaceId: 'workspace-1',
        payload,
      });

      const callArgs = mockSend.mock.calls[0][0];
      const sentHtml = callArgs.html;

      // Unsubscribe should be before </body>
      const unsubscribeIndex = sentHtml.indexOf('Unsubscribe');
      const bodyCloseIndex = sentHtml.indexOf('</body>');

      expect(unsubscribeIndex).toBeGreaterThan(-1);
      expect(bodyCloseIndex).toBeGreaterThan(-1);
      expect(unsubscribeIndex).toBeLessThan(bodyCloseIndex);
    });
  });

  describe('Tag Storage', () => {
    it('should store workspace and customer tags', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-1' },
        error: null,
      });

      const { executeEmail } = await import('@/server/actions/execute/email');

      const payload = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        body_text: 'Test',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant_90_days',
      };

      await executeEmail({
        workspaceId: 'workspace-abc-123',
        payload,
      });

      const callArgs = mockSend.mock.calls[0][0];
      const tags = callArgs.tags;

      expect(tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'workspace_id', value: 'workspace-abc-123' }),
          expect.objectContaining({ name: 'segment', value: 'dormant_90_days' }),
        ])
      );
      expect(tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'customer_id' }),
        ])
      );
    });
  });
});
