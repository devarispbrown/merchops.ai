/**
 * Confidence API Client
 * API methods for confidence scoring and learning loop insights
 */

import { get } from './client';
import type { ConfidenceScoresResponse } from './types';

// ============================================================================
// CONFIDENCE API
// ============================================================================

/**
 * Get confidence scores for all operator intents
 * Shows how well the system is performing for each intent type
 */
export async function getConfidenceScores(): Promise<ConfidenceScoresResponse> {
  return get<ConfidenceScoresResponse>('/confidence/scores');
}
