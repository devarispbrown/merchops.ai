// Draft Detail API Route
// GET: Get draft detail with payload
// PATCH: Update draft (edit fields)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { updateDraft } from "@/server/actions/drafts/edit";
import { getServerSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { logger } from "@/server/observability/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const { id: draftId } = await params;

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn(
          { correlationId, draftId },
          "Unauthorized draft detail request"
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      logger.info(
        { correlationId, workspaceId, draftId },
        "Fetching draft detail"
      );

      // Fetch draft with full details
      const draft = await prisma.actionDraft.findUnique({
        where: { id: draftId },
        include: {
          opportunity: {
            select: {
              id: true,
              type: true,
              priority_bucket: true,
              why_now: true,
              rationale: true,
              counterfactual: true,
              state: true,
            },
          },
          executions: {
            select: {
              id: true,
              status: true,
              started_at: true,
              finished_at: true,
              error_code: true,
              error_message: true,
            },
            orderBy: {
              started_at: "desc",
            },
          },
        },
      });

      if (!draft) {
        logger.warn(
          { correlationId, workspaceId, draftId },
          "Draft not found"
        );
        return NextResponse.json(
          { error: "Draft not found" },
          { status: 404 }
        );
      }

      // Verify workspace access
      if (draft.workspace_id !== workspaceId) {
        logger.warn(
          {
            correlationId,
            workspaceId,
            draftId,
            draftWorkspaceId: draft.workspace_id,
          },
          "Access denied: Draft belongs to different workspace"
        );
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const durationMs = Date.now() - startTime;

      logger.info(
        { correlationId, workspaceId, draftId, durationMs },
        "Draft detail fetched successfully"
      );

      return NextResponse.json(draft, {
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
          draftId,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          durationMs,
        },
        "Error fetching draft detail"
      );

      return NextResponse.json(
        { error: "An error occurred while fetching draft" },
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

const UpdateDraftSchema = z.object({
  updates: z.record(z.any()),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const { id: draftId } = await params;

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn(
          { correlationId, draftId },
          "Unauthorized draft update request"
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;

      // Parse and validate request body
      const body = await request.json();
      const validated = UpdateDraftSchema.parse(body);

      logger.info(
        {
          correlationId,
          workspaceId,
          draftId,
          updates: validated.updates,
        },
        "Updating draft"
      );

      // Update draft using server action
      const result = await updateDraft({
        workspaceId,
        draftId,
        updates: validated.updates,
      });

      if (!result.success) {
        logger.warn(
          {
            correlationId,
            workspaceId,
            draftId,
            errors: result.errors,
          },
          "Draft validation failed"
        );
        return NextResponse.json(
          {
            error: "Validation failed",
            errors: result.errors,
          },
          {
            status: 400,
            headers: {
              "X-Correlation-ID": correlationId,
            },
          }
        );
      }

      const durationMs = Date.now() - startTime;

      logger.info(
        { correlationId, workspaceId, draftId, durationMs },
        "Draft updated successfully"
      );

      return NextResponse.json(
        {
          success: true,
          draft: {
            id: result.draft.id,
            state: result.draft.state,
            payload: result.draft.payload_json,
            updatedAt: result.draft.updated_at,
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
          { correlationId, draftId, errors: error.errors, durationMs },
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
          draftId,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          durationMs,
        },
        "Error updating draft"
      );

      return NextResponse.json(
        { error: "An error occurred while updating draft" },
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
