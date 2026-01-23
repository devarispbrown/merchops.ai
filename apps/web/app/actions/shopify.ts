/**
 * Shopify Connection Server Actions
 *
 * Handles Shopify OAuth connection, disconnection, and data refresh.
 * Ensures workspace isolation and proper token management.
 */

'use server';

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
import { validateShop } from '@/server/shopify/oauth';

// Validation schemas
const initiateConnectionSchema = z.object({
  shop: z
    .string()
    .min(1, 'Shop domain is required')
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/, 'Invalid Shopify store domain')
    .transform((val) => val.toLowerCase()),
});

type InitiateConnectionResponse = ActionResponse<{
  authUrl: string;
  state: string;
}>;

type DisconnectResponse = ActionResponse<void>;

type RefreshDataResponse = ActionResponse<{
  jobId: string;
}>;

/**
 * Initiate Shopify OAuth connection
 *
 * Validates shop domain and generates OAuth authorization URL.
 * The actual token exchange happens in the callback route handler.
 *
 * @param shop - Shopify store domain (e.g., my-store.myshopify.com)
 */
export async function initiateShopifyConnection(
  shop: string
): Promise<InitiateConnectionResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const workspaceId = await getWorkspaceId();

      // Validate input
      const data = validateInput(initiateConnectionSchema, { shop });

      logger.info(
        {
          workspaceId,
          shop: data.shop,
        },
        'Initiating Shopify connection'
      );

      // Validate shop domain format
      if (!validateShop(data.shop)) {
        throw ActionErrors.validationError('Invalid Shopify store domain format');
      }

      // Check if workspace already has an active connection
      const existingConnection = await prisma.shopifyConnection.findFirst({
        where: {
          workspace_id: workspaceId,
          status: 'active',
        },
      });

      if (existingConnection) {
        logger.warn(
          {
            workspaceId,
            existingShop: existingConnection.store_domain,
          },
          'Workspace already has active Shopify connection'
        );

        throw ActionErrors.alreadyExists('Active Shopify connection');
      }

      // Generate state for CSRF protection
      const state = generateCorrelationId();

      // Generate auth URL
      const { generateAuthUrl } = await import('@/server/shopify/oauth');
      const authUrl = generateAuthUrl(data.shop, state);

      // Store state temporarily for verification
      // MVP: Use session storage or cookies. In production, use Redis with TTL.
      // The callback handler will validate this state before completing OAuth.

      logger.info(
        {
          workspaceId,
          shop: data.shop,
          state,
        },
        'Shopify OAuth initiated successfully'
      );

      return actionSuccess({
        authUrl,
        state,
      });
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}

/**
 * Disconnect Shopify store
 *
 * Revokes connection and marks all related data as inactive.
 * This is a soft delete - historical data is preserved for audit purposes.
 */
export async function disconnectShopify(): Promise<DisconnectResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const workspaceId = await getWorkspaceId();

      logger.info(
        {
          workspaceId,
        },
        'Disconnecting Shopify store'
      );

      // Find active connection
      const connection = await prisma.shopifyConnection.findFirst({
        where: {
          workspace_id: workspaceId,
          status: 'active',
        },
      });

      if (!connection) {
        throw ActionErrors.notFound('Active Shopify connection');
      }

      // Update connection status to revoked
      await prisma.$transaction(async (tx) => {
        // Mark connection as revoked
        await tx.shopifyConnection.update({
          where: { id: connection.id },
          data: {
            status: 'revoked',
            revoked_at: new Date(),
          },
        });

        // Cancel any pending opportunities
        await tx.opportunity.updateMany({
          where: {
            workspace_id: workspaceId,
            state: { in: ['new', 'viewed'] },
          },
          data: {
            state: 'dismissed',
          },
        });

        logger.info(
          {
            workspaceId,
            connectionId: connection.id,
            storeDomain: connection.store_domain,
          },
          'Shopify connection revoked successfully'
        );
      });

      // Revalidate relevant pages
      revalidatePath('/settings');
      revalidatePath('/');

      return actionSuccess(undefined);
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}

/**
 * Refresh Shopify data
 *
 * Triggers background job to sync latest data from Shopify.
 * Used for manual refresh or after connection issues.
 */
export async function refreshShopifyData(): Promise<RefreshDataResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const workspaceId = await getWorkspaceId();

      logger.info(
        {
          workspaceId,
        },
        'Refreshing Shopify data'
      );

      // Verify active connection exists
      const connection = await prisma.shopifyConnection.findFirst({
        where: {
          workspace_id: workspaceId,
          status: 'active',
        },
      });

      if (!connection) {
        throw ActionErrors.shopifyDisconnected();
      }

      // Enqueue sync job
      const job = await enqueueJob('shopify-sync', {
        workspaceId,
        connectionId: connection.id,
        syncType: 'full',
      });

      logger.info(
        {
          workspaceId,
          connectionId: connection.id,
          jobId: job.id,
        },
        'Shopify data refresh job enqueued'
      );

      return actionSuccess({
        jobId: job.id,
      });
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}
