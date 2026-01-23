/**
 * @merchops/shared
 *
 * Shared types, schemas, and utilities for MerchOps application.
 *
 * This package provides strictly-typed TypeScript definitions that match
 * the Prisma schema and ensure type safety across the entire application.
 */

// Export all types
export * from './types';

// Re-export commonly used type utilities
export type {
  // Core entities
  Workspace,
  User,
  ShopifyConnection,
  Event,
  Opportunity,
  ActionDraft,
  Execution,
  Outcome,

  // API types
  ApiResponse,
  ApiError,
  PaginatedResponse,

  // Context types
  UserSession,
  WorkspaceWithUser,
  OpportunityWithEvents,
  ActionDraftWithOpportunity,
  ExecutionWithDraft,
  OutcomeWithExecution,
} from './types';

// Re-export enums for runtime usage
export {
  EventType,
  EventSource,
  OpportunityType,
  PriorityBucket,
  OpportunityState,
  OperatorIntent,
  ExecutionType,
  ActionDraftState,
  ExecutionStatus,
  ExecutionErrorCode,
  OutcomeType,
  EvidenceType,
  ApiErrorCode,
} from './types';

/**
 * Package version
 */
export const VERSION = '0.1.0';

/**
 * Type guards for runtime type checking
 */
import type { ApiError as ApiErrorType, ApiResponse as ApiResponseType } from './types/api';

/**
 * Check if value is an ApiError
 */
export function isApiError(value: unknown): value is ApiErrorType {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'statusCode' in value
  );
}

/**
 * Check if response is successful ApiResponse
 */
export function isSuccessResponse<T>(
  response: ApiResponseType<T>
): response is ApiResponseType<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Check if response is error ApiResponse
 */
export function isErrorResponse<T>(
  response: ApiResponseType<T>
): response is ApiResponseType<T> & { success: false; error: ApiErrorType } {
  return response.success === false && response.error !== undefined;
}

/**
 * Utility type helpers
 */

/**
 * Make specified keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specified keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract enum values as union type
 */
export type EnumValues<T extends Record<string, string>> = T[keyof T];

/**
 * Readonly deep
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Nullable type
 */
export type Nullable<T> = T | null;

/**
 * Optional type (null or undefined)
 */
export type Optional<T> = T | null | undefined;
