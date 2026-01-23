/**
 * MerchOps Draft Approval
 * Transitions draft to approved state and enqueues execution
 */

import { prisma } from "../../db/client";
import { ActionDraftState, ExecutionStatus, getPayloadSchema } from "../types";
import { randomBytes } from "crypto";

// ============================================================================
// TYPES
// ============================================================================

interface ApproveDraftInput {
  workspaceId: string;
  draftId: string;
  approvedBy?: string; // User ID for audit trail
}

interface ApproveDraftResult {
  success: boolean;
  executionId: string;
  idempotencyKey: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function approveDraft(input: ApproveDraftInput): Promise<ApproveDraftResult> {
  const { workspaceId, draftId, approvedBy } = input;

  // Fetch draft with validation
  const draft = await prisma.actionDraft.findFirst({
    where: {
      id: draftId,
      workspace_id: workspaceId,
    },
    include: {
      opportunity: true,
    },
  });

  if (!draft) {
    throw new Error("Draft not found or access denied");
  }

  // Validate draft state
  if (![ActionDraftState.DRAFT, ActionDraftState.EDITED].includes(draft.state as ActionDraftState)) {
    throw new Error(`Draft cannot be approved from state: ${draft.state}`);
  }

  // Validate payload one final time
  try {
    const schema = getPayloadSchema(draft.execution_type as any);
    schema.parse(draft.payload_json);
  } catch (error: any) {
    throw new Error(`Payload validation failed: ${error.message}`);
  }

  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(draftId);

  // Check for existing execution with this idempotency key
  const existingExecution = await prisma.execution.findUnique({
    where: { idempotency_key: idempotencyKey },
  });

  if (existingExecution) {
    // Already approved and execution created
    return {
      success: true,
      executionId: existingExecution.id,
      idempotencyKey,
    };
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Update draft state
    await tx.actionDraft.update({
      where: { id: draftId },
      data: {
        state: ActionDraftState.APPROVED,
        updated_at: new Date(),
      },
    });

    // Create execution record
    const execution = await tx.execution.create({
      data: {
        workspace_id: workspaceId,
        action_draft_id: draftId,
        request_payload_json: draft.payload_json,
        status: ExecutionStatus.PENDING,
        idempotency_key: idempotencyKey,
        started_at: new Date(),
      },
    });

    // Update opportunity state to approved
    await tx.opportunity.update({
      where: { id: draft.opportunity_id },
      data: {
        state: "approved",
        updated_at: new Date(),
      },
    });

    return execution;
  });

  // Enqueue execution job
  await enqueueExecutionJob({
    executionId: result.id,
    workspaceId,
    executionType: draft.execution_type,
    payload: draft.payload_json as any,
  });

  return {
    success: true,
    executionId: result.id,
    idempotencyKey,
  };
}

// ============================================================================
// IDEMPOTENCY KEY GENERATION
// ============================================================================

function generateIdempotencyKey(draftId: string): string {
  // Format: draft_{draftId}_{timestamp}_{random}
  // This ensures uniqueness per approval attempt
  const timestamp = Date.now();
  const random = randomBytes(8).toString("hex");
  return `draft_${draftId}_${timestamp}_${random}`;
}

// ============================================================================
// JOB QUEUE INTEGRATION
// ============================================================================

async function enqueueExecutionJob(params: {
  executionId: string;
  workspaceId: string;
  executionType: string;
  payload: any;
}): Promise<void> {
  // TODO: Integrate with BullMQ
  // For now, we'll execute synchronously in the background
  // This should be replaced with proper job queue

  console.log("[APPROVE] Enqueuing execution job:", {
    executionId: params.executionId,
    executionType: params.executionType,
  });

  // In production, this would be:
  // await executionQueue.add('execute-action', params, {
  //   jobId: params.executionId,
  //   attempts: 3,
  //   backoff: {
  //     type: 'exponential',
  //     delay: 2000,
  //   },
  // });

  // For MVP, trigger execution asynchronously
  setImmediate(async () => {
    try {
      const { executeAction } = await import("../execution-engine");
      await executeAction({
        executionId: params.executionId,
        workspaceId: params.workspaceId,
      });
    } catch (error) {
      console.error("[APPROVE] Background execution failed:", error);
    }
  });
}

// ============================================================================
// REJECTION
// ============================================================================

export async function rejectDraft(params: {
  workspaceId: string;
  draftId: string;
  reason?: string;
}): Promise<void> {
  const { workspaceId, draftId, reason } = params;

  const draft = await prisma.actionDraft.findFirst({
    where: {
      id: draftId,
      workspace_id: workspaceId,
    },
  });

  if (!draft) {
    throw new Error("Draft not found or access denied");
  }

  await prisma.actionDraft.update({
    where: { id: draftId },
    data: {
      state: ActionDraftState.REJECTED,
      updated_at: new Date(),
    },
  });

  // Optionally update opportunity state
  await prisma.opportunity.update({
    where: { id: draft.opportunity_id },
    data: {
      state: "dismissed",
      updated_at: new Date(),
    },
  });
}

// ============================================================================
// EXPORTED WRAPPER FOR SERVER ACTIONS
// ============================================================================

/**
 * Approve action draft - wrapper for server actions compatibility
 * Maps from server action interface to internal implementation
 */
export async function approveActionDraft(params: {
  draftId: string;
}): Promise<{
  draft: any;
  execution: any;
  job: { id: string };
}> {
  // Fetch draft to get workspace ID
  const draft = await prisma.actionDraft.findUnique({
    where: { id: params.draftId },
  });

  if (!draft) {
    throw new Error("Draft not found");
  }

  const result = await approveDraft({
    workspaceId: draft.workspace_id,
    draftId: params.draftId,
  });

  // Fetch updated draft
  const updatedDraft = await prisma.actionDraft.findUnique({
    where: { id: params.draftId },
  });

  // Fetch execution
  const execution = await prisma.execution.findUnique({
    where: { id: result.executionId },
  });

  return {
    draft: updatedDraft,
    execution,
    job: { id: result.executionId }, // Use executionId as jobId for simplicity
  };
}
