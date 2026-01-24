/**
 * Queue Instances
 *
 * Initializes and exports all BullMQ queues for the MerchOps job system.
 * These queues are used to enqueue jobs from API routes and server actions.
 *
 * Queues are lazily initialized to support environments without Redis.
 */

import { Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  QueueName,
  defaultQueueOptions,
  queueJobOptions,
  isRedisConfigured,
} from './config';
import { logger } from '../observability/logger';

/**
 * Queue registry - singleton instances (lazily initialized)
 */
const queues = new Map<QueueName, Queue>();

/**
 * Track whether we've logged the Redis unavailable warning
 */
let redisUnavailableWarningLogged = false;

/**
 * Log warning once when Redis is not configured
 */
function logRedisUnavailableWarning(): void {
  if (!redisUnavailableWarningLogged) {
    logger.warn(
      'Redis is not configured. Background job processing is disabled. ' +
      'Set REDIS_URL or REDIS_HOST environment variable to enable job queues.'
    );
    redisUnavailableWarningLogged = true;
  }
}

/**
 * Check if queues are available
 */
export function areQueuesAvailable(): boolean {
  return isRedisConfigured() && defaultQueueOptions !== null;
}

/**
 * Get or create a queue instance
 * Returns null if Redis is not configured
 */
function getQueue(queueName: QueueName): Queue | null {
  if (!areQueuesAvailable()) {
    logRedisUnavailableWarning();
    return null;
  }

  if (queues.has(queueName)) {
    return queues.get(queueName)!;
  }

  const queue = new Queue(queueName, {
    ...defaultQueueOptions!,
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
 * Lazy queue getters - only initialize when accessed
 */
export function getShopifySyncQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.SHOPIFY_SYNC);
}

export function getEventComputeQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.EVENT_COMPUTE);
}

export function getOpportunityGenerateQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.OPPORTUNITY_GENERATE);
}

export function getExecutionQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.EXECUTION);
}

export function getOutcomeComputeQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.OUTCOME_COMPUTE);
}

/**
 * Get all queue instances (for monitoring/admin purposes)
 * Only returns initialized queues
 */
export function getAllQueues(): Queue[] {
  return Array.from(queues.values());
}

/**
 * Close all queues gracefully
 * Used during shutdown
 */
export async function closeAllQueues(): Promise<void> {
  if (queues.size === 0) {
    logger.debug('No queues to close');
    return;
  }

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
  if (queues.size === 0) {
    logger.debug('No queues to pause');
    return;
  }

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
  if (queues.size === 0) {
    logger.debug('No queues to resume');
    return;
  }

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
  if (queues.size === 0) {
    logger.debug('No queues to clean');
    return;
  }

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
 * Error thrown when trying to enqueue a job but Redis is not available
 */
export class QueueUnavailableError extends Error {
  constructor(queueName: string) {
    super(
      `Cannot enqueue job to "${queueName}": Redis is not configured. ` +
      'Set REDIS_URL or REDIS_HOST environment variable to enable job queues.'
    );
    this.name = 'QueueUnavailableError';
  }
}

/**
 * Enqueue a job to a specific queue
 * Helper function for server actions and API routes
 *
 * @param queueName - Name of the queue (must be a valid QueueName)
 * @param data - Job data payload
 * @param options - Optional job-specific options
 * @throws QueueUnavailableError if Redis is not configured
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

  if (!queue) {
    throw new QueueUnavailableError(queueName);
  }

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

/**
 * Try to enqueue a job, returning null if Redis is not available
 * Use this when job enqueueing is optional (non-critical paths)
 */
export async function tryEnqueueJob(
  queueName: QueueName | string,
  data: any,
  options?: any
): Promise<{ id: string; name: string } | null> {
  try {
    return await enqueueJob(queueName, data, options);
  } catch (error) {
    if (error instanceof QueueUnavailableError) {
      logger.debug(
        { queue: queueName },
        `Skipping job enqueue - Redis not available`
      );
      return null;
    }
    throw error;
  }
}
