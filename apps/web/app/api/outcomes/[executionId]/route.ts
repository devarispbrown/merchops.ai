// Outcome Detail API Route
// GET: Get outcome for specific execution

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
  { params }: { params: { executionId: string } }
) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();
    const executionId = params.executionId;

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn(
          { correlationId, executionId },
          "Unauthorized outcome detail request"
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      logger.info(
        { correlationId, workspaceId, executionId },
        "Fetching outcome for execution"
      );

      // Fetch outcome with execution details
      const outcome = await prisma.outcome.findUnique({
        where: { execution_id: executionId },
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
                      why_now: true,
                      rationale: true,
                      counterfactual: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!outcome) {
        logger.warn(
          { correlationId, workspaceId, executionId },
          "Outcome not found for execution"
        );
        return NextResponse.json(
          { error: "Outcome not found for this execution" },
          { status: 404 }
        );
      }

      // Verify workspace access
      if (outcome.execution.workspace_id !== workspaceId) {
        logger.warn(
          {
            correlationId,
            workspaceId,
            executionId,
            executionWorkspaceId: outcome.execution.workspace_id,
          },
          "Access denied: Outcome belongs to different workspace"
        );
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const durationMs = Date.now() - startTime;

      logger.info(
        { correlationId, workspaceId, executionId, durationMs },
        "Outcome fetched successfully"
      );

      return NextResponse.json(outcome, {
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
        "Error fetching outcome"
      );

      return NextResponse.json(
        { error: "An error occurred while fetching outcome" },
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
