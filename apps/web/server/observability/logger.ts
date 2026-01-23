/**
 * Structured Logger
 *
 * Pino-based structured logging with correlation ID injection,
 * environment-specific log levels, and safe serialization.
 */

import pino from 'pino';
import { getCorrelationContext } from '../../lib/correlation';

// Determine log level based on environment
const LOG_LEVEL = process.env.LOG_LEVEL || getDefaultLogLevel();

function getDefaultLogLevel(): string {
  const env = process.env.NODE_ENV;
  switch (env) {
    case 'production':
      return 'info';
    case 'test':
      return 'silent';
    case 'development':
    default:
      return 'debug';
  }
}

// Pretty print in development
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Custom serializers for common objects
 */
const serializers = {
  error: pino.stdSerializers.err,
  req: pino.stdSerializers.req,
  res: pino.stdSerializers.res,

  // Custom serializer for job objects
  job: (job: any) => ({
    id: job?.id,
    name: job?.name,
    data: job?.data,
    attemptsMade: job?.attemptsMade,
    processedOn: job?.processedOn,
    finishedOn: job?.finishedOn,
  }),

  // Custom serializer for queue objects
  queue: (queue: any) => ({
    name: queue?.name,
  }),
};

/**
 * Base logger configuration
 */
const baseLogger = pino({
  level: LOG_LEVEL,
  serializers,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
    bindings: (bindings) => {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
        env: process.env.NODE_ENV,
      };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDevelopment &&
    !isTest && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
    }),
});

/**
 * Mixin function to inject correlation context into every log
 * This ensures all logs have correlation IDs for distributed tracing
 */
function correlationMixin() {
  const context = getCorrelationContext();
  if (!context) {
    return {};
  }

  return {
    correlationId: context.correlationId,
    workspaceId: context.workspaceId,
    userId: context.userId,
    jobId: context.jobId,
    jobName: context.jobName,
  };
}

/**
 * Create a child logger with correlation context
 */
export const logger = baseLogger.child({});

/**
 * Create a child logger with additional context
 * Useful for scoping logs to specific modules or operations
 */
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Create a logger for a specific job
 * Automatically includes job metadata in all logs
 */
export function createJobLogger(jobId: string, jobName: string, workspaceId?: string) {
  return logger.child({
    jobId,
    jobName,
    workspaceId,
  });
}

/**
 * Create a logger for a specific worker
 * Automatically includes worker metadata in all logs
 */
export function createWorkerLogger(workerName: string) {
  return logger.child({
    worker: workerName,
  });
}

/**
 * Log levels
 */
export const LogLevel = {
  FATAL: 'fatal',
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
} as const;

/**
 * Helper to log job start
 */
export function logJobStart(
  jobId: string,
  jobName: string,
  data: any,
  workspaceId?: string
) {
  const jobLogger = createJobLogger(jobId, jobName, workspaceId);
  jobLogger.info({ data }, `Job started: ${jobName}`);
}

/**
 * Helper to log job completion
 */
export function logJobComplete(
  jobId: string,
  jobName: string,
  result: any,
  durationMs: number,
  workspaceId?: string
) {
  const jobLogger = createJobLogger(jobId, jobName, workspaceId);
  jobLogger.info(
    { result, durationMs },
    `Job completed: ${jobName} (${durationMs}ms)`
  );
}

/**
 * Helper to log job failure
 */
export function logJobFailed(
  jobId: string,
  jobName: string,
  error: Error,
  attemptsMade: number,
  workspaceId?: string
) {
  const jobLogger = createJobLogger(jobId, jobName, workspaceId);
  jobLogger.error(
    {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      attemptsMade,
    },
    `Job failed: ${jobName}`
  );
}

/**
 * Helper to log API calls
 */
export function logApiCall(
  method: string,
  url: string,
  statusCode: number,
  durationMs: number,
  error?: Error
) {
  const level = statusCode >= 500 || error ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  logger[level](
    {
      api: {
        method,
        url,
        statusCode,
        durationMs,
      },
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
        },
      }),
    },
    `API ${method} ${url} - ${statusCode} (${durationMs}ms)`
  );
}

/**
 * Helper to log database queries
 */
export function logDatabaseQuery(
  operation: string,
  table: string,
  durationMs: number,
  error?: Error
) {
  const level = error ? 'error' : durationMs > 1000 ? 'warn' : 'debug';

  logger[level](
    {
      database: {
        operation,
        table,
        durationMs,
      },
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
        },
      }),
    },
    `DB ${operation} ${table} (${durationMs}ms)`
  );
}

/**
 * Helper to log execution events
 */
export function logExecution(
  executionId: string,
  actionType: string,
  status: string,
  workspaceId: string,
  error?: Error
) {
  const level = status === 'failed' || error ? 'error' : 'info';

  logger[level](
    {
      execution: {
        id: executionId,
        actionType,
        status,
      },
      workspaceId,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
        },
      }),
    },
    `Execution ${executionId}: ${actionType} - ${status}`
  );
}

/**
 * Safely stringify objects for logging
 * Handles circular references and large objects
 */
export function safeStringify(obj: unknown, maxLength = 10000): string {
  try {
    const seen = new Set<object>();
    const str = JSON.stringify(obj, (_key, value) => {
      // Remove circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });

    // Truncate if too long
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '... [truncated]';
    }

    return str;
  } catch {
    return '[Unable to stringify]';
  }
}

/**
 * Export for testing
 */
export const __testing__ = {
  getDefaultLogLevel,
  correlationMixin,
};
