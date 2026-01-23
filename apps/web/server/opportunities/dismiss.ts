/**
 * Opportunity Dismissal Engine
 *
 * Handles dismissing opportunities with key storage to prevent reappearance.
 * Dismissed opportunities only reappear if inputs materially change.
 */

import { PrismaClient, Opportunity } from '@prisma/client';
import { transitionState, markAsDismissed } from './state-machine';
import { getDismissedOpportunityKeys } from './queries';

// ============================================================================
// DISMISS KEY GENERATION
// ============================================================================

/**
 * Generate a dismiss key for an opportunity
 * Key format: {type}:{sorted_event_ids}
 *
 * This key is used to detect if a similar opportunity has been dismissed before
 */
export function generateDismissKey(opportunityType: string, eventIds: string[]): string {
  const sortedEventIds = [...eventIds].sort().join(',');
  return `${opportunityType}:${sortedEventIds}`;
}

/**
 * Extract dismiss key components
 */
export function parseDismissKey(key: string): { type: string; eventIds: string[] } {
  const [type, eventIdsStr] = key.split(':');
  const eventIds = eventIdsStr ? eventIdsStr.split(',') : [];
  return { type, eventIds };
}

// ============================================================================
// DISMISSAL LOGIC
// ============================================================================

/**
 * Dismiss an opportunity
 * Transitions to dismissed state and stores dismiss key
 */
export async function dismissOpportunity(
  opportunityId: string,
  workspaceId: string,
  prisma: PrismaClient
): Promise<{ opportunity: Opportunity; dismiss_key: string }> {
  // Fetch opportunity with events
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      workspace_id: workspaceId,
    },
    include: {
      event_links: {
        select: {
          event_id: true,
        },
      },
    },
  });

  if (!opportunity) {
    throw new Error(`Opportunity ${opportunityId} not found in workspace ${workspaceId}`);
  }

  // Generate dismiss key
  const eventIds = opportunity.event_links.map((link) => link.event_id);
  const dismiss_key = generateDismissKey(opportunity.type, eventIds);

  // Transition to dismissed state
  const dismissed = await markAsDismissed(opportunityId, prisma);

  return {
    opportunity: dismissed,
    dismiss_key,
  };
}

/**
 * Batch dismiss multiple opportunities
 */
export async function dismissOpportunitiesBatch(
  opportunityIds: string[],
  workspaceId: string,
  prisma: PrismaClient
): Promise<{
  succeeded: Array<{ id: string; dismiss_key: string }>;
  failed: Array<{ id: string; error: string }>;
}> {
  const succeeded: Array<{ id: string; dismiss_key: string }> = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of opportunityIds) {
    try {
      const result = await dismissOpportunity(id, workspaceId, prisma);
      succeeded.push({
        id,
        dismiss_key: result.dismiss_key,
      });
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { succeeded, failed };
}

// ============================================================================
// DISMISS KEY CHECKING
// ============================================================================

/**
 * Check if an opportunity type + event combination has been dismissed
 */
export async function isDismissed(
  opportunityType: string,
  eventIds: string[],
  workspaceId: string,
  prisma: PrismaClient
): Promise<boolean> {
  const dismissKey = generateDismissKey(opportunityType, eventIds);
  const dismissedKeys = await getDismissedOpportunityKeys(workspaceId, prisma);

  return dismissedKeys.includes(dismissKey);
}

/**
 * Check if opportunity should be filtered due to dismissal
 *
 * Returns true if:
 * - Exact same opportunity (type + events) was dismissed
 * - Material change threshold not met
 */
export async function shouldFilterDismissed(
  opportunityType: string,
  eventIds: string[],
  workspaceId: string,
  prisma: PrismaClient
): Promise<{ should_filter: boolean; reason?: string }> {
  const isDismissedExact = await isDismissed(opportunityType, eventIds, workspaceId, prisma);

  if (isDismissedExact) {
    return {
      should_filter: true,
      reason: 'Identical opportunity previously dismissed',
    };
  }

  // Check for similar dismissed opportunities with material change
  const similarDismissed = await findSimilarDismissedOpportunities(
    opportunityType,
    eventIds,
    workspaceId,
    prisma
  );

  if (similarDismissed.length > 0) {
    // If any similar opportunity was dismissed, check if this is materially different
    const isMateriallyDifferent = checkMaterialChange(eventIds, similarDismissed);

    if (!isMateriallyDifferent) {
      return {
        should_filter: true,
        reason: 'Similar opportunity dismissed without material change',
      };
    }
  }

  return { should_filter: false };
}

// ============================================================================
// MATERIAL CHANGE DETECTION
// ============================================================================

/**
 * Find similar dismissed opportunities
 */
async function findSimilarDismissedOpportunities(
  opportunityType: string,
  eventIds: string[],
  workspaceId: string,
  prisma: PrismaClient
): Promise<Opportunity[]> {
  // Find dismissed opportunities of same type
  const dismissed = await prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      type: opportunityType,
      state: 'dismissed',
    },
    include: {
      event_links: {
        select: {
          event_id: true,
        },
      },
    },
  });

  // Filter to those with overlapping events
  return dismissed.filter((opp) => {
    const oppEventIds = opp.event_links.map((link) => link.event_id);
    const overlap = eventIds.filter((id) => oppEventIds.includes(id));
    return overlap.length > 0;
  });
}

/**
 * Check if there is material change from dismissed opportunities
 *
 * Material change means:
 * - At least 50% new events
 * - OR completely different event set
 */
function checkMaterialChange(
  newEventIds: string[],
  dismissedOpportunities: Opportunity[]
): boolean {
  for (const dismissed of dismissedOpportunities) {
    const dismissedEventIds = (dismissed as any).event_links.map((link: any) => link.event_id);

    // Calculate overlap
    const overlap = newEventIds.filter((id) => dismissedEventIds.includes(id));
    const overlapRatio = overlap.length / newEventIds.length;

    // If more than 50% overlap, not materially different
    if (overlapRatio > 0.5) {
      return false;
    }
  }

  // Material change detected
  return true;
}

// ============================================================================
// UNDISMISS (RESTORE)
// ============================================================================

/**
 * Undismiss an opportunity (restore to new state)
 * Useful if user wants to reconsider a dismissed opportunity
 */
export async function undismissOpportunity(
  opportunityId: string,
  workspaceId: string,
  prisma: PrismaClient
): Promise<Opportunity> {
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      workspace_id: workspaceId,
      state: 'dismissed',
    },
  });

  if (!opportunity) {
    throw new Error(
      `Dismissed opportunity ${opportunityId} not found in workspace ${workspaceId}`
    );
  }

  // Transition back to new state
  return prisma.opportunity.update({
    where: { id: opportunityId },
    data: { state: 'new' },
  });
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get dismissal statistics for a workspace
 */
export async function getDismissalStats(
  workspaceId: string,
  prisma: PrismaClient
): Promise<{
  total_dismissed: number;
  dismissed_by_type: Record<string, number>;
  dismissal_rate: number;
}> {
  const [dismissed, total] = await Promise.all([
    prisma.opportunity.findMany({
      where: {
        workspace_id: workspaceId,
        state: 'dismissed',
      },
      select: {
        type: true,
      },
    }),
    prisma.opportunity.count({
      where: { workspace_id: workspaceId },
    }),
  ]);

  const total_dismissed = dismissed.length;

  const dismissed_by_type: Record<string, number> = {};
  for (const opp of dismissed) {
    dismissed_by_type[opp.type] = (dismissed_by_type[opp.type] || 0) + 1;
  }

  const dismissal_rate = total > 0 ? total_dismissed / total : 0;

  return {
    total_dismissed,
    dismissed_by_type,
    dismissal_rate: parseFloat(dismissal_rate.toFixed(3)),
  };
}

/**
 * Get recently dismissed opportunities
 */
export async function getRecentlyDismissed(
  workspaceId: string,
  days: number = 7,
  prisma: PrismaClient
): Promise<Opportunity[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      state: 'dismissed',
      updated_at: {
        gte: since,
      },
    },
    orderBy: {
      updated_at: 'desc',
    },
  });
}
