/**
 * Opportunity types for MerchOps
 *
 * Opportunities are ranked, explainable suggestions derived from events.
 * Each opportunity includes why-now, counterfactual, and decay behavior.
 */

/**
 * Opportunity type enumeration
 * Maps to operator intents
 */
export enum OpportunityType {
  /** Reduce inventory risk with discount or promotion */
  REDUCE_INVENTORY_RISK = 'reduce_inventory_risk',

  /** Re-engage dormant customers with win-back campaign */
  REENGAGE_DORMANT_CUSTOMERS = 'reengage_dormant_customers',

  /** Protect margin on high-performing products */
  PROTECT_MARGIN = 'protect_margin',

  /** Capitalize on velocity spike with promotion */
  CAPITALIZE_ON_MOMENTUM = 'capitalize_on_momentum',

  /** Pause product to avoid overselling */
  PREVENT_OVERSELL = 'prevent_oversell',
}

/**
 * Priority bucket enumeration
 * Deterministic ranking of opportunity urgency
 */
export enum PriorityBucket {
  /** High priority: urgent, high impact, high confidence */
  HIGH = 'high',

  /** Medium priority: moderate urgency or impact */
  MEDIUM = 'medium',

  /** Low priority: low urgency or low confidence */
  LOW = 'low',
}

/**
 * Opportunity state enumeration
 * Tracks lifecycle from creation to resolution
 */
export enum OpportunityState {
  /** Newly created, not yet viewed */
  NEW = 'new',

  /** Viewed by operator */
  VIEWED = 'viewed',

  /** Action draft approved, queued for execution */
  APPROVED = 'approved',

  /** Execution completed */
  EXECUTED = 'executed',

  /** Resolved with outcome */
  RESOLVED = 'resolved',

  /** Dismissed by operator */
  DISMISSED = 'dismissed',

  /** Expired based on decay policy */
  EXPIRED = 'expired',
}

/**
 * Impact range estimation
 * Directional, non-guaranteed projection
 */
export interface ImpactRange {
  /** Metric being impacted (e.g., "revenue", "units_sold", "stockout_risk") */
  metric: string;

  /** Low end of range */
  min: number;

  /** High end of range */
  max: number;

  /** Unit of measurement (e.g., "USD", "units", "percentage_points") */
  unit: string;

  /** Time window for impact (e.g., "7 days", "30 days") */
  timeWindow: string;
}

/**
 * Confidence score
 * Based on historical outcomes and data quality
 */
export interface ConfidenceScore {
  /** Confidence value (0.0 - 1.0) */
  score: number;

  /** Factors contributing to confidence */
  factors: Array<{
    name: string;
    weight: number;
    description: string;
  }>;

  /** Number of similar historical opportunities */
  historicalSampleSize?: number;
}

/**
 * Core opportunity entity
 */
export interface Opportunity {
  /** Unique opportunity identifier */
  id: string;

  /** Associated workspace ID */
  workspaceId: string;

  /** Opportunity type/intent */
  type: OpportunityType;

  /** Priority bucket for ranking */
  priorityBucket: PriorityBucket;

  /**
   * Why-now explanation
   * Explicit, non-generic reason this opportunity surfaced now
   */
  whyNow: string;

  /**
   * Rationale
   * Plain language, store-specific explanation of the opportunity
   */
  rationale: string;

  /**
   * Counterfactual
   * What likely happens if no action is taken
   */
  counterfactual: string;

  /**
   * Expected impact range
   * Directional projection, not a guarantee
   */
  impactRange: ImpactRange | null;

  /**
   * Decay timestamp
   * When opportunity expires or degrades in priority
   */
  decayAt: Date;

  /**
   * Confidence score
   * Based on historical data and signal quality
   */
  confidence: ConfidenceScore;

  /** Current state in lifecycle */
  state: OpportunityState;

  /** Opportunity creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /**
   * Optional dismissal reason
   * Captured when operator dismisses
   */
  dismissalReason: string | null;

  /**
   * Optional metadata
   * For versioning, debugging, A/B tests
   */
  metadata?: Record<string, unknown>;
}

/**
 * Opportunity with associated events
 * Used for full context display
 */
export interface OpportunityWithEvents extends Opportunity {
  /** Events that triggered this opportunity */
  events: Array<{
    id: string;
    type: string;
    occurredAt: Date;
    payload: Record<string, unknown>;
  }>;
}

/**
 * Opportunity with action drafts
 * Used in approval queue
 */
export interface OpportunityWithDrafts extends Opportunity {
  /** Associated action drafts */
  drafts: Array<{
    id: string;
    executionType: string;
    state: string;
    createdAt: Date;
  }>;
}

/**
 * Input for creating a new opportunity
 */
export interface CreateOpportunityInput {
  /** Workspace ID (required) */
  workspaceId: string;

  /** Opportunity type (required) */
  type: OpportunityType;

  /** Priority bucket (required) */
  priorityBucket: PriorityBucket;

  /** Why-now explanation (required) */
  whyNow: string;

  /** Rationale (required) */
  rationale: string;

  /** Counterfactual (required) */
  counterfactual: string;

  /** Impact range (optional) */
  impactRange?: ImpactRange;

  /** Decay timestamp (required) */
  decayAt: Date;

  /** Confidence score (required) */
  confidence: ConfidenceScore;

  /** Event IDs that triggered this opportunity (required) */
  eventIds: string[];

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating opportunity state
 */
export interface UpdateOpportunityInput {
  /** New state (optional) */
  state?: OpportunityState;

  /** Dismissal reason (required if state is DISMISSED) */
  dismissalReason?: string;

  /** Updated metadata (optional) */
  metadata?: Record<string, unknown>;
}

/**
 * Opportunity query filters
 */
export interface OpportunityQueryFilters {
  /** Filter by workspace ID */
  workspaceId: string;

  /** Filter by opportunity types */
  types?: OpportunityType[];

  /** Filter by priority buckets */
  priorityBuckets?: PriorityBucket[];

  /** Filter by states */
  states?: OpportunityState[];

  /** Filter by minimum confidence score */
  minConfidence?: number;

  /** Filter opportunities created after timestamp */
  createdAfter?: Date;

  /** Filter opportunities decaying before timestamp */
  decayBefore?: Date;

  /** Sort order: 'priority' | 'created_at' | 'decay_at' */
  sortBy?: 'priority' | 'created_at' | 'decay_at';

  /** Sort direction: 'asc' | 'desc' */
  sortDirection?: 'asc' | 'desc';

  /** Pagination: limit */
  limit?: number;

  /** Pagination: offset */
  offset?: number;
}

/**
 * Opportunity summary statistics
 * For dashboard metrics
 */
export interface OpportunitySummary {
  /** Total opportunities by state */
  byState: Record<OpportunityState, number>;

  /** Total opportunities by priority bucket */
  byPriority: Record<PriorityBucket, number>;

  /** Total opportunities by type */
  byType: Record<OpportunityType, number>;

  /** Average confidence score */
  averageConfidence: number;

  /** Opportunities expiring soon (within 24 hours) */
  expiringCount: number;
}
