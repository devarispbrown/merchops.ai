/**
 * Model Mapping
 *
 * Maps model tiers to specific models for each provider.
 * Enables equivalent model selection across providers.
 */

import type { ProviderName, ModelTier } from './types';

/**
 * Model mapping for each provider and tier
 */
export const MODEL_MAP: Record<ProviderName, Record<ModelTier, string>> = {
  anthropic: {
    fast: 'claude-3-haiku-20240307',
    balanced: 'claude-3-5-sonnet-20241022',
    powerful: 'claude-3-5-sonnet-20241022', // Opus when available
  },
  openai: {
    fast: 'gpt-4o-mini',
    balanced: 'gpt-4o',
    powerful: 'gpt-4o',
  },
  ollama: {
    fast: 'llama3.2',
    balanced: 'mistral',
    powerful: 'mixtral',
  },
};

/**
 * Max context length per model (approximate)
 */
export const MODEL_CONTEXT_LIMITS: Record<ProviderName, Record<ModelTier, number>> = {
  anthropic: {
    fast: 200000,
    balanced: 200000,
    powerful: 200000,
  },
  openai: {
    fast: 128000,
    balanced: 128000,
    powerful: 128000,
  },
  ollama: {
    fast: 8192,
    balanced: 32768,
    powerful: 32768,
  },
};

/**
 * Get the model name for a provider and tier
 */
export function getModelForTier(provider: ProviderName, tier: ModelTier): string {
  return MODEL_MAP[provider][tier];
}

/**
 * Get the context limit for a provider and tier
 */
export function getContextLimit(provider: ProviderName, tier: ModelTier): number {
  return MODEL_CONTEXT_LIMITS[provider][tier];
}

/**
 * Get all available models for a provider
 */
export function getModelsForProvider(provider: ProviderName): string[] {
  return Object.values(MODEL_MAP[provider]);
}
