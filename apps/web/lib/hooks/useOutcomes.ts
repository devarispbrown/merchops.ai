/**
 * Outcomes Hooks
 * React Query hooks for outcome tracking and learning loop
 */

'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { listOutcomes, getOutcome } from '../api/outcomes';
import type { OutcomeResponse } from '../api/types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const outcomeKeys = {
  all: ['outcomes'] as const,
  lists: () => [...outcomeKeys.all, 'list'] as const,
  list: () => [...outcomeKeys.lists()] as const,
  details: () => [...outcomeKeys.all, 'detail'] as const,
  detail: (executionId: string) => [...outcomeKeys.details(), executionId] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Hook to fetch all outcomes
 */
export function useOutcomesList(
  options?: Omit<UseQueryOptions<OutcomeResponse[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: outcomeKeys.list(),
    queryFn: () => listOutcomes(),
    // Outcomes are computed async, so refetch periodically
    refetchInterval: 60000, // Every minute
    ...options,
  });
}

/**
 * Hook to fetch outcome for a specific execution
 */
export function useOutcome(
  executionId: string,
  options?: Omit<UseQueryOptions<OutcomeResponse | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: outcomeKeys.detail(executionId),
    queryFn: () => getOutcome(executionId),
    enabled: !!executionId,
    // Outcomes don't change once computed, but may not exist yet
    staleTime: 60000,
    ...options,
  });
}
