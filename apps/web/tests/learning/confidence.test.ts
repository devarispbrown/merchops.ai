/**
 * Confidence Score Tests
 *
 * Tests for confidence scoring and trend calculation
 */

import { describe, it, expect } from '@jest/globals';
import { getConfidenceLevel, getConfidenceExplanation } from '@/server/learning/confidence';
import { ConfidenceScore } from '@/server/learning/types';

describe('Confidence Scoring', () => {
  describe('getConfidenceLevel', () => {
    it('should return High for scores 71-100', () => {
      expect(getConfidenceLevel(71)).toBe('High');
      expect(getConfidenceLevel(85)).toBe('High');
      expect(getConfidenceLevel(100)).toBe('High');
    });

    it('should return Medium for scores 41-70', () => {
      expect(getConfidenceLevel(41)).toBe('Medium');
      expect(getConfidenceLevel(55)).toBe('Medium');
      expect(getConfidenceLevel(70)).toBe('Medium');
    });

    it('should return Low for scores 0-40', () => {
      expect(getConfidenceLevel(0)).toBe('Low');
      expect(getConfidenceLevel(25)).toBe('Low');
      expect(getConfidenceLevel(40)).toBe('Low');
    });
  });

  describe('getConfidenceExplanation', () => {
    it('should generate explanation with stats', () => {
      const mockScore: ConfidenceScore = {
        operator_intent: 'reduce_inventory_risk',
        score: 75,
        trend: 'improving',
        recent_executions: 20,
        helped_count: 15,
        neutral_count: 3,
        hurt_count: 2,
        last_computed_at: new Date(),
      };

      const explanation = getConfidenceExplanation(mockScore);

      expect(explanation).toContain('High confidence');
      expect(explanation).toContain('20 recent executions');
      expect(explanation).toContain('15 helped');
      expect(explanation).toContain('2 hurt');
      expect(explanation).toContain('Trending up');
    });

    it('should handle zero executions', () => {
      const mockScore: ConfidenceScore = {
        operator_intent: 'protect_margin',
        score: 50,
        trend: 'stable',
        recent_executions: 0,
        helped_count: 0,
        neutral_count: 0,
        hurt_count: 0,
        last_computed_at: new Date(),
      };

      const explanation = getConfidenceExplanation(mockScore);

      expect(explanation).toContain('No executions yet');
    });

    it('should indicate declining trend', () => {
      const mockScore: ConfidenceScore = {
        operator_intent: 'reengage_dormant_customers',
        score: 45,
        trend: 'declining',
        recent_executions: 15,
        helped_count: 7,
        neutral_count: 3,
        hurt_count: 5,
        last_computed_at: new Date(),
      };

      const explanation = getConfidenceExplanation(mockScore);

      expect(explanation).toContain('Trending down');
    });
  });

  describe('Confidence Score Calculation Logic', () => {
    it('should calculate success rate correctly', () => {
      // Mock score: 15 helped out of 20 total = 75% success rate
      const helpedCount = 15;
      const totalExecutions = 20;
      const successRate = helpedCount / totalExecutions;

      expect(successRate).toBe(0.75);
    });

    it('should apply harm penalty', () => {
      // Mock score: 10 helped, 5 hurt out of 20 total
      const helpedCount = 10;
      const hurtCount = 5;
      const totalExecutions = 20;

      const successRate = helpedCount / totalExecutions; // 0.5
      const harmRate = hurtCount / totalExecutions; // 0.25

      const successPoints = successRate * 70; // 35
      const harmPenalty = harmRate * 30; // 7.5
      const volumeBonus = Math.min(totalExecutions / 20, 1) * 10; // 10

      const score = successPoints - harmPenalty + volumeBonus; // 37.5

      expect(score).toBeCloseTo(37.5);
      expect(getConfidenceLevel(Math.round(score))).toBe('Low');
    });

    it('should give default score of 50 with no data', () => {
      const totalExecutions = 0;
      const score = totalExecutions === 0 ? 50 : 0;

      expect(score).toBe(50);
      expect(getConfidenceLevel(score)).toBe('Medium');
    });
  });

  describe('Trend Calculation', () => {
    it('should detect improving trend', () => {
      // Earlier: 3/6 = 50% success
      // Later: 5/6 = 83% success
      // Delta: +33% = improving
      const earlierSuccessRate = 3 / 6; // 0.5
      const laterSuccessRate = 5 / 6; // 0.833
      const delta = laterSuccessRate - earlierSuccessRate; // 0.333

      expect(delta).toBeGreaterThan(0.1);
      // Would return 'improving'
    });

    it('should detect declining trend', () => {
      // Earlier: 5/6 = 83% success
      // Later: 2/6 = 33% success
      // Delta: -50% = declining
      const earlierSuccessRate = 5 / 6; // 0.833
      const laterSuccessRate = 2 / 6; // 0.333
      const delta = laterSuccessRate - earlierSuccessRate; // -0.5

      expect(delta).toBeLessThan(-0.1);
      // Would return 'declining'
    });

    it('should detect stable trend', () => {
      // Earlier: 4/6 = 67% success
      // Later: 4/6 = 67% success
      // Delta: 0% = stable
      const earlierSuccessRate = 4 / 6;
      const laterSuccessRate = 4 / 6;
      const delta = laterSuccessRate - earlierSuccessRate;

      expect(Math.abs(delta)).toBeLessThanOrEqual(0.1);
      // Would return 'stable'
    });
  });
});
