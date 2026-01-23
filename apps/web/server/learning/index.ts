/**
 * Learning Loop Module
 *
 * Public API exports for the MerchOps learning system
 */

// Types
export {
  OutcomeType,
  type OutcomeEvidence,
  type ConfidenceScore,
  type TrackRecord,
  type OutcomeComputationInput,
  type OutcomeComputationResult,
  type ComparisonWindow,
  type ObservationWindow,
  toPrismaOutcomeType,
  fromPrismaOutcomeType,
} from './types';

// Outcome computation
export {
  computeOutcome,
  isExecutionReadyForOutcome,
} from './outcomes/compute';

// Confidence scoring
export {
  calculateConfidence,
  calculateAllConfidenceScores,
  getConfidenceLevel,
  getConfidenceExplanation,
} from './confidence';

// Queries
export {
  getOutcomeForExecution,
  getOutcomesForWorkspace,
  getRecentTrackRecord,
  getExecutionsReadyForOutcome,
  getOutcomeStatistics,
} from './queries';

// Resolvers (for advanced usage)
export { DiscountOutcomeResolver } from './outcomes/resolvers/discount';
export { WinbackOutcomeResolver } from './outcomes/resolvers/winback';
export { PauseProductOutcomeResolver } from './outcomes/resolvers/pause';
