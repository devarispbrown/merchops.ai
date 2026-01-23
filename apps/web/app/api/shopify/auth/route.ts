/**
 * Shopify OAuth Initiation Route
 *
 * GET /api/shopify/auth?shop=store.myshopify.com
 *
 * Initiates the Shopify OAuth flow:
 * 1. Validates shop parameter
 * 2. Generates and stores CSRF state parameter
 * 3. Redirects to Shopify authorization URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import { asyncHandler, ValidationError, AuthenticationError } from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';
import { generateAuthUrl, generateState, validateShop } from '@/server/shopify/oauth';


// Query parameter schema
const authQuerySchema = z.object({
  shop: z.string().min(1, 'Shop parameter is required'),
});

/**
 * GET /api/shopify/auth?shop=store.myshopify.com
 *
 * Validates the shop parameter and redirects to Shopify OAuth
 */
async function shopifyAuthHandler(request: NextRequest) {
  const correlationId = getCorrelationId();

  // Require authentication - workspace ID is needed
  let workspaceId: string;
  try {
    workspaceId = await getWorkspaceId();
  } catch {
    throw new AuthenticationError('Authentication required to connect Shopify');
  }

  // Parse and validate query parameters
  const searchParams = request.nextUrl.searchParams;
  const shop = searchParams.get('shop');

  const validation = authQuerySchema.safeParse({ shop });
  if (!validation.success) {
    throw new ValidationError('Invalid shop parameter', {
      errors: validation.error.errors,
    });
  }

  const { shop: shopDomain } = validation.data;

  // Validate shop domain format
  if (!validateShop(shopDomain)) {
    throw new ValidationError('Invalid shop domain. Must be in format: store.myshopify.com');
  }

  logger.info(
    {
      correlationId,
      workspaceId,
      shop: shopDomain,
    },
    'Initiating Shopify OAuth flow'
  );

  // Generate CSRF state token
  const state = generateState();

  // Generate OAuth authorization URL
  const authUrl = generateAuthUrl(shopDomain, state);

  logger.info(
    {
      correlationId,
      workspaceId,
      shop: shopDomain,
    },
    'Redirecting to Shopify OAuth'
  );

  // Create response with state cookie for CSRF protection
  const response = NextResponse.redirect(authUrl);

  // Set secure, httpOnly cookie with state
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/api/shopify',
  });

  // Store shop and workspace ID in cookie for callback validation
  response.cookies.set('shopify_oauth_shop', shopDomain, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/api/shopify',
  });

  response.cookies.set('shopify_oauth_workspace', workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/api/shopify',
  });

  return response;
}

export const GET = withTracing(asyncHandler(shopifyAuthHandler));

// Dynamic route - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
