/**
 * OpenAI Provider
 *
 * LLM provider implementation for OpenAI GPT models.
 */

import OpenAI from 'openai';
import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderCapabilities,
  ProviderError,
  ProviderConfig,
} from './types';
import { createProviderError } from './types';
import { getModelForTier, getContextLimit } from './model-mapping';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai' as const;
  readonly capabilities: ProviderCapabilities;

  private client: OpenAI | null = null;
  private model: string;

  constructor(private config: ProviderConfig) {
    this.model = getModelForTier('openai', config.modelTier);
    this.capabilities = {
      supportsSystemMessage: true,
      supportsJsonMode: true,
      supportsStreaming: true,
      maxContextLength: getContextLimit('openai', config.modelTier),
      requiresApiKey: true,
    };

    if (config.openaiApiKey) {
      this.client = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.client) {
      throw createProviderError(
        'OpenAI client not initialized - missing API key',
        'auth_error',
        'openai'
      );
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        ...(request.topP !== undefined && { top_p: request.topP }),
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const choice = response.choices[0];
      if (!choice || !choice.message.content) {
        throw createProviderError(
          'No content in OpenAI response',
          'invalid_request',
          'openai'
        );
      }

      return {
        content: choice.message.content,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        model: response.model,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error) {
      throw this.classifyError(error);
    }
  }

  classifyError(error: unknown): ProviderError {
    if (error instanceof OpenAI.APIError) {
      const status = error.status;

      if (status === 401) {
        return createProviderError(
          'Invalid OpenAI API key',
          'auth_error',
          'openai',
          { statusCode: status, isRetryable: false }
        );
      }

      if (status === 429) {
        // Rate limit
        const retryAfter = error.headers?.['retry-after'];
        return createProviderError(
          'OpenAI rate limit exceeded',
          'rate_limit',
          'openai',
          {
            statusCode: status,
            isRetryable: true,
            retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
          }
        );
      }

      if (status === 400) {
        return createProviderError(
          `Invalid request: ${error.message}`,
          'invalid_request',
          'openai',
          { statusCode: status, isRetryable: false }
        );
      }

      if (status && status >= 500) {
        return createProviderError(
          `OpenAI server error: ${error.message}`,
          'server_error',
          'openai',
          { statusCode: status, isRetryable: true }
        );
      }
    }

    if (error instanceof Error) {
      // Check for network errors
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
        return createProviderError(
          'Failed to connect to OpenAI API',
          'connection_error',
          'openai',
          { isRetryable: true, cause: error }
        );
      }

      return createProviderError(
        error.message,
        'unknown',
        'openai',
        { isRetryable: false, cause: error }
      );
    }

    return createProviderError(
      'Unknown OpenAI error',
      'unknown',
      'openai',
      { isRetryable: false }
    );
  }

  private mapFinishReason(reason: string | null): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
