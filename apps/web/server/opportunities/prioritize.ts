/**
 * Opportunity Prioritization
 *
 * Deterministic priority calculation based on urgency, consequence,
 * confidence, and novelty.
 */

import { Event, PriorityBucket } from '@prisma/client';
import { OpportunityType, PriorityScore } from './types';

// ============================================================================
// PRIORITY WEIGHTS
// ============================================================================

const PRIORITY_WEIGHTS = {
  urgency: 0.35,
  consequence: 0.30,
  confidence: 0.20,
  novelty: 0.15,
};

// ============================================================================
// PRIORITY CALCULATION
// ============================================================================

interface PriorityInput {
  opportunity_type: OpportunityType;
  events: Event[];
  confidence: number;
  previous_opportunity_count?: number; // For novelty calculation
}

/**
 * Calculates priority score for an opportunity
 * Returns deterministic score and bucket assignment
 */
export async function calculatePriority(
  input: PriorityInput
): Promise<PriorityScore> {
  const { opportunity_type, events, confidence, previous_opportunity_count = 0 } =
    input;

  // Calculate individual factors
  const urgency = calculateUrgency(opportunity_type, events);
  const consequence = calculateConsequence(opportunity_type, events);
  const novelty = calculateNovelty(previous_opportunity_count);

  // Calculate weighted score (0-100)
  const score =
    urgency * PRIORITY_WEIGHTS.urgency * 100 +
    consequence * PRIORITY_WEIGHTS.consequence * 100 +
    confidence * PRIORITY_WEIGHTS.confidence * 100 +
    novelty * PRIORITY_WEIGHTS.novelty * 100;

  // Assign bucket
  const bucket = assignPriorityBucket(score);

  return {
    bucket,
    score: parseFloat(score.toFixed(2)),
    factors: {
      urgency: parseFloat(urgency.toFixed(3)),
      consequence: parseFloat(consequence.toFixed(3)),
      confidence: parseFloat(confidence.toFixed(3)),
      novelty: parseFloat(novelty.toFixed(3)),
    },
  };
}

// ============================================================================
// FACTOR CALCULATIONS
// ============================================================================

/**
 * Calculates urgency factor (0-1)
 * Based on time sensitivity and decay window
 */
function calculateUrgency(
  opportunity_type: OpportunityType,
  events: Event[]
): number {
  switch (opportunity_type) {
    case OpportunityType.STOCKOUT_PREVENTION:
      // Out of stock is urgent
      return 1.0;

    case OpportunityType.HIGH_VELOCITY_PROTECTION:
      // Velocity spikes are time-sensitive
      return calculateVelocityUrgency(events);

    case OpportunityType.INVENTORY_CLEARANCE:
      // Moderate urgency based on inventory level
      return calculateInventoryUrgency(events);

    case OpportunityType.RESTOCK_NOTIFICATION:
      // Time-sensitive but not critical
      return 0.7;

    case OpportunityType.WINBACK_CAMPAIGN:
      // Lower urgency, longer window
      return calculateWinbackUrgency(events);

    default:
      return 0.5;
  }
}

/**
 * Calculates consequence magnitude (0-1)
 * Based on potential impact of action or inaction
 */
function calculateConsequence(
  opportunity_type: OpportunityType,
  events: Event[]
): number {
  switch (opportunity_type) {
    case OpportunityType.HIGH_VELOCITY_PROTECTION:
      // High consequence - losing hot product sales
      return calculateVelocityConsequence(events);

    case OpportunityType.STOCKOUT_PREVENTION:
      // High consequence - customer disappointment
      return 0.85;

    case OpportunityType.INVENTORY_CLEARANCE:
      // Moderate consequence - holding costs
      return calculateInventoryConsequence(events);

    case OpportunityType.WINBACK_CAMPAIGN:
      // Moderate consequence - customer LTV
      return calculateWinbackConsequence(events);

    case OpportunityType.RESTOCK_NOTIFICATION:
      // Lower consequence - optional upsell
      return 0.5;

    default:
      return 0.5;
  }
}

/**
 * Calculates novelty factor (0-1)
 * Higher for first-time opportunities, lower for repeated ones
 */
function calculateNovelty(previous_count: number): number {
  if (previous_count === 0) {
    return 1.0; // First time seeing this type
  }

  if (previous_count === 1) {
    return 0.8;
  }

  if (previous_count <= 3) {
    return 0.6;
  }

  if (previous_count <= 5) {
    return 0.4;
  }

  // Diminishing returns for repeated opportunities
  return Math.max(0.2, 1.0 / Math.log10(previous_count + 2));
}

// ============================================================================
// TYPE-SPECIFIC CALCULATIONS
// ============================================================================

/**
 * Calculates urgency for velocity spike events
 */
function calculateVelocityUrgency(events: Event[]): number {
  const latestEvent = events[0];
  if (!latestEvent) return 0.5;

  const payload = latestEvent.payload_json as any;
  const daysToStockout = payload.estimated_days_to_stockout || 999;

  if (daysToStockout <= 1) return 1.0;
  if (daysToStockout <= 2) return 0.9;
  if (daysToStockout <= 3) return 0.8;
  if (daysToStockout <= 5) return 0.7;
  if (daysToStockout <= 7) return 0.6;

  return 0.5;
}

/**
 * Calculates consequence for velocity spike events
 */
function calculateVelocityConsequence(events: Event[]): number {
  const latestEvent = events[0];
  if (!latestEvent) return 0.5;

  const payload = latestEvent.payload_json as any;
  const spikeMultiplier = payload.spike_multiplier || 1;

  // Higher spike = higher consequence
  if (spikeMultiplier >= 5) return 1.0;
  if (spikeMultiplier >= 4) return 0.9;
  if (spikeMultiplier >= 3) return 0.8;
  if (spikeMultiplier >= 2.5) return 0.7;
  if (spikeMultiplier >= 2) return 0.6;

  return 0.5;
}

/**
 * Calculates urgency for inventory clearance events
 */
function calculateInventoryUrgency(events: Event[]): number {
  const latestEvent = events[0];
  if (!latestEvent) return 0.5;

  const payload = latestEvent.payload_json as any;
  const inventory = payload.current_inventory || 0;
  const threshold = payload.threshold || 10;

  // How far below threshold
  const ratio = inventory / threshold;

  if (ratio <= 0.3) return 0.9; // Very low
  if (ratio <= 0.5) return 0.8;
  if (ratio <= 0.7) return 0.7;
  if (ratio <= 1.0) return 0.6;

  return 0.5;
}

/**
 * Calculates consequence for inventory clearance events
 */
function calculateInventoryConsequence(events: Event[]): number {
  const latestEvent = events[0];
  if (!latestEvent) return 0.5;

  const payload = latestEvent.payload_json as any;
  const inventory = payload.current_inventory || 0;

  // More inventory = higher consequence of holding costs
  if (inventory >= 50) return 0.8;
  if (inventory >= 30) return 0.7;
  if (inventory >= 20) return 0.6;
  if (inventory >= 10) return 0.5;

  return 0.4;
}

/**
 * Calculates urgency for winback campaigns
 */
function calculateWinbackUrgency(events: Event[]): number {
  const latestEvent = events[0];
  if (!latestEvent) return 0.5;

  const payload = latestEvent.payload_json as any;
  const daysInactive = payload.days_inactive || 0;

  // Longer inactive = more urgent to act
  if (daysInactive >= 90) return 0.8;
  if (daysInactive >= 60) return 0.7;
  if (daysInactive >= 45) return 0.6;
  if (daysInactive >= 30) return 0.5;

  return 0.4;
}

/**
 * Calculates consequence for winback campaigns
 */
function calculateWinbackConsequence(events: Event[]): number {
  const latestEvent = events[0];
  if (!latestEvent) return 0.5;

  const payload = latestEvent.payload_json as any;
  const lifetimeValue = payload.total_lifetime_value || 0;
  const avgOrderValue = payload.average_order_value || 0;

  // Higher LTV = higher consequence of losing customer
  if (lifetimeValue >= 1000) return 0.9;
  if (lifetimeValue >= 500) return 0.8;
  if (lifetimeValue >= 250) return 0.7;
  if (avgOrderValue >= 100) return 0.6;

  return 0.5;
}

// ============================================================================
// BUCKET ASSIGNMENT
// ============================================================================

/**
 * Assigns priority bucket based on score
 */
function assignPriorityBucket(score: number): PriorityBucket {
  if (score >= 70) {
    return PriorityBucket.high;
  }

  if (score >= 40) {
    return PriorityBucket.medium;
  }

  return PriorityBucket.low;
}

/**
 * Compares two priority scores
 * Returns positive if a > b, negative if a < b, 0 if equal
 */
export function comparePriority(a: PriorityScore, b: PriorityScore): number {
  // First compare by bucket
  const bucketOrder = {
    [PriorityBucket.high]: 3,
    [PriorityBucket.medium]: 2,
    [PriorityBucket.low]: 1,
  };

  const bucketDiff = bucketOrder[a.bucket] - bucketOrder[b.bucket];
  if (bucketDiff !== 0) {
    return bucketDiff;
  }

  // Then by score within bucket
  return a.score - b.score;
}
