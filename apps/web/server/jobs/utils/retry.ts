/**
 * Retry Utilities
 *
 * Exponential backoff and retry logic utilities for background jobs.
 */

import { logger } from '../../observability/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const RETRY_CONFIG = {
  MAX_RETRIES: 5,
  BASE_DELAY_MS: 1000, // 1 second
  MAX_DELAY_MS: 60000, // 60 seconds
  BACKOFF_MULTIPLIER: 2,
  JITTER_FACTOR: 0.1, // 10% jitter
} as const;

// ============================================================================
// RETRY DELAY CALCULATION
// ============================================================================

/**
 * Calculate retry delay with exponential backoff and jitter
 *
 * @param attemptNumber - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @param multiplier - Backoff multiplier
 * @param jitterFactor - Jitter factor (0-1)
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attemptNumber: number,
  baseDelay: number = RETRY_CONFIG.BASE_DELAY_MS,
  maxDelay: number = RETRY_CONFIG.MAX_DELAY_MS,
  multiplier: number = RETRY_CONFIG.BACKOFF_MULTIPLIER,
  jitterFactor: number = RETRY_CONFIG.JITTER_FACTOR
): number {
  // Calculate exponential backoff: baseDelay * multiplier^attemptNumber
  const exponentialDelay = baseDelay * Math.pow(multiplier, attemptNumber);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * jitterFactor * (Math.random() - 0.5) * 2;
  const finalDelay = Math.max(0, cappedDelay + jitter);

  return Math.floor(finalDelay);
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  multiplier?: number;
  jitterFactor?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attemptNumber: number, error: Error, delay: number) => void;
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Result of successful function execution
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = RETRY_CONFIG.MAX_RETRIES,
    baseDelay = RETRY_CONFIG.BASE_DELAY_MS,
    maxDelay = RETRY_CONFIG.MAX_DELAY_MS,
    multiplier = RETRY_CONFIG.BACKOFF_MULTIPLIER,
    jitterFactor = RETRY_CONFIG.JITTER_FACTOR,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: Error;
  let attemptNumber = 0;

  while (attemptNumber <= maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      if (attemptNumber >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay
      const delay = calculateRetryDelay(attemptNumber, baseDelay, maxDelay, multiplier, jitterFactor);

      // Call retry callback
      if (onRetry) {
        onRetry(attemptNumber, error, delay);
      }

      logger.warn(
        {
          attemptNumber,
          maxRetries,
          delay,
          error: error.message,
        },
        `Retrying after failure (attempt ${attemptNumber + 1}/${maxRetries + 1})`
      );

      // Wait before retrying
      await sleep(delay);

      attemptNumber++;
    }
  }

  throw lastError!;
}

// ============================================================================
// CONDITIONAL RETRY
// ============================================================================

/**
 * Check if an error should trigger a retry based on common patterns
 */
export function isRetryableError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();
  const errorCode = (error as any).code;

  // Network errors
  const networkErrors = ['econnrefused', 'etimedout', 'enotfound', 'econnreset'];
  if (networkErrors.includes(errorCode?.toLowerCase())) {
    return true;
  }

  // Rate limiting
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return true;
  }

  // Temporary server errors
  if (errorMessage.includes('503') || errorMessage.includes('502') || errorMessage.includes('504')) {
    return true;
  }

  // Database connection errors
  if (
    errorMessage.includes('connection') &&
    (errorMessage.includes('timeout') || errorMessage.includes('refused'))
  ) {
    return true;
  }

  // Default: don't retry
  return false;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get retry delay for a specific attempt
 */
export function getRetryDelay(attemptNumber: number): number {
  return calculateRetryDelay(attemptNumber);
}

/**
 * Get all retry delays for max retries
 */
export function getRetryDelays(maxRetries: number = RETRY_CONFIG.MAX_RETRIES): number[] {
  const delays: number[] = [];
  for (let i = 0; i <= maxRetries; i++) {
    delays.push(calculateRetryDelay(i));
  }
  return delays;
}

/**
 * Get total retry time
 */
export function getTotalRetryTime(maxRetries: number = RETRY_CONFIG.MAX_RETRIES): number {
  return getRetryDelays(maxRetries).reduce((sum, delay) => sum + delay, 0);
}

// ============================================================================
// EXPONENTIAL BACKOFF ITERATOR
// ============================================================================

/**
 * Create an async iterator for exponential backoff delays
 */
export async function* exponentialBackoffIterator(
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES
): AsyncGenerator<number, void, unknown> {
  for (let i = 0; i < maxRetries; i++) {
    const delay = calculateRetryDelay(i);
    await sleep(delay);
    yield i + 1;
  }
}

// ============================================================================
// TESTING HELPERS
// ============================================================================

export const __testing__ = {
  calculateRetryDelay,
  sleep,
};
