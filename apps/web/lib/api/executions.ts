/**
 * Executions API Client
 * API methods for execution tracking and history
 */

import { get, buildQueryString } from './client';
import type {
  ExecutionListParams,
  ExecutionSummary,
  ExecutionResponse,
  PaginatedResponse,
} from './types';

// ============================================================================
// EXECUTIONS API
// ============================================================================

/**
 * List executions with optional filters and pagination
 */
export async function listExecutions(
  params?: ExecutionListParams
): Promise<PaginatedResponse<ExecutionSummary>> {
  const queryString = buildQueryString(params as Record<string, unknown>);
  return get<PaginatedResponse<ExecutionSummary>>(`/executions${queryString}`);
}

/**
 * Get a single execution by ID with full details
 */
export async function getExecution(id: string): Promise<ExecutionResponse> {
  return get<ExecutionResponse>(`/executions/${id}`);
}
