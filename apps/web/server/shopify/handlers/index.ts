/**
 * Shopify Webhook Handlers Index
 *
 * Routes incoming webhooks to appropriate handlers based on topic.
 * Provides unified error handling and logging for all webhook processing.
 */

import crypto from 'crypto';
import { handleOrderCreated, handleOrderPaid } from './orders';
import { handleProductUpdated } from './products';
import { handleInventoryLevelUpdated } from './inventory';
import { handleCustomerUpdated, calculateCustomerSegment } from './customers';
import { logger } from '../../observability/logger';

/**
 * Shopify webhook topics we support
 */
export enum ShopifyWebhookTopic {
  ORDERS_CREATE = 'orders/create',
  ORDERS_PAID = 'orders/paid',
  PRODUCTS_UPDATE = 'products/update',
  INVENTORY_LEVELS_UPDATE = 'inventory_levels/update',
  CUSTOMERS_UPDATE = 'customers/update',
}

/**
 * Webhook handler function type
 */
type WebhookHandler = (
  payload: unknown,
  workspaceId: string,
  correlationId: string
) => Promise<void>;

/**
 * Map of webhook topics to their handlers
 */
const webhookHandlers: Record<string, WebhookHandler> = {
  [ShopifyWebhookTopic.ORDERS_CREATE]: handleOrderCreated,
  [ShopifyWebhookTopic.ORDERS_PAID]: handleOrderPaid,
  [ShopifyWebhookTopic.PRODUCTS_UPDATE]: handleProductUpdated,
  [ShopifyWebhookTopic.INVENTORY_LEVELS_UPDATE]: handleInventoryLevelUpdated,
  [ShopifyWebhookTopic.CUSTOMERS_UPDATE]: handleCustomerUpdated,
};

/**
 * Main webhook router
 * Routes webhook to appropriate handler based on topic
 */
export async function handleShopifyWebhook(params: {
  topic: string;
  payload: unknown;
  workspaceId: string;
  correlationId?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const {
    topic,
    payload,
    workspaceId,
    correlationId = crypto.randomUUID(),
  } = params;

  logger.info({
    correlationId,
    workspaceId,
    topic,
  }, 'Routing Shopify webhook');

  try {
    // Find handler for this topic
    const handler = webhookHandlers[topic];

    if (!handler) {
      logger.warn({
        correlationId,
        workspaceId,
        topic,
        supportedTopics: Object.keys(webhookHandlers),
      }, 'Unsupported webhook topic');

      return {
        success: false,
        error: `Unsupported webhook topic: ${topic}`,
      };
    }

    // Execute handler
    await handler(payload, workspaceId, correlationId);

    logger.info({
      correlationId,
      workspaceId,
      topic,
    }, 'Webhook processed successfully');

    return { success: true };
  } catch (error) {
    logger.error({
      correlationId,
      workspaceId,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Error processing webhook');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Wrapper with error boundary for webhook processing
 * Ensures errors don't crash the webhook receiver
 */
export async function processWebhookSafely(params: {
  topic: string;
  payload: unknown;
  workspaceId: string;
  correlationId?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    return await handleShopifyWebhook(params);
  } catch (error) {
    // Catch any unhandled errors
    logger.error({
      correlationId: params.correlationId,
      workspaceId: params.workspaceId,
      topic: params.topic,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Unhandled error in webhook processing');

    return {
      success: false,
      error: 'Internal server error',
    };
  }
}

/**
 * Get list of supported webhook topics
 * Useful for registering webhooks with Shopify
 */
export function getSupportedWebhookTopics(): string[] {
  return Object.values(ShopifyWebhookTopic);
}

/**
 * Check if a webhook topic is supported
 */
export function isWebhookTopicSupported(topic: string): boolean {
  return topic in webhookHandlers;
}

// Re-export handlers for direct use if needed
export {
  handleOrderCreated,
  handleOrderPaid,
  handleProductUpdated,
  handleInventoryLevelUpdated,
  handleCustomerUpdated,
  calculateCustomerSegment,
};
