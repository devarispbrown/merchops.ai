/**
 * MerchOps AI Prompt System - Type Definitions
 *
 * Provides versioned, auditable prompt types with structured I/O.
 * All prompts must be versioned and logged to ai_generations table.
 */

/**
 * Versioned prompt identifier
 * Format: "prompt-name-v{number}"
 */
export type PromptVersion = string;

/**
 * Base structure for all prompt inputs
 */
export interface PromptInput {
  workspaceId: string;
  [key: string]: unknown;
}

/**
 * Base structure for all prompt outputs
 * All outputs MUST include rationale, why_now, and counterfactual
 */
export interface PromptOutput {
  rationale: string;
  why_now: string;
  counterfactual: string;
  [key: string]: unknown;
}

/**
 * Record of AI generation for audit table
 * Maps to AiGeneration Prisma model
 */
export interface AIGenerationRecord {
  id?: string;
  workspace_id: string;
  prompt_version: PromptVersion;
  inputs_json: Record<string, unknown>;
  outputs_json: Record<string, unknown>;
  model: string;
  tokens: number;
  latency_ms: number;
  created_at?: Date;
}

/**
 * Prompt template definition
 */
export interface PromptTemplate<TInput extends PromptInput, TOutput extends PromptOutput> {
  version: PromptVersion;
  systemPrompt: string;
  userPromptTemplate: (input: TInput) => string;
  outputSchema: {
    description: string;
    required: string[];
  };
  fallbackGenerator: (input: TInput) => TOutput;
}

/**
 * AI model configuration
 */
export interface AIModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
}

/**
 * AI generation result with metadata
 */
export interface AIGenerationResult<TOutput extends PromptOutput> {
  output: TOutput;
  metadata: {
    model: string;
    tokens: number;
    latency_ms: number;
    used_fallback: boolean;
  };
}

/**
 * Uncertainty language guidelines
 * Use these phrases instead of absolute claims
 */
export const UNCERTAINTY_LANGUAGE = {
  likely: "likely",
  probable: "probable",
  estimated: "estimated",
  based_on: "based on",
  suggests: "suggests",
  indicates: "indicates",
  range: "range",
  approximately: "approximately",
} as const;

/**
 * Prohibited phrases - never use these
 * These create false confidence or hallucinate metrics
 */
export const PROHIBITED_PHRASES = [
  "will definitely",
  "guaranteed to",
  "proven to",
  "always results in",
  "never fails to",
  "100% certain",
] as const;
