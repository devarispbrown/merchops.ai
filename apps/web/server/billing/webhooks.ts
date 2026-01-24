/**
 * Stripe Webhook Event Handlers
 *
 * Processes Stripe webhook events and updates subscription state.
 * All events are logged to BillingEvent table for audit trail.
 */

// @ts-ignore - Stripe types may not be available during build
import Stripe from 'stripe';
import { prisma } from '@/server/db';
import { logger } from '@/server/observability/logger';
import { SubscriptionStatus, PlanTier } from '@prisma/client';
import {
  getSubscriptionByCustomerId,
  getSubscriptionByStripeId,
  updateSubscription,
} from './subscription';
import { getStripe } from './customer';

/**
 * Log a billing event to the database
 *
 * @param subscriptionId - Subscription ID
 * @param eventType - Stripe event type
 * @param stripeEventId - Stripe event ID
 * @param payload - Event payload
 */
async function logBillingEvent(
  subscriptionId: string,
  eventType: string,
  stripeEventId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.billingEvent.create({
      data: {
        subscription_id: subscriptionId,
        event_type: eventType,
        stripe_event_id: stripeEventId,
        payload: payload as any,
      },
    });

    logger.info(
      {
        subscriptionId,
        eventType,
        stripeEventId,
      },
      'Billing event logged'
    );
  } catch (error) {
    logger.error(
      {
        subscriptionId,
        eventType,
        stripeEventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to log billing event'
    );
  }
}

/**
 * Get plan tier from Stripe price ID
 *
 * @param priceId - Stripe price ID
 * @returns Plan tier or null if not recognized
 */
function getPlanTierFromPriceId(priceId: string): PlanTier | null {
  const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID;
  const growthPriceId = process.env.STRIPE_GROWTH_PRICE_ID;
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;

  switch (priceId) {
    case starterPriceId:
      return 'starter';
    case growthPriceId:
      return 'growth';
    case proPriceId:
      return 'pro';
    default:
      return null;
  }
}

/**
 * Handle checkout.session.completed event
 * Triggered when customer completes checkout
 *
 * @param event - Stripe event object
 */
export async function handleCheckoutCompleted(
  event: Stripe.Event
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  logger.info(
    {
      sessionId: session.id,
      customerId: session.customer,
      subscriptionId: session.subscription,
    },
    'Processing checkout.session.completed'
  );

  const customerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  if (!customerId || !stripeSubscriptionId) {
    logger.warn(
      { sessionId: session.id },
      'Checkout session missing customer or subscription ID'
    );
    return;
  }

  // Get subscription record
  const subscription = await getSubscriptionByCustomerId(customerId);

  if (!subscription) {
    logger.error(
      {
        customerId,
        sessionId: session.id,
      },
      'No subscription found for customer in checkout.session.completed'
    );
    return;
  }

  // Update subscription with Stripe subscription ID
  await updateSubscription(subscription.id, {
    stripe_subscription_id: stripeSubscriptionId,
    status: 'active',
  });

  // Log event
  await logBillingEvent(
    subscription.id,
    event.type,
    event.id,
    session as unknown as Record<string, unknown>
  );

  logger.info(
    {
      subscriptionId: subscription.id,
      workspaceId: subscription.workspace_id,
      stripeSubscriptionId,
    },
    'Checkout completed successfully'
  );
}

/**
 * Handle invoice.payment_succeeded event
 * Triggered when invoice payment succeeds
 *
 * @param event - Stripe event object
 */
export async function handleInvoicePaymentSucceeded(
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  logger.info(
    {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_paid,
    },
    'Processing invoice.payment_succeeded'
  );

  const stripeSubscriptionId = invoice.subscription as string;

  if (!stripeSubscriptionId) {
    logger.warn(
      { invoiceId: invoice.id },
      'Invoice not associated with subscription'
    );
    return;
  }

  // Get subscription
  const subscription = await getSubscriptionByStripeId(stripeSubscriptionId);

  if (!subscription) {
    logger.error(
      {
        stripeSubscriptionId,
        invoiceId: invoice.id,
      },
      'No subscription found for invoice.payment_succeeded'
    );
    return;
  }

  // Update subscription status to active
  await updateSubscription(subscription.id, {
    status: 'active',
    current_period_start: invoice.period_start ? new Date(invoice.period_start * 1000) : undefined,
    current_period_end: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
  });

  // Log event
  await logBillingEvent(
    subscription.id,
    event.type,
    event.id,
    invoice as unknown as Record<string, unknown>
  );

  logger.info(
    {
      subscriptionId: subscription.id,
      workspaceId: subscription.workspace_id,
      amount: invoice.amount_paid,
    },
    'Invoice payment succeeded'
  );
}

/**
 * Handle invoice.payment_failed event
 * Triggered when invoice payment fails
 *
 * @param event - Stripe event object
 */
export async function handleInvoicePaymentFailed(
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  logger.warn(
    {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      subscriptionId: invoice.subscription,
      attemptCount: invoice.attempt_count,
    },
    'Processing invoice.payment_failed'
  );

  const stripeSubscriptionId = invoice.subscription as string;

  if (!stripeSubscriptionId) {
    logger.warn(
      { invoiceId: invoice.id },
      'Invoice not associated with subscription'
    );
    return;
  }

  // Get subscription
  const subscription = await getSubscriptionByStripeId(stripeSubscriptionId);

  if (!subscription) {
    logger.error(
      {
        stripeSubscriptionId,
        invoiceId: invoice.id,
      },
      'No subscription found for invoice.payment_failed'
    );
    return;
  }

  // Update subscription status to past_due
  await updateSubscription(subscription.id, {
    status: 'past_due',
  });

  // Log event
  await logBillingEvent(
    subscription.id,
    event.type,
    event.id,
    invoice as unknown as Record<string, unknown>
  );

  logger.warn(
    {
      subscriptionId: subscription.id,
      workspaceId: subscription.workspace_id,
      attemptCount: invoice.attempt_count,
    },
    'Invoice payment failed'
  );

  // TODO: Send notification to user about payment failure
}

/**
 * Handle customer.subscription.updated event
 * Triggered when subscription is updated
 *
 * @param event - Stripe event object
 */
export async function handleSubscriptionUpdated(
  event: Stripe.Event
): Promise<void> {
  const stripeSubscription = event.data.object as Stripe.Subscription;

  logger.info(
    {
      subscriptionId: stripeSubscription.id,
      customerId: stripeSubscription.customer,
      status: stripeSubscription.status,
    },
    'Processing customer.subscription.updated'
  );

  // Get subscription
  const subscription = await getSubscriptionByStripeId(stripeSubscription.id);

  if (!subscription) {
    logger.error(
      {
        stripeSubscriptionId: stripeSubscription.id,
      },
      'No subscription found for customer.subscription.updated'
    );
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<string, SubscriptionStatus> = {
    'trialing': 'trialing',
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'unpaid',
    'incomplete': 'incomplete',
    'incomplete_expired': 'incomplete_expired',
  };

  const status = statusMap[stripeSubscription.status] || 'incomplete';

  // Get plan tier from price ID
  const priceId = stripeSubscription.items.data[0]?.price.id;
  const planTier = priceId ? getPlanTierFromPriceId(priceId) : null;

  // Update subscription
  await updateSubscription(subscription.id, {
    status,
    plan_tier: planTier || subscription.plan_tier,
    current_period_start: new Date(stripeSubscription.current_period_start * 1000),
    current_period_end: new Date(stripeSubscription.current_period_end * 1000),
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    canceled_at: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : null,
  });

  // Log event
  await logBillingEvent(
    subscription.id,
    event.type,
    event.id,
    stripeSubscription as unknown as Record<string, unknown>
  );

  logger.info(
    {
      subscriptionId: subscription.id,
      workspaceId: subscription.workspace_id,
      status,
      planTier,
    },
    'Subscription updated successfully'
  );
}

/**
 * Handle customer.subscription.deleted event
 * Triggered when subscription is deleted/canceled
 *
 * @param event - Stripe event object
 */
export async function handleSubscriptionDeleted(
  event: Stripe.Event
): Promise<void> {
  const stripeSubscription = event.data.object as Stripe.Subscription;

  logger.warn(
    {
      subscriptionId: stripeSubscription.id,
      customerId: stripeSubscription.customer,
    },
    'Processing customer.subscription.deleted'
  );

  // Get subscription
  const subscription = await getSubscriptionByStripeId(stripeSubscription.id);

  if (!subscription) {
    logger.error(
      {
        stripeSubscriptionId: stripeSubscription.id,
      },
      'No subscription found for customer.subscription.deleted'
    );
    return;
  }

  // Update subscription to canceled
  await updateSubscription(subscription.id, {
    status: 'canceled',
    canceled_at: new Date(),
  });

  // Log event
  await logBillingEvent(
    subscription.id,
    event.type,
    event.id,
    stripeSubscription as unknown as Record<string, unknown>
  );

  logger.warn(
    {
      subscriptionId: subscription.id,
      workspaceId: subscription.workspace_id,
    },
    'Subscription deleted/canceled'
  );

  // TODO: Send notification to user about subscription cancellation
}

/**
 * Handle customer.subscription.trial_will_end event
 * Triggered 3 days before trial ends
 *
 * @param event - Stripe event object
 */
export async function handleTrialWillEnd(
  event: Stripe.Event
): Promise<void> {
  const stripeSubscription = event.data.object as Stripe.Subscription;

  logger.info(
    {
      subscriptionId: stripeSubscription.id,
      customerId: stripeSubscription.customer,
      trialEnd: stripeSubscription.trial_end,
    },
    'Processing customer.subscription.trial_will_end'
  );

  // Get subscription
  const subscription = await getSubscriptionByStripeId(stripeSubscription.id);

  if (!subscription) {
    logger.error(
      {
        stripeSubscriptionId: stripeSubscription.id,
      },
      'No subscription found for customer.subscription.trial_will_end'
    );
    return;
  }

  // Log event
  await logBillingEvent(
    subscription.id,
    event.type,
    event.id,
    stripeSubscription as unknown as Record<string, unknown>
  );

  logger.info(
    {
      subscriptionId: subscription.id,
      workspaceId: subscription.workspace_id,
      trialEnd: stripeSubscription.trial_end,
    },
    'Trial will end soon'
  );

  // TODO: Send notification to user about trial ending
}

/**
 * Verify Stripe webhook signature
 *
 * @param payload - Raw request body
 * @param signature - Stripe signature header
 * @returns Verified Stripe event
 * @throws Error if signature is invalid
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  try {
    const event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );

    return event;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Webhook signature verification failed'
    );

    throw new Error(
      `Webhook signature verification failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Process a Stripe webhook event
 * Routes to appropriate handler based on event type
 *
 * @param event - Verified Stripe event
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  logger.info(
    {
      eventId: event.id,
      eventType: event.type,
    },
    'Processing Stripe webhook event'
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event);
        break;

      default:
        logger.debug(
          {
            eventId: event.id,
            eventType: event.type,
          },
          'Unhandled webhook event type'
        );
    }

    logger.info(
      {
        eventId: event.id,
        eventType: event.type,
      },
      'Webhook event processed successfully'
    );
  } catch (error) {
    logger.error(
      {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Failed to process webhook event'
    );

    // Re-throw to signal failure to Stripe (will retry)
    throw error;
  }
}
