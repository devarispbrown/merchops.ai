/**
 * Unit Tests: Confidence Score Calculation
 * MerchOps Beta MVP
 *
 * Tests:
 * - Confidence calculation logic
 * - Confidence changes deterministically
 * - Edge cases (no outcomes, all helped, all hurt)
 * - Trend detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prismaMock } from '../../setup';
import { calculateConfidence, getConfidenceLevel, getConfidenceExplanation } from '@/server/learning/confidence';
import { OperatorIntent } from '@prisma/client';

describe('Confidence Score Calculation', () => {
  beforeEach(() => {
    prismaMock.execution.findMany.mockReset();
  });

  describe('Baseline Confidence Calculation', () => {
    it('should return default confidence of 50 when no executions exist', async () => {
      prismaMock.execution.findMany.mockResolvedValue([]);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.score).toBe(50);
      expect(result.recent_executions).toBe(0);
      expect(result.helped_count).toBe(0);
      expect(result.neutral_count).toBe(0);
      expect(result.hurt_count).toBe(0);
      expect(result.trend).toBe('stable');
    });

    it('should calculate confidence deterministically from outcomes', async () => {
      // 8 helped, 2 neutral, 0 hurt out of 10 executions
      const mockExecutions = [
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('neutral'),
        createMockExecution('neutral'),
      ];

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.recent_executions).toBe(10);
      expect(result.helped_count).toBe(8);
      expect(result.neutral_count).toBe(2);
      expect(result.hurt_count).toBe(0);

      // Success rate: 8/10 = 0.8
      // Success points: 0.8 * 70 = 56
      // Harm penalty: 0 * 30 = 0
      // Volume bonus: 10/20 * 10 = 5
      // Total: 56 - 0 + 5 = 61
      expect(result.score).toBe(61);
    });

    it('should apply harm penalty for hurt outcomes', async () => {
      // 5 helped, 3 neutral, 2 hurt out of 10 executions
      const mockExecutions = [
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('neutral'),
        createMockExecution('neutral'),
        createMockExecution('neutral'),
        createMockExecution('hurt'),
        createMockExecution('hurt'),
      ];

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.helped_count).toBe(5);
      expect(result.hurt_count).toBe(2);

      // Success rate: 5/10 = 0.5
      // Success points: 0.5 * 70 = 35
      // Harm penalty: 0.2 * 30 = 6
      // Volume bonus: 10/20 * 10 = 5
      // Total: 35 - 6 + 5 = 34
      expect(result.score).toBe(34);
    });

    it('should apply volume bonus for sufficient data', async () => {
      // 20 executions (full dataset)
      const mockExecutions = Array(20).fill(null).map(() => createMockExecution('helped'));

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.recent_executions).toBe(20);

      // Success rate: 20/20 = 1.0
      // Success points: 1.0 * 70 = 70
      // Harm penalty: 0
      // Volume bonus: 20/20 * 10 = 10 (full bonus)
      // Total: 70 + 10 = 80
      expect(result.score).toBe(80);
    });

    it('should clamp score to 0-100 range', async () => {
      // All hurt outcomes should not go below 0
      const mockExecutions = Array(20).fill(null).map(() => createMockExecution('hurt'));

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle all helped outcomes (perfect score)', async () => {
      const mockExecutions = Array(20).fill(null).map(() => createMockExecution('helped'));

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.helped_count).toBe(20);
      expect(result.neutral_count).toBe(0);
      expect(result.hurt_count).toBe(0);
      expect(result.score).toBe(80); // 70 (success) + 10 (volume)
    });

    it('should handle all hurt outcomes (worst score)', async () => {
      const mockExecutions = Array(20).fill(null).map(() => createMockExecution('hurt'));

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.helped_count).toBe(0);
      expect(result.hurt_count).toBe(20);

      // Success points: 0
      // Harm penalty: 1.0 * 30 = 30
      // Volume bonus: 10
      // Total: 0 - 30 + 10 = -20, clamped to 0
      expect(result.score).toBe(0);
    });

    it('should handle all neutral outcomes', async () => {
      const mockExecutions = Array(20).fill(null).map(() => createMockExecution('neutral'));

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.helped_count).toBe(0);
      expect(result.neutral_count).toBe(20);
      expect(result.hurt_count).toBe(0);

      // Success points: 0
      // Harm penalty: 0
      // Volume bonus: 10
      // Total: 10
      expect(result.score).toBe(10);
    });

    it('should handle single execution', async () => {
      const mockExecutions = [createMockExecution('helped')];

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.recent_executions).toBe(1);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle exactly 20 executions (max dataset)', async () => {
      const mockExecutions = Array(20).fill(null).map((_, i) =>
        createMockExecution(i < 15 ? 'helped' : 'neutral')
      );

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result.recent_executions).toBe(20);
      expect(result.helped_count).toBe(15);
    });
  });

  describe('Trend Detection', () => {
    it('should detect improving trend', async () => {
      // Earlier half (older): 2 helped, 3 neutral
      // Later half (newer): 4 helped, 1 neutral
      const mockExecutions = [
        // Later (newer) - index 0-4
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('neutral'),
        // Earlier (older) - index 5-9
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('neutral'),
        createMockExecution('neutral'),
        createMockExecution('neutral'),
      ];

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      // Later: 4/5 = 80%, Earlier: 2/5 = 40%
      // Delta: 40% > 10% threshold
      expect(result.trend).toBe('improving');
    });

    it('should detect declining trend', async () => {
      // Earlier half (older): 4 helped, 1 neutral
      // Later half (newer): 2 helped, 3 neutral
      const mockExecutions = [
        // Later (newer) - index 0-4
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('neutral'),
        createMockExecution('neutral'),
        createMockExecution('neutral'),
        // Earlier (older) - index 5-9
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('neutral'),
      ];

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      // Later: 2/5 = 40%, Earlier: 4/5 = 80%
      // Delta: -40% < -10% threshold
      expect(result.trend).toBe('declining');
    });

    it('should detect stable trend', async () => {
      // Earlier and later halves have similar success rates
      const mockExecutions = [
        // Later (newer)
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('neutral'),
        createMockExecution('neutral'),
        // Earlier (older)
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('neutral'),
        createMockExecution('neutral'),
      ];

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      // Both halves: 3/5 = 60%
      // Delta: 0% (within ±10% threshold)
      expect(result.trend).toBe('stable');
    });

    it('should return stable trend for insufficient data', async () => {
      const mockExecutions = Array(5).fill(null).map(() => createMockExecution('helped'));

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      // Less than 6 executions: not enough for trend
      expect(result.trend).toBe('stable');
    });
  });

  describe('Determinism', () => {
    it('should produce same score for same inputs', async () => {
      const mockExecutions = [
        createMockExecution('helped'),
        createMockExecution('helped'),
        createMockExecution('neutral'),
        createMockExecution('hurt'),
      ];

      prismaMock.execution.findMany.mockResolvedValue(mockExecutions as any);

      const result1 = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      const result2 = await calculateConfidence(
        'workspace-1',
        OperatorIntent.reduce_inventory_risk
      );

      expect(result1.score).toBe(result2.score);
      expect(result1.trend).toBe(result2.trend);
      expect(result1.helped_count).toBe(result2.helped_count);
    });

    it('should produce different scores for different outcome distributions', async () => {
      const mockExecutions1 = Array(10).fill(null).map(() => createMockExecution('helped'));
      prismaMock.execution.findMany.mockResolvedValue(mockExecutions1 as any);
      const result1 = await calculateConfidence('workspace-1', OperatorIntent.reduce_inventory_risk);

      const mockExecutions2 = Array(10).fill(null).map(() => createMockExecution('neutral'));
      prismaMock.execution.findMany.mockResolvedValue(mockExecutions2 as any);
      const result2 = await calculateConfidence('workspace-1', OperatorIntent.reduce_inventory_risk);

      expect(result1.score).not.toBe(result2.score);
      expect(result1.score).toBeGreaterThan(result2.score);
    });
  });

  describe('Confidence Level Classification', () => {
    it('should classify score >= 71 as High', () => {
      expect(getConfidenceLevel(71)).toBe('High');
      expect(getConfidenceLevel(80)).toBe('High');
      expect(getConfidenceLevel(100)).toBe('High');
    });

    it('should classify score 41-70 as Medium', () => {
      expect(getConfidenceLevel(41)).toBe('Medium');
      expect(getConfidenceLevel(50)).toBe('Medium');
      expect(getConfidenceLevel(70)).toBe('Medium');
    });

    it('should classify score <= 40 as Low', () => {
      expect(getConfidenceLevel(0)).toBe('Low');
      expect(getConfidenceLevel(20)).toBe('Low');
      expect(getConfidenceLevel(40)).toBe('Low');
    });
  });

  describe('Confidence Explanation', () => {
    it('should generate explanation for no executions', () => {
      const confidence = {
        operator_intent: OperatorIntent.reduce_inventory_risk,
        score: 50,
        trend: 'stable' as const,
        recent_executions: 0,
        helped_count: 0,
        neutral_count: 0,
        hurt_count: 0,
        last_computed_at: new Date(),
      };

      const explanation = getConfidenceExplanation(confidence);
      expect(explanation).toContain('No executions yet');
    });

    it('should generate explanation with execution stats', () => {
      const confidence = {
        operator_intent: OperatorIntent.reduce_inventory_risk,
        score: 65,
        trend: 'stable' as const,
        recent_executions: 10,
        helped_count: 7,
        neutral_count: 2,
        hurt_count: 1,
        last_computed_at: new Date(),
      };

      const explanation = getConfidenceExplanation(confidence);
      expect(explanation).toContain('10 recent executions');
      expect(explanation).toContain('7 helped');
      expect(explanation).toContain('1 hurt');
      expect(explanation).toContain('70% success rate');
    });

    it('should include trend in explanation when improving', () => {
      const confidence = {
        operator_intent: OperatorIntent.reduce_inventory_risk,
        score: 70,
        trend: 'improving' as const,
        recent_executions: 10,
        helped_count: 7,
        neutral_count: 2,
        hurt_count: 1,
        last_computed_at: new Date(),
      };

      const explanation = getConfidenceExplanation(confidence);
      expect(explanation).toContain('Trending up');
    });

    it('should include trend in explanation when declining', () => {
      const confidence = {
        operator_intent: OperatorIntent.reduce_inventory_risk,
        score: 45,
        trend: 'declining' as const,
        recent_executions: 10,
        helped_count: 4,
        neutral_count: 3,
        hurt_count: 3,
        last_computed_at: new Date(),
      };

      const explanation = getConfidenceExplanation(confidence);
      expect(explanation).toContain('Trending down');
    });
  });
});

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockExecution(outcome: 'helped' | 'neutral' | 'hurt') {
  return {
    id: `exec-${Math.random()}`,
    workspace_id: 'workspace-1',
    status: 'succeeded',
    started_at: new Date(),
    action_draft: {
      operator_intent: OperatorIntent.reduce_inventory_risk,
    },
    outcome: {
      outcome: outcome,
    },
  };
}
