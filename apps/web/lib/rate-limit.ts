/**
 * Rate Limiting Utility
 *
 * Provides in-memory rate limiting for authentication and sensitive endpoints.
 * Uses a Map-based approach for MVP (can be upgraded to Redis for distributed systems).
 *
 * Features:
 * - Per-IP and per-email rate limiting
 * - Sliding window algorithm
 * - Automatic cleanup of expired entries
 * - Thread-safe operations
 */

interface RateLimitEntry {
  attempts: number;
  resetAt: number; // Unix timestamp in milliseconds
}

/**
 * In-memory rate limit store
 * Key format: `${type}:${identifier}` (e.g., "auth:192.168.1.1" or "auth:user@example.com")
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup interval for expired entries (run every 5 minutes)
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Start periodic cleanup of expired entries
 */
let cleanupIntervalId: NodeJS.Timeout | null = null;

function startCleanup(): void {
  if (cleanupIntervalId) return; // Already running

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`[RateLimit] Cleaned up ${cleanedCount} expired entries`);
    }
  }, CLEANUP_INTERVAL_MS);
}

// Start cleanup on module load
startCleanup();

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of attempts allowed in the time window
   */
  maxAttempts: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Rate limit type (used for namespacing in the store)
   */
  type: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed (under the limit)
   */
  allowed: boolean;

  /**
   * Number of attempts remaining before hitting the limit
   */
  remaining: number;

  /**
   * Unix timestamp (in milliseconds) when the rate limit will reset
   */
  resetAt: number;

  /**
   * Number of seconds until the rate limit resets
   */
  resetInSeconds: number;
}

/**
 * Check rate limit for an identifier
 *
 * Uses a sliding window algorithm where the window resets after the configured time.
 * Each check increments the attempt counter if allowed.
 *
 * @param identifier - Unique identifier (IP address, email, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result with allowed status and remaining attempts
 *
 * @example
 * ```typescript
 * // Check rate limit for authentication by IP
 * const result = checkRateLimit(ip, {
 *   maxAttempts: 5,
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   type: 'auth',
 * });
 *
 * if (!result.allowed) {
 *   return { error: `Too many attempts. Try again in ${result.resetInSeconds} seconds` };
 * }
 * ```
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${config.type}:${identifier}`;
  const now = Date.now();

  // Get existing entry or create new one
  let entry = rateLimitStore.get(key);

  // If no entry or window has expired, reset
  if (!entry || now > entry.resetAt) {
    entry = {
      attempts: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetAt: entry.resetAt,
      resetInSeconds: Math.ceil(config.windowMs / 1000),
    };
  }

  // Window is still active - check if under limit
  if (entry.attempts < config.maxAttempts) {
    entry.attempts++;
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxAttempts - entry.attempts,
      resetAt: entry.resetAt,
      resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  // Over the limit
  return {
    allowed: false,
    remaining: 0,
    resetAt: entry.resetAt,
    resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Reset rate limit for an identifier
 * Useful for testing or manual resets after successful actions
 *
 * @param identifier - Unique identifier
 * @param type - Rate limit type
 */
export function resetRateLimit(identifier: string, type: string): void {
  const key = `${type}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status without incrementing
 * Useful for displaying remaining attempts to users
 *
 * @param identifier - Unique identifier
 * @param config - Rate limit configuration
 * @returns Rate limit result (does not increment attempts)
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${config.type}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No entry or expired = full capacity
  if (!entry || now > entry.resetAt) {
    return {
      allowed: true,
      remaining: config.maxAttempts,
      resetAt: now + config.windowMs,
      resetInSeconds: Math.ceil(config.windowMs / 1000),
    };
  }

  // Return current status without incrementing
  const remaining = Math.max(0, config.maxAttempts - entry.attempts);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt: entry.resetAt,
    resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Authentication rate limit preset
 * 5 attempts per 15 minutes per IP/email
 */
export const AUTH_RATE_LIMIT: Omit<RateLimitConfig, 'type'> = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
};

/**
 * Check authentication rate limit by IP address
 */
export function checkAuthRateLimitByIp(ip: string): RateLimitResult {
  return checkRateLimit(ip, {
    ...AUTH_RATE_LIMIT,
    type: 'auth-ip',
  });
}

/**
 * Check authentication rate limit by email
 */
export function checkAuthRateLimitByEmail(email: string): RateLimitResult {
  return checkRateLimit(email.toLowerCase(), {
    ...AUTH_RATE_LIMIT,
    type: 'auth-email',
  });
}

/**
 * Stop the cleanup interval (for testing)
 */
export function stopCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/**
 * Clear all rate limit entries (for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get total number of active rate limit entries (for monitoring)
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}
