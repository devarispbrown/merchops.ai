/**
 * Billing Module
 *
 * Central export point for all billing functionality.
 * Provides subscription management, usage tracking, and Stripe integration.
 */

// Plan definitions and limits
export {
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_FEATURES,
  STRIPE_PRICE_IDS,
  USAGE_METRICS,
  TRIAL_PERIOD_DAYS,
  getPlanLimit,
  isUnlimited,
  getPlanPrice,
  getStripePriceId,
  getPlanFeatures,
  getAllPlans,
  getRecommendedPlan,
  isValidUpgrade,
  isValidDowngrade,
  getTrialEndDate,
  isTrialExpired,
  getRemainingTrialDays,
} from './plans';

export type { UsageMetric } from './plans';

// Stripe customer management
export {
  stripe,
  createStripeCustomer,
  getStripeCustomer,
  updateStripeCustomer,
  findStripeCustomerByEmail,
  deleteStripeCustomer,
  createCheckoutSession,
  createBillingPortalSession,
} from './customer';

// Subscription CRUD
export {
  getSubscription,
  getSubscriptionByCustomerId,
  getSubscriptionByStripeId,
  createSubscription,
  updateSubscription,
  updateSubscriptionByWorkspace,
  getOrCreateSubscription,
  cancelSubscriptionAtPeriodEnd,
  reactivateSubscription,
  isSubscriptionActive,
  isTrialing,
  isPastDue,
  hasPaymentMethod,
  getSubscriptionWithWorkspace,
  getSubscriptionsByStatus,
  getTrialsExpiringSoon,
} from './subscription';

// Usage limit enforcement
export {
  LimitExceededError,
  getUsage,
  checkLimit,
  incrementUsage,
  getUsagePercentage,
  getUsageStats,
  resetUsage,
  isApproachingLimit,
  getWorkspacesExceedingLimits,
} from './limit-enforcement';

// Webhook event handlers
export {
  verifyWebhookSignature,
  processWebhookEvent,
  handleCheckoutCompleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleTrialWillEnd,
} from './webhooks';
