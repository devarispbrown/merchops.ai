/**
 * Unit Tests: Opportunity Prioritization Logic
 * MerchOps Beta MVP
 *
 * Tests:
 * - Priority bucket assignment (high/medium/low)
 * - Decay behavior and expiration
 * - Determinism (same inputs = same outputs)
 * - Priority scoring algorithm
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockCurrentTime,
  restoreTime,
  createTestEvent,
  createTestOpportunity,
} from '../../setup';

// ============================================================================
// PRIORITY CALCULATION LOGIC
// ============================================================================

interface PriorityFactors {
  urgency: number; // 0-1: time sensitivity
  magnitude: number; // 0-1: potential impact
  confidence: number; // 0-1: prediction confidence
  novelty: number; // 0-1: how new/unique this is
}

interface PriorityResult {
  bucket: 'high' | 'medium' | 'low';
  score: number; // 0-100
  factors: PriorityFactors;
}

/**
 * Calculate priority bucket and score for an opportunity
 * Algorithm is deterministic - same inputs always produce same output
 */
function calculatePriority(factors: PriorityFactors): PriorityResult {
  // Weighted scoring: urgency 40%, magnitude 30%, confidence 20%, novelty 10%
  const score =
    factors.urgency * 40 +
    factors.magnitude * 30 +
    factors.confidence * 20 +
    factors.novelty * 10;

  let bucket: 'high' | 'medium' | 'low';
  if (score >= 70) {
    bucket = 'high';
  } else if (score >= 40) {
    bucket = 'medium';
  } else {
    bucket = 'low';
  }

  return { bucket, score, factors };
}

/**
 * Calculate urgency factor based on time to decay
 */
function calculateUrgency(decayAt: Date, now: Date): number {
  const hoursUntilDecay = (decayAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilDecay <= 0) return 0; // Already decayed
  if (hoursUntilDecay <= 24) return 1.0; // < 1 day: highest urgency
  if (hoursUntilDecay <= 72) return 0.8; // 1-3 days: high urgency
  if (hoursUntilDecay <= 168) return 0.5; // 3-7 days: medium urgency
  return 0.3; // > 7 days: low urgency
}

/**
 * Calculate magnitude factor based on estimated impact
 */
function calculateMagnitude(impactRange: string): number {
  // Parse impact range (e.g., "$200-$500", "5-15 units")
  const dollarMatch = impactRange.match(/\$(\d+)-\$(\d+)/);
  const unitMatch = impactRange.match(/(\d+)-(\d+)\s+units/);

  if (dollarMatch) {
    const avg = (parseInt(dollarMatch[1]) + parseInt(dollarMatch[2])) / 2;
    if (avg >= 500) return 1.0;
    if (avg >= 250) return 0.7;
    if (avg >= 100) return 0.5;
    return 0.3;
  }

  if (unitMatch) {
    const avg = (parseInt(unitMatch[1]) + parseInt(unitMatch[2])) / 2;
    if (avg >= 20) return 1.0;
    if (avg >= 10) return 0.7;
    if (avg >= 5) return 0.5;
    return 0.3;
  }

  return 0.5; // Default if can't parse
}

/**
 * Calculate decay date based on opportunity type and factors
 */
function calculateDecayDate(
  opportunityType: string,
  createdAt: Date,
  urgency: number
): Date {
  const decayHours = urgency >= 0.8 ? 48 : urgency >= 0.5 ? 168 : 336; // 2 days, 7 days, or 14 days
  return new Date(createdAt.getTime() + decayHours * 60 * 60 * 1000);
}

// ============================================================================
// TESTS: PRIORITY BUCKET ASSIGNMENT
// ============================================================================

describe('Priority Bucket Assignment', () => {
  it('assigns HIGH priority to urgent, high-impact opportunities', () => {
    const factors: PriorityFactors = {
      urgency: 1.0, // Critical urgency
      magnitude: 0.9, // High impact
      confidence: 0.8, // High confidence
      novelty: 0.7, // Relatively new
    };

    const result = calculatePriority(factors);

    expect(result.bucket).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.factors).toEqual(factors);
  });

  it('assigns MEDIUM priority to moderately urgent opportunities', () => {
    const factors: PriorityFactors = {
      urgency: 0.6,
      magnitude: 0.5,
      confidence: 0.6,
      novelty: 0.5,
    };

    const result = calculatePriority(factors);

    expect(result.bucket).toBe('medium');
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(70);
  });

  it('assigns LOW priority to non-urgent, low-impact opportunities', () => {
    const factors: PriorityFactors = {
      urgency: 0.3,
      magnitude: 0.3,
      confidence: 0.4,
      novelty: 0.2,
    };

    const result = calculatePriority(factors);

    expect(result.bucket).toBe('low');
    expect(result.score).toBeLessThan(40);
  });

  it('handles boundary case at 70 score (high threshold)', () => {
    const factors: PriorityFactors = {
      urgency: 1.0, // 40 points
      magnitude: 1.0, // 30 points
      confidence: 0.0, // 0 points
      novelty: 0.0, // 0 points
    };

    const result = calculatePriority(factors);

    expect(result.score).toBe(70);
    expect(result.bucket).toBe('high');
  });

  it('handles boundary case at 40 score (medium threshold)', () => {
    const factors: PriorityFactors = {
      urgency: 1.0, // 40 points
      magnitude: 0.0, // 0 points
      confidence: 0.0, // 0 points
      novelty: 0.0, // 0 points
    };

    const result = calculatePriority(factors);

    expect(result.score).toBe(40);
    expect(result.bucket).toBe('medium');
  });
});

// ============================================================================
// TESTS: URGENCY CALCULATION
// ============================================================================

describe('Urgency Calculation', () => {
  beforeEach(() => {
    mockCurrentTime('2024-01-15T12:00:00Z');
  });

  it('returns 1.0 for opportunities expiring within 24 hours', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const decayAt = new Date('2024-01-16T06:00:00Z'); // 18 hours away

    const urgency = calculateUrgency(decayAt, now);

    expect(urgency).toBe(1.0);
  });

  it('returns 0.8 for opportunities expiring within 1-3 days', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const decayAt = new Date('2024-01-17T12:00:00Z'); // 48 hours away

    const urgency = calculateUrgency(decayAt, now);

    expect(urgency).toBe(0.8);
  });

  it('returns 0.5 for opportunities expiring within 3-7 days', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const decayAt = new Date('2024-01-20T12:00:00Z'); // 5 days away

    const urgency = calculateUrgency(decayAt, now);

    expect(urgency).toBe(0.5);
  });

  it('returns 0.3 for opportunities expiring after 7 days', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const decayAt = new Date('2024-01-25T12:00:00Z'); // 10 days away

    const urgency = calculateUrgency(decayAt, now);

    expect(urgency).toBe(0.3);
  });

  it('returns 0 for already-expired opportunities', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const decayAt = new Date('2024-01-14T12:00:00Z'); // Yesterday

    const urgency = calculateUrgency(decayAt, now);

    expect(urgency).toBe(0);
  });
});

// ============================================================================
// TESTS: MAGNITUDE CALCULATION
// ============================================================================

describe('Magnitude Calculation', () => {
  it('parses dollar ranges correctly', () => {
    expect(calculateMagnitude('$500-$1000 revenue protection')).toBe(1.0);
    expect(calculateMagnitude('$300-$400 estimated')).toBe(0.7);
    expect(calculateMagnitude('$150-$250 potential')).toBe(0.5);
    expect(calculateMagnitude('$50-$100 expected')).toBe(0.3);
  });

  it('parses unit ranges correctly', () => {
    expect(calculateMagnitude('20-30 units cleared')).toBe(1.0);
    expect(calculateMagnitude('10-15 units')).toBe(0.7);
    expect(calculateMagnitude('5-8 units')).toBe(0.5);
    expect(calculateMagnitude('2-4 units')).toBe(0.3);
  });

  it('returns default for unparseable ranges', () => {
    expect(calculateMagnitude('moderate impact')).toBe(0.5);
    expect(calculateMagnitude('unknown')).toBe(0.5);
  });
});

// ============================================================================
// TESTS: DECAY BEHAVIOR
// ============================================================================

describe('Decay Behavior', () => {
  beforeEach(() => {
    mockCurrentTime('2024-01-15T12:00:00Z');
  });

  it('sets 2-day decay for high urgency opportunities', () => {
    const createdAt = new Date('2024-01-15T12:00:00Z');
    const decayDate = calculateDecayDate('inventory_clearance', createdAt, 0.9);

    const expectedDecay = new Date('2024-01-17T12:00:00Z');
    expect(decayDate.getTime()).toBe(expectedDecay.getTime());
  });

  it('sets 7-day decay for medium urgency opportunities', () => {
    const createdAt = new Date('2024-01-15T12:00:00Z');
    const decayDate = calculateDecayDate('winback_campaign', createdAt, 0.6);

    const expectedDecay = new Date('2024-01-22T12:00:00Z');
    expect(decayDate.getTime()).toBe(expectedDecay.getTime());
  });

  it('sets 14-day decay for low urgency opportunities', () => {
    const createdAt = new Date('2024-01-15T12:00:00Z');
    const decayDate = calculateDecayDate('margin_protection', createdAt, 0.3);

    const expectedDecay = new Date('2024-01-29T12:00:00Z');
    expect(decayDate.getTime()).toBe(expectedDecay.getTime());
  });
});

// ============================================================================
// TESTS: DETERMINISM
// ============================================================================

describe('Determinism', () => {
  it('produces identical results for identical inputs', () => {
    const factors: PriorityFactors = {
      urgency: 0.75,
      magnitude: 0.65,
      confidence: 0.8,
      novelty: 0.5,
    };

    // Calculate priority 100 times
    const results = Array.from({ length: 100 }, () => calculatePriority(factors));

    // All results should be identical
    const firstResult = results[0]!;
    results.forEach((result) => {
      expect(result.bucket).toBe(firstResult.bucket);
      expect(result.score).toBe(firstResult.score);
      expect(result.factors).toEqual(firstResult.factors);
    });
  });

  it('produces different results for different inputs', () => {
    const factors1: PriorityFactors = {
      urgency: 0.8,
      magnitude: 0.7,
      confidence: 0.6,
      novelty: 0.5,
    };

    const factors2: PriorityFactors = {
      urgency: 0.3,
      magnitude: 0.4,
      confidence: 0.5,
      novelty: 0.2,
    };

    const result1 = calculatePriority(factors1);
    const result2 = calculatePriority(factors2);

    expect(result1.bucket).not.toBe(result2.bucket);
    expect(result1.score).not.toBe(result2.score);
  });

  it('maintains determinism across time mock changes', () => {
    const factors: PriorityFactors = {
      urgency: 0.7,
      magnitude: 0.6,
      confidence: 0.75,
      novelty: 0.8,
    };

    mockCurrentTime('2024-01-01T00:00:00Z');
    const result1 = calculatePriority(factors);

    mockCurrentTime('2024-06-15T12:00:00Z');
    const result2 = calculatePriority(factors);

    // Priority calculation should be time-independent
    expect(result1).toEqual(result2);

    restoreTime();
  });

  it('maintains sort order consistency', () => {
    const opportunities = [
      { id: '1', factors: { urgency: 0.9, magnitude: 0.8, confidence: 0.7, novelty: 0.6 } },
      { id: '2', factors: { urgency: 0.5, magnitude: 0.6, confidence: 0.5, novelty: 0.4 } },
      { id: '3', factors: { urgency: 0.7, magnitude: 0.7, confidence: 0.8, novelty: 0.5 } },
      { id: '4', factors: { urgency: 0.3, magnitude: 0.4, confidence: 0.3, novelty: 0.2 } },
    ];

    // Calculate priorities and sort
    const sorted1 = opportunities
      .map((opp) => ({
        id: opp.id,
        priority: calculatePriority(opp.factors),
      }))
      .sort((a, b) => b.priority.score - a.priority.score);

    // Do it again - should get same order
    const sorted2 = opportunities
      .map((opp) => ({
        id: opp.id,
        priority: calculatePriority(opp.factors),
      }))
      .sort((a, b) => b.priority.score - a.priority.score);

    expect(sorted1.map((o) => o.id)).toEqual(sorted2.map((o) => o.id));
  });
});

// ============================================================================
// TESTS: EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('handles all factors at maximum (1.0)', () => {
    const factors: PriorityFactors = {
      urgency: 1.0,
      magnitude: 1.0,
      confidence: 1.0,
      novelty: 1.0,
    };

    const result = calculatePriority(factors);

    expect(result.score).toBe(100);
    expect(result.bucket).toBe('high');
  });

  it('handles all factors at minimum (0.0)', () => {
    const factors: PriorityFactors = {
      urgency: 0.0,
      magnitude: 0.0,
      confidence: 0.0,
      novelty: 0.0,
    };

    const result = calculatePriority(factors);

    expect(result.score).toBe(0);
    expect(result.bucket).toBe('low');
  });

  it('handles fractional scores correctly', () => {
    const factors: PriorityFactors = {
      urgency: 0.333,
      magnitude: 0.667,
      confidence: 0.555,
      novelty: 0.444,
    };

    const result = calculatePriority(factors);

    // Should calculate precise fractional score
    const expectedScore =
      0.333 * 40 + 0.667 * 30 + 0.555 * 20 + 0.444 * 10;

    expect(result.score).toBeCloseTo(expectedScore, 2);
  });
});

// ============================================================================
// TESTS: INTEGRATION WITH OPPORTUNITY MODEL
// ============================================================================

describe('Integration with Opportunity Model', () => {
  it('creates opportunity with correctly calculated priority', () => {
    mockCurrentTime('2024-01-15T12:00:00Z');

    const now = new Date('2024-01-15T12:00:00Z');
    const impactRange = '$300-$500 revenue protection';

    // Calculate factors
    const decayAt = new Date('2024-01-17T12:00:00Z');
    const urgency = calculateUrgency(decayAt, now);
    const magnitude = calculateMagnitude(impactRange);
    const confidence = 0.75;
    const novelty = 0.8;

    const priority = calculatePriority({ urgency, magnitude, confidence, novelty });

    const opportunity = createTestOpportunity({
      priority_bucket: priority.bucket,
      decay_at: decayAt,
      confidence,
      impact_range: impactRange,
    });

    expect(opportunity.priority_bucket).toBe(priority.bucket);
    expect(opportunity.confidence).toBe(confidence);
    expect(opportunity.decay_at).toEqual(decayAt);
  });

  it('recalculates priority when opportunity is updated', () => {
    const initialFactors: PriorityFactors = {
      urgency: 0.5,
      magnitude: 0.6,
      confidence: 0.7,
      novelty: 0.5,
    };

    const initialPriority = calculatePriority(initialFactors);

    // Simulate confidence increase from learning loop
    const updatedFactors: PriorityFactors = {
      ...initialFactors,
      confidence: 0.9, // Confidence improved
    };

    const updatedPriority = calculatePriority(updatedFactors);

    expect(updatedPriority.score).toBeGreaterThan(initialPriority.score);
  });
});
