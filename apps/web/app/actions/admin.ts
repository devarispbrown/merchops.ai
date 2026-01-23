/**
 * Admin Server Actions
 *
 * Administrative actions for diagnostics, event replay, and job management.
 * Restricted to authorized users only.
 */

'use server';

import { EventType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  ActionErrors,
  actionSuccess,
  handleUnknownError,
  type ActionResponse,
} from '@/lib/actions/errors';
import { validateInput } from '@/lib/actions/validation';
import { runWithCorrelationAsync, generateCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { enqueueJob } from '@/server/jobs/queues';
import { logger } from '@/server/observability/logger';

// Validation schemas
const replayEventsSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  eventTypes: z.array(z.string()).optional(),
});

const retryJobSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
});

type ReplayEventsResponse = ActionResponse<{
  jobId: string;
  eventCount: number;
}>;

type RetryJobResponse = ActionResponse<{
  jobId: string;
  status: string;
}>;

/**
 * Replay events for a workspace
 *
 * Reprocesses historical events to regenerate opportunities.
 * Useful for testing, recovery, or after logic changes.
 *
 * IMPORTANT: This is a potentially expensive operation.
 * Should be used carefully and with appropriate filters.
 *
 * @param workspaceId - Optional workspace ID (defaults to current workspace)
 */
export async function replayEvents(
  options: {
    workspaceId?: string;
    startDate?: string;
    endDate?: string;
    eventTypes?: string[];
  } = {}
): Promise<ReplayEventsResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const currentWorkspaceId = await getWorkspaceId();

      // Use provided workspace ID or fall back to current
      const targetWorkspaceId = options.workspaceId ?? currentWorkspaceId;

      // Verify access to target workspace
      if (targetWorkspaceId !== currentWorkspaceId) {
        // In MVP, users can only replay their own workspace
        // In production, add admin role check here
        throw ActionErrors.unauthorized('You can only replay events for your own workspace');
      }

      // Validate input
      const data = validateInput(replayEventsSchema, {
        workspaceId: targetWorkspaceId,
        ...options,
      });

      logger.info(
        {
          workspaceId: targetWorkspaceId,
          startDate: data.startDate,
          endDate: data.endDate,
          eventTypes: data.eventTypes,
        },
        'Initiating event replay'
      );

      // Build event query
      const whereClause: {
        workspace_id: string;
        occurred_at?: { gte?: Date; lte?: Date };
        type?: { in: EventType[] };
      } = {
        workspace_id: targetWorkspaceId,
      };

      if (data.startDate || data.endDate) {
        whereClause.occurred_at = {};
        if (data.startDate) {
          whereClause.occurred_at.gte = new Date(data.startDate);
        }
        if (data.endDate) {
          whereClause.occurred_at.lte = new Date(data.endDate);
        }
      }

      if (data.eventTypes && data.eventTypes.length > 0) {
        whereClause.type = {
          in: data.eventTypes as EventType[],
        };
      }

      // Count events to replay
      const eventCount = await prisma.event.count({
        where: whereClause,
      });

      if (eventCount === 0) {
        logger.warn(
          {
            workspaceId: targetWorkspaceId,
            filters: data,
          },
          'No events found to replay'
        );

        throw ActionErrors.notFound('Events matching the specified criteria');
      }

      // Enqueue replay job
      const job = await enqueueJob('event-replay', {
        workspaceId: targetWorkspaceId,
        startDate: data.startDate,
        endDate: data.endDate,
        eventTypes: data.eventTypes,
        eventCount,
      });

      logger.info(
        {
          workspaceId: targetWorkspaceId,
          jobId: job.id,
          eventCount,
        },
        'Event replay job enqueued'
      );

      return actionSuccess({
        jobId: job.id,
        eventCount,
      });
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}

/**
 * Retry a failed job
 *
 * Manually retries a failed background job.
 * Useful for recovering from transient failures.
 *
 * @param jobId - Job ID to retry
 */
export async function retryFailedJob(jobId: string): Promise<RetryJobResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const workspaceId = await getWorkspaceId();

      // Validate input
      const data = validateInput(retryJobSchema, { jobId });

      logger.info(
        {
          workspaceId,
          jobId: data.jobId,
        },
        'Retrying failed job'
      );

      // In a real implementation, we would:
      // 1. Fetch job details from BullMQ
      // 2. Verify job belongs to user's workspace
      // 3. Check job is in failed state
      // 4. Retry the job

      // For now, we'll use a simplified approach
      const { Queue } = await import('bullmq');
      const { REDIS_CONNECTION } = await import('@/server/jobs/config');

      // Determine which queue the job belongs to
      // In production, you'd need to track this or search across queues
      const queueNames = [
        'shopify-sync',
        'opportunity-generation',
        'action-execution',
        'outcome-resolution',
      ];

      let jobFound = false;
      let jobStatus = 'unknown';

      for (const queueName of queueNames) {
        try {
          const queue = new Queue(queueName, { connection: REDIS_CONNECTION });
          const job = await queue.getJob(data.jobId);

          if (job) {
            jobFound = true;

            // Verify job belongs to workspace
            if (job.data.workspaceId !== workspaceId) {
              throw ActionErrors.unauthorized('You do not have access to this job');
            }

            // Check if job is failed
            const state = await job.getState();

            if (state !== 'failed') {
              throw ActionErrors.invalidState(`Job is in ${state} state, not failed`);
            }

            // Retry the job
            await job.retry();
            jobStatus = 'retrying';

            logger.info(
              {
                workspaceId,
                jobId: data.jobId,
                queueName,
              },
              'Job retried successfully'
            );

            break;
          }
        } catch {
          // Continue to next queue
          continue;
        }
      }

      if (!jobFound) {
        throw ActionErrors.notFound('Job');
      }

      // Revalidate admin pages
      revalidatePath('/admin');
      revalidatePath('/admin/jobs');

      return actionSuccess({
        jobId: data.jobId,
        status: jobStatus,
      });
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}
