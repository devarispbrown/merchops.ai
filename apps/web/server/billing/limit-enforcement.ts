/**
 * Usage Limit Enforcement
 *
 * Tracks and enforces usage limits for subscriptions based on plan tier.
 * Handles limit checks, usage increments, and usage reporting.
 */

import { prisma } from '@/server/db';
import { logger } from '@/server/observability/logger';
import { AppError, ErrorType } from '@/server/observability/error-handler';
import { getSubscription } from './subscription';
import { getPlanLimit, isUnlimited, UsageMetric, USAGE_METRICS } from './plans';

/**
 * Custom error for limit exceeded scenarios
 */
export class LimitExceededError extends AppError {
  constructor(
    public metric: UsageMetric,
    public limit: number,
    public current: number,
    public planTier: string
  ) {
    super(
      ErrorType.RATE_LIMIT,
      `${metric} limit exceeded: ${current}/${limit} for ${planTier} plan`,
      429,
      `You've reached your plan limit for ${metric}. Please upgrade to continue.`,
      {
        metric,
        limit,
        current,
        planTier,
      }
    );
    this.name = 'LimitExceededError';
  }
}

/**
 * Get current billing period start and end dates
 *
 * @param subscription - Subscription object
 * @returns Object with period_start and period_end
 */
function getCurrentBillingPeriod(subscription: {
  current_period_start: Date | null;
  current_period_end: Date | null;
  trial_start: Date | null;
  trial_end: Date | null;
  status: string;
}) {
  // If on trial, use trial period
  if (subscription.status === 'trialing' && subscription.trial_start && subscription.trial_end) {
    return {
      period_start: subscription.trial_start,
      period_end: subscription.trial_end,
    };
  }

  // Use current billing period
  if (subscription.current_period_start && subscription.current_period_end) {
    return {
      period_start: subscription.current_period_start,
      period_end: subscription.current_period_end,
    };
  }

  // Fallback to current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    period_start: startOfMonth,
    period_end: endOfMonth,
  };
}

/**
 * Get current usage for a workspace and metric
 *
 * @param workspaceId - Workspace ID
 * @param metric - Usage metric to check
 * @returns Current usage count
 */
export async function getUsage(
  workspaceId: string,
  metric: UsageMetric
): Promise<number> {
  const subscription = await getSubscription(workspaceId);

  if (!subscription) {
    logger.warn(
      { workspaceId, metric },
      'No subscription found for workspace when checking usage'
    );
    return 0;
  }

  const { period_start } = getCurrentBillingPeriod(subscription);

  // Get or create usage record for current period
  const usageRecord = await prisma.usageRecord.findUnique({
    where: {
      subscription_id_metric_period_start: {
        subscription_id: subscription.id,
        metric,
        period_start,
      },
    },
  });

  return usageRecord?.count || 0;
}

/**
 * Check if workspace can perform action based on usage limits
 *
 * @param workspaceId - Workspace ID
 * @param metric - Usage metric to check
 * @throws LimitExceededError if limit is exceeded
 */
export async function checkLimit(
  workspaceId: string,
  metric: UsageMetric
): Promise<void> {
  const subscription = await getSubscription(workspaceId);

  if (!subscription) {
    throw new AppError(
      ErrorType.NOT_FOUND,
      'No subscription found for workspace',
      404,
      'Please set up billing to continue'
    );
  }

  // Check if plan has unlimited usage for this metric
  if (isUnlimited(subscription.plan_tier, metric)) {
    return; // No limit to check
  }

  const limit = getPlanLimit(subscription.plan_tier, metric);
  const current = await getUsage(workspaceId, metric);

  logger.debug(
    {
      workspaceId,
      metric,
      current,
      limit,
      planTier: subscription.plan_tier,
    },
    'Checking usage limit'
  );

  if (current >= limit) {
    logger.warn(
      {
        workspaceId,
        metric,
        current,
        limit,
        planTier: subscription.plan_tier,
      },
      'Usage limit exceeded'
    );

    throw new LimitExceededError(metric, limit, current, subscription.plan_tier);
  }
}

/**
 * Increment usage for a workspace and metric
 * Should be called after successful action completion
 *
 * @param workspaceId - Workspace ID
 * @param metric - Usage metric to increment
 * @param amount - Amount to increment (defaults to 1)
 * @returns Updated usage count
 */
export async function incrementUsage(
  workspaceId: string,
  metric: UsageMetric,
  amount: number = 1
): Promise<number> {
  const subscription = await getSubscription(workspaceId);

  if (!subscription) {
    logger.warn(
      { workspaceId, metric, amount },
      'No subscription found when incrementing usage'
    );
    return 0;
  }

  const { period_start, period_end } = getCurrentBillingPeriod(subscription);

  logger.debug(
    {
      workspaceId,
      subscriptionId: subscription.id,
      metric,
      amount,
      period_start,
      period_end,
    },
    'Incrementing usage'
  );

  // Upsert usage record
  const usageRecord = await prisma.usageRecord.upsert({
    where: {
      subscription_id_metric_period_start: {
        subscription_id: subscription.id,
        metric,
        period_start,
      },
    },
    update: {
      count: {
        increment: amount,
      },
    },
    create: {
      subscription_id: subscription.id,
      metric,
      count: amount,
      period_start,
      period_end,
    },
  });

  logger.info(
    {
      workspaceId,
      metric,
      newCount: usageRecord.count,
      period_start,
    },
    'Usage incremented successfully'
  );

  return usageRecord.count;
}

/**
 * Get usage percentage for a metric
 *
 * @param workspaceId - Workspace ID
 * @param metric - Usage metric
 * @returns Usage percentage (0-100), -1 if unlimited
 */
export async function getUsagePercentage(
  workspaceId: string,
  metric: UsageMetric
): Promise<number> {
  const subscription = await getSubscription(workspaceId);

  if (!subscription) {
    return 0;
  }

  if (isUnlimited(subscription.plan_tier, metric)) {
    return -1; // Unlimited
  }

  const limit = getPlanLimit(subscription.plan_tier, metric);
  const current = await getUsage(workspaceId, metric);

  if (limit === 0) {
    return 100; // No usage allowed
  }

  return Math.min(100, Math.round((current / limit) * 100));
}

/**
 * Get all usage stats for a workspace
 *
 * @param workspaceId - Workspace ID
 * @returns Object with usage stats for all metrics
 */
export async function getUsageStats(workspaceId: string) {
  const subscription = await getSubscription(workspaceId);

  if (!subscription) {
    return null;
  }

  const metrics = Object.values(USAGE_METRICS);

  const stats = await Promise.all(
    metrics.map(async (metric) => {
      const current = await getUsage(workspaceId, metric);
      const limit = getPlanLimit(subscription.plan_tier, metric);
      const unlimited = isUnlimited(subscription.plan_tier, metric);
      const percentage = unlimited ? -1 : Math.min(100, Math.round((current / limit) * 100));

      return {
        metric,
        current,
        limit: unlimited ? -1 : limit,
        unlimited,
        percentage,
      };
    })
  );

  return {
    workspace_id: workspaceId,
    plan_tier: subscription.plan_tier,
    status: subscription.status,
    metrics: stats.reduce(
      (acc, stat) => {
        acc[stat.metric] = stat;
        return acc;
      },
      {} as Record<string, typeof stats[0]>
    ),
  };
}

/**
 * Reset usage for a workspace (used when billing period renews)
 * Note: This is typically handled by creating new usage records,
 * but this function can manually reset if needed
 *
 * @param workspaceId - Workspace ID
 * @param metric - Optional specific metric to reset (resets all if not provided)
 */
export async function resetUsage(
  workspaceId: string,
  metric?: UsageMetric
): Promise<void> {
  const subscription = await getSubscription(workspaceId);

  if (!subscription) {
    throw new AppError(
      ErrorType.NOT_FOUND,
      'No subscription found for workspace'
    );
  }

  logger.warn(
    {
      workspaceId,
      subscriptionId: subscription.id,
      metric: metric || 'all',
    },
    'Manually resetting usage'
  );

  const { period_start } = getCurrentBillingPeriod(subscription);

  if (metric) {
    // Reset specific metric
    await prisma.usageRecord.updateMany({
      where: {
        subscription_id: subscription.id,
        metric,
        period_start,
      },
      data: {
        count: 0,
      },
    });
  } else {
    // Reset all metrics for current period
    await prisma.usageRecord.updateMany({
      where: {
        subscription_id: subscription.id,
        period_start,
      },
      data: {
        count: 0,
      },
    });
  }

  logger.info(
    {
      workspaceId,
      metric: metric || 'all',
    },
    'Usage reset successfully'
  );
}

/**
 * Check if workspace is approaching limit (e.g., at 80%)
 *
 * @param workspaceId - Workspace ID
 * @param metric - Usage metric
 * @param threshold - Percentage threshold (default 80)
 * @returns True if approaching limit
 */
export async function isApproachingLimit(
  workspaceId: string,
  metric: UsageMetric,
  threshold: number = 80
): Promise<boolean> {
  const percentage = await getUsagePercentage(workspaceId, metric);

  // -1 means unlimited
  if (percentage === -1) {
    return false;
  }

  return percentage >= threshold;
}

/**
 * Get workspaces that have exceeded limits
 * Useful for monitoring and alerts
 *
 * @param metric - Optional specific metric to check
 * @returns Array of workspace IDs that exceeded limits
 */
export async function getWorkspacesExceedingLimits(
  metric?: UsageMetric
): Promise<string[]> {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: {
        in: ['trialing', 'active'],
      },
    },
    include: {
      usage_records: true,
    },
  });

  const exceeding: string[] = [];

  for (const subscription of subscriptions) {
    const { period_start } = getCurrentBillingPeriod(subscription);

    const metricsToCheck = metric ? [metric] : Object.values(USAGE_METRICS);

    for (const m of metricsToCheck) {
      if (isUnlimited(subscription.plan_tier, m)) {
        continue;
      }

      const limit = getPlanLimit(subscription.plan_tier, m);
      const usage = subscription.usage_records.find(
        (r) => r.metric === m && r.period_start.getTime() === period_start.getTime()
      );

      if (usage && usage.count >= limit) {
        exceeding.push(subscription.workspace_id);
        break; // Only add workspace once
      }
    }
  }

  return exceeding;
}
