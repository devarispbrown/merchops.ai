/**
 * Unit Tests: Stripe Webhook Handlers
 * MerchOps Beta MVP
 *
 * Tests:
 * - Webhook signature verification
 * - Event routing and processing
 * - Subscription lifecycle events
 * - Invoice payment events
 * - Billing event logging
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '../../setup';
import type { Subscription } from '@prisma/client';

// ============================================================================
// MOCKS
// ============================================================================

// Create mock functions
const mockGetSubscriptionByCustomerId = vi.fn();
const mockGetSubscriptionByStripeId = vi.fn();
const mockUpdateSubscription = vi.fn();

// Mock subscription module
vi.mock('@/server/billing/subscription', () => ({
  getSubscriptionByCustomerId: () => mockGetSubscriptionByCustomerId(),
  getSubscriptionByStripeId: () => mockGetSubscriptionByStripeId(),
  updateSubscription: (...args: any[]) => mockUpdateSubscription(...args),
}));

// Mock Stripe
const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
};

vi.mock('@/server/billing/customer', () => ({
  stripe: mockStripe,
}));

// Import after mocks are set up
const {
  verifyWebhookSignature,
  handleCheckoutCompleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleTrialWillEnd,
  processWebhookEvent,
} = await import('@/server/billing/webhooks');

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestSubscription(overrides = {}): Subscription {
  return {
    id: 'test-sub-id',
    workspace_id: 'test-workspace-id',
    stripe_customer_id: 'cus_test123',
    stripe_subscription_id: 'sub_test123',
    plan_tier: 'starter',
    status: 'active',
    current_period_start: new Date('2024-01-01T00:00:00Z'),
    current_period_end: new Date('2024-02-01T00:00:00Z'),
    trial_start: null,
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as Subscription;
}

function createStripeEvent(type: string, data: any): any {
  return {
    id: 'evt_test123',
    type,
    data: {
      object: data,
    },
  };
}

// ============================================================================
// TESTS: WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

describe('verifyWebhookSignature', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('verifies valid webhook signature', () => {
    const payload = '{"test": "data"}';
    const signature = 't=1234567890,v1=signature_value';
    const event = createStripeEvent('test.event', { test: 'data' });

    mockStripe.webhooks.constructEvent.mockReturnValue(event);

    const result = verifyWebhookSignature(payload, signature);

    expect(result).toEqual(event);
    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
      payload,
      signature,
      'whsec_test_secret'
    );
  });

  it('throws error for invalid signature', () => {
    const payload = '{"test": "data"}';
    const signature = 'invalid_signature';

    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    expect(() => verifyWebhookSignature(payload, signature)).toThrow(/signature verification failed/i);
  });

  it('throws error when webhook secret not configured', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const payload = '{"test": "data"}';
    const signature = 't=1234567890,v1=signature_value';

    expect(() => verifyWebhookSignature(payload, signature)).toThrow(/not configured/i);
  });

  it('handles Buffer payload', () => {
    const payload = Buffer.from('{"test": "data"}');
    const signature = 't=1234567890,v1=signature_value';
    const event = createStripeEvent('test.event', { test: 'data' });

    mockStripe.webhooks.constructEvent.mockReturnValue(event);

    const result = verifyWebhookSignature(payload, signature);

    expect(result).toEqual(event);
  });
});

// ============================================================================
// TESTS: CHECKOUT COMPLETED
// ============================================================================

describe('handleCheckoutCompleted', () => {
  it('updates subscription with Stripe subscription ID', async () => {
    const session = {
      id: 'cs_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
    };

    const event = createStripeEvent('checkout.session.completed', session);
    const subscription = createTestSubscription();

    mockGetSubscriptionByCustomerId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue({
      ...subscription,
      stripe_subscription_id: 'sub_test123',
      status: 'active',
    });

    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleCheckoutCompleted(event);

    expect(mockUpdateSubscription).toHaveBeenCalledWith(subscription.id, {
      stripe_subscription_id: 'sub_test123',
      status: 'active',
    });
  });

  it('logs billing event', async () => {
    const session = {
      id: 'cs_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
    };

    const event = createStripeEvent('checkout.session.completed', session);
    const subscription = createTestSubscription();

    mockGetSubscriptionByCustomerId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue(subscription);
    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleCheckoutCompleted(event);

    expect(prismaMock.billingEvent.create).toHaveBeenCalledWith({
      data: {
        subscription_id: subscription.id,
        event_type: 'checkout.session.completed',
        stripe_event_id: event.id,
        payload: session,
      },
    });
  });

  it('handles missing customer gracefully', async () => {
    const session = {
      id: 'cs_test123',
      customer: null,
      subscription: null,
    };

    const event = createStripeEvent('checkout.session.completed', session);

    await handleCheckoutCompleted(event);

    expect(mockGetSubscriptionByCustomerId).not.toHaveBeenCalled();
    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });

  it('handles subscription not found', async () => {
    const session = {
      id: 'cs_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
    };

    const event = createStripeEvent('checkout.session.completed', session);

    mockGetSubscriptionByCustomerId.mockResolvedValue(null);

    await handleCheckoutCompleted(event);

    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: INVOICE PAYMENT SUCCEEDED
// ============================================================================

describe('handleInvoicePaymentSucceeded', () => {
  it('updates subscription to active with period dates', async () => {
    const invoice = {
      id: 'in_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
      amount_paid: 4900,
      period_start: 1704067200, // 2024-01-01 00:00:00 UTC
      period_end: 1706745600, // 2024-02-01 00:00:00 UTC
    };

    const event = createStripeEvent('invoice.payment_succeeded', invoice);
    const subscription = createTestSubscription();

    mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue({
      ...subscription,
      status: 'active',
    });

    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleInvoicePaymentSucceeded(event);

    expect(mockUpdateSubscription).toHaveBeenCalledWith(subscription.id, {
      status: 'active',
      current_period_start: new Date('2024-01-01T00:00:00Z'),
      current_period_end: new Date('2024-02-01T00:00:00Z'),
    });
  });

  it('logs billing event with payment amount', async () => {
    const invoice = {
      id: 'in_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
      amount_paid: 4900,
      period_start: 1704067200,
      period_end: 1706745600,
    };

    const event = createStripeEvent('invoice.payment_succeeded', invoice);
    const subscription = createTestSubscription();

    mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue(subscription);
    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleInvoicePaymentSucceeded(event);

    expect(prismaMock.billingEvent.create).toHaveBeenCalledWith({
      data: {
        subscription_id: subscription.id,
        event_type: 'invoice.payment_succeeded',
        stripe_event_id: event.id,
        payload: invoice,
      },
    });
  });

  it('handles invoice without subscription', async () => {
    const invoice = {
      id: 'in_test123',
      customer: 'cus_test123',
      subscription: null,
      amount_paid: 4900,
    };

    const event = createStripeEvent('invoice.payment_succeeded', invoice);

    await handleInvoicePaymentSucceeded(event);

    expect(mockGetSubscriptionByStripeId).not.toHaveBeenCalled();
  });

  it('handles subscription not found', async () => {
    const invoice = {
      id: 'in_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
      amount_paid: 4900,
    };

    const event = createStripeEvent('invoice.payment_succeeded', invoice);

    mockGetSubscriptionByStripeId.mockResolvedValue(null);

    await handleInvoicePaymentSucceeded(event);

    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: INVOICE PAYMENT FAILED
// ============================================================================

describe('handleInvoicePaymentFailed', () => {
  it('updates subscription to past_due status', async () => {
    const invoice = {
      id: 'in_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
      attempt_count: 2,
    };

    const event = createStripeEvent('invoice.payment_failed', invoice);
    const subscription = createTestSubscription();

    mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue({
      ...subscription,
      status: 'past_due',
    });

    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleInvoicePaymentFailed(event);

    expect(mockUpdateSubscription).toHaveBeenCalledWith(subscription.id, {
      status: 'past_due',
    });
  });

  it('logs billing event with attempt count', async () => {
    const invoice = {
      id: 'in_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
      attempt_count: 3,
    };

    const event = createStripeEvent('invoice.payment_failed', invoice);
    const subscription = createTestSubscription();

    mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue(subscription);
    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleInvoicePaymentFailed(event);

    expect(prismaMock.billingEvent.create).toHaveBeenCalledWith({
      data: {
        subscription_id: subscription.id,
        event_type: 'invoice.payment_failed',
        stripe_event_id: event.id,
        payload: invoice,
      },
    });
  });

  it('handles invoice without subscription', async () => {
    const invoice = {
      id: 'in_test123',
      customer: 'cus_test123',
      subscription: null,
      attempt_count: 1,
    };

    const event = createStripeEvent('invoice.payment_failed', invoice);

    await handleInvoicePaymentFailed(event);

    expect(mockGetSubscriptionByStripeId).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: SUBSCRIPTION UPDATED
// ============================================================================

describe('handleSubscriptionUpdated', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter';
    process.env.STRIPE_GROWTH_PRICE_ID = 'price_growth';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('updates subscription status and plan tier', async () => {
    const stripeSubscription = {
      id: 'sub_test123',
      customer: 'cus_test123',
      status: 'active',
      current_period_start: 1704067200,
      current_period_end: 1706745600,
      cancel_at_period_end: false,
      canceled_at: null,
      items: {
        data: [
          {
            price: {
              id: 'price_growth',
            },
          },
        ],
      },
    };

    const event = createStripeEvent('customer.subscription.updated', stripeSubscription);
    const subscription = createTestSubscription();

    mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue({
      ...subscription,
      status: 'active',
      plan_tier: 'growth',
    });

    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleSubscriptionUpdated(event);

    expect(mockUpdateSubscription).toHaveBeenCalledWith(subscription.id, {
      status: 'active',
      plan_tier: 'growth',
      current_period_start: new Date('2024-01-01T00:00:00Z'),
      current_period_end: new Date('2024-02-01T00:00:00Z'),
      cancel_at_period_end: false,
      canceled_at: null,
    });
  });

  it('handles cancellation fields', async () => {
    const stripeSubscription = {
      id: 'sub_test123',
      customer: 'cus_test123',
      status: 'active',
      current_period_start: 1704067200,
      current_period_end: 1706745600,
      cancel_at_period_end: true,
      canceled_at: 1704153600, // 2024-01-02
      items: {
        data: [{ price: { id: 'price_starter' } }],
      },
    };

    const event = createStripeEvent('customer.subscription.updated', stripeSubscription);
    const subscription = createTestSubscription();

    mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue(subscription);
    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleSubscriptionUpdated(event);

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      subscription.id,
      expect.objectContaining({
        cancel_at_period_end: true,
        canceled_at: new Date('2024-01-02T00:00:00Z'),
      })
    );
  });

  it('maps Stripe statuses correctly', async () => {
    const statuses: Array<[string, string]> = [
      ['trialing', 'trialing'],
      ['active', 'active'],
      ['past_due', 'past_due'],
      ['canceled', 'canceled'],
      ['unpaid', 'unpaid'],
      ['incomplete', 'incomplete'],
      ['incomplete_expired', 'incomplete_expired'],
    ];

    for (const [stripeStatus, expectedStatus] of statuses) {
      const stripeSubscription = {
        id: 'sub_test123',
        customer: 'cus_test123',
        status: stripeStatus,
        current_period_start: 1704067200,
        current_period_end: 1706745600,
        cancel_at_period_end: false,
        canceled_at: null,
        items: {
          data: [{ price: { id: 'price_starter' } }],
        },
      };

      const event = createStripeEvent('customer.subscription.updated', stripeSubscription);
      const subscription = createTestSubscription();

      mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
      mockUpdateSubscription.mockResolvedValue(subscription);
      prismaMock.billingEvent.create.mockResolvedValue({} as any);

      await handleSubscriptionUpdated(event);

      expect(mockUpdateSubscription).toHaveBeenCalledWith(
        subscription.id,
        expect.objectContaining({
          status: expectedStatus,
        })
      );
    }
  });

  it('handles subscription not found', async () => {
    const stripeSubscription = {
      id: 'sub_nonexistent',
      customer: 'cus_test123',
      status: 'active',
      current_period_start: 1704067200,
      current_period_end: 1706745600,
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [] },
    };

    const event = createStripeEvent('customer.subscription.updated', stripeSubscription);

    mockGetSubscriptionByStripeId.mockResolvedValue(null);

    await handleSubscriptionUpdated(event);

    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: SUBSCRIPTION DELETED
// ============================================================================

describe('handleSubscriptionDeleted', () => {
  it('updates subscription to canceled status', async () => {
    const stripeSubscription = {
      id: 'sub_test123',
      customer: 'cus_test123',
    };

    const event = createStripeEvent('customer.subscription.deleted', stripeSubscription);
    const subscription = createTestSubscription();

    mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue({
      ...subscription,
      status: 'canceled',
    });

    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleSubscriptionDeleted(event);

    expect(mockUpdateSubscription).toHaveBeenCalledWith(subscription.id, {
      status: 'canceled',
      canceled_at: expect.any(Date),
    });
  });

  it('logs billing event', async () => {
    const stripeSubscription = {
      id: 'sub_test123',
      customer: 'cus_test123',
    };

    const event = createStripeEvent('customer.subscription.deleted', stripeSubscription);
    const subscription = createTestSubscription();

    mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
    mockUpdateSubscription.mockResolvedValue(subscription);
    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleSubscriptionDeleted(event);

    expect(prismaMock.billingEvent.create).toHaveBeenCalledWith({
      data: {
        subscription_id: subscription.id,
        event_type: 'customer.subscription.deleted',
        stripe_event_id: event.id,
        payload: stripeSubscription,
      },
    });
  });

  it('handles subscription not found', async () => {
    const stripeSubscription = {
      id: 'sub_nonexistent',
      customer: 'cus_test123',
    };

    const event = createStripeEvent('customer.subscription.deleted', stripeSubscription);

    mockGetSubscriptionByStripeId.mockResolvedValue(null);

    await handleSubscriptionDeleted(event);

    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: TRIAL WILL END
// ============================================================================

describe('handleTrialWillEnd', () => {
  it('logs trial ending warning', async () => {
    const stripeSubscription = {
      id: 'sub_test123',
      customer: 'cus_test123',
      trial_end: 1704585600, // 2024-01-07
    };

    const event = createStripeEvent('customer.subscription.trial_will_end', stripeSubscription);
    const subscription = createTestSubscription();

    mockGetSubscriptionByStripeId.mockResolvedValue(subscription);
    prismaMock.billingEvent.create.mockResolvedValue({} as any);

    await handleTrialWillEnd(event);

    expect(prismaMock.billingEvent.create).toHaveBeenCalledWith({
      data: {
        subscription_id: subscription.id,
        event_type: 'customer.subscription.trial_will_end',
        stripe_event_id: event.id,
        payload: stripeSubscription,
      },
    });
  });

  it('handles subscription not found', async () => {
    const stripeSubscription = {
      id: 'sub_nonexistent',
      customer: 'cus_test123',
      trial_end: 1704585600,
    };

    const event = createStripeEvent('customer.subscription.trial_will_end', stripeSubscription);

    mockGetSubscriptionByStripeId.mockResolvedValue(null);

    await handleTrialWillEnd(event);

    // Should not throw, just log error
    expect(prismaMock.billingEvent.create).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: PROCESS WEBHOOK EVENT
// ============================================================================

describe('processWebhookEvent', () => {
  beforeEach(() => {
    mockGetSubscriptionByCustomerId.mockResolvedValue(createTestSubscription());
    mockGetSubscriptionByStripeId.mockResolvedValue(createTestSubscription());
    mockUpdateSubscription.mockResolvedValue(createTestSubscription());
    prismaMock.billingEvent.create.mockResolvedValue({} as any);
  });

  it('routes checkout.session.completed to handler', async () => {
    const event = createStripeEvent('checkout.session.completed', {
      id: 'cs_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
    });

    await processWebhookEvent(event);

    expect(mockGetSubscriptionByCustomerId).toHaveBeenCalled();
  });

  it('routes invoice.payment_succeeded to handler', async () => {
    const event = createStripeEvent('invoice.payment_succeeded', {
      id: 'in_test123',
      subscription: 'sub_test123',
    });

    await processWebhookEvent(event);

    expect(mockGetSubscriptionByStripeId).toHaveBeenCalled();
  });

  it('routes invoice.payment_failed to handler', async () => {
    const event = createStripeEvent('invoice.payment_failed', {
      id: 'in_test123',
      subscription: 'sub_test123',
    });

    await processWebhookEvent(event);

    expect(mockGetSubscriptionByStripeId).toHaveBeenCalled();
  });

  it('routes customer.subscription.updated to handler', async () => {
    const event = createStripeEvent('customer.subscription.updated', {
      id: 'sub_test123',
      customer: 'cus_test123',
      status: 'active',
      current_period_start: 1704067200,
      current_period_end: 1706745600,
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [] },
    });

    await processWebhookEvent(event);

    expect(mockGetSubscriptionByStripeId).toHaveBeenCalled();
  });

  it('routes customer.subscription.deleted to handler', async () => {
    const event = createStripeEvent('customer.subscription.deleted', {
      id: 'sub_test123',
      customer: 'cus_test123',
    });

    await processWebhookEvent(event);

    expect(mockGetSubscriptionByStripeId).toHaveBeenCalled();
  });

  it('routes customer.subscription.trial_will_end to handler', async () => {
    const event = createStripeEvent('customer.subscription.trial_will_end', {
      id: 'sub_test123',
      customer: 'cus_test123',
      trial_end: 1704585600,
    });

    await processWebhookEvent(event);

    expect(mockGetSubscriptionByStripeId).toHaveBeenCalled();
  });

  it('handles unhandled event types gracefully', async () => {
    const event = createStripeEvent('unknown.event.type', {
      id: 'test123',
    });

    await processWebhookEvent(event);

    // Should not throw
    expect(mockGetSubscriptionByCustomerId).not.toHaveBeenCalled();
    expect(mockGetSubscriptionByStripeId).not.toHaveBeenCalled();
  });

  it('re-throws errors for Stripe retry mechanism', async () => {
    const event = createStripeEvent('checkout.session.completed', {
      id: 'cs_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
    });

    mockGetSubscriptionByCustomerId.mockRejectedValue(new Error('Database error'));

    await expect(processWebhookEvent(event)).rejects.toThrow('Database error');
  });
});
