/**
 * Ollama Provider
 *
 * LLM provider implementation for local Ollama models.
 * Ollama runs locally and doesn't require an API key.
 */

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

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama' as const;
  readonly capabilities: ProviderCapabilities;

  private baseUrl: string;
  private model: string;

  constructor(private config: ProviderConfig) {
    this.baseUrl = config.ollamaBaseUrl || 'http://localhost:11434';
    // Use custom model if specified, otherwise use tier mapping
    this.model = config.ollamaModel || getModelForTier('ollama', config.modelTier);
    this.capabilities = {
      supportsSystemMessage: true,
      supportsJsonMode: false,
      supportsStreaming: true,
      maxContextLength: getContextLimit('ollama', config.modelTier),
      requiresApiKey: false,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const _startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
            ...(request.topP !== undefined && { top_p: request.topP }),
          },
        }),
        signal: AbortSignal.timeout(120000), // 2 minute timeout for local inference
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw createProviderError(
          `Ollama request failed: ${response.status} - ${errorText}`,
          response.status >= 500 ? 'server_error' : 'invalid_request',
          'ollama',
          { statusCode: response.status, isRetryable: response.status >= 500 }
        );
      }

      const data = (await response.json()) as OllamaResponse;

      if (!data.message?.content) {
        throw createProviderError(
          'No content in Ollama response',
          'invalid_request',
          'ollama'
        );
      }

      // Ollama may not always return token counts, estimate if missing
      const inputTokens = data.prompt_eval_count ?? this.estimateTokens(request.messages.map(m => m.content).join(' '));
      const outputTokens = data.eval_count ?? this.estimateTokens(data.message.content);

      return {
        content: data.message.content,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        model: data.model,
        finishReason: data.done ? 'stop' : 'length',
      };
    } catch (error) {
      if (error instanceof Error && 'type' in error && error.type === 'ProviderError') {
        throw error;
      }
      throw this.classifyError(error);
    }
  }

  classifyError(error: unknown): ProviderError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Connection errors
      if (message.includes('econnrefused') || message.includes('fetch failed')) {
        return createProviderError(
          'Ollama server not running. Start with: ollama serve',
          'connection_error',
          'ollama',
          { isRetryable: true, cause: error }
        );
      }

      // Timeout
      if (message.includes('timeout') || message.includes('aborterror')) {
        return createProviderError(
          'Ollama request timed out',
          'timeout',
          'ollama',
          { isRetryable: true, cause: error }
        );
      }

      // Model not found
      if (message.includes('model') && message.includes('not found')) {
        return createProviderError(
          `Ollama model "${this.model}" not found. Pull it with: ollama pull ${this.model}`,
          'invalid_request',
          'ollama',
          { isRetryable: false, cause: error }
        );
      }

      return createProviderError(
        error.message,
        'unknown',
        'ollama',
        { isRetryable: false, cause: error }
      );
    }

    return createProviderError(
      'Unknown Ollama error',
      'unknown',
      'ollama',
      { isRetryable: false }
    );
  }

  /**
   * Rough token estimation when Ollama doesn't return counts
   * Approximates ~4 characters per token
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
