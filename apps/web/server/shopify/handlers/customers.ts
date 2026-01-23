/**
 * Customer Webhook Handlers
 *
 * Processes customer-related webhooks from Shopify:
 * - customers/update: Customer information changed
 */

import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '../../observability/logger';
import { eventComputeQueue } from '../../jobs/queues';

// Customer webhook payload schema
const customerWebhookSchema = z.object({
  id: z.number(),
  email: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  orders_count: z.number(),
  state: z.string(),
  total_spent: z.string(),
  last_order_id: z.number().nullable(),
  note: z.string().nullable().optional(),
  verified_email: z.boolean().optional(),
  phone: z.string().nullable().optional(),
  tags: z.string().optional(),
  currency: z.string().optional(),
});

export type CustomerWebhook = z.infer<typeof customerWebhookSchema>;

/**
 * Handle customers/update webhook
 *
 * Triggers:
 * - Update customer cache
 * - Check for inactivity thresholds
 * - Update customer metrics
 */
export async function handleCustomerUpdated(
  payload: unknown,
  workspaceId: string,
  correlationId: string = crypto.randomUUID()
): Promise<void> {
  logger.info({
    correlationId,
    workspaceId,
    handler: 'handleCustomerUpdated',
  }, 'Processing customers/update webhook');

  try {
    // Validate payload
    const customer = customerWebhookSchema.parse(payload);

    logger.info({
      correlationId,
      workspaceId,
      customerId: customer.id,
      email: customer.email,
      ordersCount: customer.orders_count,
      totalSpent: customer.total_spent,
    }, 'Customer updated webhook validated');

    // Queue event computation job
    // This will:
    // 1. Update customer in cache
    // 2. Calculate days since last order
    // 3. Check for inactivity threshold events (30/60/90 days)
    // 4. Update customer lifetime value metrics
    await eventComputeQueue.add(
      'compute-customer-events',
      {
        workspaceId,
        customerId: customer.id.toString(),
        customerData: customer,
        webhookType: 'customers/update',
      },
      {
        jobId: `customer-updated-${workspaceId}-${customer.id}-${Date.now()}`,
      }
    );

    logger.info({
      correlationId,
      workspaceId,
      customerId: customer.id,
    }, 'Customer event computation queued');
  } catch (error) {
    logger.error({
      correlationId,
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Error processing customers/update webhook');

    throw error;
  }
}

/**
 * Calculate customer segment based on behavior
 * Used for win-back targeting
 */
export function calculateCustomerSegment(customer: CustomerWebhook): string {
  const ordersCount = customer.orders_count;
  const totalSpent = parseFloat(customer.total_spent);

  if (ordersCount === 0) {
    return 'new';
  }

  if (ordersCount === 1) {
    return 'one_time';
  }

  if (ordersCount >= 5 && totalSpent >= 500) {
    return 'vip';
  }

  if (ordersCount >= 2 && ordersCount < 5) {
    return 'repeat';
  }

  return 'regular';
}
