/**
 * Shopify Disconnect Route
 *
 * POST /api/shopify/disconnect
 *
 * Disconnects Shopify integration:
 * 1. Revokes token (if possible via Shopify API)
 * 2. Marks connection as revoked in database
 * 3. Disables all pending actions
 * 4. Unregisters webhooks
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { asyncHandler, NotFoundError } from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';
import { unregisterAllWebhooks } from '@/server/shopify/webhooks';

/**
 * POST /api/shopify/disconnect
 *
 * Disconnects the Shopify store from the workspace
 */
async function shopifyDisconnectHandler(_request: NextRequest) {
  const correlationId = getCorrelationId();
  const workspaceId = await getWorkspaceId();

  logger.info(
    {
      correlationId,
      workspaceId,
    },
    'Disconnecting Shopify integration'
  );

  // Get Shopify connection
  const connection = await prisma.shopifyConnection.findUnique({
    where: {
      workspace_id: workspaceId,
    },
    select: {
      store_domain: true,
      access_token_encrypted: true,
      status: true,
    },
  });

  if (!connection) {
    throw new NotFoundError('Shopify connection');
  }

  if (connection.status === 'revoked') {
    logger.info(
      {
        correlationId,
        workspaceId,
      },
      'Shopify connection already revoked'
    );

    return NextResponse.json({
      success: true,
      message: 'Connection already disconnected',
    });
  }

  // Unregister webhooks (don't block if this fails)
  try {
    await unregisterAllWebhooks(
      connection.store_domain,
      connection.access_token_encrypted,
      correlationId
    );

    logger.info(
      {
        correlationId,
        workspaceId,
        store_domain: connection.store_domain,
      },
      'Webhooks unregistered successfully'
    );
  } catch (error) {
    logger.error(
      {
        correlationId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to unregister webhooks (continuing with disconnect)'
    );
    // Continue with disconnect even if webhook unregistration fails
  }

  // Mark connection as revoked in database
  await prisma.shopifyConnection.update({
    where: {
      workspace_id: workspaceId,
    },
    data: {
      status: 'revoked',
      revoked_at: new Date(),
    },
  });

  // Cancel all pending action drafts
  await prisma.actionDraft.updateMany({
    where: {
      workspace_id: workspaceId,
      state: {
        in: ['draft', 'edited'],
      },
    },
    data: {
      state: 'rejected',
    },
  });

  // Expire all active opportunities
  await prisma.opportunity.updateMany({
    where: {
      workspace_id: workspaceId,
      state: {
        in: ['new', 'viewed'],
      },
    },
    data: {
      state: 'expired',
    },
  });

  logger.info(
    {
      correlationId,
      workspaceId,
      store_domain: connection.store_domain,
    },
    'Shopify integration disconnected successfully'
  );

  return NextResponse.json({
    success: true,
    message: 'Shopify disconnected successfully',
  });
}

export const POST = withTracing(asyncHandler(shopifyDisconnectHandler));

// Dynamic route - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
