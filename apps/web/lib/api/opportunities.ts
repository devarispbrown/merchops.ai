/**
 * Opportunities API Client
 * API methods for opportunity management
 */

import { get, patch, buildQueryString } from './client';
import type {
  OpportunityListParams,
  OpportunityResponse,
  OpportunityDetailResponse,
  PaginatedResponse,
} from './types';

// ============================================================================
// OPPORTUNITIES API
// ============================================================================

/**
 * List opportunities with optional filters and pagination
 */
export async function listOpportunities(
  params?: OpportunityListParams
): Promise<PaginatedResponse<OpportunityResponse>> {
  const queryString = buildQueryString(params as Record<string, unknown>);
  return get<PaginatedResponse<OpportunityResponse>>(
    `/opportunities${queryString}`
  );
}

/**
 * Get a single opportunity by ID with full details
 */
export async function getOpportunity(
  id: string
): Promise<OpportunityDetailResponse> {
  return get<OpportunityDetailResponse>(`/opportunities/${id}`);
}

/**
 * Dismiss an opportunity (prevents it from showing again unless inputs change)
 */
export async function dismissOpportunity(id: string): Promise<void> {
  await patch(`/opportunities/${id}`, { state: 'dismissed' });
}

/**
 * Mark an opportunity as viewed (state transition: new -> viewed)
 */
export async function viewOpportunity(id: string): Promise<void> {
  await patch(`/opportunities/${id}`, { state: 'viewed' });
}
