/**
 * Provider-Aware Retry Logic
 *
 * Implements exponential backoff with provider-specific handling.
 */

import type { LLMProvider, CompletionRequest, CompletionResponse, ProviderError } from './types';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: Set<ProviderError['type']>;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: new Set(['rate_limit', 'server_error', 'connection_error', 'timeout']),
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig, retryAfterMs?: number): number {
  if (retryAfterMs) {
    return Math.min(retryAfterMs, config.maxDelayMs);
  }

  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);

  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a completion request with retry logic
 */
export async function withRetry(
  provider: LLMProvider,
  request: CompletionRequest,
  config: Partial<RetryConfig> = {}
): Promise<CompletionResponse> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await provider.complete(request);
    } catch (error) {
      // Classify the error if it's not already a ProviderError
      const providerError =
        error instanceof Error && 'type' in error && 'provider' in error
          ? (error as ProviderError)
          : provider.classifyError(error);

      lastError = providerError;

      // Check if we should retry
      const isRetryable =
        providerError.isRetryable !== false &&
        retryConfig.retryableErrors.has(providerError.type);

      const hasRetriesLeft = attempt < retryConfig.maxRetries;

      if (!isRetryable || !hasRetriesLeft) {
        throw providerError;
      }

      // Calculate and wait for delay
      const delay = calculateDelay(attempt, retryConfig, providerError.retryAfterMs);
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript doesn't know that
  throw lastError;
}

/**
 * Try multiple providers in sequence until one succeeds
 */
export async function withFallback(
  providers: LLMProvider[],
  request: CompletionRequest,
  retryConfig: Partial<RetryConfig> = {}
): Promise<{ response: CompletionResponse; usedProvider: LLMProvider }> {
  const errors: Array<{ provider: string; error: ProviderError }> = [];

  for (const provider of providers) {
    // Check if provider is available
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      continue;
    }

    try {
      const response = await withRetry(provider, request, retryConfig);
      return { response, usedProvider: provider };
    } catch (error) {
      const providerError =
        error instanceof Error && 'type' in error && 'provider' in error
          ? (error as ProviderError)
          : provider.classifyError(error);

      errors.push({ provider: provider.name, error: providerError });

      // If it's not a retryable error type, might still try next provider
      // Continue to next provider
    }
  }

  // All providers failed
  const errorSummary = errors
    .map((e) => `${e.provider}: ${e.error.message}`)
    .join('; ');

  throw new Error(`All providers failed: ${errorSummary}`);
}
