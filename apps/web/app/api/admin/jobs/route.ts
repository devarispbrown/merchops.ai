/**
 * Admin Jobs Overview Endpoint
 *
 * GET /api/admin/jobs
 *
 * Returns overview of all job queues:
 * - Queue names and status
 * - Pending/active/completed/failed counts
 * - Recent job history (last 10 jobs per queue)
 */

import { Queue } from 'bullmq';
import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/server/auth/session';
import { getAllQueues } from '@/server/jobs/queues';
import { asyncHandler } from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';

interface QueueStatus {
  name: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  isPaused: boolean;
  recentJobs: Array<{
    id: string;
    name: string;
    timestamp: number;
    processedOn?: number;
    finishedOn?: number;
    attemptsMade: number;
    state: string;
    failedReason?: string;
  }>;
}

interface JobsOverview {
  queues: QueueStatus[];
  timestamp: string;
}

/**
 * Get job counts for a queue
 */
async function getQueueCounts(queue: Queue) {
  const [waiting, active, completed, failed, delayed, paused] =
    await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.count(),
    ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  };
}

/**
 * Get recent jobs from a queue
 */
async function getRecentJobs(queue: Queue, limit: number = 10) {
  // Get recent completed and failed jobs
  const [completed, failed, active, waiting] = await Promise.all([
    queue.getCompleted(0, limit - 1),
    queue.getFailed(0, limit - 1),
    queue.getActive(0, limit - 1),
    queue.getWaiting(0, limit - 1),
  ]);

  // Combine and sort by timestamp
  const allJobs = [...completed, ...failed, ...active, ...waiting]
    .map((job) => ({
      id: job.id ?? 'unknown',
      name: job.name,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
      state: job.getState ? 'pending' : job.finishedOn ? 'completed' : 'failed',
      failedReason: job.failedReason,
    }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit);

  return allJobs;
}

/**
 * Get status for all queues
 */
async function getQueuesStatus(): Promise<QueueStatus[]> {
  const queues = getAllQueues();

  logger.info({ queueCount: queues.length }, 'Fetching status for all queues');

  const statusPromises = queues.map(async (queue) => {
    try {
      const [counts, isPaused, recentJobs] = await Promise.all([
        getQueueCounts(queue),
        queue.isPaused(),
        getRecentJobs(queue, 10),
      ]);

      return {
        name: queue.name,
        counts,
        isPaused,
        recentJobs,
      };
    } catch (error) {
      logger.error(
        {
          queue: queue.name,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                }
              : error,
        },
        `Failed to get status for queue: ${queue.name}`
      );

      // Return empty status on error
      return {
        name: queue.name,
        counts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
        },
        isPaused: false,
        recentJobs: [],
      };
    }
  });

  return await Promise.all(statusPromises);
}

async function jobsOverviewHandler(_request: NextRequest) {
  // Require authentication
  await requireAuth();

  // Get queue status
  const queues = await getQueuesStatus();

  const response: JobsOverview = {
    queues,
    timestamp: new Date().toISOString(),
  };

  logger.info(
    {
      queueCount: queues.length,
      totalWaiting: queues.reduce((sum, q) => sum + q.counts.waiting, 0),
      totalActive: queues.reduce((sum, q) => sum + q.counts.active, 0),
      totalFailed: queues.reduce((sum, q) => sum + q.counts.failed, 0),
    },
    'Jobs overview fetched'
  );

  return NextResponse.json(response);
}

export const GET = withTracing(asyncHandler(jobsOverviewHandler));

export const dynamic = 'force-dynamic';
export const revalidate = 0;
