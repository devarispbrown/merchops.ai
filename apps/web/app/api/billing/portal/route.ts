/**
 * Billing Portal API Route
 *
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for subscription management
 * Requires authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { getServerSession } from "@/server/auth/session";
import { getSubscription, createBillingPortalSession } from "@/server/billing";
import { logger } from "@/server/observability/logger";

// Request body schema (optional return URL)
const portalRequestSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn({ correlationId }, "Unauthorized portal session request");
        return NextResponse.json(
          { error: "Unauthorized" },
          {
            status: 401,
            headers: { "X-Correlation-ID": correlationId },
          }
        );
      }

      const workspaceId = session.user.workspaceId;

      // Parse and validate request body (optional)
      let returnUrl: string | undefined;
      try {
        const body = await request.json();
        const validated = portalRequestSchema.parse(body);
        returnUrl = validated.returnUrl;
      } catch (error) {
        // Body is optional, continue without it
        if (!(error instanceof SyntaxError)) {
          logger.warn(
            { correlationId, error: error instanceof Error ? error.message : "Unknown error" },
            "Invalid portal request body, continuing with defaults"
          );
        }
      }

      logger.info(
        {
          correlationId,
          workspaceId,
        },
        "Creating portal session"
      );

      // Get subscription to get customer ID
      const subscription = await getSubscription(workspaceId);
      if (!subscription) {
        return NextResponse.json(
          { error: "No subscription found. Please contact support." },
          {
            status: 404,
            headers: { "X-Correlation-ID": correlationId },
          }
        );
      }

      // Default return URL if not provided
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const finalReturnUrl = returnUrl || `${baseUrl}/billing`;

      // Create portal session
      const portalSession = await createBillingPortalSession(
        subscription.stripe_customer_id,
        finalReturnUrl
      );

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          durationMs,
        },
        "Portal session created successfully"
      );

      return NextResponse.json(
        {
          url: portalSession.url,
        },
        {
          status: 200,
          headers: { "X-Correlation-ID": correlationId },
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
        "Error creating portal session"
      );

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An error occurred while creating portal session",
        },
        {
          status: 500,
          headers: { "X-Correlation-ID": correlationId },
        }
      );
    }
  });
}
