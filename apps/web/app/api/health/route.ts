/**
 * Public Health Check Endpoint
 *
 * GET /api/health
 *
 * Returns minimal health status without requiring authentication.
 * Used by load balancers and monitoring services.
 *
 * For detailed diagnostics, see /api/admin/health (requires auth).
 */

import { NextResponse } from 'next/server';

import { isSystemAlive } from '@/server/observability/health';

/**
 * GET /api/health
 *
 * Returns minimal health status for load balancer checks
 */
export async function GET() {
  const alive = isSystemAlive();

  if (alive) {
    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      status: 'error',
      timestamp: new Date().toISOString(),
    },
    { status: 503 }
  );
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;
