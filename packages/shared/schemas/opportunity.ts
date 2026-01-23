/**
 * Opportunity Schemas
 *
 * Zod validation schemas for opportunity engine
 */

import { z } from 'zod';

// Enum schemas
export const opportunityStateSchema = z.enum([
  'new',
  'viewed',
  'approved',
  'executed',
  'resolved',
  'dismissed',
  'expired',
]);

export const priorityBucketSchema = z.enum(['high', 'medium', 'low']);

// Base opportunity schema
export const opportunitySchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  type: z.string().min(1, 'Opportunity type is required'),
  priority_bucket: priorityBucketSchema,
  why_now: z.string().min(10, 'Why now explanation must be meaningful'),
  rationale: z.string().min(10, 'Rationale must be meaningful'),
  impact_range: z.string().min(1, 'Impact range is required'),
  counterfactual: z.string().min(10, 'Counterfactual must be meaningful'),
  decay_at: z.date().nullable(),
  confidence: z.number().min(0).max(1),
  state: opportunityStateSchema,
  created_at: z.date(),
  updated_at: z.date(),
});

// Schema for creating opportunities
export const createOpportunitySchema = z.object({
  workspace_id: z.string().uuid(),
  type: z.string().min(1),
  priority_bucket: priorityBucketSchema,
  why_now: z.string().min(10, 'Why now explanation must be specific and non-generic'),
  rationale: z.string().min(10, 'Rationale must be store-specific and plain language'),
  impact_range: z.string().min(1, 'Impact range required (e.g., "5-15 units", "$200-$500")'),
  counterfactual: z.string().min(10, 'Counterfactual must explain what happens if no action taken'),
  decay_at: z.date().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  event_ids: z.array(z.string().uuid()).min(1, 'At least one triggering event required'),
});

// Schema for updating opportunity state
export const updateOpportunityStateSchema = z.object({
  id: z.string().uuid(),
  state: opportunityStateSchema,
});

// Schema for updating opportunity confidence
export const updateOpportunityConfidenceSchema = z.object({
  id: z.string().uuid(),
  confidence: z.number().min(0).max(1),
});

// Schema for querying opportunities
export const queryOpportunitiesSchema = z.object({
  workspace_id: z.string().uuid(),
  state: opportunityStateSchema.optional(),
  priority_bucket: priorityBucketSchema.optional(),
  type: z.string().optional(),
  include_expired: z.boolean().default(false),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// Schema for opportunity with related data
export const opportunityWithRelationsSchema = opportunitySchema.extend({
  event_ids: z.array(z.string().uuid()),
  action_draft_count: z.number().int().nonnegative(),
});

// Schema for dismissing opportunity
export const dismissOpportunitySchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
});

// Schema for opportunity decay check
export const checkOpportunityDecaySchema = z.object({
  workspace_id: z.string().uuid(),
  current_time: z.date().optional(),
});

// Opportunity type definitions (for reference)
export const opportunityTypes = {
  INVENTORY_CLEARANCE: 'inventory_clearance',
  WINBACK_CAMPAIGN: 'winback_campaign',
  MARGIN_PROTECTION: 'margin_protection',
  VELOCITY_MOMENTUM: 'velocity_momentum',
  STOCK_REPLENISHMENT: 'stock_replenishment',
} as const;

// Types
export type Opportunity = z.infer<typeof opportunitySchema>;
export type OpportunityState = z.infer<typeof opportunityStateSchema>;
export type PriorityBucket = z.infer<typeof priorityBucketSchema>;
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityStateInput = z.infer<typeof updateOpportunityStateSchema>;
export type UpdateOpportunityConfidenceInput = z.infer<typeof updateOpportunityConfidenceSchema>;
export type QueryOpportunitiesInput = z.infer<typeof queryOpportunitiesSchema>;
export type OpportunityWithRelations = z.infer<typeof opportunityWithRelationsSchema>;
export type DismissOpportunityInput = z.infer<typeof dismissOpportunitySchema>;
export type CheckOpportunityDecayInput = z.infer<typeof checkOpportunityDecaySchema>;
export type OpportunityType = (typeof opportunityTypes)[keyof typeof opportunityTypes];
