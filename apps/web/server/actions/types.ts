/**
 * MerchOps Action System Types
 * Defines execution types, operator intents, states, and payload interfaces
 */

import { z } from "zod";

// ============================================================================
// ENUMS (align with Prisma schema)
// ============================================================================

export enum ExecutionType {
  DISCOUNT_DRAFT = "discount_draft",
  WINBACK_EMAIL = "winback_email_draft",
  PAUSE_PRODUCT = "pause_product",
}

export enum OperatorIntent {
  REDUCE_INVENTORY_RISK = "reduce_inventory_risk",
  REENGAGE_DORMANT = "reengage_dormant_customers",
  PROTECT_MARGIN = "protect_margin",
}

export enum ActionDraftState {
  DRAFT = "draft",
  EDITED = "edited",
  APPROVED = "approved",
  REJECTED = "rejected",
  EXECUTING = "executing",
  EXECUTED = "executed",
  FAILED = "failed",
}

export enum ExecutionStatus {
  PENDING = "pending",
  RUNNING = "running",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  RETRYING = "retrying",
}

// ============================================================================
// PAYLOAD SCHEMAS
// ============================================================================

// Discount Draft Payload
export const DiscountDraftPayloadSchema = z.object({
  title: z.string().min(1).max(255),
  code: z.string().min(3).max(50).optional(), // Auto-generated if not provided
  discount_type: z.enum(["percentage", "fixed_amount"]),
  value: z.number().positive(),
  target_type: z.enum(["product", "collection", "entire_order"]),
  target_ids: z.array(z.string()).optional(), // Shopify product/collection IDs
  usage_limit: z.number().int().positive().optional(),
  customer_segment: z.string().optional(), // Customer tag or segment
  starts_at: z.string().datetime(), // ISO 8601
  ends_at: z.string().datetime().optional(),
  minimum_purchase_amount: z.number().nonnegative().optional(),
});

export type DiscountDraftPayload = z.infer<typeof DiscountDraftPayloadSchema>;

// Winback Email Payload
export const WinbackEmailPayloadSchema = z.object({
  subject: z.string().min(1).max(255),
  preview_text: z.string().max(150).optional(),
  body_html: z.string().min(1),
  body_text: z.string().min(1), // Plain text fallback
  from_name: z.string(),
  from_email: z.string().email(),
  recipient_segment: z.string(), // Customer tag or segment query
  include_discount_code: z.string().optional(), // Link to discount draft
  send_at: z.string().datetime().optional(), // Schedule or immediate
});

export type WinbackEmailPayload = z.infer<typeof WinbackEmailPayloadSchema>;

// Pause Product Payload
export const PauseProductPayloadSchema = z.object({
  product_ids: z.array(z.string()).min(1),
  reason: z.string().min(1).max(500),
  restore_at: z.string().datetime().optional(), // Auto-restore time
  notify_customers: z.boolean().default(false),
  redirect_to_similar: z.boolean().default(false),
  similar_product_ids: z.array(z.string()).optional(),
});

export type PauseProductPayload = z.infer<typeof PauseProductPayloadSchema>;

// Union type for all payloads
export type ActionPayload =
  | DiscountDraftPayload
  | WinbackEmailPayload
  | PauseProductPayload;

// ============================================================================
// EDITABLE FIELDS CONFIGURATION
// ============================================================================

export interface EditableFieldConfig {
  path: string; // JSON path (e.g., "title", "discount_type", "value")
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "boolean";
  required: boolean;
  validation?: z.ZodType<any>;
  options?: Array<{ label: string; value: string | number }>;
}

// Define which fields are editable per execution type
export const EDITABLE_FIELDS: Record<ExecutionType, EditableFieldConfig[]> = {
  [ExecutionType.DISCOUNT_DRAFT]: [
    {
      path: "title",
      label: "Discount Title",
      type: "text",
      required: true,
      validation: z.string().min(1).max(255),
    },
    {
      path: "value",
      label: "Discount Value",
      type: "number",
      required: true,
      validation: z.number().positive(),
    },
    {
      path: "starts_at",
      label: "Start Date",
      type: "date",
      required: true,
      validation: z.string().datetime(),
    },
    {
      path: "ends_at",
      label: "End Date",
      type: "date",
      required: false,
      validation: z.string().datetime().optional(),
    },
    {
      path: "usage_limit",
      label: "Usage Limit",
      type: "number",
      required: false,
      validation: z.number().int().positive().optional(),
    },
  ],
  [ExecutionType.WINBACK_EMAIL]: [
    {
      path: "subject",
      label: "Email Subject",
      type: "text",
      required: true,
      validation: z.string().min(1).max(255),
    },
    {
      path: "preview_text",
      label: "Preview Text",
      type: "text",
      required: false,
      validation: z.string().max(150).optional(),
    },
    {
      path: "body_html",
      label: "Email Body (HTML)",
      type: "textarea",
      required: true,
      validation: z.string().min(1),
    },
    {
      path: "body_text",
      label: "Email Body (Plain Text)",
      type: "textarea",
      required: true,
      validation: z.string().min(1),
    },
    {
      path: "send_at",
      label: "Send At",
      type: "date",
      required: false,
      validation: z.string().datetime().optional(),
    },
  ],
  [ExecutionType.PAUSE_PRODUCT]: [
    {
      path: "reason",
      label: "Reason for Pausing",
      type: "textarea",
      required: true,
      validation: z.string().min(1).max(500),
    },
    {
      path: "restore_at",
      label: "Auto-Restore At",
      type: "date",
      required: false,
      validation: z.string().datetime().optional(),
    },
    {
      path: "notify_customers",
      label: "Notify Customers",
      type: "boolean",
      required: false,
      validation: z.boolean(),
    },
    {
      path: "redirect_to_similar",
      label: "Redirect to Similar Products",
      type: "boolean",
      required: false,
      validation: z.boolean(),
    },
  ],
};

// ============================================================================
// ERROR TAXONOMY
// ============================================================================

export enum ExecutionErrorCode {
  // Network/Connectivity
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",

  // Authentication
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",

  // Validation
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",

  // Business Logic
  PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND",
  DISCOUNT_ALREADY_EXISTS = "DISCOUNT_ALREADY_EXISTS",
  CUSTOMER_SEGMENT_EMPTY = "CUSTOMER_SEGMENT_EMPTY",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // Provider Errors
  SHOPIFY_API_ERROR = "SHOPIFY_API_ERROR",
  EMAIL_PROVIDER_ERROR = "EMAIL_PROVIDER_ERROR",

  // Internal
  IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface ExecutionError {
  code: ExecutionErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, any>;
}

// ============================================================================
// HELPERS
// ============================================================================

export function getPayloadSchema(executionType: ExecutionType): z.ZodType<any> {
  switch (executionType) {
    case ExecutionType.DISCOUNT_DRAFT:
      return DiscountDraftPayloadSchema;
    case ExecutionType.WINBACK_EMAIL:
      return WinbackEmailPayloadSchema;
    case ExecutionType.PAUSE_PRODUCT:
      return PauseProductPayloadSchema;
    default:
      throw new Error(`Unknown execution type: ${executionType}`);
  }
}

export function getEditableFields(executionType: ExecutionType): EditableFieldConfig[] {
  return EDITABLE_FIELDS[executionType] || [];
}

export function isRetryableError(errorCode: ExecutionErrorCode): boolean {
  const retryableErrors = [
    ExecutionErrorCode.NETWORK_ERROR,
    ExecutionErrorCode.TIMEOUT,
    ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
  ];
  return retryableErrors.includes(errorCode);
}
