/**
 * Billing Plan Definitions
 *
 * Defines subscription tiers, pricing, usage limits, and feature sets
 * for MerchOps billing system.
 */

import { PlanTier } from '@prisma/client';

/**
 * Usage limits per plan tier
 */
export const PLAN_LIMITS = {
  trial: {
    opportunities_per_month: 100,
    actions_per_month: 50,
    events_per_month: 5000,
  },
  starter: {
    opportunities_per_month: 25,
    actions_per_month: 10,
    events_per_month: 500,
  },
  growth: {
    opportunities_per_month: 100,
    actions_per_month: 50,
    events_per_month: 5000,
  },
  pro: {
    opportunities_per_month: -1, // Unlimited
    actions_per_month: -1, // Unlimited
    events_per_month: -1, // Unlimited
  },
} as const;

/**
 * Plan prices in cents (USD)
 */
export const PLAN_PRICES = {
  trial: 0,
  starter: 4900, // $49.00
  growth: 14900, // $149.00
  pro: 39900, // $399.00
} as const;

/**
 * Stripe Price IDs from environment variables
 * These should be configured in Stripe dashboard and set in env vars
 */
export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  growth: process.env.STRIPE_GROWTH_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
} as const;

/**
 * Plan features
 */
export const PLAN_FEATURES = {
  trial: {
    name: 'Trial',
    description: '14-day free trial with Growth plan features',
    features: [
      '100 opportunities per month',
      '50 actions per month',
      '5,000 events per month',
      'All core features included',
      'Email support',
    ],
    trial_days: 14,
    recommended: false,
  },
  starter: {
    name: 'Starter',
    description: 'Perfect for stores under $50K/mo revenue',
    features: [
      '25 opportunities per month',
      '10 actions per month',
      '500 events per month',
      'All core features included',
      'Email support',
    ],
    trial_days: 0,
    recommended: false,
  },
  growth: {
    name: 'Growth',
    description: 'Best for stores $50K-$500K/mo revenue',
    features: [
      '100 opportunities per month',
      '50 actions per month',
      '5,000 events per month',
      'All core features included',
      'Priority email support',
      'Advanced analytics',
    ],
    trial_days: 0,
    recommended: true,
  },
  pro: {
    name: 'Pro',
    description: 'For stores over $500K/mo revenue',
    features: [
      'Unlimited opportunities',
      'Unlimited actions',
      'Unlimited events',
      'All features included',
      'Dedicated support',
      'Advanced analytics',
      'Custom integrations',
    ],
    trial_days: 0,
    recommended: false,
  },
} as const;

/**
 * Usage metrics tracked for billing
 */
export const USAGE_METRICS = {
  OPPORTUNITIES: 'opportunities',
  ACTIONS: 'actions',
  EVENTS: 'events',
} as const;

export type UsageMetric = (typeof USAGE_METRICS)[keyof typeof USAGE_METRICS];

/**
 * Get the usage limit for a specific plan and metric
 *
 * @param tier - The plan tier
 * @param metric - The usage metric
 * @returns The limit value (-1 for unlimited, 0+ for specific limit)
 */
export function getPlanLimit(tier: PlanTier, metric: UsageMetric): number {
  const limits = PLAN_LIMITS[tier];

  switch (metric) {
    case USAGE_METRICS.OPPORTUNITIES:
      return limits.opportunities_per_month;
    case USAGE_METRICS.ACTIONS:
      return limits.actions_per_month;
    case USAGE_METRICS.EVENTS:
      return limits.events_per_month;
    default:
      return 0;
  }
}

/**
 * Check if a plan has unlimited usage for a metric
 *
 * @param tier - The plan tier
 * @param metric - The usage metric
 * @returns True if unlimited, false otherwise
 */
export function isUnlimited(tier: PlanTier, metric: UsageMetric): boolean {
  const limit = getPlanLimit(tier, metric);
  return limit === -1;
}

/**
 * Get the price for a plan tier in cents
 *
 * @param tier - The plan tier
 * @returns Price in cents
 */
export function getPlanPrice(tier: PlanTier): number {
  return PLAN_PRICES[tier];
}

/**
 * Get the Stripe Price ID for a plan tier
 *
 * @param tier - The plan tier
 * @returns Stripe Price ID
 * @throws Error if price ID is not configured for paid plans
 */
export function getStripePriceId(tier: PlanTier): string | null {
  if (tier === 'trial') {
    return null; // No Stripe price for trial
  }

  const priceId = STRIPE_PRICE_IDS[tier];

  if (!priceId) {
    throw new Error(
      `Stripe Price ID not configured for ${tier} plan. ` +
      `Please set STRIPE_${tier.toUpperCase()}_PRICE_ID environment variable.`
    );
  }

  return priceId;
}

/**
 * Get plan features for a tier
 *
 * @param tier - The plan tier
 * @returns Plan features object
 */
export function getPlanFeatures(tier: PlanTier) {
  return PLAN_FEATURES[tier];
}

/**
 * Get all available plans for display in UI
 *
 * @returns Array of plan objects with tier, features, and pricing
 */
export function getAllPlans() {
  return Object.entries(PLAN_FEATURES).map(([tier, features]) => ({
    tier: tier as PlanTier,
    ...features,
    price: PLAN_PRICES[tier as PlanTier],
    limits: PLAN_LIMITS[tier as PlanTier],
  }));
}

/**
 * Get the recommended plan tier
 *
 * @returns The recommended plan tier
 */
export function getRecommendedPlan(): PlanTier {
  return 'growth';
}

/**
 * Check if a tier upgrade is valid
 *
 * @param currentTier - Current plan tier
 * @param newTier - Proposed new plan tier
 * @returns True if upgrade is valid
 */
export function isValidUpgrade(currentTier: PlanTier, newTier: PlanTier): boolean {
  const tierOrder: PlanTier[] = ['trial', 'starter', 'growth', 'pro'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const newIndex = tierOrder.indexOf(newTier);

  // Can upgrade or change to same tier (for reactivation)
  return newIndex >= currentIndex;
}

/**
 * Check if a tier downgrade is valid
 *
 * @param currentTier - Current plan tier
 * @param newTier - Proposed new plan tier
 * @returns True if downgrade is valid
 */
export function isValidDowngrade(currentTier: PlanTier, newTier: PlanTier): boolean {
  const tierOrder: PlanTier[] = ['trial', 'starter', 'growth', 'pro'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const newIndex = tierOrder.indexOf(newTier);

  // Can downgrade to lower tier (but not to trial)
  return newIndex < currentIndex && newTier !== 'trial';
}

/**
 * Trial period duration in days
 */
export const TRIAL_PERIOD_DAYS = 14;

/**
 * Get trial end date from start date
 *
 * @param startDate - Trial start date
 * @returns Trial end date
 */
export function getTrialEndDate(startDate: Date = new Date()): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + TRIAL_PERIOD_DAYS);
  return endDate;
}

/**
 * Check if trial is expired
 *
 * @param trialEnd - Trial end date
 * @returns True if trial has expired
 */
export function isTrialExpired(trialEnd: Date | null | undefined): boolean {
  if (!trialEnd) return false;
  return new Date() > trialEnd;
}

/**
 * Get remaining trial days
 *
 * @param trialEnd - Trial end date
 * @returns Number of days remaining (0 if expired)
 */
export function getRemainingTrialDays(trialEnd: Date | null | undefined): number {
  if (!trialEnd) return 0;

  const now = new Date();
  const diff = trialEnd.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return Math.max(0, days);
}
