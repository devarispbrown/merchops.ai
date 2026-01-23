// Execution Detail API Route
// GET: Get execution detail with full request/response payloads

import { NextRequest, NextResponse } from "next/server";

import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { getServerSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { logger } from "@/server/observability/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const { id: executionId } = await params;

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn(
          { correlationId, executionId },
          "Unauthorized execution detail request"
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      logger.info(
        { correlationId, workspaceId, executionId },
        "Fetching execution detail"
      );

      // Fetch execution with full details
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: {
          action_draft: {
            include: {
              opportunity: {
                select: {
                  id: true,
                  type: true,
                  priority_bucket: true,
                  why_now: true,
                  rationale: true,
                  counterfactual: true,
                },
              },
            },
          },
          outcome: {
            select: {
              id: true,
              outcome: true,
              computed_at: true,
              evidence_json: true,
            },
          },
        },
      });

      if (!execution) {
        logger.warn(
          { correlationId, workspaceId, executionId },
          "Execution not found"
        );
        return NextResponse.json(
          { error: "Execution not found" },
          { status: 404 }
        );
      }

      // Verify workspace access
      if (execution.workspace_id !== workspaceId) {
        logger.warn(
          {
            correlationId,
            workspaceId,
            executionId,
            executionWorkspaceId: execution.workspace_id,
          },
          "Access denied: Execution belongs to different workspace"
        );
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const durationMs = Date.now() - startTime;

      logger.info(
        { correlationId, workspaceId, executionId, durationMs },
        "Execution detail fetched successfully"
      );

      return NextResponse.json(execution, {
        status: 200,
        headers: {
          "X-Correlation-ID": correlationId,
        },
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error(
        {
          correlationId,
          executionId,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          durationMs,
        },
        "Error fetching execution detail"
      );

      return NextResponse.json(
        { error: "An error occurred while fetching execution" },
        {
          status: 500,
          headers: {
            "X-Correlation-ID": correlationId,
          },
        }
      );
    }
  });
}
