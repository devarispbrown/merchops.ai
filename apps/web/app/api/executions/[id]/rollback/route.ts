/**
 * MerchOps Execution Rollback API Route
 * POST /api/executions/[id]/rollback - Rollback execution
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { rollbackExecution } from "@/server/actions/rollback";

// ============================================================================
// POST /api/executions/[id]/rollback - Rollback execution
// ============================================================================

const RollbackSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: executionId } = await params;
    const workspaceId = request.headers.get("x-workspace-id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID required" },
        { status: 401 }
      );
    }

    // Parse optional body
    let reason: string | undefined;
    try {
      const body = await request.json();
      const validated = RollbackSchema.parse(body);
      reason = validated.reason;
    } catch {
      // No body is fine
    }

    // Attempt rollback
    const result = await rollbackExecution({
      workspaceId,
      executionId,
      reason,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          rollbackSupported: result.rollbackSupported,
          message: result.message,
        },
        { status: result.rollbackSupported ? 500 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      rollbackSupported: true,
      message: result.message,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Use structured logger in production
    // console.error(`[API] POST /api/executions/${params.id}/rollback error:`, error);

    if (errorMessage.includes("not found")) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: errorMessage || "Failed to rollback execution" },
      { status: 500 }
    );
  }
}
