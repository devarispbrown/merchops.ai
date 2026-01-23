/**
 * Executions Hooks
 * React Query hooks for execution tracking and history
 */

'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { listExecutions, getExecution } from '../api/executions';
import type {
  ExecutionListParams,
  ExecutionSummary,
  ExecutionResponse,
  PaginatedResponse,
} from '../api/types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const executionKeys = {
  all: ['executions'] as const,
  lists: () => [...executionKeys.all, 'list'] as const,
  list: (params?: ExecutionListParams) => [...executionKeys.lists(), params] as const,
  details: () => [...executionKeys.all, 'detail'] as const,
  detail: (id: string) => [...executionKeys.details(), id] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Hook to fetch paginated list of executions
 */
export function useExecutionsList(
  params?: ExecutionListParams,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<ExecutionSummary>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: executionKeys.list(params),
    queryFn: () => listExecutions(params),
    // Refetch more frequently to catch status changes
    refetchInterval: 60000, // Every minute
    ...options,
  });
}

/**
 * Hook to fetch a single execution by ID with full details
 */
export function useExecution(
  id: string,
  options?: Omit<UseQueryOptions<ExecutionResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: executionKeys.detail(id),
    queryFn: () => getExecution(id),
    enabled: !!id,
    // Refetch more frequently for pending/running executions
    refetchInterval: (query) => {
      if (!query.state.data) return false;
      const isPending = query.state.data.status === 'pending' || query.state.data.status === 'running';
      return isPending ? 5000 : false; // 5 seconds for pending, no refetch for completed
    },
    ...options,
  });
}
