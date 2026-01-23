/**
 * Admin Events Replay Endpoint
 *
 * POST /api/admin/events/replay
 *
 * Replay events for a workspace (dev/debug feature):
 * - Validates workspace ownership
 * - Re-processes existing events to regenerate opportunities
 * - Useful for testing opportunity engine changes
 */

import { EventType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { getWorkspaceId, requireAuth } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { opportunityGenerateQueue } from '@/server/jobs/queues';
import {
  asyncHandler,
  ValidationError,
  AuthorizationError,
} from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';

interface ReplayRequest {
  workspaceId: string;
  eventTypes?: string[];
  sinceDate?: string;
  dryRun?: boolean;
}

interface ReplayResponse {
  success: boolean;
  message: string;
  eventsQueued: number;
  jobIds: string[];
  correlationId: string;
}

/**
 * POST handler - replay events
 */
async function replayEventsHandler(request: NextRequest) {
  // Require authentication
  await requireAuth();

  const currentWorkspaceId = await getWorkspaceId();
  const correlationId = getCorrelationId();

  const body: ReplayRequest = await request.json();
  const { workspaceId, eventTypes, sinceDate, dryRun = false } = body;

  // Validate request
  if (!workspaceId) {
    throw new ValidationError('Missing required field: workspaceId');
  }

  // Verify workspace ownership
  if (workspaceId !== currentWorkspaceId) {
    logger.warn(
      {
        requestedWorkspaceId: workspaceId,
        currentWorkspaceId,
        correlationId,
      },
      'Attempted to replay events for unauthorized workspace'
    );

    throw new AuthorizationError(
      'You can only replay events for your own workspace'
    );
  }

  logger.info(
    {
      workspaceId,
      eventTypes,
      sinceDate,
      dryRun,
      correlationId,
    },
    'Starting event replay'
  );

  // Build query for events
  const where: {
    workspace_id: string;
    type?: { in: EventType[] };
    occurred_at?: { gte: Date };
  } = {
    workspace_id: workspaceId,
  };

  if (eventTypes && eventTypes.length > 0) {
    where.type = {
      in: eventTypes as EventType[],
    };
  }

  if (sinceDate) {
    where.occurred_at = {
      gte: new Date(sinceDate),
    };
  }

  // Fetch events to replay
  const events = await prisma.event.findMany({
    where,
    orderBy: {
      occurred_at: 'asc',
    },
    select: {
      id: true,
      type: true,
      occurred_at: true,
      workspace_id: true,
    },
  });

  logger.info(
    {
      workspaceId,
      eventCount: events.length,
      correlationId,
    },
    `Found ${events.length} events to replay`
  );

  if (events.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No events found to replay',
      eventsQueued: 0,
      jobIds: [],
      correlationId,
    });
  }

  // Dry run mode - just return what would be replayed
  if (dryRun) {
    logger.info(
      {
        workspaceId,
        eventCount: events.length,
        correlationId,
      },
      'Dry run completed - no jobs queued'
    );

    return NextResponse.json({
      success: true,
      message: `Dry run: Would replay ${events.length} events`,
      eventsQueued: 0,
      jobIds: [],
      correlationId,
      preview: events.slice(0, 10).map((e) => ({
        id: e.id,
        type: e.type,
        occurredAt: e.occurred_at,
      })),
    });
  }

  // Queue opportunity generation jobs for each event
  const jobPromises = events.map((event) =>
    opportunityGenerateQueue.add(
      'replay-event-opportunity',
      {
        eventId: event.id,
        workspaceId: event.workspace_id,
        eventType: event.type,
        isReplay: true,
        _correlationId: correlationId,
      },
      {
        jobId: `replay-${event.id}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    )
  );

  const jobs = await Promise.all(jobPromises);
  const jobIds = jobs.map((job) => job.id).filter((id): id is string => id !== undefined);

  logger.info(
    {
      workspaceId,
      eventsQueued: events.length,
      jobIds: jobIds.slice(0, 10), // Log first 10 job IDs
      correlationId,
    },
    `Successfully queued ${events.length} events for replay`
  );

  const response: ReplayResponse = {
    success: true,
    message: `Successfully queued ${events.length} events for replay`,
    eventsQueued: events.length,
    jobIds,
    correlationId,
  };

  return NextResponse.json(response);
}

export const POST = withTracing(asyncHandler(replayEventsHandler));

export const dynamic = 'force-dynamic';
