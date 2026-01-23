/**
 * Drafts Hooks
 * React Query hooks for action draft management
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import {
  listDrafts,
  getDraft,
  createDraft,
  updateDraft,
  approveDraft,
} from '../api/drafts';
import type {
  DraftListParams,
  ActionDraftSummary,
  ActionDraftResponse,
  CreateDraftRequest,
  UpdateDraftRequest,
  ApproveDraftRequest,
  PaginatedResponse,
} from '../api/types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const draftKeys = {
  all: ['drafts'] as const,
  lists: () => [...draftKeys.all, 'list'] as const,
  list: (params?: DraftListParams) => [...draftKeys.lists(), params] as const,
  details: () => [...draftKeys.all, 'detail'] as const,
  detail: (id: string) => [...draftKeys.details(), id] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Hook to fetch paginated list of drafts
 */
export function useDraftsList(
  params?: DraftListParams,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<ActionDraftSummary>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: draftKeys.list(params),
    queryFn: () => listDrafts(params),
    ...options,
  });
}

/**
 * Hook to fetch a single draft by ID
 */
export function useDraft(
  id: string,
  options?: Omit<UseQueryOptions<ActionDraftResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: draftKeys.detail(id),
    queryFn: () => getDraft(id),
    enabled: !!id,
    ...options,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Hook to create a new draft from an opportunity
 */
export function useCreateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDraftRequest) => createDraft(data),
    onSuccess: (newDraft) => {
      // Invalidate drafts list to refetch
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });

      // Add new draft to cache
      queryClient.setQueryData(draftKeys.detail(newDraft.id), newDraft);
    },
  });
}

/**
 * Hook to update a draft's editable fields
 */
export function useUpdateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDraftRequest }) =>
      updateDraft(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: draftKeys.detail(id) });

      // Snapshot previous value
      const previousDraft = queryClient.getQueryData<ActionDraftResponse>(
        draftKeys.detail(id)
      );

      // Optimistically update the draft
      if (previousDraft) {
        queryClient.setQueryData<ActionDraftResponse>(draftKeys.detail(id), {
          ...previousDraft,
          payload: { ...previousDraft.payload, ...data.updates },
          state: 'edited',
          updated_at: new Date().toISOString(),
        });
      }

      // Return context with previous value
      return { previousDraft };
    },
    onError: (err, { id }, context) => {
      // Rollback to previous value on error
      if (context?.previousDraft) {
        queryClient.setQueryData(draftKeys.detail(id), context.previousDraft);
      }
    },
    onSuccess: (updatedDraft, { id }) => {
      // Update cache with server response
      queryClient.setQueryData(draftKeys.detail(id), updatedDraft);

      // Invalidate list to ensure consistency
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
  });
}

/**
 * Hook to approve a draft for execution
 */
export function useApproveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveDraftRequest }) =>
      approveDraft(id, data),
    onSuccess: (approvedDraft, { id }) => {
      // Update cache with approved draft
      queryClient.setQueryData(draftKeys.detail(id), approvedDraft);

      // Invalidate lists and related queries
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });
}
