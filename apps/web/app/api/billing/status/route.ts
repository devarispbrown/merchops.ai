/**
 * Billing Status API Route
 *
 * GET /api/billing/status
 *
 * Returns current subscription status, usage metrics, and plan limits
 * Requires authentication
 */

import { NextRequest, NextResponse } from "next/server";

import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { getServerSession } from "@/server/auth/session";
import { getSubscription, getUsageStats, getPlanFeatures } from "@/server/billing";
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
        logger.warn({ correlationId }, "Unauthorized billing status request");
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
        "Fetching billing status"
      );

      // Get subscription and usage stats
      const subscription = await getSubscription(workspaceId);
      const usageStats = await getUsageStats(workspaceId);
      const planFeatures = subscription ? getPlanFeatures(subscription.plan_tier) : null;

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          plan: subscription?.plan_tier || "none",
          status: subscription?.status || "none",
          durationMs,
        },
        "Billing status fetched successfully"
      );

      return NextResponse.json(
        {
          subscription: subscription ? {
            id: subscription.id,
            planTier: subscription.plan_tier,
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            trialEnd: subscription.trial_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            features: planFeatures,
          } : null,
          usage: usageStats?.metrics || null,
        },
        {
          status: 200,
          headers: {
            "X-Correlation-ID": correlationId,
            "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
          },
        }
      );
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
        "Error fetching billing status"
      );

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An error occurred while fetching billing status",
        },
        {
          status: 500,
          headers: { "X-Correlation-ID": correlationId },
        }
      );
    }
  });
}
