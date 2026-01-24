/**
 * Subscription Management
 *
 * CRUD operations for subscription records with strict workspace scoping.
 * Manages subscription lifecycle and state transitions.
 */

import { prisma } from '@/server/db';
import { PlanTier, SubscriptionStatus, Subscription } from '@prisma/client';
import { logger } from '@/server/observability/logger';
import { NotFoundError, ConflictError } from '@/server/observability/error-handler';
import { getTrialEndDate } from './plans';
import { createStripeCustomer } from './customer';

/**
 * Get subscription for a workspace
 *
 * @param workspaceId - Workspace ID
 * @returns Subscription or null if not found
 */
export async function getSubscription(
  workspaceId: string
): Promise<Subscription | null> {
  const subscription = await prisma.subscription.findUnique({
    where: {
      workspace_id: workspaceId,
    },
  });

  return subscription;
}

/**
 * Get subscription by Stripe customer ID
 *
 * @param stripeCustomerId - Stripe customer ID
 * @returns Subscription or null if not found
 */
export async function getSubscriptionByCustomerId(
  stripeCustomerId: string
): Promise<Subscription | null> {
  const subscription = await prisma.subscription.findUnique({
    where: {
      stripe_customer_id: stripeCustomerId,
    },
  });

  return subscription;
}

/**
 * Get subscription by Stripe subscription ID
 *
 * @param stripeSubscriptionId - Stripe subscription ID
 * @returns Subscription or null if not found
 */
export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string
): Promise<Subscription | null> {
  const subscription = await prisma.subscription.findUnique({
    where: {
      stripe_subscription_id: stripeSubscriptionId,
    },
  });

  return subscription;
}

/**
 * Create a new subscription
 *
 * @param workspaceId - Workspace ID
 * @param stripeCustomerId - Stripe customer ID
 * @param planTier - Initial plan tier (defaults to trial)
 * @returns Created subscription
 */
export async function createSubscription(
  workspaceId: string,
  stripeCustomerId: string,
  planTier: PlanTier = 'trial'
): Promise<Subscription> {
  // Check if subscription already exists
  const existing = await getSubscription(workspaceId);
  if (existing) {
    throw new ConflictError(
      'Subscription already exists for this workspace',
      { workspaceId }
    );
  }

  const now = new Date();
  const trialEnd = planTier === 'trial' ? getTrialEndDate(now) : null;

  logger.info(
    {
      workspaceId,
      stripeCustomerId,
      planTier,
      trialEnd,
    },
    'Creating subscription'
  );

  const subscription = await prisma.subscription.create({
    data: {
      workspace_id: workspaceId,
      stripe_customer_id: stripeCustomerId,
      plan_tier: planTier,
      status: planTier === 'trial' ? 'trialing' : 'incomplete',
      trial_start: planTier === 'trial' ? now : null,
      trial_end: trialEnd,
    },
  });

  logger.info(
    {
      subscriptionId: subscription.id,
      workspaceId,
      planTier,
    },
    'Subscription created successfully'
  );

  return subscription;
}

/**
 * Update a subscription
 *
 * @param subscriptionId - Subscription ID
 * @param data - Update data
 * @returns Updated subscription
 */
export async function updateSubscription(
  subscriptionId: string,
  data: {
    stripe_subscription_id?: string;
    plan_tier?: PlanTier;
    status?: SubscriptionStatus;
    current_period_start?: Date;
    current_period_end?: Date;
    trial_start?: Date | null;
    trial_end?: Date | null;
    cancel_at_period_end?: boolean;
    canceled_at?: Date | null;
  }
): Promise<Subscription> {
  logger.info(
    {
      subscriptionId,
      updates: data,
    },
    'Updating subscription'
  );

  const subscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data,
  });

  logger.info(
    {
      subscriptionId: subscription.id,
      workspaceId: subscription.workspace_id,
      status: subscription.status,
      planTier: subscription.plan_tier,
    },
    'Subscription updated successfully'
  );

  return subscription;
}

/**
 * Update subscription by workspace ID
 *
 * @param workspaceId - Workspace ID
 * @param data - Update data
 * @returns Updated subscription
 */
export async function updateSubscriptionByWorkspace(
  workspaceId: string,
  data: Parameters<typeof updateSubscription>[1]
): Promise<Subscription> {
  const subscription = await getSubscription(workspaceId);

  if (!subscription) {
    throw new NotFoundError('Subscription');
  }

  return updateSubscription(subscription.id, data);
}

/**
 * Get or create subscription for a workspace
 * Used during signup or first access
 *
 * @param workspaceId - Workspace ID
 * @param email - User email for Stripe customer creation
 * @param name - Optional name for Stripe customer
 * @returns Subscription (existing or newly created)
 */
export async function getOrCreateSubscription(
  workspaceId: string,
  email: string,
  name?: string
): Promise<Subscription> {
  // Try to get existing subscription
  const existing = await getSubscription(workspaceId);
  if (existing) {
    return existing;
  }

  logger.info(
    { workspaceId, email },
    'Creating new subscription with trial'
  );

  // Create Stripe customer
  const customer = await createStripeCustomer(email, workspaceId, name);

  // Create subscription with trial
  return createSubscription(workspaceId, customer.id, 'trial');
}

/**
 * Cancel subscription at end of billing period
 *
 * @param workspaceId - Workspace ID
 * @returns Updated subscription
 */
export async function cancelSubscriptionAtPeriodEnd(
  workspaceId: string
): Promise<Subscription> {
  const subscription = await getSubscription(workspaceId);

  if (!subscription) {
    throw new NotFoundError('Subscription');
  }

  if (subscription.status === 'canceled') {
    throw new ConflictError('Subscription is already canceled');
  }

  logger.info(
    {
      subscriptionId: subscription.id,
      workspaceId,
    },
    'Canceling subscription at period end'
  );

  return updateSubscription(subscription.id, {
    cancel_at_period_end: true,
    canceled_at: new Date(),
  });
}

/**
 * Reactivate a canceled subscription
 *
 * @param workspaceId - Workspace ID
 * @returns Updated subscription
 */
export async function reactivateSubscription(
  workspaceId: string
): Promise<Subscription> {
  const subscription = await getSubscription(workspaceId);

  if (!subscription) {
    throw new NotFoundError('Subscription');
  }

  if (subscription.status !== 'canceled' && !subscription.cancel_at_period_end) {
    throw new ConflictError('Subscription is not canceled');
  }

  logger.info(
    {
      subscriptionId: subscription.id,
      workspaceId,
    },
    'Reactivating subscription'
  );

  return updateSubscription(subscription.id, {
    cancel_at_period_end: false,
    canceled_at: null,
  });
}

/**
 * Check if subscription is active (can use the product)
 *
 * @param subscription - Subscription object
 * @returns True if subscription allows product usage
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
  const activeStatuses: SubscriptionStatus[] = ['trialing', 'active'];
  return activeStatuses.includes(subscription.status);
}

/**
 * Check if subscription is in trial period
 *
 * @param subscription - Subscription object
 * @returns True if in trial period
 */
export function isTrialing(subscription: Subscription): boolean {
  if (subscription.status !== 'trialing') {
    return false;
  }

  if (!subscription.trial_end) {
    return false;
  }

  return new Date() < subscription.trial_end;
}

/**
 * Check if subscription is past due
 *
 * @param subscription - Subscription object
 * @returns True if payment is past due
 */
export function isPastDue(subscription: Subscription): boolean {
  return subscription.status === 'past_due';
}

/**
 * Check if subscription has valid payment method
 * This requires checking with Stripe customer
 *
 * @param subscription - Subscription object
 * @returns True if has payment method on file
 */
export async function hasPaymentMethod(subscription: Subscription): Promise<boolean> {
  const { getStripeCustomer } = await import('./customer');

  const customer = await getStripeCustomer(subscription.stripe_customer_id);

  if (!customer) {
    return false;
  }

  // Check if customer has a default payment method
  return !!customer.invoice_settings?.default_payment_method;
}

/**
 * Get subscription with workspace data
 *
 * @param workspaceId - Workspace ID
 * @returns Subscription with workspace or null
 */
export async function getSubscriptionWithWorkspace(workspaceId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: {
      workspace_id: workspaceId,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          created_at: true,
        },
      },
    },
  });

  return subscription;
}

/**
 * Get all subscriptions with specific status
 * Useful for background jobs and monitoring
 *
 * @param status - Subscription status
 * @param limit - Maximum results to return
 * @returns Array of subscriptions
 */
export async function getSubscriptionsByStatus(
  status: SubscriptionStatus,
  limit: number = 100
): Promise<Subscription[]> {
  const subscriptions = await prisma.subscription.findMany({
    where: { status },
    take: limit,
    orderBy: { updated_at: 'desc' },
  });

  return subscriptions;
}

/**
 * Get subscriptions expiring soon (for trial reminders)
 *
 * @param daysUntilExpiry - Number of days until trial ends
 * @returns Array of subscriptions expiring soon
 */
export async function getTrialsExpiringSoon(daysUntilExpiry: number = 3): Promise<Subscription[]> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysUntilExpiry);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'trialing',
      trial_end: {
        gte: now,
        lte: futureDate,
      },
    },
    orderBy: { trial_end: 'asc' },
  });

  return subscriptions;
}
