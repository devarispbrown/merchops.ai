/**
 * AI Configuration Loading
 *
 * Loads AI configuration from environment variables and optionally database.
 */

import { aiConfigSchema, type AIConfig } from './ai-config.schema';
import type { ProviderName, ModelTier, ProviderConfig } from '../providers/types';
import type { PrismaClient } from '@prisma/client';

/**
 * Load AI configuration from environment variables
 */
function loadFromEnv(): Partial<AIConfig> {
  return {
    provider: (process.env.AI_PROVIDER as ProviderName) || undefined,
    modelTier: (process.env.AI_MODEL_TIER as ModelTier) || undefined,
    maxTokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS, 10) : undefined,
    temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : undefined,

    // Provider-specific
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || undefined,
    ollamaModel: process.env.OLLAMA_MODEL || undefined,

    // Fallback
    fallbackProvider: (process.env.AI_FALLBACK_PROVIDER as ProviderName) || undefined,
    enableFallbackTemplates: process.env.AI_ENABLE_FALLBACK_TEMPLATES !== 'false',
  };
}

/**
 * Load AI configuration from database for a workspace
 */
async function loadFromDatabase(
  workspaceId: string,
  prisma: PrismaClient
): Promise<Partial<AIConfig> | null> {
  try {
    // Check if WorkspaceAiSettings table exists and has data
    const settings = await (prisma as any).workspaceAiSettings?.findUnique({
      where: { workspace_id: workspaceId },
    });

    if (!settings) {
      return null;
    }

    return {
      provider: settings.provider as ProviderName | undefined,
      modelTier: settings.model_tier as ModelTier | undefined,
      // Custom settings can contain additional overrides
      ...(settings.custom_settings as Record<string, unknown> || {}),
    };
  } catch (error) {
    // Table might not exist yet, that's OK
    return null;
  }
}

/**
 * Load and validate AI configuration
 *
 * Priority:
 * 1. Database settings for workspace (if provided)
 * 2. Environment variables
 * 3. Default values
 */
export async function loadAIConfig(
  workspaceId?: string,
  prisma?: PrismaClient
): Promise<ProviderConfig> {
  // Start with env config
  const envConfig = loadFromEnv();

  // Check database if workspace provided
  let dbConfig: Partial<AIConfig> | null = null;
  if (workspaceId && prisma) {
    dbConfig = await loadFromDatabase(workspaceId, prisma);
  }

  // Merge configs: db overrides env
  const mergedConfig = {
    ...envConfig,
    ...(dbConfig || {}),
  };

  // Validate with schema (applies defaults)
  const validated = aiConfigSchema.parse(mergedConfig);

  // Convert to ProviderConfig
  return {
    provider: validated.provider,
    modelTier: validated.modelTier,
    maxTokens: validated.maxTokens,
    temperature: validated.temperature,
    anthropicApiKey: validated.anthropicApiKey,
    openaiApiKey: validated.openaiApiKey,
    ollamaBaseUrl: validated.ollamaBaseUrl,
    ollamaModel: validated.ollamaModel,
    fallbackProvider: validated.fallbackProvider,
    enableFallbackTemplates: validated.enableFallbackTemplates,
  };
}

/**
 * Get AI configuration synchronously from environment only
 * Use when database access is not available
 */
export function getAIConfigSync(): ProviderConfig {
  const envConfig = loadFromEnv();
  const validated = aiConfigSchema.parse(envConfig);

  return {
    provider: validated.provider,
    modelTier: validated.modelTier,
    maxTokens: validated.maxTokens,
    temperature: validated.temperature,
    anthropicApiKey: validated.anthropicApiKey,
    openaiApiKey: validated.openaiApiKey,
    ollamaBaseUrl: validated.ollamaBaseUrl,
    ollamaModel: validated.ollamaModel,
    fallbackProvider: validated.fallbackProvider,
    enableFallbackTemplates: validated.enableFallbackTemplates,
  };
}

/**
 * Check if a provider is configured (has required credentials)
 */
export function isProviderConfigured(provider: ProviderName, config: ProviderConfig): boolean {
  switch (provider) {
    case 'anthropic':
      return Boolean(config.anthropicApiKey);
    case 'openai':
      return Boolean(config.openaiApiKey);
    case 'ollama':
      // Ollama doesn't require API key, just needs base URL
      return Boolean(config.ollamaBaseUrl);
    default:
      return false;
  }
}
