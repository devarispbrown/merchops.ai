/**
 * Outcome Computation
 *
 * Main entry point for computing outcomes for executed actions
 * Routes to appropriate resolver based on execution type
 */

import { ExecutionType, OperatorIntent as _OperatorIntent } from '@prisma/client';
import { prisma } from '@/server/db/client';
import {
  OutcomeComputationInput,
  OutcomeComputationResult,
  toPrismaOutcomeType,
} from '../types';
import { DiscountOutcomeResolver } from './resolvers/discount';
import { WinbackOutcomeResolver } from './resolvers/winback';
import { PauseProductOutcomeResolver } from './resolvers/pause';

/**
 * Compute outcome for an execution
 *
 * This is the main entry point called by the background job.
 * It routes to the appropriate resolver and persists the result.
 */
export async function computeOutcome(
  executionId: string
): Promise<OutcomeComputationResult | null> {
  // Fetch execution with related data
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      action_draft: {
        include: {
          opportunity: true,
        },
      },
    },
  });

  if (!execution) {
    console.error(`Execution not found: ${executionId}`);
    return null;
  }

  // Check if outcome already computed
  const existingOutcome = await prisma.outcome.findUnique({
    where: { execution_id: executionId },
  });

  if (existingOutcome) {
    console.log(`Outcome already computed for execution: ${executionId}`);
    return null;
  }

  // Ensure execution succeeded
  if (execution.status !== 'succeeded') {
    console.log(
      `Execution ${executionId} did not succeed (status: ${execution.status}), skipping outcome computation`
    );
    return null;
  }

  // Build computation input
  const input: OutcomeComputationInput = {
    execution_id: executionId,
    workspace_id: execution.workspace_id,
    operator_intent: execution.action_draft.operator_intent,
    execution_type: execution.action_draft.execution_type,
    execution_payload: execution.request_payload_json as Record<string, any>,
    executed_at: execution.started_at,
  };

  // Route to appropriate resolver
  const resolver = getResolver(execution.action_draft.execution_type);

  if (!resolver) {
    console.error(
      `No resolver found for execution type: ${execution.action_draft.execution_type}`
    );
    return null;
  }

  // Compute outcome
  let result: OutcomeComputationResult;
  try {
    result = await resolver.compute(input);
  } catch (error) {
    console.error(`Error computing outcome for execution ${executionId}:`, error);
    return null;
  }

  // Persist outcome
  await prisma.outcome.create({
    data: {
      execution_id: executionId,
      outcome: toPrismaOutcomeType(result.outcome),
      computed_at: result.computed_at,
      evidence_json: result.evidence as any,
    },
  });

  console.log(
    `Outcome computed for execution ${executionId}: ${result.outcome}`
  );

  return result;
}

/**
 * Get the appropriate resolver for an execution type
 */
function getResolver(
  executionType: ExecutionType
):
  | DiscountOutcomeResolver
  | WinbackOutcomeResolver
  | PauseProductOutcomeResolver
  | null {
  switch (executionType) {
    case 'discount_draft':
      return new DiscountOutcomeResolver();
    case 'winback_email_draft':
      return new WinbackOutcomeResolver();
    case 'pause_product':
      return new PauseProductOutcomeResolver();
    default:
      return null;
  }
}

/**
 * Check if an execution is ready for outcome computation
 *
 * Executions need to wait for their observation window to complete
 */
export async function isExecutionReadyForOutcome(
  executionId: string
): Promise<boolean> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      action_draft: true,
    },
  });

  if (!execution) {
    return false;
  }

  // Must be succeeded
  if (execution.status !== 'succeeded') {
    return false;
  }

  // Check if outcome already exists
  const existingOutcome = await prisma.outcome.findUnique({
    where: { execution_id: executionId },
  });

  if (existingOutcome) {
    return false;
  }

  // Calculate observation window based on execution type
  const observationDays = getObservationWindowDays(
    execution.action_draft.execution_type
  );
  const observationEndDate = new Date(execution.started_at);
  observationEndDate.setDate(observationEndDate.getDate() + observationDays);

  // Check if observation window has passed
  const now = new Date();
  return now >= observationEndDate;
}

/**
 * Get observation window duration in days for an execution type
 */
function getObservationWindowDays(executionType: ExecutionType): number {
  switch (executionType) {
    case 'discount_draft':
      return 7; // 7 days for discounts
    case 'winback_email_draft':
      return 14; // 14 days for win-back emails
    case 'pause_product':
      return 14; // 14 days for product pause
    default:
      return 7;
  }
}
