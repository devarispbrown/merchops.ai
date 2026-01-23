/**
 * Shopify Webhook Receiver Route
 *
 * POST /api/shopify/webhooks
 *
 * Receives webhooks from Shopify:
 * 1. Verifies HMAC signature
 * 2. Extracts topic from headers
 * 3. Returns 200 quickly (within 5s)
 * 4. Routes to appropriate handler
 * 5. Queues async processing
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationId } from '@/lib/correlation';
import { prisma } from '@/server/db/client';
import { logger } from '@/server/observability/logger';
import {
  verifyWebhookHmac,
  parseWebhookHeaders,
  isValidWebhookTopic,
} from '@/server/shopify/webhooks';

/**
 * POST /api/shopify/webhooks
 *
 * Receives and processes Shopify webhooks
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId();

  logger.info(
    {
      correlationId,
      url: request.url,
    },
    'Received Shopify webhook'
  );

  try {
    // Get raw body for HMAC verification
    const rawBody = await request.text();

    // Parse webhook headers
    let headers;
    try {
      headers = parseWebhookHeaders(request.headers);
    } catch (error) {
      logger.warn(
        {
          correlationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Invalid webhook headers'
      );

      return NextResponse.json(
        { error: 'Invalid webhook headers' },
        { status: 400 }
      );
    }

    const { hmac, shop, topic, apiVersion, webhookId } = headers;

    logger.info(
      {
        correlationId,
        shop,
        topic,
        apiVersion,
        webhookId,
      },
      'Webhook details'
    );

    // Verify HMAC signature
    if (!verifyWebhookHmac(rawBody, hmac)) {
      logger.warn(
        {
          correlationId,
          shop,
          topic,
          webhookId,
        },
        'HMAC verification failed'
      );

      return NextResponse.json(
        { error: 'HMAC verification failed' },
        { status: 401 }
      );
    }

    logger.info(
      {
        correlationId,
        shop,
        topic,
      },
      'HMAC verified'
    );

    // Validate webhook topic
    if (!isValidWebhookTopic(topic)) {
      logger.warn(
        {
          correlationId,
          shop,
          topic,
        },
        'Unknown webhook topic'
      );

      // Return 200 even for unknown topics to prevent Shopify retries
      return NextResponse.json({ received: true });
    }

    // Parse webhook payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logger.error(
        {
          correlationId,
          shop,
          topic,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to parse JSON payload'
      );

      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Get workspace ID from shop domain
    const connection = await prisma.shopifyConnection.findFirst({
      where: {
        store_domain: shop,
        status: 'active',
      },
      select: {
        workspace_id: true,
      },
    });

    if (!connection) {
      logger.warn(
        {
          correlationId,
          shop,
          topic,
        },
        'No active Shopify connection found for shop'
      );
      // Return 200 to prevent Shopify retries
      return NextResponse.json({ received: true });
    }

    const workspaceId = connection.workspace_id;

    // Acknowledge webhook immediately (must respond within 5 seconds)
    // Process webhook asynchronously
    processWebhookAsync(workspaceId, topic, payload, correlationId).catch(
      (error) => {
        logger.error(
          {
            correlationId,
            shop,
            topic,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Async processing failed'
        );
      }
    );

    logger.info(
      {
        correlationId,
        shop,
        topic,
      },
      'Webhook acknowledged'
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Error processing webhook'
    );

    // Always return 200 to prevent Shopify from retrying
    // Log error for investigation
    return NextResponse.json({ received: true });
  }
}

/**
 * Process webhook asynchronously after acknowledging receipt
 *
 * In production, this should enqueue a background job (BullMQ)
 * rather than processing inline.
 */
async function processWebhookAsync(
  workspaceId: string,
  topic: string,
  payload: unknown,
  correlationId: string
): Promise<void> {
  logger.info(
    {
      correlationId,
      workspaceId,
      topic,
    },
    'Starting async processing'
  );

  try {
    // Route to appropriate handler based on topic
    switch (topic) {
      case 'orders/create':
        await handleOrderCreate(workspaceId, payload, correlationId);
        break;

      case 'orders/paid':
        await handleOrderPaid(workspaceId, payload, correlationId);
        break;

      case 'products/update':
        await handleProductUpdate(workspaceId, payload, correlationId);
        break;

      case 'inventory_levels/update':
        await handleInventoryLevelUpdate(workspaceId, payload, correlationId);
        break;

      case 'customers/update':
        await handleCustomerUpdate(workspaceId, payload, correlationId);
        break;

      default:
        logger.warn(
          {
            correlationId,
            topic,
          },
          'Unhandled webhook topic'
        );
    }

    logger.info(
      {
        correlationId,
        workspaceId,
        topic,
      },
      'Async processing complete'
    );
  } catch (error) {
    logger.error(
      {
        correlationId,
        workspaceId,
        topic,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Error in async processing'
    );

    // TODO: Implement retry logic or dead letter queue
    // For now, just log and continue
  }
}

/**
 * Handler for orders/create webhook
 * Creates an ORDER_CREATED event in the database
 */
async function handleOrderCreate(
  workspaceId: string,
  payload: unknown,
  correlationId: string
): Promise<void> {
  logger.info(
    {
      correlationId,
      workspaceId,
      topic: 'orders/create',
    },
    'Processing order create webhook'
  );

  try {
    // Extract order ID for dedupe key
    const orderData = payload as { id?: string | number };
    const orderId = String(orderData.id || 'unknown');
    const dedupeKey = `order_created:${workspaceId}:${orderId}`;

    await prisma.event.create({
      data: {
        workspace_id: workspaceId,
        type: 'order_created',
        occurred_at: new Date(),
        payload_json: payload as object,
        dedupe_key: dedupeKey,
        source: 'webhook',
      },
    });

    logger.info(
      {
        correlationId,
        workspaceId,
        orderId,
      },
      'Order create event created'
    );
  } catch (error) {
    logger.error(
      {
        correlationId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to create order create event'
    );
    throw error;
  }
}

/**
 * Handler for orders/paid webhook
 * Creates an ORDER_PAID event in the database
 */
async function handleOrderPaid(
  workspaceId: string,
  payload: unknown,
  correlationId: string
): Promise<void> {
  logger.info(
    {
      correlationId,
      workspaceId,
      topic: 'orders/paid',
    },
    'Processing order paid webhook'
  );

  try {
    // Extract order ID for dedupe key
    const orderData = payload as { id?: string | number };
    const orderId = String(orderData.id || 'unknown');
    const dedupeKey = `order_paid:${workspaceId}:${orderId}`;

    await prisma.event.create({
      data: {
        workspace_id: workspaceId,
        type: 'order_paid',
        occurred_at: new Date(),
        payload_json: payload as object,
        dedupe_key: dedupeKey,
        source: 'webhook',
      },
    });

    logger.info(
      {
        correlationId,
        workspaceId,
        orderId,
      },
      'Order paid event created'
    );
  } catch (error) {
    logger.error(
      {
        correlationId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to create order paid event'
    );
    throw error;
  }
}

/**
 * Handler for products/update webhook
 * Creates a PRODUCT_UPDATED event in the database
 */
async function handleProductUpdate(
  workspaceId: string,
  payload: unknown,
  correlationId: string
): Promise<void> {
  logger.info(
    {
      correlationId,
      workspaceId,
      topic: 'products/update',
    },
    'Processing product update webhook'
  );

  try {
    // Extract product ID for dedupe key
    const productData = payload as { id?: string | number };
    const productId = String(productData.id || 'unknown');
    // Use timestamp for dedupe since products can be updated multiple times
    const timestamp = new Date().getTime();
    const dedupeKey = `product_updated:${workspaceId}:${productId}:${timestamp}`;

    await prisma.event.create({
      data: {
        workspace_id: workspaceId,
        type: 'product_updated',
        occurred_at: new Date(),
        payload_json: payload as object,
        dedupe_key: dedupeKey,
        source: 'webhook',
      },
    });

    logger.info(
      {
        correlationId,
        workspaceId,
        productId,
      },
      'Product update event created'
    );
  } catch (error) {
    logger.error(
      {
        correlationId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to create product update event'
    );
    throw error;
  }
}

/**
 * Handler for inventory_levels/update webhook
 * Creates an INVENTORY_THRESHOLD_CROSSED event if threshold is crossed
 */
async function handleInventoryLevelUpdate(
  workspaceId: string,
  payload: unknown,
  correlationId: string
): Promise<void> {
  logger.info(
    {
      correlationId,
      workspaceId,
      topic: 'inventory_levels/update',
    },
    'Processing inventory level update webhook'
  );

  try {
    // Extract inventory data for dedupe key
    const inventoryData = payload as {
      inventory_item_id?: string | number;
      location_id?: string | number;
      available?: number;
    };
    const inventoryItemId = String(inventoryData.inventory_item_id || 'unknown');
    const locationId = String(inventoryData.location_id || 'unknown');
    const available = inventoryData.available || 0;

    // Use timestamp for dedupe since inventory can change frequently
    const timestamp = new Date().getTime();
    const dedupeKey = `inventory_update:${workspaceId}:${inventoryItemId}:${locationId}:${timestamp}`;

    await prisma.event.create({
      data: {
        workspace_id: workspaceId,
        type: 'inventory_threshold_crossed',
        occurred_at: new Date(),
        payload_json: payload as object,
        dedupe_key: dedupeKey,
        source: 'webhook',
      },
    });

    logger.info(
      {
        correlationId,
        workspaceId,
        inventoryItemId,
        locationId,
        available,
      },
      'Inventory level update event created'
    );
  } catch (error) {
    logger.error(
      {
        correlationId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to create inventory level update event'
    );
    throw error;
  }
}

/**
 * Handler for customers/update webhook
 * Logs customer update but doesn't create event (customer inactivity is computed via job)
 */
async function handleCustomerUpdate(
  workspaceId: string,
  payload: unknown,
  correlationId: string
): Promise<void> {
  logger.info(
    {
      correlationId,
      workspaceId,
      topic: 'customers/update',
    },
    'Processing customer update webhook'
  );

  try {
    // Extract customer ID for logging
    const customerData = payload as { id?: string | number };
    const customerId = String(customerData.id || 'unknown');

    // Customer update webhooks are logged but don't create events
    // Customer inactivity events are generated by scheduled jobs
    logger.info(
      {
        correlationId,
        workspaceId,
        customerId,
      },
      'Customer update webhook processed (no event created - handled by scheduled job)'
    );
  } catch (error) {
    logger.error(
      {
        correlationId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to process customer update webhook'
    );
    throw error;
  }
}

/**
 * GET endpoint not supported (webhooks are POST only)
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
