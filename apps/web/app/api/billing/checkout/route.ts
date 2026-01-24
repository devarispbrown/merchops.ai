/**
 * Billing Checkout API Route
 *
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for subscription upgrades
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
import { getSubscription, createCheckoutSession as createStripeCheckout } from "@/server/billing";
import { logger } from "@/server/observability/logger";

// Request body schema
const checkoutRequestSchema = z.object({
  priceId: z.string().min(1, "Price ID is required"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
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
        logger.warn(
          { correlationId },
          "Unauthorized checkout session request"
        );
        return NextResponse.json(
          { error: "Unauthorized" },
          {
            status: 401,
            headers: { "X-Correlation-ID": correlationId },
          }
        );
      }

      const workspaceId = session.user.workspaceId;

      // Parse and validate request body
      let body;
      try {
        body = await request.json();
      } catch (error) {
        logger.warn(
          { correlationId, error: error instanceof Error ? error.message : "Unknown error" },
          "Invalid JSON in checkout request"
        );
        return NextResponse.json(
          { error: "Invalid request body" },
          {
            status: 400,
            headers: { "X-Correlation-ID": correlationId },
          }
        );
      }

      const validated = checkoutRequestSchema.parse(body);

      logger.info(
        {
          correlationId,
          workspaceId,
          priceId: validated.priceId,
        },
        "Creating checkout session"
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

      // Default URLs if not provided
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const successUrl = validated.successUrl || `${baseUrl}/billing/success`;
      const cancelUrl = validated.cancelUrl || `${baseUrl}/billing`;

      // Create checkout session
      const checkoutSession = await createStripeCheckout(
        subscription.stripe_customer_id,
        validated.priceId,
        successUrl,
        cancelUrl,
        { workspace_id: workspaceId }
      );

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          sessionId: checkoutSession.id,
          durationMs,
        },
        "Checkout session created successfully"
      );

      return NextResponse.json(
        {
          url: checkoutSession.url,
          sessionId: checkoutSession.id,
        },
        {
          status: 200,
          headers: { "X-Correlation-ID": correlationId },
        }
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Validation errors
      if (error instanceof z.ZodError) {
        logger.warn(
          { correlationId, errors: error.errors, durationMs },
          "Invalid checkout request parameters"
        );
        return NextResponse.json(
          {
            error: "Invalid request parameters",
            details: error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          {
            status: 400,
            headers: { "X-Correlation-ID": correlationId },
          }
        );
      }

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
        "Error creating checkout session"
      );

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An error occurred while creating checkout session",
        },
        {
          status: 500,
          headers: { "X-Correlation-ID": correlationId },
        }
      );
    }
  });
}
