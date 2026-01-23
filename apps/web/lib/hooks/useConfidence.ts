/**
 * Confidence Hooks
 * React Query hooks for confidence scoring and learning loop insights
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { getConfidenceScores } from '../api/confidence';
import type { ConfidenceScoresResponse } from '../api/types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const confidenceKeys = {
  all: ['confidence'] as const,
  scores: () => [...confidenceKeys.all, 'scores'] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Hook to fetch confidence scores for all operator intents
 *
 * Shows how well the system is performing for each intent type based on
 * recent execution outcomes (helped/neutral/hurt).
 *
 * Useful for:
 * - Displaying trust indicators in UI
 * - Prioritizing opportunities based on confidence
 * - Identifying which intents need improvement
 */
export function useConfidenceScores(
  options?: Omit<UseQueryOptions<ConfidenceScoresResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: confidenceKeys.scores(),
    queryFn: () => getConfidenceScores(),
    // Confidence scores update less frequently, so we can cache longer
    staleTime: 1000 * 60 * 10, // 10 minutes
    ...options,
  });
}
