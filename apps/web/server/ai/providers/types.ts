/**
 * Multi-Provider LLM Types
 *
 * Core interfaces for the provider abstraction layer.
 * Enables switching between Anthropic, OpenAI, and Ollama.
 */

/**
 * Supported LLM providers
 */
export type ProviderName = 'anthropic' | 'openai' | 'ollama';

/**
 * Model tier for selecting equivalent models across providers
 */
export type ModelTier = 'fast' | 'balanced' | 'powerful';

/**
 * Standardized message format across providers
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Standardized completion request
 */
export interface CompletionRequest {
  messages: LLMMessage[];
  maxTokens: number;
  temperature: number;
  topP?: number;
}

/**
 * Standardized completion response
 */
export interface CompletionResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
}

/**
 * Provider capabilities for feature detection
 */
export interface ProviderCapabilities {
  supportsSystemMessage: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  maxContextLength: number;
  requiresApiKey: boolean;
}

/**
 * Error classification for cross-provider error handling
 */
export type ProviderErrorType =
  | 'rate_limit'
  | 'auth_error'
  | 'invalid_request'
  | 'server_error'
  | 'timeout'
  | 'content_filter'
  | 'connection_error'
  | 'unknown';

/**
 * Standardized provider error
 */
export interface ProviderError extends Error {
  type: ProviderErrorType;
  statusCode?: number;
  isRetryable: boolean;
  retryAfterMs?: number;
  provider: ProviderName;
}

/**
 * Create a provider error
 */
export function createProviderError(
  message: string,
  type: ProviderErrorType,
  provider: ProviderName,
  options?: {
    statusCode?: number;
    isRetryable?: boolean;
    retryAfterMs?: number;
    cause?: Error;
  }
): ProviderError {
  const error = new Error(message) as ProviderError;
  error.name = 'ProviderError';
  error.type = type;
  error.provider = provider;
  error.statusCode = options?.statusCode;
  error.isRetryable = options?.isRetryable ?? false;
  error.retryAfterMs = options?.retryAfterMs;
  if (options?.cause) {
    error.cause = options.cause;
  }
  return error;
}

/**
 * Core LLM provider interface
 */
export interface LLMProvider {
  /**
   * Provider name identifier
   */
  readonly name: ProviderName;

  /**
   * Provider capabilities
   */
  readonly capabilities: ProviderCapabilities;

  /**
   * Send completion request to provider
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Check if provider is configured and available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Classify an error for retry logic
   */
  classifyError(error: unknown): ProviderError;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: ProviderName;
  modelTier: ModelTier;
  maxTokens: number;
  temperature: number;

  // Provider-specific settings
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;

  // Fallback settings
  fallbackProvider?: ProviderName;
  enableFallbackTemplates: boolean;
}

/**
 * Retry configuration per provider
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
}
