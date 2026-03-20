/**
 * API Client Types
 * Shared types for API requests, responses, and errors
 */

import {
  OpportunityState,
  PriorityBucket,
  ActionDraftState,
  ExecutionStatus,
  OperatorIntent,
  ExecutionType,
  ShopifyConnectionStatus,
  OutcomeType,
} from '@prisma/client';

import type {
  DiscountDraftPayload,
  WinbackEmailPayload,
  PauseProductPayload,
} from '../../server/actions/types';
import type { EventPayload } from '../../server/events/types';
import type { OutcomeEvidence } from '../../server/learning/types';

// ============================================================================
// API ERROR TYPES
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export class ApiClientError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.statusCode = error.statusCode;
    this.details = error.details;
  }
}

// ============================================================================
// PAGINATION
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

// ============================================================================
// OPPORTUNITIES
// ============================================================================

export interface OpportunityFilters {
  state?: OpportunityState[];
  priority_bucket?: PriorityBucket[];
  type?: string[];
  search?: string;
  from_date?: string;
  to_date?: string;
}

export interface OpportunityListParams extends PaginationParams {
  filters?: OpportunityFilters;
  sort_by?: 'created_at' | 'priority_bucket' | 'decay_at';
  sort_order?: 'asc' | 'desc';
}

export interface OpportunityResponse {
  id: string;
  workspace_id: string;
  type: string;
  priority_bucket: PriorityBucket;
  why_now: string;
  rationale: string;
  impact_range: string;
  counterfactual: string;
  decay_at: string | null;
  confidence: number;
  state: OpportunityState;
  created_at: string;
  updated_at: string;
  event_ids: string[];
  draft_count: number;
}

export interface OpportunityDetailResponse extends OpportunityResponse {
  events: Array<{
    id: string;
    type: string;
    occurred_at: string;
    payload: EventPayload;
  }>;
  drafts: ActionDraftSummary[];
}

// ============================================================================
// DRAFTS
// ============================================================================

export interface DraftFilters {
  state?: ActionDraftState[];
  operator_intent?: OperatorIntent[];
  execution_type?: ExecutionType[];
  opportunity_id?: string;
}

export interface DraftListParams extends PaginationParams {
  filters?: DraftFilters;
  sort_by?: 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

export interface ActionDraftSummary {
  id: string;
  workspace_id: string;
  opportunity_id: string;
  operator_intent: OperatorIntent;
  execution_type: ExecutionType;
  state: ActionDraftState;
  created_at: string;
  updated_at: string;
}

export interface ActionDraftResponse {
  id: string;
  workspace_id: string;
  opportunity_id: string;
  operator_intent: OperatorIntent;
  execution_type: ExecutionType;
  payload: DiscountDraftPayload | WinbackEmailPayload | PauseProductPayload;
  editable_fields: string[];
  state: ActionDraftState;
  created_at: string;
  updated_at: string;
  opportunity: {
    id: string;
    type: string;
    priority_bucket: PriorityBucket;
    rationale: string;
  };
  executions: ExecutionSummary[];
}

export interface CreateDraftRequest {
  opportunityId: string;
  operatorIntent: OperatorIntent;
  executionType: ExecutionType;
  context?: Record<string, unknown>;
}

export interface UpdateDraftRequest {
  updates: Record<string, unknown>;
}

export interface ApproveDraftRequest {
  confirmation: boolean;
}

// ============================================================================
// EXECUTIONS
// ============================================================================

export interface ExecutionFilters {
  status?: ExecutionStatus[];
  action_draft_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface ExecutionListParams extends PaginationParams {
  filters?: ExecutionFilters;
  sort_by?: 'started_at' | 'finished_at';
  sort_order?: 'asc' | 'desc';
}

export interface ExecutionSummary {
  id: string;
  action_draft_id: string;
  status: ExecutionStatus;
  started_at: string;
  finished_at: string | null;
  error_code: string | null;
  error_message: string | null;
}

export interface ExecutionResponse {
  id: string;
  workspace_id: string;
  action_draft_id: string;
  request_payload: Record<string, unknown>;
  provider_response: Record<string, unknown> | null;
  status: ExecutionStatus;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  idempotency_key: string;
  draft: {
    id: string;
    operator_intent: OperatorIntent;
    execution_type: ExecutionType;
    opportunity_id: string;
  };
  outcome: OutcomeResponse | null;
}

// ============================================================================
// OUTCOMES
// ============================================================================

export interface OutcomeResponse {
  id: string;
  execution_id: string;
  outcome: OutcomeType;
  computed_at: string;
  evidence: OutcomeEvidence;
}

// ============================================================================
// SHOPIFY CONNECTION
// ============================================================================

export interface ShopifyConnectionResponse {
  id: string;
  workspace_id: string;
  store_domain: string;
  scopes: string[];
  status: ShopifyConnectionStatus;
  installed_at: string;
  revoked_at: string | null;
  sync_state?: 'idle' | 'syncing' | 'completed' | 'failed';
  last_synced_at?: string | null;
}

export interface InitiateConnectionRequest {
  shop: string;
}

export interface InitiateConnectionResponse {
  authorization_url: string;
}

// ============================================================================
// CONFIDENCE SCORES
// ============================================================================

export interface ConfidenceScoreResponse {
  operator_intent: OperatorIntent;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  recent_executions: number;
  helped_count: number;
  neutral_count: number;
  hurt_count: number;
  last_computed_at: string;
}

export interface ConfidenceScoresResponse {
  scores: ConfidenceScoreResponse[];
  overall_confidence: number;
  computed_at: string;
}
