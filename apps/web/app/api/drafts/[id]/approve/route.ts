// Draft Approval API Route
// POST: Approve draft and create execution

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { approveDraft } from "@/server/actions/drafts/approve";
import { getServerSession } from "@/server/auth/session";
import { logger } from "@/server/observability/logger";

const ApproveDraftSchema = z.object({
  approvedBy: z.string().uuid().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  return runWithCorrelationAsync({ correlationId }, async () => {
    const startTime = Date.now();
    const draftId = params.id;

    try {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user) {
        logger.warn(
          { correlationId, draftId },
          "Unauthorized draft approval request"
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const workspaceId = session.user.workspaceId;
      const userId = session.user.id;

      // Parse optional body
      let approvedBy: string | undefined = userId;
      try {
        const body = await request.json();
        const validated = ApproveDraftSchema.parse(body);
        approvedBy = validated.approvedBy ?? userId;
      } catch {
        // No body is fine, use session user
      }

      logger.info(
        {
          correlationId,
          workspaceId,
          draftId,
          approvedBy,
        },
        "Approving draft"
      );

      // Approve draft using server action
      const result = await approveDraft({
        workspaceId,
        draftId,
        approvedBy,
      });

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          correlationId,
          workspaceId,
          draftId,
          executionId: result.executionId,
          idempotencyKey: result.idempotencyKey,
          durationMs,
        },
        "Draft approved and execution created"
      );

      return NextResponse.json(
        {
          success: result.success,
          executionId: result.executionId,
          idempotencyKey: result.idempotencyKey,
          message: "Draft approved and execution queued",
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
        "Error approving draft"
      );

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return NextResponse.json(
            { error: "Draft not found" },
            {
              status: 404,
              headers: {
                "X-Correlation-ID": correlationId,
              },
            }
          );
        }

        if (error.message.includes("cannot be approved")) {
          return NextResponse.json(
            { error: error.message },
            {
              status: 409,
              headers: {
                "X-Correlation-ID": correlationId,
              },
            }
          );
        }

        if (error.message.includes("validation failed")) {
          return NextResponse.json(
            { error: error.message },
            {
              status: 400,
              headers: {
                "X-Correlation-ID": correlationId,
              },
            }
          );
        }
      }

      return NextResponse.json(
        { error: "An error occurred while approving draft" },
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
