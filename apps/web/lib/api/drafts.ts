/**
 * Drafts API Client
 * API methods for action draft management
 */

import { get, post, patch, buildQueryString } from './client';
import type {
  DraftListParams,
  ActionDraftSummary,
  ActionDraftResponse,
  CreateDraftRequest,
  UpdateDraftRequest,
  ApproveDraftRequest,
  PaginatedResponse,
} from './types';

// ============================================================================
// DRAFTS API
// ============================================================================

/**
 * List action drafts with optional filters and pagination
 */
export async function listDrafts(
  params?: DraftListParams
): Promise<PaginatedResponse<ActionDraftSummary>> {
  const queryString = buildQueryString(params as Record<string, unknown>);
  return get<PaginatedResponse<ActionDraftSummary>>(`/drafts${queryString}`);
}

/**
 * Get a single draft by ID with full details
 */
export async function getDraft(id: string): Promise<ActionDraftResponse> {
  return get<ActionDraftResponse>(`/drafts/${id}`);
}

/**
 * Create a new draft from an opportunity
 */
export async function createDraft(
  data: CreateDraftRequest
): Promise<ActionDraftResponse> {
  return post<ActionDraftResponse>('/drafts', data);
}

/**
 * Update a draft's editable fields
 */
export async function updateDraft(
  id: string,
  data: UpdateDraftRequest
): Promise<ActionDraftResponse> {
  return patch<ActionDraftResponse>(`/drafts/${id}`, data);
}

/**
 * Approve a draft for execution
 * Creates an execution record and enqueues the action
 */
export async function approveDraft(
  id: string,
  data: ApproveDraftRequest
): Promise<ActionDraftResponse> {
  return post<ActionDraftResponse>(`/drafts/${id}/approve`, data);
}
