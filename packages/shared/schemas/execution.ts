/**
 * Execution Schemas
 *
 * Zod validation schemas for immutable execution records
 */

import { z } from 'zod';

// Enum schemas
export const executionStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'retrying']);

// Base execution schema
export const executionSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  action_draft_id: z.string().uuid(),
  request_payload_json: z.record(z.unknown()),
  provider_response_json: z.record(z.unknown()).nullable(),
  status: executionStatusSchema,
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  started_at: z.date(),
  finished_at: z.date().nullable(),
  idempotency_key: z.string().min(1),
});

// Schema for creating executions
export const createExecutionSchema = z.object({
  workspace_id: z.string().uuid(),
  action_draft_id: z.string().uuid(),
  request_payload_json: z.record(z.unknown()),
  idempotency_key: z.string().min(1, 'Idempotency key is required'),
});

// Schema for updating execution status
export const updateExecutionStatusSchema = z.object({
  id: z.string().uuid(),
  status: executionStatusSchema,
  provider_response_json: z.record(z.unknown()).optional(),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  finished_at: z.date().optional(),
});

// Schema for querying executions
export const queryExecutionsSchema = z.object({
  workspace_id: z.string().uuid(),
  action_draft_id: z.string().uuid().optional(),
  status: executionStatusSchema.optional(),
  from_date: z.date().optional(),
  to_date: z.date().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// Schema for execution with relations
export const executionWithRelationsSchema = executionSchema.extend({
  action_draft: z.object({
    id: z.string().uuid(),
    operator_intent: z.enum(['reduce_inventory_risk', 'reengage_dormant_customers', 'protect_margin']),
    execution_type: z.enum(['discount_draft', 'winback_email_draft', 'pause_product']),
    opportunity_id: z.string().uuid(),
  }),
  outcome: z
    .object({
      id: z.string().uuid(),
      outcome: z.enum(['helped', 'neutral', 'hurt']),
      computed_at: z.date(),
      evidence_json: z.record(z.unknown()),
    })
    .nullable(),
});

// Error code taxonomy for structured error handling
export const executionErrorCodes = {
  // Network/API errors
  NETWORK_TIMEOUT: 'network_timeout',
  NETWORK_ERROR: 'network_error',
  API_RATE_LIMIT: 'api_rate_limit',
  API_UNAVAILABLE: 'api_unavailable',

  // Authentication/Authorization
  AUTH_INVALID_TOKEN: 'auth_invalid_token',
  AUTH_EXPIRED_TOKEN: 'auth_expired_token',
  AUTH_INSUFFICIENT_SCOPES: 'auth_insufficient_scopes',
  AUTH_CONNECTION_REVOKED: 'auth_connection_revoked',

  // Validation errors
  VALIDATION_INVALID_PAYLOAD: 'validation_invalid_payload',
  VALIDATION_MISSING_FIELD: 'validation_missing_field',

  // Business logic errors
  SHOPIFY_PRODUCT_NOT_FOUND: 'shopify_product_not_found',
  SHOPIFY_DISCOUNT_EXISTS: 'shopify_discount_exists',
  EMAIL_INVALID_RECIPIENTS: 'email_invalid_recipients',
  EMAIL_SEND_FAILED: 'email_send_failed',

  // Idempotency
  DUPLICATE_EXECUTION: 'duplicate_execution',

  // Unknown
  UNKNOWN_ERROR: 'unknown_error',
} as const;

export const executionErrorCodeSchema = z.enum([
  'network_timeout',
  'network_error',
  'api_rate_limit',
  'api_unavailable',
  'auth_invalid_token',
  'auth_expired_token',
  'auth_insufficient_scopes',
  'auth_connection_revoked',
  'validation_invalid_payload',
  'validation_missing_field',
  'shopify_product_not_found',
  'shopify_discount_exists',
  'email_invalid_recipients',
  'email_send_failed',
  'duplicate_execution',
  'unknown_error',
]);

// Schema for retry configuration
export const executionRetryConfigSchema = z.object({
  max_retries: z.number().int().positive().default(3),
  initial_delay_ms: z.number().int().positive().default(1000),
  max_delay_ms: z.number().int().positive().default(60000),
  backoff_multiplier: z.number().positive().default(2),
});

// Schema for checking idempotency
export const checkExecutionIdempotencySchema = z.object({
  workspace_id: z.string().uuid(),
  idempotency_key: z.string().min(1),
});

// Schema for execution metrics
export const executionMetricsSchema = z.object({
  workspace_id: z.string().uuid(),
  from_date: z.date(),
  to_date: z.date(),
  group_by: z.enum(['status', 'execution_type', 'operator_intent', 'day']).optional(),
});

// Provider-specific response schemas

// Shopify API response
export const shopifyExecutionResponseSchema = z.object({
  resource_type: z.string(),
  resource_id: z.string().optional(),
  admin_url: z.string().url().optional(),
  errors: z.array(z.string()).optional(),
});

// Email provider response
export const emailExecutionResponseSchema = z.object({
  message_id: z.string(),
  recipients_count: z.number().int().nonnegative(),
  sent_at: z.string().datetime(),
  errors: z.array(z.string()).optional(),
});

// Types
export type Execution = z.infer<typeof executionSchema>;
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;
export type CreateExecutionInput = z.infer<typeof createExecutionSchema>;
export type UpdateExecutionStatusInput = z.infer<typeof updateExecutionStatusSchema>;
export type QueryExecutionsInput = z.infer<typeof queryExecutionsSchema>;
export type ExecutionWithRelations = z.infer<typeof executionWithRelationsSchema>;
export type ExecutionErrorCode = z.infer<typeof executionErrorCodeSchema>;
export type ExecutionRetryConfig = z.infer<typeof executionRetryConfigSchema>;
export type CheckExecutionIdempotencyInput = z.infer<typeof checkExecutionIdempotencySchema>;
export type ExecutionMetricsInput = z.infer<typeof executionMetricsSchema>;
export type ShopifyExecutionResponse = z.infer<typeof shopifyExecutionResponseSchema>;
export type EmailExecutionResponse = z.infer<typeof emailExecutionResponseSchema>;
