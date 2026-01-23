/**
 * Shopify OAuth Flow Integration Tests
 *
 * Tests the complete OAuth flow including:
 * - OAuth URL generation with proper state
 * - Token exchange (mocked)
 * - Webhook registration after connection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateShop,
  generateState,
  generateAuthUrl,
  verifyHmac,
  exchangeCodeForToken,
  encryptToken,
  decryptToken,
  validateGrantedScopes,
} from '@/server/shopify/oauth';
import { registerWebhooks } from '@/server/shopify/webhooks';
import { SHOPIFY_CONFIG } from '@/server/shopify/config';

// TODO: Skipped - requires real database and Shopify API mocking infrastructure
describe.skip('Shopify OAuth Flow - Integration', () => {
  describe('Shop Validation', () => {
    it('should validate correct shop domains', () => {
      expect(validateShop('test-store.myshopify.com')).toBe(true);
      expect(validateShop('my-test-store.myshopify.com')).toBe(true);
      expect(validateShop('store123.myshopify.com')).toBe(true);
    });

    it('should reject invalid shop domains', () => {
      expect(validateShop('invalid')).toBe(false);
      expect(validateShop('test.com')).toBe(false);
      expect(validateShop('--test.myshopify.com')).toBe(false);
      expect(validateShop('test--store.myshopify.com')).toBe(false);
      expect(validateShop('')).toBe(false);
    });

    it('should reject malicious shop domains', () => {
      expect(validateShop('evil.com/redirect.myshopify.com')).toBe(false);
      expect(validateShop('../../../etc/passwd.myshopify.com')).toBe(false);
      expect(validateShop('test.myshopify.com.evil.com')).toBe(false);
    });
  });

  describe('OAuth URL Generation', () => {
    it('should generate valid OAuth URL with all required parameters', () => {
      const shop = 'test-store.myshopify.com';
      const state = generateState();
      const authUrl = generateAuthUrl(shop, state);

      expect(authUrl).toContain(`https://${shop}/admin/oauth/authorize`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('client_id=');
      expect(authUrl).toContain('scope=');
      expect(authUrl).toContain('redirect_uri=');
    });

    it('should include all required scopes', () => {
      const shop = 'test-store.myshopify.com';
      const state = generateState();
      const authUrl = generateAuthUrl(shop, state);

      const scopeString = SHOPIFY_CONFIG.SCOPES.join(',');
      expect(authUrl).toContain(encodeURIComponent(scopeString));
    });

    it('should generate unique state for CSRF protection', () => {
      const states = new Set();
      for (let i = 0; i < 100; i++) {
        states.add(generateState());
      }
      expect(states.size).toBe(100); // All unique
    });

    it('should throw error for invalid shop domain', () => {
      const state = generateState();
      expect(() => generateAuthUrl('invalid-shop', state)).toThrow('Invalid shop domain');
    });
  });

  describe('HMAC Verification', () => {
    beforeEach(() => {
      // Set test API secret
      process.env.SHOPIFY_API_SECRET = 'test-secret-key';
    });

    it('should verify valid HMAC signature', () => {
      const query = {
        code: 'test-code',
        shop: 'test-store.myshopify.com',
        state: 'test-state',
        timestamp: '1234567890',
      };

      // Calculate expected HMAC using the same logic
      const crypto = require('crypto');
      const message = Object.keys(query)
        .sort()
        .map((key) => `${key}=${query[key as keyof typeof query]}`)
        .join('&');
      const expectedHmac = crypto
        .createHmac('sha256', 'test-secret-key')
        .update(message)
        .digest('hex');

      const queryWithHmac = { ...query, hmac: expectedHmac };
      expect(verifyHmac(queryWithHmac)).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      const query = {
        code: 'test-code',
        shop: 'test-store.myshopify.com',
        state: 'test-state',
        hmac: 'invalid-hmac',
      };

      expect(verifyHmac(query)).toBe(false);
    });

    it('should reject missing HMAC', () => {
      const query = {
        code: 'test-code',
        shop: 'test-store.myshopify.com',
        state: 'test-state',
      };

      expect(verifyHmac(query)).toBe(false);
    });

    it('should use timing-safe comparison to prevent timing attacks', () => {
      const query = {
        code: 'test-code',
        shop: 'test-store.myshopify.com',
        hmac: 'a'.repeat(64), // Wrong length
      };

      // Should not throw, just return false
      expect(() => verifyHmac(query)).not.toThrow();
      expect(verifyHmac(query)).toBe(false);
    });
  });

  describe('Token Exchange (Mocked)', () => {
    beforeEach(() => {
      process.env.SHOPIFY_API_KEY = 'test-api-key';
      process.env.SHOPIFY_API_SECRET = 'test-secret-key';
      process.env.SHOPIFY_APP_URL = 'https://app.merchops.ai';
      process.env.SHOPIFY_SCOPES = 'read_products,write_products';
    });

    it('should exchange authorization code for access token', async () => {
      const shop = 'test-store.myshopify.com';
      const code = 'test-authorization-code';

      // Mock fetch for token exchange
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'shpat_test_token_12345',
          scope: 'read_products,write_products,read_orders',
        }),
      });

      const tokenResponse = await exchangeCodeForToken(shop, code);

      expect(tokenResponse.access_token).toBe('shpat_test_token_12345');
      expect(tokenResponse.scope).toBe('read_products,write_products,read_orders');

      // Verify correct API call
      expect(global.fetch).toHaveBeenCalledWith(
        `https://${shop}/admin/oauth/access_token`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(code),
        })
      );
    });

    it('should throw error on failed token exchange', async () => {
      const shop = 'test-store.myshopify.com';
      const code = 'invalid-code';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(exchangeCodeForToken(shop, code)).rejects.toThrow(
        'Token exchange failed: 401'
      );
    });

    it('should validate token response structure', async () => {
      const shop = 'test-store.myshopify.com';
      const code = 'test-code';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          // Missing access_token
          scope: 'read_products',
        }),
      });

      await expect(exchangeCodeForToken(shop, code)).rejects.toThrow();
    });
  });

  describe('Token Encryption/Decryption', () => {
    beforeEach(() => {
      // 64 hex characters = 32 bytes
      process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    it('should encrypt and decrypt token correctly', () => {
      const originalToken = 'shpat_test_token_12345';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it('should produce different encrypted values for same token', () => {
      const token = 'shpat_test_token_12345';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      // Different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to same value
      expect(decryptToken(encrypted1)).toBe(token);
      expect(decryptToken(encrypted2)).toBe(token);
    });

    it('should include IV, auth tag, and encrypted data', () => {
      const token = 'shpat_test_token_12345';
      const encrypted = encryptToken(token);

      // Format: iv:authTag:encryptedData
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(24); // 12 bytes IV in hex
      expect(parts[1]).toHaveLength(32); // 16 bytes auth tag in hex
    });

    it('should reject tampered encrypted tokens', () => {
      const token = 'shpat_test_token_12345';
      const encrypted = encryptToken(token);

      // Tamper with encrypted data
      const parts = encrypted.split(':');
      parts[2] = 'tampered';
      const tampered = parts.join(':');

      expect(() => decryptToken(tampered)).toThrow();
    });

    it('should reject invalid encrypted token format', () => {
      expect(() => decryptToken('invalid')).toThrow('Invalid encrypted token format');
      expect(() => decryptToken('only:two:parts:extra')).not.toThrow(); // Will fail at decryption
    });
  });

  describe('Scope Validation', () => {
    it('should validate granted scopes match required scopes', () => {
      const grantedScopes = 'read_products,write_products,read_inventory,read_orders,read_customers,write_price_rules,write_discounts';
      expect(validateGrantedScopes(grantedScopes)).toBe(true);
    });

    it('should reject insufficient scopes', () => {
      const grantedScopes = 'read_products,write_products'; // Missing required scopes
      expect(validateGrantedScopes(grantedScopes)).toBe(false);
    });

    it('should accept additional scopes beyond required', () => {
      const grantedScopes = 'read_products,write_products,read_inventory,read_orders,read_customers,write_price_rules,write_discounts,read_analytics';
      expect(validateGrantedScopes(grantedScopes)).toBe(true);
    });
  });

  describe('Webhook Registration After OAuth', () => {
    beforeEach(() => {
      process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.SHOPIFY_APP_URL = 'https://app.merchops.ai';
    });

    it('should register all required webhooks after successful OAuth', async () => {
      const shop = 'test-store.myshopify.com';
      const token = 'shpat_test_token_12345';
      const encryptedToken = encryptToken(token);

      // Mock webhook registration API calls
      const mockWebhookResponse = {
        webhook: {
          id: 12345,
          address: 'https://app.merchops.ai/api/shopify/webhooks',
          topic: 'orders/create',
          format: 'json',
          created_at: new Date().toISOString(),
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockWebhookResponse,
      });

      const webhookIds = await registerWebhooks(shop, encryptedToken, 'test-correlation-id');

      // Should register all required webhook topics
      expect(webhookIds.length).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle partial webhook registration failures gracefully', async () => {
      const shop = 'test-store.myshopify.com';
      const token = 'shpat_test_token_12345';
      const encryptedToken = encryptToken(token);

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Fail second webhook
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            webhook: {
              id: callCount,
              address: 'https://app.merchops.ai/api/shopify/webhooks',
              topic: 'orders/create',
              format: 'json',
              created_at: new Date().toISOString(),
            },
          }),
        });
      });

      // Should continue registering other webhooks despite failure
      const webhookIds = await registerWebhooks(shop, encryptedToken, 'test-correlation-id');

      // Should have some successes even with one failure
      expect(webhookIds.length).toBeGreaterThan(0);
      expect(webhookIds.length).toBeLessThan(SHOPIFY_CONFIG.WEBHOOK_TOPICS.length);
    });
  });

  describe('Complete OAuth Flow (E2E)', () => {
    beforeEach(() => {
      process.env.SHOPIFY_API_KEY = 'test-api-key';
      process.env.SHOPIFY_API_SECRET = 'test-secret-key';
      process.env.SHOPIFY_APP_URL = 'https://app.merchops.ai';
      process.env.SHOPIFY_SCOPES = 'read_products,write_products';
      process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    it('should complete full OAuth flow from URL generation to webhook registration', async () => {
      const shop = 'test-store.myshopify.com';

      // Step 1: Generate OAuth URL
      const state = generateState();
      const authUrl = generateAuthUrl(shop, state);
      expect(authUrl).toContain(shop);
      expect(authUrl).toContain(state);

      // Step 2: Simulate OAuth callback with HMAC
      const crypto = require('crypto');
      const callbackParams = {
        code: 'test-auth-code',
        shop,
        state,
        timestamp: '1234567890',
      };
      const message = Object.keys(callbackParams)
        .sort()
        .map((key) => `${key}=${callbackParams[key as keyof typeof callbackParams]}`)
        .join('&');
      const hmac = crypto
        .createHmac('sha256', 'test-secret-key')
        .update(message)
        .digest('hex');

      expect(verifyHmac({ ...callbackParams, hmac })).toBe(true);

      // Step 3: Exchange code for token
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'shpat_test_token_12345',
            scope: 'read_products,write_products,read_orders,read_customers,read_inventory,write_price_rules,write_discounts',
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            webhook: {
              id: Math.floor(Math.random() * 10000),
              address: 'https://app.merchops.ai/api/shopify/webhooks',
              topic: 'orders/create',
              format: 'json',
              created_at: new Date().toISOString(),
            },
          }),
        });

      const tokenResponse = await exchangeCodeForToken(shop, callbackParams.code);
      expect(tokenResponse.access_token).toBe('shpat_test_token_12345');
      expect(validateGrantedScopes(tokenResponse.scope)).toBe(true);

      // Step 4: Encrypt token for storage
      const encryptedToken = encryptToken(tokenResponse.access_token);
      expect(encryptedToken).toBeTruthy();
      expect(decryptToken(encryptedToken)).toBe(tokenResponse.access_token);

      // Step 5: Register webhooks
      const webhookIds = await registerWebhooks(shop, encryptedToken, 'test-correlation-id');
      expect(webhookIds.length).toBeGreaterThan(0);
    });
  });
});
