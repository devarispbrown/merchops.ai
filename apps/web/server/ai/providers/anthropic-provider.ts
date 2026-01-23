/**
 * Anthropic Provider
 *
 * LLM provider implementation for Anthropic Claude models.
 */

import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic' as const;
  readonly capabilities: ProviderCapabilities;

  private client: Anthropic | null = null;
  private model: string;

  constructor(private config: ProviderConfig) {
    this.model = getModelForTier('anthropic', config.modelTier);
    this.capabilities = {
      supportsSystemMessage: true,
      supportsJsonMode: false, // Anthropic uses prompting for JSON
      supportsStreaming: true,
      maxContextLength: getContextLimit('anthropic', config.modelTier),
      requiresApiKey: true,
    };

    if (config.anthropicApiKey) {
      this.client = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.client) {
      throw createProviderError(
        'Anthropic client not initialized - missing API key',
        'auth_error',
        'anthropic'
      );
    }

    // Extract system message if present
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const nonSystemMessages = request.messages.filter((m) => m.role !== 'system');

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        ...(systemMessage && { system: systemMessage.content }),
        messages: nonSystemMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      // Extract text content
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw createProviderError(
          'No text content in Anthropic response',
          'invalid_request',
          'anthropic'
        );
      }

      return {
        content: textContent.text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        finishReason: this.mapStopReason(response.stop_reason),
      };
    } catch (error) {
      throw this.classifyError(error);
    }
  }

  classifyError(error: unknown): ProviderError {
    if (error instanceof Anthropic.APIError) {
      const status = error.status;

      if (status === 401) {
        return createProviderError(
          'Invalid Anthropic API key',
          'auth_error',
          'anthropic',
          { statusCode: status, isRetryable: false }
        );
      }

      if (status === 429) {
        // Rate limit - check for Retry-After header
        const retryAfter = error.headers?.['retry-after'];
        return createProviderError(
          'Anthropic rate limit exceeded',
          'rate_limit',
          'anthropic',
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
          'anthropic',
          { statusCode: status, isRetryable: false }
        );
      }

      if (status && status >= 500) {
        return createProviderError(
          `Anthropic server error: ${error.message}`,
          'server_error',
          'anthropic',
          { statusCode: status, isRetryable: true }
        );
      }
    }

    if (error instanceof Error) {
      // Check for network errors
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
        return createProviderError(
          'Failed to connect to Anthropic API',
          'connection_error',
          'anthropic',
          { isRetryable: true, cause: error }
        );
      }

      return createProviderError(
        error.message,
        'unknown',
        'anthropic',
        { isRetryable: false, cause: error }
      );
    }

    return createProviderError(
      'Unknown Anthropic error',
      'unknown',
      'anthropic',
      { isRetryable: false }
    );
  }

  private mapStopReason(reason: string | null): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
