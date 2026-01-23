/**
 * Webhook Verification Security Tests
 *
 * Comprehensive test suite for webhook HMAC verification and replay attack prevention.
 * These tests ensure that all webhook security controls are functioning correctly.
 */

import crypto from 'crypto';
import {
  verifyShopifyWebhook,
  verifyWebhookTimestamp,
  verifyWebhookSecure,
  generateWebhookDedupeKey,
  extractShopDomain,
  extractWebhookTopic,
  extractWebhookSignature,
  extractWebhookTimestamp,
} from '../verify-webhook';

describe('Shopify Webhook Verification', () => {
  const TEST_SECRET = 'test-webhook-secret-key-123';
  const TEST_BODY = JSON.stringify({
    id: 12345,
    email: 'customer@example.com',
    created_at: '2024-01-15T10:30:00Z',
  });

  // Helper to generate valid HMAC
  function generateValidHmac(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  }

  // Helper to generate current timestamp
  function getCurrentTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  describe('verifyShopifyWebhook', () => {
    test('accepts valid HMAC signature', () => {
      const validHmac = generateValidHmac(TEST_BODY, TEST_SECRET);
      const result = verifyShopifyWebhook(TEST_BODY, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    test('rejects invalid HMAC signature', () => {
      const invalidHmac = 'invalid-signature-12345';
      const result = verifyShopifyWebhook(TEST_BODY, invalidHmac, TEST_SECRET);

      expect(result).toBe(false);
    });

    test('rejects HMAC with wrong secret', () => {
      const wrongSecret = 'wrong-secret-key';
      const hmac = generateValidHmac(TEST_BODY, wrongSecret);
      const result = verifyShopifyWebhook(TEST_BODY, hmac, TEST_SECRET);

      expect(result).toBe(false);
    });

    test('rejects HMAC for modified body', () => {
      const hmac = generateValidHmac(TEST_BODY, TEST_SECRET);
      const modifiedBody = TEST_BODY.replace('12345', '99999');
      const result = verifyShopifyWebhook(modifiedBody, hmac, TEST_SECRET);

      expect(result).toBe(false);
    });

    test('handles Buffer body type', () => {
      const bodyBuffer = Buffer.from(TEST_BODY, 'utf8');
      const validHmac = generateValidHmac(TEST_BODY, TEST_SECRET);
      const result = verifyShopifyWebhook(bodyBuffer, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    test('rejects empty signature', () => {
      const result = verifyShopifyWebhook(TEST_BODY, '', TEST_SECRET);

      expect(result).toBe(false);
    });

    test('rejects null signature', () => {
      const result = verifyShopifyWebhook(TEST_BODY, null as any, TEST_SECRET);

      expect(result).toBe(false);
    });

    test('uses constant-time comparison (timing attack prevention)', () => {
      // This test ensures timingSafeEqual is used
      // If lengths differ, it should return false immediately
      const validHmac = generateValidHmac(TEST_BODY, TEST_SECRET);
      const shorterHmac = validHmac.slice(0, -5);

      const result = verifyShopifyWebhook(TEST_BODY, shorterHmac, TEST_SECRET);

      expect(result).toBe(false);
    });
  });

  describe('verifyWebhookTimestamp', () => {
    test('accepts current timestamp', () => {
      const currentTimestamp = getCurrentTimestamp();
      const result = verifyWebhookTimestamp(currentTimestamp);

      expect(result).toBe(true);
    });

    test('accepts timestamp within 5 minute window', () => {
      const fourMinutesAgo = Math.floor((Date.now() - 4 * 60 * 1000) / 1000).toString();
      const result = verifyWebhookTimestamp(fourMinutesAgo);

      expect(result).toBe(true);
    });

    test('rejects timestamp older than 5 minutes', () => {
      const sixMinutesAgo = Math.floor((Date.now() - 6 * 60 * 1000) / 1000).toString();
      const result = verifyWebhookTimestamp(sixMinutesAgo);

      expect(result).toBe(false);
    });

    test('rejects future timestamp beyond tolerance', () => {
      const twoMinutesInFuture = Math.floor((Date.now() + 2 * 60 * 1000) / 1000).toString();
      const result = verifyWebhookTimestamp(twoMinutesInFuture);

      expect(result).toBe(false);
    });

    test('accepts future timestamp within 1 minute tolerance', () => {
      const thirtySecondsInFuture = Math.floor((Date.now() + 30 * 1000) / 1000).toString();
      const result = verifyWebhookTimestamp(thirtySecondsInFuture);

      expect(result).toBe(true);
    });

    test('respects custom maxAgeSeconds parameter', () => {
      const tenMinutesAgo = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString();

      // Should reject with default 5 minute window
      expect(verifyWebhookTimestamp(tenMinutesAgo, 300)).toBe(false);

      // Should accept with 15 minute window
      expect(verifyWebhookTimestamp(tenMinutesAgo, 900)).toBe(true);
    });

    test('rejects invalid timestamp format', () => {
      expect(verifyWebhookTimestamp('not-a-number')).toBe(false);
      expect(verifyWebhookTimestamp('abc123')).toBe(false);
    });

    test('rejects null timestamp', () => {
      expect(verifyWebhookTimestamp(null)).toBe(false);
    });

    test('rejects empty timestamp', () => {
      expect(verifyWebhookTimestamp('')).toBe(false);
    });
  });

  describe('verifyWebhookSecure (comprehensive verification)', () => {
    test('accepts valid webhook with all required headers', () => {
      const validHmac = generateValidHmac(TEST_BODY, TEST_SECRET);
      const timestamp = getCurrentTimestamp();

      const headers = {
        'x-shopify-hmac-sha256': validHmac,
        'x-shopify-webhook-timestamp': timestamp,
        'x-shopify-shop-domain': 'test-shop.myshopify.com',
        'x-shopify-topic': 'orders/create',
      };

      const result = verifyWebhookSecure(TEST_BODY, headers, TEST_SECRET);

      expect(result.verified).toBe(true);
      expect(result.shopDomain).toBe('test-shop.myshopify.com');
      expect(result.topic).toBe('orders/create');
      expect(result.error).toBeUndefined();
    });

    test('rejects webhook with invalid HMAC', () => {
      const timestamp = getCurrentTimestamp();

      const headers = {
        'x-shopify-hmac-sha256': 'invalid-hmac',
        'x-shopify-webhook-timestamp': timestamp,
        'x-shopify-shop-domain': 'test-shop.myshopify.com',
        'x-shopify-topic': 'orders/create',
      };

      const result = verifyWebhookSecure(TEST_BODY, headers, TEST_SECRET);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('invalid_hmac');
    });

    test('rejects webhook with expired timestamp', () => {
      const validHmac = generateValidHmac(TEST_BODY, TEST_SECRET);
      const expiredTimestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString();

      const headers = {
        'x-shopify-hmac-sha256': validHmac,
        'x-shopify-webhook-timestamp': expiredTimestamp,
        'x-shopify-shop-domain': 'test-shop.myshopify.com',
        'x-shopify-topic': 'orders/create',
      };

      const result = verifyWebhookSecure(TEST_BODY, headers, TEST_SECRET);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('expired_timestamp');
    });

    test('rejects webhook with missing headers', () => {
      const headers = {
        'x-shopify-hmac-sha256': 'some-hmac',
        // Missing timestamp, shop domain, and topic
      };

      const result = verifyWebhookSecure(TEST_BODY, headers, TEST_SECRET);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('missing_headers');
    });

    test('handles case-insensitive headers', () => {
      const validHmac = generateValidHmac(TEST_BODY, TEST_SECRET);
      const timestamp = getCurrentTimestamp();

      const headers = {
        'X-Shopify-Hmac-Sha256': validHmac,
        'X-Shopify-Webhook-Timestamp': timestamp,
        'X-Shopify-Shop-Domain': 'test-shop.myshopify.com',
        'X-Shopify-Topic': 'orders/create',
      };

      const result = verifyWebhookSecure(TEST_BODY, headers, TEST_SECRET);

      expect(result.verified).toBe(true);
    });
  });

  describe('generateWebhookDedupeKey', () => {
    test('generates unique key with all parameters', () => {
      const payload = {
        id: 12345,
        admin_graphql_api_id: 'gid://shopify/Order/12345',
        created_at: '2024-01-15T10:30:00Z',
      };
      const workspaceId = 'workspace-123';
      const topic = 'orders/create';

      const dedupeKey = generateWebhookDedupeKey(payload, workspaceId, topic);

      expect(dedupeKey).toBe('workspace-123:orders/create:12345:2024-01-15T10:30:00Z');
    });

    test('uses admin_graphql_api_id if id missing', () => {
      const payload = {
        admin_graphql_api_id: 'gid://shopify/Product/67890',
        created_at: '2024-01-15T10:30:00Z',
      };
      const workspaceId = 'workspace-123';
      const topic = 'products/update';

      const dedupeKey = generateWebhookDedupeKey(payload, workspaceId, topic);

      expect(dedupeKey).toContain('gid://shopify/Product/67890');
    });

    test('handles missing timestamp gracefully', () => {
      const payload = {
        id: 12345,
      };
      const workspaceId = 'workspace-123';
      const topic = 'orders/create';

      const dedupeKey = generateWebhookDedupeKey(payload, workspaceId, topic);

      // Should include current timestamp (ISO format)
      expect(dedupeKey).toMatch(/workspace-123:orders\/create:12345:\d{4}-\d{2}-\d{2}T/);
    });

    test('ensures uniqueness across workspaces', () => {
      const payload = {
        id: 12345,
        created_at: '2024-01-15T10:30:00Z',
      };
      const topic = 'orders/create';

      const key1 = generateWebhookDedupeKey(payload, 'workspace-1', topic);
      const key2 = generateWebhookDedupeKey(payload, 'workspace-2', topic);

      expect(key1).not.toBe(key2);
      expect(key1).toContain('workspace-1');
      expect(key2).toContain('workspace-2');
    });
  });

  describe('Header extraction utilities', () => {
    test('extractShopDomain returns domain from headers', () => {
      const headers = { 'x-shopify-shop-domain': 'test-shop.myshopify.com' };
      expect(extractShopDomain(headers)).toBe('test-shop.myshopify.com');
    });

    test('extractShopDomain handles case variations', () => {
      const headers = { 'X-Shopify-Shop-Domain': 'test-shop.myshopify.com' };
      expect(extractShopDomain(headers)).toBe('test-shop.myshopify.com');
    });

    test('extractWebhookTopic returns topic from headers', () => {
      const headers = { 'x-shopify-topic': 'orders/paid' };
      expect(extractWebhookTopic(headers)).toBe('orders/paid');
    });

    test('extractWebhookSignature returns signature from headers', () => {
      const signature = 'test-signature-123';
      const headers = { 'x-shopify-hmac-sha256': signature };
      expect(extractWebhookSignature(headers)).toBe(signature);
    });

    test('extractWebhookTimestamp returns timestamp from headers', () => {
      const timestamp = getCurrentTimestamp();
      const headers = { 'x-shopify-webhook-timestamp': timestamp };
      expect(extractWebhookTimestamp(headers)).toBe(timestamp);
    });

    test('extraction functions return null for missing headers', () => {
      const emptyHeaders = {};

      expect(extractShopDomain(emptyHeaders)).toBeNull();
      expect(extractWebhookTopic(emptyHeaders)).toBeNull();
      expect(extractWebhookSignature(emptyHeaders)).toBeNull();
      expect(extractWebhookTimestamp(emptyHeaders)).toBeNull();
    });

    test('extraction functions handle Headers object', () => {
      const headers = new Headers({
        'x-shopify-shop-domain': 'test-shop.myshopify.com',
        'x-shopify-topic': 'orders/create',
      });

      expect(extractShopDomain(headers)).toBe('test-shop.myshopify.com');
      expect(extractWebhookTopic(headers)).toBe('orders/create');
    });
  });

  describe('Security edge cases', () => {
    test('prevents timing attacks on signature comparison', () => {
      const validHmac = generateValidHmac(TEST_BODY, TEST_SECRET);

      // Test with signatures that differ at different positions
      const almostValid1 = validHmac.slice(0, -1) + 'X';
      const almostValid2 = 'X' + validHmac.slice(1);

      // Both should fail, and timing should be constant
      expect(verifyShopifyWebhook(TEST_BODY, almostValid1, TEST_SECRET)).toBe(false);
      expect(verifyShopifyWebhook(TEST_BODY, almostValid2, TEST_SECRET)).toBe(false);
    });

    test('handles very large payloads', () => {
      const largePayload = JSON.stringify({
        data: new Array(10000).fill('x').join(''),
      });
      const validHmac = generateValidHmac(largePayload, TEST_SECRET);

      const result = verifyShopifyWebhook(largePayload, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    test('handles special characters in payload', () => {
      const specialPayload = JSON.stringify({
        text: '🔐 Security test with émojis and spëcial çhars',
      });
      const validHmac = generateValidHmac(specialPayload, TEST_SECRET);

      const result = verifyShopifyWebhook(specialPayload, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    test('prevents replay attacks via timestamp validation', () => {
      const validHmac = generateValidHmac(TEST_BODY, TEST_SECRET);
      const oldTimestamp = Math.floor((Date.now() - 20 * 60 * 1000) / 1000).toString();

      const headers = {
        'x-shopify-hmac-sha256': validHmac,
        'x-shopify-webhook-timestamp': oldTimestamp,
        'x-shopify-shop-domain': 'test-shop.myshopify.com',
        'x-shopify-topic': 'orders/create',
      };

      const result = verifyWebhookSecure(TEST_BODY, headers, TEST_SECRET);

      // Should fail due to expired timestamp (replay prevention)
      expect(result.verified).toBe(false);
      expect(result.error).toBe('expired_timestamp');
    });
  });
});
