/**
 * AI Configuration Schemas
 *
 * Zod validation schemas for AI configuration.
 */

import { z } from 'zod';

/**
 * Provider name schema
 */
export const providerNameSchema = z.enum(['anthropic', 'openai', 'ollama']);

/**
 * Model tier schema
 */
export const modelTierSchema = z.enum(['fast', 'balanced', 'powerful']);

/**
 * Full AI configuration schema
 */
export const aiConfigSchema = z.object({
  provider: providerNameSchema.default('anthropic'),
  modelTier: modelTierSchema.default('balanced'),
  maxTokens: z.number().int().min(100).max(8000).default(2000),
  temperature: z.number().min(0).max(2).default(0.7),

  // Provider-specific settings
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  ollamaBaseUrl: z.string().url().optional(),
  ollamaModel: z.string().optional(),

  // Fallback settings
  fallbackProvider: providerNameSchema.optional(),
  enableFallbackTemplates: z.boolean().default(true),
});

export type AIConfigInput = z.input<typeof aiConfigSchema>;
export type AIConfig = z.output<typeof aiConfigSchema>;
