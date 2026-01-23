// Executions API Route
// GET: List executions for workspace with pagination and filtering

import { ExecutionStatus, ExecutionType } from "@prisma/client";
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
const executionsQuerySchema = z.object({
  status: z.nativeEnum(ExecutionStatus).optional(),
  type: z.nativeEnum(ExecutionType).optional(),
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
        logger.warn({ correlationId }, "Unauthorized executions list request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      // Parse and validate query parameters
      const { searchParams } = new URL(request.url);
      const queryParams = {
        status: searchParams.get("status") ?? undefined,
        type: searchParams.get("type") ?? undefined,
        page: searchParams.get("page") ?? "1",
        limit: searchParams.get("limit") ?? "20",
      };

      const validated = executionsQuerySchema.parse(queryParams);
      const offset = (validated.page - 1) * validated.limit;

      logger.info(
        {
          correlationId,
          workspaceId,
          filters: {
            status: validated.status,
            type: validated.type,
          },
          pagination: { page: validated.page, limit: validated.limit },
        },
        "Fetching executions list"
      );

      // Build where clause
      const where: {
        workspace_id: string;
        status?: ExecutionStatus;
      } = {
        workspace_id: workspaceId,
      };

      if (validated.status) {
        where.status = validated.status;
      }

      // Filter by execution type if provided
      const actionDraftWhere: {
        execution_type?: ExecutionType;
      } = {};
      if (validated.type) {
        actionDraftWhere.execution_type = validated.type;
      }

      // Query executions
      const [executions, totalCount] = await Promise.all([
        prisma.execution.findMany({
          where: {
            ...where,
            ...(validated.type && {
              action_draft: actionDraftWhere,
            }),
          },
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
            outcome: {
              select: {
                id: true,
                outcome: true,
                computed_at: true,
              },
            },
          },
          orderBy: {
            started_at: "desc",
          },
          take: validated.limit,
          skip: offset,
        }),
        prisma.execution.count({
          where: {
            ...where,
            ...(validated.type && {
              action_draft: actionDraftWhere,
            }),
          },
        }),
      ]);

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          count: executions.length,
          totalCount,
          durationMs,
        },
        "Executions list fetched successfully"
      );

      return NextResponse.json(
        {
          executions,
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
        "Error fetching executions list"
      );

      return NextResponse.json(
        { error: "An error occurred while fetching executions" },
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
