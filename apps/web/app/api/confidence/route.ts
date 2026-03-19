// Confidence API Route
// GET: Return the latest persisted confidence score per operator intent
//      for the authenticated user's workspace.

import { NextRequest, NextResponse } from "next/server";

import {
  runWithCorrelationAsync,
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "@/lib/correlation";
import { getServerSession } from "@/server/auth/session";
import { getLatestConfidenceScores } from "@/server/learning/confidence";
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
        "Fetching latest confidence scores"
      );

      // Return the most recent persisted record per operator intent.
      // If no records have been computed yet the array will be empty;
      // the client should treat an absent intent as "no data yet".
      const scores = await getLatestConfidenceScores(workspaceId);

      const durationMs = Date.now() - startTime;

      logger.info(
        { correlationId, workspaceId, count: scores.length, durationMs },
        "Confidence scores fetched successfully"
      );

      return NextResponse.json(
        {
          confidence_scores: scores.map((s) => ({
            operator_intent: s.operator_intent,
            score: s.score,
            trend: s.trend,
            sample_size: s.recent_executions,
            computed_at: s.last_computed_at.toISOString(),
          })),
          fetched_at: new Date().toISOString(),
        },
        {
          status: 200,
          headers: {
            "X-Correlation-ID": correlationId,
            // Scores are recomputed on a schedule; 2-minute client cache is safe
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
