/**
 * Observability Module Exports
 *
 * Central exports for all observability utilities.
 */

// Logger
export {
  logger,
  createChildLogger,
  createJobLogger,
  createWorkerLogger,
  logJobStart,
  logJobComplete,
  logJobFailed,
  logApiCall,
  logDatabaseQuery,
  logExecution,
  safeStringify,
  LogLevel,
} from './logger';

// Health checks
export {
  checkDatabaseHealth,
  checkRedisHealth,
  checkShopifyApiHealth,
  getSystemHealth,
  isSystemReady,
  isSystemAlive,
} from './health';

export type {
  HealthCheckResult,
  SystemHealth,
} from './health';

// Request tracing
export {
  withTracing,
  logTiming,
  measureAsync,
  measure,
} from './tracing';

// Error handling
export {
  handleError,
  asyncHandler,
  assert,
  assertExists,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  ErrorType,
} from './error-handler';
