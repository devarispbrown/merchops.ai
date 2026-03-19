/**
 * Execution Worker
 *
 * Processes approved action executions with idempotency guarantees.
 * Calls appropriate executor (discount, pause, email) based on execution type.
 * Handles retries with exponential backoff and stores provider responses.
 */

import { Job, Worker } from 'bullmq';
import { prisma } from '../../db/client';
import { QUEUE_NAMES, redisConnection, defaultWorkerOptions, isRedisConfigured } from '../config';
import {
  createWorkerLogger,
  logJobStart,
  logJobComplete,
  logJobFailed,
  logExecution,
} from '../../observability/logger';
import { captureJobError } from '../../observability/sentry';
import { ExecutionType, ExecutionStatus, isRetryableError as _isRetryableError } from '../../actions/types';
import { executeDiscount } from '../../actions/execute/discount';
import { executePauseProduct } from '../../actions/execute/pause-product';
import { executeEmail } from '../../actions/execute/email';
import { getOutcomeComputeQueue } from '../queues';

// ============================================================================
// TYPES
// ============================================================================

interface ExecutionJobData {
  execution_id: string;
  workspace_id: string;
  action_draft_id: string;
  execution_type: ExecutionType;
  payload: any;
  idempotency_key: string;
  correlation_id?: string;
}

interface ExecutionResult {
  execution_id: string;
  workspace_id: string;
  status: ExecutionStatus;
  provider_response?: any;
  error_code?: string;
  error_message?: string;
  duration_ms: number;
}

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

const logger = createWorkerLogger('execution');

// Only create worker if Redis is configured
export const executionWorker = isRedisConfigured() && redisConnection
  ? new Worker<ExecutionJobData, ExecutionResult>(
      QUEUE_NAMES.EXECUTION,
      processExecution,
      {
        ...defaultWorkerOptions,
        connection: redisConnection,
      }
    )
  : null;

// ============================================================================
// EVENT HANDLERS
// ============================================================================

if (executionWorker) {
  executionWorker.on('completed', (job, result) => {
    logJobComplete(job.id!, job.name!, result, result.duration_ms, result.workspace_id);
  });

  executionWorker.on('failed', (job, error) => {
    if (job) {
      logJobFailed(
        job.id!,
        job.name!,
        error as Error,
        job.attemptsMade,
        job.data.workspace_id
      );
      captureJobError(error as Error, job.name!, job.id!, job.data, job.attemptsMade);
    }
  });

  executionWorker.on('error', (error) => {
    logger.error({ error: error.message, stack: error.stack }, 'Worker error');
    captureJobError(error, 'execution-worker', 'unknown', {}, 0);
  });
} else {
  logger.warn('Execution worker not initialized - Redis not configured');
}

// ============================================================================
// JOB PROCESSOR
// ============================================================================

async function processExecution(
  job: Job<ExecutionJobData, ExecutionResult>
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const { execution_id, workspace_id, execution_type, payload, idempotency_key } = job.data;

  logJobStart(job.id!, job.name!, { execution_id, execution_type }, workspace_id);

  try {
    // Check idempotency: verify execution hasn't already succeeded
    const existingExecution = await checkIdempotency(execution_id, idempotency_key);

    if (existingExecution) {
      logger.info(
        { execution_id, idempotency_key, status: existingExecution.status },
        'Execution already processed (idempotency check)'
      );

      return {
        execution_id,
        workspace_id,
        status: existingExecution.status as ExecutionStatus,
        provider_response: existingExecution.provider_response_json,
        duration_ms: 0,
      };
    }

    // Update execution status to running
    await prisma.execution.update({
      where: { id: execution_id },
      data: {
        status: ExecutionStatus.RUNNING,
        started_at: new Date(),
      },
    });

    // Execute based on type
    let result;
    switch (execution_type) {
      case ExecutionType.DISCOUNT_DRAFT:
        result = await executeDiscount({ workspaceId: workspace_id, payload });
        break;

      case ExecutionType.PAUSE_PRODUCT:
        result = await executePauseProduct({ workspaceId: workspace_id, payload });
        break;

      case ExecutionType.WINBACK_EMAIL:
        result = await executeEmail({ workspaceId: workspace_id, payload });
        break;

      default:
        throw new Error(`Unknown execution type: ${execution_type}`);
    }

    const duration_ms = Date.now() - startTime;

    // Update execution with result
    if (result.success) {
      await prisma.execution.update({
        where: { id: execution_id },
        data: {
          status: ExecutionStatus.SUCCEEDED,
          provider_response_json: result.providerResponse,
          finished_at: new Date(),
        },
      });

      logExecution(execution_id, execution_type, 'succeeded', workspace_id);

      // Schedule outcome computation (delayed by 24 hours for data collection)
      const outcomeQueue = getOutcomeComputeQueue();
      if (outcomeQueue) {
        await outcomeQueue.add(
          'compute-outcome',
          {
            execution_id,
            workspace_id,
            correlation_id: job.data.correlation_id,
          },
          {
            delay: 24 * 60 * 60 * 1000, // 24 hours
          }
        );
      }

      return {
        execution_id,
        workspace_id,
        status: ExecutionStatus.SUCCEEDED,
        provider_response: result.providerResponse,
        duration_ms,
      };
    } else {
      // Handle failure
      const errorCode = result.error?.code || 'UNKNOWN_ERROR';
      const errorMessage = result.error?.message || 'Unknown error occurred';
      const isRetryable = result.error?.retryable || false;

      await prisma.execution.update({
        where: { id: execution_id },
        data: {
          status: isRetryable ? ExecutionStatus.RETRYING : ExecutionStatus.FAILED,
          error_code: errorCode,
          error_message: errorMessage,
          finished_at: new Date(),
        },
      });

      logExecution(execution_id, execution_type, 'failed', workspace_id, new Error(errorMessage));

      // Throw error if retryable so BullMQ will retry
      if (isRetryable && job.attemptsMade < (job.opts.attempts || 3)) {
        throw new Error(errorMessage);
      }

      return {
        execution_id,
        workspace_id,
        status: ExecutionStatus.FAILED,
        error_code: errorCode,
        error_message: errorMessage,
        duration_ms,
      };
    }
  } catch (error: any) {
    const _duration_ms = Date.now() - startTime;

    // Update execution status
    await prisma.execution.update({
      where: { id: execution_id },
      data: {
        status:
          job.attemptsMade < (job.opts.attempts || 3) - 1
            ? ExecutionStatus.RETRYING
            : ExecutionStatus.FAILED,
        error_code: 'UNKNOWN_ERROR',
        error_message: error.message,
        finished_at: new Date(),
      },
    });

    logger.error(
      {
        execution_id,
        workspace_id,
        execution_type,
        error: error.message,
        stack: error.stack,
        attemptsMade: job.attemptsMade,
      },
      'Execution failed'
    );

    throw error; // Re-throw for BullMQ retry logic
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if execution has already been processed (idempotency)
 */
async function checkIdempotency(
  execution_id: string,
  idempotency_key: string
): Promise<any | null> {
  const execution = await prisma.execution.findUnique({
    where: { id: execution_id },
  });

  if (!execution) {
    return null;
  }

  // If execution succeeded or is currently running, return it
  if (
    execution.status === ExecutionStatus.SUCCEEDED ||
    execution.status === ExecutionStatus.RUNNING
  ) {
    return execution;
  }

  // Check for any other execution with same idempotency key that succeeded
  const duplicateExecution = await prisma.execution.findFirst({
    where: {
      idempotency_key,
      status: ExecutionStatus.SUCCEEDED,
      id: { not: execution_id },
    },
  });

  return duplicateExecution;
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function shutdownExecutionWorker(): Promise<void> {
  if (!executionWorker) {
    logger.debug('Execution worker not running - nothing to shut down');
    return;
  }
  logger.info('Shutting down execution worker...');
  await executionWorker.close();
  logger.info('Execution worker shut down');
}
