/**
 * Inventory Webhook Handlers
 *
 * Processes inventory-related webhooks from Shopify:
 * - inventory_levels/update: Inventory level changed at a location
 */

import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '../../observability/logger';
import { getEventComputeQueue } from '../../jobs/queues';

// Inventory level webhook payload schema
const inventoryLevelWebhookSchema = z.object({
  inventory_item_id: z.number(),
  location_id: z.number(),
  available: z.number().nullable(),
  updated_at: z.string(),
});

export type InventoryLevelWebhook = z.infer<typeof inventoryLevelWebhookSchema>;

/**
 * Handle inventory_levels/update webhook
 *
 * Triggers:
 * - Update inventory cache
 * - Check for out-of-stock events
 * - Check for back-in-stock events
 * - Check for inventory threshold crossed events
 */
export async function handleInventoryLevelUpdated(
  payload: unknown,
  workspaceId: string,
  correlationId: string = crypto.randomUUID()
): Promise<void> {
  logger.info({
    correlationId,
    workspaceId,
    handler: 'handleInventoryLevelUpdated',
  }, 'Processing inventory_levels/update webhook');

  try {
    // Validate payload
    const inventoryLevel = inventoryLevelWebhookSchema.parse(payload);

    logger.info({
      correlationId,
      workspaceId,
      inventoryItemId: inventoryLevel.inventory_item_id,
      locationId: inventoryLevel.location_id,
      available: inventoryLevel.available,
    }, 'Inventory level updated webhook validated');

    // Queue event computation job
    // This will:
    // 1. Update inventory level in cache
    // 2. Fetch previous inventory level for comparison
    // 3. Detect out-of-stock events
    // 4. Detect back-in-stock events
    // 5. Detect inventory threshold crossed events
    const queue = getEventComputeQueue();
    if (queue) {
      await queue.add(
        'compute-inventory-events',
        {
          workspaceId,
          inventoryItemId: inventoryLevel.inventory_item_id.toString(),
          locationId: inventoryLevel.location_id.toString(),
          inventoryData: inventoryLevel,
          webhookType: 'inventory_levels/update',
        },
        {
          jobId: `inventory-updated-${workspaceId}-${inventoryLevel.inventory_item_id}-${inventoryLevel.location_id}-${Date.now()}`,
        }
      );

      logger.info({
        correlationId,
        workspaceId,
        inventoryItemId: inventoryLevel.inventory_item_id,
      }, 'Inventory level event computation queued');
    } else {
      logger.warn({
        correlationId,
        workspaceId,
        inventoryItemId: inventoryLevel.inventory_item_id,
      }, 'Event computation skipped - Redis not configured');
    }
  } catch (error) {
    logger.error({
      correlationId,
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Error processing inventory_levels/update webhook');

    throw error;
  }
}
