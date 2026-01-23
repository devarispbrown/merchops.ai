/**
 * Action draft types for MerchOps
 *
 * Actions are always drafted first, never auto-executed.
 * Each draft includes editable fields and payload preview.
 */

/**
 * Operator intent enumeration
 * User-facing intent categories
 */
export enum OperatorIntent {
  /** Reduce inventory risk with discounts or promotions */
  REDUCE_INVENTORY_RISK = 'reduce_inventory_risk',

  /** Re-engage dormant customers with win-back campaigns */
  REENGAGE_DORMANT_CUSTOMERS = 'reengage_dormant_customers',

  /** Protect margin on high-performing products */
  PROTECT_MARGIN = 'protect_margin',

  /** Capitalize on momentum with strategic promotion */
  CAPITALIZE_ON_MOMENTUM = 'capitalize_on_momentum',

  /** Prevent overselling out-of-stock items */
  PREVENT_OVERSELL = 'prevent_oversell',
}

/**
 * Execution type enumeration
 * Mechanical implementation of operator intents
 */
export enum ExecutionType {
  /** Create Shopify discount code or price rule */
  DISCOUNT_DRAFT = 'discount_draft',

  /** Draft or send win-back email */
  WINBACK_EMAIL_DRAFT = 'winback_email_draft',

  /** Pause product to prevent overselling */
  PAUSE_PRODUCT = 'pause_product',

  /** Unpause product when back in stock */
  UNPAUSE_PRODUCT = 'unpause_product',

  /** Update product status (e.g., draft, archived) */
  UPDATE_PRODUCT_STATUS = 'update_product_status',
}

/**
 * Action draft state enumeration
 */
export enum ActionDraftState {
  /** Draft created, awaiting review */
  DRAFT = 'draft',

  /** Draft edited by operator */
  EDITED = 'edited',

  /** Draft approved, queued for execution */
  APPROVED = 'approved',

  /** Execution in progress */
  EXECUTING = 'executing',

  /** Execution completed successfully */
  EXECUTED = 'executed',

  /** Execution failed */
  FAILED = 'failed',

  /** Draft rejected/dismissed by operator */
  REJECTED = 'rejected',
}

/**
 * Discount draft payload
 * For creating Shopify discount codes or price rules
 */
export interface DiscountDraftPayload {
  /** Discount type: 'percentage' | 'fixed_amount' | 'free_shipping' */
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping';

  /** Discount value (percentage or fixed amount) */
  value: number;

  /** Discount code (auto-generated or custom) */
  code: string;

  /** Discount title/description */
  title: string;

  /** Start date (ISO string) */
  startsAt: string;

  /** End date (ISO string) */
  endsAt: string;

  /** Usage limit per customer */
  usageLimit?: number;

  /** Minimum purchase amount requirement */
  minimumAmount?: number;

  /** Target product IDs (empty = all products) */
  productIds?: string[];

  /** Target customer segment/tags */
  customerSegment?: string;
}

/**
 * Win-back email draft payload
 */
export interface WinbackEmailDraftPayload {
  /** Email subject line */
  subject: string;

  /** Email body (HTML) */
  bodyHtml: string;

  /** Plain text fallback */
  bodyText: string;

  /** Sender name */
  fromName: string;

  /** Sender email address */
  fromEmail: string;

  /** Target customer IDs */
  customerIds: string[];

  /** Optional discount code to include */
  discountCode?: string;

  /** Send immediately or schedule */
  sendAt?: string;

  /** Preview mode (don't actually send) */
  previewOnly?: boolean;
}

/**
 * Product pause/unpause payload
 */
export interface ProductStatusPayload {
  /** Product ID to update */
  productId: string;

  /** Target status: 'active' | 'draft' | 'archived' */
  status: 'active' | 'draft' | 'archived';

  /** Reason for status change (for audit trail) */
  reason: string;

  /** Restore to this status later (for pause/unpause) */
  restoreStatus?: 'active' | 'draft' | 'archived';
}

/**
 * Union type of all draft payloads
 */
export type DraftPayload =
  | DiscountDraftPayload
  | WinbackEmailDraftPayload
  | ProductStatusPayload;

/**
 * Editable fields specification
 * Defines which fields operator can safely edit
 */
export interface EditableFields {
  /** Field name */
  name: string;

  /** Field label for UI */
  label: string;

  /** Field type: 'text' | 'number' | 'date' | 'textarea' | 'select' */
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'boolean';

  /** Current value */
  value: string | number | boolean;

  /** Validation rules */
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: string | number }>;
  };

  /** Help text for operator */
  helpText?: string;
}

/**
 * Core action draft entity
 */
export interface ActionDraft {
  /** Unique draft identifier */
  id: string;

  /** Associated workspace ID */
  workspaceId: string;

  /** Associated opportunity ID */
  opportunityId: string;

  /** Operator intent (user-facing) */
  operatorIntent: OperatorIntent;

  /** Execution type (mechanical) */
  executionType: ExecutionType;

  /**
   * Draft payload
   * Contains execution-specific parameters
   */
  payload: DraftPayload;

  /**
   * Editable fields specification
   * Defines safe editing boundaries
   */
  editableFields: EditableFields[];

  /** Current draft state */
  state: ActionDraftState;

  /** Draft creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Approval timestamp */
  approvedAt: Date | null;

  /** Operator who approved (user ID) */
  approvedBy: string | null;

  /**
   * AI generation metadata
   * Links to ai_generations table for audit
   */
  aiGenerationId?: string;

  /**
   * Optional metadata
   * For versioning, A/B tests, debugging
   */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new action draft
 */
export interface CreateActionDraftInput {
  /** Workspace ID (required) */
  workspaceId: string;

  /** Opportunity ID (required) */
  opportunityId: string;

  /** Operator intent (required) */
  operatorIntent: OperatorIntent;

  /** Execution type (required) */
  executionType: ExecutionType;

  /** Draft payload (required) */
  payload: DraftPayload;

  /** Editable fields (required) */
  editableFields: EditableFields[];

  /** AI generation ID (optional) */
  aiGenerationId?: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating action draft
 * Only editable fields can be modified
 */
export interface UpdateActionDraftInput {
  /** Updated payload (partial, only editable fields) */
  payload: Partial<DraftPayload>;

  /** Optional metadata update */
  metadata?: Record<string, unknown>;
}

/**
 * Input for approving action draft
 */
export interface ApproveActionDraftInput {
  /** Draft ID to approve */
  draftId: string;

  /** User ID of approver */
  approvedBy: string;

  /** Optional final payload edits */
  finalPayload?: Partial<DraftPayload>;

  /** Confirmation flag (must be true) */
  confirmed: boolean;
}

/**
 * Action draft with opportunity context
 * Used in approval queue display
 */
export interface ActionDraftWithOpportunity extends ActionDraft {
  /** Associated opportunity */
  opportunity: {
    id: string;
    type: string;
    priorityBucket: string;
    whyNow: string;
    rationale: string;
    counterfactual: string;
  };
}

/**
 * Action draft query filters
 */
export interface ActionDraftQueryFilters {
  /** Filter by workspace ID */
  workspaceId: string;

  /** Filter by opportunity IDs */
  opportunityIds?: string[];

  /** Filter by operator intents */
  operatorIntents?: OperatorIntent[];

  /** Filter by execution types */
  executionTypes?: ExecutionType[];

  /** Filter by states */
  states?: ActionDraftState[];

  /** Filter drafts created after timestamp */
  createdAfter?: Date;

  /** Sort by: 'created_at' | 'updated_at' */
  sortBy?: 'created_at' | 'updated_at';

  /** Sort direction: 'asc' | 'desc' */
  sortDirection?: 'asc' | 'desc';

  /** Pagination: limit */
  limit?: number;

  /** Pagination: offset */
  offset?: number;
}
