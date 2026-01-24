/**
 * Billing Usage API Route
 *
 * GET /api/billing/usage
 *
 * Returns current usage metrics for opportunities, actions, and events
 * Requires authentication
 */

import { NextRequest, NextResponse } from "next/server";

import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { getServerSession } from "@/server/auth/session";
import { getUsageStats } from "@/server/billing";
import { logger } from "@/server/observability/logger";

export async function GET(request: NextRequest) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn({ correlationId }, "Unauthorized usage request");
        return NextResponse.json(
          { error: "Unauthorized" },
          {
            status: 401,
            headers: { "X-Correlation-ID": correlationId },
          }
        );
      }

      const workspaceId = session.user.workspaceId;

      logger.info(
        {
          correlationId,
          workspaceId,
        },
        "Fetching usage metrics"
      );

      // Get current usage
      const usageStats = await getUsageStats(workspaceId);

      const durationMs = Date.now() - startTime;

      if (usageStats) {
        logger.info(
          {
            correlationId,
            workspaceId,
            opportunities: usageStats.metrics.opportunities?.current || 0,
            actions: usageStats.metrics.actions?.current || 0,
            events: usageStats.metrics.events?.current || 0,
            durationMs,
          },
          "Usage metrics fetched successfully"
        );

        return NextResponse.json(
          {
            planTier: usageStats.plan_tier,
            status: usageStats.status,
            opportunities: {
              used: usageStats.metrics.opportunities?.current || 0,
              limit: usageStats.metrics.opportunities?.limit || 0,
              percentage: usageStats.metrics.opportunities?.percentage || 0,
              unlimited: usageStats.metrics.opportunities?.unlimited || false,
            },
            actions: {
              used: usageStats.metrics.actions?.current || 0,
              limit: usageStats.metrics.actions?.limit || 0,
              percentage: usageStats.metrics.actions?.percentage || 0,
              unlimited: usageStats.metrics.actions?.unlimited || false,
            },
            events: {
              used: usageStats.metrics.events?.current || 0,
              limit: usageStats.metrics.events?.limit || 0,
              percentage: usageStats.metrics.events?.percentage || 0,
              unlimited: usageStats.metrics.events?.unlimited || false,
            },
          },
          {
            status: 200,
            headers: {
              "X-Correlation-ID": correlationId,
              "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
            },
          }
        );
      } else {
        return NextResponse.json(
          { error: "No subscription found" },
          {
            status: 404,
            headers: { "X-Correlation-ID": correlationId },
          }
        );
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Generic error
      logger.error(
        {
          correlationId,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          durationMs,
        },
        "Error fetching usage metrics"
      );

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An error occurred while fetching usage metrics",
        },
        {
          status: 500,
          headers: { "X-Correlation-ID": correlationId },
        }
      );
    }
  });
}
