/**
 * Opportunity Decay Engine
 *
 * Handles opportunity decay and expiration logic.
 * Opportunities degrade over time and expire based on type-specific windows.
 */

import { PrismaClient, Opportunity, OpportunityState } from '@prisma/client';
import { OpportunityType, DECAY_CONFIGS } from './types';
import { transitionState } from './state-machine';

// ============================================================================
// DECAY TIME CALCULATION
// ============================================================================

/**
 * Get decay time for an opportunity type
 * Returns date when opportunity should expire
 */
export function getDecayTime(opportunityType: OpportunityType): Date {
  const config = DECAY_CONFIGS[opportunityType];
  const now = new Date();
  const decayTime = new Date(now.getTime() + config.hours_to_decay * 60 * 60 * 1000);
  return decayTime;
}

/**
 * Get decay configuration for an opportunity type
 */
export function getDecayConfig(opportunityType: OpportunityType) {
  return DECAY_CONFIGS[opportunityType];
}

/**
 * Calculate hours remaining until decay
 */
export function getHoursUntilDecay(decayAt: Date | null): number {
  if (!decayAt) {
    return Infinity;
  }

  const now = new Date();
  const diff = decayAt.getTime() - now.getTime();
  const hours = diff / (1000 * 60 * 60);

  return Math.max(0, hours);
}

/**
 * Check if opportunity has decayed
 */
export function hasDecayed(decayAt: Date | null): boolean {
  if (!decayAt) {
    return false;
  }

  return new Date() >= decayAt;
}

// ============================================================================
// DECAY CHECKING
// ============================================================================

/**
 * Check if a single opportunity should be expired
 * Does not mutate the opportunity - caller must handle state transition
 */
export function checkDecay(opportunity: Opportunity): {
  shouldExpire: boolean;
  reason?: string;
} {
  // Only check non-terminal states
  const terminalStates: OpportunityState[] = ['resolved', 'dismissed', 'expired'];
  if (terminalStates.includes(opportunity.state)) {
    return { shouldExpire: false };
  }

  // Check decay time
  if (opportunity.decay_at && hasDecayed(opportunity.decay_at)) {
    const config = getDecayConfig(opportunity.type as OpportunityType);
    return {
      shouldExpire: true,
      reason: config.decay_reason,
    };
  }

  return { shouldExpire: false };
}

/**
 * Check and expire a single opportunity if needed
 * Returns true if opportunity was expired
 */
export async function checkAndExpireOpportunity(
  opportunityId: string,
  prisma: PrismaClient
): Promise<boolean> {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
  });

  if (!opportunity) {
    return false;
  }

  const decayCheck = checkDecay(opportunity);

  if (decayCheck.shouldExpire) {
    await transitionState(opportunityId, OpportunityState.expired, prisma);
    return true;
  }

  return false;
}

// ============================================================================
// BATCH EXPIRATION
// ============================================================================

/**
 * Expire all stale opportunities across all workspaces
 * This should be run as a scheduled job (e.g., every hour)
 *
 * Returns count of expired opportunities
 */
export async function expireStaleOpportunities(
  prisma: PrismaClient
): Promise<{ count: number; expired_ids: string[] }> {
  const now = new Date();

  // Find all opportunities that have passed their decay time
  const staleOpportunities = await prisma.opportunity.findMany({
    where: {
      decay_at: {
        lte: now,
      },
      state: {
        notIn: ['resolved', 'dismissed', 'expired'],
      },
    },
    select: {
      id: true,
      workspace_id: true,
      type: true,
    },
  });

  const expired_ids: string[] = [];

  // Expire each opportunity
  for (const opp of staleOpportunities) {
    try {
      await transitionState(opp.id, OpportunityState.expired, prisma);
      expired_ids.push(opp.id);
    } catch (error) {
      console.error(`Failed to expire opportunity ${opp.id}:`, error);
      // Continue with other opportunities
    }
  }

  return {
    count: expired_ids.length,
    expired_ids,
  };
}

/**
 * Expire stale opportunities for a specific workspace
 */
export async function expireStaleOpportunitiesForWorkspace(
  workspaceId: string,
  prisma: PrismaClient
): Promise<{ count: number; expired_ids: string[] }> {
  const now = new Date();

  const staleOpportunities = await prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      decay_at: {
        lte: now,
      },
      state: {
        notIn: ['resolved', 'dismissed', 'expired'],
      },
    },
    select: {
      id: true,
    },
  });

  const expired_ids: string[] = [];

  for (const opp of staleOpportunities) {
    try {
      await transitionState(opp.id, OpportunityState.expired, prisma);
      expired_ids.push(opp.id);
    } catch (error) {
      console.error(`Failed to expire opportunity ${opp.id}:`, error);
    }
  }

  return {
    count: expired_ids.length,
    expired_ids,
  };
}

// ============================================================================
// DECAY ANALYTICS
// ============================================================================

/**
 * Get decay statistics for a workspace
 */
export async function getDecayStats(
  workspaceId: string,
  prisma: PrismaClient
): Promise<{
  total_active: number;
  expiring_soon: number;
  expiring_this_week: number;
  average_hours_to_decay: number;
}> {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in1Week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const activeOpportunities = await prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      state: {
        notIn: ['resolved', 'dismissed', 'expired'],
      },
      decay_at: {
        not: null,
      },
    },
    select: {
      decay_at: true,
    },
  });

  const total_active = activeOpportunities.length;

  const expiring_soon = activeOpportunities.filter(
    (opp) => opp.decay_at && opp.decay_at <= in24Hours
  ).length;

  const expiring_this_week = activeOpportunities.filter(
    (opp) => opp.decay_at && opp.decay_at <= in1Week
  ).length;

  // Calculate average hours to decay
  let totalHours = 0;
  let countWithDecay = 0;

  for (const opp of activeOpportunities) {
    if (opp.decay_at) {
      const hours = getHoursUntilDecay(opp.decay_at);
      if (hours < Infinity) {
        totalHours += hours;
        countWithDecay++;
      }
    }
  }

  const average_hours_to_decay = countWithDecay > 0 ? totalHours / countWithDecay : 0;

  return {
    total_active,
    expiring_soon,
    expiring_this_week,
    average_hours_to_decay: parseFloat(average_hours_to_decay.toFixed(2)),
  };
}

/**
 * Get opportunities expiring soon (within N hours)
 */
export async function getOpportunitiesExpiringSoon(
  workspaceId: string,
  hoursThreshold: number = 24,
  prisma: PrismaClient
): Promise<Opportunity[]> {
  const now = new Date();
  const threshold = new Date(now.getTime() + hoursThreshold * 60 * 60 * 1000);

  return prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      decay_at: {
        lte: threshold,
        gte: now,
      },
      state: {
        notIn: ['resolved', 'dismissed', 'expired'],
      },
    },
    orderBy: {
      decay_at: 'asc',
    },
  });
}

/**
 * Extend decay time for an opportunity
 * Useful if circumstances change and opportunity should stay active longer
 */
export async function extendDecayTime(
  opportunityId: string,
  additionalHours: number,
  prisma: PrismaClient
): Promise<Opportunity> {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
  });

  if (!opportunity) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }

  if (!opportunity.decay_at) {
    throw new Error('Opportunity has no decay time set');
  }

  const newDecayAt = new Date(opportunity.decay_at.getTime() + additionalHours * 60 * 60 * 1000);

  return prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      decay_at: newDecayAt,
    },
  });
}
