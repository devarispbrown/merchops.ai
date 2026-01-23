/**
 * Unit Tests: Action Draft State Machine
 * MerchOps Beta MVP
 *
 * Tests:
 * - Draft state transitions
 * - Approval flow
 * - Execution state tracking
 * - State validation rules
 */

import { describe, it, expect } from 'vitest';
import { ActionDraftState } from '@/server/actions/types';

// ============================================================================
// DRAFT STATE MACHINE
// ============================================================================

/**
 * Valid state transitions for action drafts
 */
const VALID_DRAFT_TRANSITIONS: Record<ActionDraftState, ActionDraftState[]> = {
  [ActionDraftState.DRAFT]: [
    ActionDraftState.EDITED,
    ActionDraftState.APPROVED,
    ActionDraftState.REJECTED,
  ],
  [ActionDraftState.EDITED]: [
    ActionDraftState.APPROVED,
    ActionDraftState.REJECTED,
  ],
  [ActionDraftState.APPROVED]: [
    ActionDraftState.EXECUTING,
  ],
  [ActionDraftState.EXECUTING]: [
    ActionDraftState.EXECUTED,
    ActionDraftState.FAILED,
  ],
  [ActionDraftState.EXECUTED]: [], // Terminal state
  [ActionDraftState.FAILED]: [
    ActionDraftState.EXECUTING, // Allow retry
  ],
  [ActionDraftState.REJECTED]: [], // Terminal state
};

/**
 * Validate if a draft state transition is allowed
 */
function isValidDraftTransition(
  from: ActionDraftState,
  to: ActionDraftState
): boolean {
  const validNextStates = VALID_DRAFT_TRANSITIONS[from];
  return validNextStates.includes(to);
}

/**
 * Attempt a draft state transition
 */
function transitionDraftState(
  currentState: ActionDraftState,
  newState: ActionDraftState
): ActionDraftState {
  if (!isValidDraftTransition(currentState, newState)) {
    throw new Error(
      `Invalid draft state transition: ${currentState} -> ${newState}`
    );
  }
  return newState;
}

/**
 * Check if a draft state is terminal
 */
function isTerminalDraftState(state: ActionDraftState): boolean {
  return VALID_DRAFT_TRANSITIONS[state].length === 0;
}

describe('Action Draft State Machine', () => {
  describe('Draft Creation and Editing', () => {
    it('should allow draft -> edited', () => {
      const result = transitionDraftState(
        ActionDraftState.DRAFT,
        ActionDraftState.EDITED
      );
      expect(result).toBe(ActionDraftState.EDITED);
    });

    it('should allow draft -> approved (approve without editing)', () => {
      const result = transitionDraftState(
        ActionDraftState.DRAFT,
        ActionDraftState.APPROVED
      );
      expect(result).toBe(ActionDraftState.APPROVED);
    });

    it('should allow draft -> rejected', () => {
      const result = transitionDraftState(
        ActionDraftState.DRAFT,
        ActionDraftState.REJECTED
      );
      expect(result).toBe(ActionDraftState.REJECTED);
    });

    it('should allow edited -> approved', () => {
      const result = transitionDraftState(
        ActionDraftState.EDITED,
        ActionDraftState.APPROVED
      );
      expect(result).toBe(ActionDraftState.APPROVED);
    });

    it('should allow edited -> rejected', () => {
      const result = transitionDraftState(
        ActionDraftState.EDITED,
        ActionDraftState.REJECTED
      );
      expect(result).toBe(ActionDraftState.REJECTED);
    });

    it('should reject draft -> executing (must be approved first)', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.DRAFT, ActionDraftState.EXECUTING);
      }).toThrow('Invalid draft state transition: draft -> executing');
    });

    it('should reject edited -> executing', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.EDITED, ActionDraftState.EXECUTING);
      }).toThrow('Invalid draft state transition: edited -> executing');
    });
  });

  describe('Approval Flow', () => {
    it('should allow approved -> executing', () => {
      const result = transitionDraftState(
        ActionDraftState.APPROVED,
        ActionDraftState.EXECUTING
      );
      expect(result).toBe(ActionDraftState.EXECUTING);
    });

    it('should allow executing -> executed (success)', () => {
      const result = transitionDraftState(
        ActionDraftState.EXECUTING,
        ActionDraftState.EXECUTED
      );
      expect(result).toBe(ActionDraftState.EXECUTED);
    });

    it('should allow executing -> failed', () => {
      const result = transitionDraftState(
        ActionDraftState.EXECUTING,
        ActionDraftState.FAILED
      );
      expect(result).toBe(ActionDraftState.FAILED);
    });

    it('should reject approved -> executed (must go through executing)', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.APPROVED, ActionDraftState.EXECUTED);
      }).toThrow('Invalid draft state transition: approved -> executed');
    });

    it('should reject approved -> failed', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.APPROVED, ActionDraftState.FAILED);
      }).toThrow('Invalid draft state transition: approved -> failed');
    });
  });

  describe('Retry Logic', () => {
    it('should allow failed -> executing (retry)', () => {
      const result = transitionDraftState(
        ActionDraftState.FAILED,
        ActionDraftState.EXECUTING
      );
      expect(result).toBe(ActionDraftState.EXECUTING);
    });

    it('should allow multiple retries: executing -> failed -> executing -> failed', () => {
      let state = ActionDraftState.EXECUTING;

      // First failure
      state = transitionDraftState(state, ActionDraftState.FAILED);
      expect(state).toBe(ActionDraftState.FAILED);

      // First retry
      state = transitionDraftState(state, ActionDraftState.EXECUTING);
      expect(state).toBe(ActionDraftState.EXECUTING);

      // Second failure
      state = transitionDraftState(state, ActionDraftState.FAILED);
      expect(state).toBe(ActionDraftState.FAILED);

      // Second retry
      state = transitionDraftState(state, ActionDraftState.EXECUTING);
      expect(state).toBe(ActionDraftState.EXECUTING);
    });

    it('should allow retry followed by success', () => {
      let state = ActionDraftState.FAILED;

      state = transitionDraftState(state, ActionDraftState.EXECUTING);
      expect(state).toBe(ActionDraftState.EXECUTING);

      state = transitionDraftState(state, ActionDraftState.EXECUTED);
      expect(state).toBe(ActionDraftState.EXECUTED);
    });

    it('should reject failed -> executed (must go through executing)', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.FAILED, ActionDraftState.EXECUTED);
      }).toThrow('Invalid draft state transition: failed -> executed');
    });

    it('should reject failed -> approved', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.FAILED, ActionDraftState.APPROVED);
      }).toThrow('Invalid draft state transition');
    });
  });

  describe('Terminal States', () => {
    it('should mark executed as terminal state', () => {
      expect(isTerminalDraftState(ActionDraftState.EXECUTED)).toBe(true);
      expect(VALID_DRAFT_TRANSITIONS[ActionDraftState.EXECUTED]).toHaveLength(0);
    });

    it('should mark rejected as terminal state', () => {
      expect(isTerminalDraftState(ActionDraftState.REJECTED)).toBe(true);
      expect(VALID_DRAFT_TRANSITIONS[ActionDraftState.REJECTED]).toHaveLength(0);
    });

    it('should not mark failed as terminal (allows retry)', () => {
      expect(isTerminalDraftState(ActionDraftState.FAILED)).toBe(false);
      expect(VALID_DRAFT_TRANSITIONS[ActionDraftState.FAILED].length).toBeGreaterThan(0);
    });

    it('should reject any transition from executed', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.EXECUTED, ActionDraftState.DRAFT);
      }).toThrow('Invalid draft state transition');
    });

    it('should reject any transition from rejected', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.REJECTED, ActionDraftState.DRAFT);
      }).toThrow('Invalid draft state transition');
    });
  });

  describe('Complete Approval Flows', () => {
    it('should allow happy path: draft -> approved -> executing -> executed', () => {
      let state = ActionDraftState.DRAFT;

      state = transitionDraftState(state, ActionDraftState.APPROVED);
      expect(state).toBe(ActionDraftState.APPROVED);

      state = transitionDraftState(state, ActionDraftState.EXECUTING);
      expect(state).toBe(ActionDraftState.EXECUTING);

      state = transitionDraftState(state, ActionDraftState.EXECUTED);
      expect(state).toBe(ActionDraftState.EXECUTED);
    });

    it('should allow edited flow: draft -> edited -> approved -> executing -> executed', () => {
      let state = ActionDraftState.DRAFT;

      state = transitionDraftState(state, ActionDraftState.EDITED);
      expect(state).toBe(ActionDraftState.EDITED);

      state = transitionDraftState(state, ActionDraftState.APPROVED);
      expect(state).toBe(ActionDraftState.APPROVED);

      state = transitionDraftState(state, ActionDraftState.EXECUTING);
      expect(state).toBe(ActionDraftState.EXECUTING);

      state = transitionDraftState(state, ActionDraftState.EXECUTED);
      expect(state).toBe(ActionDraftState.EXECUTED);
    });

    it('should allow rejection flow: draft -> rejected', () => {
      let state = ActionDraftState.DRAFT;

      state = transitionDraftState(state, ActionDraftState.REJECTED);
      expect(state).toBe(ActionDraftState.REJECTED);
    });

    it('should allow rejection after edit: draft -> edited -> rejected', () => {
      let state = ActionDraftState.DRAFT;

      state = transitionDraftState(state, ActionDraftState.EDITED);
      state = transitionDraftState(state, ActionDraftState.REJECTED);
      expect(state).toBe(ActionDraftState.REJECTED);
    });

    it('should allow retry flow: approved -> executing -> failed -> executing -> executed', () => {
      let state = ActionDraftState.APPROVED;

      state = transitionDraftState(state, ActionDraftState.EXECUTING);
      state = transitionDraftState(state, ActionDraftState.FAILED);
      state = transitionDraftState(state, ActionDraftState.EXECUTING);
      state = transitionDraftState(state, ActionDraftState.EXECUTED);

      expect(state).toBe(ActionDraftState.EXECUTED);
    });
  });

  describe('Invalid Transitions', () => {
    it('should reject backwards flow: approved -> draft', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.APPROVED, ActionDraftState.DRAFT);
      }).toThrow('Invalid draft state transition');
    });

    it('should reject backwards flow: executing -> approved', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.EXECUTING, ActionDraftState.APPROVED);
      }).toThrow('Invalid draft state transition');
    });

    it('should reject skipping approval: draft -> executing', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.DRAFT, ActionDraftState.EXECUTING);
      }).toThrow('Invalid draft state transition');
    });

    it('should reject editing after approval: approved -> edited', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.APPROVED, ActionDraftState.EDITED);
      }).toThrow('Invalid draft state transition');
    });

    it('should reject re-editing from executing: executing -> edited', () => {
      expect(() => {
        transitionDraftState(ActionDraftState.EXECUTING, ActionDraftState.EDITED);
      }).toThrow('Invalid draft state transition');
    });
  });

  describe('State Coverage', () => {
    it('should have transition rules for all draft states', () => {
      const allStates = Object.values(ActionDraftState);

      for (const state of allStates) {
        expect(VALID_DRAFT_TRANSITIONS).toHaveProperty(state);
        expect(Array.isArray(VALID_DRAFT_TRANSITIONS[state])).toBe(true);
      }
    });

    it('should cover all 7 draft states', () => {
      const stateCount = Object.keys(ActionDraftState).length;
      expect(stateCount).toBe(7);

      // Verify all expected states exist
      expect(ActionDraftState.DRAFT).toBeDefined();
      expect(ActionDraftState.EDITED).toBeDefined();
      expect(ActionDraftState.APPROVED).toBeDefined();
      expect(ActionDraftState.REJECTED).toBeDefined();
      expect(ActionDraftState.EXECUTING).toBeDefined();
      expect(ActionDraftState.EXECUTED).toBeDefined();
      expect(ActionDraftState.FAILED).toBeDefined();
    });
  });
});
