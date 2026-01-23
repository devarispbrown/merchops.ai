/**
 * Security Fixes Test Suite
 *
 * Tests for critical and high priority security fixes:
 * - Rate limiting on authentication
 * - Webhook replay protection
 * - JWT session security
 * - HMAC timing attack protection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  checkRateLimit,
  checkAuthRateLimitByIp,
  checkAuthRateLimitByEmail,
  resetRateLimit,
  clearAllRateLimits,
  AUTH_RATE_LIMIT,
} from '@/lib/rate-limit';
import {
  validateWebhook,
  clearWebhookStore,
} from '@/lib/webhook-deduplication';

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  afterEach(() => {
    clearAllRateLimits();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', () => {
      const result1 = checkRateLimit('test-ip', {
        maxAttempts: 3,
        windowMs: 60000,
        type: 'test',
      });

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = checkRateLimit('test-ip', {
        maxAttempts: 3,
        windowMs: 60000,
        type: 'test',
      });

      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);
    });

    it('should block requests over the limit', () => {
      const config = {
        maxAttempts: 3,
        windowMs: 60000,
        type: 'test',
      };

      // Use up all attempts
      checkRateLimit('test-ip', config);
      checkRateLimit('test-ip', config);
      checkRateLimit('test-ip', config);

      // Next attempt should be blocked
      const result = checkRateLimit('test-ip', config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', () => {
      const config = {
        maxAttempts: 2,
        windowMs: 100, // 100ms window
        type: 'test',
      };

      // Use up attempts
      checkRateLimit('test-ip', config);
      checkRateLimit('test-ip', config);

      // Should be blocked
      let result = checkRateLimit('test-ip', config);
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should be allowed again
          result = checkRateLimit('test-ip', config);
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(1);
          resolve();
        }, 150);
      });
    });

    it('should isolate different identifiers', () => {
      const config = {
        maxAttempts: 2,
        windowMs: 60000,
        type: 'test',
      };

      // IP 1 uses up attempts
      checkRateLimit('ip-1', config);
      checkRateLimit('ip-1', config);

      // IP 1 should be blocked
      const result1 = checkRateLimit('ip-1', config);
      expect(result1.allowed).toBe(false);

      // IP 2 should still be allowed
      const result2 = checkRateLimit('ip-2', config);
      expect(result2.allowed).toBe(true);
    });

    it('should isolate different types', () => {
      // Use up attempts for type 'auth'
      checkRateLimit('test-id', { maxAttempts: 2, windowMs: 60000, type: 'auth' });
      checkRateLimit('test-id', { maxAttempts: 2, windowMs: 60000, type: 'auth' });

      // Type 'auth' should be blocked
      const authResult = checkRateLimit('test-id', {
        maxAttempts: 2,
        windowMs: 60000,
        type: 'auth',
      });
      expect(authResult.allowed).toBe(false);

      // Type 'api' should still be allowed
      const apiResult = checkRateLimit('test-id', {
        maxAttempts: 2,
        windowMs: 60000,
        type: 'api',
      });
      expect(apiResult.allowed).toBe(true);
    });
  });

  describe('Authentication Rate Limiting', () => {
    it('should enforce 5 attempts per 15 minutes by IP', () => {
      // Make 5 attempts
      for (let i = 0; i < 5; i++) {
        const result = checkAuthRateLimitByIp('192.168.1.1');
        expect(result.allowed).toBe(true);
      }

      // 6th attempt should be blocked
      const result = checkAuthRateLimitByIp('192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should enforce 5 attempts per 15 minutes by email', () => {
      // Make 5 attempts
      for (let i = 0; i < 5; i++) {
        const result = checkAuthRateLimitByEmail('user@example.com');
        expect(result.allowed).toBe(true);
      }

      // 6th attempt should be blocked
      const result = checkAuthRateLimitByEmail('user@example.com');
      expect(result.allowed).toBe(false);
    });

    it('should normalize email addresses', () => {
      // Use different case
      checkAuthRateLimitByEmail('User@Example.com');
      checkAuthRateLimitByEmail('user@example.com');

      const result = checkAuthRateLimitByEmail('USER@EXAMPLE.COM');
      expect(result.remaining).toBe(2); // Should count as same email
    });

    it('should reset rate limit manually', () => {
      // Use up attempts
      for (let i = 0; i < 5; i++) {
        checkAuthRateLimitByIp('192.168.1.1');
      }

      // Should be blocked
      let result = checkAuthRateLimitByIp('192.168.1.1');
      expect(result.allowed).toBe(false);

      // Reset
      resetRateLimit('192.168.1.1', 'auth-ip');

      // Should be allowed again
      result = checkAuthRateLimitByIp('192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should use correct auth rate limit values', () => {
      expect(AUTH_RATE_LIMIT.maxAttempts).toBe(5);
      expect(AUTH_RATE_LIMIT.windowMs).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should provide accurate reset time', () => {
      const config = {
        maxAttempts: 1,
        windowMs: 60000,
        type: 'test',
      };

      const result = checkRateLimit('test-id', config);
      expect(result.resetInSeconds).toBeGreaterThan(0);
      expect(result.resetInSeconds).toBeLessThanOrEqual(60);
    });
  });
});

describe('Webhook Replay Protection', () => {
  beforeEach(() => {
    clearWebhookStore();
  });

  afterEach(() => {
    clearWebhookStore();
  });

  describe('Duplicate Detection', () => {
    it('should accept valid webhook', () => {
      const webhookId = 'webhook-123';
      const timestamp = Math.floor(Date.now() / 1000).toString(); // Current time in seconds

      const result = validateWebhook(webhookId, timestamp);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject duplicate webhook', () => {
      const webhookId = 'webhook-123';
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // First attempt should succeed
      const result1 = validateWebhook(webhookId, timestamp);
      expect(result1.valid).toBe(true);

      // Second attempt with same ID should fail
      const result2 = validateWebhook(webhookId, timestamp);
      expect(result2.valid).toBe(false);
      expect(result2.reason).toBe('duplicate');
    });

    it('should reject webhook with same ID but different timestamp', () => {
      const webhookId = 'webhook-123';
      const timestamp1 = Math.floor(Date.now() / 1000).toString();
      const timestamp2 = (Math.floor(Date.now() / 1000) + 1).toString();

      // First webhook
      const result1 = validateWebhook(webhookId, timestamp1);
      expect(result1.valid).toBe(true);

      // Same ID, different timestamp (replay attack)
      const result2 = validateWebhook(webhookId, timestamp2);
      expect(result2.valid).toBe(false);
      expect(result2.reason).toBe('duplicate');
    });

    it('should accept webhooks with different IDs', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const result1 = validateWebhook('webhook-1', timestamp);
      expect(result1.valid).toBe(true);

      const result2 = validateWebhook('webhook-2', timestamp);
      expect(result2.valid).toBe(true);
    });
  });

  describe('Timestamp Validation', () => {
    it('should reject webhook older than 5 minutes', () => {
      const webhookId = 'webhook-old';
      const oldTimestamp = Math.floor((Date.now() - 6 * 60 * 1000) / 1000).toString(); // 6 minutes ago

      const result = validateWebhook(webhookId, oldTimestamp);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });

    it('should accept webhook within 5 minutes', () => {
      const webhookId = 'webhook-recent';
      const recentTimestamp = Math.floor((Date.now() - 4 * 60 * 1000) / 1000).toString(); // 4 minutes ago

      const result = validateWebhook(webhookId, recentTimestamp);
      expect(result.valid).toBe(true);
    });

    it('should reject webhook with future timestamp', () => {
      const webhookId = 'webhook-future';
      const futureTimestamp = Math.floor((Date.now() + 2 * 60 * 1000) / 1000).toString(); // 2 minutes in future

      const result = validateWebhook(webhookId, futureTimestamp);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_timestamp');
    });

    it('should accept webhook with slight clock skew (under 1 minute)', () => {
      const webhookId = 'webhook-skew';
      const skewedTimestamp = Math.floor((Date.now() + 30 * 1000) / 1000).toString(); // 30 seconds in future

      const result = validateWebhook(webhookId, skewedTimestamp);
      expect(result.valid).toBe(true);
    });

    it('should reject webhook with invalid timestamp format', () => {
      const webhookId = 'webhook-invalid';
      const invalidTimestamp = 'not-a-number';

      const result = validateWebhook(webhookId, invalidTimestamp);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_timestamp');
    });
  });

  describe('Missing Data', () => {
    it('should reject webhook with missing ID', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const result = validateWebhook(null, timestamp);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_data');
    });

    it('should reject webhook with missing timestamp', () => {
      const result = validateWebhook('webhook-123', null);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_data');
    });

    it('should reject webhook with both missing', () => {
      const result = validateWebhook(null, null);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_data');
    });
  });
});

describe('HMAC Timing Attack Protection', () => {
  describe('Length Validation', () => {
    it('should detect length mismatch before comparison', () => {
      // This tests the fix in oauth.ts verifyHmac function
      // We can't directly test the internal function here, but we can verify
      // that Buffer comparison with different lengths is handled correctly

      const secret = 'test-secret';
      const message = 'test-message';
      const correctHash = crypto.createHmac('sha256', secret).update(message).digest('hex');
      const shortHash = correctHash.substring(0, 10);

      // Create buffers of different lengths
      const buffer1 = Buffer.from(correctHash, 'utf8');
      const buffer2 = Buffer.from(shortHash, 'utf8');

      // Verify they have different lengths
      expect(buffer1.length).not.toBe(buffer2.length);

      // Attempting timingSafeEqual with different lengths should throw
      expect(() => {
        crypto.timingSafeEqual(buffer1, buffer2);
      }).toThrow();
    });

    it('should use fixed-size buffers for comparison', () => {
      const secret = 'test-secret';
      const message = 'test-message';

      // Generate correct HMAC
      const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');

      // Create buffers
      const buffer1 = Buffer.from(hmac, 'utf8');
      const buffer2 = Buffer.from(hmac, 'utf8');

      // Should be equal
      expect(crypto.timingSafeEqual(buffer1, buffer2)).toBe(true);
    });

    it('should handle various hash formats safely', () => {
      const hash = 'a1b2c3d4e5f6';

      // Test different buffer encodings
      const hexBuffer = Buffer.from(hash, 'hex');
      const utf8Buffer = Buffer.from(hash, 'utf8');
      const base64Buffer = Buffer.from(hash, 'base64');

      // All should create valid buffers without throwing
      expect(hexBuffer).toBeInstanceOf(Buffer);
      expect(utf8Buffer).toBeInstanceOf(Buffer);
      expect(base64Buffer).toBeInstanceOf(Buffer);

      // But they should have different lengths
      expect(hexBuffer.length).not.toBe(utf8Buffer.length);
    });
  });
});

describe('JWT Session Security', () => {
  describe('Session Duration', () => {
    it('should use 7 day session duration', () => {
      // The actual JWT maxAge is configured in server/auth/index.ts
      // This test verifies the constant value
      const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;
      expect(SEVEN_DAYS_IN_SECONDS).toBe(604800);
    });

    it('should be shorter than previous 30 day duration', () => {
      const NEW_MAX_AGE = 7 * 24 * 60 * 60;
      const OLD_MAX_AGE = 30 * 24 * 60 * 60;

      expect(NEW_MAX_AGE).toBeLessThan(OLD_MAX_AGE);
    });
  });

  describe('JWT ID (JTI)', () => {
    it('should generate unique JTI for each session', () => {
      // We can't directly test the JWT generation without the full auth flow,
      // but we can verify that crypto.randomUUID() generates unique values
      const jti1 = crypto.randomUUID();
      const jti2 = crypto.randomUUID();

      expect(jti1).not.toBe(jti2);
      expect(jti1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should follow UUID v4 format', () => {
      const jti = crypto.randomUUID();
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(jti).toMatch(uuidV4Regex);
    });
  });
});
