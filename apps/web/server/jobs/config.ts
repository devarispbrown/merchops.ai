/**
 * BullMQ Job System Configuration
 *
 * Redis connection, queue names, and default job options
 * for the MerchOps background job processing system.
 */

import { QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

// Environment variables with defaults
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_TLS = process.env.REDIS_TLS === 'true';
const REDIS_URL = process.env.REDIS_URL;

/**
 * Check if Redis is explicitly configured
 * Returns true only if REDIS_URL or REDIS_HOST is set
 */
export function isRedisConfigured(): boolean {
  return Boolean(REDIS_URL || REDIS_HOST);
}

/**
 * Redis connection configuration
 * Supports both direct connection and URL-based (e.g., Upstash)
 * Returns null if Redis is not configured
 */
export const redisConnection = REDIS_URL
  ? {
      url: REDIS_URL,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }
  : REDIS_HOST
  ? {
      host: REDIS_HOST,
      port: REDIS_PORT || 6379,
      password: REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      ...(REDIS_TLS && {
        tls: {
          rejectUnauthorized: false,
        },
      }),
    }
  : null;

/**
 * Alias for backwards compatibility
 */
export const REDIS_CONNECTION = redisConnection;

/**
 * Queue names - central registry for all job queues
 */
export const QUEUE_NAMES = {
  SHOPIFY_SYNC: 'shopify-sync',
  EVENT_COMPUTE: 'event-compute',
  OPPORTUNITY_GENERATE: 'opportunity-generate',
  EXECUTION: 'execution',
  OUTCOME_COMPUTE: 'outcome-compute',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

/**
 * Default job options - applied to all jobs unless overridden
 *
 * Retry strategy:
 * - Max 3 attempts for most jobs
 * - Exponential backoff: 1s, 2s, 4s
 * - Jobs are removed after completion to prevent Redis bloat
 * - Failed jobs kept for 7 days for debugging
 */
export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // Start at 1 second
  },
  removeOnComplete: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
  },
};

/**
 * Queue-specific options
 * Execution jobs are more critical and get more retries
 */
export const queueJobOptions: Record<QueueName, Partial<JobsOptions>> = {
  [QUEUE_NAMES.SHOPIFY_SYNC]: {
    ...defaultJobOptions,
    attempts: 5, // Shopify sync is critical
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  [QUEUE_NAMES.EVENT_COMPUTE]: {
    ...defaultJobOptions,
  },
  [QUEUE_NAMES.OPPORTUNITY_GENERATE]: {
    ...defaultJobOptions,
  },
  [QUEUE_NAMES.EXECUTION]: {
    ...defaultJobOptions,
    attempts: 5, // Executions are critical
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: {
      age: 86400, // Keep execution logs for 24 hours
      count: 1000,
    },
  },
  [QUEUE_NAMES.OUTCOME_COMPUTE]: {
    ...defaultJobOptions,
    attempts: 5,
  },
};

/**
 * Default queue options
 * Returns null if Redis is not configured
 */
export const defaultQueueOptions: QueueOptions | null = redisConnection
  ? {
      connection: redisConnection,
      defaultJobOptions,
    }
  : null;

/**
 * Default worker options
 */
export const defaultWorkerOptions: Omit<WorkerOptions, 'connection'> = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  maxStalledCount: 3,
  stalledInterval: 30000, // 30 seconds
};

/**
 * Scheduler configuration
 */
export const SCHEDULER_CONFIG = {
  // Decay check - every hour
  DECAY_CHECK: {
    pattern: '0 * * * *', // Every hour at minute 0
    jobName: 'decay-check',
  },
  // Outcome computation - daily at 2 AM
  OUTCOME_COMPUTE: {
    pattern: '0 2 * * *', // Daily at 2 AM
    jobName: 'daily-outcome-compute',
  },
  // Data sync refresh - every 6 hours
  DATA_SYNC: {
    pattern: '0 */6 * * *', // Every 6 hours at minute 0
    jobName: 'data-sync-refresh',
  },
} as const;

/**
 * Job priorities
 * Higher number = higher priority
 */
export const JOB_PRIORITIES = {
  CRITICAL: 10,
  HIGH: 5,
  NORMAL: 1,
  LOW: -5,
} as const;
