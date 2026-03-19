/**
 * GET /api/shopify/email/drafts
 *
 * Returns recent Shopify Email marketing drafts for the connected store.
 * Requires an active Shopify connection.
 *
 * Response: { drafts: Array<{ activityId: string; title: string; status: string; createdAt: string }> }
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import {
  asyncHandler,
  NotFoundError,
  ExternalServiceError,
} from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';
import { getShopifyEmailDrafts } from '@/server/shopify/email';
import { ShopifyApiError } from '@/server/shopify/client';

// ============================================================================
// HANDLER
// ============================================================================

async function shopifyEmailDraftsHandler(_request: NextRequest) {
  const correlationId = getCorrelationId();
  const workspaceId = await getWorkspaceId();

  logger.info(
    { correlationId, workspaceId },
    'Fetching Shopify Email drafts'
  );

  let drafts: Awaited<ReturnType<typeof getShopifyEmailDrafts>>;
  try {
    drafts = await getShopifyEmailDrafts(workspaceId);
  } catch (error) {
    if (
      error instanceof ShopifyApiError &&
      (error.message.includes('No Shopify connection') ||
        error.message.includes('not active'))
    ) {
      throw new NotFoundError('No active Shopify connection');
    }
    if (error instanceof ShopifyApiError) {
      throw new ExternalServiceError('Shopify', error.message);
    }
    throw error;
  }

  logger.info(
    { correlationId, workspaceId, draftCount: drafts.length },
    'Shopify Email drafts retrieved'
  );

  return NextResponse.json({ drafts });
}

export const GET = withTracing(asyncHandler(shopifyEmailDraftsHandler));

export const dynamic = 'force-dynamic';
export const revalidate = 0;
