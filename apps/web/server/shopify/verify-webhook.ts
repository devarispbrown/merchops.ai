/**
 * Shopify Webhook Signature Verification
 *
 * Provides secure HMAC-SHA256 verification for incoming Shopify webhooks.
 * This is a critical security utility that prevents webhook spoofing attacks.
 *
 * Security features:
 * - HMAC-SHA256 signature verification
 * - Timing-safe comparison to prevent timing attacks
 * - Support for both string and Buffer raw body formats
 * - Constant-time validation
 *
 * @see https://shopify.dev/docs/apps/webhooks/configuration/https#step-5-verify-the-webhook
 */

import crypto from 'crypto';

/**
 * Verify Shopify webhook HMAC signature
 *
 * This function validates that a webhook request actually came from Shopify
 * by verifying the HMAC signature in the X-Shopify-Hmac-SHA256 header.
 *
 * CRITICAL SECURITY REQUIREMENTS:
 * 1. Raw body must be used (before any parsing or modification)
 * 2. UTF-8 encoding must be used for the body
 * 3. Timing-safe comparison prevents timing attacks
 * 4. Secret must never be logged or exposed to client
 *
 * @param rawBody - Raw unparsed request body (string or Buffer)
 * @param signature - HMAC signature from X-Shopify-Hmac-SHA256 header
 * @param secret - Shopify API secret (SHOPIFY_API_SECRET from env)
 * @returns True if signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * // In a webhook handler (Next.js route handler)
 * const rawBody = await request.text();
 * const signature = request.headers.get('x-shopify-hmac-sha256');
 * const secret = process.env.SHOPIFY_API_SECRET;
 *
 * if (!signature || !verifyShopifyWebhook(rawBody, signature, secret)) {
 *   return new Response('Unauthorized', { status: 401 });
 * }
 *
 * // Process webhook...
 * ```
 */
export function verifyShopifyWebhook(
  rawBody: string | Buffer,
  signature: string,
  secret: string
): boolean {
  // Validate inputs
  if (!rawBody || !signature || !secret) {
    return false;
  }

  try {
    // Calculate expected HMAC using the secret
    // IMPORTANT: Use utf8 encoding to match Shopify's calculation
    const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(bodyString, 'utf8')
      .digest('base64');

    // Convert both strings to buffers for timing-safe comparison
    const computedBuffer = Buffer.from(computedHash, 'base64');
    const signatureBuffer = Buffer.from(signature, 'base64');

    // Perform timing-safe comparison
    // This prevents timing attacks where an attacker could measure
    // the time it takes to compare strings and infer the correct value
    return crypto.timingSafeEqual(computedBuffer, signatureBuffer);
  } catch {
    // timingSafeEqual throws if buffer lengths don't match
    // or if any other error occurs - treat all errors as invalid
    return false;
  }
}

/**
 * Verify webhook with detailed error information (for debugging only)
 *
 * This function provides the same verification but returns detailed
 * error information for debugging purposes.
 *
 * WARNING: Never expose error details to clients in production.
 * Only use for server-side logging and diagnostics.
 *
 * @param rawBody - Raw unparsed request body
 * @param signature - HMAC signature from header
 * @param secret - Shopify API secret
 * @returns Object with verification result and error details
 */
export function verifyShopifyWebhookDebug(
  rawBody: string | Buffer,
  signature: string,
  secret: string
): {
  valid: boolean;
  error?: string;
  computed?: string;
} {
  // Validate inputs
  if (!rawBody) {
    return { valid: false, error: 'Missing raw body' };
  }
  if (!signature) {
    return { valid: false, error: 'Missing signature' };
  }
  if (!secret) {
    return { valid: false, error: 'Missing secret' };
  }

  try {
    // Calculate expected HMAC
    const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(bodyString, 'utf8')
      .digest('base64');

    // Convert to buffers
    const computedBuffer = Buffer.from(computedHash, 'base64');
    const signatureBuffer = Buffer.from(signature, 'base64');

    // Check if lengths match first (fast path)
    if (computedBuffer.length !== signatureBuffer.length) {
      return {
        valid: false,
        error: 'Signature length mismatch',
        computed: computedHash,
      };
    }

    // Timing-safe comparison
    const isValid = crypto.timingSafeEqual(computedBuffer, signatureBuffer);

    return {
      valid: isValid,
      error: isValid ? undefined : 'Signature mismatch',
      computed: computedHash,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract and validate webhook signature from headers
 *
 * Helper function to safely extract the HMAC signature from
 * request headers and handle missing/invalid cases.
 *
 * @param headers - Request headers (Headers or Record<string, string>)
 * @returns HMAC signature or null if not found
 */
export function extractWebhookSignature(
  headers: Headers | Record<string, string | undefined>
): string | null {
  if (headers instanceof Headers) {
    return headers.get('x-shopify-hmac-sha256');
  }

  const signature =
    headers['x-shopify-hmac-sha256'] ||
    headers['X-Shopify-Hmac-SHA256'] ||
    headers['X-Shopify-Hmac-Sha256'];

  return signature || null;
}

/**
 * Validate webhook request (convenience function)
 *
 * Combines signature extraction and verification in one call.
 * Returns boolean for simple use cases.
 *
 * @param rawBody - Raw unparsed request body
 * @param headers - Request headers
 * @param secret - Shopify API secret
 * @returns True if webhook is valid
 */
export function validateWebhookRequest(
  rawBody: string | Buffer,
  headers: Headers | Record<string, string | undefined>,
  secret: string
): boolean {
  const signature = extractWebhookSignature(headers);

  if (!signature) {
    return false;
  }

  return verifyShopifyWebhook(rawBody, signature, secret);
}

/**
 * Verify webhook timestamp to prevent replay attacks
 *
 * Shopify includes a timestamp in the X-Shopify-Webhook-Timestamp header.
 * This function validates that the webhook was sent recently to prevent
 * replay attacks where an attacker captures and resends old webhooks.
 *
 * @param timestamp - Value of X-Shopify-Webhook-Timestamp header (Unix timestamp as string)
 * @param maxAgeSeconds - Maximum age of webhook in seconds (default: 300 = 5 minutes)
 * @returns true if timestamp is within acceptable range
 *
 * @example
 * ```typescript
 * const timestamp = request.headers.get('x-shopify-webhook-timestamp');
 * if (!verifyWebhookTimestamp(timestamp)) {
 *   return new Response('Webhook expired', { status: 400 });
 * }
 * ```
 */
export function verifyWebhookTimestamp(
  timestamp: string | null,
  maxAgeSeconds: number = 300
): boolean {
  if (!timestamp) {
    return false;
  }

  try {
    // Parse Unix timestamp (seconds) and convert to milliseconds
    const webhookTime = parseInt(timestamp, 10) * 1000;

    // Check if timestamp is valid
    if (isNaN(webhookTime)) {
      return false;
    }

    // Check if webhook is too old (replay attack prevention)
    const now = Date.now();
    const age = now - webhookTime;

    if (age > maxAgeSeconds * 1000) {
      return false;
    }

    // Also reject future timestamps (clock skew tolerance: 1 minute)
    if (age < -60 * 1000) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extract webhook timestamp from headers
 *
 * @param headers - Request headers
 * @returns Timestamp string or null if not found
 */
export function extractWebhookTimestamp(
  headers: Headers | Record<string, string | undefined>
): string | null {
  if (headers instanceof Headers) {
    return headers.get('x-shopify-webhook-timestamp');
  }

  const timestamp =
    headers['x-shopify-webhook-timestamp'] ||
    headers['X-Shopify-Webhook-Timestamp'];

  return timestamp || null;
}

/**
 * Extract shop domain from webhook headers
 *
 * @param headers - Request headers
 * @returns Shop domain (e.g., "example.myshopify.com") or null
 */
export function extractShopDomain(
  headers: Headers | Record<string, string | undefined>
): string | null {
  if (headers instanceof Headers) {
    return headers.get('x-shopify-shop-domain');
  }

  const domain =
    headers['x-shopify-shop-domain'] || headers['X-Shopify-Shop-Domain'];

  return domain || null;
}

/**
 * Extract webhook topic from headers
 *
 * @param headers - Request headers
 * @returns Webhook topic (e.g., "orders/create") or null
 */
export function extractWebhookTopic(
  headers: Headers | Record<string, string | undefined>
): string | null {
  if (headers instanceof Headers) {
    return headers.get('x-shopify-topic');
  }

  const topic = headers['x-shopify-topic'] || headers['X-Shopify-Topic'];

  return topic || null;
}

/**
 * Type-safe webhook verification result
 */
export interface WebhookVerificationResult {
  verified: boolean;
  error?:
    | 'invalid_hmac'
    | 'expired_timestamp'
    | 'missing_headers'
    | 'invalid_format';
  shopDomain?: string;
  topic?: string;
}

/**
 * Comprehensive webhook verification with detailed error reporting
 *
 * Performs both HMAC signature verification and timestamp validation.
 * Use this for production webhook handlers with security monitoring.
 *
 * @param rawBody - Raw request body
 * @param headers - Request headers
 * @param secret - Shopify API secret
 * @returns Verification result with error details
 *
 * @example
 * ```typescript
 * const rawBody = await request.text();
 * const headers = request.headers;
 * const result = verifyWebhookSecure(rawBody, headers, env.SHOPIFY_API_SECRET);
 *
 * if (!result.verified) {
 *   logger.warn('Webhook verification failed', {
 *     error: result.error,
 *     shop: result.shopDomain,
 *     topic: result.topic,
 *   });
 *   return new Response('Unauthorized', { status: 401 });
 * }
 *
 * await processWebhook(result.shopDomain, result.topic, JSON.parse(rawBody));
 * ```
 */
export function verifyWebhookSecure(
  rawBody: string | Buffer,
  headers: Headers | Record<string, string | undefined>,
  secret: string
): WebhookVerificationResult {
  const signature = extractWebhookSignature(headers);
  const timestamp = extractWebhookTimestamp(headers);
  const shopDomain = extractShopDomain(headers);
  const topic = extractWebhookTopic(headers);

  // Check for required headers
  if (!signature || !timestamp || !shopDomain || !topic) {
    return {
      verified: false,
      error: 'missing_headers',
      shopDomain: shopDomain || undefined,
      topic: topic || undefined,
    };
  }

  // Verify HMAC signature
  if (!verifyShopifyWebhook(rawBody, signature, secret)) {
    return {
      verified: false,
      error: 'invalid_hmac',
      shopDomain,
      topic,
    };
  }

  // Verify timestamp (prevent replay attacks)
  if (!verifyWebhookTimestamp(timestamp)) {
    return {
      verified: false,
      error: 'expired_timestamp',
      shopDomain,
      topic,
    };
  }

  return {
    verified: true,
    shopDomain,
    topic,
  };
}

/**
 * Generate dedupe key for webhook payload
 *
 * Creates a unique key for deduplication based on workspace, topic, resource ID, and timestamp.
 * Used to prevent duplicate processing of the same webhook.
 *
 * @param payload - Parsed webhook payload
 * @param workspaceId - Workspace ID for multi-tenant isolation
 * @returns Dedupe key string
 *
 * @example
 * ```typescript
 * const payload = JSON.parse(rawBody);
 * const dedupeKey = generateWebhookDedupeKey(payload, session.user.workspaceId);
 *
 * // Store in database with unique constraint on dedupe_key
 * await prisma.event.create({
 *   data: {
 *     workspaceId: session.user.workspaceId,
 *     type: payload.topic || topic,
 *     payload,
 *     dedupeKey,
 *     occurredAt: new Date(),
 *   },
 * });
 * ```
 */
export function generateWebhookDedupeKey(
  payload: {
    id?: string | number;
    admin_graphql_api_id?: string;
    created_at?: string;
    updated_at?: string;
  },
  workspaceId: string,
  topic: string
): string {
  const resourceId =
    payload.id?.toString() ||
    payload.admin_graphql_api_id ||
    'unknown';
  const timestamp =
    payload.created_at || payload.updated_at || new Date().toISOString();

  return `${workspaceId}:${topic}:${resourceId}:${timestamp}`;
}
