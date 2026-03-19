/**
 * Action Execution Router
 *
 * Routes action executions to appropriate executors based on execution type.
 * Provides unified interface for executing all action types with consistent
 * error handling and response format.
 */

import { ExecutionType, ExecutionErrorCode } from '../types';
import { executeDiscount, rollbackDiscount } from './discount';
import { executePauseProduct, rollbackPauseProduct } from './pause-product';
import { executeEmail, rollbackEmail } from './email';
import { executeKlaviyoFlowTrigger } from './klaviyo-flow';
import { logger } from '../../observability/logger';
import { db } from '../../db';

// ============================================================================
// TYPES
// ============================================================================

interface ExecuteActionInput {
  actionDraftId: string;
  workspaceId: string;
}

interface ExecuteActionResult {
  success: boolean;
  executionId?: string;
  providerResponse?: any;
  error?: {
    code: ExecutionErrorCode;
    message: string;
    retryable: boolean;
    details?: any;
  };
}

interface RollbackActionInput {
  executionId: string;
  workspaceId: string;
}

// ============================================================================
// MAIN EXECUTION FUNCTION
// ============================================================================

/**
 * Execute an action draft
 * Routes to appropriate executor based on execution type
 */
export async function executeAction(
  input: ExecuteActionInput
): Promise<ExecuteActionResult> {
  const { actionDraftId, workspaceId } = input;

  // TODO: Billing integration - uncomment when billing module is complete
  // import { checkLimit, incrementUsage } from '@/server/billing';
  // await checkLimit(workspaceId, 'actions');

  logger.info({
    actionDraftId,
    workspaceId,
  }, 'Starting action execution');

  try {
    // Fetch action draft
    const draft = await db.actionDraft.findFirst({
      where: {
        id: actionDraftId,
        workspace_id: workspaceId,
      },
      include: {
        opportunity: true,
      },
    });

    if (!draft) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_PAYLOAD,
          message: 'Action draft not found or access denied',
          retryable: false,
        },
      };
    }

    // Check if draft is in approved state
    if (draft.state !== 'approved') {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_PAYLOAD,
          message: `Action draft must be approved before execution. Current state: ${draft.state}`,
          retryable: false,
        },
      };
    }

    // Create execution record with idempotency key
    const idempotencyKey = `execution::${actionDraftId}::${Date.now()}`;

    const execution = await db.execution.create({
      data: {
        workspace_id: workspaceId,
        action_draft_id: actionDraftId,
        request_payload_json: draft.payload_json,
        status: 'pending',
        idempotency_key: idempotencyKey,
      },
    });

    logger.info({
      executionId: execution.id,
      actionDraftId,
      executionType: draft.execution_type,
    }, 'Execution record created');

    // Update draft state to executing
    await db.actionDraft.update({
      where: { id: actionDraftId },
      data: { state: 'executing' as any },
    });

    // Route to appropriate executor
    const result = await callExecutor({
      executionType: draft.execution_type as ExecutionType,
      workspaceId,
      payload: draft.payload_json,
    });

    // Update execution record with result
    await db.execution.update({
      where: { id: execution.id },
      data: {
        status: result.success ? 'succeeded' : 'failed',
        provider_response_json: result.providerResponse as any,
        error_code: result.error?.code,
        error_message: result.error?.message,
        finished_at: new Date(),
      },
    });

    // Update draft state
    await db.actionDraft.update({
      where: { id: actionDraftId },
      data: {
        state: (result.success ? 'executed' : 'failed') as any,
      },
    });

    logger.info({
      executionId: execution.id,
      success: result.success,
    }, 'Action execution completed');

    // TODO: Billing integration - uncomment when billing module is complete
    // Only increment usage on successful execution
    // if (result.success) {
    //   await incrementUsage(workspaceId, 'actions');
    // }

    return {
      success: result.success,
      executionId: execution.id,
      providerResponse: result.providerResponse,
      error: result.error,
    };
  } catch (error) {
    logger.error({
      actionDraftId,
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Unexpected error during action execution');

    return {
      success: false,
      error: {
        code: ExecutionErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
      },
    };
  }
}

// ============================================================================
// EXECUTOR ROUTING
// ============================================================================

/**
 * Call appropriate executor based on execution type
 */
async function callExecutor(params: {
  executionType: ExecutionType;
  workspaceId: string;
  payload: any;
}): Promise<{
  success: boolean;
  providerResponse?: any;
  error?: {
    code: ExecutionErrorCode;
    message: string;
    retryable: boolean;
    details?: any;
  };
}> {
  const { executionType, workspaceId, payload } = params;

  logger.info({
    executionType,
    workspaceId,
  }, 'Routing to executor');

  switch (executionType) {
    case ExecutionType.DISCOUNT_DRAFT:
      return await executeDiscount({ workspaceId, payload });

    case ExecutionType.WINBACK_EMAIL:
      return await executeEmail({ workspaceId, payload });

    case ExecutionType.PAUSE_PRODUCT:
      return await executePauseProduct({ workspaceId, payload });

    case ExecutionType.KLAVIYO_FLOW_TRIGGER:
      return await executeKlaviyoFlowTrigger({ workspaceId, payload });

    default:
      logger.error({
        executionType,
      }, 'Unsupported execution type');

      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_PAYLOAD,
          message: `Unsupported execution type: ${executionType}`,
          retryable: false,
        },
      };
  }
}

// ============================================================================
// ROLLBACK FUNCTION
// ============================================================================

/**
 * Rollback an executed action
 * Attempts to reverse the effects of an execution
 */
export async function rollbackAction(
  input: RollbackActionInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  const { executionId, workspaceId } = input;

  logger.info({
    executionId,
    workspaceId,
  }, 'Starting action rollback');

  try {
    // Fetch execution record
    const execution = await db.execution.findFirst({
      where: {
        id: executionId,
        workspace_id: workspaceId,
      },
      include: {
        action_draft: true,
      },
    });

    if (!execution) {
      return {
        success: false,
        error: 'Execution not found or access denied',
      };
    }

    // Check if execution succeeded
    if (execution.status !== 'succeeded') {
      return {
        success: false,
        error: `Cannot rollback execution with status: ${execution.status}`,
      };
    }

    // Route to appropriate rollback handler
    const executionType = execution.action_draft.execution_type as ExecutionType;

    logger.info({
      executionId,
      executionType,
    }, 'Routing to rollback handler');

    switch (executionType) {
      case ExecutionType.DISCOUNT_DRAFT:
        await rollbackDiscount({
          workspaceId,
          providerResponse: execution.provider_response_json,
        });
        break;

      case ExecutionType.PAUSE_PRODUCT:
        await rollbackPauseProduct({
          workspaceId,
          providerResponse: execution.provider_response_json,
        });
        break;

      case ExecutionType.WINBACK_EMAIL:
        await rollbackEmail({
          workspaceId,
          providerResponse: execution.provider_response_json,
        });
        break;

      default:
        return {
          success: false,
          error: `Rollback not supported for execution type: ${executionType}`,
        };
    }

    logger.info({
      executionId,
    }, 'Action rollback completed');

    return { success: true };
  } catch (error) {
    logger.error({
      executionId,
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Error during action rollback');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  executeDiscount,
  executePauseProduct,
  executeEmail,
  executeKlaviyoFlowTrigger,
  rollbackDiscount,
  rollbackPauseProduct,
  rollbackEmail,
};
