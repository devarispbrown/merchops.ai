/**
 * Opportunity Types
 *
 * Defines opportunity types, states, and related structures.
 */

import {
  OpportunityState,
  PriorityBucket,
  OperatorIntent,
  Opportunity as PrismaOpportunity,
  Event,
} from '@prisma/client';

export { OpportunityState, PriorityBucket, OperatorIntent };

// ============================================================================
// OPPORTUNITY TYPES
// ============================================================================

/**
 * High-level opportunity types
 * Maps to specific operator intents and actions
 */
export enum OpportunityType {
  INVENTORY_CLEARANCE = 'inventory_clearance',
  STOCKOUT_PREVENTION = 'stockout_prevention',
  RESTOCK_NOTIFICATION = 'restock_notification',
  WINBACK_CAMPAIGN = 'winback_campaign',
  HIGH_VELOCITY_PROTECTION = 'high_velocity_protection',
}

// ============================================================================
// OPPORTUNITY CREATION INPUT
// ============================================================================

export interface CreateOpportunityInput {
  workspace_id: string;
  type: OpportunityType;
  event_ids: string[];
  operator_intent: OperatorIntent;
  priority_bucket?: PriorityBucket; // Auto-calculated if not provided
  why_now: string;
  rationale: string;
  impact_range: string;
  counterfactual: string;
  decay_at?: Date;
  confidence?: number;
}

// ============================================================================
// OPPORTUNITY WITH EVENTS
// ============================================================================

export interface OpportunityWithEvents extends PrismaOpportunity {
  events: Event[];
}

// ============================================================================
// PRIORITY SCORING
// ============================================================================

export interface PriorityScore {
  bucket: PriorityBucket;
  score: number; // 0-100
  factors: {
    urgency: number; // 0-1
    consequence: number; // 0-1
    confidence: number; // 0-1
    novelty: number; // 0-1
  };
}

// ============================================================================
// AI GENERATION INPUT/OUTPUT
// ============================================================================

export interface OpportunityAiInput {
  workspace_id: string;
  opportunity_type: OpportunityType;
  event_data: any[];
  product_context?: any;
  customer_context?: any;
  store_history?: any;
}

export interface OpportunityAiOutput {
  why_now: string;
  rationale: string;
  counterfactual: string;
  impact_range: string;
}

// ============================================================================
// DECAY CONFIGURATION
// ============================================================================

export interface DecayConfig {
  hours_to_decay: number;
  decay_reason: string;
}

/**
 * Decay configurations by opportunity type
 */
export const DECAY_CONFIGS: Record<OpportunityType, DecayConfig> = {
  [OpportunityType.INVENTORY_CLEARANCE]: {
    hours_to_decay: 72, // 3 days
    decay_reason: 'Inventory condition may have changed',
  },
  [OpportunityType.STOCKOUT_PREVENTION]: {
    hours_to_decay: 48, // 2 days
    decay_reason: 'Urgent action window passed',
  },
  [OpportunityType.RESTOCK_NOTIFICATION]: {
    hours_to_decay: 24, // 1 day
    decay_reason: 'Restock momentum window closed',
  },
  [OpportunityType.WINBACK_CAMPAIGN]: {
    hours_to_decay: 168, // 7 days
    decay_reason: 'Customer engagement window passed',
  },
  [OpportunityType.HIGH_VELOCITY_PROTECTION]: {
    hours_to_decay: 36, // 1.5 days
    decay_reason: 'Velocity spike window passed',
  },
};

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

/**
 * Valid state transitions
 */
export const VALID_TRANSITIONS: Record<OpportunityState, OpportunityState[]> = {
  [OpportunityState.new]: [
    OpportunityState.viewed,
    OpportunityState.dismissed,
    OpportunityState.expired,
  ],
  [OpportunityState.viewed]: [
    OpportunityState.approved,
    OpportunityState.dismissed,
    OpportunityState.expired,
  ],
  [OpportunityState.approved]: [
    OpportunityState.executed,
    OpportunityState.dismissed,
  ],
  [OpportunityState.executed]: [OpportunityState.resolved],
  [OpportunityState.resolved]: [], // Terminal state
  [OpportunityState.dismissed]: [], // Terminal state
  [OpportunityState.expired]: [], // Terminal state
};

// ============================================================================
// FILTERS AND QUERIES
// ============================================================================

export interface OpportunityFilters {
  state?: OpportunityState | OpportunityState[];
  priority_bucket?: PriorityBucket | PriorityBucket[];
  type?: OpportunityType | OpportunityType[];
  created_after?: Date;
  created_before?: Date;
  include_expired?: boolean;
}

export interface OpportunityListQuery extends OpportunityFilters {
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'priority_bucket' | 'decay_at';
  order_direction?: 'asc' | 'desc';
}
