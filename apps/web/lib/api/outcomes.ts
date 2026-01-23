/**
 * Outcomes API Client
 * API methods for outcome tracking and learning loop
 */

import { get } from './client';
import type { OutcomeResponse } from './types';

// ============================================================================
// OUTCOMES API
// ============================================================================

/**
 * List all outcomes (optionally filtered)
 * For now, outcomes are accessed through executions
 */
export async function listOutcomes(): Promise<OutcomeResponse[]> {
  return get<OutcomeResponse[]>('/outcomes');
}

/**
 * Get outcome for a specific execution
 */
export async function getOutcome(executionId: string): Promise<OutcomeResponse | null> {
  return get<OutcomeResponse | null>(`/outcomes/execution/${executionId}`);
}
