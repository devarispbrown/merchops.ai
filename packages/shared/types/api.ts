/**
 * API types for MerchOps
 *
 * Generic response wrappers, error handling, and pagination types
 * for consistent API contracts across the application.
 */

/**
 * Generic API response wrapper
 * Standardizes all API responses with success/error structure
 */
export interface ApiResponse<T = unknown> {
  /** Response success status */
  success: boolean;

  /** Response data (present if success = true) */
  data?: T;

  /** Error information (present if success = false) */
  error?: ApiError;

  /** Response metadata */
  meta?: {
    /** Request timestamp */
    timestamp: string;

    /** Request ID for tracing */
    requestId: string;

    /** API version */
    version?: string;

    /** Additional metadata */
    [key: string]: unknown;
  };
}

/**
 * API error structure
 * Consistent error format for all failures
 */
export interface ApiError {
  /** Error code (for programmatic handling) */
  code: string;

  /** Human-readable error message */
  message: string;

  /** HTTP status code */
  statusCode: number;

  /** Optional detailed error information */
  details?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;

  /** Optional stack trace (only in development) */
  stack?: string;

  /** Optional request ID for debugging */
  requestId?: string;
}

/**
 * Standard API error codes
 */
export enum ApiErrorCode {
  /** Bad request (400) */
  BAD_REQUEST = 'bad_request',

  /** Unauthorized (401) */
  UNAUTHORIZED = 'unauthorized',

  /** Forbidden (403) */
  FORBIDDEN = 'forbidden',

  /** Not found (404) */
  NOT_FOUND = 'not_found',

  /** Conflict (409) */
  CONFLICT = 'conflict',

  /** Validation error (422) */
  VALIDATION_ERROR = 'validation_error',

  /** Rate limit exceeded (429) */
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',

  /** Internal server error (500) */
  INTERNAL_ERROR = 'internal_error',

  /** Service unavailable (503) */
  SERVICE_UNAVAILABLE = 'service_unavailable',

  /** Database error */
  DATABASE_ERROR = 'database_error',

  /** External service error */
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
}

/**
 * Paginated response wrapper
 * For list endpoints with pagination
 */
export interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];

  /** Pagination metadata */
  pagination: {
    /** Total number of items across all pages */
    total: number;

    /** Current page number (1-indexed) */
    page: number;

    /** Items per page */
    pageSize: number;

    /** Total number of pages */
    totalPages: number;

    /** Has previous page */
    hasPrevious: boolean;

    /** Has next page */
    hasNext: boolean;
  };

  /** Optional sorting information */
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Pagination query parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed, default: 1) */
  page?: number;

  /** Items per page (default: 20) */
  pageSize?: number;

  /** Sort field */
  sortBy?: string;

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Cursor-based pagination (for infinite scroll)
 */
export interface CursorPaginatedResponse<T> {
  /** Array of items */
  items: T[];

  /** Pagination metadata */
  pagination: {
    /** Cursor for next page */
    nextCursor: string | null;

    /** Cursor for previous page */
    previousCursor: string | null;

    /** Has more items */
    hasMore: boolean;
  };
}

/**
 * Cursor pagination query parameters
 */
export interface CursorPaginationParams {
  /** Cursor from previous response */
  cursor?: string;

  /** Number of items to fetch */
  limit?: number;

  /** Sort direction */
  direction?: 'forward' | 'backward';
}

/**
 * Validation error detail
 */
export interface ValidationError {
  /** Field name that failed validation */
  field: string;

  /** Validation error message */
  message: string;

  /** Validation rule that failed */
  rule?: string;

  /** Expected value or format */
  expected?: string;

  /** Actual value received */
  received?: unknown;
}

/**
 * Batch operation response
 * For bulk create/update/delete operations
 */
export interface BatchOperationResponse<T> {
  /** Successfully processed items */
  success: T[];

  /** Failed items with errors */
  failed: Array<{
    item: unknown;
    error: ApiError;
  }>;

  /** Summary statistics */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  /** Overall status */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /** Service version */
  version: string;

  /** Check timestamp */
  timestamp: string;

  /** Individual service checks */
  checks: {
    database: {
      status: 'up' | 'down';
      latency?: number;
    };
    redis: {
      status: 'up' | 'down';
      latency?: number;
    };
    shopify: {
      status: 'up' | 'down';
      latency?: number;
    };
  };
}

/**
 * Webhook delivery status
 */
export interface WebhookDeliveryStatus {
  /** Delivery attempt ID */
  id: string;

  /** Webhook topic */
  topic: string;

  /** Delivery status */
  status: 'pending' | 'delivered' | 'failed';

  /** Attempt count */
  attempts: number;

  /** Last attempt timestamp */
  lastAttemptAt: Date;

  /** Next retry timestamp (if applicable) */
  nextRetryAt?: Date;

  /** Error message (if failed) */
  error?: string;
}

/**
 * API rate limit information
 */
export interface RateLimitInfo {
  /** Requests remaining in current window */
  remaining: number;

  /** Total requests allowed per window */
  limit: number;

  /** Window reset timestamp */
  resetAt: Date;

  /** Time until reset (seconds) */
  resetIn: number;
}

/**
 * Export job status
 * For long-running data export operations
 */
export interface ExportJobStatus {
  /** Job ID */
  id: string;

  /** Job status */
  status: 'queued' | 'processing' | 'completed' | 'failed';

  /** Progress percentage (0-100) */
  progress: number;

  /** Download URL (if completed) */
  downloadUrl?: string;

  /** Expiration timestamp for download URL */
  expiresAt?: Date;

  /** Error message (if failed) */
  error?: string;

  /** Job creation timestamp */
  createdAt: Date;

  /** Job completion timestamp */
  completedAt?: Date;
}
