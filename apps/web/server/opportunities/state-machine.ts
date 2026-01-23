/**
 * Opportunity State Machine
 *
 * Manages state transitions with validation.
 * Ensures opportunities follow valid state transition paths.
 */

import { PrismaClient, Opportunity, OpportunityState } from '@prisma/client';
import { VALID_TRANSITIONS } from './types';

// ============================================================================
// STATE TRANSITION ERRORS
// ============================================================================

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly currentState: OpportunityState,
    public readonly targetState: OpportunityState,
    public readonly opportunityId: string
  ) {
    super(
      `Invalid state transition for opportunity ${opportunityId}: ${currentState} -> ${targetState}`
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class OpportunityNotFoundError extends Error {
  constructor(public readonly opportunityId: string) {
    super(`Opportunity ${opportunityId} not found`);
    this.name = 'OpportunityNotFoundError';
  }
}

// ============================================================================
// STATE MACHINE CLASS
// ============================================================================

/**
 * Opportunity State Machine
 * Encapsulates state transition logic and validation
 */
export class OpportunityStateMachine {
  constructor(private readonly opportunity: Opportunity) {}

  /**
   * Check if a state transition is valid
   */
  canTransitionTo(newState: OpportunityState): boolean {
    const validStates = VALID_TRANSITIONS[this.opportunity.state];
    return validStates.includes(newState);
  }

  /**
   * Get list of valid next states
   */
  getValidNextStates(): OpportunityState[] {
    return VALID_TRANSITIONS[this.opportunity.state];
  }

  /**
   * Check if opportunity is in a terminal state
   */
  isTerminal(): boolean {
    const terminalStates: OpportunityState[] = ['resolved', 'dismissed', 'expired'];
    return terminalStates.includes(this.opportunity.state);
  }

  /**
   * Validate a transition and throw if invalid
   */
  validateTransition(newState: OpportunityState): void {
    if (!this.canTransitionTo(newState)) {
      throw new InvalidStateTransitionError(
        this.opportunity.state,
        newState,
        this.opportunity.id
      );
    }
  }
}

// ============================================================================
// STATE TRANSITION FUNCTIONS
// ============================================================================

/**
 * Transition an opportunity to a new state
 * Validates the transition before applying
 *
 * @throws InvalidStateTransitionError if transition is not allowed
 * @throws OpportunityNotFoundError if opportunity does not exist
 */
export async function transitionState(
  opportunityId: string,
  newState: OpportunityState,
  prisma: PrismaClient
): Promise<Opportunity> {
  // Fetch opportunity
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
  });

  if (!opportunity) {
    throw new OpportunityNotFoundError(opportunityId);
  }

  // If already in target state, return as-is (idempotent)
  if (opportunity.state === newState) {
    return opportunity;
  }

  // Validate transition
  const stateMachine = new OpportunityStateMachine(opportunity);
  stateMachine.validateTransition(newState);

  // Apply transition
  const updatedOpportunity = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      state: newState,
    },
  });

  return updatedOpportunity;
}

/**
 * Safely attempt a state transition
 * Returns success status instead of throwing
 */
export async function tryTransitionState(
  opportunityId: string,
  newState: OpportunityState,
  prisma: PrismaClient
): Promise<{ success: boolean; opportunity?: Opportunity; error?: Error }> {
  try {
    const opportunity = await transitionState(opportunityId, newState, prisma);
    return { success: true, opportunity };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

/**
 * Batch transition multiple opportunities to a new state
 * Returns summary of successes and failures
 */
export async function batchTransitionState(
  opportunityIds: string[],
  newState: OpportunityState,
  prisma: PrismaClient
): Promise<{
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of opportunityIds) {
    try {
      await transitionState(id, newState, prisma);
      succeeded.push(id);
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { succeeded, failed };
}

// ============================================================================
// SPECIFIC TRANSITIONS
// ============================================================================

/**
 * Mark opportunity as viewed
 */
export async function markAsViewed(
  opportunityId: string,
  prisma: PrismaClient
): Promise<Opportunity> {
  return transitionState(opportunityId, OpportunityState.viewed, prisma);
}

/**
 * Mark opportunity as approved
 */
export async function markAsApproved(
  opportunityId: string,
  prisma: PrismaClient
): Promise<Opportunity> {
  return transitionState(opportunityId, OpportunityState.approved, prisma);
}

/**
 * Mark opportunity as executed
 */
export async function markAsExecuted(
  opportunityId: string,
  prisma: PrismaClient
): Promise<Opportunity> {
  return transitionState(opportunityId, OpportunityState.executed, prisma);
}

/**
 * Mark opportunity as resolved
 */
export async function markAsResolved(
  opportunityId: string,
  prisma: PrismaClient
): Promise<Opportunity> {
  return transitionState(opportunityId, OpportunityState.resolved, prisma);
}

/**
 * Mark opportunity as dismissed
 */
export async function markAsDismissed(
  opportunityId: string,
  prisma: PrismaClient
): Promise<Opportunity> {
  return transitionState(opportunityId, OpportunityState.dismissed, prisma);
}

/**
 * Mark opportunity as expired
 */
export async function markAsExpired(
  opportunityId: string,
  prisma: PrismaClient
): Promise<Opportunity> {
  return transitionState(opportunityId, OpportunityState.expired, prisma);
}

// ============================================================================
// STATE QUERIES
// ============================================================================

/**
 * Get state machine for an opportunity
 */
export async function getStateMachine(
  opportunityId: string,
  prisma: PrismaClient
): Promise<OpportunityStateMachine> {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
  });

  if (!opportunity) {
    throw new OpportunityNotFoundError(opportunityId);
  }

  return new OpportunityStateMachine(opportunity);
}

/**
 * Get opportunities in a specific state
 */
export async function getOpportunitiesByState(
  workspaceId: string,
  state: OpportunityState,
  prisma: PrismaClient
): Promise<Opportunity[]> {
  return prisma.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
      state,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
}

/**
 * Count opportunities by state for a workspace
 */
export async function countOpportunitiesByState(
  workspaceId: string,
  prisma: PrismaClient
): Promise<Record<OpportunityState, number>> {
  const counts = await prisma.opportunity.groupBy({
    by: ['state'],
    where: {
      workspace_id: workspaceId,
    },
    _count: {
      id: true,
    },
  });

  // Initialize all states to 0
  const result: Record<OpportunityState, number> = {
    [OpportunityState.new]: 0,
    [OpportunityState.viewed]: 0,
    [OpportunityState.approved]: 0,
    [OpportunityState.executed]: 0,
    [OpportunityState.resolved]: 0,
    [OpportunityState.dismissed]: 0,
    [OpportunityState.expired]: 0,
  };

  // Fill in actual counts
  for (const count of counts) {
    result[count.state] = count._count.id;
  }

  return result;
}
