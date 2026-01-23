/**
 * Opportunity Query Functions
 *
 * Centralized queries for retrieving opportunities with filtering, pagination,
 * and relationship loading.
 */

import { PrismaClient, Opportunity, Event, OpportunityState, PriorityBucket } from '@prisma/client';
import { OpportunityFilters, OpportunityListQuery, OpportunityWithEvents } from './types';

// ============================================================================
// SINGLE OPPORTUNITY QUERIES
// ============================================================================

/**
 * Get opportunity by ID
 * Validates workspace ownership
 */
export async function getOpportunityById(
  id: string,
  workspaceId: string,
  prisma: PrismaClient
): Promise<Opportunity | null> {
  return prisma.opportunity.findFirst({
    where: {
      id,
      workspace_id: workspaceId,
    },
  });
}

/**
 * Get opportunity with linked events
 */
export async function getOpportunityWithEvents(
  id: string,
  workspaceId: string,
  prisma: PrismaClient
): Promise<OpportunityWithEvents | null> {
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id,
      workspace_id: workspaceId,
    },
    include: {
      event_links: {
        include: {
          event: true,
        },
      },
    },
  });

  if (!opportunity) {
    return null;
  }

  // Transform to include events array
  return {
    ...opportunity,
    events: opportunity.event_links.map((link) => link.event),
  } as OpportunityWithEvents;
}

/**
 * Get opportunity with all relationships (events, action drafts)
 */
export async function getOpportunityWithRelations(
  id: string,
  workspaceId: string,
  prisma: PrismaClient
) {
  return prisma.opportunity.findFirst({
    where: {
      id,
      workspace_id: workspaceId,
    },
    include: {
      event_links: {
        include: {
          event: true,
        },
      },
      action_drafts: {
        orderBy: {
          created_at: 'desc',
        },
      },
    },
  });
}

/**
 * Get opportunities for workspace with filters and pagination
 */
export async function getOpportunitiesForWorkspace(
  workspaceId: string,
  query: OpportunityListQuery,
  prisma: PrismaClient
): Promise<{ opportunities: Opportunity[]; total: number }> {
  const {
    state,
    priority_bucket,
    type,
    created_after,
    created_before,
    include_expired = false,
    limit = 50,
    offset = 0,
    order_by = 'created_at',
    order_direction = 'desc',
  } = query;

  const where: any = {
    workspace_id: workspaceId,
  };

  if (state) {
    where.state = Array.isArray(state) ? { in: state } : state;
  } else if (!include_expired) {
    where.state = {
      not: OpportunityState.expired,
    };
  }

  if (priority_bucket) {
    where.priority_bucket = Array.isArray(priority_bucket)
      ? { in: priority_bucket }
      : priority_bucket;
  }

  if (type) {
    where.type = Array.isArray(type) ? { in: type } : type;
  }

  if (created_after || created_before) {
    where.created_at = {};
    if (created_after) {
      where.created_at.gte = created_after;
    }
    if (created_before) {
      where.created_at.lte = created_before;
    }
  }

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy: {
        [order_by]: order_direction,
      },
      take: limit,
      skip: offset,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return { opportunities, total };
}

/**
 * Get active opportunities (non-terminal states)
 */
export async function getActiveOpportunities(
  workspaceId: string,
  prisma: PrismaClient
): Promise<Opportunity[]> {
  return prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      state: {
        notIn: ['resolved', 'dismissed', 'expired'],
      },
    },
    orderBy: [
      { priority_bucket: 'desc' },
      { created_at: 'desc' },
    ],
  });
}

/**
 * Get opportunities grouped by priority bucket
 */
export async function getOpportunitiesByPriority(
  workspaceId: string,
  prisma: PrismaClient
): Promise<Record<PriorityBucket, Opportunity[]>> {
  const opportunities = await getActiveOpportunities(workspaceId, prisma);

  const grouped: Record<PriorityBucket, Opportunity[]> = {
    [PriorityBucket.high]: [],
    [PriorityBucket.medium]: [],
    [PriorityBucket.low]: [],
  };

  for (const opp of opportunities) {
    grouped[opp.priority_bucket].push(opp);
  }

  return grouped;
}

/**
 * Get new opportunities (never viewed)
 */
export async function getNewOpportunities(
  workspaceId: string,
  prisma: PrismaClient
): Promise<Opportunity[]> {
  return prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      state: OpportunityState.new,
    },
    orderBy: [
      { priority_bucket: 'desc' },
      { created_at: 'desc' },
    ],
  });
}

/**
 * Search opportunities by text
 */
export async function searchOpportunities(
  workspaceId: string,
  searchText: string,
  prisma: PrismaClient
): Promise<Opportunity[]> {
  return prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      OR: [
        { rationale: { contains: searchText, mode: 'insensitive' } },
        { why_now: { contains: searchText, mode: 'insensitive' } },
        { counterfactual: { contains: searchText, mode: 'insensitive' } },
      ],
    },
    orderBy: {
      created_at: 'desc',
    },
  });
}

/**
 * Get opportunity statistics
 */
export async function getOpportunityStats(
  workspaceId: string,
  prisma: PrismaClient
): Promise<{
  total: number;
  by_state: Record<OpportunityState, number>;
  by_priority: Record<PriorityBucket, number>;
  average_confidence: number;
}> {
  const opportunities = await prisma.opportunity.findMany({
    where: { workspace_id: workspaceId },
  });

  const total = opportunities.length;

  const by_state: Record<OpportunityState, number> = {
    [OpportunityState.new]: 0,
    [OpportunityState.viewed]: 0,
    [OpportunityState.approved]: 0,
    [OpportunityState.executed]: 0,
    [OpportunityState.resolved]: 0,
    [OpportunityState.dismissed]: 0,
    [OpportunityState.expired]: 0,
  };

  const by_priority: Record<PriorityBucket, number> = {
    [PriorityBucket.high]: 0,
    [PriorityBucket.medium]: 0,
    [PriorityBucket.low]: 0,
  };

  let totalConfidence = 0;

  for (const opp of opportunities) {
    by_state[opp.state]++;
    by_priority[opp.priority_bucket]++;
    totalConfidence += opp.confidence;
  }

  const average_confidence = total > 0 ? totalConfidence / total : 0;

  return {
    total,
    by_state,
    by_priority,
    average_confidence: parseFloat(average_confidence.toFixed(3)),
  };
}

/**
 * Get dismissed opportunity keys
 */
export async function getDismissedOpportunityKeys(
  workspaceId: string,
  prisma: PrismaClient
): Promise<string[]> {
  const dismissed = await prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      state: OpportunityState.dismissed,
    },
    select: {
      type: true,
      event_links: {
        select: {
          event_id: true,
        },
      },
    },
  });

  return dismissed.map((opp) => {
    const eventIds = opp.event_links.map((link) => link.event_id).sort().join(',');
    return eventIds ? `${opp.type}:${eventIds}` : opp.type;
  });
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export async function paginateOpportunities(
  workspaceId: string,
  filters: OpportunityFilters,
  page: number = 1,
  pageSize: number = 20,
  prisma: PrismaClient
): Promise<PaginatedResult<Opportunity>> {
  const offset = (page - 1) * pageSize;

  const { opportunities, total } = await getOpportunitiesForWorkspace(
    workspaceId,
    {
      ...filters,
      limit: pageSize,
      offset,
    },
    prisma
  );

  const total_pages = Math.ceil(total / pageSize);

  return {
    items: opportunities,
    total,
    page,
    page_size: pageSize,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}
