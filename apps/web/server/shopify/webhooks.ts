/**
 * Shopify Webhook Management
 *
 * Handles webhook registration, verification, and unregistration.
 * Ensures secure webhook handling with HMAC verification.
 */

import crypto from 'crypto';
import { SHOPIFY_CONFIG, type WebhookTopic } from './config';
import { ShopifyClient } from './client';

// Webhook registration response
interface WebhookRegistration {
  id: number;
  address: string;
  topic: string;
  format: string;
  created_at: string;
}

/**
 * Verify webhook HMAC signature
 *
 * @param body - Raw request body (string or Buffer)
 * @param hmacHeader - X-Shopify-Hmac-SHA256 header value
 * @returns True if HMAC is valid
 */
export function verifyWebhookHmac(
  body: string | Buffer,
  hmacHeader: string
): boolean {
  const { apiSecret } = SHOPIFY_CONFIG.credentials;

  // Calculate expected HMAC
  const bodyString = Buffer.isBuffer(body) ? body.toString('utf8') : body;
  const hash = crypto
    .createHmac('sha256', apiSecret)
    .update(bodyString, 'utf8')
    .digest('base64');

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hmacHeader)
    );
  } catch {
    return false;
  }
}

/**
 * Register all required webhooks for a shop
 *
 * @param shop - Shop domain
 * @param encryptedToken - Encrypted access token
 * @returns Array of registered webhook IDs
 */
export async function registerWebhooks(
  shop: string,
  encryptedToken: string,
  correlationId?: string
): Promise<number[]> {
  const client = new ShopifyClient(shop, encryptedToken);
  const webhookUrl = SHOPIFY_CONFIG.webhookUrl;
  const registeredIds: number[] = [];

  console.log('[Webhook Registration] Starting', {
    correlationId,
    shop,
    topics: SHOPIFY_CONFIG.WEBHOOK_TOPICS,
  });

  for (const topic of SHOPIFY_CONFIG.WEBHOOK_TOPICS) {
    try {
      const result = await registerWebhook(
        client,
        topic,
        webhookUrl,
        correlationId
      );

      registeredIds.push(result.id);

      console.log('[Webhook Registration] Success', {
        correlationId,
        topic,
        webhookId: result.id,
      });
    } catch (error) {
      console.error('[Webhook Registration] Failed', {
        correlationId,
        topic,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Continue registering other webhooks even if one fails
      // This is important for partial recovery scenarios
    }
  }

  console.log('[Webhook Registration] Complete', {
    correlationId,
    shop,
    registered: registeredIds.length,
    total: SHOPIFY_CONFIG.WEBHOOK_TOPICS.length,
  });

  return registeredIds;
}

/**
 * Register a single webhook
 */
async function registerWebhook(
  client: ShopifyClient,
  topic: WebhookTopic,
  address: string,
  correlationId?: string
): Promise<WebhookRegistration> {
  const response = await client['request']<{ webhook: WebhookRegistration }>(
    '/webhooks.json',
    {
      method: 'POST',
      body: {
        webhook: {
          topic,
          address,
          format: 'json',
        },
      },
      correlationId,
    }
  );

  return response.webhook;
}

/**
 * Get all registered webhooks for a shop
 *
 * @param shop - Shop domain
 * @param encryptedToken - Encrypted access token
 * @returns Array of webhook registrations
 */
export async function getWebhooks(
  shop: string,
  encryptedToken: string,
  correlationId?: string
): Promise<WebhookRegistration[]> {
  const client = new ShopifyClient(shop, encryptedToken);

  const response = await client['request']<{ webhooks: WebhookRegistration[] }>(
    '/webhooks.json',
    { correlationId }
  );

  return response.webhooks;
}

/**
 * Unregister all webhooks for a shop (on revoke/uninstall)
 *
 * @param shop - Shop domain
 * @param encryptedToken - Encrypted access token
 * @returns Number of webhooks deleted
 */
export async function unregisterAllWebhooks(
  shop: string,
  encryptedToken: string,
  correlationId?: string
): Promise<number> {
  console.log('[Webhook Unregistration] Starting', {
    correlationId,
    shop,
  });

  try {
    const webhooks = await getWebhooks(shop, encryptedToken, correlationId);

    let deletedCount = 0;

    for (const webhook of webhooks) {
      try {
        await unregisterWebhook(shop, encryptedToken, webhook.id, correlationId);
        deletedCount++;

        console.log('[Webhook Unregistration] Deleted', {
          correlationId,
          webhookId: webhook.id,
          topic: webhook.topic,
        });
      } catch (error) {
        console.error('[Webhook Unregistration] Failed', {
          correlationId,
          webhookId: webhook.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('[Webhook Unregistration] Complete', {
      correlationId,
      shop,
      deleted: deletedCount,
      total: webhooks.length,
    });

    return deletedCount;
  } catch (error) {
    console.error('[Webhook Unregistration] Error', {
      correlationId,
      shop,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Unregister a single webhook
 */
async function unregisterWebhook(
  shop: string,
  encryptedToken: string,
  webhookId: number,
  correlationId?: string
): Promise<void> {
  const client = new ShopifyClient(shop, encryptedToken);

  await client['request'](`/webhooks/${webhookId}.json`, {
    method: 'DELETE',
    correlationId,
  });
}

/**
 * Parse and validate webhook headers
 */
export function parseWebhookHeaders(headers: Headers): {
  hmac: string;
  shop: string;
  topic: string;
  apiVersion: string;
  webhookId: string;
} {
  const hmac = headers.get('x-shopify-hmac-sha256');
  const shop = headers.get('x-shopify-shop-domain');
  const topic = headers.get('x-shopify-topic');
  const apiVersion = headers.get('x-shopify-api-version');
  const webhookId = headers.get('x-shopify-webhook-id');

  if (!hmac || !shop || !topic || !apiVersion || !webhookId) {
    throw new Error('Missing required webhook headers');
  }

  return {
    hmac,
    shop,
    topic,
    apiVersion,
    webhookId,
  };
}

/**
 * Validate webhook topic is one we handle
 */
export function isValidWebhookTopic(topic: string): topic is WebhookTopic {
  return SHOPIFY_CONFIG.WEBHOOK_TOPICS.includes(topic as WebhookTopic);
}
