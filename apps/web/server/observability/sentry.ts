/**
 * Sentry Error Tracking
 *
 * Initializes Sentry for error tracking with context injection,
 * fingerprinting, and environment-specific configuration.
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { getCorrelationContext } from '../../lib/correlation';
import { logger } from './logger';

/**
 * Check if Sentry is enabled
 */
const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED =
  !!SENTRY_DSN &&
  process.env.NODE_ENV !== 'test' &&
  process.env.DISABLE_SENTRY !== 'true';

/**
 * Sentry environment configuration
 */
const SENTRY_ENVIRONMENT =
  process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';

const SENTRY_RELEASE = process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA;

/**
 * Initialize Sentry
 */
export function initializeSentry(): void {
  if (!SENTRY_ENABLED) {
    logger.info('Sentry is disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,

      // Sampling rates
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Integrations
      integrations: [
        nodeProfilingIntegration(),
      ],

      // Before send hook - inject correlation context and filter PII
      beforeSend(event, _hint) {
        // Inject correlation context
        const context = getCorrelationContext();
        if (context) {
          event.contexts = {
            ...event.contexts,
            correlation: {
              correlationId: context.correlationId,
              workspaceId: context.workspaceId,
              userId: context.userId,
              jobId: context.jobId,
              jobName: context.jobName,
            },
          };

          // Add as tags for better filtering
          event.tags = {
            ...event.tags,
            correlationId: context.correlationId,
            ...(context.workspaceId && { workspaceId: context.workspaceId }),
            ...(context.jobName && { jobName: context.jobName }),
          };
        }

        // Filter out sensitive data
        const filteredEvent = filterSensitiveData(event as Sentry.ErrorEvent);

        return filteredEvent;
      },

      // Before breadcrumb hook - filter sensitive breadcrumbs
      beforeBreadcrumb(breadcrumb) {
        // Don't send breadcrumbs with sensitive data
        if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
          return null;
        }

        return breadcrumb;
      },

      // Ignore certain errors
      ignoreErrors: [
        // Browser errors that don't affect functionality
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        // Network errors
        'NetworkError',
        'Failed to fetch',
        // Aborted requests
        'AbortError',
        'The operation was aborted',
      ],
    });

    logger.info(
      {
        environment: SENTRY_ENVIRONMENT,
        release: SENTRY_RELEASE,
      },
      'Sentry initialized'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Sentry');
  }
}

/**
 * Filter sensitive data from Sentry events
 */
function filterSensitiveData(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // Filter request data
  if (event.request) {
    // Remove sensitive headers
    if (event.request.headers) {
      const sensitiveHeaders = [
        'authorization',
        'cookie',
        'x-api-key',
        'x-auth-token',
      ];
      sensitiveHeaders.forEach((header) => {
        if (event.request?.headers?.[header]) {
          event.request.headers[header] = '[Filtered]';
        }
      });
    }

    // Remove query string with tokens
    if (event.request.query_string && typeof event.request.query_string === 'string') {
      const sensitiveParams = ['token', 'api_key', 'secret', 'password'];
      const hassensitiveParam = sensitiveParams.some((param) =>
        event.request?.query_string?.toString().includes(param)
      );
      if (hassensitiveParam) {
        event.request.query_string = '[Filtered]';
      }
    }
  }

  // Filter extra data
  if (event.extra) {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'api_key',
      'access_token',
      'refresh_token',
      'shopify_token',
    ];

    Object.keys(event.extra).forEach((key) => {
      if (
        sensitiveKeys.some((sensitive) =>
          key.toLowerCase().includes(sensitive)
        )
      ) {
        event.extra![key] = '[Filtered]';
      }
    });
  }

  return event;
}

/**
 * Capture an exception with context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    fingerprint?: string[];
  }
): string | undefined {
  if (!SENTRY_ENABLED) {
    return undefined;
  }

  try {
    return Sentry.captureException(error, {
      level: context?.level || 'error',
      tags: context?.tags,
      extra: context?.extra,
      fingerprint: context?.fingerprint,
    });
  } catch (captureError) {
    logger.error({ error: captureError }, 'Failed to capture exception in Sentry');
    return undefined;
  }
}

/**
 * Capture a message with context
 */
export function captureMessage(
  message: string,
  context?: {
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
): string | undefined {
  if (!SENTRY_ENABLED) {
    return undefined;
  }

  try {
    return Sentry.captureMessage(message, {
      level: context?.level || 'info',
      tags: context?.tags,
      extra: context?.extra,
    });
  } catch (captureError) {
    logger.error({ error: captureError }, 'Failed to capture message in Sentry');
    return undefined;
  }
}

/**
 * Set user context
 */
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
}): void {
  if (!SENTRY_ENABLED) {
    return;
  }

  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!SENTRY_ENABLED) {
    return;
  }

  Sentry.setUser(null);
}

/**
 * Add breadcrumb for tracing
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}): void {
  if (!SENTRY_ENABLED) {
    return;
  }

  Sentry.addBreadcrumb({
    message: breadcrumb.message,
    category: breadcrumb.category || 'custom',
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Capture job error with specialized context
 */
export function captureJobError(
  error: Error,
  jobName: string,
  jobId: string,
  data: any,
  attemptsMade: number
): string | undefined {
  return captureException(error, {
    level: 'error',
    tags: {
      jobName,
      jobId,
      attemptsMade: attemptsMade.toString(),
    },
    extra: {
      jobData: data,
      attemptsMade,
    },
    fingerprint: ['{{ default }}', jobName, error.message],
  });
}

/**
 * Capture execution error with specialized context
 */
export function captureExecutionError(
  error: Error,
  executionId: string,
  actionType: string,
  workspaceId: string,
  payload: any
): string | undefined {
  return captureException(error, {
    level: 'error',
    tags: {
      executionId,
      actionType,
      workspaceId,
    },
    extra: {
      executionPayload: payload,
    },
    fingerprint: ['{{ default }}', 'execution', actionType, error.message],
  });
}

/**
 * Capture Shopify API error with specialized context
 */
export function captureShopifyError(
  error: Error,
  endpoint: string,
  method: string,
  workspaceId: string
): string | undefined {
  return captureException(error, {
    level: 'error',
    tags: {
      shopifyEndpoint: endpoint,
      shopifyMethod: method,
      workspaceId,
    },
    fingerprint: ['{{ default }}', 'shopify', endpoint, error.message],
  });
}

/**
 * Start a span for performance monitoring
 * In Sentry v10, use startSpan with a callback or startSpanManual for manual control
 */
export function startSpan<T>(
  name: string,
  op: string,
  callback: () => T | Promise<T>
): T | Promise<T> | undefined {
  if (!SENTRY_ENABLED) {
    return callback();
  }

  return Sentry.startSpan(
    {
      name,
      op,
    },
    callback
  );
}

/**
 * Flush Sentry events (useful before shutdown)
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!SENTRY_ENABLED) {
    return true;
  }

  try {
    return await Sentry.close(timeout);
  } catch (error) {
    logger.error({ error }, 'Failed to flush Sentry');
    return false;
  }
}

/**
 * Check if Sentry is initialized and enabled
 */
export function isSentryEnabled(): boolean {
  return SENTRY_ENABLED;
}
