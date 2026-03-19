/**
 * GET /api/klaviyo/flows
 *
 * Returns all Klaviyo flows for the connected account.
 * Merchants use this list to discover which flow IDs and metric trigger names
 * are available when configuring a klaviyo_flow_trigger action.
 *
 * Requires an active Klaviyo connection for the authenticated workspace.
 *
 * Response:
 *   {
 *     flows: Array<{
 *       id:       string
 *       name:     string
 *       status:   string   // "live" | "draft" | "manual" | "archived"
 *       archived: boolean
 *       created:  string   // ISO 8601
 *       updated:  string   // ISO 8601
 *     }>
 *   }
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

async function klaviyoFlowsHandler(_request: NextRequest) {
  const correlationId = getCorrelationId();
  const workspaceId = await getWorkspaceId();

  logger.info(
    { correlationId, workspaceId },
    'Fetching Klaviyo flows'
  );

  // Resolve client — surface a 404 when there is no active connection rather
  // than letting an opaque 500 propagate to the UI.
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

  let flows: Awaited<ReturnType<typeof client.getFlows>>;
  try {
    flows = await client.getFlows(correlationId);
  } catch (error) {
    if (error instanceof KlaviyoApiError) {
      throw new ExternalServiceError('Klaviyo', error.message);
    }
    throw error;
  }

  logger.info(
    { correlationId, workspaceId, flowCount: flows.length },
    'Klaviyo flows retrieved'
  );

  return NextResponse.json({
    flows: flows.map((f) => ({
      id: f.id,
      name: f.attributes.name,
      status: f.attributes.status,
      archived: f.attributes.archived,
      created: f.attributes.created,
      updated: f.attributes.updated,
    })),
  });
}

export const GET = withTracing(asyncHandler(klaviyoFlowsHandler));

export const dynamic = 'force-dynamic';
export const revalidate = 0;
