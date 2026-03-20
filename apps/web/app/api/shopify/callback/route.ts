/**
 * Shopify OAuth Callback Route
 *
 * GET /api/shopify/callback
 *
 * Handles the OAuth callback from Shopify:
 * 1. Verifies state parameter (CSRF protection)
 * 2. Verifies HMAC signature
 * 3. Exchanges code for access token
 * 4. Encrypts and stores token
 * 5. Registers webhooks
 * 6. Redirects to dashboard
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { prisma } from '@/server/db/client';
import { asyncHandler, ValidationError, AuthenticationError } from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';
import {
  exchangeCodeForToken,
  verifyHmac,
  validateShop,
  encryptToken,
  validateGrantedScopes,
} from '@/server/shopify/oauth';
import { registerWebhooks } from '@/server/shopify/webhooks';

/**
 * GET /api/shopify/callback
 *
 * Receives OAuth callback with authorization code
 */
async function shopifyCallbackHandler(request: NextRequest) {
  const correlationId = getCorrelationId();

  logger.info(
    {
      correlationId,
      url: request.url,
    },
    'Received Shopify OAuth callback'
  );

  // Extract query parameters
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');
  const hmac = searchParams.get('hmac');
  const timestamp = searchParams.get('timestamp');

  // Validate required parameters
  if (!code || !shop || !state || !hmac || !timestamp) {
    throw new ValidationError('Missing required OAuth parameters', {
      hasCode: !!code,
      hasShop: !!shop,
      hasState: !!state,
      hasHmac: !!hmac,
      hasTimestamp: !!timestamp,
    });
  }

  // Validate shop domain
  if (!validateShop(shop)) {
    throw new ValidationError('Invalid shop domain format');
  }

  // Verify CSRF state token
  const storedState = request.cookies.get('shopify_oauth_state')?.value;
  const storedShop = request.cookies.get('shopify_oauth_shop')?.value;
  const storedWorkspaceId = request.cookies.get('shopify_oauth_workspace')?.value;

  if (!storedState || !storedShop || !storedWorkspaceId) {
    throw new ValidationError('Invalid OAuth state. Please try again.', {
      hasStoredState: !!storedState,
      hasStoredShop: !!storedShop,
      hasStoredWorkspaceId: !!storedWorkspaceId,
    });
  }

  if (state !== storedState || shop !== storedShop) {
    throw new ValidationError('OAuth state validation failed');
  }

  // Verify HMAC signature
  const queryParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  if (!verifyHmac(queryParams)) {
    throw new AuthenticationError('HMAC verification failed');
  }

  // Verify timestamp is recent (within 24 hours)
  const timestampMs = parseInt(timestamp, 10) * 1000;
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (now - timestampMs > maxAge) {
    throw new ValidationError('OAuth request expired. Please try again.');
  }

  logger.info(
    {
      correlationId,
      shop,
    },
    'Exchanging code for access token'
  );

  // Exchange authorization code for access token
  const tokenResponse = await exchangeCodeForToken(shop, code);

  // Validate granted scopes
  if (!validateGrantedScopes(tokenResponse.scope)) {
    throw new ValidationError('Required Shopify permissions were not granted', {
      grantedScopes: tokenResponse.scope,
    });
  }

  // Encrypt access token
  const encryptedToken = encryptToken(tokenResponse.access_token);

  logger.info(
    {
      correlationId,
      shop,
      scopes: tokenResponse.scope,
    },
    'Token exchange successful'
  );

  // Store connection in database with syncing status
  const connection = await prisma.shopifyConnection.upsert({
    where: { workspace_id: storedWorkspaceId },
    update: {
      store_domain: shop,
      access_token_encrypted: encryptedToken,
      scopes: tokenResponse.scope,
      status: 'active',
      sync_state: 'syncing',
      installed_at: new Date(),
      revoked_at: null,
    },
    create: {
      workspace_id: storedWorkspaceId,
      store_domain: shop,
      access_token_encrypted: encryptedToken,
      scopes: tokenResponse.scope,
      status: 'active',
      sync_state: 'syncing',
    },
  });

  logger.info(
    {
      correlationId,
      workspaceId: storedWorkspaceId,
      shop,
      connectionId: connection.id,
    },
    'Shopify connection stored'
  );

  // Register webhooks asynchronously (don't block callback)
  registerWebhooks(shop, encryptedToken, correlationId)
    .then((webhookIds) => {
      logger.info(
        {
          correlationId,
          shop,
          webhookIds,
        },
        'Webhooks registered successfully'
      );
    })
    .catch((error) => {
      logger.error(
        {
          correlationId,
          shop,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to register webhooks'
      );
    });

  // Enqueue initial sync job
  try {
    const { enqueueJob } = await import('@/server/jobs/queues');
    const { QUEUE_NAMES } = await import('@/server/jobs/config');

    const job = await enqueueJob(
      QUEUE_NAMES.SHOPIFY_SYNC,
      {
        workspaceId: storedWorkspaceId,
        syncType: 'initial',
        resources: ['orders', 'customers', 'products', 'inventory'],
      }
    );

    logger.info(
      {
        correlationId,
        workspaceId: storedWorkspaceId,
        shop,
        connectionId: connection.id,
        jobId: job.id,
      },
      'Initial sync job enqueued'
    );
  } catch (error) {
    // Don't block OAuth completion if job enqueue fails
    logger.error(
      {
        correlationId,
        workspaceId: storedWorkspaceId,
        shop,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to enqueue initial sync job - manual retry may be needed'
    );
  }

  logger.info(
    {
      correlationId,
      workspaceId: storedWorkspaceId,
      shop,
    },
    'OAuth flow completed successfully'
  );

  // Create response and clear OAuth cookies
  const response = NextResponse.redirect(
    new URL('/queue', request.url)
  );

  response.cookies.delete('shopify_oauth_state');
  response.cookies.delete('shopify_oauth_shop');
  response.cookies.delete('shopify_oauth_workspace');

  return response;
}

export const GET = withTracing(asyncHandler(shopifyCallbackHandler));

// Dynamic route - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
