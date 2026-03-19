/**
 * POST /api/klaviyo/disconnect
 *
 * Revokes the Klaviyo connection for the authenticated workspace.
 * Sets status to 'revoked' and records the revocation timestamp.
 * Does NOT delete the record (preserves audit history).
 *
 * Response: { success: true; message: string }
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import { disconnectKlaviyo } from '@/server/klaviyo/connection';
import {
  asyncHandler,
  NotFoundError,
} from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';

// ============================================================================
// HANDLER
// ============================================================================

async function klaviyoDisconnectHandler(_request: NextRequest) {
  const correlationId = getCorrelationId();
  const workspaceId = await getWorkspaceId();

  logger.info(
    { correlationId, workspaceId },
    'Disconnecting Klaviyo account'
  );

  try {
    await disconnectKlaviyo(workspaceId);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('No Klaviyo connection')
    ) {
      throw new NotFoundError('Klaviyo connection');
    }
    throw error;
  }

  logger.info(
    { correlationId, workspaceId },
    'Klaviyo account disconnected'
  );

  return NextResponse.json({
    success: true,
    message: 'Klaviyo disconnected successfully',
  });
}

export const POST = withTracing(asyncHandler(klaviyoDisconnectHandler));

export const dynamic = 'force-dynamic';
export const revalidate = 0;
