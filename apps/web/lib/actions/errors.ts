/**
 * Server Action Error Handling
 *
 * Defines error types, codes, and user-friendly messaging for server actions.
 * Ensures consistent error handling across all actions.
 */

import { logger } from '@/server/observability/logger';

/**
 * Error codes for server actions
 * Organized by category for easy identification
 */
export const ActionErrorCode = {
  // Authentication errors (1xxx)
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_SESSION: 'INVALID_SESSION',

  // Validation errors (2xxx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // Resource errors (3xxx)
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',

  // Business logic errors (4xxx)
  INVALID_STATE: 'INVALID_STATE',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',

  // External service errors (5xxx)
  SHOPIFY_ERROR: 'SHOPIFY_ERROR',
  SHOPIFY_RATE_LIMIT: 'SHOPIFY_RATE_LIMIT',
  SHOPIFY_DISCONNECTED: 'SHOPIFY_DISCONNECTED',
  EMAIL_PROVIDER_ERROR: 'EMAIL_PROVIDER_ERROR',

  // System errors (6xxx)
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ActionErrorCode = typeof ActionErrorCode[keyof typeof ActionErrorCode];

/**
 * Custom error class for server actions
 * Provides structured error information for client handling
 */
export class ActionError extends Error {
  public readonly code: ActionErrorCode;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly details?: Record<string, unknown>;
  public readonly retryable: boolean;

  constructor(
    code: ActionErrorCode,
    message: string,
    options?: {
      userMessage?: string;
      statusCode?: number;
      details?: Record<string, unknown>;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'ActionError';
    this.code = code;
    this.statusCode = options?.statusCode ?? 500;
    this.userMessage = options?.userMessage ?? message;
    this.details = options?.details;
    this.retryable = options?.retryable ?? false;

    if (options?.cause) {
      this.cause = options.cause;
    }

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON-serializable format for client
   */
  toJSON() {
    return {
      code: this.code,
      message: this.userMessage,
      details: this.details,
      retryable: this.retryable,
    };
  }

  /**
   * Log error with appropriate level
   */
  log() {
    const logData = {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      retryable: this.retryable,
      details: this.details,
      stack: this.stack,
    };

    if (this.statusCode >= 500) {
      logger.error(logData, `Action error: ${this.code}`);
    } else {
      logger.warn(logData, `Action error: ${this.code}`);
    }
  }
}

/**
 * User-friendly error messages
 */
export const ErrorMessages = {
  // Authentication
  UNAUTHENTICATED: 'You must be signed in to perform this action.',
  UNAUTHORIZED: 'You do not have permission to perform this action.',
  INVALID_SESSION: 'Your session has expired. Please sign in again.',

  // Validation
  VALIDATION_ERROR: 'The information provided is invalid. Please check your input and try again.',
  INVALID_INPUT: 'Some of the information you provided is not valid.',
  MISSING_FIELD: 'Required information is missing.',

  // Resources
  NOT_FOUND: 'The requested item could not be found.',
  ALREADY_EXISTS: 'This item already exists.',
  RESOURCE_LOCKED: 'This item is currently being processed and cannot be modified.',

  // Business logic
  INVALID_STATE: 'This action cannot be performed in the current state.',
  OPERATION_NOT_ALLOWED: 'This operation is not allowed.',
  PRECONDITION_FAILED: 'The conditions required for this action are not met.',

  // External services
  SHOPIFY_ERROR: 'There was an error communicating with Shopify. Please try again.',
  SHOPIFY_RATE_LIMIT: 'Too many requests to Shopify. Please wait a moment and try again.',
  SHOPIFY_DISCONNECTED: 'Your Shopify store is not connected. Please reconnect in settings.',
  EMAIL_PROVIDER_ERROR: 'There was an error sending the email. Please try again.',

  // System
  DATABASE_ERROR: 'A database error occurred. Please try again.',
  NETWORK_ERROR: 'A network error occurred. Please check your connection and try again.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again or contact support.',
  TIMEOUT: 'The request timed out. Please try again.',
} as const;

/**
 * Factory functions for common errors
 */
export const ActionErrors = {
  unauthenticated: (message?: string) =>
    new ActionError(ActionErrorCode.UNAUTHENTICATED, message ?? 'Not authenticated', {
      userMessage: ErrorMessages.UNAUTHENTICATED,
      statusCode: 401,
    }),

  unauthorized: (message?: string) =>
    new ActionError(ActionErrorCode.UNAUTHORIZED, message ?? 'Not authorized', {
      userMessage: ErrorMessages.UNAUTHORIZED,
      statusCode: 403,
    }),

  invalidSession: () =>
    new ActionError(ActionErrorCode.INVALID_SESSION, 'Invalid session', {
      userMessage: ErrorMessages.INVALID_SESSION,
      statusCode: 401,
    }),

  validationError: (message: string, details?: Record<string, unknown>) =>
    new ActionError(ActionErrorCode.VALIDATION_ERROR, message, {
      userMessage: ErrorMessages.VALIDATION_ERROR,
      statusCode: 400,
      details,
    }),

  notFound: (resource: string) =>
    new ActionError(ActionErrorCode.NOT_FOUND, `${resource} not found`, {
      userMessage: ErrorMessages.NOT_FOUND,
      statusCode: 404,
    }),

  alreadyExists: (resource: string) =>
    new ActionError(ActionErrorCode.ALREADY_EXISTS, `${resource} already exists`, {
      userMessage: ErrorMessages.ALREADY_EXISTS,
      statusCode: 409,
    }),

  invalidState: (message: string) =>
    new ActionError(ActionErrorCode.INVALID_STATE, message, {
      userMessage: ErrorMessages.INVALID_STATE,
      statusCode: 400,
    }),

  operationNotAllowed: (message: string) =>
    new ActionError(ActionErrorCode.OPERATION_NOT_ALLOWED, message, {
      userMessage: ErrorMessages.OPERATION_NOT_ALLOWED,
      statusCode: 403,
    }),

  shopifyError: (message: string, retryable = true) =>
    new ActionError(ActionErrorCode.SHOPIFY_ERROR, message, {
      userMessage: ErrorMessages.SHOPIFY_ERROR,
      statusCode: 502,
      retryable,
    }),

  shopifyRateLimit: () =>
    new ActionError(ActionErrorCode.SHOPIFY_RATE_LIMIT, 'Shopify rate limit exceeded', {
      userMessage: ErrorMessages.SHOPIFY_RATE_LIMIT,
      statusCode: 429,
      retryable: true,
    }),

  shopifyDisconnected: () =>
    new ActionError(ActionErrorCode.SHOPIFY_DISCONNECTED, 'Shopify connection not active', {
      userMessage: ErrorMessages.SHOPIFY_DISCONNECTED,
      statusCode: 400,
    }),

  databaseError: (message: string, cause?: Error) =>
    new ActionError(ActionErrorCode.DATABASE_ERROR, message, {
      userMessage: ErrorMessages.DATABASE_ERROR,
      statusCode: 500,
      retryable: true,
      cause,
    }),

  internalError: (message: string, cause?: Error) =>
    new ActionError(ActionErrorCode.INTERNAL_ERROR, message, {
      userMessage: ErrorMessages.INTERNAL_ERROR,
      statusCode: 500,
      retryable: false,
      cause,
    }),
};

/**
 * Standard action response types
 */
export type ActionSuccessResponse<T = void> = {
  success: true;
  data: T;
};

export type ActionErrorResponse = {
  success: false;
  error: {
    code: ActionErrorCode;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
  };
};

export type ActionResponse<T = void> = ActionSuccessResponse<T> | ActionErrorResponse;

/**
 * Helper to create success response
 */
export function actionSuccess<T>(data: T): ActionSuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Helper to create error response
 */
export function actionError(error: ActionError): ActionErrorResponse {
  // Log the error
  error.log();

  return {
    success: false,
    error: {
      code: error.code,
      message: error.userMessage,
      details: error.details,
      retryable: error.retryable,
    },
  };
}

/**
 * Helper to handle unknown errors
 */
export function handleUnknownError(error: unknown): ActionErrorResponse {
  if (error instanceof ActionError) {
    return actionError(error);
  }

  // Log unexpected error
  logger.error({ error }, 'Unexpected error in action');

  // Create generic internal error
  const actionErr = ActionErrors.internalError(
    'An unexpected error occurred',
    error instanceof Error ? error : undefined
  );

  return actionError(actionErr);
}
