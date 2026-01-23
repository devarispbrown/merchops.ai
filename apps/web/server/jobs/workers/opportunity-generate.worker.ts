/**
 * Opportunity Generate Worker
 *
 * Processes opportunity generation from computed events.
 * Creates opportunities with AI-generated content (rationale, why-now, counterfactual).
 * Falls back to templates on AI failure.
 */

import { Job, Worker } from 'bullmq';
import { prisma } from '../../db/client';
import { QUEUE_NAMES, redisConnection, defaultWorkerOptions } from '../config';
import {
  createWorkerLogger,
  logJobStart,
  logJobComplete,
  logJobFailed,
} from '../../observability/logger';
import {
  OpportunityType,
  PriorityBucket,
  OperatorIntent,
  DECAY_CONFIGS,
} from '../../opportunities/types';
import { generateOpportunityContent } from '../../ai/generate';
import { getOpportunityFallback as _getOpportunityFallback } from '../../ai/fallbacks';

// ============================================================================
// TYPES
// ============================================================================

interface OpportunityGenerateJobData {
  workspace_id: string;
  trigger: 'events_computed' | 'manual';
  event_ids?: string[];
  correlation_id?: string;
}

interface OpportunityGenerateResult {
  workspace_id: string;
  opportunities_created: number;
  opportunities: Array<{
    id: string;
    type: OpportunityType;
    priority_bucket: PriorityBucket;
  }>;
  duration_ms: number;
}

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

const logger = createWorkerLogger('opportunity-generate');

export const opportunityGenerateWorker = new Worker<
  OpportunityGenerateJobData,
  OpportunityGenerateResult
>(QUEUE_NAMES.OPPORTUNITY_GENERATE, processOpportunityGenerate, {
  ...defaultWorkerOptions,
  connection: redisConnection,
});

// ============================================================================
// EVENT HANDLERS
// ============================================================================

opportunityGenerateWorker.on('completed', (job, result) => {
  logJobComplete(job.id!, job.name!, result, result.duration_ms, result.workspace_id);
});

opportunityGenerateWorker.on('failed', (job, error) => {
  if (job) {
    logJobFailed(
      job.id!,
      job.name!,
      error as Error,
      job.attemptsMade,
      job.data.workspace_id
    );
  }
});

opportunityGenerateWorker.on('error', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Worker error');
});

// ============================================================================
// JOB PROCESSOR
// ============================================================================

async function processOpportunityGenerate(
  job: Job<OpportunityGenerateJobData, OpportunityGenerateResult>
): Promise<OpportunityGenerateResult> {
  const startTime = Date.now();
  const { workspace_id, trigger, event_ids } = job.data;

  logJobStart(job.id!, job.name!, job.data, workspace_id);

  try {
    // Fetch unprocessed events for this workspace
    const eventsToProcess = await getUnprocessedEvents(workspace_id, event_ids);

    logger.info(
      { workspace_id, eventCount: eventsToProcess.length, trigger },
      `Processing ${eventsToProcess.length} events for opportunity generation`
    );

    const opportunities: Array<{
      id: string;
      type: OpportunityType;
      priority_bucket: PriorityBucket;
    }> = [];

    // Group events by opportunity type
    const eventGroups = groupEventsByOpportunityType(eventsToProcess);

    // Generate opportunities for each group
    for (const [opportunityType, events] of Object.entries(eventGroups)) {
      if (events.length === 0) continue;

      try {
        const opportunity = await generateOpportunity(
          workspace_id,
          opportunityType as OpportunityType,
          events
        );

        if (opportunity) {
          opportunities.push({
            id: opportunity.id,
            type: opportunityType as OpportunityType,
            priority_bucket: opportunity.priority_bucket,
          });
        }
      } catch (error: any) {
        logger.error(
          {
            workspace_id,
            opportunityType,
            eventCount: events.length,
            error: error.message,
          },
          `Failed to generate opportunity for type ${opportunityType}`
        );
      }
    }

    const duration_ms = Date.now() - startTime;

    logger.info(
      { workspace_id, opportunitiesCreated: opportunities.length, duration_ms },
      `Opportunity generation completed for workspace ${workspace_id}`
    );

    return {
      workspace_id,
      opportunities_created: opportunities.length,
      opportunities,
      duration_ms,
    };
  } catch (error: any) {
    logger.error(
      {
        workspace_id,
        trigger,
        error: error.message,
        stack: error.stack,
      },
      'Opportunity generation failed'
    );
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get unprocessed events for a workspace
 */
async function getUnprocessedEvents(
  workspace_id: string,
  event_ids?: string[]
): Promise<any[]> {
  const where: any = {
    workspace_id,
  };

  if (event_ids && event_ids.length > 0) {
    where.id = { in: event_ids };
  } else {
    // Get recent events that haven't been processed into opportunities
    where.created_at = {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    };
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: {
      created_at: 'desc',
    },
    take: 100, // Process in batches
  });

  return events;
}

/**
 * Group events by opportunity type
 */
function groupEventsByOpportunityType(events: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {
    [OpportunityType.INVENTORY_CLEARANCE]: [],
    [OpportunityType.STOCKOUT_PREVENTION]: [],
    [OpportunityType.RESTOCK_NOTIFICATION]: [],
    [OpportunityType.WINBACK_CAMPAIGN]: [],
    [OpportunityType.HIGH_VELOCITY_PROTECTION]: [],
  };

  for (const event of events) {
    switch (event.type) {
      case 'inventory_threshold_crossed':
        groups[OpportunityType.INVENTORY_CLEARANCE].push(event);
        break;

      case 'product_out_of_stock':
        groups[OpportunityType.STOCKOUT_PREVENTION].push(event);
        break;

      case 'product_back_in_stock':
        groups[OpportunityType.RESTOCK_NOTIFICATION].push(event);
        break;

      case 'customer_inactivity_threshold':
        groups[OpportunityType.WINBACK_CAMPAIGN].push(event);
        break;

      case 'velocity_spike':
        groups[OpportunityType.HIGH_VELOCITY_PROTECTION].push(event);
        break;
    }
  }

  return groups;
}

/**
 * Generate a single opportunity from events
 */
async function generateOpportunity(
  workspace_id: string,
  opportunityType: OpportunityType,
  events: any[]
): Promise<any> {
  logger.info(
    { workspace_id, opportunityType, eventCount: events.length },
    `Generating opportunity: ${opportunityType}`
  );

  // Check if similar opportunity already exists and is not dismissed/expired
  const existingOpportunity = await findSimilarOpportunity(workspace_id, opportunityType, events);

  if (existingOpportunity) {
    logger.info(
      { workspace_id, opportunityType, existingId: existingOpportunity.id },
      'Similar opportunity already exists, skipping'
    );
    return null;
  }

  // Determine operator intent and priority
  const operatorIntent = getOperatorIntent(opportunityType);
  const priorityBucket = calculatePriority(opportunityType, events);

  // Generate AI content (or use fallback)
  // Build event summary and time window from events
  const eventsSummary = events.map((e) => `${e.type} at ${e.occurred_at}`).join('; ');
  const eventDates = events.map((e) => new Date(e.occurred_at));
  const earliestDate = new Date(Math.min(...eventDates.map((d) => d.getTime())));
  const latestDate = new Date(Math.max(...eventDates.map((d) => d.getTime())));
  const timeWindow = {
    startDate: earliestDate.toISOString().split('T')[0],
    endDate: latestDate.toISOString().split('T')[0],
  };

  let content;
  try {
    content = await generateOpportunityContent({
      workspaceId: workspace_id,
      opportunityType,
      operatorIntent,
      eventsSummary,
      storeContext: events[0]?.payload_json as Record<string, unknown> ?? {},
      timeWindow,
      prisma,
    });
  } catch (aiError: unknown) {
    const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown error';
    logger.warn(
      { workspace_id, opportunityType, error: errorMessage },
      'AI generation failed, using fallback template'
    );
    const { generateOpportunityRationaleFallback } = await import('../../ai/fallbacks');
    content = generateOpportunityRationaleFallback({
      workspaceId: workspace_id,
      opportunityType,
      operatorIntent,
      eventsSummary,
      timeWindow,
    });
  }

  // Calculate decay time
  const decayConfig = DECAY_CONFIGS[opportunityType];
  const decay_at = new Date(Date.now() + decayConfig.hours_to_decay * 60 * 60 * 1000);

  // Create opportunity
  const opportunity = await prisma.opportunity.create({
    data: {
      workspace_id,
      type: opportunityType,
      priority_bucket: priorityBucket,
      why_now: content.why_now,
      rationale: content.rationale,
      counterfactual: content.counterfactual,
      impact_range: content.impact_range ?? '',
      decay_at,
      confidence: 0.7, // Default confidence
      state: 'new',
      event_links: {
        create: events.map((event) => ({
          event_id: event.id,
        })),
      },
    },
  });

  logger.info(
    {
      workspace_id,
      opportunityId: opportunity.id,
      opportunityType,
      priorityBucket,
    },
    'Opportunity created successfully'
  );

  return opportunity;
}

/**
 * Find similar existing opportunity
 */
async function findSimilarOpportunity(
  workspace_id: string,
  opportunityType: OpportunityType,
  _events: any[]
): Promise<any> {
  // Check for recent opportunities of the same type that are not terminal states
  const recentOpportunity = await prisma.opportunity.findFirst({
    where: {
      workspace_id,
      type: opportunityType,
      state: {
        notIn: ['dismissed', 'expired', 'resolved'],
      },
      created_at: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  return recentOpportunity;
}

/**
 * Get operator intent for opportunity type
 */
function getOperatorIntent(opportunityType: OpportunityType): OperatorIntent {
  const intentMap: Record<OpportunityType, OperatorIntent> = {
    [OpportunityType.INVENTORY_CLEARANCE]: 'reduce_inventory_risk',
    [OpportunityType.STOCKOUT_PREVENTION]: 'reduce_inventory_risk',
    [OpportunityType.RESTOCK_NOTIFICATION]: 'reduce_inventory_risk',
    [OpportunityType.WINBACK_CAMPAIGN]: 'reengage_dormant_customers',
    [OpportunityType.HIGH_VELOCITY_PROTECTION]: 'protect_margin',
  };

  return intentMap[opportunityType];
}

/**
 * Calculate priority bucket based on opportunity type and events
 */
function calculatePriority(opportunityType: OpportunityType, events: any[]): PriorityBucket {
  // Simplified priority calculation
  // In production, this would use more sophisticated scoring

  switch (opportunityType) {
    case OpportunityType.STOCKOUT_PREVENTION:
    case OpportunityType.HIGH_VELOCITY_PROTECTION:
      return PriorityBucket.high;

    case OpportunityType.INVENTORY_CLEARANCE:
    case OpportunityType.RESTOCK_NOTIFICATION:
      return PriorityBucket.medium;

    case OpportunityType.WINBACK_CAMPAIGN:
      return events.length > 5 ? PriorityBucket.medium : PriorityBucket.low;

    default:
      return PriorityBucket.medium;
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function shutdownOpportunityGenerateWorker(): Promise<void> {
  logger.info('Shutting down opportunity generate worker...');
  await opportunityGenerateWorker.close();
  logger.info('Opportunity generate worker shut down');
}
