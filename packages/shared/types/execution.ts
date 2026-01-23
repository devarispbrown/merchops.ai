/**
 * Execution types for MerchOps
 *
 * Executions are immutable logs of approved actions.
 * All executions are idempotent and include retry logic.
 */

/**
 * Execution status enumeration
 */
export enum ExecutionStatus {
  /** Execution queued, not yet started */
  QUEUED = 'queued',

  /** Execution in progress */
  RUNNING = 'running',

  /** Execution completed successfully */
  SUCCESS = 'success',

  /** Execution failed, will retry */
  FAILED_RETRYING = 'failed_retrying',

  /** Execution failed permanently (max retries exhausted) */
  FAILED_PERMANENT = 'failed_permanent',

  /** Execution cancelled by operator */
  CANCELLED = 'cancelled',
}

/**
 * Error classification for failed executions
 */
export enum ExecutionErrorCode {
  /** Shopify API rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',

  /** Shopify API returned error */
  SHOPIFY_API_ERROR = 'shopify_api_error',

  /** Invalid request payload */
  INVALID_PAYLOAD = 'invalid_payload',

  /** Authentication/authorization failed */
  AUTH_FAILED = 'auth_failed',

  /** Resource not found (e.g., product deleted) */
  RESOURCE_NOT_FOUND = 'resource_not_found',

  /** Network timeout */
  TIMEOUT = 'timeout',

  /** Unknown error */
  UNKNOWN_ERROR = 'unknown_error',

  /** Email provider error */
  EMAIL_PROVIDER_ERROR = 'email_provider_error',

  /** Validation error */
  VALIDATION_ERROR = 'validation_error',
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;

  /** Current retry attempt */
  currentAttempt: number;

  /** Backoff strategy: 'exponential' | 'linear' | 'fixed' */
  backoffStrategy: 'exponential' | 'linear' | 'fixed';

  /** Initial delay in milliseconds */
  initialDelayMs: number;

  /** Maximum delay in milliseconds */
  maxDelayMs: number;

  /** Next retry scheduled at (ISO string) */
  nextRetryAt?: string;
}

/**
 * Provider response metadata
 * Captures raw response from Shopify/email provider
 */
export interface ProviderResponse {
  /** HTTP status code */
  statusCode: number;

  /** Response headers */
  headers?: Record<string, string>;

  /** Response body (parsed JSON or raw) */
  body: unknown;

  /** Provider-specific request ID */
  requestId?: string;

  /** Rate limit information */
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

/**
 * Core execution entity
 * Immutable log of action execution
 */
export interface Execution {
  /** Unique execution identifier */
  id: string;

  /** Associated workspace ID */
  workspaceId: string;

  /** Associated action draft ID */
  actionDraftId: string;

  /**
   * Request payload sent to provider
   * Immutable snapshot of what was executed
   */
  requestPayload: Record<string, unknown>;

  /**
   * Provider response (if execution started)
   * Null if execution never reached provider
   */
  providerResponse: ProviderResponse | null;

  /** Execution status */
  status: ExecutionStatus;

  /** Error code (if failed) */
  errorCode: ExecutionErrorCode | null;

  /** Human-readable error message (if failed) */
  errorMessage: string | null;

  /**
   * Idempotency key
   * Prevents duplicate executions
   * Format: "workspace_id:draft_id:payload_hash"
   */
  idempotencyKey: string;

  /** Retry configuration */
  retryConfig: RetryConfig;

  /** Execution start timestamp */
  startedAt: Date | null;

  /** Execution completion timestamp */
  finishedAt: Date | null;

  /** Execution creation timestamp (queued) */
  createdAt: Date;

  /**
   * Correlation ID
   * Links execution across logs and jobs
   */
  correlationId: string;

  /**
   * Optional metadata
   * For debugging, versioning, observability
   */
  metadata?: Record<string, unknown>;
}

/**
 * Execution with action draft context
 */
export interface ExecutionWithDraft extends Execution {
  /** Associated action draft */
  draft: {
    id: string;
    operatorIntent: string;
    executionType: string;
    state: string;
    approvedBy: string | null;
    approvedAt: Date | null;
  };
}

/**
 * Execution with full opportunity context
 */
export interface ExecutionWithOpportunity extends ExecutionWithDraft {
  /** Associated opportunity */
  opportunity: {
    id: string;
    type: string;
    priorityBucket: string;
    whyNow: string;
    state: string;
  };
}

/**
 * Input for creating a new execution
 */
export interface CreateExecutionInput {
  /** Workspace ID (required) */
  workspaceId: string;

  /** Action draft ID (required) */
  actionDraftId: string;

  /** Request payload (required) */
  requestPayload: Record<string, unknown>;

  /** Idempotency key (required) */
  idempotencyKey: string;

  /** Correlation ID (required) */
  correlationId: string;

  /** Retry configuration (optional, uses defaults) */
  retryConfig?: Partial<RetryConfig>;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating execution status
 */
export interface UpdateExecutionInput {
  /** New status */
  status: ExecutionStatus;

  /** Provider response (if execution completed) */
  providerResponse?: ProviderResponse;

  /** Error code (if failed) */
  errorCode?: ExecutionErrorCode;

  /** Error message (if failed) */
  errorMessage?: string;

  /** Finished timestamp (if completed/failed) */
  finishedAt?: Date;

  /** Updated retry config (for retries) */
  retryConfig?: RetryConfig;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Execution query filters
 */
export interface ExecutionQueryFilters {
  /** Filter by workspace ID */
  workspaceId: string;

  /** Filter by action draft IDs */
  actionDraftIds?: string[];

  /** Filter by statuses */
  statuses?: ExecutionStatus[];

  /** Filter by error codes */
  errorCodes?: ExecutionErrorCode[];

  /** Filter executions started after timestamp */
  startedAfter?: Date;

  /** Filter executions finished before timestamp */
  finishedBefore?: Date;

  /** Filter by correlation ID */
  correlationId?: string;

  /** Sort by: 'created_at' | 'started_at' | 'finished_at' */
  sortBy?: 'created_at' | 'started_at' | 'finished_at';

  /** Sort direction: 'asc' | 'desc' */
  sortDirection?: 'asc' | 'desc';

  /** Pagination: limit */
  limit?: number;

  /** Pagination: offset */
  offset?: number;
}

/**
 * Execution statistics
 * For monitoring and debugging
 */
export interface ExecutionStats {
  /** Total executions by status */
  byStatus: Record<ExecutionStatus, number>;

  /** Total executions by error code */
  byErrorCode: Record<ExecutionErrorCode, number>;

  /** Average execution duration (milliseconds) */
  averageDurationMs: number;

  /** Success rate (percentage) */
  successRate: number;

  /** Retry rate (percentage of executions that required retry) */
  retryRate: number;

  /** Total executions in time window */
  totalCount: number;
}

/**
 * Execution timeline event
 * For detailed execution audit trail
 */
export interface ExecutionTimelineEvent {
  /** Event timestamp */
  timestamp: Date;

  /** Event type: 'queued' | 'started' | 'retry' | 'completed' | 'failed' | 'cancelled' */
  type: 'queued' | 'started' | 'retry' | 'completed' | 'failed' | 'cancelled';

  /** Event description */
  description: string;

  /** Optional additional data */
  data?: Record<string, unknown>;
}
