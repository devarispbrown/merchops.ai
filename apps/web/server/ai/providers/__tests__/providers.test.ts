/**
 * LLM Provider Tests
 *
 * Unit tests for the multi-provider LLM system.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { ProviderConfig, LLMProvider, CompletionRequest } from '../types';
import { createProviderError } from '../types';
import {
  createProvider,
  getPrimaryProvider,
  getFallbackProvider,
  getProviderChain,
  isProviderConfigured,
  getConfiguredProviders,
} from '../provider-factory';
import { getModelForTier, getContextLimit, MODEL_MAP } from '../model-mapping';
import { withRetry, withFallback } from '../retry';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: vi.fn() };
    static APIError = class extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    };
  }
  return { default: MockAnthropic };
});

// Mock OpenAI SDK
vi.mock('openai', () => {
  class MockOpenAI {
    chat = { completions: { create: vi.fn() } };
    static APIError = class extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    };
  }
  return { default: MockOpenAI };
});

describe('Model Mapping', () => {
  test('maps fast tier to correct models', () => {
    expect(getModelForTier('anthropic', 'fast')).toBe('claude-3-haiku-20240307');
    expect(getModelForTier('openai', 'fast')).toBe('gpt-4o-mini');
    expect(getModelForTier('ollama', 'fast')).toBe('llama3.2');
  });

  test('maps balanced tier to correct models', () => {
    expect(getModelForTier('anthropic', 'balanced')).toBe('claude-3-5-sonnet-20241022');
    expect(getModelForTier('openai', 'balanced')).toBe('gpt-4o');
    expect(getModelForTier('ollama', 'balanced')).toBe('mistral');
  });

  test('maps powerful tier to correct models', () => {
    expect(getModelForTier('anthropic', 'powerful')).toBe('claude-3-5-sonnet-20241022');
    expect(getModelForTier('openai', 'powerful')).toBe('gpt-4o');
    expect(getModelForTier('ollama', 'powerful')).toBe('mixtral');
  });

  test('returns correct context limits', () => {
    expect(getContextLimit('anthropic', 'balanced')).toBe(200000);
    expect(getContextLimit('openai', 'balanced')).toBe(128000);
    expect(getContextLimit('ollama', 'balanced')).toBe(32768);
  });
});

describe('Provider Factory', () => {
  const baseConfig: ProviderConfig = {
    provider: 'anthropic',
    modelTier: 'balanced',
    maxTokens: 2000,
    temperature: 0.7,
    enableFallbackTemplates: true,
  };

  test('creates Anthropic provider', () => {
    const config = { ...baseConfig, anthropicApiKey: 'test-key' };
    const provider = createProvider('anthropic', config);
    expect(provider.name).toBe('anthropic');
    expect(provider.capabilities.supportsSystemMessage).toBe(true);
    expect(provider.capabilities.requiresApiKey).toBe(true);
  });

  test('creates OpenAI provider', () => {
    const config = { ...baseConfig, openaiApiKey: 'test-key' };
    const provider = createProvider('openai', config);
    expect(provider.name).toBe('openai');
    expect(provider.capabilities.supportsJsonMode).toBe(true);
    expect(provider.capabilities.requiresApiKey).toBe(true);
  });

  test('creates Ollama provider', () => {
    const config = { ...baseConfig, ollamaBaseUrl: 'http://localhost:11434' };
    const provider = createProvider('ollama', config);
    expect(provider.name).toBe('ollama');
    expect(provider.capabilities.requiresApiKey).toBe(false);
  });

  test('getPrimaryProvider returns correct provider', () => {
    const config = { ...baseConfig, anthropicApiKey: 'test-key' };
    const provider = getPrimaryProvider(config);
    expect(provider.name).toBe('anthropic');
  });

  test('getFallbackProvider returns null when not configured', () => {
    const provider = getFallbackProvider(baseConfig);
    expect(provider).toBeNull();
  });

  test('getFallbackProvider returns provider when configured', () => {
    const config = {
      ...baseConfig,
      anthropicApiKey: 'test-key',
      fallbackProvider: 'openai' as const,
      openaiApiKey: 'test-key',
    };
    const provider = getFallbackProvider(config);
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe('openai');
  });

  test('getProviderChain returns correct chain', () => {
    const config = {
      ...baseConfig,
      anthropicApiKey: 'test-key',
      fallbackProvider: 'openai' as const,
      openaiApiKey: 'test-key',
    };
    const chain = getProviderChain(config);
    expect(chain).toHaveLength(2);
    expect(chain[0].name).toBe('anthropic');
    expect(chain[1].name).toBe('openai');
  });
});

describe('Provider Configuration Check', () => {
  const baseConfig: ProviderConfig = {
    provider: 'anthropic',
    modelTier: 'balanced',
    maxTokens: 2000,
    temperature: 0.7,
    enableFallbackTemplates: true,
  };

  test('Anthropic requires API key', () => {
    expect(isProviderConfigured('anthropic', baseConfig)).toBe(false);
    expect(
      isProviderConfigured('anthropic', { ...baseConfig, anthropicApiKey: 'key' })
    ).toBe(true);
  });

  test('OpenAI requires API key', () => {
    expect(isProviderConfigured('openai', baseConfig)).toBe(false);
    expect(isProviderConfigured('openai', { ...baseConfig, openaiApiKey: 'key' })).toBe(
      true
    );
  });

  test('Ollama requires base URL', () => {
    expect(isProviderConfigured('ollama', baseConfig)).toBe(false);
    expect(
      isProviderConfigured('ollama', {
        ...baseConfig,
        ollamaBaseUrl: 'http://localhost:11434',
      })
    ).toBe(true);
  });

  test('getConfiguredProviders returns only configured providers', () => {
    const config = {
      ...baseConfig,
      anthropicApiKey: 'key',
      ollamaBaseUrl: 'http://localhost:11434',
    };
    const configured = getConfiguredProviders(config);
    expect(configured).toContain('anthropic');
    expect(configured).toContain('ollama');
    expect(configured).not.toContain('openai');
  });
});

describe('Provider Error Classification', () => {
  test('creates provider error with correct type', () => {
    const error = createProviderError('Test error', 'rate_limit', 'anthropic', {
      statusCode: 429,
      isRetryable: true,
      retryAfterMs: 5000,
    });

    expect(error.message).toBe('Test error');
    expect(error.type).toBe('rate_limit');
    expect(error.provider).toBe('anthropic');
    expect(error.statusCode).toBe(429);
    expect(error.isRetryable).toBe(true);
    expect(error.retryAfterMs).toBe(5000);
  });

  test('creates provider error with default values', () => {
    const error = createProviderError('Test error', 'unknown', 'openai');

    expect(error.message).toBe('Test error');
    expect(error.type).toBe('unknown');
    expect(error.provider).toBe('openai');
    expect(error.statusCode).toBeUndefined();
    // isRetryable defaults to false when not specified
    expect(error.isRetryable).toBe(false);
  });
});

describe('Retry Logic', () => {
  const mockRequest: CompletionRequest = {
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
    ],
    maxTokens: 100,
    temperature: 0.7,
  };

  test('withRetry returns result on success', async () => {
    const mockProvider: LLMProvider = {
      name: 'anthropic',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: false,
        supportsStreaming: true,
        maxContextLength: 200000,
        requiresApiKey: true,
      },
      complete: vi.fn().mockResolvedValue({
        content: 'Hello!',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'claude-3-5-sonnet-20241022',
        finishReason: 'stop',
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn(),
    };

    const result = await withRetry(mockProvider, mockRequest);
    expect(result.content).toBe('Hello!');
    expect(mockProvider.complete).toHaveBeenCalledTimes(1);
  });

  test('withRetry retries on retryable errors', async () => {
    const callCount = { value: 0 };
    const mockProvider: LLMProvider = {
      name: 'anthropic',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: false,
        supportsStreaming: true,
        maxContextLength: 200000,
        requiresApiKey: true,
      },
      complete: vi.fn().mockImplementation(async () => {
        callCount.value++;
        if (callCount.value < 3) {
          throw createProviderError('Rate limit', 'rate_limit', 'anthropic', {
            isRetryable: true,
          });
        }
        return {
          content: 'Hello!',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'claude-3-5-sonnet-20241022',
          finishReason: 'stop',
        };
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn().mockReturnValue(
        createProviderError('Rate limit', 'rate_limit', 'anthropic', { isRetryable: true })
      ),
    };

    const result = await withRetry(mockProvider, mockRequest, {
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      retryableErrors: new Set(['rate_limit']),
    });

    expect(result.content).toBe('Hello!');
    expect(callCount.value).toBe(3);
  });

  test('withRetry does not retry non-retryable errors', async () => {
    const mockProvider: LLMProvider = {
      name: 'anthropic',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: false,
        supportsStreaming: true,
        maxContextLength: 200000,
        requiresApiKey: true,
      },
      complete: vi.fn().mockRejectedValue(
        createProviderError('Auth error', 'auth_error', 'anthropic', { isRetryable: false })
      ),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn(),
    };

    await expect(withRetry(mockProvider, mockRequest)).rejects.toThrow('Auth error');
    expect(mockProvider.complete).toHaveBeenCalledTimes(1);
  });
});

describe('Fallback Logic', () => {
  const mockRequest: CompletionRequest = {
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
    ],
    maxTokens: 100,
    temperature: 0.7,
  };

  test('withFallback uses first available provider', async () => {
    const mockProvider1: LLMProvider = {
      name: 'anthropic',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: false,
        supportsStreaming: true,
        maxContextLength: 200000,
        requiresApiKey: true,
      },
      complete: vi.fn().mockResolvedValue({
        content: 'From Anthropic',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'claude-3-5-sonnet-20241022',
        finishReason: 'stop',
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn(),
    };

    const mockProvider2: LLMProvider = {
      name: 'openai',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: true,
        supportsStreaming: true,
        maxContextLength: 128000,
        requiresApiKey: true,
      },
      complete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn(),
    };

    const { response, usedProvider } = await withFallback(
      [mockProvider1, mockProvider2],
      mockRequest
    );

    expect(response.content).toBe('From Anthropic');
    expect(usedProvider.name).toBe('anthropic');
    expect(mockProvider2.complete).not.toHaveBeenCalled();
  });

  test('withFallback falls back to second provider on failure', async () => {
    const mockProvider1: LLMProvider = {
      name: 'anthropic',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: false,
        supportsStreaming: true,
        maxContextLength: 200000,
        requiresApiKey: true,
      },
      complete: vi.fn().mockRejectedValue(
        createProviderError('Server error', 'server_error', 'anthropic', { isRetryable: true })
      ),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn().mockReturnValue(
        createProviderError('Server error', 'server_error', 'anthropic', { isRetryable: true })
      ),
    };

    const mockProvider2: LLMProvider = {
      name: 'openai',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: true,
        supportsStreaming: true,
        maxContextLength: 128000,
        requiresApiKey: true,
      },
      complete: vi.fn().mockResolvedValue({
        content: 'From OpenAI',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn(),
    };

    const { response, usedProvider } = await withFallback(
      [mockProvider1, mockProvider2],
      mockRequest,
      { maxRetries: 0, baseDelayMs: 10, maxDelayMs: 100, retryableErrors: new Set() }
    );

    expect(response.content).toBe('From OpenAI');
    expect(usedProvider.name).toBe('openai');
  });

  test('withFallback skips unavailable providers', async () => {
    const mockProvider1: LLMProvider = {
      name: 'anthropic',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: false,
        supportsStreaming: true,
        maxContextLength: 200000,
        requiresApiKey: true,
      },
      complete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(false),
      classifyError: vi.fn(),
    };

    const mockProvider2: LLMProvider = {
      name: 'openai',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: true,
        supportsStreaming: true,
        maxContextLength: 128000,
        requiresApiKey: true,
      },
      complete: vi.fn().mockResolvedValue({
        content: 'From OpenAI',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn(),
    };

    const { response, usedProvider } = await withFallback(
      [mockProvider1, mockProvider2],
      mockRequest
    );

    expect(response.content).toBe('From OpenAI');
    expect(usedProvider.name).toBe('openai');
    expect(mockProvider1.complete).not.toHaveBeenCalled();
  });

  test('withFallback throws when all providers fail', async () => {
    const mockProvider1: LLMProvider = {
      name: 'anthropic',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: false,
        supportsStreaming: true,
        maxContextLength: 200000,
        requiresApiKey: true,
      },
      complete: vi.fn().mockRejectedValue(
        createProviderError('Error 1', 'server_error', 'anthropic')
      ),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn().mockReturnValue(
        createProviderError('Error 1', 'server_error', 'anthropic')
      ),
    };

    const mockProvider2: LLMProvider = {
      name: 'openai',
      capabilities: {
        supportsSystemMessage: true,
        supportsJsonMode: true,
        supportsStreaming: true,
        maxContextLength: 128000,
        requiresApiKey: true,
      },
      complete: vi.fn().mockRejectedValue(
        createProviderError('Error 2', 'server_error', 'openai')
      ),
      isAvailable: vi.fn().mockResolvedValue(true),
      classifyError: vi.fn().mockReturnValue(
        createProviderError('Error 2', 'server_error', 'openai')
      ),
    };

    await expect(
      withFallback([mockProvider1, mockProvider2], mockRequest, {
        maxRetries: 0,
        baseDelayMs: 10,
        maxDelayMs: 100,
        retryableErrors: new Set(),
      })
    ).rejects.toThrow('All providers failed');
  });
});
