/**
 * Queue Instances
 *
 * Initializes and exports all BullMQ queues for the MerchOps job system.
 * These queues are used to enqueue jobs from API routes and server actions.
 */

import { Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  QueueName,
  defaultQueueOptions,
  queueJobOptions,
} from './config';
import { logger } from '../observability/logger';

/**
 * Queue registry - singleton instances
 */
const queues = new Map<QueueName, Queue>();

/**
 * Get or create a queue instance
 */
function getQueue(queueName: QueueName): Queue {
  if (queues.has(queueName)) {
    return queues.get(queueName)!;
  }

  const queue = new Queue(queueName, {
    ...defaultQueueOptions,
    defaultJobOptions: queueJobOptions[queueName],
  });

  // Queue event handlers for observability
  queue.on('error', (error) => {
    logger.error(
      {
        queue: queueName,
        error: error.message,
        stack: error.stack,
      },
      `Queue error: ${queueName}`
    );
  });

  queue.on('waiting', (jobId) => {
    logger.debug({ queue: queueName, jobId }, `Job waiting: ${jobId}`);
  });

  queues.set(queueName, queue);
  logger.info({ queue: queueName }, `Queue initialized: ${queueName}`);

  return queue;
}

/**
 * Shopify Sync Queue
 * Handles initial data sync and periodic refresh from Shopify API
 */
export const shopifySyncQueue = getQueue(QUEUE_NAMES.SHOPIFY_SYNC);

/**
 * Event Compute Queue
 * Processes raw Shopify data to compute business events
 */
export const eventComputeQueue = getQueue(QUEUE_NAMES.EVENT_COMPUTE);

/**
 * Opportunity Generate Queue
 * Generates opportunities from computed events
 */
export const opportunityGenerateQueue = getQueue(
  QUEUE_NAMES.OPPORTUNITY_GENERATE
);

/**
 * Execution Queue
 * Executes approved actions (discounts, emails, product pauses)
 */
export const executionQueue = getQueue(QUEUE_NAMES.EXECUTION);

/**
 * Outcome Compute Queue
 * Computes helped/neutral/hurt outcomes from executed actions
 */
export const outcomeComputeQueue = getQueue(QUEUE_NAMES.OUTCOME_COMPUTE);

/**
 * Get all queue instances (for monitoring/admin purposes)
 */
export function getAllQueues(): Queue[] {
  return Array.from(queues.values());
}

/**
 * Close all queues gracefully
 * Used during shutdown
 */
export async function closeAllQueues(): Promise<void> {
  logger.info('Closing all queues...');
  const closePromises = Array.from(queues.values()).map((queue) =>
    queue.close()
  );
  await Promise.all(closePromises);
  queues.clear();
  logger.info('All queues closed');
}

/**
 * Pause all queues
 * Used during maintenance
 */
export async function pauseAllQueues(): Promise<void> {
  logger.info('Pausing all queues...');
  const pausePromises = Array.from(queues.values()).map((queue) =>
    queue.pause()
  );
  await Promise.all(pausePromises);
  logger.info('All queues paused');
}

/**
 * Resume all queues
 * Used after maintenance
 */
export async function resumeAllQueues(): Promise<void> {
  logger.info('Resuming all queues...');
  const resumePromises = Array.from(queues.values()).map((queue) =>
    queue.resume()
  );
  await Promise.all(resumePromises);
  logger.info('All queues resumed');
}

/**
 * Clean all queues (remove completed/failed jobs)
 * Used for maintenance
 */
export async function cleanAllQueues(
  grace: number = 3600000
): Promise<void> {
  logger.info({ grace }, 'Cleaning all queues...');
  const cleanPromises = Array.from(queues.values()).map((queue) =>
    queue.clean(grace, 100, 'completed').then(() =>
      queue.clean(grace * 24, 100, 'failed') // Keep failed jobs longer
    )
  );
  await Promise.all(cleanPromises);
  logger.info('All queues cleaned');
}

/**
 * Enqueue a job to a specific queue
 * Helper function for server actions and API routes
 *
 * @param queueName - Name of the queue (must be a valid QueueName)
 * @param data - Job data payload
 * @param options - Optional job-specific options
 */
export async function enqueueJob(
  queueName: QueueName | string,
  data: any,
  options?: any
): Promise<{ id: string; name: string }> {
  // Validate queue name
  const validQueueNames = Object.values(QUEUE_NAMES);
  if (!validQueueNames.includes(queueName as QueueName)) {
    throw new Error(`Invalid queue name: ${queueName}`);
  }

  const queue = getQueue(queueName as QueueName);

  // Add correlation ID if not present
  const { injectCorrelationIntoJobData } = await import('../../lib/correlation');
  const jobData = injectCorrelationIntoJobData(data);

  // Enqueue job
  const job = await queue.add(queueName, jobData, options);

  logger.info(
    {
      queue: queueName,
      jobId: job.id,
      jobData: jobData,
    },
    `Job enqueued: ${queueName}`
  );

  return {
    id: job.id!,
    name: job.name,
  };
}
