/**
 * Outcome Compute Worker
 *
 * Processes outcome computation for executed actions.
 * Determines if an action helped, was neutral, or hurt based on metrics.
 * Updates confidence scores for operator intents.
 */

import { Job, Worker } from 'bullmq';
import { prisma } from '../../db/client';
import { QUEUE_NAMES, redisConnection, defaultWorkerOptions, isRedisConfigured } from '../config';
import {
  createWorkerLogger,
  logJobStart,
  logJobComplete,
  logJobFailed,
} from '../../observability/logger';
import { ExecutionType } from '../../actions/types';
import { resolveDiscountOutcome } from '../../learning/outcomes/resolvers/discount';
import { resolveWinbackOutcome } from '../../learning/outcomes/resolvers/winback';
import { resolvePauseProductOutcome } from '../../learning/outcomes/resolvers/pause';
import { updateConfidenceScores } from '../../learning/confidence';

// ============================================================================
// TYPES
// ============================================================================

interface OutcomeComputeJobData {
  execution_id: string;
  workspace_id: string;
  correlation_id?: string;
}

interface OutcomeComputeResult {
  execution_id: string;
  workspace_id: string;
  outcome: 'helped' | 'neutral' | 'hurt';
  evidence: any;
  confidence_updated: boolean;
  duration_ms: number;
}

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

const logger = createWorkerLogger('outcome-compute');

// Only create worker if Redis is configured
export const outcomeComputeWorker = isRedisConfigured() && redisConnection
  ? new Worker<OutcomeComputeJobData, OutcomeComputeResult>(
      QUEUE_NAMES.OUTCOME_COMPUTE,
      processOutcomeCompute,
      {
        ...defaultWorkerOptions,
        connection: redisConnection,
      }
    )
  : null;

// ============================================================================
// EVENT HANDLERS
// ============================================================================

if (outcomeComputeWorker) {
  outcomeComputeWorker.on('completed', (job, result) => {
    logJobComplete(job.id!, job.name!, result, result.duration_ms, result.workspace_id);
  });

  outcomeComputeWorker.on('failed', (job, error) => {
    if (job) {
      logJobFailed(
        job.id!,
        job.name!,
        error as Error,
        job.attemptsMade,
        job.data.workspace_id
      );
    }
  });

  outcomeComputeWorker.on('error', (error) => {
    logger.error({ error: error.message, stack: error.stack }, 'Worker error');
  });
} else {
  logger.warn('Outcome compute worker not initialized - Redis not configured');
}

// ============================================================================
// JOB PROCESSOR
// ============================================================================

async function processOutcomeCompute(
  job: Job<OutcomeComputeJobData, OutcomeComputeResult>
): Promise<OutcomeComputeResult> {
  const startTime = Date.now();
  const { execution_id, workspace_id } = job.data;

  logJobStart(job.id!, job.name!, { execution_id }, workspace_id);

  try {
    // Get execution details
    const execution = await prisma.execution.findUnique({
      where: { id: execution_id },
      include: {
        action_draft: {
          include: {
            opportunity: true,
          },
        },
      },
    });

    if (!execution) {
      throw new Error(`Execution not found: ${execution_id}`);
    }

    if (execution.status !== 'succeeded') {
      throw new Error(
        `Cannot compute outcome for non-successful execution: ${execution.status}`
      );
    }

    // Check if outcome already computed
    const existingOutcome = await prisma.outcome.findUnique({
      where: { execution_id },
    });

    if (existingOutcome) {
      logger.info(
        { execution_id, outcome: existingOutcome.outcome },
        'Outcome already computed, returning existing result'
      );

      return {
        execution_id,
        workspace_id,
        outcome: existingOutcome.outcome as 'helped' | 'neutral' | 'hurt',
        evidence: existingOutcome.evidence_json,
        confidence_updated: false,
        duration_ms: 0,
      };
    }

    // Resolve outcome based on execution type
    const executionType = execution.action_draft.execution_type as ExecutionType;
    let outcomeResult;

    logger.info(
      { execution_id, executionType, workspace_id },
      `Computing outcome for ${executionType} execution`
    );

    // Build input for outcome resolvers
    const computationInput = {
      execution_id,
      workspace_id,
      operator_intent: execution.action_draft.operator_intent,
      execution_type: executionType,
      execution_payload: (execution.request_payload_json as Record<string, unknown>) ?? {},
      executed_at: execution.started_at ?? new Date(),
    };

    switch (executionType) {
      case ExecutionType.DISCOUNT_DRAFT:
        outcomeResult = await resolveDiscountOutcome(computationInput);
        break;

      case ExecutionType.WINBACK_EMAIL:
        outcomeResult = await resolveWinbackOutcome(computationInput);
        break;

      case ExecutionType.PAUSE_PRODUCT:
        outcomeResult = await resolvePauseProductOutcome(computationInput);
        break;

      default:
        throw new Error(`Unknown execution type: ${executionType}`);
    }

    // Store outcome
    await prisma.outcome.create({
      data: {
        execution_id,
        outcome: outcomeResult.outcome,
        computed_at: new Date(),
        evidence_json: outcomeResult.evidence,
      },
    });

    logger.info(
      {
        execution_id,
        outcome: outcomeResult.outcome,
        evidence: outcomeResult.evidence,
      },
      'Outcome computed and stored'
    );

    // Update confidence scores for this workspace
    await updateConfidenceScores(workspace_id);

    const duration_ms = Date.now() - startTime;

    logger.info(
      { workspace_id, execution_id, outcome: outcomeResult.outcome, duration_ms },
      'Outcome computation completed'
    );

    return {
      execution_id,
      workspace_id,
      outcome: outcomeResult.outcome,
      evidence: outcomeResult.evidence,
      confidence_updated: true,
      duration_ms,
    };
  } catch (error: any) {
    logger.error(
      {
        execution_id,
        workspace_id,
        error: error.message,
        stack: error.stack,
      },
      'Outcome computation failed'
    );
    throw error;
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function shutdownOutcomeComputeWorker(): Promise<void> {
  if (!outcomeComputeWorker) {
    logger.debug('Outcome compute worker not running - nothing to shut down');
    return;
  }
  logger.info('Shutting down outcome compute worker...');
  await outcomeComputeWorker.close();
  logger.info('Outcome compute worker shut down');
}
