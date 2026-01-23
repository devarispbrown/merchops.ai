/**
 * Shopify Revoke/Uninstall Route
 *
 * POST /api/shopify/revoke
 *
 * Handles Shopify app uninstallation webhook.
 * Updates connection status and unregisters webhooks.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { prisma } from '@/server/db/client';
import { logger } from '@/server/observability/logger';
import { verifyWebhookHmac, parseWebhookHeaders } from '@/server/shopify/webhooks';

/**
 * POST /api/shopify/revoke
 *
 * Webhook endpoint for app/uninstalled topic
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId();

  logger.info(
    {
      correlationId,
      url: request.url,
    },
    'Received Shopify uninstall webhook'
  );

  try {
    // Get raw body for HMAC verification
    const rawBody = await request.text();

    // Parse webhook headers
    let headers;
    try {
      headers = parseWebhookHeaders(request.headers);
    } catch (error) {
      logger.warn(
        {
          correlationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Invalid webhook headers'
      );

      return NextResponse.json(
        { error: 'Invalid webhook headers' },
        { status: 400 }
      );
    }

    const { hmac, shop, topic, webhookId } = headers;

    logger.info(
      {
        correlationId,
        shop,
        topic,
        webhookId,
      },
      'Webhook details parsed'
    );

    // Verify HMAC signature
    if (!verifyWebhookHmac(rawBody, hmac)) {
      logger.warn(
        {
          correlationId,
          shop,
          webhookId,
        },
        'HMAC verification failed'
      );

      return NextResponse.json(
        { error: 'HMAC verification failed' },
        { status: 401 }
      );
    }

    logger.info(
      {
        correlationId,
        shop,
      },
      'HMAC verified'
    );

    // Lookup workspace by shop domain
    const connection = await prisma.shopifyConnection.findFirst({
      where: { store_domain: shop },
      include: { workspace: true },
    });

    if (!connection) {
      logger.warn(
        {
          correlationId,
          shop,
        },
        'Connection not found for shop - already revoked or never connected'
      );

      // Return success to prevent Shopify retries
      return NextResponse.json({ received: true });
    }

    const workspaceId = connection.workspace_id;

    logger.info(
      {
        correlationId,
        workspaceId,
        shop,
        connectionId: connection.id,
      },
      'Found workspace for revocation'
    );

    // Update connection status to revoked (idempotent)
    await prisma.shopifyConnection.update({
      where: { id: connection.id },
      data: {
        status: 'revoked',
        revoked_at: new Date(),
        // Keep access_token_encrypted for audit trail
      },
    });

    logger.info(
      {
        correlationId,
        workspaceId,
        shop,
        connectionId: connection.id,
      },
      'Connection status updated to revoked'
    );

    // Cancel pending work and cleanup
    await cancelPendingWork(workspaceId, correlationId);

    // Note: We cannot unregister webhooks because the app is already uninstalled
    // and we no longer have API access. Shopify handles cleanup on their side.

    logger.info(
      {
        correlationId,
        workspaceId,
        shop,
      },
      'Revocation complete'
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Error processing revocation'
    );

    // Always return 200 to prevent Shopify from retrying
    return NextResponse.json({ received: true });
  }
}

/**
 * Cancel pending work for a workspace
 * Called when app is uninstalled or revoked
 */
async function cancelPendingWork(
  workspaceId: string,
  correlationId: string
): Promise<void> {
  logger.info(
    {
      correlationId,
      workspaceId,
    },
    'Canceling pending work for workspace'
  );

  try {
    // Import BullMQ queue functions dynamically to avoid initialization issues
    const { getAllQueues } = await import('@/server/jobs/queues');

    // 1. Mark pending executions as cancelled
    const pendingExecutions = await prisma.execution.findMany({
      where: {
        workspace_id: workspaceId,
        status: {
          in: ['pending', 'running', 'retrying'],
        },
      },
    });

    if (pendingExecutions.length > 0) {
      await prisma.execution.updateMany({
        where: {
          workspace_id: workspaceId,
          status: {
            in: ['pending', 'running', 'retrying'],
          },
        },
        data: {
          status: 'failed',
          error_code: 'CANCELLED_REVOKED',
          error_message: 'Execution cancelled due to app uninstallation',
          finished_at: new Date(),
        },
      });

      logger.info(
        {
          correlationId,
          workspaceId,
          count: pendingExecutions.length,
        },
        'Cancelled pending executions'
      );
    }

    // 2. Dismiss active opportunities
    const activeOpportunities = await prisma.opportunity.findMany({
      where: {
        workspace_id: workspaceId,
        state: {
          in: ['new', 'viewed', 'approved'],
        },
      },
    });

    if (activeOpportunities.length > 0) {
      await prisma.opportunity.updateMany({
        where: {
          workspace_id: workspaceId,
          state: {
            in: ['new', 'viewed', 'approved'],
          },
        },
        data: {
          state: 'dismissed',
        },
      });

      logger.info(
        {
          correlationId,
          workspaceId,
          count: activeOpportunities.length,
        },
        'Dismissed active opportunities'
      );
    }

    // 3. Update action drafts
    const activeActionDrafts = await prisma.actionDraft.findMany({
      where: {
        workspace_id: workspaceId,
        state: {
          in: ['draft', 'edited', 'approved', 'executing'],
        },
      },
    });

    if (activeActionDrafts.length > 0) {
      await prisma.actionDraft.updateMany({
        where: {
          workspace_id: workspaceId,
          state: {
            in: ['draft', 'edited', 'approved', 'executing'],
          },
        },
        data: {
          state: 'rejected',
        },
      });

      logger.info(
        {
          correlationId,
          workspaceId,
          count: activeActionDrafts.length,
        },
        'Rejected active action drafts'
      );
    }

    // 4. Remove workspace-specific jobs from queues
    const queues = getAllQueues();
    let totalJobsRemoved = 0;

    for (const queue of queues) {
      try {
        // Get all jobs for this workspace
        const jobs = await queue.getJobs(['waiting', 'delayed', 'active']);

        for (const job of jobs) {
          // Check if job data includes this workspace_id
          if (job.data?.workspaceId === workspaceId) {
            await job.remove();
            totalJobsRemoved++;
          }
        }
      } catch (error) {
        logger.error(
          {
            correlationId,
            workspaceId,
            queue: queue.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Error removing jobs from queue'
        );
      }
    }

    if (totalJobsRemoved > 0) {
      logger.info(
        {
          correlationId,
          workspaceId,
          count: totalJobsRemoved,
        },
        'Removed scheduled jobs for workspace'
      );
    }

    logger.info(
      {
        correlationId,
        workspaceId,
        stats: {
          executionsCancelled: pendingExecutions.length,
          opportunitiesDismissed: activeOpportunities.length,
          actionDraftsRejected: activeActionDrafts.length,
          jobsRemoved: totalJobsRemoved,
        },
      },
      'Pending work cancellation complete'
    );
  } catch (error) {
    logger.error(
      {
        correlationId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Error canceling pending work'
    );

    // Don't throw - we want to complete the revocation even if cleanup fails
  }
}

/**
 * GET endpoint not supported
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
