/**
 * Database Client Export
 *
 * Central export point for database access throughout the application
 */

export { prisma, prisma as db, disconnectPrisma } from './client';

// Re-export Prisma types for convenience
export type {
  Workspace,
  User,
  ShopifyConnection,
  ShopifyObjectCache,
  Event,
  Opportunity,
  OpportunityEventLink,
  ActionDraft,
  Execution,
  Outcome,
  AiGeneration,
} from '@prisma/client';

// Re-export enums
export {
  OpportunityState,
  ActionDraftState,
  ExecutionStatus,
  OutcomeType,
  PriorityBucket,
  OperatorIntent,
  ExecutionType,
  ShopifyConnectionStatus,
  EventType,
  EventSource,
} from '@prisma/client';
