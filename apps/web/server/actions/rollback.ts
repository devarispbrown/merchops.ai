/**
 * MerchOps Rollback System
 * Attempts to undo executed actions where possible
 */

import { db } from "../db";
import { ExecutionType, ExecutionStatus } from "./types";
import { rollbackDiscount } from "./execute/discount";
import { rollbackPauseProduct } from "./execute/pause-product";
import { rollbackEmail } from "./execute/email";

// ============================================================================
// TYPES
// ============================================================================

interface RollbackExecutionInput {
  executionId: string;
  workspaceId: string;
  reason?: string;
}

interface RollbackExecutionResult {
  success: boolean;
  executionId: string;
  rollbackSupported: boolean;
  message: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function rollbackExecution(
  input: RollbackExecutionInput
): Promise<RollbackExecutionResult> {
  const { executionId, workspaceId, reason } = input;

  console.log("[ROLLBACK] Starting rollback:", { executionId, reason });

  try {
    // Fetch execution
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

    // Validate execution can be rolled back
    if (execution.status !== ExecutionStatus.SUCCEEDED) {
      return {
        success: false,
        executionId,
        rollbackSupported: false,
        message: `Cannot rollback execution with status: ${execution.status}`,
      };
    }

    const executionType = execution.action_draft.execution_type as ExecutionType;
    const providerResponse = execution.provider_response_json;

    // Check if rollback is supported for this execution type
    const rollbackSupport = getRollbackSupport(executionType);

    if (!rollbackSupport.supported) {
      console.warn("[ROLLBACK] Rollback not supported:", rollbackSupport.reason);
      return {
        success: false,
        executionId,
        rollbackSupported: false,
        message: rollbackSupport.reason,
      };
    }

    // Attempt rollback
    await performRollback({
      executionType,
      workspaceId,
      providerResponse,
    });

    // Log rollback in execution history
    await logRollback({
      executionId,
      reason: reason || "Manual rollback",
    });

    // Update opportunity state back to viewed
    await db.opportunity.update({
      where: { id: execution.action_draft.opportunity_id },
      data: {
        state: "viewed",
        updated_at: new Date(),
      },
    });

    console.log("[ROLLBACK] Rollback completed successfully:", executionId);

    return {
      success: true,
      executionId,
      rollbackSupported: true,
      message: "Rollback completed successfully",
    };
  } catch (error: any) {
    console.error("[ROLLBACK] Rollback failed:", error);

    return {
      success: false,
      executionId,
      rollbackSupported: true,
      message: `Rollback failed: ${error.message}`,
    };
  }
}

// ============================================================================
// ROLLBACK SUPPORT CHECK
// ============================================================================

interface RollbackSupport {
  supported: boolean;
  reason: string;
}

function getRollbackSupport(executionType: ExecutionType): RollbackSupport {
  switch (executionType) {
    case ExecutionType.DISCOUNT_DRAFT:
      return {
        supported: true,
        reason: "Discount can be disabled or deleted",
      };

    case ExecutionType.PAUSE_PRODUCT:
      return {
        supported: true,
        reason: "Product status can be restored",
      };

    case ExecutionType.WINBACK_EMAIL:
      return {
        supported: false,
        reason: "Email has already been sent and cannot be recalled",
      };

    default:
      return {
        supported: false,
        reason: "Unknown execution type",
      };
  }
}

// ============================================================================
// ROLLBACK EXECUTION
// ============================================================================

async function performRollback(params: {
  executionType: ExecutionType;
  workspaceId: string;
  providerResponse: any;
}): Promise<void> {
  const { executionType, workspaceId, providerResponse } = params;

  switch (executionType) {
    case ExecutionType.DISCOUNT_DRAFT:
      await rollbackDiscount({ workspaceId, providerResponse });
      break;

    case ExecutionType.PAUSE_PRODUCT:
      await rollbackPauseProduct({ workspaceId, providerResponse });
      break;

    case ExecutionType.WINBACK_EMAIL:
      // Will throw error as it's not supported
      await rollbackEmail({ workspaceId, providerResponse });
      break;

    default:
      throw new Error(`Rollback not implemented for type: ${executionType}`);
  }
}

// ============================================================================
// ROLLBACK LOGGING
// ============================================================================

async function logRollback(params: { executionId: string; reason: string }): Promise<void> {
  const { executionId, reason } = params;

  // Add rollback information to execution record
  const existing = await db.execution.findUnique({ where: { id: executionId } });
  const existingResponse = (typeof existing?.provider_response_json === 'object' && existing?.provider_response_json !== null)
    ? existing.provider_response_json as Record<string, unknown>
    : {};

  await db.execution.update({
    where: { id: executionId },
    data: {
      provider_response_json: {
        ...existingResponse,
        rollback: {
          rolledBackAt: new Date().toISOString(),
          reason,
        },
      },
    },
  });

  console.log("[ROLLBACK] Logged rollback:", { executionId, reason });
}

// ============================================================================
// ROLLBACK HISTORY
// ============================================================================

export async function getRollbackHistory(params: {
  workspaceId: string;
  executionId?: string;
}): Promise<any[]> {
  const { workspaceId, executionId } = params;

  const where: any = { workspace_id: workspaceId };
  if (executionId) {
    where.id = executionId;
  }

  const executions = await db.execution.findMany({
    where,
    orderBy: {
      started_at: "desc",
    },
  });

  // Filter to only those with rollback information
  return executions
    .filter((e) => {
      const response = e.provider_response_json as any;
      return response?.rollback !== undefined;
    })
    .map((e) => ({
      executionId: e.id,
      status: e.status,
      rollback: (e.provider_response_json as any).rollback,
      startedAt: e.started_at,
      finishedAt: e.finished_at,
    }));
}

// ============================================================================
// BULK ROLLBACK
// ============================================================================

export async function rollbackMultipleExecutions(params: {
  workspaceId: string;
  executionIds: string[];
  reason?: string;
}): Promise<any> {
  const { workspaceId, executionIds, reason } = params;

  const results = [];

  for (const executionId of executionIds) {
    try {
      const result = await rollbackExecution({
        workspaceId,
        executionId,
        reason,
      });
      results.push(result);
    } catch (error: any) {
      results.push({
        success: false,
        executionId,
        rollbackSupported: false,
        message: error.message,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return {
    total: results.length,
    succeeded: successCount,
    failed: failureCount,
    results,
  };
}
