/**
 * Admin Queue-Specific Endpoint
 *
 * GET /api/admin/jobs/[queue]
 * - Get detailed status for a specific queue
 * - List failed jobs with details
 *
 * POST /api/admin/jobs/[queue]
 * - Retry failed job
 * - Retry all failed jobs in queue
 */

import { Queue } from 'bullmq';
import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/server/auth/session';
import { getAllQueues } from '@/server/jobs/queues';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';

interface QueueDetail {
  name: string;
  isPaused: boolean;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  failedJobs: Array<{
    id: string;
    name: string;
    data: Record<string, unknown>;
    failedReason: string;
    stacktrace: string[];
    attemptsMade: number;
    timestamp: number;
    processedOn?: number;
    finishedOn?: number;
  }>;
}

/**
 * Find queue by name
 */
function findQueue(queueName: string): Queue {
  const queues = getAllQueues();
  const queue = queues.find((q) => q.name === queueName);

  if (!queue) {
    throw new NotFoundError(`Queue '${queueName}'`);
  }

  return queue;
}

/**
 * Get detailed status for a specific queue
 */
async function getQueueDetail(queue: Queue): Promise<QueueDetail> {
  const [waiting, active, completed, failed, delayed, isPaused, failedJobs] =
    await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
      queue.getFailed(0, 49), // Get up to 50 failed jobs
    ]);

  const failedJobsDetail = failedJobs.map((job) => ({
    id: job.id ?? 'unknown',
    name: job.name,
    data: job.data,
    failedReason: job.failedReason ?? 'Unknown error',
    stacktrace: job.stacktrace ?? [],
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  }));

  return {
    name: queue.name,
    isPaused,
    counts: {
      waiting,
      active,
      completed,
      failed,
      delayed,
    },
    failedJobs: failedJobsDetail,
  };
}

/**
 * GET handler - get queue details
 */
async function getQueueHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  // Require authentication
  await requireAuth();

  const params = await context?.params;
  const queueName = params?.queue;
  if (!queueName) {
    throw new ValidationError('Queue name is required');
  }
  const queue = findQueue(queueName);

  logger.info({ queue: queueName }, `Fetching details for queue: ${queueName}`);

  const detail = await getQueueDetail(queue);

  return NextResponse.json(detail);
}

/**
 * POST handler - retry failed jobs
 */
async function retryJobsHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  // Require authentication
  await requireAuth();

  const params = await context?.params;
  const queueName = params?.queue;
  if (!queueName) {
    throw new ValidationError('Queue name is required');
  }
  const queue = findQueue(queueName);

  const body = await request.json();
  const { action, jobId } = body;

  if (!action) {
    throw new ValidationError('Missing required field: action');
  }

  logger.info(
    { queue: queueName, action, jobId },
    `Retry action requested for queue: ${queueName}`
  );

  if (action === 'retry-job') {
    // Retry a specific failed job
    if (!jobId) {
      throw new ValidationError('Missing required field: jobId');
    }

    const job = await queue.getJob(jobId);

    if (!job) {
      throw new NotFoundError(`Job '${jobId}'`);
    }

    // Check if job is failed
    const state = await job.getState();
    if (state !== 'failed') {
      throw new ValidationError(`Job '${jobId}' is not in failed state`);
    }

    // Retry the job
    await job.retry();

    logger.info(
      { queue: queueName, jobId },
      `Job ${jobId} retried successfully`
    );

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} has been retried`,
    });
  } else if (action === 'retry-all') {
    // Retry all failed jobs in the queue
    const failedJobs = await queue.getFailed(0, -1); // Get all failed jobs

    logger.info(
      { queue: queueName, failedCount: failedJobs.length },
      `Retrying ${failedJobs.length} failed jobs`
    );

    // Retry each failed job
    await Promise.all(failedJobs.map((job) => job.retry()));

    logger.info(
      { queue: queueName, retriedCount: failedJobs.length },
      `All failed jobs retried successfully`
    );

    return NextResponse.json({
      success: true,
      message: `${failedJobs.length} failed jobs have been retried`,
      count: failedJobs.length,
    });
  } else {
    throw new ValidationError(`Unknown action: ${action}`);
  }
}

export const GET = withTracing(asyncHandler(getQueueHandler));
export const POST = withTracing(asyncHandler(retryJobsHandler));

export const dynamic = 'force-dynamic';
export const revalidate = 0;
