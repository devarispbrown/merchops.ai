/**
 * Opportunities Hooks
 * React Query hooks for opportunity management
 */

'use client';

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import {
  listOpportunities,
  getOpportunity,
  dismissOpportunity,
  viewOpportunity,
} from '../api/opportunities';
import type {
  OpportunityListParams,
  OpportunityResponse,
  OpportunityDetailResponse,
  PaginatedResponse,
} from '../api/types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const opportunityKeys = {
  all: ['opportunities'] as const,
  lists: () => [...opportunityKeys.all, 'list'] as const,
  list: (params?: OpportunityListParams) => [...opportunityKeys.lists(), params] as const,
  details: () => [...opportunityKeys.all, 'detail'] as const,
  detail: (id: string) => [...opportunityKeys.details(), id] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Hook to fetch paginated list of opportunities
 */
export function useOpportunitiesList(
  params?: OpportunityListParams,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<OpportunityResponse>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: opportunityKeys.list(params),
    queryFn: () => listOpportunities(params),
    ...options,
  });
}

/**
 * Hook to fetch a single opportunity by ID with full details
 */
export function useOpportunity(
  id: string,
  options?: Omit<UseQueryOptions<OpportunityDetailResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: opportunityKeys.detail(id),
    queryFn: () => getOpportunity(id),
    enabled: !!id,
    ...options,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Hook to dismiss an opportunity
 * Prevents it from showing again unless inputs materially change
 */
export function useDismissOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => dismissOpportunity(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: opportunityKeys.detail(id) });

      // Snapshot previous value
      const previousOpportunity = queryClient.getQueryData<OpportunityDetailResponse>(
        opportunityKeys.detail(id)
      );

      // Optimistically update state
      if (previousOpportunity) {
        queryClient.setQueryData<OpportunityDetailResponse>(
          opportunityKeys.detail(id),
          {
            ...previousOpportunity,
            state: 'dismissed',
            updated_at: new Date().toISOString(),
          }
        );
      }

      return { previousOpportunity };
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousOpportunity) {
        queryClient.setQueryData(
          opportunityKeys.detail(id),
          context.previousOpportunity
        );
      }
    },
    onSuccess: (_, id) => {
      // Invalidate lists and detail
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(id) });
    },
  });
}

/**
 * Hook to mark an opportunity as viewed
 * Transitions state from new -> viewed
 */
export function useViewOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => viewOpportunity(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: opportunityKeys.detail(id) });

      // Snapshot previous value
      const previousOpportunity = queryClient.getQueryData<OpportunityDetailResponse>(
        opportunityKeys.detail(id)
      );

      // Optimistically update state (only if currently 'new')
      if (previousOpportunity && previousOpportunity.state === 'new') {
        queryClient.setQueryData<OpportunityDetailResponse>(
          opportunityKeys.detail(id),
          {
            ...previousOpportunity,
            state: 'viewed',
            updated_at: new Date().toISOString(),
          }
        );
      }

      return { previousOpportunity };
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousOpportunity) {
        queryClient.setQueryData(
          opportunityKeys.detail(id),
          context.previousOpportunity
        );
      }
    },
    onSuccess: (_, id) => {
      // Invalidate lists and detail
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(id) });
    },
  });
}
