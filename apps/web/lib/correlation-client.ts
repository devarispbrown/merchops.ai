/**
 * Client-side Correlation ID Utilities
 *
 * Lightweight correlation ID helpers for browser/client-side code.
 * Does not use Node.js-only modules like async_hooks.
 */

/**
 * Generate a UUID v4 compatible correlation ID
 * Uses crypto.randomUUID if available, falls back to manual generation
 */
export function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or generate a correlation ID for the current request
 * On client-side, we always generate a new one per request
 */
export function getCorrelationId(): string {
  return generateCorrelationId();
}

/**
 * Add correlation ID to HTTP headers
 */
export function addCorrelationIdToHeaders(
  headers: Record<string, string>,
  correlationId?: string
): Record<string, string> {
  return {
    ...headers,
    'X-Correlation-ID': correlationId ?? generateCorrelationId(),
  };
}
