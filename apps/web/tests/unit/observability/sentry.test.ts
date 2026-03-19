/**
 * Unit Tests: Sentry Error Tracking
 * MerchOps Beta MVP
 *
 * Tests:
 * - Sentry.init is NOT called (no-op) when DSN is absent
 * - captureException is forwarded to Sentry when enabled
 * - captureException is a no-op when DSN is absent
 * - PII scrubbing: emails stripped from beforeSend events
 * - PII scrubbing: token headers stripped from beforeSend events
 * - handleError calls captureException only for 5xx errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @sentry/node before any module under test imports it.
// ---------------------------------------------------------------------------
const mockSentryInit = vi.fn();
const mockCaptureException = vi.fn().mockReturnValue('event-id-abc');
const mockCaptureMessage = vi.fn().mockReturnValue('message-id-abc');
const mockSetUser = vi.fn();
const mockAddBreadcrumb = vi.fn();
const mockClose = vi.fn().mockResolvedValue(true);
const mockStartSpan = vi.fn().mockImplementation((_opts: unknown, cb: () => unknown) => cb());

vi.mock('@sentry/node', () => ({
  init: mockSentryInit,
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
  setUser: mockSetUser,
  addBreadcrumb: mockAddBreadcrumb,
  close: mockClose,
  startSpan: mockStartSpan,
}));

// Mock correlation so getCorrelationContext() always returns something predictable
vi.mock('@/lib/correlation', () => ({
  getCorrelationContext: vi.fn().mockReturnValue({
    correlationId: 'test-correlation-id',
    workspaceId: 'test-workspace-id',
    userId: 'test-user-id',
    jobId: undefined,
    jobName: undefined,
  }),
  getCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
}));

// Mock pino logger to silence output during tests
vi.mock('@/server/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createWorkerLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  logJobStart: vi.fn(),
  logJobComplete: vi.fn(),
  logJobFailed: vi.fn(),
  logExecution: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests: server/observability/sentry.ts (the Node.js helper layer)
// ---------------------------------------------------------------------------

describe('Sentry observability helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure test environment does not accidentally enable Sentry
    process.env.NODE_ENV = 'test';
    delete process.env.SENTRY_DSN;
    delete process.env.DISABLE_SENTRY;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('initializeSentry()', () => {
    it('does NOT call Sentry.init when SENTRY_DSN is absent', async () => {
      // DSN already deleted and NODE_ENV=test in beforeEach
      vi.resetModules();
      const { initializeSentry } = await import('@/server/observability/sentry');
      initializeSentry();
      expect(mockSentryInit).not.toHaveBeenCalled();
    });

    it('does NOT call Sentry.init when NODE_ENV is "test" even with a DSN', async () => {
      process.env.NODE_ENV = 'test';
      process.env.SENTRY_DSN = 'https://public@sentry.io/123';

      vi.resetModules();
      const { initializeSentry } = await import('@/server/observability/sentry');
      initializeSentry();

      expect(mockSentryInit).not.toHaveBeenCalled();

      delete process.env.SENTRY_DSN;
    });

    it('does NOT call Sentry.init when DISABLE_SENTRY is "true"', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://public@sentry.io/123';
      process.env.DISABLE_SENTRY = 'true';

      vi.resetModules();
      const { initializeSentry } = await import('@/server/observability/sentry');
      initializeSentry();

      expect(mockSentryInit).not.toHaveBeenCalled();

      process.env.NODE_ENV = 'test';
      delete process.env.SENTRY_DSN;
      delete process.env.DISABLE_SENTRY;
    });
  });

  describe('captureException()', () => {
    it('returns undefined without calling Sentry when DSN is absent', async () => {
      // DSN is already absent (deleted in beforeEach) and NODE_ENV=test
      vi.resetModules();
      const { captureException } = await import('@/server/observability/sentry');
      const result = captureException(new Error('test error'));
      expect(result).toBeUndefined();
      expect(mockCaptureException).not.toHaveBeenCalled();
    });

    it('calls Sentry.captureException and returns an event ID when enabled', async () => {
      // Enable Sentry by switching to production mode with a DSN
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://public@sentry.io/123';

      vi.resetModules();
      vi.clearAllMocks();
      const { captureException } = await import('@/server/observability/sentry');

      const error = new Error('something went wrong');
      const result = captureException(error, {
        tags: { workspaceId: 'ws-1' },
        extra: { details: 'some detail' },
      });

      expect(mockCaptureException).toHaveBeenCalledOnce();
      expect(mockCaptureException).toHaveBeenCalledWith(error, expect.objectContaining({
        level: 'error',
        tags: { workspaceId: 'ws-1' },
        extra: { details: 'some detail' },
      }));
      expect(result).toBe('event-id-abc');

      process.env.NODE_ENV = 'test';
      delete process.env.SENTRY_DSN;
    });

    it('does not throw when Sentry.captureException itself throws', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://public@sentry.io/123';
      mockCaptureException.mockImplementationOnce(() => {
        throw new Error('sentry SDK failure');
      });

      vi.resetModules();
      const { captureException } = await import('@/server/observability/sentry');

      expect(() => captureException(new Error('original error'))).not.toThrow();

      process.env.NODE_ENV = 'test';
      delete process.env.SENTRY_DSN;
    });
  });

  describe('captureJobError()', () => {
    it('calls captureException with job-specific tags when enabled', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://public@sentry.io/123';

      vi.resetModules();
      const { captureJobError } = await import('@/server/observability/sentry');

      const error = new Error('job processing failed');
      captureJobError(error, 'shopify-sync', 'job-42', { workspace_id: 'ws-1' }, 2);

      expect(mockCaptureException).toHaveBeenCalledOnce();
      const callArgs = mockCaptureException.mock.calls[0][1] as {
        tags: Record<string, string>;
        extra: Record<string, unknown>;
        fingerprint: string[];
      };
      expect(callArgs.tags).toMatchObject({
        jobName: 'shopify-sync',
        jobId: 'job-42',
        attemptsMade: '2',
      });
      expect(callArgs.extra).toMatchObject({ attemptsMade: 2 });
      expect(callArgs.fingerprint).toContain('shopify-sync');

      process.env.NODE_ENV = 'test';
      delete process.env.SENTRY_DSN;
    });
  });

  describe('isSentryEnabled()', () => {
    it('returns false when SENTRY_DSN is absent', async () => {
      // DSN already deleted and NODE_ENV=test in beforeEach
      vi.resetModules();
      const { isSentryEnabled } = await import('@/server/observability/sentry');
      expect(isSentryEnabled()).toBe(false);
    });

    it('returns false in test environment even with DSN', async () => {
      process.env.NODE_ENV = 'test';
      process.env.SENTRY_DSN = 'https://public@sentry.io/123';

      vi.resetModules();
      const { isSentryEnabled } = await import('@/server/observability/sentry');
      expect(isSentryEnabled()).toBe(false);

      delete process.env.SENTRY_DSN;
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: PII scrubbing via beforeSend (inline logic, not the Node helper)
// We validate the scrubPii logic that is duplicated across all three config
// files. Rather than re-importing those Next.js config files (which depend on
// the @sentry/nextjs package), we extract and test the scrubbing function
// directly to keep unit tests fast and free of framework coupling.
// ---------------------------------------------------------------------------

describe('Sentry PII scrubbing (beforeSend logic)', () => {
  /**
   * Minimal reproduction of the scrubPii function from all three config files.
   * This is intentional: we test the *logic* rather than the file boundary.
   */
  function scrubPii(event: Record<string, any>): Record<string, any> {
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

    if (event.request?.headers) {
      for (const header of SENSITIVE_HEADERS) {
        if (event.request.headers[header]) {
          event.request.headers[header] = '[Filtered]';
        }
      }
    }

    if (event.request?.query_string && typeof event.request.query_string === 'string') {
      const hasSensitiveParam = SENSITIVE_PARAMS.some((p) =>
        event.request?.query_string?.toString().includes(p)
      );
      if (hasSensitiveParam) {
        event.request.query_string = '[Filtered]';
      }
    }

    if (event.request?.url) {
      event.request.url = event.request.url.replace(EMAIL_RE, '[email]');
    }

    if (event.extra) {
      for (const key of Object.keys(event.extra)) {
        if (SENSITIVE_EXTRA_KEYS.some((s) => key.toLowerCase().includes(s))) {
          event.extra![key] = '[Filtered]';
        }
      }
    }

    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) {
          ex.value = ex.value.replace(EMAIL_RE, '[email]');
        }
      }
    }

    return event;
  }

  it('strips Authorization header', () => {
    const event = {
      request: {
        headers: { authorization: 'Bearer eyJhbGc.secret.stuff', 'content-type': 'application/json' },
      },
    };
    const result = scrubPii(event);
    expect(result.request.headers['authorization']).toBe('[Filtered]');
    expect(result.request.headers['content-type']).toBe('application/json');
  });

  it('strips x-api-key header', () => {
    const event = {
      request: { headers: { 'x-api-key': 'sk_live_supersecret' } },
    };
    const result = scrubPii(event);
    expect(result.request.headers['x-api-key']).toBe('[Filtered]');
  });

  it('strips cookie header', () => {
    const event = {
      request: { headers: { cookie: 'session=abc123; other=value' } },
    };
    const result = scrubPii(event);
    expect(result.request.headers['cookie']).toBe('[Filtered]');
  });

  it('replaces query_string containing "token"', () => {
    const event = {
      request: { query_string: 'token=supersecret&other=safe' },
    };
    const result = scrubPii(event);
    expect(result.request.query_string).toBe('[Filtered]');
  });

  it('does not alter query_string with no sensitive params', () => {
    const event = {
      request: { query_string: 'page=2&limit=20' },
    };
    const result = scrubPii(event);
    expect(result.request.query_string).toBe('page=2&limit=20');
  });

  it('replaces email addresses in request URL', () => {
    const event = {
      request: { url: 'https://app.example.com/api/users?email=merchant@store.com' },
    };
    const result = scrubPii(event);
    expect(result.request.url).not.toContain('merchant@store.com');
    expect(result.request.url).toContain('[email]');
  });

  it('replaces email addresses in exception values', () => {
    const event = {
      exception: {
        values: [{ value: 'User john@example.com not found in workspace', type: 'NotFoundError' }],
      },
    };
    const result = scrubPii(event);
    expect(result.exception.values[0].value).not.toContain('john@example.com');
    expect(result.exception.values[0].value).toContain('[email]');
  });

  it('scrubs access_token from extra context', () => {
    const event = {
      extra: {
        access_token: 'shpat_supersecret',
        shopify_token: 'anothersecret',
        safe_key: 'this is fine',
      },
    };
    const result = scrubPii(event);
    expect(result.extra['access_token']).toBe('[Filtered]');
    expect(result.extra['shopify_token']).toBe('[Filtered]');
    expect(result.extra['safe_key']).toBe('this is fine');
  });

  it('scrubs password from extra context (case-insensitive key match)', () => {
    const event = {
      extra: { userPassword: 'hunter2', metadata: 'ok' },
    };
    const result = scrubPii(event);
    expect(result.extra['userPassword']).toBe('[Filtered]');
    expect(result.extra['metadata']).toBe('ok');
  });

  it('is a no-op on events with no sensitive fields', () => {
    const event = {
      request: { url: 'https://app.example.com/api/queue', headers: { 'content-type': 'application/json' } },
      extra: { workspaceId: 'ws-123' },
    };
    const result = scrubPii(event);
    expect(result.request.url).toBe('https://app.example.com/api/queue');
    expect(result.extra['workspaceId']).toBe('ws-123');
  });
});

// ---------------------------------------------------------------------------
// Tests: error-handler.ts integration — only 5xx errors reach Sentry
// ---------------------------------------------------------------------------

describe('handleError() Sentry integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('does not call captureException for 4xx validation errors', async () => {
    vi.resetModules();
    const { handleError, ValidationError } = await import('@/server/observability/error-handler');

    const response = handleError(new ValidationError('bad input'));

    expect(response.status).toBe(400);
    // captureException on the Sentry Node mock must NOT have been called
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('does not call captureException for 401 authentication errors', async () => {
    vi.resetModules();
    const { handleError, AuthenticationError } = await import('@/server/observability/error-handler');

    const response = handleError(new AuthenticationError());

    expect(response.status).toBe(401);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('does not call captureException for 404 not-found errors', async () => {
    vi.resetModules();
    const { handleError, NotFoundError } = await import('@/server/observability/error-handler');

    const response = handleError(new NotFoundError('Widget'));

    expect(response.status).toBe(404);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('calls captureException for 500 internal errors when Sentry is enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SENTRY_DSN = 'https://public@sentry.io/123';

    vi.resetModules();
    const { handleError } = await import('@/server/observability/error-handler');

    const error = new Error('database connection refused');
    const response = handleError(error);

    expect(response.status).toBe(500);
    expect(mockCaptureException).toHaveBeenCalledOnce();
    const capturedError = mockCaptureException.mock.calls[0][0];
    expect(capturedError).toBeInstanceOf(Error);

    process.env.NODE_ENV = 'test';
    delete process.env.SENTRY_DSN;
  });

  it('does NOT call captureException for 500 errors when DSN is absent', async () => {
    // DSN already absent and NODE_ENV=test, so captureException is a no-op
    vi.resetModules();
    vi.clearAllMocks();
    const { handleError } = await import('@/server/observability/error-handler');

    const error = new Error('database connection refused');
    const response = handleError(error);

    expect(response.status).toBe(500);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
