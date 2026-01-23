// Confidence API Route
// GET: Get confidence scores per operator intent

import { OperatorIntent, OutcomeType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { getServerSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { logger } from "@/server/observability/logger";

export async function GET(request: NextRequest) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn({ correlationId }, "Unauthorized confidence request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      logger.info(
        { correlationId, workspaceId },
        "Fetching confidence scores"
      );

      // Query all outcomes for this workspace grouped by operator intent
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
        orderBy: {
          computed_at: "desc",
        },
      });

      // Calculate confidence scores per operator intent
      const confidenceByIntent: Record<
        OperatorIntent,
        {
          intent: OperatorIntent;
          confidence: number;
          total_executions: number;
          helped: number;
          neutral: number;
          hurt: number;
          sample_size: number;
        }
      > = {
        [OperatorIntent.reduce_inventory_risk]: {
          intent: OperatorIntent.reduce_inventory_risk,
          confidence: 0.5,
          total_executions: 0,
          helped: 0,
          neutral: 0,
          hurt: 0,
          sample_size: 0,
        },
        [OperatorIntent.reengage_dormant_customers]: {
          intent: OperatorIntent.reengage_dormant_customers,
          confidence: 0.5,
          total_executions: 0,
          helped: 0,
          neutral: 0,
          hurt: 0,
          sample_size: 0,
        },
        [OperatorIntent.protect_margin]: {
          intent: OperatorIntent.protect_margin,
          confidence: 0.5,
          total_executions: 0,
          helped: 0,
          neutral: 0,
          hurt: 0,
          sample_size: 0,
        },
      };

      // Aggregate outcomes by intent
      outcomes.forEach((outcome) => {
        const intent = outcome.execution.action_draft.operator_intent;
        const stats = confidenceByIntent[intent];

        stats.total_executions++;
        stats.sample_size++;

        switch (outcome.outcome) {
          case OutcomeType.helped:
            stats.helped++;
            break;
          case OutcomeType.neutral:
            stats.neutral++;
            break;
          case OutcomeType.hurt:
            stats.hurt++;
            break;
        }

        // Calculate confidence: (helped + 0.5 * neutral) / total
        // This gives partial credit for neutral outcomes
        if (stats.total_executions > 0) {
          stats.confidence =
            (stats.helped + 0.5 * stats.neutral) / stats.total_executions;
        }
      });

      // Get total executions count per intent (including those without outcomes yet)
      const executionCounts = await prisma.execution.groupBy({
        by: ["action_draft_id"],
        where: {
          workspace_id: workspaceId,
        },
        _count: {
          id: true,
        },
      });

      // Get action draft intents for execution counts
      const actionDrafts = await prisma.actionDraft.findMany({
        where: {
          workspace_id: workspaceId,
          id: {
            in: executionCounts.map((ec) => ec.action_draft_id),
          },
        },
        select: {
          id: true,
          operator_intent: true,
        },
      });

      // Update total execution counts
      actionDrafts.forEach((draft) => {
        const count = executionCounts.find(
          (ec) => ec.action_draft_id === draft.id
        )?._count.id || 0;
        const stats = confidenceByIntent[draft.operator_intent];
        if (stats) {
          stats.total_executions = Math.max(
            stats.total_executions,
            count
          );
        }
      });

      const durationMs = Date.now() - startTime;

      logger.info(
        { correlationId, workspaceId, durationMs },
        "Confidence scores fetched successfully"
      );

      return NextResponse.json(
        {
          confidence_scores: Object.values(confidenceByIntent),
          computed_at: new Date().toISOString(),
        },
        {
          status: 200,
          headers: {
            "X-Correlation-ID": correlationId,
            "Cache-Control": "private, max-age=120",
          },
        }
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error(
        {
          correlationId,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          durationMs,
        },
        "Error fetching confidence scores"
      );

      return NextResponse.json(
        { error: "An error occurred while fetching confidence scores" },
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
