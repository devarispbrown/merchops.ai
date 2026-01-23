/**
 * Outcome types for MerchOps
 *
 * Outcomes represent the learning loop: did the action help, hurt, or have neutral effect?
 * Each outcome includes evidence and contributes to confidence scoring.
 */

/**
 * Outcome type enumeration
 * Tri-state assessment of action effectiveness
 */
export enum OutcomeType {
  /** Action produced measurable positive impact */
  HELPED = 'helped',

  /** Action had no significant impact (baseline) */
  NEUTRAL = 'neutral',

  /** Action produced measurable negative impact */
  HURT = 'hurt',
}

/**
 * Evidence type for outcome determination
 */
export enum EvidenceType {
  /** Revenue/conversion uplift vs baseline */
  REVENUE_UPLIFT = 'revenue_uplift',

  /** Order volume change vs baseline */
  ORDER_VOLUME_CHANGE = 'order_volume_change',

  /** Email engagement (open/click/convert rates) */
  EMAIL_ENGAGEMENT = 'email_engagement',

  /** Inventory turnover improvement */
  INVENTORY_TURNOVER = 'inventory_turnover',

  /** Customer re-engagement success */
  CUSTOMER_REENGAGEMENT = 'customer_reengagement',

  /** Stockout/backorder prevention */
  STOCKOUT_PREVENTION = 'stockout_prevention',

  /** Margin protection */
  MARGIN_PROTECTION = 'margin_protection',

  /** Manual operator feedback */
  MANUAL_ASSESSMENT = 'manual_assessment',
}

/**
 * Metric comparison for evidence
 */
export interface MetricComparison {
  /** Metric name (e.g., "revenue", "conversion_rate", "open_rate") */
  metric: string;

  /** Baseline value (before action) */
  baseline: number;

  /** Actual value (after action) */
  actual: number;

  /** Percentage change (positive or negative) */
  percentageChange: number;

  /** Unit of measurement */
  unit: string;

  /** Time window for comparison (e.g., "7 days", "14 days") */
  timeWindow: string;

  /** Statistical significance (p-value, if calculated) */
  significance?: number;
}

/**
 * Evidence for outcome determination
 * Contains raw data and computed metrics
 */
export interface OutcomeEvidence {
  /** Evidence type */
  type: EvidenceType;

  /** Metric comparisons */
  metrics: MetricComparison[];

  /** Human-readable summary */
  summary: string;

  /** Data collection timestamp range */
  collectedFrom: Date;
  collectedTo: Date;

  /**
   * Confidence in evidence quality
   * 0.0 = low confidence (small sample, noisy data)
   * 1.0 = high confidence (large sample, clean data)
   */
  confidence: number;

  /**
   * Raw data snapshot
   * For debugging and auditing
   */
  rawData?: Record<string, unknown>;
}

/**
 * Confidence score breakdown
 */
export interface ConfidenceScore {
  /** Overall confidence (0.0 - 1.0) */
  overall: number;

  /** Factors contributing to score */
  factors: Array<{
    /** Factor name */
    name: string;

    /** Factor score (0.0 - 1.0) */
    score: number;

    /** Factor weight in overall calculation */
    weight: number;

    /** Description of factor */
    description: string;
  }>;

  /** Historical sample size for this intent */
  sampleSize: number;

  /** Score computation timestamp */
  computedAt: Date;
}

/**
 * Core outcome entity
 */
export interface Outcome {
  /** Unique outcome identifier */
  id: string;

  /** Associated execution ID */
  executionId: string;

  /** Outcome type (helped/neutral/hurt) */
  outcome: OutcomeType;

  /** Outcome computation timestamp */
  computedAt: Date;

  /**
   * Evidence supporting outcome determination
   * Multiple evidence types can contribute
   */
  evidence: OutcomeEvidence[];

  /**
   * Confidence in outcome determination
   * Based on evidence quality and sample size
   */
  confidence: ConfidenceScore;

  /**
   * Optional operator override
   * If operator manually assesses outcome
   */
  operatorOverride: {
    overriddenBy: string; // user ID
    overriddenAt: Date;
    originalOutcome: OutcomeType;
    reason: string;
  } | null;

  /** Outcome creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /**
   * Optional metadata
   * For versioning, debugging, A/B tests
   */
  metadata?: Record<string, unknown>;
}

/**
 * Outcome with execution context
 */
export interface OutcomeWithExecution extends Outcome {
  /** Associated execution */
  execution: {
    id: string;
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    requestPayload: Record<string, unknown>;
  };
}

/**
 * Outcome with full action context
 */
export interface OutcomeWithAction extends OutcomeWithExecution {
  /** Associated action draft */
  draft: {
    id: string;
    operatorIntent: string;
    executionType: string;
  };

  /** Associated opportunity */
  opportunity: {
    id: string;
    type: string;
    priorityBucket: string;
  };
}

/**
 * Input for creating a new outcome
 */
export interface CreateOutcomeInput {
  /** Execution ID (required) */
  executionId: string;

  /** Outcome type (required) */
  outcome: OutcomeType;

  /** Evidence (required, at least one) */
  evidence: OutcomeEvidence[];

  /** Confidence score (required) */
  confidence: ConfidenceScore;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for operator override of outcome
 */
export interface OverrideOutcomeInput {
  /** Outcome ID to override */
  outcomeId: string;

  /** New outcome type */
  newOutcome: OutcomeType;

  /** User ID performing override */
  overriddenBy: string;

  /** Reason for override */
  reason: string;
}

/**
 * Outcome query filters
 */
export interface OutcomeQueryFilters {
  /** Filter by execution IDs */
  executionIds?: string[];

  /** Filter by outcome types */
  outcomes?: OutcomeType[];

  /** Filter by evidence types */
  evidenceTypes?: EvidenceType[];

  /** Filter by minimum confidence */
  minConfidence?: number;

  /** Filter outcomes computed after timestamp */
  computedAfter?: Date;

  /** Include only operator overrides */
  overridesOnly?: boolean;

  /** Sort by: 'computed_at' | 'confidence' */
  sortBy?: 'computed_at' | 'confidence';

  /** Sort direction: 'asc' | 'desc' */
  sortDirection?: 'asc' | 'desc';

  /** Pagination: limit */
  limit?: number;

  /** Pagination: offset */
  offset?: number;
}

/**
 * Outcome statistics by operator intent
 * For confidence scoring and learning
 */
export interface OutcomeStatsByIntent {
  /** Operator intent */
  operatorIntent: string;

  /** Execution type */
  executionType: string;

  /** Total outcomes by type */
  byOutcome: Record<OutcomeType, number>;

  /** Average confidence score */
  averageConfidence: number;

  /** Success rate (helped / total) */
  successRate: number;

  /** Failure rate (hurt / total) */
  failureRate: number;

  /** Neutral rate */
  neutralRate: number;

  /** Total outcome count */
  totalCount: number;

  /** Computation timestamp */
  computedAt: Date;

  /** Time window for stats (e.g., "30 days", "90 days") */
  timeWindow: string;
}

/**
 * Intent confidence update
 * Recomputed confidence based on recent outcomes
 */
export interface IntentConfidenceUpdate {
  /** Operator intent */
  operatorIntent: string;

  /** Previous confidence score */
  previousConfidence: number;

  /** New confidence score */
  newConfidence: number;

  /** Change in confidence */
  confidenceChange: number;

  /** Factors contributing to change */
  changeFacts: string[];

  /** Update timestamp */
  updatedAt: Date;
}
