/**
 * Product Webhook Handlers
 *
 * Processes product-related webhooks from Shopify:
 * - products/update: Product information changed
 */

import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '../../observability/logger';
import { eventComputeQueue } from '../../jobs/queues';

// Product webhook payload schema
const productWebhookSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  status: z.string(),
  vendor: z.string().optional(),
  product_type: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  variants: z.array(z.object({
    id: z.number(),
    product_id: z.number(),
    title: z.string(),
    price: z.string(),
    sku: z.string().optional(),
    inventory_quantity: z.number().optional(),
    inventory_management: z.string().nullable(),
    inventory_policy: z.string(),
  })),
  images: z.array(z.object({
    id: z.number(),
    product_id: z.number(),
    src: z.string(),
  })).optional(),
});

export type ProductWebhook = z.infer<typeof productWebhookSchema>;

/**
 * Handle products/update webhook
 *
 * Triggers:
 * - Update product cache
 * - Check for status changes (active/draft)
 * - Update pricing information
 * - Detect price changes
 */
export async function handleProductUpdated(
  payload: unknown,
  workspaceId: string,
  correlationId: string = crypto.randomUUID()
): Promise<void> {
  logger.info({
    correlationId,
    workspaceId,
    handler: 'handleProductUpdated',
  }, 'Processing products/update webhook');

  try {
    // Validate payload
    const product = productWebhookSchema.parse(payload);

    logger.info({
      correlationId,
      workspaceId,
      productId: product.id,
      title: product.title,
      status: product.status,
      variants: product.variants.length,
    }, 'Product updated webhook validated');

    // Queue event computation job
    // This will:
    // 1. Update product cache
    // 2. Detect status changes (e.g., paused by action execution)
    // 3. Detect significant price changes
    // 4. Check for action execution results
    await eventComputeQueue.add(
      'compute-product-updated-events',
      {
        workspaceId,
        productId: product.id.toString(),
        productData: product,
        webhookType: 'products/update',
      },
      {
        jobId: `product-updated-${workspaceId}-${product.id}-${Date.now()}`,
      }
    );

    logger.info({
      correlationId,
      workspaceId,
      productId: product.id,
    }, 'Product updated event computation queued');
  } catch (error) {
    logger.error({
      correlationId,
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Error processing products/update webhook');

    throw error;
  }
}
