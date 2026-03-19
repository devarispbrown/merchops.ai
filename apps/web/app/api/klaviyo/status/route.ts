/**
 * GET /api/klaviyo/status
 *
 * Returns Klaviyo connection status for the authenticated workspace.
 *
 * Response:
 *   { connected: false }
 *   OR
 *   { connected: true; status: string; connectedAt: string; lastSyncedAt: string | null }
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import { getKlaviyoConnectionStatus } from '@/server/klaviyo/connection';
import { asyncHandler } from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';

// ============================================================================
// TYPES
// ============================================================================

type StatusResponse =
  | { connected: false }
  | {
      connected: boolean;
      status: string;
      connectedAt: string;
      lastSyncedAt: string | null;
    };

// ============================================================================
// HANDLER
// ============================================================================

async function klaviyoStatusHandler(_request: NextRequest) {
  const correlationId = getCorrelationId();
  const workspaceId = await getWorkspaceId();

  logger.info(
    { correlationId, workspaceId },
    'Fetching Klaviyo connection status'
  );

  const connection = await getKlaviyoConnectionStatus(workspaceId);

  if (!connection) {
    logger.info(
      { correlationId, workspaceId },
      'No Klaviyo connection found'
    );
    return NextResponse.json<StatusResponse>({ connected: false });
  }

  const response: StatusResponse = {
    connected: connection.status === 'active',
    status: connection.status,
    connectedAt: connection.connectedAt.toISOString(),
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
  };

  logger.info(
    { correlationId, workspaceId, status: connection.status },
    'Klaviyo connection status retrieved'
  );

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'private, max-age=60',
    },
  });
}

export const GET = withTracing(asyncHandler(klaviyoStatusHandler));

export const dynamic = 'force-dynamic';
export const revalidate = 0;
