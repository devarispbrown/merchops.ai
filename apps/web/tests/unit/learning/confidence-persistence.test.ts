/**
 * Unit Tests: Confidence Score Persistence
 * MerchOps Beta MVP
 *
 * Tests:
 * - updateConfidenceScores creates new historical records
 * - getLatestConfidenceScores returns only the most recent per intent
 * - Historical records are preserved (multiple rows per intent)
 * - Persistence failures are swallowed; computed scores are still returned
 * - getLatestConfidenceScores handles workspaces with no records
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prismaMock } from '../../setup';
import {
  updateConfidenceScores,
  getLatestConfidenceScores,
} from '@/server/learning/confidence';
import { OperatorIntent } from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExecution(outcome: 'helped' | 'neutral' | 'hurt') {
  return {
    id: `exec-${Math.random().toString(36).slice(2)}`,
    workspace_id: 'ws-1',
    status: 'succeeded',
    started_at: new Date(),
    action_draft: {
      operator_intent: OperatorIntent.reduce_inventory_risk,
    },
    outcome: { outcome },
  };
}

/** Build a mock ConfidenceScore row as Prisma would return it. */
function makeDbRow(overrides: {
  operator_intent: string;
  score: number;
  trend: string;
  sample_size: number;
  computed_at?: Date;
}) {
  return {
    id: `cs-${Math.random().toString(36).slice(2)}`,
    workspace_id: 'ws-1',
    operator_intent: overrides.operator_intent,
    score: overrides.score,
    trend: overrides.trend,
    sample_size: overrides.sample_size,
    computed_at: overrides.computed_at ?? new Date(),
  };
}

// ---------------------------------------------------------------------------
// updateConfidenceScores — persistence
// ---------------------------------------------------------------------------

describe('updateConfidenceScores — persistence', () => {
  beforeEach(() => {
    prismaMock.execution.findMany.mockResolvedValue([]);
    prismaMock.confidenceScore.create.mockResolvedValue({} as any);
  });

  it('creates one ConfidenceScore record per operator intent', async () => {
    await updateConfidenceScores('ws-1');

    // Three intents → three create calls
    expect(prismaMock.confidenceScore.create).toHaveBeenCalledTimes(3);
  });

  it('persists the correct operator intent on each record', async () => {
    await updateConfidenceScores('ws-1');

    const calledIntents = prismaMock.confidenceScore.create.mock.calls.map(
      (call) => call[0].data.operator_intent
    );

    expect(calledIntents).toContain('reduce_inventory_risk');
    expect(calledIntents).toContain('reengage_dormant_customers');
    expect(calledIntents).toContain('protect_margin');
  });

  it('persists the correct score when executions exist', async () => {
    // 10 helped executions for reduce_inventory_risk only
    const executions = Array.from({ length: 10 }, () =>
      makeExecution('helped')
    );
    prismaMock.execution.findMany
      .mockResolvedValueOnce(executions as any) // reduce_inventory_risk
      .mockResolvedValueOnce([]) // reengage_dormant_customers
      .mockResolvedValueOnce([]); // protect_margin

    await updateConfidenceScores('ws-1');

    const reduceRiskCall = prismaMock.confidenceScore.create.mock.calls.find(
      (call) => call[0].data.operator_intent === 'reduce_inventory_risk'
    );

    expect(reduceRiskCall).toBeDefined();
    // 10/20 executions → volume bonus = 5; success 10/10 → 70; total = 75
    expect(reduceRiskCall![0].data.score).toBe(75);
    expect(reduceRiskCall![0].data.sample_size).toBe(10);
  });

  it('stores the workspace_id on every persisted record', async () => {
    await updateConfidenceScores('ws-1');

    const allWorkspaceIds = prismaMock.confidenceScore.create.mock.calls.map(
      (call) => call[0].data.workspace_id
    );
    expect(allWorkspaceIds.every((id) => id === 'ws-1')).toBe(true);
  });

  it('still returns computed scores when persistence fails', async () => {
    prismaMock.confidenceScore.create.mockRejectedValue(
      new Error('DB connection lost')
    );

    // Should not throw
    const scores = await updateConfidenceScores('ws-1');

    expect(scores).toHaveLength(3);
    // Default score for zero executions is 50
    expect(scores.every((s) => s.score === 50)).toBe(true);
  });

  it('creates new rows on each call — does not upsert or overwrite', async () => {
    await updateConfidenceScores('ws-1');
    await updateConfidenceScores('ws-1');

    // 3 intents × 2 calls = 6 create calls, not 3 (upsert) or any update calls
    expect(prismaMock.confidenceScore.create).toHaveBeenCalledTimes(6);
    expect(prismaMock.confidenceScore.upsert).not.toHaveBeenCalled();
    expect(prismaMock.confidenceScore.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getLatestConfidenceScores — reads
// ---------------------------------------------------------------------------

describe('getLatestConfidenceScores', () => {
  it('returns an empty array when no records exist', async () => {
    prismaMock.confidenceScore.findFirst.mockResolvedValue(null);

    const result = await getLatestConfidenceScores('ws-1');

    expect(result).toEqual([]);
  });

  it('returns only the single most recent record per intent', async () => {
    const now = new Date();

    // Simulate findFirst returning the latest row per intent
    prismaMock.confidenceScore.findFirst
      .mockResolvedValueOnce(
        makeDbRow({
          operator_intent: 'reduce_inventory_risk',
          score: 75,
          trend: 'improving',
          sample_size: 10,
          computed_at: now,
        }) as any
      )
      .mockResolvedValueOnce(
        makeDbRow({
          operator_intent: 'reengage_dormant_customers',
          score: 50,
          trend: 'stable',
          sample_size: 0,
          computed_at: now,
        }) as any
      )
      .mockResolvedValueOnce(
        makeDbRow({
          operator_intent: 'protect_margin',
          score: 60,
          trend: 'declining',
          sample_size: 5,
          computed_at: now,
        }) as any
      );

    const result = await getLatestConfidenceScores('ws-1');

    expect(result).toHaveLength(3);
  });

  it('maps the persisted score to the ConfidenceScore interface correctly', async () => {
    const computedAt = new Date('2026-03-19T12:00:00Z');

    prismaMock.confidenceScore.findFirst
      .mockResolvedValueOnce(
        makeDbRow({
          operator_intent: 'reduce_inventory_risk',
          score: 80,
          trend: 'improving',
          sample_size: 20,
          computed_at: computedAt,
        }) as any
      )
      .mockResolvedValue(null); // remaining intents have no records

    const result = await getLatestConfidenceScores('ws-1');

    expect(result).toHaveLength(1);
    const record = result[0];
    expect(record.operator_intent).toBe('reduce_inventory_risk');
    expect(record.score).toBe(80);
    expect(record.trend).toBe('improving');
    expect(record.recent_executions).toBe(20);
    expect(record.last_computed_at).toEqual(computedAt);
  });

  it('queries with computed_at desc order to get the latest', async () => {
    prismaMock.confidenceScore.findFirst.mockResolvedValue(null);

    await getLatestConfidenceScores('ws-1');

    // Every findFirst call must order by computed_at desc
    const calls = prismaMock.confidenceScore.findFirst.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach((call) => {
      expect(call[0]?.orderBy).toEqual({ computed_at: 'desc' });
    });
  });

  it('filters by workspace_id to preserve tenant isolation', async () => {
    prismaMock.confidenceScore.findFirst.mockResolvedValue(null);

    await getLatestConfidenceScores('ws-isolated');

    const calls = prismaMock.confidenceScore.findFirst.mock.calls;
    calls.forEach((call) => {
      expect(call[0]?.where?.workspace_id).toBe('ws-isolated');
    });
  });

  it('preserves historical rows — older records are not returned', async () => {
    // findFirst returns the newest (by orderBy desc); the old row should NOT
    // appear in the result. We verify this by asserting only one row per intent.
    const newerDate = new Date('2026-03-19T12:00:00Z');

    prismaMock.confidenceScore.findFirst
      .mockResolvedValueOnce(
        makeDbRow({
          operator_intent: 'reduce_inventory_risk',
          score: 80,
          trend: 'improving',
          sample_size: 20,
          computed_at: newerDate,
        }) as any
      )
      .mockResolvedValue(null);

    const result = await getLatestConfidenceScores('ws-1');

    // Only one record for reduce_inventory_risk (the newest one)
    const forIntent = result.filter(
      (r) => r.operator_intent === 'reduce_inventory_risk'
    );
    expect(forIntent).toHaveLength(1);
    expect(forIntent[0].score).toBe(80);
    expect(forIntent[0].last_computed_at).toEqual(newerDate);
  });
});
