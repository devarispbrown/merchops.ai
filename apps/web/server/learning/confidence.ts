/**
 * Confidence Score Calculation
 *
 * Computes confidence scores for operator intents based on recent outcomes
 * and persists each computation as a historical record in the confidence_scores
 * table. Scores are deterministic and based on track record.
 */

import { OperatorIntent, OutcomeType as PrismaOutcomeType } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { ConfidenceScore, OutcomeType as _OutcomeType, fromPrismaOutcomeType as _fromPrismaOutcomeType } from './types';

/**
 * Calculate confidence score for an operator intent
 *
 * Confidence is based on:
 * - Recent outcomes (last 10-20 executions)
 * - Success rate (helped / total)
 * - Harm rate (hurt / total)
 * - Trend direction (improving, stable, declining)
 *
 * Score range: 0-100
 * - 0-40: Low confidence (many failures or insufficient data)
 * - 41-70: Medium confidence (mixed results)
 * - 71-100: High confidence (consistent success)
 */
export async function calculateConfidence(
  workspaceId: string,
  operatorIntent: OperatorIntent
): Promise<ConfidenceScore> {
  // Fetch recent executions with outcomes for this intent
  const recentExecutions = await prisma.execution.findMany({
    where: {
      workspace_id: workspaceId,
      action_draft: {
        operator_intent: operatorIntent,
      },
      status: 'succeeded',
      outcome: {
        isNot: null,
      },
    },
    include: {
      outcome: true,
      action_draft: true,
    },
    orderBy: {
      started_at: 'desc',
    },
    take: 20, // Consider last 20 executions
  });

  // Count outcomes
  let helpedCount = 0;
  let neutralCount = 0;
  let hurtCount = 0;

  for (const execution of recentExecutions) {
    if (!execution.outcome) continue;

    switch (execution.outcome.outcome) {
      case 'helped':
        helpedCount++;
        break;
      case 'neutral':
        neutralCount++;
        break;
      case 'hurt':
        hurtCount++;
        break;
    }
  }

  const totalExecutions = recentExecutions.length;

  // Calculate base score
  let score = 0;

  if (totalExecutions === 0) {
    // No data: default to neutral confidence
    score = 50;
  } else {
    // Success rate component (0-70 points)
    const successRate = helpedCount / totalExecutions;
    const successPoints = successRate * 70;

    // Harm penalty (-30 points max)
    const harmRate = hurtCount / totalExecutions;
    const harmPenalty = harmRate * 30;

    // Volume bonus (0-10 points for having sufficient data)
    const volumeBonus = Math.min(totalExecutions / 20, 1) * 10;

    score = successPoints - harmPenalty + volumeBonus;
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Calculate trend (comparing first half vs second half)
  const trend = calculateTrend(recentExecutions);

  return {
    operator_intent: operatorIntent,
    score: Math.round(score),
    trend,
    recent_executions: totalExecutions,
    helped_count: helpedCount,
    neutral_count: neutralCount,
    hurt_count: hurtCount,
    last_computed_at: new Date(),
  };
}

/**
 * Calculate trend direction
 *
 * Compares first half of recent executions vs second half
 * to determine if performance is improving, stable, or declining
 */
function calculateTrend(
  executions: Array<{
    outcome: { outcome: PrismaOutcomeType } | null;
  }>
): 'improving' | 'stable' | 'declining' {
  if (executions.length < 6) {
    return 'stable'; // Not enough data for trend
  }

  const midpoint = Math.floor(executions.length / 2);

  // Earlier executions (older)
  const earlierHalf = executions.slice(midpoint);
  const earlierSuccessRate = calculateSuccessRate(earlierHalf);

  // Later executions (newer)
  const laterHalf = executions.slice(0, midpoint);
  const laterSuccessRate = calculateSuccessRate(laterHalf);

  const delta = laterSuccessRate - earlierSuccessRate;

  // Threshold: 10% change
  if (delta > 0.1) {
    return 'improving';
  } else if (delta < -0.1) {
    return 'declining';
  } else {
    return 'stable';
  }
}

/**
 * Calculate success rate for a set of executions
 */
function calculateSuccessRate(
  executions: Array<{
    outcome: { outcome: PrismaOutcomeType } | null;
  }>
): number {
  if (executions.length === 0) return 0;

  const helped = executions.filter(
    (e) => e.outcome?.outcome === 'helped'
  ).length;

  return helped / executions.length;
}

/**
 * Calculate confidence scores for all operator intents in a workspace
 */
export async function calculateAllConfidenceScores(
  workspaceId: string
): Promise<ConfidenceScore[]> {
  const intents: OperatorIntent[] = [
    'reduce_inventory_risk',
    'reengage_dormant_customers',
    'protect_margin',
  ];

  const scores = await Promise.all(
    intents.map((intent) => calculateConfidence(workspaceId, intent))
  );

  return scores;
}

/**
 * Persist a single confidence score record.
 *
 * Every call creates a new row so the full history is preserved.
 * Callers should use updateConfidenceScores to compute and persist
 * all intents in one operation.
 */
async function persistConfidenceScore(
  workspaceId: string,
  score: ConfidenceScore
): Promise<void> {
  await prisma.confidenceScore.create({
    data: {
      workspace_id: workspaceId,
      operator_intent: score.operator_intent,
      score: score.score,
      trend: score.trend,
      sample_size: score.recent_executions,
      computed_at: score.last_computed_at,
    },
  });
}

/**
 * Get the most recent confidence score per operator intent for a workspace.
 *
 * Returns one record per intent (the latest computed_at), not the full history.
 * If no persisted record exists for an intent, that intent is omitted from the
 * result — callers can fill in defaults as needed.
 */
export async function getLatestConfidenceScores(
  workspaceId: string
): Promise<ConfidenceScore[]> {
  const intents: OperatorIntent[] = [
    'reduce_inventory_risk',
    'reengage_dormant_customers',
    'protect_margin',
  ];

  // Fetch the most recent record for each intent in a single round-trip per
  // intent. Prisma does not yet support lateral joins, so we run three queries
  // concurrently — still much cheaper than re-computing scores on every read.
  const latestPerIntent = await Promise.all(
    intents.map((intent) =>
      prisma.confidenceScore.findFirst({
        where: {
          workspace_id: workspaceId,
          operator_intent: intent,
        },
        orderBy: {
          computed_at: 'desc',
        },
      })
    )
  );

  return latestPerIntent
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .map((row) => ({
      operator_intent: row.operator_intent as OperatorIntent,
      score: row.score,
      trend: row.trend as 'improving' | 'stable' | 'declining',
      recent_executions: row.sample_size,
      helped_count: 0, // Not stored at the row level; summary stats only
      neutral_count: 0,
      hurt_count: 0,
      last_computed_at: row.computed_at,
    }));
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(score: number): string {
  if (score >= 71) {
    return 'High';
  } else if (score >= 41) {
    return 'Medium';
  } else {
    return 'Low';
  }
}

/**
 * Get confidence explanation
 */
export function getConfidenceExplanation(
  confidence: ConfidenceScore
): string {
  const level = getConfidenceLevel(confidence.score);
  const { helped_count, hurt_count, recent_executions } = confidence;

  if (recent_executions === 0) {
    return 'No executions yet for this intent.';
  }

  const successRate = recent_executions > 0
    ? ((helped_count / recent_executions) * 100).toFixed(0)
    : '0';

  let explanation = `${level} confidence based on ${recent_executions} recent executions: ${helped_count} helped, ${hurt_count} hurt (${successRate}% success rate).`;

  if (confidence.trend === 'improving') {
    explanation += ' Trending up.';
  } else if (confidence.trend === 'declining') {
    explanation += ' Trending down.';
  }

  return explanation;
}

/**
 * Compute and persist confidence scores for a workspace
 *
 * Calculates confidence scores for all operator intents, writes each as a new
 * historical row in the confidence_scores table, then returns the computed
 * scores. Persistence failures are caught and logged so callers always receive
 * the freshly computed scores even when the database write fails.
 *
 * @param workspaceId - Workspace to update confidence scores for
 * @returns Array of computed confidence scores
 */
export async function updateConfidenceScores(
  workspaceId: string
): Promise<ConfidenceScore[]> {
  // Calculate all confidence scores
  const scores = await calculateAllConfidenceScores(workspaceId);

  // Persist each score as a new historical record (append, not upsert)
  try {
    await Promise.all(
      scores.map((score) => persistConfidenceScore(workspaceId, score))
    );
  } catch (error) {
    console.error('Failed to persist confidence scores:', error);
    // Don't throw — return computed scores even if persistence fails
  }

  return scores;
}
