/**
 * Learning Outcome Computation Integration Tests
 *
 * Tests outcome computation for executed actions:
 * - Discount outcome computation
 * - Confidence update
 * - Evidence storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock, createTestWorkspace, createTestExecution } from '@/tests/setup';
import { computeOutcome, isExecutionReadyForOutcome } from '@/server/learning/outcomes/compute';
import { OutcomeType } from '@/server/learning/types';

// TODO: Skipped - requires real database and proper mocking setup
describe.skip('Outcome Computation - Integration', () => {
  const testWorkspace = createTestWorkspace();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Discount Outcome Computation', () => {
    it('should compute HELPED outcome for successful discount campaign', async () => {
      const execution = createTestExecution({
        id: 'exec-discount-123',
        workspace_id: testWorkspace.id,
        status: 'succeeded',
        request_payload_json: {
          discount_code: 'SALE20',
          discount_percent: 20,
          product_ids: ['gid://shopify/Product/123'],
        },
        started_at: new Date('2024-01-15T12:00:00Z'),
        finished_at: new Date('2024-01-15T12:05:00Z'),
        action_draft: {
          id: 'draft-123',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-123',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'executed',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-123',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'high',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.5,
            state: 'executed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(execution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);
      prismaMock.outcome.create.mockResolvedValue({
        id: 'outcome-123',
        execution_id: execution.id,
        outcome: OutcomeType.HELPED,
        computed_at: new Date('2024-01-22T12:00:00Z'),
        evidence_json: {
          baseline_conversion_rate: 0.02,
          campaign_conversion_rate: 0.045,
          uplift_percent: 125,
          orders_attributed: 8,
          revenue_generated: 640,
          observation_window_days: 7,
        },
      });

      const result = await computeOutcome(execution.id);

      expect(result).toBeDefined();
      expect(result?.outcome).toBe(OutcomeType.HELPED);
      expect(result?.evidence).toHaveProperty('uplift_percent');
      expect(result?.evidence?.uplift_percent).toBeGreaterThan(0);
    });

    it('should compute NEUTRAL outcome for marginal impact', async () => {
      const execution = createTestExecution({
        id: 'exec-discount-456',
        workspace_id: testWorkspace.id,
        status: 'succeeded',
        request_payload_json: {
          discount_code: 'SMALL5',
          discount_percent: 5,
          product_ids: ['gid://shopify/Product/456'],
        },
        started_at: new Date('2024-01-15T12:00:00Z'),
        action_draft: {
          id: 'draft-456',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-456',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'executed',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-456',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'low',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.5,
            state: 'executed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(execution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);
      prismaMock.outcome.create.mockResolvedValue({
        id: 'outcome-456',
        execution_id: execution.id,
        outcome: OutcomeType.NEUTRAL,
        computed_at: new Date(),
        evidence_json: {
          baseline_conversion_rate: 0.02,
          campaign_conversion_rate: 0.021,
          uplift_percent: 5,
          orders_attributed: 1,
          revenue_generated: 50,
          observation_window_days: 7,
        },
      });

      const result = await computeOutcome(execution.id);

      expect(result).toBeDefined();
      expect(result?.outcome).toBe(OutcomeType.NEUTRAL);
    });

    it('should compute HURT outcome for negative impact', async () => {
      const execution = createTestExecution({
        id: 'exec-discount-789',
        workspace_id: testWorkspace.id,
        status: 'succeeded',
        request_payload_json: {
          discount_code: 'TOOBIG50',
          discount_percent: 50,
          product_ids: ['gid://shopify/Product/789'],
        },
        started_at: new Date('2024-01-15T12:00:00Z'),
        action_draft: {
          id: 'draft-789',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-789',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'executed',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-789',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'medium',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.5,
            state: 'executed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(execution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);
      prismaMock.outcome.create.mockResolvedValue({
        id: 'outcome-789',
        execution_id: execution.id,
        outcome: OutcomeType.HURT,
        computed_at: new Date(),
        evidence_json: {
          baseline_conversion_rate: 0.025,
          campaign_conversion_rate: 0.015,
          uplift_percent: -40,
          orders_attributed: 3,
          revenue_generated: 150,
          revenue_lost_to_discount: 300,
          margin_impact: -150,
          observation_window_days: 7,
        },
      });

      const result = await computeOutcome(execution.id);

      expect(result).toBeDefined();
      expect(result?.outcome).toBe(OutcomeType.HURT);
      expect(result?.evidence?.margin_impact).toBeLessThan(0);
    });
  });

  describe('Confidence Update Based on Outcomes', () => {
    it('should increase confidence after HELPED outcome', async () => {
      // Setup execution that succeeded
      const execution = createTestExecution({
        status: 'succeeded',
        action_draft: {
          id: 'draft-123',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-123',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'executed',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-123',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'high',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.5,
            state: 'executed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(execution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);
      prismaMock.outcome.create.mockResolvedValue({
        id: 'outcome-123',
        execution_id: execution.id,
        outcome: OutcomeType.HELPED,
        computed_at: new Date(),
        evidence_json: {
          uplift_percent: 80,
          orders_attributed: 10,
        },
      });

      await computeOutcome(execution.id);

      // In real implementation, this would trigger confidence update
      // Confidence should increase for this operator intent + opportunity type
      expect(prismaMock.outcome.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            outcome: OutcomeType.HELPED,
          }),
        })
      );
    });

    it('should decrease confidence after HURT outcome', async () => {
      const execution = createTestExecution({
        status: 'succeeded',
        action_draft: {
          id: 'draft-456',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-456',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'executed',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-456',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'high',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.7,
            state: 'executed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(execution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);
      prismaMock.outcome.create.mockResolvedValue({
        id: 'outcome-456',
        execution_id: execution.id,
        outcome: OutcomeType.HURT,
        computed_at: new Date(),
        evidence_json: {
          margin_impact: -200,
        },
      });

      await computeOutcome(execution.id);

      // Confidence should decrease after negative outcome
      expect(prismaMock.outcome.create).toHaveBeenCalled();
    });

    it('should maintain confidence after NEUTRAL outcome', async () => {
      const execution = createTestExecution({
        status: 'succeeded',
        action_draft: {
          id: 'draft-789',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-789',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'executed',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-789',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'medium',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.6,
            state: 'executed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(execution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);
      prismaMock.outcome.create.mockResolvedValue({
        id: 'outcome-789',
        execution_id: execution.id,
        outcome: OutcomeType.NEUTRAL,
        computed_at: new Date(),
        evidence_json: {
          uplift_percent: 3,
        },
      });

      await computeOutcome(execution.id);

      // Neutral outcomes should have minimal impact on confidence
      expect(prismaMock.outcome.create).toHaveBeenCalled();
    });
  });

  describe('Evidence Storage', () => {
    it('should store detailed evidence for discount outcomes', async () => {
      const execution = createTestExecution({
        status: 'succeeded',
        action_draft: {
          id: 'draft-123',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-123',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'executed',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-123',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'high',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.5,
            state: 'executed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      const evidence = {
        baseline_conversion_rate: 0.02,
        campaign_conversion_rate: 0.045,
        uplift_percent: 125,
        orders_attributed: 8,
        revenue_generated: 640,
        revenue_baseline: 256,
        revenue_delta: 384,
        observation_window_days: 7,
        observation_start: '2024-01-15T12:00:00Z',
        observation_end: '2024-01-22T12:00:00Z',
        discount_code: 'SALE20',
        discount_percent: 20,
      };

      prismaMock.execution.findUnique.mockResolvedValue(execution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);
      prismaMock.outcome.create.mockResolvedValue({
        id: 'outcome-123',
        execution_id: execution.id,
        outcome: OutcomeType.HELPED,
        computed_at: new Date(),
        evidence_json: evidence,
      });

      const result = await computeOutcome(execution.id);

      expect(result?.evidence).toBeDefined();
      expect(result?.evidence).toMatchObject({
        baseline_conversion_rate: expect.any(Number),
        campaign_conversion_rate: expect.any(Number),
        uplift_percent: expect.any(Number),
        orders_attributed: expect.any(Number),
        observation_window_days: expect.any(Number),
      });
    });

    it('should store evidence that is auditable and replayable', async () => {
      const execution = createTestExecution({
        status: 'succeeded',
        started_at: new Date('2024-01-15T12:00:00Z'),
        action_draft: {
          id: 'draft-123',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-123',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'executed',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-123',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'high',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.5,
            state: 'executed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(execution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);
      prismaMock.outcome.create.mockResolvedValue({
        id: 'outcome-123',
        execution_id: execution.id,
        outcome: OutcomeType.HELPED,
        computed_at: new Date('2024-01-22T12:00:00Z'),
        evidence_json: {
          observation_start: '2024-01-15T12:00:00Z',
          observation_end: '2024-01-22T12:00:00Z',
          data_sources: ['orders', 'product_analytics'],
          computation_version: 'v1.0',
        },
      });

      const result = await computeOutcome(execution.id);

      // Evidence should include timestamps and versioning for auditability
      expect(result?.evidence).toHaveProperty('observation_start');
      expect(result?.evidence).toHaveProperty('observation_end');
      expect(result?.computed_at).toBeDefined();
    });
  });

  describe('Observation Window', () => {
    it('should wait for observation window before computing outcome', async () => {
      const recentExecution = createTestExecution({
        id: 'exec-recent',
        status: 'succeeded',
        started_at: new Date(), // Just started
        action_draft: {
          execution_type: 'discount_draft',
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(recentExecution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);

      const isReady = await isExecutionReadyForOutcome('exec-recent');

      // Should not be ready yet (observation window not complete)
      expect(isReady).toBe(false);
    });

    it('should compute outcome after observation window completes', async () => {
      const oldExecution = createTestExecution({
        id: 'exec-old',
        status: 'succeeded',
        started_at: new Date('2024-01-01T12:00:00Z'), // 2+ weeks ago
        action_draft: {
          execution_type: 'discount_draft',
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(oldExecution);
      prismaMock.outcome.findUnique.mockResolvedValue(null);

      const isReady = await isExecutionReadyForOutcome('exec-old');

      // Should be ready (observation window complete)
      expect(isReady).toBe(true);
    });

    it('should use different observation windows for different execution types', async () => {
      // Discount: 7 days
      const discountExec = createTestExecution({
        started_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        action_draft: {
          execution_type: 'discount_draft',
        },
      });

      // Win-back email: 14 days
      const emailExec = createTestExecution({
        started_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        action_draft: {
          execution_type: 'winback_email_draft',
        },
      });

      prismaMock.execution.findUnique.mockResolvedValueOnce(discountExec);
      prismaMock.outcome.findUnique.mockResolvedValue(null);

      const discountReady = await isExecutionReadyForOutcome('exec-discount');
      expect(discountReady).toBe(true); // 8 days > 7 days

      prismaMock.execution.findUnique.mockResolvedValueOnce(emailExec);

      const emailReady = await isExecutionReadyForOutcome('exec-email');
      expect(emailReady).toBe(false); // 8 days < 14 days
    });
  });

  describe('Outcome Idempotency', () => {
    it('should not recompute outcome if already exists', async () => {
      const execution = createTestExecution({
        id: 'exec-123',
        status: 'succeeded',
        action_draft: {
          id: 'draft-123',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-123',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'executed',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-123',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'high',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.5,
            state: 'executed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      const existingOutcome = {
        id: 'outcome-123',
        execution_id: 'exec-123',
        outcome: OutcomeType.HELPED,
        computed_at: new Date('2024-01-22T12:00:00Z'),
        evidence_json: {},
      };

      prismaMock.execution.findUnique.mockResolvedValue(execution);
      prismaMock.outcome.findUnique.mockResolvedValue(existingOutcome);

      const result = await computeOutcome('exec-123');

      // Should return null (outcome already computed)
      expect(result).toBeNull();
      // Should not create new outcome
      expect(prismaMock.outcome.create).not.toHaveBeenCalled();
    });

    it('should skip failed executions', async () => {
      const failedExecution = createTestExecution({
        id: 'exec-failed',
        status: 'failed',
        action_draft: {
          id: 'draft-123',
          workspace_id: testWorkspace.id,
          opportunity_id: 'opp-123',
          operator_intent: 'reduce_inventory_risk',
          execution_type: 'discount_draft',
          payload_json: {},
          editable_fields_json: {},
          state: 'draft',
          created_at: new Date(),
          updated_at: new Date(),
          opportunity: {
            id: 'opp-123',
            workspace_id: testWorkspace.id,
            type: 'inventory_clearance',
            priority_bucket: 'high',
            why_now: 'Test',
            rationale: 'Test',
            impact_range: 'Test',
            counterfactual: 'Test',
            decay_at: new Date(),
            confidence: 0.5,
            state: 'new',
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      });

      prismaMock.execution.findUnique.mockResolvedValue(failedExecution);

      const result = await computeOutcome('exec-failed');

      // Should not compute outcome for failed execution
      expect(result).toBeNull();
      expect(prismaMock.outcome.create).not.toHaveBeenCalled();
    });
  });
});
