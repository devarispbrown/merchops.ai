/**
 * Admin Health Check Endpoint
 *
 * GET /api/admin/health
 *
 * Returns system health status including:
 * - Database connectivity and latency
 * - Redis connectivity and latency
 * - Shopify API connectivity (if workspace connected)
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentWorkspace } from '@/server/auth/session';
import { asyncHandler } from '@/server/observability/error-handler';
import { getSystemHealth } from '@/server/observability/health';
import { withTracing } from '@/server/observability/tracing';

async function healthCheckHandler(_request: NextRequest) {
  // Get current workspace (optional - health check works without auth)
  let workspaceId: string | undefined;

  try {
    const workspace = await getCurrentWorkspace();
    workspaceId = workspace?.id;
  } catch {
    // Ignore auth errors for health check
    // Health check should work without authentication
  }

  // Run health checks
  const health = await getSystemHealth(workspaceId);

  // Return appropriate status code based on health
  const statusCode = health.status === 'healthy' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

export const GET = withTracing(asyncHandler(healthCheckHandler));

// Allow GET requests without CSRF protection
export const dynamic = 'force-dynamic';
export const revalidate = 0;
