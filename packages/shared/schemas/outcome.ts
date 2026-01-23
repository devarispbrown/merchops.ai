/**
 * Outcome Schemas
 *
 * Zod validation schemas for learning loop outcomes
 */

import { z } from 'zod';

// Enum schemas
export const outcomeTypeSchema = z.enum(['helped', 'neutral', 'hurt']);

// Base outcome schema
export const outcomeSchema = z.object({
  id: z.string().uuid(),
  execution_id: z.string().uuid(),
  outcome: outcomeTypeSchema,
  computed_at: z.date(),
  evidence_json: z.record(z.unknown()),
});

// Evidence schemas for different action types

// Discount outcome evidence
export const discountOutcomeEvidenceSchema = z.object({
  metric_type: z.literal('discount_performance'),
  baseline_window: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    orders: z.number().int().nonnegative(),
    revenue: z.number().nonnegative(),
    conversion_rate: z.number().min(0).max(1),
  }),
  campaign_window: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    orders: z.number().int().nonnegative(),
    revenue: z.number().nonnegative(),
    conversion_rate: z.number().min(0).max(1),
    discount_uses: z.number().int().nonnegative(),
  }),
  uplift: z.object({
    orders_percent: z.number(),
    revenue_percent: z.number(),
    conversion_rate_percent: z.number(),
  }),
  threshold_met: z.boolean(),
  threshold_config: z.object({
    min_orders_uplift_percent: z.number().default(10),
    min_revenue_uplift_percent: z.number().default(5),
  }),
});

// Win-back email outcome evidence
export const winbackOutcomeEvidenceSchema = z.object({
  metric_type: z.literal('email_performance'),
  campaign_stats: z.object({
    sent_count: z.number().int().nonnegative(),
    delivered_count: z.number().int().nonnegative(),
    opened_count: z.number().int().nonnegative(),
    clicked_count: z.number().int().nonnegative(),
    converted_count: z.number().int().nonnegative(),
    open_rate: z.number().min(0).max(1),
    click_rate: z.number().min(0).max(1),
    conversion_rate: z.number().min(0).max(1),
  }),
  baseline_stats: z.object({
    cohort_size: z.number().int().nonnegative(),
    avg_open_rate: z.number().min(0).max(1),
    avg_click_rate: z.number().min(0).max(1),
    avg_conversion_rate: z.number().min(0).max(1),
  }),
  performance_vs_baseline: z.object({
    open_rate_diff: z.number(),
    click_rate_diff: z.number(),
    conversion_rate_diff: z.number(),
  }),
  revenue_generated: z.number().nonnegative(),
  threshold_met: z.boolean(),
  threshold_config: z.object({
    min_open_rate: z.number().min(0).max(1).default(0.15),
    min_conversion_rate: z.number().min(0).max(1).default(0.02),
  }),
});

// Product pause outcome evidence
export const pauseProductOutcomeEvidenceSchema = z.object({
  metric_type: z.literal('inventory_management'),
  before_pause: z.object({
    inventory_level: z.number().int().nonnegative(),
    stockout_risk: z.number().min(0).max(1),
    backorder_count: z.number().int().nonnegative(),
  }),
  after_pause: z.object({
    prevented_stockouts: z.number().int().nonnegative(),
    prevented_backorders: z.number().int().nonnegative(),
    customer_inquiries: z.number().int().nonnegative(),
  }),
  pause_duration_hours: z.number().nonnegative(),
  restore_event: z.enum(['manual', 'back_in_stock', 'scheduled']),
  threshold_met: z.boolean(),
  threshold_config: z.object({
    min_prevented_stockouts: z.number().int().nonnegative().default(1),
    max_customer_inquiries: z.number().int().nonnegative().default(5),
  }),
});

// Schema for creating outcomes
export const createOutcomeSchema = z.object({
  execution_id: z.string().uuid(),
  outcome: outcomeTypeSchema,
  evidence_json: z.record(z.unknown()),
});

// Schema for updating outcomes (rare, but possible for corrections)
export const updateOutcomeSchema = z.object({
  id: z.string().uuid(),
  outcome: outcomeTypeSchema.optional(),
  evidence_json: z.record(z.unknown()).optional(),
});

// Schema for querying outcomes
export const queryOutcomesSchema = z.object({
  workspace_id: z.string().uuid().optional(),
  execution_id: z.string().uuid().optional(),
  outcome: outcomeTypeSchema.optional(),
  from_date: z.date().optional(),
  to_date: z.date().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// Schema for outcome with relations
export const outcomeWithRelationsSchema = outcomeSchema.extend({
  execution: z.object({
    id: z.string().uuid(),
    action_draft_id: z.string().uuid(),
    status: z.enum(['pending', 'running', 'succeeded', 'failed', 'retrying']),
    started_at: z.date(),
    finished_at: z.date().nullable(),
  }),
});

// Schema for confidence scoring inputs
export const confidenceScoringInputSchema = z.object({
  workspace_id: z.string().uuid(),
  operator_intent: z.enum(['reduce_inventory_risk', 'reengage_dormant_customers', 'protect_margin']),
  lookback_days: z.number().int().positive().default(90),
});

// Schema for confidence score output
export const confidenceScoreSchema = z.object({
  operator_intent: z.enum(['reduce_inventory_risk', 'reengage_dormant_customers', 'protect_margin']),
  confidence: z.number().min(0).max(1),
  sample_size: z.number().int().nonnegative(),
  outcome_distribution: z.object({
    helped_count: z.number().int().nonnegative(),
    neutral_count: z.number().int().nonnegative(),
    hurt_count: z.number().int().nonnegative(),
  }),
  recent_trend: z.enum(['improving', 'stable', 'declining']),
  computed_at: z.date(),
});

// Schema for outcome computation job
export const computeOutcomeJobSchema = z.object({
  execution_id: z.string().uuid(),
  delay_hours: z.number().int().positive().default(24), // How long to wait before computing
  force_recompute: z.boolean().default(false),
});

// Validation helper for evidence by outcome type
export const validateEvidenceForActionType = (
  executionType: 'discount_draft' | 'winback_email_draft' | 'pause_product',
  evidence: unknown
) => {
  switch (executionType) {
    case 'discount_draft':
      return discountOutcomeEvidenceSchema.parse(evidence);
    case 'winback_email_draft':
      return winbackOutcomeEvidenceSchema.parse(evidence);
    case 'pause_product':
      return pauseProductOutcomeEvidenceSchema.parse(evidence);
    default:
      throw new Error(`Unknown execution type: ${executionType}`);
  }
};

// Types
export type Outcome = z.infer<typeof outcomeSchema>;
export type OutcomeType = z.infer<typeof outcomeTypeSchema>;
export type DiscountOutcomeEvidence = z.infer<typeof discountOutcomeEvidenceSchema>;
export type WinbackOutcomeEvidence = z.infer<typeof winbackOutcomeEvidenceSchema>;
export type PauseProductOutcomeEvidence = z.infer<typeof pauseProductOutcomeEvidenceSchema>;
export type CreateOutcomeInput = z.infer<typeof createOutcomeSchema>;
export type UpdateOutcomeInput = z.infer<typeof updateOutcomeSchema>;
export type QueryOutcomesInput = z.infer<typeof queryOutcomesSchema>;
export type OutcomeWithRelations = z.infer<typeof outcomeWithRelationsSchema>;
export type ConfidenceScoringInput = z.infer<typeof confidenceScoringInputSchema>;
export type ConfidenceScore = z.infer<typeof confidenceScoreSchema>;
export type ComputeOutcomeJob = z.infer<typeof computeOutcomeJobSchema>;
