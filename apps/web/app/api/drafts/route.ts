// Action Drafts API Route
// GET: List drafts for workspace
// POST: Create draft for opportunity

import { ActionDraftState } from '@prisma/client';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";


import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { createDraftForOpportunity } from "@/server/actions/drafts/create";
import { OperatorIntent, ExecutionType } from "@/server/actions/types";
import { getServerSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { logger } from "@/server/observability/logger";

// Query parameters schema
const draftsQuerySchema = z.object({
  opportunity_id: z.string().uuid().optional(),
  state: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Create draft schema
const createDraftSchema = z.object({
  opportunityId: z.string().uuid(),
  operatorIntent: z.nativeEnum(OperatorIntent),
  executionType: z.nativeEnum(ExecutionType),
  context: z.record(z.unknown()).optional(),
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
        logger.warn({ correlationId }, "Unauthorized drafts list request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      // Parse and validate query parameters
      const { searchParams } = new URL(request.url);
      const queryParams = {
        opportunity_id: searchParams.get("opportunity_id") ?? undefined,
        state: searchParams.get("state") ?? undefined,
        page: searchParams.get("page") ?? "1",
        limit: searchParams.get("limit") ?? "20",
      };

      const validated = draftsQuerySchema.parse(queryParams);
      const offset = (validated.page - 1) * validated.limit;

      logger.info(
        {
          correlationId,
          workspaceId,
          filters: {
            opportunity_id: validated.opportunity_id,
            state: validated.state,
          },
          pagination: { page: validated.page, limit: validated.limit },
        },
        "Fetching drafts list"
      );

      // Build where clause
      const where: {
        workspace_id: string;
        opportunity_id?: string;
        state?: ActionDraftState;
      } = {
        workspace_id: workspaceId,
      };

      if (validated.opportunity_id) {
        where.opportunity_id = validated.opportunity_id;
      }

      if (validated.state) {
        where.state = validated.state as ActionDraftState;
      }

      // Query drafts
      const [drafts, totalCount] = await Promise.all([
        prisma.actionDraft.findMany({
          where,
          include: {
            opportunity: {
              select: {
                id: true,
                type: true,
                priority_bucket: true,
                state: true,
              },
            },
            executions: {
              select: {
                id: true,
                status: true,
                started_at: true,
                finished_at: true,
              },
              orderBy: {
                started_at: "desc",
              },
              take: 1,
            },
          },
          orderBy: {
            created_at: "desc",
          },
          take: validated.limit,
          skip: offset,
        }),
        prisma.actionDraft.count({ where }),
      ]);

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          count: drafts.length,
          totalCount,
          durationMs,
        },
        "Drafts list fetched successfully"
      );

      return NextResponse.json(
        {
          drafts,
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
        "Error fetching drafts list"
      );

      return NextResponse.json(
        { error: "An error occurred while fetching drafts" },
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

export async function POST(request: NextRequest) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn({ correlationId }, "Unauthorized draft creation request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      // Parse and validate request body
      const body = await request.json();
      const validated = createDraftSchema.parse(body);

      logger.info(
        {
          correlationId,
          workspaceId,
          opportunityId: validated.opportunityId,
          operatorIntent: validated.operatorIntent,
          executionType: validated.executionType,
        },
        "Creating action draft"
      );

      // Create draft using server action
      const result = await createDraftForOpportunity({
        workspaceId,
        opportunityId: validated.opportunityId,
        operatorIntent: validated.operatorIntent as OperatorIntent,
        executionType: validated.executionType as ExecutionType,
        context: validated.context,
      });

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          draftId: result.draftId,
          opportunityId: validated.opportunityId,
          durationMs,
        },
        "Action draft created successfully"
      );

      return NextResponse.json(
        {
          success: true,
          draft: {
            id: result.draftId,
            payload: result.payload,
            editableFields: result.editableFields,
          },
        },
        {
          status: 201,
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
          "Invalid draft data"
        );
        return NextResponse.json(
          {
            error: "Invalid draft data",
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
        "Error creating draft"
      );

      return NextResponse.json(
        { error: "An error occurred while creating draft" },
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
