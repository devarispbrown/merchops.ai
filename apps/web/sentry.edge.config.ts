import * as Sentry from '@sentry/nextjs';

/**
 * Strip PII from a Sentry event before it leaves the edge runtime.
 *
 * Rules:
 * - Email addresses are replaced with [email]
 * - Authorization / token headers are replaced with [Filtered]
 * - Query-string parameters that look like secrets are replaced with [Filtered]
 * - Known-sensitive keys inside `extra` are replaced with [Filtered]
 */
function scrubPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  const SENSITIVE_PARAMS = ['token', 'api_key', 'secret', 'password', 'access_token'];
  const SENSITIVE_EXTRA_KEYS = [
    'password',
    'token',
    'secret',
    'api_key',
    'access_token',
    'refresh_token',
    'shopify_token',
  ];

  // Scrub request headers
  if (event.request?.headers) {
    for (const header of SENSITIVE_HEADERS) {
      if (event.request.headers[header]) {
        event.request.headers[header] = '[Filtered]';
      }
    }
  }

  // Scrub sensitive query parameters
  if (event.request?.query_string && typeof event.request.query_string === 'string') {
    const hasSensitiveParam = SENSITIVE_PARAMS.some((p) =>
      event.request?.query_string?.toString().includes(p)
    );
    if (hasSensitiveParam) {
      event.request.query_string = '[Filtered]';
    }
  }

  // Scrub email addresses from the request URL
  if (event.request?.url) {
    event.request.url = event.request.url.replace(EMAIL_RE, '[email]');
  }

  // Scrub known-sensitive keys from extra context
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (SENSITIVE_EXTRA_KEYS.some((s) => key.toLowerCase().includes(s))) {
        event.extra![key] = '[Filtered]';
      }
    }
  }

  // Scrub email addresses from the exception value (error message text)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) {
        ex.value = ex.value.replace(EMAIL_RE, '[email]');
      }
    }
  }

  return event;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Debug mode in development
  debug: false,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable when DSN is explicitly provided — complete no-op otherwise.
  enabled: !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  beforeSend(event) {
    return scrubPii(event as Sentry.ErrorEvent);
  },
});
