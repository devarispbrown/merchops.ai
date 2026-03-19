/**
 * MerchOps Execution Engine
 * Orchestrates action execution with idempotency, retries, and error handling
 */

import { db } from "../db";
import { ExecutionStatus, ExecutionType, isRetryableError } from "./types";
import { executeDiscount } from "./execute/discount";
import { executePauseProduct } from "./execute/pause-product";
import { executeEmail } from "./execute/email";
import { executeKlaviyoSegment } from "./execute/klaviyo-segment";
import { executeKlaviyoCampaignDraft } from "./execute/klaviyo-campaign";
import { executeKlaviyoFlowTrigger } from "./execute/klaviyo-flow";
import { executeShopifyEmailDraft } from "./execute/shopify-email";

// ============================================================================
// TYPES
// ============================================================================

interface ExecuteActionInput {
  executionId: string;
  workspaceId: string;
}

interface ExecuteActionResult {
  success: boolean;
  executionId: string;
  status: ExecutionStatus;
  error?: any;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 2000, // 2 seconds
  maxDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2, // Exponential backoff
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function executeAction(input: ExecuteActionInput): Promise<ExecuteActionResult> {
  const { executionId, workspaceId } = input;

  console.log("[EXECUTION-ENGINE] Starting execution:", executionId);

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
      throw new Error("Execution not found or access denied");
    }

    // Idempotency check
    if (execution.status === ExecutionStatus.SUCCEEDED) {
      console.log("[EXECUTION-ENGINE] Execution already succeeded (idempotent):", executionId);
      return {
        success: true,
        executionId,
        status: ExecutionStatus.SUCCEEDED,
      };
    }

    if (execution.status === ExecutionStatus.RUNNING) {
      console.log("[EXECUTION-ENGINE] Execution already running:", executionId);
      return {
        success: false,
        executionId,
        status: ExecutionStatus.RUNNING,
        error: "Execution is already in progress",
      };
    }

    // Update status to running
    await db.execution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.RUNNING,
        started_at: new Date(),
      },
    });

    // Execute with retry logic
    const result = await executeWithRetry({
      execution,
      workspaceId,
    });

    // Update execution record with result
    await db.execution.update({
      where: { id: executionId },
      data: {
        status: result.success ? ExecutionStatus.SUCCEEDED : ExecutionStatus.FAILED,
        provider_response_json: result.providerResponse as any,
        error_code: result.error?.code,
        error_message: result.error?.message,
        finished_at: new Date(),
      },
    });

    // Update draft state
    await db.actionDraft.update({
      where: { id: execution.action_draft_id },
      data: {
        state: result.success ? "executed" : "draft", // Return to draft if failed
      },
    });

    // Update opportunity state if successful
    if (result.success) {
      await db.opportunity.update({
        where: { id: execution.action_draft.opportunity_id },
        data: {
          state: "executed",
          updated_at: new Date(),
        },
      });
    }

    console.log("[EXECUTION-ENGINE] Execution completed:", {
      executionId,
      success: result.success,
      status: result.success ? ExecutionStatus.SUCCEEDED : ExecutionStatus.FAILED,
    });

    return {
      success: result.success,
      executionId,
      status: result.success ? ExecutionStatus.SUCCEEDED : ExecutionStatus.FAILED,
      error: result.error,
    };
  } catch (error: any) {
    console.error("[EXECUTION-ENGINE] Execution failed with exception:", error);

    // Update execution to failed
    await db.execution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.FAILED,
        error_code: "UNKNOWN_ERROR",
        error_message: error.message,
        finished_at: new Date(),
      },
    });

    return {
      success: false,
      executionId,
      status: ExecutionStatus.FAILED,
      error: error.message,
    };
  }
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

async function executeWithRetry(params: {
  execution: any;
  workspaceId: string;
}): Promise<any> {
  const { execution, workspaceId } = params;
  const executionType = execution.action_draft.execution_type as ExecutionType;
  const payload = execution.request_payload_json;

  let lastError: any = null;
  let attempt = 0;

  while (attempt < RETRY_CONFIG.maxAttempts) {
    attempt++;

    console.log(
      `[EXECUTION-ENGINE] Attempt ${attempt}/${RETRY_CONFIG.maxAttempts} for execution:`,
      execution.id
    );

    try {
      // Call appropriate executor
      const result = await callExecutor({
        executionType,
        workspaceId,
        payload,
      });

      if (result.success) {
        console.log("[EXECUTION-ENGINE] Execution succeeded on attempt:", attempt);
        return result;
      }

      lastError = result.error;

      // Check if error is retryable
      if (!lastError || !isRetryableError(lastError.code)) {
        console.log("[EXECUTION-ENGINE] Non-retryable error, stopping attempts");
        return result;
      }

      // Calculate backoff delay
      if (attempt < RETRY_CONFIG.maxAttempts) {
        const delay = calculateBackoffDelay(attempt);
        console.log(`[EXECUTION-ENGINE] Retrying in ${delay}ms...`);

        // Update status to retrying
        await db.execution.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.RETRYING,
          },
        });

        await sleep(delay);
      }
    } catch (error: any) {
      console.error("[EXECUTION-ENGINE] Executor threw exception:", error);
      lastError = error;

      // Don't retry on exceptions
      break;
    }
  }

  // All attempts exhausted
  console.error("[EXECUTION-ENGINE] All retry attempts exhausted");
  return {
    success: false,
    providerResponse: null,
    error: lastError,
  };
}

// ============================================================================
// EXECUTOR ROUTING
// ============================================================================

async function callExecutor(params: {
  executionType: ExecutionType;
  workspaceId: string;
  payload: any;
}): Promise<any> {
  const { executionType, workspaceId, payload } = params;

  switch (executionType) {
    case ExecutionType.DISCOUNT_DRAFT:
      return await executeDiscount({ workspaceId, payload });

    case ExecutionType.WINBACK_EMAIL:
      return await executeEmail({ workspaceId, payload });

    case ExecutionType.PAUSE_PRODUCT:
      return await executePauseProduct({ workspaceId, payload });

    case ExecutionType.KLAVIYO_SEGMENT_SYNC:
      return await executeKlaviyoSegment({ workspaceId, payload });

    case ExecutionType.KLAVIYO_CAMPAIGN_DRAFT:
      return await executeKlaviyoCampaignDraft({ workspaceId, payload });

    case ExecutionType.KLAVIYO_FLOW_TRIGGER:
      return await executeKlaviyoFlowTrigger({ workspaceId, payload });

    case ExecutionType.SHOPIFY_EMAIL_DRAFT:
      return await executeShopifyEmailDraft({ workspaceId, payload });

    default:
      throw new Error(`Unsupported execution type: ${executionType}`);
  }
}

// ============================================================================
// BACKOFF CALCULATION
// ============================================================================

function calculateBackoffDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// EXECUTION MONITORING
// ============================================================================

export async function getExecutionStatus(params: {
  executionId: string;
  workspaceId: string;
}): Promise<any> {
  const { executionId, workspaceId } = params;

  const execution = await db.execution.findFirst({
    where: {
      id: executionId,
      workspace_id: workspaceId,
    },
    include: {
      action_draft: {
        include: {
          opportunity: {
            select: {
              id: true,
              type: true,
              why_now: true,
            },
          },
        },
      },
    },
  });

  if (!execution) {
    throw new Error("Execution not found or access denied");
  }

  return {
    id: execution.id,
    status: execution.status,
    executionType: execution.action_draft.execution_type,
    operatorIntent: execution.action_draft.operator_intent,
    startedAt: execution.started_at,
    finishedAt: execution.finished_at,
    errorCode: execution.error_code,
    errorMessage: execution.error_message,
    providerResponse: execution.provider_response_json,
    opportunity: execution.action_draft.opportunity,
  };
}

export async function listExecutions(params: {
  workspaceId: string;
  status?: ExecutionStatus;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const { workspaceId, status, limit = 50, offset = 0 } = params;

  const where: any = { workspace_id: workspaceId };
  if (status) {
    where.status = status;
  }

  const executions = await db.execution.findMany({
    where,
    include: {
      action_draft: {
        select: {
          execution_type: true,
          operator_intent: true,
          opportunity: {
            select: {
              type: true,
              priority_bucket: true,
            },
          },
        },
      },
    },
    orderBy: {
      started_at: "desc",
    },
    take: limit,
    skip: offset,
  });

  const total = await db.execution.count({ where });

  return {
    executions: executions.map((e) => ({
      id: e.id,
      status: e.status,
      executionType: e.action_draft.execution_type,
      operatorIntent: e.action_draft.operator_intent,
      opportunityType: e.action_draft.opportunity.type,
      startedAt: e.started_at,
      finishedAt: e.finished_at,
      errorCode: e.error_code,
    })),
    total,
    limit,
    offset,
  };
}
