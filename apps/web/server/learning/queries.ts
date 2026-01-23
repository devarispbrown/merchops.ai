/**
 * Learning Loop Queries
 *
 * Database queries for outcomes, confidence scores, and track records
 */

import { OperatorIntent } from '@prisma/client';
import { prisma } from '@/server/db/client';
import {
  OutcomeType,
  fromPrismaOutcomeType,
  TrackRecord,
  OutcomeEvidence,
} from './types';

/**
 * Get outcome for a specific execution
 */
export async function getOutcomeForExecution(executionId: string) {
  const outcome = await prisma.outcome.findUnique({
    where: { execution_id: executionId },
    include: {
      execution: {
        include: {
          action_draft: {
            include: {
              opportunity: true,
            },
          },
        },
      },
    },
  });

  if (!outcome) {
    return null;
  }

  return {
    id: outcome.id,
    execution_id: outcome.execution_id,
    outcome: fromPrismaOutcomeType(outcome.outcome),
    computed_at: outcome.computed_at,
    evidence: outcome.evidence_json as unknown as OutcomeEvidence,
    execution: {
      id: outcome.execution.id,
      status: outcome.execution.status,
      started_at: outcome.execution.started_at,
      finished_at: outcome.execution.finished_at,
      operator_intent: outcome.execution.action_draft.operator_intent,
      execution_type: outcome.execution.action_draft.execution_type,
    },
  };
}

/**
 * Get all outcomes for a workspace
 */
export async function getOutcomesForWorkspace(
  workspaceId: string,
  options?: {
    limit?: number;
    offset?: number;
    operatorIntent?: OperatorIntent;
    outcomeType?: OutcomeType;
  }
) {
  const { limit = 50, offset = 0, operatorIntent, outcomeType } = options || {};

  const outcomes = await prisma.outcome.findMany({
    where: {
      execution: {
        workspace_id: workspaceId,
        ...(operatorIntent && {
          action_draft: {
            operator_intent: operatorIntent,
          },
        }),
      },
      ...(outcomeType && {
        outcome: outcomeType as any,
      }),
    },
    include: {
      execution: {
        include: {
          action_draft: {
            include: {
              opportunity: {
                select: {
                  id: true,
                  type: true,
                  priority_bucket: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      computed_at: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return outcomes.map((outcome) => ({
    id: outcome.id,
    execution_id: outcome.execution_id,
    outcome: fromPrismaOutcomeType(outcome.outcome),
    computed_at: outcome.computed_at,
    evidence: outcome.evidence_json as unknown as OutcomeEvidence,
    execution: {
      id: outcome.execution.id,
      status: outcome.execution.status,
      started_at: outcome.execution.started_at,
      finished_at: outcome.execution.finished_at,
      operator_intent: outcome.execution.action_draft.operator_intent,
      execution_type: outcome.execution.action_draft.execution_type,
    },
    opportunity: outcome.execution.action_draft.opportunity,
  }));
}

/**
 * Get track record for an operator intent
 */
export async function getRecentTrackRecord(
  workspaceId: string,
  operatorIntent: OperatorIntent,
  limit: number = 20
): Promise<TrackRecord> {
  const executions = await prisma.execution.findMany({
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
    },
    orderBy: {
      started_at: 'desc',
    },
    take: limit,
  });

  let helpedCount = 0;
  let neutralCount = 0;
  let hurtCount = 0;

  const recentOutcomes = executions
    .filter((e) => e.outcome)
    .map((e) => {
      const outcome = fromPrismaOutcomeType(e.outcome!.outcome);

      // Count outcomes
      if (outcome === OutcomeType.HELPED) helpedCount++;
      else if (outcome === OutcomeType.NEUTRAL) neutralCount++;
      else if (outcome === OutcomeType.HURT) hurtCount++;

      return {
        execution_id: e.id,
        outcome,
        computed_at: e.outcome!.computed_at,
      };
    });

  const totalExecutions = recentOutcomes.length;
  const successRate = totalExecutions > 0 ? helpedCount / totalExecutions : 0;
  const harmRate = totalExecutions > 0 ? hurtCount / totalExecutions : 0;

  return {
    operator_intent: operatorIntent,
    total_executions: totalExecutions,
    helped_count: helpedCount,
    neutral_count: neutralCount,
    hurt_count: hurtCount,
    success_rate: successRate,
    harm_rate: harmRate,
    recent_outcomes: recentOutcomes,
  };
}

/**
 * Get executions ready for outcome computation
 *
 * Returns executions that:
 * - Have succeeded
 * - Don't have an outcome yet
 * - Have passed their observation window
 */
export async function getExecutionsReadyForOutcome(
  workspaceId: string,
  limit: number = 10
) {
  // Get succeeded executions without outcomes
  const executions = await prisma.execution.findMany({
    where: {
      workspace_id: workspaceId,
      status: 'succeeded',
      outcome: null,
    },
    include: {
      action_draft: true,
    },
    orderBy: {
      started_at: 'asc',
    },
    take: limit * 2, // Fetch more since we'll filter
  });

  // Filter by observation window
  const now = new Date();
  const ready = executions.filter((execution) => {
    const observationDays = getObservationWindowDays(
      execution.action_draft.execution_type
    );
    const observationEndDate = new Date(execution.started_at);
    observationEndDate.setDate(observationEndDate.getDate() + observationDays);

    return now >= observationEndDate;
  });

  return ready.slice(0, limit);
}

/**
 * Get observation window duration in days for an execution type
 */
function getObservationWindowDays(executionType: string): number {
  switch (executionType) {
    case 'discount_draft':
      return 7;
    case 'winback_email_draft':
      return 14;
    case 'pause_product':
      return 14;
    default:
      return 7;
  }
}

/**
 * Get outcome statistics for workspace
 */
export async function getOutcomeStatistics(workspaceId: string) {
  const outcomes = await prisma.outcome.findMany({
    where: {
      execution: {
        workspace_id: workspaceId,
      },
    },
    include: {
      execution: {
        include: {
          action_draft: {
            select: {
              operator_intent: true,
            },
          },
        },
      },
    },
  });

  const byIntent: Record<
    string,
    { helped: number; neutral: number; hurt: number; total: number }
  > = {
    reduce_inventory_risk: { helped: 0, neutral: 0, hurt: 0, total: 0 },
    reengage_dormant_customers: { helped: 0, neutral: 0, hurt: 0, total: 0 },
    protect_margin: { helped: 0, neutral: 0, hurt: 0, total: 0 },
  };

  for (const outcome of outcomes) {
    const intent = outcome.execution.action_draft.operator_intent;
    const stats = byIntent[intent];

    stats.total++;
    if (outcome.outcome === 'helped') stats.helped++;
    else if (outcome.outcome === 'neutral') stats.neutral++;
    else if (outcome.outcome === 'hurt') stats.hurt++;
  }

  return {
    total: outcomes.length,
    by_intent: byIntent,
    overall: {
      helped: outcomes.filter((o) => o.outcome === 'helped').length,
      neutral: outcomes.filter((o) => o.outcome === 'neutral').length,
      hurt: outcomes.filter((o) => o.outcome === 'hurt').length,
    },
  };
}
