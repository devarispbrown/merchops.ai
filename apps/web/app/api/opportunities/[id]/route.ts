// Opportunity Detail API Route
// GET: Get opportunity detail with events
// PATCH: Update opportunity state (view, dismiss)

import { OpportunityState } from "@prisma/client";
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

// PATCH body schema
const updateOpportunitySchema = z.object({
  state: z.enum([
    OpportunityState.viewed,
    OpportunityState.dismissed,
    OpportunityState.expired,
  ]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const { id: opportunityId } = await params;

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn(
          { correlationId, opportunityId },
          "Unauthorized opportunity detail request"
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      logger.info(
        { correlationId, workspaceId, opportunityId },
        "Fetching opportunity detail"
      );

      // Fetch opportunity with events (optimized select for performance)
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
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
                  workspace_id: true,
                  type: true,
                  occurred_at: true,
                  payload_json: true,
                  dedupe_key: true,
                  source: true,
                  created_at: true,
                },
              },
            },
          },
          action_drafts: {
            select: {
              id: true,
              workspace_id: true,
              opportunity_id: true,
              operator_intent: true,
              execution_type: true,
              payload_json: true,
              editable_fields_json: true,
              state: true,
              created_at: true,
              updated_at: true,
              executions: {
                select: {
                  id: true,
                  status: true,
                  started_at: true,
                  finished_at: true,
                },
              },
            },
          },
        },
      });

      if (!opportunity) {
        logger.warn(
          { correlationId, workspaceId, opportunityId },
          "Opportunity not found"
        );
        return NextResponse.json(
          { error: "Opportunity not found" },
          { status: 404 }
        );
      }

      // Verify workspace access
      if (opportunity.workspace_id !== workspaceId) {
        logger.warn(
          {
            correlationId,
            workspaceId,
            opportunityId,
            opportunityWorkspaceId: opportunity.workspace_id,
          },
          "Access denied: Opportunity belongs to different workspace"
        );
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Transform response
      const response = {
        id: opportunity.id,
        workspace_id: opportunity.workspace_id,
        type: opportunity.type,
        priority_bucket: opportunity.priority_bucket,
        why_now: opportunity.why_now,
        rationale: opportunity.rationale,
        impact_range: opportunity.impact_range,
        counterfactual: opportunity.counterfactual,
        decay_at: opportunity.decay_at,
        confidence: opportunity.confidence,
        state: opportunity.state,
        created_at: opportunity.created_at,
        updated_at: opportunity.updated_at,
        events: opportunity.event_links.map((link) => link.event),
        action_drafts: opportunity.action_drafts,
      };

      const durationMs = Date.now() - startTime;

      logger.info(
        { correlationId, workspaceId, opportunityId, durationMs },
        "Opportunity detail fetched successfully"
      );

      return NextResponse.json(response, {
        status: 200,
        headers: {
          "X-Correlation-ID": correlationId,
          "Cache-Control": "private, max-age=30",
        },
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error(
        {
          correlationId,
          opportunityId,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          durationMs,
        },
        "Error fetching opportunity detail"
      );

      return NextResponse.json(
        { error: "An error occurred while fetching opportunity" },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const { id: opportunityId } = await params;

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn(
          { correlationId, opportunityId },
          "Unauthorized opportunity update request"
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      // Parse and validate request body
      const body = await request.json();
      const validated = updateOpportunitySchema.parse(body);

      logger.info(
        {
          correlationId,
          workspaceId,
          opportunityId,
          newState: validated.state,
        },
        "Updating opportunity state"
      );

      // Fetch current opportunity
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
      });

      if (!opportunity) {
        logger.warn(
          { correlationId, workspaceId, opportunityId },
          "Opportunity not found"
        );
        return NextResponse.json(
          { error: "Opportunity not found" },
          { status: 404 }
        );
      }

      // Verify workspace access
      if (opportunity.workspace_id !== workspaceId) {
        logger.warn(
          {
            correlationId,
            workspaceId,
            opportunityId,
            opportunityWorkspaceId: opportunity.workspace_id,
          },
          "Access denied: Opportunity belongs to different workspace"
        );
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Update opportunity state
      const updated = await prisma.opportunity.update({
        where: { id: opportunityId },
        data: {
          state: validated.state,
        },
        include: {
          event_links: {
            include: {
              event: true,
            },
          },
        },
      });

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          opportunityId,
          oldState: opportunity.state,
          newState: validated.state,
          durationMs,
        },
        "Opportunity state updated successfully"
      );

      // Transform response
      const response = {
        id: updated.id,
        workspace_id: updated.workspace_id,
        type: updated.type,
        priority_bucket: updated.priority_bucket,
        why_now: updated.why_now,
        rationale: updated.rationale,
        impact_range: updated.impact_range,
        counterfactual: updated.counterfactual,
        decay_at: updated.decay_at,
        confidence: updated.confidence,
        state: updated.state,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        events: updated.event_links.map((link) => link.event),
      };

      return NextResponse.json(response, {
        status: 200,
        headers: {
          "X-Correlation-ID": correlationId,
        },
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Validation errors
      if (error instanceof z.ZodError) {
        logger.warn(
          { correlationId, opportunityId, errors: error.errors, durationMs },
          "Invalid update data"
        );
        return NextResponse.json(
          {
            error: "Invalid update data",
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
          opportunityId,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          durationMs,
        },
        "Error updating opportunity"
      );

      return NextResponse.json(
        { error: "An error occurred while updating opportunity" },
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
