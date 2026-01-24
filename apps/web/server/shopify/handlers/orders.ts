/**
 * Order Webhook Handlers
 *
 * Processes order-related webhooks from Shopify:
 * - orders/create: New order placed
 * - orders/paid: Order payment confirmed
 */

import { z } from 'zod';
import { logger } from '../../observability/logger';
import { getEventComputeQueue } from '../../jobs/queues';

// Order webhook payload schema
const orderWebhookSchema = z.object({
  id: z.number(),
  email: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  number: z.number(),
  order_number: z.number(),
  total_price: z.string(),
  subtotal_price: z.string(),
  total_tax: z.string(),
  currency: z.string(),
  financial_status: z.string(),
  fulfillment_status: z.string().nullable(),
  discount_codes: z.array(z.object({
    code: z.string(),
    amount: z.string(),
    type: z.string(),
  })).optional().default([]),
  customer: z.object({
    id: z.number(),
    email: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
  }).nullable(),
  line_items: z.array(z.object({
    id: z.number(),
    product_id: z.number().nullable(),
    variant_id: z.number().nullable(),
    title: z.string(),
    quantity: z.number(),
    price: z.string(),
  })),
});

export type OrderWebhook = z.infer<typeof orderWebhookSchema>;

/**
 * Handle orders/create webhook
 *
 * Triggers:
 * - Update customer activity
 * - Check for velocity spikes
 * - Update product performance metrics
 */
export async function handleOrderCreated(
  payload: unknown,
  workspaceId: string,
  correlationId: string = crypto.randomUUID()
): Promise<void> {
  logger.info({
    correlationId,
    workspaceId,
    handler: 'handleOrderCreated',
  }, 'Processing orders/create webhook');

  try {
    // Validate payload
    const order = orderWebhookSchema.parse(payload);

    logger.info({
      correlationId,
      workspaceId,
      orderId: order.id,
      orderNumber: order.order_number,
      totalPrice: order.total_price,
      lineItems: order.line_items.length,
      customerId: order.customer?.id,
    }, 'Order created webhook validated');

    // Queue event computation job
    // This will:
    // 1. Update customer activity metrics
    // 2. Check for velocity spike events
    // 3. Reset customer inactivity counters
    const queue = getEventComputeQueue();
    if (queue) {
      await queue.add(
        'compute-order-created-events',
        {
          workspaceId,
          orderId: order.id.toString(),
          orderData: order,
          webhookType: 'orders/create',
        },
        {
          jobId: `order-created-${workspaceId}-${order.id}-${Date.now()}`,
        }
      );
    } else {
      logger.warn({
        correlationId,
        workspaceId,
        orderId: order.id,
      }, 'Event computation skipped - Redis not configured');
    }

    logger.info({
      correlationId,
      workspaceId,
      orderId: order.id,
    }, 'Order created event computation queued');
  } catch (error) {
    logger.error({
      correlationId,
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Error processing orders/create webhook');

    throw error;
  }
}

/**
 * Handle orders/paid webhook
 *
 * Triggers:
 * - Update revenue metrics
 * - Track conversion from draft to paid
 * - Learning loop outcome calculation
 */
export async function handleOrderPaid(
  payload: unknown,
  workspaceId: string,
  correlationId: string = crypto.randomUUID()
): Promise<void> {
  logger.info({
    correlationId,
    workspaceId,
    handler: 'handleOrderPaid',
  }, 'Processing orders/paid webhook');

  try {
    // Validate payload
    const order = orderWebhookSchema.parse(payload);

    logger.info({
      correlationId,
      workspaceId,
      orderId: order.id,
      orderNumber: order.order_number,
      totalPrice: order.total_price,
      financialStatus: order.financial_status,
      discountCodes: order.discount_codes?.map(dc => dc.code),
    }, 'Order paid webhook validated');

    // Queue event computation job
    // This will:
    // 1. Update customer lifetime value
    // 2. Check if order resulted from a discount code (learning loop)
    // 3. Update revenue metrics
    const queue = getEventComputeQueue();
    if (queue) {
      await queue.add(
        'compute-order-paid-events',
        {
          workspaceId,
          orderId: order.id.toString(),
          orderData: order,
          webhookType: 'orders/paid',
        },
        {
          jobId: `order-paid-${workspaceId}-${order.id}-${Date.now()}`,
        }
      );

      logger.info({
        correlationId,
        workspaceId,
        orderId: order.id,
      }, 'Order paid event computation queued');
    } else {
      logger.warn({
        correlationId,
        workspaceId,
        orderId: order.id,
      }, 'Event computation skipped - Redis not configured');
    }
  } catch (error) {
    logger.error({
      correlationId,
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Error processing orders/paid webhook');

    throw error;
  }
}

// Import crypto for UUID generation
import crypto from 'crypto';
