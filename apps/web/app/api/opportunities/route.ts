// Opportunities API Route
// GET: List opportunities for workspace with pagination and filtering

import { OpportunityState, PriorityBucket } from "@prisma/client";
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
const opportunitiesQuerySchema = z.object({
  state: z
    .enum([
      OpportunityState.new,
      OpportunityState.viewed,
      OpportunityState.approved,
      OpportunityState.executed,
      OpportunityState.resolved,
      OpportunityState.dismissed,
      OpportunityState.expired,
    ])
    .optional(),
  priority: z
    .enum([PriorityBucket.high, PriorityBucket.medium, PriorityBucket.low])
    .optional(),
  type: z.string().optional(),
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
        logger.warn({ correlationId }, "Unauthorized opportunities list request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      // Parse and validate query parameters
      const { searchParams } = new URL(request.url);
      const queryParams = {
        state: searchParams.get("state") ?? undefined,
        priority: searchParams.get("priority") ?? undefined,
        type: searchParams.get("type") ?? undefined,
        page: searchParams.get("page") ?? "1",
        limit: searchParams.get("limit") ?? "20",
      };

      const validated = opportunitiesQuerySchema.parse(queryParams);
      const offset = (validated.page - 1) * validated.limit;

      logger.info(
        {
          correlationId,
          workspaceId,
          filters: {
            state: validated.state,
            priority: validated.priority,
            type: validated.type,
          },
          pagination: { page: validated.page, limit: validated.limit },
        },
        "Fetching opportunities list"
      );

      // Build where clause
      const where: {
        workspace_id: string;
        state?: OpportunityState;
        priority_bucket?: PriorityBucket;
        type?: string;
      } = {
        workspace_id: workspaceId,
      };

      if (validated.state) {
        where.state = validated.state;
      }

      if (validated.priority) {
        where.priority_bucket = validated.priority;
      }

      if (validated.type) {
        where.type = validated.type;
      }

      // Query opportunities with events (optimized to reduce data transfer)
      const [opportunities, totalCount] = await Promise.all([
        prisma.opportunity.findMany({
          where,
          select: {
            id: true,
            workspace_id: true,
            type: true,
            priority_bucket: true,
            why_now: true,
            rationale: true,
            impact_range: true,
            counterfactual: true,
            decay_at: true,
            confidence: true,
            state: true,
            created_at: true,
            updated_at: true,
            event_links: {
              select: {
                event: {
                  select: {
                    id: true,
                    type: true,
                    occurred_at: true,
                    payload_json: true,
                    source: true,
                    created_at: true,
                  },
                },
              },
            },
            action_drafts: {
              select: {
                id: true,
                state: true,
                operator_intent: true,
                execution_type: true,
              },
            },
          },
          orderBy: [
            { priority_bucket: "asc" }, // high=1, medium=2, low=3
            { created_at: "desc" },
          ],
          take: validated.limit,
          skip: offset,
        }),
        prisma.opportunity.count({ where }),
      ]);

      // Transform response to include events directly
      const transformedOpportunities = opportunities.map((opp) => ({
        id: opp.id,
        workspace_id: opp.workspace_id,
        type: opp.type,
        priority_bucket: opp.priority_bucket,
        why_now: opp.why_now,
        rationale: opp.rationale,
        impact_range: opp.impact_range,
        counterfactual: opp.counterfactual,
        decay_at: opp.decay_at,
        confidence: opp.confidence,
        state: opp.state,
        created_at: opp.created_at,
        updated_at: opp.updated_at,
        events: opp.event_links.map((link) => link.event),
        action_drafts: opp.action_drafts,
      }));

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          count: opportunities.length,
          totalCount,
          durationMs,
        },
        `Opportunities list fetched successfully`
      );

      return NextResponse.json(
        {
          opportunities: transformedOpportunities,
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
            "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
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
        "Error fetching opportunities list"
      );

      return NextResponse.json(
        { error: "An error occurred while fetching opportunities" },
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
