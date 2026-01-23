/**
 * Compute Outcomes Background Job
 *
 * Runs periodically to compute outcomes for executions that have passed
 * their observation window (e.g., 7 days for discounts, 14 days for win-back)
 *
 * This job should be scheduled to run daily via BullMQ or a cron scheduler
 */

import { prisma } from '@/server/db/client';
import { computeOutcome, isExecutionReadyForOutcome } from '../learning/outcomes/compute';
import { getExecutionsReadyForOutcome } from '../learning/queries';

/**
 * Job configuration
 */
export const COMPUTE_OUTCOMES_JOB_NAME = 'compute-outcomes';
export const COMPUTE_OUTCOMES_JOB_SCHEDULE = '0 2 * * *'; // Daily at 2 AM

/**
 * Main job handler
 *
 * Processes all workspaces and computes outcomes for ready executions
 */
export async function computeOutcomesJob() {
  console.log('[compute-outcomes] Job started');

  const startTime = Date.now();
  let totalProcessed = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  try {
    // Get all active workspaces
    const workspaces = await prisma.workspace.findMany({
      select: { id: true, name: true },
    });

    console.log(`[compute-outcomes] Processing ${workspaces.length} workspaces`);

    // Process each workspace
    for (const workspace of workspaces) {
      try {
        const result = await processWorkspaceOutcomes(workspace.id);
        totalProcessed += result.processed;
        totalSucceeded += result.succeeded;
        totalFailed += result.failed;

        console.log(
          `[compute-outcomes] Workspace ${workspace.id}: ${result.succeeded} succeeded, ${result.failed} failed`
        );
      } catch (error) {
        console.error(
          `[compute-outcomes] Error processing workspace ${workspace.id}:`,
          error
        );
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[compute-outcomes] Job completed in ${duration}ms: ${totalSucceeded}/${totalProcessed} succeeded, ${totalFailed} failed`
    );

    return {
      success: true,
      processed: totalProcessed,
      succeeded: totalSucceeded,
      failed: totalFailed,
      duration_ms: duration,
    };
  } catch (error) {
    console.error('[compute-outcomes] Job failed:', error);
    throw error;
  }
}

/**
 * Process outcomes for a single workspace
 */
async function processWorkspaceOutcomes(
  workspaceId: string
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Get executions ready for outcome computation
  const executions = await getExecutionsReadyForOutcome(workspaceId, 50);

  console.log(
    `[compute-outcomes] Found ${executions.length} executions ready for outcome computation`
  );

  // Process each execution
  for (const execution of executions) {
    try {
      // Double-check readiness (defensive)
      const isReady = await isExecutionReadyForOutcome(execution.id);
      if (!isReady) {
        console.log(
          `[compute-outcomes] Execution ${execution.id} not ready, skipping`
        );
        continue;
      }

      // Compute outcome
      const result = await computeOutcome(execution.id);

      processed++;

      if (result) {
        succeeded++;
        console.log(
          `[compute-outcomes] Computed outcome for execution ${execution.id}: ${result.outcome}`
        );
      } else {
        failed++;
        console.error(
          `[compute-outcomes] Failed to compute outcome for execution ${execution.id}`
        );
      }
    } catch (error) {
      processed++;
      failed++;
      console.error(
        `[compute-outcomes] Error computing outcome for execution ${execution.id}:`,
        error
      );
    }
  }

  return { processed, succeeded, failed };
}

/**
 * Process outcomes for a specific execution (manual trigger)
 */
export async function computeOutcomeForExecution(
  executionId: string
): Promise<{ success: boolean; outcome?: any; error?: string }> {
  try {
    // Check if ready
    const isReady = await isExecutionReadyForOutcome(executionId);
    if (!isReady) {
      return {
        success: false,
        error: 'Execution not ready for outcome computation',
      };
    }

    // Compute outcome
    const result = await computeOutcome(executionId);

    if (!result) {
      return {
        success: false,
        error: 'Failed to compute outcome',
      };
    }

    return {
      success: true,
      outcome: result,
    };
  } catch (error) {
    console.error(
      `[compute-outcomes] Error computing outcome for execution ${executionId}:`,
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get job statistics
 */
export async function getOutcomeJobStatistics() {
  // Get total executions needing outcomes
  const allWorkspaces = await prisma.workspace.findMany({
    select: { id: true },
  });

  let totalPending = 0;
  let totalProcessed = 0;

  for (const workspace of allWorkspaces) {
    const pending = await getExecutionsReadyForOutcome(workspace.id, 1000);
    totalPending += pending.length;

    const processed = await prisma.outcome.count({
      where: {
        execution: {
          workspace_id: workspace.id,
        },
      },
    });
    totalProcessed += processed;
  }

  return {
    total_pending: totalPending,
    total_processed: totalProcessed,
    workspaces: allWorkspaces.length,
  };
}
