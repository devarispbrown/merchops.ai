// Outcomes API Route
// GET: List outcomes for workspace

import { OutcomeType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { getServerSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { logger } from "@/server/observability/logger";

// Query parameters schema
const outcomesQuerySchema = z.object({
  outcome: z.nativeEnum(OutcomeType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn({ correlationId }, "Unauthorized outcomes list request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      // Parse and validate query parameters
      const { searchParams } = new URL(request.url);
      const queryParams = {
        outcome: searchParams.get("outcome") ?? undefined,
        page: searchParams.get("page") ?? "1",
        limit: searchParams.get("limit") ?? "20",
      };

      const validated = outcomesQuerySchema.parse(queryParams);
      const offset = (validated.page - 1) * validated.limit;

      logger.info(
        {
          correlationId,
          workspaceId,
          filters: {
            outcome: validated.outcome,
          },
          pagination: { page: validated.page, limit: validated.limit },
        },
        "Fetching outcomes list"
      );

      // Build where clause for executions
      const executionWhere: {
        workspace_id: string;
      } = {
        workspace_id: workspaceId,
      };

      // Build where clause for outcomes
      const outcomeWhere: {
        outcome?: OutcomeType;
      } = {};
      if (validated.outcome) {
        outcomeWhere.outcome = validated.outcome;
      }

      // Query outcomes with execution details
      const [outcomes, totalCount] = await Promise.all([
        prisma.outcome.findMany({
          where: {
            ...outcomeWhere,
            execution: executionWhere,
          },
          include: {
            execution: {
              include: {
                action_draft: {
                  select: {
                    id: true,
                    execution_type: true,
                    operator_intent: true,
                    opportunity: {
                      select: {
                        id: true,
                        type: true,
                        priority_bucket: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            computed_at: "desc",
          },
          take: validated.limit,
          skip: offset,
        }),
        prisma.outcome.count({
          where: {
            ...outcomeWhere,
            execution: executionWhere,
          },
        }),
      ]);

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          count: outcomes.length,
          totalCount,
          durationMs,
        },
        "Outcomes list fetched successfully"
      );

      return NextResponse.json(
        {
          outcomes,
          pagination: {
            page: validated.page,
            limit: validated.limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / validated.limit),
          },
        },
        {
          status: 200,
          headers: {
            "X-Correlation-ID": correlationId,
          },
        }
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Validation errors
      if (error instanceof z.ZodError) {
        logger.warn(
          { correlationId, errors: error.errors, durationMs },
          "Invalid query parameters"
        );
        return NextResponse.json(
          {
            error: "Invalid query parameters",
            details: error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          {
            status: 400,
            headers: {
              "X-Correlation-ID": correlationId,
            },
          }
        );
      }

      // Generic error
      logger.error(
        {
          correlationId,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          durationMs,
        },
        "Error fetching outcomes list"
      );

      return NextResponse.json(
        { error: "An error occurred while fetching outcomes" },
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
