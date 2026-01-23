/**
 * Email Provider Mock
 *
 * Mock implementation of email provider client for testing.
 */

import { vi } from 'vitest';
import {
  emailProviderSuccessResponse,
  emailProviderErrorResponse,
  emailProviderRateLimitResponse,
} from '../fixtures/executions';

// ============================================================================
// EMAIL PROVIDER TYPES
// ============================================================================

export interface EmailRecipient {
  email: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
  from_email: string;
  from_name: string;
  reply_to?: string;
  headers?: Record<string, string>;
}

export interface EmailSendRequest {
  recipients: EmailRecipient[];
  content: EmailContent;
  campaign_id?: string;
  scheduled_for?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EmailDraftRequest {
  content: EmailContent;
  campaign_id?: string;
  tags?: string[];
}

export interface EmailSendResponse {
  message_id: string;
  status: 'queued' | 'sent' | 'scheduled';
  recipient_count: number;
  scheduled_for?: string;
  campaign_id?: string;
}

export interface EmailDraftResponse {
  draft_id: string;
  status: 'draft';
  created_at: string;
  preview_url: string;
}

// ============================================================================
// MOCK EMAIL PROVIDER CLIENT
// ============================================================================

export class MockEmailProviderClient {
  private shouldFail = false;
  private failureType: 'network' | 'rate_limit' | 'segment_empty' | 'invalid_email' | null = null;
  private sentEmails: EmailSendRequest[] = [];
  private draftEmails: EmailDraftRequest[] = [];

  /**
   * Configure mock to fail with specific error type
   */
  mockFailure(type: 'network' | 'rate_limit' | 'segment_empty' | 'invalid_email') {
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
   * Get sent emails (for assertions)
   */
  getSentEmails(): EmailSendRequest[] {
    return this.sentEmails;
  }

  /**
   * Get draft emails (for assertions)
   */
  getDraftEmails(): EmailDraftRequest[] {
    return this.draftEmails;
  }

  /**
   * Clear sent/draft history
   */
  clearHistory() {
    this.sentEmails = [];
    this.draftEmails = [];
  }

  /**
   * Send email
   */
  async send(request: EmailSendRequest): Promise<EmailSendResponse> {
    // Simulate failures
    if (this.shouldFail) {
      switch (this.failureType) {
        case 'network':
          throw new Error('Network error: Connection timeout');
        case 'rate_limit':
          throw new Error('Rate limit exceeded');
        case 'segment_empty':
          return {
            ...emailProviderErrorResponse,
            error: emailProviderErrorResponse.error,
          } as any;
        case 'invalid_email':
          throw new Error('Invalid email address in recipients');
      }
    }

    // Check for empty recipient list
    if (request.recipients.length === 0) {
      return {
        ...emailProviderErrorResponse,
        error: {
          code: 'SEGMENT_EMPTY',
          message: 'No recipients provided',
          details: { recipient_count: 0 },
        },
      } as any;
    }

    // Store sent email
    this.sentEmails.push(request);

    // Return success response
    return {
      message_id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: request.scheduled_for ? 'scheduled' : 'queued',
      recipient_count: request.recipients.length,
      scheduled_for: request.scheduled_for?.toISOString(),
      campaign_id: request.campaign_id || `camp_${Date.now()}`,
    };
  }

  /**
   * Create draft email
   */
  async createDraft(request: EmailDraftRequest): Promise<EmailDraftResponse> {
    // Simulate failures
    if (this.shouldFail) {
      switch (this.failureType) {
        case 'network':
          throw new Error('Network error: Connection timeout');
        case 'rate_limit':
          throw new Error('Rate limit exceeded');
        case 'invalid_email':
          throw new Error('Invalid email address format');
      }
    }

    // Store draft email
    this.draftEmails.push(request);

    // Return draft response
    return {
      draft_id: `draft_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: 'draft',
      created_at: new Date().toISOString(),
      preview_url: `https://preview.emailprovider.com/draft_${Date.now()}`,
    };
  }

  /**
   * Get customer segment
   */
  async getSegment(segmentId: string): Promise<EmailRecipient[]> {
    // Simulate failures
    if (this.shouldFail && this.failureType === 'segment_empty') {
      return [];
    }

    // Return mock segment data
    return [
      {
        email: 'customer1@example.com',
        name: 'Customer One',
        metadata: { customer_id: '1111111111111', ltv: 340 },
      },
      {
        email: 'customer2@example.com',
        name: 'Customer Two',
        metadata: { customer_id: '2222222222222', ltv: 187 },
      },
      {
        email: 'customer3@example.com',
        name: 'Customer Three',
        metadata: { customer_id: '3333333333333', ltv: 892 },
      },
    ];
  }

  /**
   * Verify email address
   */
  async verifyEmail(email: string): Promise<boolean> {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get send statistics
   */
  async getStats(campaignId: string): Promise<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  }> {
    return {
      sent: 12,
      delivered: 11,
      opened: 8,
      clicked: 3,
      bounced: 1,
      unsubscribed: 0,
    };
  }
}

// ============================================================================
// MOCK FACTORY
// ============================================================================

/**
 * Create a mock email provider client
 */
export function createMockEmailProvider(): MockEmailProviderClient {
  return new MockEmailProviderClient();
}

// ============================================================================
// VITEST MOCKS
// ============================================================================

/**
 * Mock the email provider module
 */
export function mockEmailProvider() {
  const mockClient = createMockEmailProvider();

  vi.mock('../../server/email/client', () => ({
    EmailProviderClient: vi.fn(() => mockClient),
    getEmailProvider: vi.fn(() => mockClient),
  }));

  return mockClient;
}

/**
 * Mock successful email sending
 */
export function mockEmailProviderSuccess() {
  const mockClient = createMockEmailProvider();
  mockClient.mockSuccess();

  vi.mock('../../server/email/client', () => ({
    EmailProviderClient: vi.fn(() => mockClient),
    getEmailProvider: vi.fn(() => mockClient),
  }));

  return mockClient;
}

/**
 * Mock email network error
 */
export function mockEmailProviderNetworkError() {
  const mockClient = createMockEmailProvider();
  mockClient.mockFailure('network');

  vi.mock('../../server/email/client', () => ({
    EmailProviderClient: vi.fn(() => mockClient),
    getEmailProvider: vi.fn(() => mockClient),
  }));

  return mockClient;
}

/**
 * Mock email rate limit error
 */
export function mockEmailProviderRateLimit() {
  const mockClient = createMockEmailProvider();
  mockClient.mockFailure('rate_limit');

  vi.mock('../../server/email/client', () => ({
    EmailProviderClient: vi.fn(() => mockClient),
    getEmailProvider: vi.fn(() => mockClient),
  }));

  return mockClient;
}

/**
 * Mock empty segment error
 */
export function mockEmailProviderSegmentEmpty() {
  const mockClient = createMockEmailProvider();
  mockClient.mockFailure('segment_empty');

  vi.mock('../../server/email/client', () => ({
    EmailProviderClient: vi.fn(() => mockClient),
    getEmailProvider: vi.fn(() => mockClient),
  }));

  return mockClient;
}

// ============================================================================
// EMAIL BUILDERS
// ============================================================================

/**
 * Build a test email send request
 */
export function buildEmailSendRequest(
  overrides?: Partial<EmailSendRequest>
): EmailSendRequest {
  return {
    recipients: [
      {
        email: 'customer@example.com',
        name: 'Test Customer',
        metadata: { customer_id: '123' },
      },
    ],
    content: {
      subject: 'Test Email',
      html: '<p>Test HTML content</p>',
      text: 'Test text content',
      from_email: 'hello@teststore.com',
      from_name: 'Test Store',
    },
    campaign_id: 'test_campaign',
    tags: ['test'],
    ...overrides,
  };
}

/**
 * Build a test email draft request
 */
export function buildEmailDraftRequest(
  overrides?: Partial<EmailDraftRequest>
): EmailDraftRequest {
  return {
    content: {
      subject: 'Test Draft',
      html: '<p>Test draft HTML</p>',
      text: 'Test draft text',
      from_email: 'hello@teststore.com',
      from_name: 'Test Store',
    },
    campaign_id: 'test_draft_campaign',
    tags: ['draft', 'test'],
    ...overrides,
  };
}

/**
 * Build test recipients list
 */
export function buildRecipients(count: number = 3): EmailRecipient[] {
  return Array.from({ length: count }, (_, i) => ({
    email: `customer${i + 1}@example.com`,
    name: `Customer ${i + 1}`,
    metadata: {
      customer_id: `${1111111111111 + i}`,
      ltv: (i + 1) * 100,
    },
  }));
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert email was sent with specific properties
 */
export function assertEmailSent(
  mockClient: MockEmailProviderClient,
  assertions: {
    subject?: string;
    toEmail?: string;
    fromEmail?: string;
    campaignId?: string;
  }
) {
  const sentEmails = mockClient.getSentEmails();

  if (sentEmails.length === 0) {
    throw new Error('No emails were sent');
  }

  const matchingEmail = sentEmails.find((email) => {
    if (assertions.subject && email.content.subject !== assertions.subject) {
      return false;
    }
    if (
      assertions.toEmail &&
      !email.recipients.some((r) => r.email === assertions.toEmail)
    ) {
      return false;
    }
    if (assertions.fromEmail && email.content.from_email !== assertions.fromEmail) {
      return false;
    }
    if (assertions.campaignId && email.campaign_id !== assertions.campaignId) {
      return false;
    }
    return true;
  });

  if (!matchingEmail) {
    throw new Error(
      `No email found matching assertions: ${JSON.stringify(assertions)}`
    );
  }

  return matchingEmail;
}

/**
 * Assert specific number of emails sent
 */
export function assertEmailCount(
  mockClient: MockEmailProviderClient,
  expectedCount: number
) {
  const actualCount = mockClient.getSentEmails().length;
  if (actualCount !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} emails to be sent, but ${actualCount} were sent`
    );
  }
}

/**
 * Assert draft was created
 */
export function assertDraftCreated(
  mockClient: MockEmailProviderClient,
  assertions?: {
    subject?: string;
    campaignId?: string;
  }
) {
  const drafts = mockClient.getDraftEmails();

  if (drafts.length === 0) {
    throw new Error('No drafts were created');
  }

  if (assertions) {
    const matchingDraft = drafts.find((draft) => {
      if (assertions.subject && draft.content.subject !== assertions.subject) {
        return false;
      }
      if (assertions.campaignId && draft.campaign_id !== assertions.campaignId) {
        return false;
      }
      return true;
    });

    if (!matchingDraft) {
      throw new Error(
        `No draft found matching assertions: ${JSON.stringify(assertions)}`
      );
    }

    return matchingDraft;
  }

  return drafts[0];
}
