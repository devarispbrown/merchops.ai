/**
 * Event Compute Worker
 *
 * Processes event computation jobs by analyzing Shopify data
 * and creating events for inventory, velocity, and customer activity changes.
 * Triggers opportunity generation after event creation.
 */

import { Job, Worker } from 'bullmq';
import { QUEUE_NAMES, redisConnection, defaultWorkerOptions, isRedisConfigured } from '../config';
import {
  createWorkerLogger,
  logJobStart,
  logJobComplete,
  logJobFailed,
} from '../../observability/logger';
import { getOpportunityGenerateQueue } from '../queues';
import {
  computeInventoryThresholdEvents,
  computeOutOfStockEvents,
  computeBackInStockEvents,
} from '../../events/compute/inventory';
import { computeVelocitySpikeEvents } from '../../events/compute/velocity';
import { computeCustomerInactivityEvents } from '../../events/compute/customer';

// ============================================================================
// TYPES
// ============================================================================

interface EventComputeJobData {
  workspace_id: string;
  trigger: 'shopify_sync_completed' | 'webhook_received' | 'scheduled';
  event_types?: (
    | 'inventory_threshold'
    | 'out_of_stock'
    | 'back_in_stock'
    | 'velocity_spike'
    | 'customer_inactivity'
  )[];
  correlation_id?: string;
}

interface EventComputeResult {
  workspace_id: string;
  trigger: string;
  events_created: {
    inventory_threshold: number;
    out_of_stock: number;
    back_in_stock: number;
    velocity_spike: number;
    customer_inactivity: number;
  };
  duration_ms: number;
}

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

const logger = createWorkerLogger('event-compute');

// Only create worker if Redis is configured
export const eventComputeWorker = isRedisConfigured() && redisConnection
  ? new Worker<EventComputeJobData, EventComputeResult>(
      QUEUE_NAMES.EVENT_COMPUTE,
      processEventCompute,
      {
        ...defaultWorkerOptions,
        connection: redisConnection,
      }
    )
  : null;

// ============================================================================
// EVENT HANDLERS
// ============================================================================

if (eventComputeWorker) {
  eventComputeWorker.on('completed', (job, result) => {
    logJobComplete(job.id!, job.name!, result, result.duration_ms, result.workspace_id);
  });

  eventComputeWorker.on('failed', (job, error) => {
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

  eventComputeWorker.on('error', (error) => {
    logger.error({ error: error.message, stack: error.stack }, 'Worker error');
  });
} else {
  logger.warn('Event compute worker not initialized - Redis not configured');
}

// ============================================================================
// JOB PROCESSOR
// ============================================================================

async function processEventCompute(
  job: Job<EventComputeJobData, EventComputeResult>
): Promise<EventComputeResult> {
  const startTime = Date.now();
  const { workspace_id, trigger, event_types } = job.data;

  logJobStart(job.id!, job.name!, job.data, workspace_id);

  try {
    // Determine which event types to compute
    const typesToCompute = event_types || [
      'inventory_threshold',
      'out_of_stock',
      'back_in_stock',
      'velocity_spike',
      'customer_inactivity',
    ];

    const eventsCreated = {
      inventory_threshold: 0,
      out_of_stock: 0,
      back_in_stock: 0,
      velocity_spike: 0,
      customer_inactivity: 0,
    };

    // Process each event type
    for (const eventType of typesToCompute) {
      logger.info(
        { workspace_id, eventType, trigger },
        `Computing ${eventType} events for workspace ${workspace_id}`
      );

      try {
        switch (eventType) {
          case 'inventory_threshold':
            await computeInventoryThresholdEvents(workspace_id);
            eventsCreated.inventory_threshold++;
            break;

          case 'out_of_stock':
            await computeOutOfStockEvents(workspace_id);
            eventsCreated.out_of_stock++;
            break;

          case 'back_in_stock':
            await computeBackInStockEvents(workspace_id);
            eventsCreated.back_in_stock++;
            break;

          case 'velocity_spike':
            await computeVelocitySpikeEvents(workspace_id);
            eventsCreated.velocity_spike++;
            break;

          case 'customer_inactivity':
            await computeCustomerInactivityEvents(workspace_id);
            eventsCreated.customer_inactivity++;
            break;
        }
      } catch (eventError: any) {
        // Log individual event type failure but continue processing others
        logger.error(
          {
            workspace_id,
            eventType,
            error: eventError.message,
            stack: eventError.stack,
          },
          `Failed to compute ${eventType} events`
        );
      }
    }

    const duration_ms = Date.now() - startTime;

    // Count total events created
    const totalEvents = Object.values(eventsCreated).reduce((sum, count) => sum + count, 0);

    // If events were created, trigger opportunity generation
    if (totalEvents > 0) {
      const opportunityQueue = getOpportunityGenerateQueue();
      if (opportunityQueue) {
        await opportunityQueue.add(
          'generate-opportunities',
          {
            workspace_id,
            trigger: 'events_computed',
            correlation_id: job.data.correlation_id,
          },
          {
            priority: 5, // High priority
          }
        );

        logger.info(
          { workspace_id, totalEvents },
          `Triggered opportunity generation for ${totalEvents} new events`
        );
      }
    }

    logger.info(
      { workspace_id, eventsCreated, duration_ms },
      `Event computation completed for workspace ${workspace_id}`
    );

    return {
      workspace_id,
      trigger,
      events_created: eventsCreated,
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
      'Event computation failed'
    );
    throw error;
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function shutdownEventComputeWorker(): Promise<void> {
  if (!eventComputeWorker) {
    logger.debug('Event compute worker not running - nothing to shut down');
    return;
  }
  logger.info('Shutting down event compute worker...');
  await eventComputeWorker.close();
  logger.info('Event compute worker shut down');
}
