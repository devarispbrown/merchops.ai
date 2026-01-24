/**
 * Unit Tests: Usage Limit Enforcement
 * MerchOps Beta MVP
 *
 * Tests:
 * - Usage tracking and retrieval
 * - Limit checks and validation
 * - Limit exceeded errors
 * - Usage increments
 * - Usage statistics
 * - Approaching limit warnings
 */

// Mock Stripe customer module BEFORE imports
vi.mock('@/server/billing/customer', () => ({
  createStripeCustomer: vi.fn(),
  stripe: {
    webhooks: { constructEvent: vi.fn() },
  },
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock, mockCurrentTime, restoreTime } from '../../setup';
import {
  LimitExceededError,
  getUsage,
  checkLimit,
  incrementUsage,
  getUsagePercentage,
  getUsageStats,
  resetUsage,
  isApproachingLimit,
  getWorkspacesExceedingLimits,
} from '@/server/billing/limit-enforcement';
import { USAGE_METRICS } from '@/server/billing/plans';
import { AppError, ErrorType } from '@/server/observability/error-handler';
import type { Subscription, UsageRecord } from '@prisma/client';

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

function createTestUsageRecord(overrides = {}): UsageRecord {
  return {
    id: 'test-usage-id',
    subscription_id: 'test-sub-id',
    metric: 'opportunities',
    count: 10,
    period_start: new Date('2024-01-01T00:00:00Z'),
    period_end: new Date('2024-02-01T00:00:00Z'),
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-10T00:00:00Z'),
    ...overrides,
  } as UsageRecord;
}

// ============================================================================
// TESTS: GET USAGE
// ============================================================================

describe('getUsage', () => {
  it('returns current usage count for metric', async () => {
    const subscription = createTestSubscription();
    const usageRecord = createTestUsageRecord({ count: 15 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await getUsage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(15);
  });

  it('returns 0 when no usage record exists', async () => {
    const subscription = createTestSubscription();

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(null);

    const result = await getUsage('test-workspace-id', USAGE_METRICS.ACTIONS);

    expect(result).toBe(0);
  });

  it('returns 0 when subscription not found', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const result = await getUsage('nonexistent-workspace', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(0);
  });

  it('queries usage record with correct period', async () => {
    const subscription = createTestSubscription({
      current_period_start: new Date('2024-01-15T00:00:00Z'),
    });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(null);

    await getUsage('test-workspace-id', USAGE_METRICS.EVENTS);

    expect(prismaMock.usageRecord.findUnique).toHaveBeenCalledWith({
      where: {
        subscription_id_metric_period_start: {
          subscription_id: 'test-sub-id',
          metric: 'events',
          period_start: new Date('2024-01-15T00:00:00Z'),
        },
      },
    });
  });

  it('uses trial period for trialing subscriptions', async () => {
    const subscription = createTestSubscription({
      status: 'trialing',
      trial_start: new Date('2024-01-01T00:00:00Z'),
      trial_end: new Date('2024-01-15T00:00:00Z'),
      current_period_start: null,
      current_period_end: null,
    });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(null);

    await getUsage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(prismaMock.usageRecord.findUnique).toHaveBeenCalledWith({
      where: {
        subscription_id_metric_period_start: {
          subscription_id: 'test-sub-id',
          metric: 'opportunities',
          period_start: new Date('2024-01-01T00:00:00Z'),
        },
      },
    });
  });
});

// ============================================================================
// TESTS: CHECK LIMIT
// ============================================================================

describe('checkLimit', () => {
  it('passes when usage is under limit', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 25 opportunities
    const usageRecord = createTestUsageRecord({ count: 10 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    await expect(
      checkLimit('test-workspace-id', USAGE_METRICS.OPPORTUNITIES)
    ).resolves.toBeUndefined();
  });

  it('passes when usage is exactly at limit minus 1', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 25 opportunities
    const usageRecord = createTestUsageRecord({ count: 24 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    await expect(
      checkLimit('test-workspace-id', USAGE_METRICS.OPPORTUNITIES)
    ).resolves.toBeUndefined();
  });

  it('throws LimitExceededError when at limit', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 25 opportunities
    const usageRecord = createTestUsageRecord({ count: 25 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    await expect(
      checkLimit('test-workspace-id', USAGE_METRICS.OPPORTUNITIES)
    ).rejects.toThrow(LimitExceededError);
  });

  it('throws LimitExceededError when over limit', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 10 actions
    const usageRecord = createTestUsageRecord({ metric: 'actions', count: 15 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    await expect(
      checkLimit('test-workspace-id', USAGE_METRICS.ACTIONS)
    ).rejects.toThrow(LimitExceededError);
  });

  it('passes for unlimited plan', async () => {
    const subscription = createTestSubscription({ plan_tier: 'pro' }); // Unlimited
    const usageRecord = createTestUsageRecord({ count: 99999 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    await expect(
      checkLimit('test-workspace-id', USAGE_METRICS.OPPORTUNITIES)
    ).resolves.toBeUndefined();
  });

  it('throws AppError when subscription not found', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    await expect(
      checkLimit('nonexistent-workspace', USAGE_METRICS.OPPORTUNITIES)
    ).rejects.toThrow(AppError);

    await expect(
      checkLimit('nonexistent-workspace', USAGE_METRICS.OPPORTUNITIES)
    ).rejects.toMatchObject({
      type: ErrorType.NOT_FOUND,
    });
  });

  it('LimitExceededError includes correct details', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' });
    const usageRecord = createTestUsageRecord({ count: 25 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    try {
      await checkLimit('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);
      expect.fail('Should have thrown LimitExceededError');
    } catch (error) {
      expect(error).toBeInstanceOf(LimitExceededError);
      const limitError = error as LimitExceededError;
      expect(limitError.metric).toBe('opportunities');
      expect(limitError.limit).toBe(25);
      expect(limitError.current).toBe(25);
      expect(limitError.planTier).toBe('starter');
    }
  });
});

// ============================================================================
// TESTS: INCREMENT USAGE
// ============================================================================

describe('incrementUsage', () => {
  beforeEach(() => {
    mockCurrentTime('2024-01-10T12:00:00Z');
  });

  afterEach(() => {
    restoreTime();
  });

  it('increments usage count by 1 by default', async () => {
    const subscription = createTestSubscription();
    const usageRecord = createTestUsageRecord({ count: 11 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.upsert.mockResolvedValue(usageRecord);

    const result = await incrementUsage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(11);
    expect(prismaMock.usageRecord.upsert).toHaveBeenCalledWith({
      where: {
        subscription_id_metric_period_start: {
          subscription_id: 'test-sub-id',
          metric: 'opportunities',
          period_start: subscription.current_period_start,
        },
      },
      update: {
        count: {
          increment: 1,
        },
      },
      create: expect.objectContaining({
        subscription_id: 'test-sub-id',
        metric: 'opportunities',
        count: 1,
      }),
    });
  });

  it('increments usage by custom amount', async () => {
    const subscription = createTestSubscription();
    const usageRecord = createTestUsageRecord({ count: 15 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.upsert.mockResolvedValue(usageRecord);

    const result = await incrementUsage('test-workspace-id', USAGE_METRICS.EVENTS, 5);

    expect(result).toBe(15);
    expect(prismaMock.usageRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          count: {
            increment: 5,
          },
        },
      })
    );
  });

  it('creates new usage record if none exists', async () => {
    const subscription = createTestSubscription();
    const usageRecord = createTestUsageRecord({ count: 1 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.upsert.mockResolvedValue(usageRecord);

    await incrementUsage('test-workspace-id', USAGE_METRICS.ACTIONS);

    expect(prismaMock.usageRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          subscription_id: 'test-sub-id',
          metric: 'actions',
          count: 1,
          period_start: subscription.current_period_start,
          period_end: subscription.current_period_end,
        },
      })
    );
  });

  it('returns 0 when subscription not found', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const result = await incrementUsage('nonexistent-workspace', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(0);
    expect(prismaMock.usageRecord.upsert).not.toHaveBeenCalled();
  });

  it('handles different metrics correctly', async () => {
    const subscription = createTestSubscription();

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.upsert.mockResolvedValue(createTestUsageRecord());

    await incrementUsage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);
    await incrementUsage('test-workspace-id', USAGE_METRICS.ACTIONS);
    await incrementUsage('test-workspace-id', USAGE_METRICS.EVENTS);

    expect(prismaMock.usageRecord.upsert).toHaveBeenCalledTimes(3);
  });
});

// ============================================================================
// TESTS: USAGE PERCENTAGE
// ============================================================================

describe('getUsagePercentage', () => {
  it('returns correct percentage for partial usage', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 25 opportunities
    const usageRecord = createTestUsageRecord({ count: 10 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await getUsagePercentage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(40); // 10/25 = 40%
  });

  it('returns 100 when at limit', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 10 actions
    const usageRecord = createTestUsageRecord({ metric: 'actions', count: 10 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await getUsagePercentage('test-workspace-id', USAGE_METRICS.ACTIONS);

    expect(result).toBe(100);
  });

  it('returns 100 when over limit (capped)', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 25 opportunities
    const usageRecord = createTestUsageRecord({ count: 30 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await getUsagePercentage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(100); // Capped at 100, not 120
  });

  it('returns -1 for unlimited plans', async () => {
    const subscription = createTestSubscription({ plan_tier: 'pro' });
    const usageRecord = createTestUsageRecord({ count: 99999 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await getUsagePercentage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(-1);
  });

  it('returns 0 when no usage', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(null);

    const result = await getUsagePercentage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(0);
  });

  it('returns 0 when subscription not found', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const result = await getUsagePercentage('nonexistent-workspace', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(0);
  });

  it('rounds percentage to nearest integer', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 25 opportunities
    const usageRecord = createTestUsageRecord({ count: 7 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await getUsagePercentage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(28); // 7/25 = 28%
  });
});

// ============================================================================
// TESTS: USAGE STATS
// ============================================================================

describe('getUsageStats', () => {
  it('returns stats for all metrics', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' });

    const oppRecord = createTestUsageRecord({ metric: 'opportunities', count: 10 });
    const actRecord = createTestUsageRecord({ metric: 'actions', count: 5 });
    const evtRecord = createTestUsageRecord({ metric: 'events', count: 250 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique
      .mockResolvedValueOnce(oppRecord)
      .mockResolvedValueOnce(actRecord)
      .mockResolvedValueOnce(evtRecord);

    const result = await getUsageStats('test-workspace-id');

    expect(result).toBeDefined();
    expect(result?.workspace_id).toBe('test-workspace-id');
    expect(result?.plan_tier).toBe('starter');
    expect(result?.status).toBe('active');
    expect(result?.metrics).toHaveProperty('opportunities');
    expect(result?.metrics).toHaveProperty('actions');
    expect(result?.metrics).toHaveProperty('events');
  });

  it('includes correct metrics for each usage type', async () => {
    const subscription = createTestSubscription({ plan_tier: 'growth' });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(
      createTestUsageRecord({ count: 50 })
    );

    const result = await getUsageStats('test-workspace-id');

    const oppMetric = result?.metrics.opportunities;
    expect(oppMetric).toHaveProperty('metric', 'opportunities');
    expect(oppMetric).toHaveProperty('current', 50);
    expect(oppMetric).toHaveProperty('limit', 100);
    expect(oppMetric).toHaveProperty('unlimited', false);
    expect(oppMetric).toHaveProperty('percentage', 50);
  });

  it('shows unlimited for pro plan', async () => {
    const subscription = createTestSubscription({ plan_tier: 'pro' });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(
      createTestUsageRecord({ count: 99999 })
    );

    const result = await getUsageStats('test-workspace-id');

    const oppMetric = result?.metrics.opportunities;
    expect(oppMetric?.unlimited).toBe(true);
    expect(oppMetric?.limit).toBe(-1);
    expect(oppMetric?.percentage).toBe(-1);
  });

  it('returns null when subscription not found', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const result = await getUsageStats('nonexistent-workspace');

    expect(result).toBeNull();
  });
});

// ============================================================================
// TESTS: RESET USAGE
// ============================================================================

describe('resetUsage', () => {
  it('resets specific metric', async () => {
    const subscription = createTestSubscription();

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.updateMany.mockResolvedValue({ count: 1 });

    await resetUsage('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(prismaMock.usageRecord.updateMany).toHaveBeenCalledWith({
      where: {
        subscription_id: 'test-sub-id',
        metric: 'opportunities',
        period_start: subscription.current_period_start,
      },
      data: {
        count: 0,
      },
    });
  });

  it('resets all metrics when no metric specified', async () => {
    const subscription = createTestSubscription();

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.updateMany.mockResolvedValue({ count: 3 });

    await resetUsage('test-workspace-id');

    expect(prismaMock.usageRecord.updateMany).toHaveBeenCalledWith({
      where: {
        subscription_id: 'test-sub-id',
        period_start: subscription.current_period_start,
      },
      data: {
        count: 0,
      },
    });
  });

  it('throws AppError when subscription not found', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    await expect(
      resetUsage('nonexistent-workspace')
    ).rejects.toThrow(AppError);
  });
});

// ============================================================================
// TESTS: APPROACHING LIMIT
// ============================================================================

describe('isApproachingLimit', () => {
  it('returns true when at 80% threshold', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 25 opportunities
    const usageRecord = createTestUsageRecord({ count: 20 }); // 80%

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await isApproachingLimit('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(true);
  });

  it('returns true when above 80% threshold', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 10 actions
    const usageRecord = createTestUsageRecord({ metric: 'actions', count: 9 }); // 90%

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await isApproachingLimit('test-workspace-id', USAGE_METRICS.ACTIONS);

    expect(result).toBe(true);
  });

  it('returns false when below 80% threshold', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 25 opportunities
    const usageRecord = createTestUsageRecord({ count: 15 }); // 60%

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await isApproachingLimit('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(false);
  });

  it('accepts custom threshold', async () => {
    const subscription = createTestSubscription({ plan_tier: 'starter' }); // 25 opportunities
    const usageRecord = createTestUsageRecord({ count: 23 }); // 92%

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await isApproachingLimit('test-workspace-id', USAGE_METRICS.OPPORTUNITIES, 95);

    expect(result).toBe(false);
  });

  it('returns false for unlimited plans', async () => {
    const subscription = createTestSubscription({ plan_tier: 'pro' });
    const usageRecord = createTestUsageRecord({ count: 99999 });

    prismaMock.subscription.findUnique.mockResolvedValue(subscription);
    prismaMock.usageRecord.findUnique.mockResolvedValue(usageRecord);

    const result = await isApproachingLimit('test-workspace-id', USAGE_METRICS.OPPORTUNITIES);

    expect(result).toBe(false);
  });
});

// ============================================================================
// TESTS: WORKSPACES EXCEEDING LIMITS
// ============================================================================

describe('getWorkspacesExceedingLimits', () => {
  beforeEach(() => {
    mockCurrentTime('2024-01-10T12:00:00Z');
  });

  afterEach(() => {
    restoreTime();
  });

  it('returns workspaces that have exceeded limits', async () => {
    const sub1 = createTestSubscription({
      id: 'sub-1',
      workspace_id: 'workspace-1',
      plan_tier: 'starter',
    });

    const sub2 = createTestSubscription({
      id: 'sub-2',
      workspace_id: 'workspace-2',
      plan_tier: 'starter',
    });

    const usageOver = createTestUsageRecord({
      subscription_id: 'sub-1',
      count: 30, // Over 25 limit
      period_start: sub1.current_period_start!,
    });

    const usageUnder = createTestUsageRecord({
      subscription_id: 'sub-2',
      count: 10, // Under 25 limit
      period_start: sub2.current_period_start!,
    });

    prismaMock.subscription.findMany.mockResolvedValue([
      { ...sub1, usage_records: [usageOver] },
      { ...sub2, usage_records: [usageUnder] },
    ] as any);

    const result = await getWorkspacesExceedingLimits();

    expect(result).toContain('workspace-1');
    expect(result).not.toContain('workspace-2');
  });

  it('skips unlimited plans', async () => {
    const sub = createTestSubscription({
      id: 'sub-pro',
      workspace_id: 'workspace-pro',
      plan_tier: 'pro',
    });

    const usage = createTestUsageRecord({
      subscription_id: 'sub-pro',
      count: 99999,
      period_start: sub.current_period_start!,
    });

    prismaMock.subscription.findMany.mockResolvedValue([
      { ...sub, usage_records: [usage] },
    ] as any);

    const result = await getWorkspacesExceedingLimits();

    expect(result).toHaveLength(0);
  });

  it('checks specific metric when provided', async () => {
    const sub = createTestSubscription({
      id: 'sub-1',
      workspace_id: 'workspace-1',
      plan_tier: 'starter',
    });

    prismaMock.subscription.findMany.mockResolvedValue([
      { ...sub, usage_records: [] },
    ] as any);

    await getWorkspacesExceedingLimits(USAGE_METRICS.ACTIONS);

    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
      where: {
        status: {
          in: ['trialing', 'active'],
        },
      },
      include: {
        usage_records: true,
      },
    });
  });

  it('only returns each workspace once', async () => {
    const sub = createTestSubscription({
      id: 'sub-1',
      workspace_id: 'workspace-1',
      plan_tier: 'starter',
    });

    const usage1 = createTestUsageRecord({
      subscription_id: 'sub-1',
      metric: 'opportunities',
      count: 30,
      period_start: sub.current_period_start!,
    });

    const usage2 = createTestUsageRecord({
      subscription_id: 'sub-1',
      metric: 'actions',
      count: 15,
      period_start: sub.current_period_start!,
    });

    prismaMock.subscription.findMany.mockResolvedValue([
      { ...sub, usage_records: [usage1, usage2] },
    ] as any);

    const result = await getWorkspacesExceedingLimits();

    expect(result).toHaveLength(1);
    expect(result[0]).toBe('workspace-1');
  });
});
