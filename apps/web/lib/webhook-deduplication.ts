/**
 * Webhook Deduplication Utility
 *
 * Provides in-memory deduplication for webhooks to prevent replay attacks.
 * Uses webhook ID and timestamp to detect and reject duplicate webhooks.
 *
 * Features:
 * - In-memory Set with TTL for MVP (can be upgraded to Redis)
 * - Rejects webhooks older than 5 minutes
 * - Automatic cleanup of expired entries
 * - Thread-safe operations
 */

interface WebhookEntry {
  id: string;
  timestamp: number; // Unix timestamp in milliseconds
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * In-memory webhook store
 * Key format: `${webhookId}:${timestamp}`
 */
const webhookStore = new Set<string>();
const webhookMetadata = new Map<string, WebhookEntry>();

/**
 * Maximum age of webhook in milliseconds (5 minutes)
 */
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

/**
 * How long to keep webhook IDs in memory (10 minutes - 2x max age)
 * This prevents accepting the same webhook ID twice within the window
 */
const WEBHOOK_TTL_MS = 10 * 60 * 1000;

/**
 * Cleanup interval (run every 2 minutes)
 */
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Start periodic cleanup of expired entries
 */
let cleanupIntervalId: NodeJS.Timeout | null = null;

function startCleanup(): void {
  if (cleanupIntervalId) return; // Already running

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of webhookMetadata.entries()) {
      if (now > entry.expiresAt) {
        webhookStore.delete(key);
        webhookMetadata.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`[WebhookDedup] Cleaned up ${cleanedCount} expired webhook entries`);
    }
  }, CLEANUP_INTERVAL_MS);
}

// Start cleanup on module load
startCleanup();

/**
 * Webhook validation result
 */
export interface WebhookValidationResult {
  /**
   * Whether the webhook is valid and should be processed
   */
  valid: boolean;

  /**
   * Reason for rejection if invalid
   */
  reason?: 'duplicate' | 'expired' | 'missing_data' | 'invalid_timestamp';

  /**
   * Additional details about the validation
   */
  details?: string;
}

/**
 * Check if webhook should be processed
 *
 * Validates:
 * 1. Webhook is not a duplicate (based on webhook ID)
 * 2. Webhook timestamp is recent (not older than 5 minutes)
 * 3. Webhook timestamp is not in the future (with 1 minute tolerance)
 *
 * @param webhookId - Unique webhook ID from Shopify (X-Shopify-Webhook-Id header)
 * @param timestamp - Webhook timestamp from Shopify (X-Shopify-Webhook-Timestamp header, Unix timestamp as string)
 * @returns Validation result with valid status and reason if invalid
 *
 * @example
 * ```typescript
 * const webhookId = request.headers.get('x-shopify-webhook-id');
 * const timestamp = request.headers.get('x-shopify-webhook-timestamp');
 *
 * const result = validateWebhook(webhookId, timestamp);
 *
 * if (!result.valid) {
 *   logger.warn({ reason: result.reason, details: result.details }, 'Webhook rejected');
 *   return new Response('Webhook rejected', { status: 400 });
 * }
 *
 * // Process webhook...
 * ```
 */
export function validateWebhook(
  webhookId: string | null,
  timestamp: string | null
): WebhookValidationResult {
  // Validate inputs
  if (!webhookId || !timestamp) {
    return {
      valid: false,
      reason: 'missing_data',
      details: 'Webhook ID or timestamp is missing',
    };
  }

  const now = Date.now();

  // Parse timestamp (Unix timestamp in seconds, convert to milliseconds)
  const webhookTime = parseInt(timestamp, 10) * 1000;

  if (isNaN(webhookTime)) {
    return {
      valid: false,
      reason: 'invalid_timestamp',
      details: 'Webhook timestamp is not a valid number',
    };
  }

  // Check if webhook is too old (replay attack prevention)
  const age = now - webhookTime;

  if (age > MAX_WEBHOOK_AGE_MS) {
    return {
      valid: false,
      reason: 'expired',
      details: `Webhook is too old (${Math.floor(age / 1000)} seconds). Maximum age is ${MAX_WEBHOOK_AGE_MS / 1000} seconds.`,
    };
  }

  // Reject future timestamps (with 1 minute tolerance for clock skew)
  if (age < -60 * 1000) {
    return {
      valid: false,
      reason: 'invalid_timestamp',
      details: 'Webhook timestamp is too far in the future',
    };
  }

  // Create unique key combining webhook ID and timestamp
  const key = `${webhookId}:${timestamp}`;

  // Check if this webhook was already processed
  if (webhookStore.has(key)) {
    return {
      valid: false,
      reason: 'duplicate',
      details: 'This webhook has already been processed',
    };
  }

  // Also check if just the webhook ID was seen recently
  // This prevents replaying the same webhook with different timestamps
  for (const [existingKey] of webhookMetadata.entries()) {
    if (existingKey.startsWith(`${webhookId}:`)) {
      return {
        valid: false,
        reason: 'duplicate',
        details: 'Webhook ID has already been processed recently',
      };
    }
  }

  // Store webhook to prevent future duplicates
  webhookStore.add(key);
  webhookMetadata.set(key, {
    id: webhookId,
    timestamp: webhookTime,
    expiresAt: now + WEBHOOK_TTL_MS,
  });

  return {
    valid: true,
  };
}

/**
 * Extract webhook ID from headers
 *
 * @param headers - Request headers
 * @returns Webhook ID or null if not found
 */
export function extractWebhookId(
  headers: Headers | Record<string, string | undefined>
): string | null {
  if (headers instanceof Headers) {
    return headers.get('x-shopify-webhook-id');
  }

  const id =
    headers['x-shopify-webhook-id'] ||
    headers['X-Shopify-Webhook-Id'];

  return id || null;
}

/**
 * Clear webhook deduplication store (for testing)
 */
export function clearWebhookStore(): void {
  webhookStore.clear();
  webhookMetadata.clear();
}

/**
 * Stop cleanup interval (for testing)
 */
export function stopWebhookCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/**
 * Get webhook store size (for monitoring)
 */
export function getWebhookStoreSize(): number {
  return webhookStore.size;
}
