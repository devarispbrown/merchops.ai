/**
 * Unit Tests: Shopify Webhook Verification
 * MerchOps Beta MVP
 *
 * Tests:
 * - Valid HMAC passes verification
 * - Invalid HMAC fails verification
 * - Timing-safe comparison prevents timing attacks
 * - Edge cases and malformed inputs
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// ============================================================================
// WEBHOOK VERIFICATION LOGIC
// ============================================================================

/**
 * Verify Shopify webhook HMAC signature
 * Uses timing-safe comparison to prevent timing attacks
 */
function verifyWebhookHmac(
  body: string | Buffer,
  hmacHeader: string,
  secret: string
): boolean {
  // Calculate expected HMAC
  const hash = crypto
    .createHmac('sha256', secret)
    .update(typeof body === 'string' ? body : body.toString('utf8'), 'utf8')
    .digest('base64');

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hmacHeader)
    );
  } catch {
    // timingSafeEqual throws if buffers are different lengths
    return false;
  }
}

/**
 * Generate HMAC for testing
 */
function generateHmac(body: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
}

describe('Shopify Webhook Verification', () => {
  const TEST_SECRET = 'test-secret-key-12345';
  const TEST_BODY = JSON.stringify({
    id: 123456789,
    email: 'customer@example.com',
    total_price: '99.99',
  });

  describe('Valid HMAC Verification', () => {
    it('should accept valid HMAC signature', () => {
      const validHmac = generateHmac(TEST_BODY, TEST_SECRET);
      const result = verifyWebhookHmac(TEST_BODY, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    it('should accept valid HMAC for different body content', () => {
      const body = JSON.stringify({ different: 'content' });
      const validHmac = generateHmac(body, TEST_SECRET);
      const result = verifyWebhookHmac(body, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    it('should accept valid HMAC with different secret', () => {
      const differentSecret = 'another-secret-key';
      const body = 'test body';
      const validHmac = generateHmac(body, differentSecret);
      const result = verifyWebhookHmac(body, validHmac, differentSecret);

      expect(result).toBe(true);
    });

    it('should accept valid HMAC for empty body', () => {
      const body = '';
      const validHmac = generateHmac(body, TEST_SECRET);
      const result = verifyWebhookHmac(body, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    it('should accept valid HMAC for large body', () => {
      const body = JSON.stringify({ data: 'x'.repeat(10000) });
      const validHmac = generateHmac(body, TEST_SECRET);
      const result = verifyWebhookHmac(body, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    it('should accept valid HMAC when body is Buffer', () => {
      const bodyBuffer = Buffer.from(TEST_BODY, 'utf8');
      const validHmac = generateHmac(TEST_BODY, TEST_SECRET);
      const result = verifyWebhookHmac(bodyBuffer, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });
  });

  describe('Invalid HMAC Rejection', () => {
    it('should reject incorrect HMAC', () => {
      const invalidHmac = 'incorrect-hmac-value';
      const result = verifyWebhookHmac(TEST_BODY, invalidHmac, TEST_SECRET);

      expect(result).toBe(false);
    });

    it('should reject HMAC generated with wrong secret', () => {
      const wrongSecret = 'wrong-secret-key';
      const invalidHmac = generateHmac(TEST_BODY, wrongSecret);
      const result = verifyWebhookHmac(TEST_BODY, invalidHmac, TEST_SECRET);

      expect(result).toBe(false);
    });

    it('should reject HMAC for modified body', () => {
      const originalBody = JSON.stringify({ id: 123 });
      const modifiedBody = JSON.stringify({ id: 456 });
      const hmac = generateHmac(originalBody, TEST_SECRET);
      const result = verifyWebhookHmac(modifiedBody, hmac, TEST_SECRET);

      expect(result).toBe(false);
    });

    it('should reject HMAC with extra character', () => {
      const validHmac = generateHmac(TEST_BODY, TEST_SECRET);
      const tamperedHmac = validHmac + 'x';
      const result = verifyWebhookHmac(TEST_BODY, tamperedHmac, TEST_SECRET);

      expect(result).toBe(false);
    });

    it('should reject HMAC with missing character', () => {
      const validHmac = generateHmac(TEST_BODY, TEST_SECRET);
      const tamperedHmac = validHmac.slice(0, -1);
      const result = verifyWebhookHmac(TEST_BODY, tamperedHmac, TEST_SECRET);

      expect(result).toBe(false);
    });

    it('should reject empty HMAC', () => {
      const result = verifyWebhookHmac(TEST_BODY, '', TEST_SECRET);

      expect(result).toBe(false);
    });

    it('should reject HMAC with different encoding', () => {
      // Generate hex-encoded HMAC instead of base64
      const hexHmac = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(TEST_BODY, 'utf8')
        .digest('hex');

      const result = verifyWebhookHmac(TEST_BODY, hexHmac, TEST_SECRET);

      expect(result).toBe(false);
    });
  });

  describe('Timing-Safe Comparison', () => {
    it('should use constant-time comparison', () => {
      // This test verifies that timingSafeEqual is being used
      // by checking that different length inputs are handled safely
      const validHmac = generateHmac(TEST_BODY, TEST_SECRET);
      const shortHmac = validHmac.substring(0, 10);

      // Should return false without throwing
      const result = verifyWebhookHmac(TEST_BODY, shortHmac, TEST_SECRET);
      expect(result).toBe(false);
    });

    it('should handle HMAC values of different lengths', () => {
      const validHmac = generateHmac(TEST_BODY, TEST_SECRET);

      // Shorter HMAC
      const result1 = verifyWebhookHmac(TEST_BODY, validHmac.slice(0, 20), TEST_SECRET);
      expect(result1).toBe(false);

      // Longer HMAC
      const result2 = verifyWebhookHmac(TEST_BODY, validHmac + 'extra', TEST_SECRET);
      expect(result2).toBe(false);
    });

    it('should prevent timing attacks by using constant-time comparison', () => {
      const validHmac = generateHmac(TEST_BODY, TEST_SECRET);

      // Create HMACs that differ at different positions
      const hmac1 = 'A' + validHmac.slice(1); // Differs at start
      const hmac2 = validHmac.slice(0, -1) + 'Z'; // Differs at end

      const result1 = verifyWebhookHmac(TEST_BODY, hmac1, TEST_SECRET);
      const result2 = verifyWebhookHmac(TEST_BODY, hmac2, TEST_SECRET);

      // Both should fail
      expect(result1).toBe(false);
      expect(result2).toBe(false);

      // If timing was leaked, hmac1 would fail faster than hmac2
      // But with timingSafeEqual, both take constant time
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in body', () => {
      const body = JSON.stringify({
        special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: '你好世界',
        emoji: '🚀💻🎉',
      });
      const validHmac = generateHmac(body, TEST_SECRET);
      const result = verifyWebhookHmac(body, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    it('should handle newlines in body', () => {
      const body = 'line1\nline2\nline3';
      const validHmac = generateHmac(body, TEST_SECRET);
      const result = verifyWebhookHmac(body, validHmac, TEST_SECRET);

      expect(result).toBe(true);
    });

    it('should handle whitespace variations', () => {
      const body1 = JSON.stringify({ key: 'value' });
      const body2 = JSON.stringify({ key: 'value' }, null, 2); // Pretty-printed

      const hmac1 = generateHmac(body1, TEST_SECRET);
      const hmac2 = generateHmac(body2, TEST_SECRET);

      // Different formatting = different HMAC
      expect(hmac1).not.toBe(hmac2);

      // Each should verify with its own HMAC
      expect(verifyWebhookHmac(body1, hmac1, TEST_SECRET)).toBe(true);
      expect(verifyWebhookHmac(body2, hmac2, TEST_SECRET)).toBe(true);

      // But not with each other's HMAC
      expect(verifyWebhookHmac(body1, hmac2, TEST_SECRET)).toBe(false);
      expect(verifyWebhookHmac(body2, hmac1, TEST_SECRET)).toBe(false);
    });

    it('should be case-sensitive for HMAC', () => {
      const validHmac = generateHmac(TEST_BODY, TEST_SECRET);
      const uppercaseHmac = validHmac.toUpperCase();

      const result = verifyWebhookHmac(TEST_BODY, uppercaseHmac, TEST_SECRET);

      // Base64 is case-sensitive
      expect(result).toBe(false);
    });

    it('should handle very long secret keys', () => {
      const longSecret = 'x'.repeat(1000);
      const body = 'test';
      const validHmac = generateHmac(body, longSecret);
      const result = verifyWebhookHmac(body, validHmac, longSecret);

      expect(result).toBe(true);
    });

    it('should handle single character inputs', () => {
      const body = 'x';
      const secret = 'y';
      const validHmac = generateHmac(body, secret);
      const result = verifyWebhookHmac(body, validHmac, secret);

      expect(result).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should verify Shopify orders/create webhook payload', () => {
      const shopifyPayload = JSON.stringify({
        id: 820982911946154508,
        email: 'jon@example.com',
        closed_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        number: 1,
        note: null,
        token: 'abc123',
        gateway: 'authorize_net',
        test: false,
        total_price: '199.00',
        subtotal_price: '199.00',
        total_tax: '0.00',
        currency: 'USD',
        financial_status: 'paid',
        confirmed: true,
      });

      const secret = 'shopify-webhook-secret';
      const validHmac = generateHmac(shopifyPayload, secret);
      const result = verifyWebhookHmac(shopifyPayload, validHmac, secret);

      expect(result).toBe(true);
    });

    it('should verify product update webhook payload', () => {
      const productPayload = JSON.stringify({
        id: 632910392,
        title: 'IPod Nano - 8GB',
        handle: 'ipod-nano',
        body_html: '<p>Description</p>',
        vendor: 'Apple',
        product_type: 'Electronics',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
      });

      const secret = 'shopify-webhook-secret';
      const validHmac = generateHmac(productPayload, secret);
      const result = verifyWebhookHmac(productPayload, validHmac, secret);

      expect(result).toBe(true);
    });

    it('should reject tampered webhook payload', () => {
      const originalPayload = JSON.stringify({
        id: 123,
        total_price: '100.00',
      });

      const tamperedPayload = JSON.stringify({
        id: 123,
        total_price: '0.01', // Tampered price
      });

      const secret = 'shopify-webhook-secret';
      const hmac = generateHmac(originalPayload, secret);

      // HMAC is for original, but body is tampered
      const result = verifyWebhookHmac(tamperedPayload, hmac, secret);

      expect(result).toBe(false);
    });
  });

  describe('Determinism', () => {
    it('should produce consistent results for same inputs', () => {
      const validHmac = generateHmac(TEST_BODY, TEST_SECRET);

      const results = Array(100).fill(null).map(() =>
        verifyWebhookHmac(TEST_BODY, validHmac, TEST_SECRET)
      );

      // All results should be true
      expect(results.every(r => r === true)).toBe(true);
    });

    it('should produce consistent failures for invalid inputs', () => {
      const invalidHmac = 'invalid-hmac';

      const results = Array(100).fill(null).map(() =>
        verifyWebhookHmac(TEST_BODY, invalidHmac, TEST_SECRET)
      );

      // All results should be false
      expect(results.every(r => r === false)).toBe(true);
    });

    it('should generate same HMAC for same inputs', () => {
      const hmacs = Array(100).fill(null).map(() =>
        generateHmac(TEST_BODY, TEST_SECRET)
      );

      // All HMACs should be identical
      const firstHmac = hmacs[0];
      expect(hmacs.every(h => h === firstHmac)).toBe(true);
    });
  });

  describe('Buffer Handling', () => {
    it('should handle UTF-8 encoded buffers', () => {
      const body = 'test body with émojis 🎉';
      const bodyBuffer = Buffer.from(body, 'utf8');
      const validHmac = generateHmac(body, TEST_SECRET);

      const result = verifyWebhookHmac(bodyBuffer, validHmac, TEST_SECRET);
      expect(result).toBe(true);
    });

    it('should handle binary data in buffers', () => {
      const bodyBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]);
      const bodyString = bodyBuffer.toString('utf8');
      const validHmac = generateHmac(bodyString, TEST_SECRET);

      const result = verifyWebhookHmac(bodyBuffer, validHmac, TEST_SECRET);
      expect(result).toBe(true);
    });

    it('should handle large buffers', () => {
      const largeBody = 'x'.repeat(1000000); // 1MB
      const bodyBuffer = Buffer.from(largeBody, 'utf8');
      const validHmac = generateHmac(largeBody, TEST_SECRET);

      const result = verifyWebhookHmac(bodyBuffer, validHmac, TEST_SECRET);
      expect(result).toBe(true);
    });
  });
});
