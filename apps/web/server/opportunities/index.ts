/**
 * Opportunity Engine
 *
 * Complete opportunity management system for MerchOps.
 *
 * Features:
 * - Deterministic opportunity creation from events
 * - AI-powered or fallback rationale generation
 * - Priority calculation and bucketing
 * - Decay and expiration handling
 * - State machine with validated transitions
 * - Comprehensive querying with filters and pagination
 * - Dismissal with reappearance prevention
 */

// Types
export * from './types';

// Creation
export {
  createOpportunityFromEvents,
  createOpportunitiesBatch,
  findSimilarOpportunity,
  createOpportunityWithDeduplication,
  generateOpportunityExplanations,
} from './create';

// Prioritization
export {
  calculatePriority,
  comparePriority,
} from './prioritize';

// Decay
export {
  getDecayTime,
  getDecayConfig,
  getHoursUntilDecay,
  hasDecayed,
  checkDecay,
  checkAndExpireOpportunity,
  expireStaleOpportunities,
  expireStaleOpportunitiesForWorkspace,
  getDecayStats,
  getOpportunitiesExpiringSoon,
  extendDecayTime,
} from './decay';

// State Machine
export {
  OpportunityStateMachine,
  InvalidStateTransitionError,
  OpportunityNotFoundError,
  transitionState,
  tryTransitionState,
  batchTransitionState,
  markAsViewed,
  markAsApproved,
  markAsExecuted,
  markAsResolved,
  markAsDismissed,
  markAsExpired,
  getStateMachine,
  getOpportunitiesByState,
  countOpportunitiesByState,
} from './state-machine';

// Queries
export {
  getOpportunityById,
  getOpportunityWithEvents,
  getOpportunityWithRelations,
  getOpportunitiesForWorkspace,
  getActiveOpportunities,
  getOpportunitiesByPriority,
  getNewOpportunities,
  searchOpportunities,
  getOpportunityStats,
  getDismissedOpportunityKeys,
  paginateOpportunities,
  type PaginatedResult,
} from './queries';

// Dismissal
export {
  generateDismissKey,
  parseDismissKey,
  dismissOpportunity,
  dismissOpportunitiesBatch,
  isDismissed,
  shouldFilterDismissed,
  undismissOpportunity,
  getDismissalStats,
  getRecentlyDismissed,
} from './dismiss';
