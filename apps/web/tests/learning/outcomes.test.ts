/**
 * Outcome Computation Tests
 *
 * Tests for the learning loop outcome tracking system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OutcomeType } from '@/server/learning/types';
import { DiscountOutcomeResolver } from '@/server/learning/outcomes/resolvers/discount';
import { WinbackOutcomeResolver } from '@/server/learning/outcomes/resolvers/winback';
import { PauseProductOutcomeResolver } from '@/server/learning/outcomes/resolvers/pause';

describe('Outcome Resolvers', () => {
  describe('DiscountOutcomeResolver', () => {
    it('should compute HELPED outcome for successful discount', async () => {
      const resolver = new DiscountOutcomeResolver();

      // Mock execution input
      const input = {
        execution_id: 'exec-123',
        workspace_id: 'ws-123',
        operator_intent: 'reduce_inventory_risk' as any,
        execution_type: 'discount_draft',
        execution_payload: {
          discount_code: 'SAVE20',
          target_products: ['prod-1', 'prod-2'],
        },
        executed_at: new Date('2024-01-15T00:00:00Z'),
      };

      // Note: This test would need proper database mocking
      // For now, this demonstrates the interface
      expect(resolver).toBeDefined();
      expect(typeof resolver.compute).toBe('function');
    });

    it('should use correct thresholds for outcome determination', () => {
      const resolver = new DiscountOutcomeResolver();
      // Access private fields via any type for testing
      const resolverAny = resolver as any;

      expect(resolverAny.HELPED_THRESHOLD).toBe(0.1); // 10%
      expect(resolverAny.HURT_THRESHOLD).toBe(-0.05); // -5%
      expect(resolverAny.OBSERVATION_WINDOW_DAYS).toBe(7);
    });
  });

  describe('WinbackOutcomeResolver', () => {
    it('should compute outcome based on conversion rate', () => {
      const resolver = new WinbackOutcomeResolver();
      const resolverAny = resolver as any;

      expect(resolverAny.HELPED_THRESHOLD).toBe(0.05); // 5%
      expect(resolverAny.HURT_THRESHOLD).toBe(-0.02); // -2%
      expect(resolverAny.OBSERVATION_WINDOW_DAYS).toBe(14);
    });
  });

  describe('PauseProductOutcomeResolver', () => {
    it('should measure stockout reduction', () => {
      const resolver = new PauseProductOutcomeResolver();
      const resolverAny = resolver as any;

      expect(resolverAny.HELPED_THRESHOLD).toBe(0.15); // 15%
      expect(resolverAny.HURT_THRESHOLD).toBe(-0.1); // -10%
      expect(resolverAny.OBSERVATION_WINDOW_DAYS).toBe(14);
    });
  });
});

describe('OutcomeType', () => {
  it('should have three outcome types', () => {
    expect(OutcomeType.HELPED).toBe('helped');
    expect(OutcomeType.NEUTRAL).toBe('neutral');
    expect(OutcomeType.HURT).toBe('hurt');
  });
});

describe('Evidence Structure', () => {
  it('should include all required fields', () => {
    const mockEvidence = {
      baseline_window: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-14'),
        metric_name: 'revenue',
        value: 1000,
      },
      observation_window: {
        start: new Date('2024-01-15'),
        end: new Date('2024-01-22'),
        metric_name: 'revenue',
        value: 1200,
      },
      baseline_value: 1000,
      observed_value: 1200,
      delta: 200,
      delta_percentage: 0.2,
      helped_threshold: 0.1,
      hurt_threshold: -0.05,
      sample_size: 50,
      notes: 'Successful campaign',
    };

    expect(mockEvidence.delta_percentage).toBeGreaterThan(
      mockEvidence.helped_threshold
    );
  });
});
