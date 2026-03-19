/**
 * POST /api/klaviyo/connect
 *
 * Accepts a Klaviyo private API key, validates it against the Klaviyo API,
 * encrypts it, and persists the connection for the authenticated workspace.
 *
 * Request body: { apiKey: string }
 * Response:     { connected: true; connectedAt: string; status: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import { connectKlaviyo } from '@/server/klaviyo/connection';
import {
  asyncHandler,
  ValidationError,
} from '@/server/observability/error-handler';
import { logger } from '@/server/observability/logger';
import { withTracing } from '@/server/observability/tracing';

// ============================================================================
// REQUEST SCHEMA
// ============================================================================

const ConnectRequestSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
});

// ============================================================================
// HANDLER
// ============================================================================

async function klaviyoConnectHandler(request: NextRequest) {
  const correlationId = getCorrelationId();
  const workspaceId = await getWorkspaceId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }

  const parsed = ConnectRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', {
      issues: parsed.error.flatten(),
    });
  }

  const { apiKey } = parsed.data;

  logger.info(
    { correlationId, workspaceId },
    'Connecting Klaviyo account'
  );

  const connection = await connectKlaviyo(workspaceId, apiKey);

  logger.info(
    { correlationId, workspaceId, status: connection.status },
    'Klaviyo account connected'
  );

  return NextResponse.json({
    connected: true,
    status: connection.status,
    connectedAt: connection.connectedAt.toISOString(),
  });
}

export const POST = withTracing(asyncHandler(klaviyoConnectHandler));

export const dynamic = 'force-dynamic';
export const revalidate = 0;
