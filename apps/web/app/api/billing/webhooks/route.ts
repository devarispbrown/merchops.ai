/**
 * Stripe Webhook Receiver Route
 *
 * POST /api/billing/webhooks
 *
 * Receives webhooks from Stripe:
 * 1. Verifies webhook signature (HMAC)
 * 2. Extracts event type
 * 3. Returns 200 quickly
 * 4. Routes to appropriate handler
 * 5. Updates subscription status in database
 *
 * NO AUTHENTICATION - Uses Stripe signature verification instead
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorrelationId } from "@/lib/correlation";
import { verifyWebhookSignature, processWebhookEvent } from "@/server/billing";
import { logger } from "@/server/observability/logger";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId();

  logger.info(
    {
      correlationId,
      url: request.url,
    },
    "Received Stripe webhook"
  );

  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      logger.warn(
        {
          correlationId,
        },
        "Missing Stripe signature header"
      );

      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event;
    try {
      event = verifyWebhookSignature(body, signature);

      logger.info(
        {
          correlationId,
          eventType: event.type,
          eventId: event.id,
        },
        "Stripe webhook signature verified"
      );
    } catch (error) {
      logger.warn(
        {
          correlationId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Invalid Stripe webhook signature"
      );

      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Acknowledge webhook immediately (must respond quickly)
    // Process webhook asynchronously
    processWebhookAsync(event, correlationId).catch((error) => {
      logger.error(
        {
          correlationId,
          eventType: event.type,
          eventId: event.id,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Async webhook processing failed"
      );
    });

    logger.info(
      {
        correlationId,
        eventType: event.type,
        eventId: event.id,
      },
      "Webhook acknowledged"
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    logger.error(
      {
        correlationId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Error processing webhook"
    );

    // Always return 200 to prevent Stripe from retrying
    // Log error for investigation
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

/**
 * Process webhook asynchronously after acknowledging receipt
 */
async function processWebhookAsync(
  event: any,
  correlationId: string
): Promise<void> {
  logger.info(
    {
      correlationId,
      eventType: event.type,
      eventId: event.id,
    },
    "Starting async webhook processing"
  );

  try {
    // Delegate to webhook handler
    await processWebhookEvent(event);

    logger.info(
      {
        correlationId,
        eventType: event.type,
        eventId: event.id,
      },
      "Webhook processing complete"
    );
  } catch (error) {
    logger.error(
      {
        correlationId,
        eventType: event.type,
        eventId: event.id,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Error in async webhook processing"
    );

    // TODO: Implement retry logic or dead letter queue
    throw error;
  }
}

/**
 * GET endpoint not supported (webhooks are POST only)
 */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
