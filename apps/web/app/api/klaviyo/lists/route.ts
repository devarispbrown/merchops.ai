/**
 * GET /api/klaviyo/lists
 *
 * Returns all Klaviyo lists for the connected account.
 * Requires an active Klaviyo connection.
 *
 * Response: { lists: Array<{ id: string; name: string; created: string; updated: string }> }
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import { getKlaviyoClient } from '@/server/klaviyo/connection';
import {
  asyncHandler,
  NotFoundError,
  ExternalServiceError,
} from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';
import { KlaviyoApiError } from '@/server/klaviyo/client';

// ============================================================================
// HANDLER
// ============================================================================

async function klaviyoListsHandler(_request: NextRequest) {
  const correlationId = getCorrelationId();
  const workspaceId = await getWorkspaceId();

  logger.info(
    { correlationId, workspaceId },
    'Fetching Klaviyo lists'
  );

  let client: Awaited<ReturnType<typeof getKlaviyoClient>>;
  try {
    client = await getKlaviyoClient(workspaceId);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('No Klaviyo connection') ||
        error.message.includes('not active'))
    ) {
      throw new NotFoundError('Klaviyo connection');
    }
    throw error;
  }

  let lists: Awaited<ReturnType<typeof client.getLists>>;
  try {
    lists = await client.getLists(correlationId);
  } catch (error) {
    if (error instanceof KlaviyoApiError) {
      throw new ExternalServiceError('Klaviyo', error.message);
    }
    throw error;
  }

  logger.info(
    { correlationId, workspaceId, listCount: lists.length },
    'Klaviyo lists retrieved'
  );

  return NextResponse.json({
    lists: lists.map((l) => ({
      id: l.id,
      name: l.attributes.name,
      created: l.attributes.created,
      updated: l.attributes.updated,
    })),
  });
}

export const GET = withTracing(asyncHandler(klaviyoListsHandler));

export const dynamic = 'force-dynamic';
export const revalidate = 0;
