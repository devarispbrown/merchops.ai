/**
 * Unit Tests: Opportunity State Machine
 * MerchOps Beta MVP
 *
 * Tests:
 * - Valid state transitions
 * - Invalid state transitions throw errors
 * - All states are covered
 * - Terminal states behavior
 */

import { describe, it, expect } from 'vitest';
import { OpportunityState, VALID_TRANSITIONS } from '@/server/opportunities/types';

// ============================================================================
// STATE TRANSITION VALIDATION
// ============================================================================

/**
 * Validate if a state transition is allowed
 */
function isValidTransition(from: OpportunityState, to: OpportunityState): boolean {
  const validNextStates = VALID_TRANSITIONS[from];
  return validNextStates.includes(to);
}

/**
 * Attempt a state transition
 * Throws error if transition is invalid
 */
function transitionState(
  currentState: OpportunityState,
  newState: OpportunityState
): OpportunityState {
  if (!isValidTransition(currentState, newState)) {
    throw new Error(
      `Invalid state transition: ${currentState} -> ${newState}`
    );
  }
  return newState;
}

/**
 * Check if a state is terminal (no valid transitions out)
 */
function isTerminalState(state: OpportunityState): boolean {
  return VALID_TRANSITIONS[state].length === 0;
}

/**
 * Get all valid next states for a given state
 */
function getValidNextStates(state: OpportunityState): OpportunityState[] {
  return VALID_TRANSITIONS[state];
}

describe('Opportunity State Machine', () => {
  describe('Valid State Transitions', () => {
    it('should allow new -> viewed', () => {
      const result = transitionState(OpportunityState.new, OpportunityState.viewed);
      expect(result).toBe(OpportunityState.viewed);
    });

    it('should allow new -> dismissed', () => {
      const result = transitionState(OpportunityState.new, OpportunityState.dismissed);
      expect(result).toBe(OpportunityState.dismissed);
    });

    it('should allow new -> expired', () => {
      const result = transitionState(OpportunityState.new, OpportunityState.expired);
      expect(result).toBe(OpportunityState.expired);
    });

    it('should allow viewed -> approved', () => {
      const result = transitionState(OpportunityState.viewed, OpportunityState.approved);
      expect(result).toBe(OpportunityState.approved);
    });

    it('should allow viewed -> dismissed', () => {
      const result = transitionState(OpportunityState.viewed, OpportunityState.dismissed);
      expect(result).toBe(OpportunityState.dismissed);
    });

    it('should allow viewed -> expired', () => {
      const result = transitionState(OpportunityState.viewed, OpportunityState.expired);
      expect(result).toBe(OpportunityState.expired);
    });

    it('should allow approved -> executed', () => {
      const result = transitionState(OpportunityState.approved, OpportunityState.executed);
      expect(result).toBe(OpportunityState.executed);
    });

    it('should allow approved -> dismissed', () => {
      const result = transitionState(OpportunityState.approved, OpportunityState.dismissed);
      expect(result).toBe(OpportunityState.dismissed);
    });

    it('should allow executed -> resolved', () => {
      const result = transitionState(OpportunityState.executed, OpportunityState.resolved);
      expect(result).toBe(OpportunityState.resolved);
    });
  });

  describe('Invalid State Transitions', () => {
    it('should reject new -> approved (must go through viewed)', () => {
      expect(() => {
        transitionState(OpportunityState.new, OpportunityState.approved);
      }).toThrow('Invalid state transition: new -> approved');
    });

    it('should reject new -> executed', () => {
      expect(() => {
        transitionState(OpportunityState.new, OpportunityState.executed);
      }).toThrow('Invalid state transition: new -> executed');
    });

    it('should reject new -> resolved', () => {
      expect(() => {
        transitionState(OpportunityState.new, OpportunityState.resolved);
      }).toThrow('Invalid state transition: new -> resolved');
    });

    it('should reject viewed -> executed', () => {
      expect(() => {
        transitionState(OpportunityState.viewed, OpportunityState.executed);
      }).toThrow('Invalid state transition: viewed -> executed');
    });

    it('should reject viewed -> resolved', () => {
      expect(() => {
        transitionState(OpportunityState.viewed, OpportunityState.resolved);
      }).toThrow('Invalid state transition: viewed -> resolved');
    });

    it('should reject approved -> expired', () => {
      expect(() => {
        transitionState(OpportunityState.approved, OpportunityState.expired);
      }).toThrow('Invalid state transition: approved -> expired');
    });

    it('should reject approved -> resolved', () => {
      expect(() => {
        transitionState(OpportunityState.approved, OpportunityState.resolved);
      }).toThrow('Invalid state transition: approved -> resolved');
    });

    it('should reject executed -> dismissed', () => {
      expect(() => {
        transitionState(OpportunityState.executed, OpportunityState.dismissed);
      }).toThrow('Invalid state transition: executed -> dismissed');
    });

    it('should reject executed -> expired', () => {
      expect(() => {
        transitionState(OpportunityState.executed, OpportunityState.expired);
      }).toThrow('Invalid state transition: executed -> expired');
    });
  });

  describe('Terminal States', () => {
    it('should mark resolved as terminal state', () => {
      expect(isTerminalState(OpportunityState.resolved)).toBe(true);
      expect(getValidNextStates(OpportunityState.resolved)).toHaveLength(0);
    });

    it('should mark dismissed as terminal state', () => {
      expect(isTerminalState(OpportunityState.dismissed)).toBe(true);
      expect(getValidNextStates(OpportunityState.dismissed)).toHaveLength(0);
    });

    it('should mark expired as terminal state', () => {
      expect(isTerminalState(OpportunityState.expired)).toBe(true);
      expect(getValidNextStates(OpportunityState.expired)).toHaveLength(0);
    });

    it('should reject any transition from resolved', () => {
      expect(() => {
        transitionState(OpportunityState.resolved, OpportunityState.new);
      }).toThrow('Invalid state transition');
    });

    it('should reject any transition from dismissed', () => {
      expect(() => {
        transitionState(OpportunityState.dismissed, OpportunityState.new);
      }).toThrow('Invalid state transition');
    });

    it('should reject any transition from expired', () => {
      expect(() => {
        transitionState(OpportunityState.expired, OpportunityState.new);
      }).toThrow('Invalid state transition');
    });
  });

  describe('All States Coverage', () => {
    it('should have transition rules defined for all states', () => {
      const allStates = Object.values(OpportunityState);

      for (const state of allStates) {
        expect(VALID_TRANSITIONS).toHaveProperty(state);
        expect(Array.isArray(VALID_TRANSITIONS[state])).toBe(true);
      }
    });

    it('should cover all 7 opportunity states', () => {
      const stateCount = Object.keys(OpportunityState).length;
      expect(stateCount).toBe(7);

      // Verify all expected states exist
      expect(OpportunityState.new).toBeDefined();
      expect(OpportunityState.viewed).toBeDefined();
      expect(OpportunityState.approved).toBeDefined();
      expect(OpportunityState.executed).toBeDefined();
      expect(OpportunityState.resolved).toBeDefined();
      expect(OpportunityState.dismissed).toBeDefined();
      expect(OpportunityState.expired).toBeDefined();
    });

    it('should have valid transitions reference only valid states', () => {
      const allStates = Object.values(OpportunityState);

      for (const [currentState, nextStates] of Object.entries(VALID_TRANSITIONS)) {
        expect(allStates).toContain(currentState);

        for (const nextState of nextStates) {
          expect(allStates).toContain(nextState);
        }
      }
    });
  });

  describe('State Transition Paths', () => {
    it('should allow complete happy path: new -> viewed -> approved -> executed -> resolved', () => {
      let state: OpportunityState = OpportunityState.new;

      state = transitionState(state, OpportunityState.viewed);
      expect(state).toBe(OpportunityState.viewed);

      state = transitionState(state, OpportunityState.approved);
      expect(state).toBe(OpportunityState.approved);

      state = transitionState(state, OpportunityState.executed);
      expect(state).toBe(OpportunityState.executed);

      state = transitionState(state, OpportunityState.resolved);
      expect(state).toBe(OpportunityState.resolved);
    });

    it('should allow early dismissal path: new -> dismissed', () => {
      let state: OpportunityState = OpportunityState.new;

      state = transitionState(state, OpportunityState.dismissed);
      expect(state).toBe(OpportunityState.dismissed);
    });

    it('should allow dismissal after viewing: new -> viewed -> dismissed', () => {
      let state: OpportunityState = OpportunityState.new;

      state = transitionState(state, OpportunityState.viewed);
      state = transitionState(state, OpportunityState.dismissed);
      expect(state).toBe(OpportunityState.dismissed);
    });

    it('should allow dismissal after approval: new -> viewed -> approved -> dismissed', () => {
      let state: OpportunityState = OpportunityState.new;

      state = transitionState(state, OpportunityState.viewed);
      state = transitionState(state, OpportunityState.approved);
      state = transitionState(state, OpportunityState.dismissed);
      expect(state).toBe(OpportunityState.dismissed);
    });

    it('should allow expiration at any pre-execution state', () => {
      // From new
      let state1 = transitionState(OpportunityState.new, OpportunityState.expired);
      expect(state1).toBe(OpportunityState.expired);

      // From viewed
      let state2 = transitionState(OpportunityState.viewed, OpportunityState.expired);
      expect(state2).toBe(OpportunityState.expired);
    });
  });

  describe('Edge Cases', () => {
    it('should reject self-transitions for non-terminal states', () => {
      expect(() => {
        transitionState(OpportunityState.new, OpportunityState.new);
      }).toThrow('Invalid state transition');
    });

    it('should reject backwards transitions', () => {
      expect(() => {
        transitionState(OpportunityState.approved, OpportunityState.viewed);
      }).toThrow('Invalid state transition');

      expect(() => {
        transitionState(OpportunityState.executed, OpportunityState.approved);
      }).toThrow('Invalid state transition');
    });

    it('should not allow skipping states in main flow', () => {
      // Cannot skip from viewed to executed
      expect(() => {
        transitionState(OpportunityState.viewed, OpportunityState.executed);
      }).toThrow('Invalid state transition');

      // Cannot skip from approved to resolved
      expect(() => {
        transitionState(OpportunityState.approved, OpportunityState.resolved);
      }).toThrow('Invalid state transition');
    });
  });
});
