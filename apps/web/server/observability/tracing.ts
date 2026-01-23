/**
 * Request Tracing Middleware
 *
 * Tracks request duration and logs request/response details
 * with correlation IDs for distributed tracing.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
  addCorrelationIdToHeaders,
  runWithCorrelationAsync,
} from '../../lib/correlation';
import { logger } from './logger';

/**
 * Request context for tracing
 */
interface RequestContext {
  method: string;
  url: string;
  correlationId: string;
  startTime: number;
  workspaceId?: string;
  userId?: string;
}

/**
 * Trace a Next.js API route handler
 *
 * Usage:
 * ```ts
 * export const GET = withTracing(async (req) => {
 *   // Your handler code
 * });
 * ```
 */
export function withTracing(
  handler: (
    request: NextRequest,
    context?: { params?: Record<string, string> }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context?: { params?: Record<string, string> }
  ): Promise<NextResponse> => {
    const startTime = Date.now();

    // Extract or generate correlation ID
    const correlationId =
      extractCorrelationIdFromHeaders(request.headers) ??
      generateCorrelationId();

    // Create request context
    const requestContext: RequestContext = {
      method: request.method,
      url: request.url,
      correlationId,
      startTime,
    };

    // Log request start
    logger.info(
      {
        correlationId,
        method: requestContext.method,
        url: requestContext.url,
        headers: sanitizeHeaders(request.headers),
      },
      `→ ${requestContext.method} ${requestContext.url}`
    );

    try {
      // Run handler with correlation context
      const response = await runWithCorrelationAsync(
        { correlationId },
        () => handler(request, context)
      );

      // Calculate duration
      const durationMs = Date.now() - startTime;

      // Log response
      logger.info(
        {
          correlationId,
          method: requestContext.method,
          url: requestContext.url,
          statusCode: response.status,
          durationMs,
        },
        `← ${requestContext.method} ${requestContext.url} ${response.status} (${durationMs}ms)`
      );

      // Add correlation ID to response headers
      const headers = new Headers(response.headers);
      headers.set('X-Correlation-ID', correlationId);

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      // Calculate duration
      const durationMs = Date.now() - startTime;

      // Log error
      logger.error(
        {
          correlationId,
          method: requestContext.method,
          url: requestContext.url,
          durationMs,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : error,
        },
        `✗ ${requestContext.method} ${requestContext.url} failed (${durationMs}ms)`
      );

      // Re-throw to be handled by error handler
      throw error;
    }
  };
}

/**
 * Sanitize request headers for logging
 * Removes sensitive headers like authorization tokens
 */
function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
  ];

  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

/**
 * Log request timing
 * Use this to measure specific operations within a request
 */
export function logTiming(operation: string, durationMs: number) {
  logger.debug(
    {
      operation,
      durationMs,
    },
    `⏱ ${operation} took ${durationMs}ms`
  );
}

/**
 * Measure execution time of an async function
 */
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    logTiming(operation, durationMs);

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    logger.error(
      {
        operation,
        durationMs,
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
      },
      `✗ ${operation} failed after ${durationMs}ms`
    );

    throw error;
  }
}

/**
 * Measure execution time of a synchronous function
 */
export function measure<T>(operation: string, fn: () => T): T {
  const startTime = Date.now();

  try {
    const result = fn();
    const durationMs = Date.now() - startTime;

    logTiming(operation, durationMs);

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    logger.error(
      {
        operation,
        durationMs,
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
      },
      `✗ ${operation} failed after ${durationMs}ms`
    );

    throw error;
  }
}
