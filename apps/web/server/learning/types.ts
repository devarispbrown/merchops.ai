/**
 * Learning Loop Types
 *
 * Core types for the MerchOps learning system:
 * - Outcome tracking (helped/neutral/hurt)
 * - Evidence storage
 * - Confidence scoring
 */

import { OutcomeType as PrismaOutcomeType, OperatorIntent } from '@prisma/client';

/**
 * Outcome type enum
 * Represents the assessed impact of an executed action
 */
export enum OutcomeType {
  HELPED = 'helped',
  NEUTRAL = 'neutral',
  HURT = 'hurt',
}

/**
 * Maps Prisma enum to application enum
 */
export function toPrismaOutcomeType(outcome: OutcomeType): PrismaOutcomeType {
  switch (outcome) {
    case OutcomeType.HELPED:
      return 'helped';
    case OutcomeType.NEUTRAL:
      return 'neutral';
    case OutcomeType.HURT:
      return 'hurt';
  }
}

/**
 * Maps Prisma enum to application enum
 */
export function fromPrismaOutcomeType(outcome: PrismaOutcomeType): OutcomeType {
  switch (outcome) {
    case 'helped':
      return OutcomeType.HELPED;
    case 'neutral':
      return OutcomeType.NEUTRAL;
    case 'hurt':
      return OutcomeType.HURT;
  }
}

/**
 * Comparison window for baseline metrics
 */
export interface ComparisonWindow {
  start: Date;
  end: Date;
  metric_name: string;
  value: number;
}

/**
 * Observation window for measuring outcome
 */
export interface ObservationWindow {
  start: Date;
  end: Date;
  metric_name: string;
  value: number;
}

/**
 * Evidence supporting an outcome determination
 * Stored as JSON in the outcomes table
 */
export interface OutcomeEvidence {
  // Comparison baseline
  baseline_window: ComparisonWindow;

  // Observation period
  observation_window: ObservationWindow;

  // Metrics
  baseline_value: number;
  observed_value: number;
  delta: number;
  delta_percentage: number;

  // Thresholds used for determination
  helped_threshold: number; // e.g., +10% improvement
  hurt_threshold: number; // e.g., -5% degradation

  // Additional context
  sample_size?: number;
  confidence_level?: number; // Statistical confidence if applicable
  notes?: string;

  // Properties expected by UI components
  baseline?: Record<string, unknown>;
  result?: Record<string, unknown>;
  summary?: string;
  context?: Record<string, unknown>;
}

/**
 * Confidence score for an operator intent
 * Based on recent outcome track record
 */
export interface ConfidenceScore {
  operator_intent: OperatorIntent;
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  recent_executions: number;
  helped_count: number;
  neutral_count: number;
  hurt_count: number;
  last_computed_at: Date;
}

/**
 * Track record summary
 */
export interface TrackRecord {
  operator_intent: OperatorIntent;
  total_executions: number;
  helped_count: number;
  neutral_count: number;
  hurt_count: number;
  success_rate: number; // (helped / total)
  harm_rate: number; // (hurt / total)
  recent_outcomes: Array<{
    execution_id: string;
    outcome: OutcomeType;
    computed_at: Date;
  }>;
}

/**
 * Outcome computation input
 */
export interface OutcomeComputationInput {
  execution_id: string;
  workspace_id: string;
  operator_intent: OperatorIntent;
  execution_type: string;
  execution_payload: Record<string, any>;
  executed_at: Date;
}

/**
 * Outcome computation result
 */
export interface OutcomeComputationResult {
  outcome: OutcomeType;
  evidence: OutcomeEvidence;
  computed_at: Date;
}
