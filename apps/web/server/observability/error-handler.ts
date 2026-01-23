/**
 * Global Error Handler
 *
 * Provides centralized error handling with:
 * - Error classification
 * - User-friendly error messages
 * - Sentry integration (when configured)
 * - Correlation ID propagation
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';
import { getCorrelationId } from '../../lib/correlation';
import { Prisma } from '@prisma/client';

/**
 * Error types for classification
 */
export enum ErrorType {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  RATE_LIMIT = 'rate_limit',
  EXTERNAL_SERVICE = 'external_service',
  DATABASE = 'database',
  INTERNAL = 'internal',
}

/**
 * Application error with classification
 */
export class AppError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public statusCode: number = 500,
    public userMessage?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorType.VALIDATION, message, 400, 'Invalid input provided', details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(
      ErrorType.AUTHENTICATION,
      message,
      401,
      'You must be logged in to access this resource'
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(
      ErrorType.AUTHORIZATION,
      message,
      403,
      'You do not have permission to access this resource'
    );
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(
      ErrorType.NOT_FOUND,
      `${resource} not found`,
      404,
      `The requested ${resource.toLowerCase()} could not be found`
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorType.CONFLICT, message, 409, 'A conflict occurred', details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      ErrorType.RATE_LIMIT,
      'Rate limit exceeded',
      429,
      'Too many requests. Please try again later.',
      { retryAfter }
    );
    this.name = 'RateLimitError';
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(
      ErrorType.EXTERNAL_SERVICE,
      `${service}: ${message}`,
      502,
      'An external service is temporarily unavailable. Please try again later.'
    );
    this.name = 'ExternalServiceError';
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      ErrorType.DATABASE,
      message,
      500,
      'A database error occurred',
      details
    );
    this.name = 'DatabaseError';
  }
}

/**
 * Classify an unknown error
 */
function classifyError(error: unknown): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new ConflictError('A record with this value already exists', {
          field: error.meta?.target,
        });
      case 'P2025':
        return new NotFoundError('Record');
      case 'P2003':
        return new ValidationError('Invalid reference to related record');
      default:
        return new DatabaseError(error.message, { code: error.code });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError('Invalid data provided to database');
  }

  // Standard Error
  if (error instanceof Error) {
    return new AppError(
      ErrorType.INTERNAL,
      error.message,
      500,
      'An unexpected error occurred'
    );
  }

  // Unknown error type
  return new AppError(
    ErrorType.INTERNAL,
    'An unknown error occurred',
    500,
    'An unexpected error occurred'
  );
}

/**
 * Error response format
 */
interface ErrorResponse {
  error: {
    type: ErrorType;
    message: string;
    correlationId: string;
    details?: Record<string, any>;
  };
}

/**
 * Handle error and return Next.js response
 *
 * Usage in API routes:
 * ```ts
 * try {
 *   // Your code
 * } catch (error) {
 *   return handleError(error);
 * }
 * ```
 */
export function handleError(error: unknown): NextResponse<ErrorResponse> {
  const appError = classifyError(error);
  const correlationId = getCorrelationId();

  // Log error
  logger.error(
    {
      correlationId,
      errorType: appError.type,
      statusCode: appError.statusCode,
      error: {
        message: appError.message,
        stack: appError.stack,
        name: appError.name,
      },
      details: appError.details,
    },
    `Error: ${appError.message}`
  );

  // Send to Sentry if configured
  if (process.env.SENTRY_DSN && appError.statusCode >= 500) {
    // TODO: Integrate with Sentry
    // captureException(appError, { contexts: { correlation: { correlationId } } });
  }

  // Return error response
  const response: ErrorResponse = {
    error: {
      type: appError.type,
      message: appError.userMessage || appError.message,
      correlationId,
      ...(appError.details && { details: appError.details }),
    },
  };

  return NextResponse.json(response, {
    status: appError.statusCode,
    headers: {
      'X-Correlation-ID': correlationId,
    },
  });
}

/**
 * Async error wrapper for API route handlers
 *
 * Usage:
 * ```ts
 * export const GET = asyncHandler(async (req) => {
 *   // Your code that might throw
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function asyncHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * Assert a condition or throw an error
 */
export function assert(
  condition: boolean,
  error: AppError | string
): asserts condition {
  if (!condition) {
    if (typeof error === 'string') {
      throw new AppError(ErrorType.INTERNAL, error);
    }
    throw error;
  }
}

/**
 * Assert a value is not null/undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  error: AppError | string
): asserts value is T {
  if (value === null || value === undefined) {
    if (typeof error === 'string') {
      throw new NotFoundError(error);
    }
    throw error;
  }
}
