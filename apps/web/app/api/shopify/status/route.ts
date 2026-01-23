/**
 * Shopify Connection Status Route
 *
 * GET /api/shopify/status
 *
 * Returns current Shopify connection status for the workspace:
 * - Store domain
 * - Granted scopes
 * - Connection timestamp
 * - Sync status
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { asyncHandler } from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';

type StatusResponse = {
  connected: boolean;
  store_domain?: string;
  scopes?: string[];
  connected_at?: string;
  status?: 'active' | 'revoked' | 'error';
  last_sync_at?: string;
};

/**
 * GET /api/shopify/status
 *
 * Returns Shopify connection status for current workspace
 */
async function shopifyStatusHandler(_request: NextRequest) {
  const correlationId = getCorrelationId();
  const workspaceId = await getWorkspaceId();

  logger.info(
    {
      correlationId,
      workspaceId,
    },
    'Fetching Shopify connection status'
  );

  // Get Shopify connection
  const connection = await prisma.shopifyConnection.findUnique({
    where: {
      workspace_id: workspaceId,
    },
    select: {
      store_domain: true,
      scopes: true,
      status: true,
      installed_at: true,
      revoked_at: true,
    },
  });

  // No connection exists
  if (!connection) {
    logger.info(
      {
        correlationId,
        workspaceId,
      },
      'No Shopify connection found'
    );

    return NextResponse.json<StatusResponse>({
      connected: false,
    });
  }

  // Connection exists - get sync status
  const lastSyncEvent = await prisma.event.findFirst({
    where: {
      workspace_id: workspaceId,
      source: 'scheduled_job',
    },
    orderBy: {
      created_at: 'desc',
    },
    select: {
      created_at: true,
    },
  });

  const response: StatusResponse = {
    connected: connection.status === 'active',
    store_domain: connection.store_domain,
    scopes: connection.scopes.split(',').map((s) => s.trim()),
    connected_at: connection.installed_at.toISOString(),
    status: connection.status,
    last_sync_at: lastSyncEvent?.created_at.toISOString(),
  };

  logger.info(
    {
      correlationId,
      workspaceId,
      status: connection.status,
      store_domain: connection.store_domain,
    },
    'Shopify connection status retrieved'
  );

  return NextResponse.json(response);
}

export const GET = withTracing(asyncHandler(shopifyStatusHandler));

// Dynamic route - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
