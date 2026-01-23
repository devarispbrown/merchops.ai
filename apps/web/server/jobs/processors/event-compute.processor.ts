/**
 * Event Compute Processor
 *
 * Computes business events from raw Shopify data.
 * Events are immutable and deduped by dedupe_key.
 *
 * Supported events:
 * - Inventory threshold crossed
 * - Product out of stock
 * - Product back in stock
 * - Velocity spike on product(s)
 * - Customer inactivity threshold crossed (30/60/90 days)
 */

import { Job } from 'bullmq';
import { logger } from '../../observability/logger';
import { captureException } from '../../observability/sentry';
import {
  incrementJobsProcessed,
  startTimer,
} from '../../observability/metrics';
import { runWithCorrelationAsync } from '../../../lib/correlation';

/**
 * Job data structure for event computation
 */
export interface EventComputeJobData {
  workspaceId: string;
  triggerType: 'webhook' | 'scheduled' | 'manual';
  webhookTopic?: string;
  resourceId?: string;
  _correlationId?: string;
}

/**
 * Event types that can be computed
 */
export type EventType =
  | 'inventory_threshold_crossed'
  | 'product_out_of_stock'
  | 'product_back_in_stock'
  | 'velocity_spike'
  | 'customer_inactive_30d'
  | 'customer_inactive_60d'
  | 'customer_inactive_90d';

/**
 * Event payload structure
 */
export interface EventPayload {
  type: EventType;
  occurredAt: Date;
  dedupeKey: string;
  source: string;
  payload: Record<string, any>;
}

/**
 * Job result structure
 */
export interface EventComputeJobResult {
  workspaceId: string;
  eventsComputed: number;
  eventTypes: Record<EventType, number>;
  durationMs: number;
}

/**
 * Process event compute job
 */
export async function processEventCompute(
  job: Job<EventComputeJobData>
): Promise<EventComputeJobResult> {
  const timer = startTimer('job_duration_ms', { job: 'event-compute' });
  const { workspaceId, triggerType, webhookTopic, resourceId } = job.data;

  return runWithCorrelationAsync(
    {
      correlationId: job.data._correlationId,
      workspaceId,
      jobId: job.id,
      jobName: 'event-compute',
    },
    async () => {
      logger.info(
        {
          workspaceId,
          triggerType,
          webhookTopic,
          resourceId,
          jobId: job.id,
        },
        'Starting event computation'
      );

      const eventTypes: Record<string, number> = {};
      let eventsComputed = 0;

      try {
        // Compute different event types based on trigger
        if (triggerType === 'webhook') {
          // Handle webhook-triggered events
          const events = await computeWebhookEvents(
            workspaceId,
            webhookTopic,
            resourceId
          );
          eventsComputed += events.length;
          events.forEach((e) => {
            eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
          });
        } else if (triggerType === 'scheduled') {
          // Handle scheduled event computation
          const events = await computeScheduledEvents(workspaceId);
          eventsComputed += events.length;
          events.forEach((e) => {
            eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
          });
        } else {
          // Manual trigger - compute all event types
          const events = await computeAllEvents(workspaceId);
          eventsComputed += events.length;
          events.forEach((e) => {
            eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
          });
        }

        const durationMs = timer.stop();
        incrementJobsProcessed('event-compute', 'completed');

        logger.info(
          {
            workspaceId,
            eventsComputed,
            eventTypes,
            durationMs,
          },
          'Event computation completed'
        );

        return {
          workspaceId,
          eventsComputed,
          eventTypes: eventTypes as Record<EventType, number>,
          durationMs,
        };
      } catch (error) {
        timer.stop();
        incrementJobsProcessed('event-compute', 'failed');

        logger.error({ error, workspaceId }, 'Event computation failed');

        captureException(error, {
          tags: {
            workspaceId,
            triggerType,
          },
          extra: {
            jobId: job.id,
            jobData: job.data,
          },
        });

        throw error;
      }
    }
  );
}

/**
 * Compute events triggered by webhooks
 */
async function computeWebhookEvents(
  workspaceId: string,
  webhookTopic?: string,
  resourceId?: string
): Promise<EventPayload[]> {
  const events: EventPayload[] = [];

  logger.debug(
    { workspaceId, webhookTopic, resourceId },
    'Computing webhook events'
  );

  // TODO: Implement webhook-specific event computation
  // Example: products/update webhook should check for inventory changes

  if (webhookTopic === 'products/update' && resourceId) {
    // Check for out of stock
    const outOfStockEvent = await checkProductOutOfStock(
      workspaceId,
      resourceId
    );
    if (outOfStockEvent) {
      events.push(outOfStockEvent);
    }

    // Check for back in stock
    const backInStockEvent = await checkProductBackInStock(
      workspaceId,
      resourceId
    );
    if (backInStockEvent) {
      events.push(backInStockEvent);
    }

    // Check for inventory threshold
    const thresholdEvent = await checkInventoryThreshold(
      workspaceId,
      resourceId
    );
    if (thresholdEvent) {
      events.push(thresholdEvent);
    }
  }

  // Store events in database
  await storeEvents(workspaceId, events);

  return events;
}

/**
 * Compute events on a schedule
 */
async function computeScheduledEvents(
  workspaceId: string
): Promise<EventPayload[]> {
  const events: EventPayload[] = [];

  logger.debug({ workspaceId }, 'Computing scheduled events');

  // Check for customer inactivity
  const inactiveEvents = await checkCustomerInactivity(workspaceId);
  events.push(...inactiveEvents);

  // Check for velocity spikes
  const velocityEvents = await checkVelocitySpikes(workspaceId);
  events.push(...velocityEvents);

  // Store events in database
  await storeEvents(workspaceId, events);

  return events;
}

/**
 * Compute all event types
 */
async function computeAllEvents(
  workspaceId: string
): Promise<EventPayload[]> {
  const events: EventPayload[] = [];

  logger.debug({ workspaceId }, 'Computing all events');

  // Compute inventory-related events
  const inventoryEvents = await computeInventoryEvents(workspaceId);
  events.push(...inventoryEvents);

  // Compute customer-related events
  const customerEvents = await checkCustomerInactivity(workspaceId);
  events.push(...customerEvents);

  // Compute velocity events
  const velocityEvents = await checkVelocitySpikes(workspaceId);
  events.push(...velocityEvents);

  // Store events in database
  await storeEvents(workspaceId, events);

  return events;
}

/**
 * Check if product is out of stock
 */
async function checkProductOutOfStock(
  _workspaceId: string,
  _productId: string
): Promise<EventPayload | null> {
  // TODO: Implement actual logic
  // 1. Get product from DB
  // 2. Check inventory level
  // 3. If inventory <= 0 and wasn't before, create event
  // 4. Generate dedupe key to prevent duplicates
  return null;
}

/**
 * Check if product is back in stock
 */
async function checkProductBackInStock(
  _workspaceId: string,
  _productId: string
): Promise<EventPayload | null> {
  // TODO: Implement actual logic
  return null;
}

/**
 * Check if inventory crossed threshold
 */
async function checkInventoryThreshold(
  _workspaceId: string,
  _productId: string
): Promise<EventPayload | null> {
  // TODO: Implement actual logic
  // Default threshold: 10 units
  return null;
}

/**
 * Check for customer inactivity
 */
async function checkCustomerInactivity(
  _workspaceId: string
): Promise<EventPayload[]> {
  const events: EventPayload[] = [];

  // TODO: Implement actual logic
  // 1. Query customers with last order date
  // 2. Check if 30/60/90 days have passed since last order
  // 3. Create events with dedupe keys

  return events;
}

/**
 * Check for velocity spikes
 */
async function checkVelocitySpikes(
  _workspaceId: string
): Promise<EventPayload[]> {
  const events: EventPayload[] = [];

  // TODO: Implement actual logic
  // 1. Calculate 7-day moving average for each product
  // 2. Compare to 30-day average
  // 3. If >2x increase, create velocity spike event

  return events;
}

/**
 * Compute all inventory-related events
 */
async function computeInventoryEvents(
  _workspaceId: string
): Promise<EventPayload[]> {
  const events: EventPayload[] = [];

  // TODO: Implement actual logic
  // Check all products for inventory issues

  return events;
}

/**
 * Store events in database with deduplication
 */
async function storeEvents(
  workspaceId: string,
  events: EventPayload[]
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  logger.debug(
    { workspaceId, count: events.length },
    'Storing events in database'
  );

  // TODO: Implement actual database storage
  // 1. For each event, check if dedupe_key exists
  // 2. If not, insert event
  // 3. Return inserted events
}

/**
 * Validate job data
 */
export function validateEventComputeData(
  data: any
): data is EventComputeJobData {
  if (!data.workspaceId || typeof data.workspaceId !== 'string') {
    return false;
  }

  if (
    !data.triggerType ||
    !['webhook', 'scheduled', 'manual'].includes(data.triggerType)
  ) {
    return false;
  }

  return true;
}
