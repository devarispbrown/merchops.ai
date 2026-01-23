/**
 * Job Scheduler
 *
 * Manages scheduled jobs:
 * - Decay check (every hour)
 * - Outcome computation (daily)
 * - Data sync refresh (every 6 hours)
 */

import { Queue } from 'bullmq';
import {
  shopifySyncQueue,
  eventComputeQueue,
  opportunityGenerateQueue,
  outcomeComputeQueue,
} from './queues';
import { SCHEDULER_CONFIG, JOB_PRIORITIES } from './config';
import { logger } from '../observability/logger';
import { injectCorrelationIntoJobData, generatePrefixedCorrelationId } from '../../lib/correlation';

/**
 * Scheduled job registry
 * Tracks repeatable job keys for management
 */
const scheduledJobs = new Map<string, { queue: Queue; jobName: string; pattern: string }>();

/**
 * Initialize all scheduled jobs
 */
export async function initializeScheduler(): Promise<void> {
  logger.info('Initializing job scheduler...');

  try {
    // Schedule decay check
    await scheduleDecayCheck();

    // Schedule outcome computation
    await scheduleOutcomeComputation();

    // Schedule data sync refresh
    await scheduleDataSyncRefresh();

    logger.info(
      { scheduledJobsCount: scheduledJobs.size },
      'Job scheduler initialized'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to initialize scheduler');
    throw error;
  }
}

/**
 * Schedule decay check (every hour)
 * Marks expired opportunities as decayed
 */
async function scheduleDecayCheck(): Promise<void> {
  const { pattern, jobName } = SCHEDULER_CONFIG.DECAY_CHECK;

  await opportunityGenerateQueue.add(
    jobName,
    injectCorrelationIntoJobData({
      type: 'decay_check',
      scheduledRun: true,
    }),
    {
      repeat: {
        pattern,
      },
      priority: JOB_PRIORITIES.NORMAL,
      jobId: `scheduled-${jobName}`,
    }
  );

  scheduledJobs.set(jobName, {
    queue: opportunityGenerateQueue,
    jobName,
    pattern,
  });

  logger.info(
    { jobName, pattern },
    'Scheduled decay check'
  );
}

/**
 * Schedule outcome computation (daily at 2 AM)
 * Computes outcomes for executions completed > 24 hours ago
 */
async function scheduleOutcomeComputation(): Promise<void> {
  const { pattern, jobName } = SCHEDULER_CONFIG.OUTCOME_COMPUTE;

  await outcomeComputeQueue.add(
    jobName,
    injectCorrelationIntoJobData({
      type: 'scheduled_outcome_compute',
      scheduledRun: true,
    }),
    {
      repeat: {
        pattern,
      },
      priority: JOB_PRIORITIES.NORMAL,
      jobId: `scheduled-${jobName}`,
    }
  );

  scheduledJobs.set(jobName, {
    queue: outcomeComputeQueue,
    jobName,
    pattern,
  });

  logger.info(
    { jobName, pattern },
    'Scheduled outcome computation'
  );
}

/**
 * Schedule data sync refresh (every 6 hours)
 * Refreshes Shopify data for all active workspaces
 */
async function scheduleDataSyncRefresh(): Promise<void> {
  const { pattern, jobName } = SCHEDULER_CONFIG.DATA_SYNC;

  await shopifySyncQueue.add(
    jobName,
    injectCorrelationIntoJobData({
      type: 'scheduled_data_sync',
      syncType: 'refresh',
      scheduledRun: true,
    }),
    {
      repeat: {
        pattern,
      },
      priority: JOB_PRIORITIES.NORMAL,
      jobId: `scheduled-${jobName}`,
    }
  );

  scheduledJobs.set(jobName, {
    queue: shopifySyncQueue,
    jobName,
    pattern,
  });

  logger.info(
    { jobName, pattern },
    'Scheduled data sync refresh'
  );
}

/**
 * Get all scheduled jobs
 */
export function getScheduledJobs(): Map<string, { queue: Queue; jobName: string; pattern: string }> {
  return scheduledJobs;
}

/**
 * Remove a scheduled job
 */
export async function removeScheduledJob(jobName: string): Promise<void> {
  const job = scheduledJobs.get(jobName);

  if (!job) {
    logger.warn({ jobName }, 'Scheduled job not found');
    return;
  }

  try {
    await job.queue.removeRepeatable(job.jobName, {
      pattern: job.pattern,
    });

    scheduledJobs.delete(jobName);

    logger.info({ jobName }, 'Removed scheduled job');
  } catch (error) {
    logger.error({ error, jobName }, 'Failed to remove scheduled job');
    throw error;
  }
}

/**
 * Remove all scheduled jobs
 */
export async function removeAllScheduledJobs(): Promise<void> {
  logger.info('Removing all scheduled jobs...');

  const removePromises = Array.from(scheduledJobs.keys()).map((jobName) =>
    removeScheduledJob(jobName)
  );

  await Promise.all(removePromises);

  logger.info('All scheduled jobs removed');
}

/**
 * Pause a scheduled job
 */
export async function pauseScheduledJob(jobName: string): Promise<void> {
  const job = scheduledJobs.get(jobName);

  if (!job) {
    logger.warn({ jobName }, 'Scheduled job not found');
    return;
  }

  await job.queue.pause();

  logger.info({ jobName }, 'Paused scheduled job queue');
}

/**
 * Resume a scheduled job
 */
export async function resumeScheduledJob(jobName: string): Promise<void> {
  const job = scheduledJobs.get(jobName);

  if (!job) {
    logger.warn({ jobName }, 'Scheduled job not found');
    return;
  }

  await job.queue.resume();

  logger.info({ jobName }, 'Resumed scheduled job queue');
}

/**
 * Get scheduled job status
 */
export async function getScheduledJobStatus(jobName: string): Promise<{
  exists: boolean;
  isPaused?: boolean;
  nextRun?: Date;
}> {
  const job = scheduledJobs.get(jobName);

  if (!job) {
    return { exists: false };
  }

  const repeatableJobs = await job.queue.getRepeatableJobs();
  const repeatableJob = repeatableJobs.find((j) => j.name === job.jobName);

  if (!repeatableJob) {
    return { exists: false };
  }

  const isPaused = await job.queue.isPaused();

  return {
    exists: true,
    isPaused,
    nextRun: repeatableJob.next ? new Date(repeatableJob.next) : undefined,
  };
}

/**
 * Manually trigger a scheduled job
 */
export async function triggerScheduledJob(
  jobName: string,
  workspaceId?: string
): Promise<string> {
  const job = scheduledJobs.get(jobName);

  if (!job) {
    throw new Error(`Scheduled job not found: ${jobName}`);
  }

  const correlationId = generatePrefixedCorrelationId('manual-trigger');

  const addedJob = await job.queue.add(
    `manual-${jobName}`,
    injectCorrelationIntoJobData({
      type: jobName,
      scheduledRun: false,
      manualTrigger: true,
      ...(workspaceId && { workspaceId }),
      _correlationId: correlationId,
    }),
    {
      priority: JOB_PRIORITIES.HIGH,
    }
  );

  logger.info(
    {
      jobName,
      jobId: addedJob.id,
      correlationId,
      workspaceId,
    },
    'Manually triggered scheduled job'
  );

  return addedJob.id!;
}

/**
 * Get scheduler health
 */
export async function getSchedulerHealth(): Promise<{
  healthy: boolean;
  scheduledJobsCount: number;
  jobs: Array<{
    name: string;
    pattern: string;
    exists: boolean;
    isPaused: boolean;
    nextRun?: Date;
  }>;
}> {
  const jobs = [];
  let allHealthy = true;

  for (const [name] of scheduledJobs) {
    const status = await getScheduledJobStatus(name);
    const job = scheduledJobs.get(name)!;

    if (!status.exists || status.isPaused) {
      allHealthy = false;
    }

    jobs.push({
      name,
      pattern: job.pattern,
      exists: status.exists,
      isPaused: status.isPaused || false,
      nextRun: status.nextRun,
    });
  }

  return {
    healthy: allHealthy,
    scheduledJobsCount: scheduledJobs.size,
    jobs,
  };
}
