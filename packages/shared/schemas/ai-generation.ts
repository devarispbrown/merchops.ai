/**
 * AI Generation Schemas
 *
 * Zod validation schemas for AI prompt audit trail
 */

import { z } from 'zod';

// Base AI generation schema
export const aiGenerationSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  prompt_version: z.string().min(1, 'Prompt version is required'),
  inputs_json: z.record(z.unknown()),
  outputs_json: z.record(z.unknown()),
  model: z.string().min(1, 'Model identifier is required'),
  tokens: z.number().int().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
  created_at: z.date(),
});

// Schema for creating AI generation records
export const createAiGenerationSchema = z.object({
  workspace_id: z.string().uuid(),
  prompt_version: z.string().min(1, 'Prompt version required (e.g., "opportunity-rationale-v1.2")'),
  inputs_json: z.record(z.unknown()),
  outputs_json: z.record(z.unknown()),
  model: z.string().min(1, 'Model identifier required (e.g., "gpt-4", "claude-3-opus")'),
  tokens: z.number().int().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
});

// Schema for querying AI generations
export const queryAiGenerationsSchema = z.object({
  workspace_id: z.string().uuid(),
  prompt_version: z.string().optional(),
  model: z.string().optional(),
  from_date: z.date().optional(),
  to_date: z.date().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// Prompt input schemas for different use cases

// Opportunity rationale generation
export const opportunityRationaleInputSchema = z.object({
  prompt_type: z.literal('opportunity_rationale'),
  event_summaries: z.array(
    z.object({
      type: z.string(),
      occurred_at: z.string().datetime(),
      key_data: z.record(z.unknown()),
    })
  ),
  store_context: z.object({
    store_name: z.string(),
    primary_category: z.string().optional(),
    avg_order_value: z.number().optional(),
    recent_sales_velocity: z.string().optional(),
  }),
  opportunity_type: z.string(),
});

export const opportunityRationaleOutputSchema = z.object({
  why_now: z.string().min(10, 'Why now must be specific'),
  rationale: z.string().min(10, 'Rationale must be store-specific'),
  counterfactual: z.string().min(10, 'Counterfactual required'),
  impact_range: z.string().min(1, 'Impact range required'),
  confidence_reasoning: z.string().optional(),
});

// Email copy generation
export const emailCopyInputSchema = z.object({
  prompt_type: z.literal('email_copy'),
  campaign_intent: z.enum(['winback', 'discount_announcement', 'back_in_stock']),
  recipient_segment: z.object({
    cohort: z.string(),
    avg_past_order_value: z.number().optional(),
    days_since_last_order: z.number().int().optional(),
  }),
  incentive: z
    .object({
      type: z.string(),
      value: z.string(),
    })
    .optional(),
  brand_voice: z.object({
    tone: z.enum(['casual', 'professional', 'friendly', 'enthusiastic']).default('friendly'),
    avoid_terms: z.array(z.string()).optional(),
  }),
});

export const emailCopyOutputSchema = z.object({
  subject: z.string().max(255),
  preview_text: z.string().max(255),
  body_html: z.string(),
  body_text: z.string(),
  reasoning: z.string().optional(),
});

// Discount code generation
export const discountCodeInputSchema = z.object({
  prompt_type: z.literal('discount_code'),
  campaign_theme: z.string(),
  brand_name: z.string(),
  discount_value: z.number(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
});

export const discountCodeOutputSchema = z.object({
  code: z.string().min(4).max(50),
  alternatives: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
});

// Schema for prompt version registry
export const promptVersionSchema = z.object({
  version: z.string(), // e.g., "opportunity-rationale-v1.2"
  description: z.string(),
  template: z.string(),
  model_recommended: z.string(),
  created_at: z.date(),
  deprecated_at: z.date().nullable(),
});

// Schema for AI generation metrics
export const aiGenerationMetricsSchema = z.object({
  workspace_id: z.string().uuid(),
  from_date: z.date(),
  to_date: z.date(),
  group_by: z.enum(['prompt_version', 'model', 'day']).optional(),
});

// Output metrics
export const aiGenerationMetricsOutputSchema = z.object({
  total_generations: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  avg_latency_ms: z.number().nonnegative(),
  p95_latency_ms: z.number().nonnegative(),
  by_prompt_version: z
    .record(
      z.object({
        count: z.number().int().nonnegative(),
        avg_tokens: z.number().nonnegative(),
        avg_latency_ms: z.number().nonnegative(),
      })
    )
    .optional(),
  by_model: z
    .record(
      z.object({
        count: z.number().int().nonnegative(),
        avg_tokens: z.number().nonnegative(),
        avg_latency_ms: z.number().nonnegative(),
      })
    )
    .optional(),
});

// Fallback template schema (when AI fails)
export const fallbackTemplateSchema = z.object({
  template_type: z.enum(['opportunity_rationale', 'email_copy', 'discount_code']),
  variables: z.record(z.unknown()),
});

// Types
export type AiGeneration = z.infer<typeof aiGenerationSchema>;
export type CreateAiGenerationInput = z.infer<typeof createAiGenerationSchema>;
export type QueryAiGenerationsInput = z.infer<typeof queryAiGenerationsSchema>;
export type OpportunityRationaleInput = z.infer<typeof opportunityRationaleInputSchema>;
export type OpportunityRationaleOutput = z.infer<typeof opportunityRationaleOutputSchema>;
export type EmailCopyInput = z.infer<typeof emailCopyInputSchema>;
export type EmailCopyOutput = z.infer<typeof emailCopyOutputSchema>;
export type DiscountCodeInput = z.infer<typeof discountCodeInputSchema>;
export type DiscountCodeOutput = z.infer<typeof discountCodeOutputSchema>;
export type PromptVersion = z.infer<typeof promptVersionSchema>;
export type AiGenerationMetricsInput = z.infer<typeof aiGenerationMetricsSchema>;
export type AiGenerationMetricsOutput = z.infer<typeof aiGenerationMetricsOutputSchema>;
export type FallbackTemplate = z.infer<typeof fallbackTemplateSchema>;
