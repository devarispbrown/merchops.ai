/**
 * AI Generation Engine
 *
 * Handles AI generation with audit logging, fallback behavior, and error handling.
 * All generations are logged to ai_generations table.
 *
 * Supports multiple LLM providers: Anthropic, OpenAI, and Ollama.
 */

import type {
  PromptInput,
  PromptOutput,
  PromptTemplate,
  AIGenerationResult,
  AIGenerationRecord,
} from "@merchops/shared/prompts";
import { PrismaClient } from "@prisma/client";

import {
  type LLMProvider,
  type CompletionResponse,
  type ProviderConfig,
  getPrimaryProvider,
  getProviderChain,
  withRetry,
  withFallback,
} from "./providers";
import { getAIConfigSync, isProviderConfigured } from "./config";

// Cache for provider instances
let cachedConfig: ProviderConfig | null = null;
let cachedProvider: LLMProvider | null = null;

/**
 * Get provider configuration (cached)
 */
function getConfig(): ProviderConfig {
  if (!cachedConfig) {
    cachedConfig = getAIConfigSync();
  }
  return cachedConfig;
}

/**
 * Check if AI is enabled (any provider configured)
 */
function isAIEnabled(): boolean {
  const config = getConfig();
  return isProviderConfigured(config.provider, config);
}

/**
 * Get primary provider instance (cached)
 */
function getProvider(): LLMProvider {
  if (!cachedProvider) {
    const config = getConfig();
    cachedProvider = getPrimaryProvider(config);
  }
  return cachedProvider;
}

/**
 * Reset provider cache (useful for testing or config changes)
 */
export function resetProviderCache(): void {
  cachedConfig = null;
  cachedProvider = null;
}

/**
 * Parse and validate AI response JSON
 */
function parseAIResponse<TOutput extends PromptOutput>(
  content: string,
  promptVersion: string
): TOutput {
  try {
    const parsed = JSON.parse(content);

    // Validate required fields
    if (!parsed.rationale || typeof parsed.rationale !== "string") {
      throw new Error("Missing or invalid 'rationale' field");
    }
    if (!parsed.why_now || typeof parsed.why_now !== "string") {
      throw new Error("Missing or invalid 'why_now' field");
    }
    if (!parsed.counterfactual || typeof parsed.counterfactual !== "string") {
      throw new Error("Missing or invalid 'counterfactual' field");
    }

    return parsed as TOutput;
  } catch (error) {
    throw new Error(
      `Failed to parse AI response for ${promptVersion}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Call LLM provider with the given prompt
 */
async function callLLMProvider<TInput extends PromptInput, TOutput extends PromptOutput>(
  prompt: PromptTemplate<TInput, TOutput>,
  input: TInput
): Promise<{ output: TOutput; response: CompletionResponse; providerName: string }> {
  const config = getConfig();
  const provider = getProvider();

  // Build messages array
  const messages = [
    { role: "system" as const, content: prompt.systemPrompt },
    { role: "user" as const, content: prompt.userPromptTemplate(input) },
  ];

  // Try with retry logic
  const response = await withRetry(provider, {
    messages,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });

  const output = parseAIResponse<TOutput>(response.content, prompt.version);

  return {
    output,
    response,
    providerName: provider.name,
  };
}

/**
 * Call LLM with fallback to secondary provider
 */
async function callLLMWithFallback<TInput extends PromptInput, TOutput extends PromptOutput>(
  prompt: PromptTemplate<TInput, TOutput>,
  input: TInput
): Promise<{ output: TOutput; response: CompletionResponse; providerName: string }> {
  const config = getConfig();
  const providers = getProviderChain(config);

  // Build messages array
  const messages = [
    { role: "system" as const, content: prompt.systemPrompt },
    { role: "user" as const, content: prompt.userPromptTemplate(input) },
  ];

  // Try providers in sequence with fallback
  const { response, usedProvider } = await withFallback(providers, {
    messages,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });

  const output = parseAIResponse<TOutput>(response.content, prompt.version);

  return {
    output,
    response,
    providerName: usedProvider.name,
  };
}

/**
 * Generate AI output using prompt template
 * Falls back to deterministic template on failure
 */
export async function generateAI<TInput extends PromptInput, TOutput extends PromptOutput>(
  prompt: PromptTemplate<TInput, TOutput>,
  input: TInput,
  _prisma: PrismaClient
): Promise<AIGenerationResult<TOutput>> {
  const startTime = Date.now();
  const config = getConfig();

  try {
    if (!isAIEnabled()) {
      // Use fallback when AI is not enabled
      console.info(`AI not enabled (no provider configured), using fallback for ${prompt.version}`);
      return applyFallback(prompt, input, startTime);
    }

    // Call LLM provider with retry and optional fallback
    const { output, response, providerName } = config.fallbackProvider
      ? await callLLMWithFallback(prompt, input)
      : await callLLMProvider(prompt, input);

    const latency_ms = Date.now() - startTime;

    return {
      output,
      metadata: {
        model: response.model,
        provider: providerName,
        tokens: response.usage.totalTokens,
        latency_ms,
        used_fallback: false,
      },
    };
  } catch (error) {
    console.error(`AI generation failed for ${prompt.version}, using fallback:`, error);

    // Check if fallback templates are enabled
    if (!config.enableFallbackTemplates) {
      throw error;
    }

    return applyFallback(prompt, input, startTime);
  }
}

/**
 * Use deterministic fallback template
 */
function applyFallback<TInput extends PromptInput, TOutput extends PromptOutput>(
  prompt: PromptTemplate<TInput, TOutput>,
  input: TInput,
  startTime: number
): AIGenerationResult<TOutput> {
  const output = prompt.fallbackGenerator(input);
  const latency_ms = Date.now() - startTime;

  return {
    output,
    metadata: {
      model: "fallback-template",
      provider: "fallback",
      tokens: 0,
      latency_ms,
      used_fallback: true,
    },
  };
}

/**
 * Generate and log AI output with audit trail
 */
export async function generateAndLog<TInput extends PromptInput, TOutput extends PromptOutput>(
  prompt: PromptTemplate<TInput, TOutput>,
  input: TInput,
  prisma: PrismaClient
): Promise<TOutput> {
  const result = await generateAI(prompt, input, prisma);

  // Log to ai_generations table
  await logGeneration(
    {
      workspace_id: input.workspaceId,
      prompt_version: prompt.version,
      inputs_json: input as unknown as Record<string, unknown>,
      outputs_json: result.output as unknown as Record<string, unknown>,
      model: result.metadata.model,
      tokens: result.metadata.tokens,
      latency_ms: result.metadata.latency_ms,
    },
    prisma
  );

  return result.output;
}

/**
 * Log AI generation to audit table
 */
async function logGeneration(
  record: Omit<AIGenerationRecord, "id" | "created_at">,
  prisma: PrismaClient
): Promise<void> {
  try {
    await prisma.aiGeneration.create({
      data: {
        workspace_id: record.workspace_id,
        prompt_version: record.prompt_version,
        inputs_json: record.inputs_json as any,
        outputs_json: record.outputs_json as any,
        model: record.model,
        tokens: record.tokens,
        latency_ms: record.latency_ms,
      },
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error("Failed to log AI generation:", error);
  }
}

/**
 * Batch generate multiple AI outputs
 * Useful for generating multiple opportunities at once
 */
export async function generateBatch<TInput extends PromptInput, TOutput extends PromptOutput>(
  prompt: PromptTemplate<TInput, TOutput>,
  inputs: TInput[],
  prisma: PrismaClient
): Promise<TOutput[]> {
  const results = await Promise.all(inputs.map((input) => generateAndLog(prompt, input, prisma)));
  return results;
}

/**
 * Get AI generation history for a workspace
 */
export async function getGenerationHistory(
  workspaceId: string,
  prisma: PrismaClient,
  options?: {
    promptVersion?: string;
    limit?: number;
    offset?: number;
  }
): Promise<AIGenerationRecord[]> {
  const generations = await prisma.aiGeneration.findMany({
    where: {
      workspace_id: workspaceId,
      ...(options?.promptVersion && { prompt_version: options.promptVersion }),
    },
    orderBy: { created_at: "desc" },
    take: options?.limit || 100,
    skip: options?.offset || 0,
  });

  return generations.map((g) => ({
    id: g.id,
    workspace_id: g.workspace_id,
    prompt_version: g.prompt_version,
    inputs_json: g.inputs_json as Record<string, unknown>,
    outputs_json: g.outputs_json as Record<string, unknown>,
    model: g.model,
    tokens: g.tokens,
    latency_ms: g.latency_ms,
    created_at: g.created_at,
  }));
}

/**
 * Get token usage statistics for a workspace
 */
export async function getTokenStats(
  workspaceId: string,
  prisma: PrismaClient,
  timeWindow?: { start: Date; end: Date }
): Promise<{
  total_tokens: number;
  total_generations: number;
  avg_tokens_per_generation: number;
  avg_latency_ms: number;
  fallback_rate: number;
}> {
  const generations = await prisma.aiGeneration.findMany({
    where: {
      workspace_id: workspaceId,
      ...(timeWindow && {
        created_at: {
          gte: timeWindow.start,
          lte: timeWindow.end,
        },
      }),
    },
  });

  const total_tokens = generations.reduce((sum, g) => sum + g.tokens, 0);
  const total_generations = generations.length;
  const avg_tokens_per_generation = total_generations > 0 ? total_tokens / total_generations : 0;
  const avg_latency_ms =
    total_generations > 0
      ? generations.reduce((sum, g) => sum + g.latency_ms, 0) / total_generations
      : 0;
  const fallback_count = generations.filter((g) => g.model === "fallback-template").length;
  const fallback_rate = total_generations > 0 ? fallback_count / total_generations : 0;

  return {
    total_tokens,
    total_generations,
    avg_tokens_per_generation,
    avg_latency_ms,
    fallback_rate,
  };
}

/**
 * Generate opportunity content (rationale, why_now, counterfactual)
 *
 * This is a convenience function for generating opportunity-specific content.
 * It uses the AI generation system with proper fallbacks.
 *
 * @param params - Opportunity generation parameters
 * @returns Generated opportunity content
 */
export async function generateOpportunityContent(params: {
  workspaceId: string;
  opportunityType: string;
  operatorIntent: string;
  eventsSummary: string;
  storeContext?: Record<string, any>;
  timeWindow: {
    startDate: string;
    endDate: string;
  };
  prisma: PrismaClient;
}): Promise<{
  rationale: string;
  why_now: string;
  counterfactual: string;
  impact_range?: string;
  confidence_note?: string;
}> {
  const { workspaceId, opportunityType, operatorIntent, eventsSummary, storeContext, timeWindow, prisma } =
    params;

  // Import the opportunity rationale prompt
  const { opportunityRationalePrompt } = await import("@merchops/shared/prompts");

  // Use AI generation with proper prompt template
  const output = await generateAndLog(
    opportunityRationalePrompt,
    {
      workspaceId,
      opportunityType,
      operatorIntent,
      eventsSummary,
      storeContext,
      timeWindow,
    },
    prisma
  );

  return output;
}

/**
 * Get current AI configuration info (for diagnostics)
 */
export function getAIConfigInfo(): {
  provider: string;
  modelTier: string;
  isEnabled: boolean;
  fallbackProvider: string | null;
  fallbackTemplatesEnabled: boolean;
} {
  const config = getConfig();
  return {
    provider: config.provider,
    modelTier: config.modelTier,
    isEnabled: isAIEnabled(),
    fallbackProvider: config.fallbackProvider || null,
    fallbackTemplatesEnabled: config.enableFallbackTemplates,
  };
}
