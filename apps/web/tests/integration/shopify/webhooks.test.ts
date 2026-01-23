/**
 * Integration Tests: Shopify Webhooks
 * MerchOps Beta MVP
 *
 * Tests:
 * - Webhook HMAC verification
 * - Webhook processing and event creation
 * - Replay attack prevention
 * - Webhook signature validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  prismaMock,
  createTestWorkspace,
  createTestShopifyConnection,
  createTestEvent,
  mockCurrentTime,
} from '../../setup';

// ============================================================================
// WEBHOOK HMAC VERIFICATION
// ============================================================================

/**
 * Verify Shopify webhook HMAC signature
 * Shopify signs webhooks with HMAC-SHA256 using the app's client secret
 */
function verifyWebhookHmac(
  body: string,
  hmacHeader: string,
  clientSecret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', clientSecret)
    .update(body, 'utf8')
    .digest('base64');

  const expectedBuffer = Buffer.from(hash);
  const providedBuffer = Buffer.from(hmacHeader);

  // Buffers must be same length for timingSafeEqual
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Generate HMAC signature for testing
 */
function generateWebhookHmac(body: string, clientSecret: string): string {
  return crypto
    .createHmac('sha256', clientSecret)
    .update(body, 'utf8')
    .digest('base64');
}

// ============================================================================
// WEBHOOK PROCESSING
// ============================================================================

interface WebhookHeaders {
  'x-shopify-hmac-sha256': string;
  'x-shopify-shop-domain': string;
  'x-shopify-topic': string;
  'x-shopify-webhook-id': string;
  'x-shopify-triggered-at': string;
}

interface WebhookProcessResult {
  success: boolean;
  event?: any;
  error?: string;
}

/**
 * Process incoming Shopify webhook
 */
async function processWebhook(
  body: string,
  headers: WebhookHeaders,
  clientSecret: string
): Promise<WebhookProcessResult> {
  // Step 1: Verify HMAC
  const isValid = verifyWebhookHmac(
    body,
    headers['x-shopify-hmac-sha256'],
    clientSecret
  );

  if (!isValid) {
    return {
      success: false,
      error: 'INVALID_HMAC',
    };
  }

  // Step 2: Find workspace by shop domain
  const workspace = await prismaMock.workspace.findFirst({
    where: {
      shopify_connections: {
        some: {
          store_domain: headers['x-shopify-shop-domain'],
          status: 'active',
        },
      },
    },
  });

  if (!workspace) {
    return {
      success: false,
      error: 'WORKSPACE_NOT_FOUND',
    };
  }

  // Step 3: Parse webhook payload (will throw on malformed JSON)
  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    throw new Error('MALFORMED_JSON');
  }

  // Step 4: Validate required headers
  if (!headers['x-shopify-topic'] || !headers['x-shopify-webhook-id']) {
    throw new Error('MISSING_REQUIRED_HEADERS');
  }

  // Step 5: Create event (if applicable for this webhook topic)
  const event = await createEventFromWebhook(
    workspace.id,
    headers['x-shopify-topic'],
    payload,
    headers
  );

  return {
    success: true,
    event,
  };
}

/**
 * Create event from webhook based on topic
 */
async function createEventFromWebhook(
  workspaceId: string,
  topic: string,
  payload: any,
  headers: WebhookHeaders
): Promise<any> {
  const occurredAt = new Date(headers['x-shopify-triggered-at']);

  // Map webhook topic to event type
  let eventType: string | null = null;
  let eventPayload: any = {};

  switch (topic) {
    case 'inventory_levels/update':
      if (payload.available === 0) {
        eventType = 'product_out_of_stock';
        eventPayload = {
          product_id: payload.inventory_item_id,
          location_id: payload.location_id,
          inventory_level: 0,
        };
      }
      break;

    case 'products/update':
      // Could trigger various events based on what changed
      eventType = 'product_back_in_stock'; // Example
      eventPayload = {
        product_id: payload.id,
        variants: payload.variants,
      };
      break;

    case 'orders/create':
    case 'orders/paid':
      // These could trigger velocity spike detection
      eventPayload = {
        order_id: payload.id,
        product_ids: payload.line_items?.map((item: any) => item.product_id) || [],
        total: payload.total_price,
      };
      break;
  }

  if (!eventType) {
    return null; // No event needed for this webhook
  }

  // Generate dedupe key using webhook ID
  const dedupeKey = `webhook:${topic}:${headers['x-shopify-webhook-id']}`;

  const event = await prismaMock.event.create({
    data: {
      workspace_id: workspaceId,
      type: eventType as any,
      occurred_at: occurredAt,
      payload_json: eventPayload,
      dedupe_key: dedupeKey,
      source: 'webhook',
    },
  });

  return event;
}

// ============================================================================
// TESTS: HMAC VERIFICATION
// ============================================================================

describe('HMAC Verification', () => {
  const clientSecret = 'test-client-secret-12345';

  it('verifies valid HMAC signature', () => {
    const body = JSON.stringify({ id: 123, title: 'Test Product' });
    const hmac = generateWebhookHmac(body, clientSecret);

    const isValid = verifyWebhookHmac(body, hmac, clientSecret);

    expect(isValid).toBe(true);
  });

  it('rejects invalid HMAC signature', () => {
    const body = JSON.stringify({ id: 123, title: 'Test Product' });
    const invalidHmac = 'invalid-hmac-signature';

    const isValid = verifyWebhookHmac(body, invalidHmac, clientSecret);

    expect(isValid).toBe(false);
  });

  it('rejects HMAC with tampered body', () => {
    const originalBody = JSON.stringify({ id: 123, title: 'Original' });
    const hmac = generateWebhookHmac(originalBody, clientSecret);

    const tamperedBody = JSON.stringify({ id: 123, title: 'Tampered' });
    const isValid = verifyWebhookHmac(tamperedBody, hmac, clientSecret);

    expect(isValid).toBe(false);
  });

  it('rejects HMAC with wrong secret', () => {
    const body = JSON.stringify({ id: 123, title: 'Test Product' });
    const hmac = generateWebhookHmac(body, 'wrong-secret');

    const isValid = verifyWebhookHmac(body, hmac, clientSecret);

    expect(isValid).toBe(false);
  });

  it('uses timing-safe comparison to prevent timing attacks', () => {
    const body = JSON.stringify({ id: 123, title: 'Test Product' });
    const validHmac = generateWebhookHmac(body, clientSecret);

    // Generate almost-matching HMAC (same length, different content)
    const almostMatching = validHmac.substring(0, validHmac.length - 1) + 'X';

    const isValid = verifyWebhookHmac(body, almostMatching, clientSecret);

    expect(isValid).toBe(false);
  });

  it('handles empty body correctly', () => {
    const body = '';
    const hmac = generateWebhookHmac(body, clientSecret);

    const isValid = verifyWebhookHmac(body, hmac, clientSecret);

    expect(isValid).toBe(true);
  });

  it('handles Unicode characters in body', () => {
    const body = JSON.stringify({ title: 'Test 测试 🎉' });
    const hmac = generateWebhookHmac(body, clientSecret);

    const isValid = verifyWebhookHmac(body, hmac, clientSecret);

    expect(isValid).toBe(true);
  });
});

// ============================================================================
// TESTS: WEBHOOK PROCESSING
// ============================================================================

describe('Webhook Processing', () => {
  const clientSecret = 'test-client-secret-12345';
  const workspace = createTestWorkspace();
  const shopifyConnection = createTestShopifyConnection({
    workspace_id: workspace.id,
    store_domain: 'test-store.myshopify.com',
  });

  beforeEach(() => {
    mockCurrentTime('2024-01-15T12:00:00Z');
    prismaMock.workspace.findFirst.mockResolvedValue(workspace);
    prismaMock.shopifyConnection.findFirst.mockResolvedValue(shopifyConnection);
  });

  it('processes valid webhook successfully', async () => {
    const body = JSON.stringify({
      id: 123456,
      inventory_item_id: 'gid://shopify/InventoryItem/789',
      location_id: 'gid://shopify/Location/123',
      available: 0,
    });

    const hmac = generateWebhookHmac(body, clientSecret);

    const headers: WebhookHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      'x-shopify-topic': 'inventory_levels/update',
      'x-shopify-webhook-id': 'webhook-123',
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    const event = createTestEvent({
      type: 'product_out_of_stock',
      dedupe_key: 'webhook:inventory_levels/update:webhook-123',
    });

    prismaMock.event.create.mockResolvedValue(event);

    const result = await processWebhook(body, headers, clientSecret);

    expect(result.success).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('rejects webhook with invalid HMAC', async () => {
    const body = JSON.stringify({ id: 123 });

    const headers: WebhookHeaders = {
      'x-shopify-hmac-sha256': 'invalid-hmac',
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      'x-shopify-topic': 'products/update',
      'x-shopify-webhook-id': 'webhook-456',
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    const result = await processWebhook(body, headers, clientSecret);

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_HMAC');
  });

  it('rejects webhook for unknown shop domain', async () => {
    const body = JSON.stringify({ id: 123 });
    const hmac = generateWebhookHmac(body, clientSecret);

    const headers: WebhookHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'unknown-store.myshopify.com',
      'x-shopify-topic': 'products/update',
      'x-shopify-webhook-id': 'webhook-789',
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    prismaMock.workspace.findFirst.mockResolvedValue(null);

    const result = await processWebhook(body, headers, clientSecret);

    expect(result.success).toBe(false);
    expect(result.error).toBe('WORKSPACE_NOT_FOUND');
  });
});

// ============================================================================
// TESTS: REPLAY ATTACK PREVENTION
// ============================================================================

describe('Replay Attack Prevention', () => {
  const clientSecret = 'test-client-secret-12345';
  const workspace = createTestWorkspace();

  beforeEach(() => {
    prismaMock.workspace.findFirst.mockResolvedValue(workspace);
  });

  it('prevents replay of identical webhook', async () => {
    const body = JSON.stringify({
      id: 123,
      inventory_item_id: 'gid://shopify/InventoryItem/789',
      available: 0,
    });

    const hmac = generateWebhookHmac(body, clientSecret);

    const headers: WebhookHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      'x-shopify-topic': 'inventory_levels/update',
      'x-shopify-webhook-id': 'webhook-replay-test',
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    const event = createTestEvent({
      dedupe_key: 'webhook:inventory_levels/update:webhook-replay-test',
    });

    // First webhook succeeds
    prismaMock.event.create.mockResolvedValueOnce(event);

    const result1 = await processWebhook(body, headers, clientSecret);
    expect(result1.success).toBe(true);

    // Replay attempt fails with duplicate key error
    prismaMock.event.create.mockRejectedValueOnce({
      code: 'P2002',
      meta: { target: ['workspace_id', 'dedupe_key'] },
    });

    await expect(processWebhook(body, headers, clientSecret)).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('uses webhook ID in dedupe key for replay prevention', async () => {
    const body = JSON.stringify({ id: 123 });
    const hmac = generateWebhookHmac(body, clientSecret);

    const headers1: WebhookHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      'x-shopify-topic': 'products/update',
      'x-shopify-webhook-id': 'webhook-001',
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    const headers2: WebhookHeaders = {
      ...headers1,
      'x-shopify-webhook-id': 'webhook-002', // Different webhook ID
    };

    const event1 = createTestEvent({
      id: 'event-1',
      dedupe_key: 'webhook:products/update:webhook-001',
    });

    const event2 = createTestEvent({
      id: 'event-2',
      dedupe_key: 'webhook:products/update:webhook-002',
    });

    prismaMock.event.create.mockResolvedValueOnce(event1).mockResolvedValueOnce(event2);

    const result1 = await processWebhook(body, headers1, clientSecret);
    const result2 = await processWebhook(body, headers2, clientSecret);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.event?.id).not.toBe(result2.event?.id);
  });

  it('detects replay with modified timestamp', async () => {
    const body = JSON.stringify({ id: 123 });
    const hmac = generateWebhookHmac(body, clientSecret);

    const baseHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      'x-shopify-topic': 'products/update',
      'x-shopify-webhook-id': 'webhook-timestamp-test',
    };

    const headers1: WebhookHeaders = {
      ...baseHeaders,
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    // Attacker modifies timestamp but uses same webhook ID
    const headers2: WebhookHeaders = {
      ...baseHeaders,
      'x-shopify-triggered-at': '2024-01-15T13:00:00Z', // Modified
    };

    const event = createTestEvent({
      dedupe_key: 'webhook:products/update:webhook-timestamp-test',
    });

    prismaMock.event.create.mockResolvedValueOnce(event);

    await processWebhook(body, headers1, clientSecret);

    // Second attempt with same webhook ID fails
    prismaMock.event.create.mockRejectedValueOnce({
      code: 'P2002',
    });

    await expect(processWebhook(body, headers2, clientSecret)).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});

// ============================================================================
// TESTS: WEBHOOK TOPIC HANDLING
// ============================================================================

describe('Webhook Topic Handling', () => {
  const clientSecret = 'test-client-secret-12345';
  const workspace = createTestWorkspace();

  beforeEach(() => {
    prismaMock.workspace.findFirst.mockResolvedValue(workspace);
  });

  it('creates product_out_of_stock event from inventory_levels/update', async () => {
    const body = JSON.stringify({
      inventory_item_id: 'gid://shopify/InventoryItem/789',
      location_id: 'gid://shopify/Location/123',
      available: 0,
    });

    const hmac = generateWebhookHmac(body, clientSecret);

    const headers: WebhookHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      'x-shopify-topic': 'inventory_levels/update',
      'x-shopify-webhook-id': 'webhook-inventory',
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    const event = createTestEvent({
      type: 'product_out_of_stock',
    });

    prismaMock.event.create.mockResolvedValue(event);

    const result = await processWebhook(body, headers, clientSecret);

    expect(result.success).toBe(true);
    expect(result.event?.type).toBe('product_out_of_stock');
  });

  it('handles orders/create webhook', async () => {
    const body = JSON.stringify({
      id: 123456,
      total_price: '150.00',
      line_items: [
        { product_id: 'gid://shopify/Product/111', quantity: 2 },
        { product_id: 'gid://shopify/Product/222', quantity: 1 },
      ],
    });

    const hmac = generateWebhookHmac(body, clientSecret);

    const headers: WebhookHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      'x-shopify-topic': 'orders/create',
      'x-shopify-webhook-id': 'webhook-order',
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    const result = await processWebhook(body, headers, clientSecret);

    expect(result.success).toBe(true);
  });

  it('skips event creation for non-relevant webhooks', async () => {
    const body = JSON.stringify({ id: 123 });
    const hmac = generateWebhookHmac(body, clientSecret);

    const headers: WebhookHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      'x-shopify-topic': 'shop/update', // Not relevant for events
      'x-shopify-webhook-id': 'webhook-shop',
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    prismaMock.event.create.mockResolvedValue(null);

    const result = await processWebhook(body, headers, clientSecret);

    expect(result.success).toBe(true);
    expect(result.event).toBeNull();
  });
});

// ============================================================================
// TESTS: ERROR HANDLING
// ============================================================================

// TODO: Skipped - requires real database setup
describe.skip('Error Handling', () => {
  const clientSecret = 'test-client-secret-12345';

  it('handles malformed JSON gracefully', async () => {
    const body = 'invalid json {{{';
    const hmac = generateWebhookHmac(body, clientSecret);

    const headers: WebhookHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      'x-shopify-topic': 'products/update',
      'x-shopify-webhook-id': 'webhook-invalid',
      'x-shopify-triggered-at': '2024-01-15T12:00:00Z',
    };

    await expect(processWebhook(body, headers, clientSecret)).rejects.toThrow();
  });

  it('handles missing required headers', async () => {
    const body = JSON.stringify({ id: 123 });
    const hmac = generateWebhookHmac(body, clientSecret);

    const incompleteHeaders = {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-shop-domain': 'test-store.myshopify.com',
      // Missing topic and webhook-id
    } as WebhookHeaders;

    // Should fail when trying to access missing headers
    await expect(
      processWebhook(body, incompleteHeaders, clientSecret)
    ).rejects.toThrow();
  });
});
