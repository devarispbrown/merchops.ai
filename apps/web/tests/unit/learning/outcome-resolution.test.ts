/**
 * Unit Tests: Outcome Resolution
 * MerchOps Beta MVP
 *
 * Tests:
 * - Discount outcome computation
 * - Winback outcome computation
 * - Pause outcome computation
 * - Threshold logic
 * - Evidence generation
 */

import { describe, it, expect } from 'vitest';
import { OutcomeType, OutcomeEvidence } from '@/server/learning/types';

// ============================================================================
// OUTCOME RESOLUTION LOGIC
// ============================================================================

/**
 * Threshold configuration for outcome determination
 */
const THRESHOLDS = {
  HELPED: 0.1, // 10% improvement
  HURT: -0.05, // 5% degradation
};

/**
 * Small epsilon for floating point comparison
 * Accounts for JavaScript floating point precision issues
 */
const EPSILON = 1e-10;

/**
 * Determine outcome type based on delta percentage
 * Uses epsilon tolerance for floating point comparisons
 */
function determineOutcome(deltaPct: number): OutcomeType {
  if (deltaPct >= THRESHOLDS.HELPED - EPSILON) {
    return OutcomeType.HELPED;
  } else if (deltaPct <= THRESHOLDS.HURT + EPSILON) {
    return OutcomeType.HURT;
  } else {
    return OutcomeType.NEUTRAL;
  }
}

/**
 * Compute discount outcome
 */
function computeDiscountOutcome(
  baselineRevenue: number,
  observedRevenue: number
): { outcome: OutcomeType; evidence: OutcomeEvidence } {
  const delta = observedRevenue - baselineRevenue;
  const deltaPct = baselineRevenue > 0 ? delta / baselineRevenue : 0;

  const outcome = determineOutcome(deltaPct);

  const evidence: OutcomeEvidence = {
    baseline_window: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-14'),
      metric_name: 'revenue',
      value: baselineRevenue,
    },
    observation_window: {
      start: new Date('2024-01-15'),
      end: new Date('2024-01-21'),
      metric_name: 'revenue',
      value: observedRevenue,
    },
    baseline_value: baselineRevenue,
    observed_value: observedRevenue,
    delta: delta,
    delta_percentage: deltaPct,
    helped_threshold: THRESHOLDS.HELPED,
    hurt_threshold: THRESHOLDS.HURT,
  };

  return { outcome, evidence };
}

/**
 * Compute winback outcome
 */
function computeWinbackOutcome(
  baselineEngagement: number,
  observedEngagement: number
): { outcome: OutcomeType; evidence: OutcomeEvidence } {
  const delta = observedEngagement - baselineEngagement;
  const deltaPct = baselineEngagement > 0 ? delta / baselineEngagement : 0;

  const outcome = determineOutcome(deltaPct);

  const evidence: OutcomeEvidence = {
    baseline_window: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-14'),
      metric_name: 'engagement_rate',
      value: baselineEngagement,
    },
    observation_window: {
      start: new Date('2024-01-15'),
      end: new Date('2024-01-28'),
      metric_name: 'engagement_rate',
      value: observedEngagement,
    },
    baseline_value: baselineEngagement,
    observed_value: observedEngagement,
    delta: delta,
    delta_percentage: deltaPct,
    helped_threshold: THRESHOLDS.HELPED,
    hurt_threshold: THRESHOLDS.HURT,
  };

  return { outcome, evidence };
}

/**
 * Compute pause product outcome
 */
function computePauseOutcome(
  baselineStockouts: number,
  observedStockouts: number
): { outcome: OutcomeType; evidence: OutcomeEvidence } {
  // For stockouts, lower is better (negative delta is improvement)
  const delta = observedStockouts - baselineStockouts;
  const deltaPct = baselineStockouts > 0 ? delta / baselineStockouts : 0;

  // Invert logic: reduction in stockouts is helped
  let outcome: OutcomeType;
  if (deltaPct <= -THRESHOLDS.HELPED) {
    // 10% or more reduction is helped
    outcome = OutcomeType.HELPED;
  } else if (deltaPct >= -THRESHOLDS.HURT) {
    // 5% or more increase is hurt
    outcome = OutcomeType.HURT;
  } else {
    outcome = OutcomeType.NEUTRAL;
  }

  const evidence: OutcomeEvidence = {
    baseline_window: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-14'),
      metric_name: 'stockout_rate',
      value: baselineStockouts,
    },
    observation_window: {
      start: new Date('2024-01-15'),
      end: new Date('2024-01-28'),
      metric_name: 'stockout_rate',
      value: observedStockouts,
    },
    baseline_value: baselineStockouts,
    observed_value: observedStockouts,
    delta: delta,
    delta_percentage: deltaPct,
    helped_threshold: THRESHOLDS.HELPED,
    hurt_threshold: THRESHOLDS.HURT,
  };

  return { outcome, evidence };
}

describe('Outcome Resolution', () => {
  describe('Discount Outcome Computation', () => {
    it('should classify as helped when revenue increases by 10%+', () => {
      const baseline = 1000;
      const observed = 1100; // +10%

      const result = computeDiscountOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HELPED);
      expect(result.evidence.delta_percentage).toBeCloseTo(0.1);
    });

    it('should classify as helped when revenue increases by 20%', () => {
      const baseline = 1000;
      const observed = 1200; // +20%

      const result = computeDiscountOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HELPED);
      expect(result.evidence.delta_percentage).toBeCloseTo(0.2);
    });

    it('should classify as neutral when revenue increases by 5%', () => {
      const baseline = 1000;
      const observed = 1050; // +5%

      const result = computeDiscountOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
      expect(result.evidence.delta_percentage).toBeCloseTo(0.05);
    });

    it('should classify as neutral when revenue is flat', () => {
      const baseline = 1000;
      const observed = 1000; // 0%

      const result = computeDiscountOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
      expect(result.evidence.delta_percentage).toBe(0);
    });

    it('should classify as neutral when revenue decreases slightly', () => {
      const baseline = 1000;
      const observed = 970; // -3%

      const result = computeDiscountOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
      expect(result.evidence.delta_percentage).toBeCloseTo(-0.03);
    });

    it('should classify as hurt when revenue decreases by 5%+', () => {
      const baseline = 1000;
      const observed = 950; // -5%

      const result = computeDiscountOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HURT);
      expect(result.evidence.delta_percentage).toBeCloseTo(-0.05);
    });

    it('should classify as hurt when revenue decreases by 10%', () => {
      const baseline = 1000;
      const observed = 900; // -10%

      const result = computeDiscountOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HURT);
      expect(result.evidence.delta_percentage).toBeCloseTo(-0.1);
    });

    it('should handle zero baseline gracefully', () => {
      const baseline = 0;
      const observed = 100;

      const result = computeDiscountOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
      expect(result.evidence.delta_percentage).toBe(0);
    });

    it('should generate complete evidence', () => {
      const baseline = 1000;
      const observed = 1200;

      const result = computeDiscountOutcome(baseline, observed);

      expect(result.evidence.baseline_window).toBeDefined();
      expect(result.evidence.observation_window).toBeDefined();
      expect(result.evidence.baseline_value).toBe(1000);
      expect(result.evidence.observed_value).toBe(1200);
      expect(result.evidence.delta).toBe(200);
      expect(result.evidence.helped_threshold).toBe(0.1);
      expect(result.evidence.hurt_threshold).toBe(-0.05);
    });

    it('should be deterministic for same inputs', () => {
      const baseline = 1000;
      const observed = 1150;

      const result1 = computeDiscountOutcome(baseline, observed);
      const result2 = computeDiscountOutcome(baseline, observed);

      expect(result1.outcome).toBe(result2.outcome);
      expect(result1.evidence.delta_percentage).toBe(result2.evidence.delta_percentage);
    });
  });

  describe('Winback Outcome Computation', () => {
    it('should classify as helped when engagement increases by 10%+', () => {
      const baseline = 0.2; // 20% engagement
      const observed = 0.22; // 22% engagement (+10%)

      const result = computeWinbackOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HELPED);
      expect(result.evidence.delta_percentage).toBeCloseTo(0.1);
    });

    it('should classify as neutral when engagement increases by 5%', () => {
      const baseline = 0.2;
      const observed = 0.21; // +5%

      const result = computeWinbackOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
    });

    it('should classify as hurt when engagement decreases by 5%+', () => {
      const baseline = 0.2;
      const observed = 0.19; // -5%

      const result = computeWinbackOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HURT);
    });

    it('should handle low baseline engagement', () => {
      const baseline = 0.05; // 5% baseline
      const observed = 0.06; // 6% (+20%)

      const result = computeWinbackOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HELPED);
      expect(result.evidence.delta_percentage).toBeCloseTo(0.2);
    });

    it('should handle zero baseline gracefully', () => {
      const baseline = 0;
      const observed = 0.1;

      const result = computeWinbackOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
      expect(result.evidence.delta_percentage).toBe(0);
    });

    it('should generate complete evidence', () => {
      const baseline = 0.2;
      const observed = 0.25;

      const result = computeWinbackOutcome(baseline, observed);

      expect(result.evidence.baseline_window.metric_name).toBe('engagement_rate');
      expect(result.evidence.observation_window.metric_name).toBe('engagement_rate');
      expect(result.evidence.baseline_value).toBe(0.2);
      expect(result.evidence.observed_value).toBe(0.25);
    });
  });

  describe('Pause Product Outcome Computation', () => {
    it('should classify as helped when stockouts decrease by 10%+', () => {
      const baseline = 10; // 10 stockouts
      const observed = 9; // 9 stockouts (-10%)

      const result = computePauseOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HELPED);
      expect(result.evidence.delta_percentage).toBeCloseTo(-0.1);
    });

    it('should classify as helped when stockouts decrease by 50%', () => {
      const baseline = 10;
      const observed = 5; // -50%

      const result = computePauseOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HELPED);
      expect(result.evidence.delta_percentage).toBeCloseTo(-0.5);
    });

    it('should classify as neutral when stockouts decrease slightly', () => {
      const baseline = 10;
      const observed = 9.5; // -5%

      const result = computePauseOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
    });

    it('should classify as neutral when stockouts remain flat', () => {
      const baseline = 10;
      const observed = 10; // 0%

      const result = computePauseOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
      expect(result.evidence.delta_percentage).toBe(0);
    });

    it('should classify as hurt when stockouts increase by 5%+', () => {
      const baseline = 10;
      const observed = 10.5; // +5%

      const result = computePauseOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.HURT);
      expect(result.evidence.delta_percentage).toBeCloseTo(0.05);
    });

    it('should handle zero baseline gracefully', () => {
      const baseline = 0;
      const observed = 1;

      const result = computePauseOutcome(baseline, observed);

      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
    });

    it('should generate complete evidence', () => {
      const baseline = 10;
      const observed = 8;

      const result = computePauseOutcome(baseline, observed);

      expect(result.evidence.baseline_window.metric_name).toBe('stockout_rate');
      expect(result.evidence.observation_window.metric_name).toBe('stockout_rate');
      expect(result.evidence.baseline_value).toBe(10);
      expect(result.evidence.observed_value).toBe(8);
      expect(result.evidence.delta).toBe(-2);
    });
  });

  describe('Threshold Logic', () => {
    it('should apply 10% helped threshold correctly', () => {
      expect(determineOutcome(0.09)).toBe(OutcomeType.NEUTRAL);
      expect(determineOutcome(0.1)).toBe(OutcomeType.HELPED);
      expect(determineOutcome(0.11)).toBe(OutcomeType.HELPED);
    });

    it('should apply 5% hurt threshold correctly', () => {
      expect(determineOutcome(-0.04)).toBe(OutcomeType.NEUTRAL);
      expect(determineOutcome(-0.05)).toBe(OutcomeType.HURT);
      expect(determineOutcome(-0.06)).toBe(OutcomeType.HURT);
    });

    it('should classify neutral for values between thresholds', () => {
      expect(determineOutcome(-0.04)).toBe(OutcomeType.NEUTRAL);
      expect(determineOutcome(-0.02)).toBe(OutcomeType.NEUTRAL);
      expect(determineOutcome(0)).toBe(OutcomeType.NEUTRAL);
      expect(determineOutcome(0.05)).toBe(OutcomeType.NEUTRAL);
      expect(determineOutcome(0.09)).toBe(OutcomeType.NEUTRAL);
    });

    it('should handle extreme positive values', () => {
      expect(determineOutcome(1.0)).toBe(OutcomeType.HELPED);
      expect(determineOutcome(5.0)).toBe(OutcomeType.HELPED);
    });

    it('should handle extreme negative values', () => {
      expect(determineOutcome(-0.5)).toBe(OutcomeType.HURT);
      expect(determineOutcome(-1.0)).toBe(OutcomeType.HURT);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small positive changes', () => {
      const result = computeDiscountOutcome(1000, 1001);
      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
      expect(result.evidence.delta_percentage).toBeCloseTo(0.001);
    });

    it('should handle very small negative changes', () => {
      const result = computeDiscountOutcome(1000, 999);
      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
      expect(result.evidence.delta_percentage).toBeCloseTo(-0.001);
    });

    it('should handle baseline and observed being equal', () => {
      const result = computeDiscountOutcome(1000, 1000);
      expect(result.outcome).toBe(OutcomeType.NEUTRAL);
      expect(result.evidence.delta).toBe(0);
      expect(result.evidence.delta_percentage).toBe(0);
    });

    it('should handle large revenue values', () => {
      const result = computeDiscountOutcome(1000000, 1150000);
      expect(result.outcome).toBe(OutcomeType.HELPED);
      expect(result.evidence.delta_percentage).toBeCloseTo(0.15);
    });

    it('should handle decimal values', () => {
      const result = computeDiscountOutcome(100.5, 110.55);
      expect(result.outcome).toBe(OutcomeType.HELPED);
      expect(result.evidence.delta_percentage).toBeCloseTo(0.1);
    });
  });

  describe('Determinism', () => {
    it('should produce identical results for repeated calls with same inputs', () => {
      const baseline = 1000;
      const observed = 1150;

      const results = Array(10).fill(null).map(() =>
        computeDiscountOutcome(baseline, observed)
      );

      const firstOutcome = results[0].outcome;
      const firstDelta = results[0].evidence.delta_percentage;

      results.forEach((result) => {
        expect(result.outcome).toBe(firstOutcome);
        expect(result.evidence.delta_percentage).toBe(firstDelta);
      });
    });

    it('should produce different results for different inputs', () => {
      const result1 = computeDiscountOutcome(1000, 1150);
      const result2 = computeDiscountOutcome(1000, 950);

      expect(result1.outcome).not.toBe(result2.outcome);
      expect(result1.evidence.delta_percentage).not.toBe(result2.evidence.delta_percentage);
    });
  });
});
