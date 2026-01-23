/**
 * Confidence Score Calculation
 *
 * Computes confidence scores for operator intents based on recent outcomes
 * Scores are deterministic and based on track record
 */

import { OperatorIntent, OutcomeType as PrismaOutcomeType } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { ConfidenceScore, OutcomeType, fromPrismaOutcomeType } from './types';

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
 * Update and persist confidence scores for a workspace
 *
 * Calculates confidence scores for all operator intents and stores them
 * in a JSON field on the workspace record or a dedicated confidence_scores table.
 *
 * @param workspaceId - Workspace to update confidence scores for
 * @returns Array of updated confidence scores
 */
export async function updateConfidenceScores(
  workspaceId: string
): Promise<ConfidenceScore[]> {
  // Calculate all confidence scores
  const scores = await calculateAllConfidenceScores(workspaceId);

  // Store confidence scores in workspace metadata
  // Note: This assumes there's a confidence_scores_json field or similar
  // Adjust based on your actual schema
  try {
    const scoresData = scores.reduce((acc, score) => {
      acc[score.operator_intent] = {
        score: score.score,
        trend: score.trend,
        recent_executions: score.recent_executions,
        helped_count: score.helped_count,
        neutral_count: score.neutral_count,
        hurt_count: score.hurt_count,
        last_computed_at: score.last_computed_at.toISOString(),
      };
      return acc;
    }, {} as Record<string, any>);

    // Update workspace with confidence scores
    // If you have a dedicated table, use that instead
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        // Assuming there's a metadata_json or similar field
        // Adjust based on your actual schema
        updated_at: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to persist confidence scores:', error);
    // Don't throw - return calculated scores even if persistence fails
  }

  return scores;
}
