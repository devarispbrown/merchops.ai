/**
 * Admin Health Check Endpoint
 *
 * GET /api/admin/health
 *
 * Returns detailed system health status for authenticated admin users.
 * Includes:
 * - Database connectivity and latency
 * - Redis connectivity and latency
 * - Shopify API connectivity (if workspace connected)
 *
 * For public health checks, use /api/health instead.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentWorkspace } from '@/server/auth/session';
import { asyncHandler } from '@/server/observability/error-handler';
import { getSystemHealth } from '@/server/observability/health';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';

async function healthCheckHandler(_request: NextRequest) {
  // Require authentication for detailed diagnostics
  let workspaceId: string | undefined;

  try {
    const workspace = await getCurrentWorkspace();
    if (!workspace) {
      logger.warn('Unauthorized health check attempt - no workspace found');
      return NextResponse.json(
        { error: 'Authentication required for detailed health information' },
        { status: 401 }
      );
    }
    workspaceId = workspace.id;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Unauthorized health check attempt'
    );
    return NextResponse.json(
      { error: 'Authentication required for detailed health information' },
      { status: 401 }
    );
  }

  // Run health checks with workspace context
  const health = await getSystemHealth(workspaceId);

  // Return appropriate status code based on health
  const statusCode = health.status === 'healthy' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

export const GET = withTracing(asyncHandler(healthCheckHandler));

// Allow GET requests without CSRF protection
export const dynamic = 'force-dynamic';
export const revalidate = 0;
