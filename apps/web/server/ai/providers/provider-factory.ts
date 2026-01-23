/**
 * Provider Factory
 *
 * Creates LLM provider instances based on configuration.
 */

import type { LLMProvider, ProviderName, ProviderConfig } from './types';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import { OllamaProvider } from './ollama-provider';

/**
 * Create a provider instance by name
 */
export function createProvider(name: ProviderName, config: ProviderConfig): LLMProvider {
  switch (name) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

/**
 * Get the primary provider based on config
 */
export function getPrimaryProvider(config: ProviderConfig): LLMProvider {
  return createProvider(config.provider, config);
}

/**
 * Get fallback provider if configured
 */
export function getFallbackProvider(config: ProviderConfig): LLMProvider | null {
  if (!config.fallbackProvider) {
    return null;
  }
  return createProvider(config.fallbackProvider, config);
}

/**
 * Get all available providers in priority order
 * Returns primary first, then fallback if configured
 */
export function getProviderChain(config: ProviderConfig): LLMProvider[] {
  const providers: LLMProvider[] = [getPrimaryProvider(config)];

  const fallback = getFallbackProvider(config);
  if (fallback) {
    providers.push(fallback);
  }

  return providers;
}

/**
 * Check if a specific provider is properly configured
 */
export function isProviderConfigured(name: ProviderName, config: ProviderConfig): boolean {
  switch (name) {
    case 'anthropic':
      return Boolean(config.anthropicApiKey);
    case 'openai':
      return Boolean(config.openaiApiKey);
    case 'ollama':
      // Ollama just needs the base URL, no API key
      return Boolean(config.ollamaBaseUrl);
    default:
      return false;
  }
}

/**
 * Get list of all configured providers
 */
export function getConfiguredProviders(config: ProviderConfig): ProviderName[] {
  const providers: ProviderName[] = [];

  if (config.anthropicApiKey) {
    providers.push('anthropic');
  }
  if (config.openaiApiKey) {
    providers.push('openai');
  }
  if (config.ollamaBaseUrl) {
    providers.push('ollama');
  }

  return providers;
}
