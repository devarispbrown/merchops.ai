/**
 * Action Draft Schemas
 *
 * Zod validation schemas for action drafts and approval queue
 */

import { z } from 'zod';

// Enum schemas
export const actionDraftStateSchema = z.enum(['draft', 'edited', 'approved', 'rejected', 'executed']);

export const operatorIntentSchema = z.enum([
  'reduce_inventory_risk',
  'reengage_dormant_customers',
  'protect_margin',
]);

export const executionTypeSchema = z.enum(['discount_draft', 'winback_email_draft', 'pause_product']);

// Base action draft schema
export const actionDraftSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  operator_intent: operatorIntentSchema,
  execution_type: executionTypeSchema,
  payload_json: z.record(z.unknown()),
  editable_fields_json: z.record(z.unknown()),
  state: actionDraftStateSchema,
  created_at: z.date(),
  updated_at: z.date(),
});

// Payload schemas for specific execution types

// Discount draft payload
export const discountDraftPayloadSchema = z.object({
  discount_code: z.string().min(1).max(255),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().positive(),
  applies_to: z.enum(['all', 'products', 'collections']),
  product_ids: z.array(z.string()).optional(),
  collection_ids: z.array(z.string()).optional(),
  minimum_purchase_amount: z.number().nonnegative().optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional(),
  usage_limit: z.number().int().positive().optional(),
  once_per_customer: z.boolean().default(false),
});

// Win-back email draft payload
export const winbackEmailDraftPayloadSchema = z.object({
  subject: z.string().min(1).max(255),
  preview_text: z.string().max(255).optional(),
  body_html: z.string().min(1),
  body_text: z.string().min(1),
  from_name: z.string().min(1),
  from_email: z.string().email(),
  recipient_segment: z.object({
    customer_ids: z.array(z.string()).optional(),
    cohort: z.enum(['30_day', '60_day', '90_day']).optional(),
    min_total_spent: z.number().nonnegative().optional(),
    min_orders: z.number().int().nonnegative().optional(),
  }),
  incentive: z
    .object({
      type: z.enum(['discount_code', 'free_shipping', 'none']),
      code: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  send_at: z.string().datetime().optional(),
});

// Pause product payload
export const pauseProductPayloadSchema = z.object({
  product_id: z.string().min(1),
  product_title: z.string(),
  variant_ids: z.array(z.string()).optional(),
  reason: z.string().min(1),
  restore_when: z.enum(['manual', 'back_in_stock', 'date']),
  restore_at: z.string().datetime().optional(),
  notify_customers: z.boolean().default(false),
});

// Editable fields definitions
export const discountEditableFieldsSchema = z.object({
  discount_code: z.boolean().default(true),
  discount_value: z.boolean().default(true),
  starts_at: z.boolean().default(true),
  ends_at: z.boolean().default(true),
  usage_limit: z.boolean().default(true),
});

export const winbackEditableFieldsSchema = z.object({
  subject: z.boolean().default(true),
  preview_text: z.boolean().default(true),
  body_html: z.boolean().default(true),
  body_text: z.boolean().default(true),
  send_at: z.boolean().default(true),
  incentive: z.boolean().default(true),
});

export const pauseProductEditableFieldsSchema = z.object({
  reason: z.boolean().default(true),
  restore_when: z.boolean().default(true),
  restore_at: z.boolean().default(true),
  notify_customers: z.boolean().default(true),
});

// Schema for creating action drafts
export const createActionDraftSchema = z.object({
  workspace_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  operator_intent: operatorIntentSchema,
  execution_type: executionTypeSchema,
  payload_json: z.record(z.unknown()),
  editable_fields_json: z.record(z.unknown()),
});

// Schema for editing action drafts
export const editActionDraftSchema = z.object({
  id: z.string().uuid(),
  payload_updates: z.record(z.unknown()),
});

// Schema for approving action drafts
export const approveActionDraftSchema = z.object({
  id: z.string().uuid(),
  final_payload: z.record(z.unknown()).optional(), // If user made last-minute edits
});

// Schema for rejecting action drafts
export const rejectActionDraftSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
});

// Schema for querying action drafts
export const queryActionDraftsSchema = z.object({
  workspace_id: z.string().uuid(),
  opportunity_id: z.string().uuid().optional(),
  state: actionDraftStateSchema.optional(),
  operator_intent: operatorIntentSchema.optional(),
  execution_type: executionTypeSchema.optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// Schema for action draft with relations
export const actionDraftWithRelationsSchema = actionDraftSchema.extend({
  opportunity: z.object({
    id: z.string().uuid(),
    type: z.string(),
    priority_bucket: z.enum(['high', 'medium', 'low']),
    state: z.enum(['new', 'viewed', 'approved', 'executed', 'resolved', 'dismissed', 'expired']),
  }),
  execution_count: z.number().int().nonnegative(),
});

// Payload validation by execution type
export const validatePayloadForExecutionType = (
  executionType: z.infer<typeof executionTypeSchema>,
  payload: unknown
) => {
  switch (executionType) {
    case 'discount_draft':
      return discountDraftPayloadSchema.parse(payload);
    case 'winback_email_draft':
      return winbackEmailDraftPayloadSchema.parse(payload);
    case 'pause_product':
      return pauseProductPayloadSchema.parse(payload);
    default:
      throw new Error(`Unknown execution type: ${executionType}`);
  }
};

// Types
export type ActionDraft = z.infer<typeof actionDraftSchema>;
export type ActionDraftState = z.infer<typeof actionDraftStateSchema>;
export type OperatorIntent = z.infer<typeof operatorIntentSchema>;
export type ExecutionType = z.infer<typeof executionTypeSchema>;
export type DiscountDraftPayload = z.infer<typeof discountDraftPayloadSchema>;
export type WinbackEmailDraftPayload = z.infer<typeof winbackEmailDraftPayloadSchema>;
export type PauseProductPayload = z.infer<typeof pauseProductPayloadSchema>;
export type DiscountEditableFields = z.infer<typeof discountEditableFieldsSchema>;
export type WinbackEditableFields = z.infer<typeof winbackEditableFieldsSchema>;
export type PauseProductEditableFields = z.infer<typeof pauseProductEditableFieldsSchema>;
export type CreateActionDraftInput = z.infer<typeof createActionDraftSchema>;
export type EditActionDraftInput = z.infer<typeof editActionDraftSchema>;
export type ApproveActionDraftInput = z.infer<typeof approveActionDraftSchema>;
export type RejectActionDraftInput = z.infer<typeof rejectActionDraftSchema>;
export type QueryActionDraftsInput = z.infer<typeof queryActionDraftsSchema>;
export type ActionDraftWithRelations = z.infer<typeof actionDraftWithRelationsSchema>;
