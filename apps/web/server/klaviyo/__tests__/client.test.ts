/**
 * KlaviyoClient Unit Tests
 *
 * Covers:
 *  - Successful API calls (getLists, createList, addProfilesToList, getFlows, createEvent)
 *  - Rate limit handling (429 → retry with backoff)
 *  - Server error retry (5xx)
 *  - Non-retryable error (401/403)
 *  - Retry exhaustion
 *  - KlaviyoApiError propagation
 *  - Batch chunking (100 profiles per request)
 *
 * HTTP calls are intercepted via global fetch mock — no network traffic.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { KlaviyoClient, KlaviyoApiError } from '../client';

// ============================================================================
// GLOBAL FETCH MOCK
// ============================================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// AbortSignal.timeout is used inside the client — stub it
vi.stubGlobal('AbortSignal', {
  timeout: (_ms: number) => ({ aborted: false }),
});

// ============================================================================
// HELPERS
// ============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : String(status),
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
  } as unknown as Response;
}

function errorResponse(status: number, errors: unknown[]): Response {
  return jsonResponse({ errors }, status);
}

/**
 * Run a client operation while simultaneously flushing fake timers.
 * This prevents the "unhandled rejection" noise in Vitest 4 that occurs
 * when a promise rejects inside `vi.runAllTimersAsync()` before we attach
 * the rejection handler.
 */
function run<T>(op: Promise<T>): { promise: Promise<T> } {
  void vi.runAllTimersAsync();
  return { promise: op };
}

// ============================================================================
// TESTS
// ============================================================================

describe('KlaviyoClient', () => {
  const apiKey = 'pk_test_abc123';
  let client: KlaviyoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new KlaviyoClient(apiKey);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // getLists
  // --------------------------------------------------------------------------
  describe('getLists', () => {
    test('returns list resources on success', async () => {
      const listData = [
        { type: 'list', id: 'list-1', attributes: { name: 'Test List', created: '2024-01-01', updated: '2024-01-01' } },
      ];
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: listData }));

      const { promise } = run(client.getLists());
      const result = await promise;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('list-1');
      expect(result[0].attributes.name).toBe('Test List');
    });

    test('includes correct Klaviyo API headers', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

      const { promise } = run(client.getLists());
      await promise;

      const [_url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`Klaviyo-API-Key ${apiKey}`);
      expect(headers['revision']).toBe('2024-02-15');
      expect(headers['Content-Type']).toBe('application/json');
    });

    test('throws KlaviyoApiError on 401', async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(401, [{ detail: 'Authentication failed', status: 401 }])
      );

      const { promise } = run(client.getLists());
      await expect(promise).rejects.toThrow(KlaviyoApiError);
    });

    test('throws KlaviyoApiError with correct status on 403', async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(403, [{ detail: 'Insufficient permissions', status: 403 }])
      );

      const { promise } = run(client.getLists());
      await expect(promise).rejects.toSatisfy((e: unknown) => {
        return e instanceof KlaviyoApiError && e.status === 403;
      });
    });
  });

  // --------------------------------------------------------------------------
  // createList
  // --------------------------------------------------------------------------
  describe('createList', () => {
    test('creates a list and returns the resource', async () => {
      const created = {
        type: 'list',
        id: 'new-list-id',
        attributes: { name: 'My List', created: '2024-01-01', updated: '2024-01-01' },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: created }, 201));

      const { promise } = run(client.createList('My List'));
      const result = await promise;

      expect(result.id).toBe('new-list-id');
      expect(result.attributes.name).toBe('My List');
    });

    test('sends correct JSON:API body', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: { type: 'list', id: 'x', attributes: { name: 'A', created: '', updated: '' } },
        }, 201)
      );

      const { promise } = run(client.createList('A'));
      await promise;

      const [_url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({
        data: {
          type: 'list',
          attributes: { name: 'A' },
        },
      });
    });
  });

  // --------------------------------------------------------------------------
  // addProfilesToList
  // --------------------------------------------------------------------------
  describe('addProfilesToList', () => {
    test('makes no request when profiles array is empty', async () => {
      const { promise } = run(client.addProfilesToList('list-1', []));
      await promise;

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('sends a single request for <= 100 profiles', async () => {
      const profiles = Array.from({ length: 50 }, (_, i) => ({
        email: `user${i}@example.com`,
        first_name: 'User',
        last_name: String(i),
      }));

      mockFetch.mockResolvedValueOnce(jsonResponse(null, 204));

      const { promise } = run(client.addProfilesToList('list-1', profiles));
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/lists/list-1/relationships/profiles/');
    });

    test('batches 250 profiles into 3 requests (100 + 100 + 50)', async () => {
      const profiles = Array.from({ length: 250 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      // Mock 3 successful responses
      mockFetch
        .mockResolvedValueOnce(jsonResponse(null, 204))
        .mockResolvedValueOnce(jsonResponse(null, 204))
        .mockResolvedValueOnce(jsonResponse(null, 204));

      const { promise } = run(client.addProfilesToList('list-1', profiles));
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test('sends correct JSON:API body structure', async () => {
      const profiles = [
        { email: 'a@example.com', first_name: 'Alice', last_name: 'A', properties: { source: 'test' } },
      ];

      mockFetch.mockResolvedValueOnce(jsonResponse(null, 204));

      const { promise } = run(client.addProfilesToList('list-42', profiles));
      await promise;

      const [_url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].type).toBe('profile');
      expect(body.data[0].attributes.email).toBe('a@example.com');
      expect(body.data[0].attributes.first_name).toBe('Alice');
      expect(body.data[0].attributes.properties.source).toBe('test');
    });
  });

  // --------------------------------------------------------------------------
  // Rate limit handling
  // --------------------------------------------------------------------------
  describe('rate limit handling (429)', () => {
    test('retries after 429 and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'content-type': 'application/json', 'Retry-After': '1' }),
          json: async () => ({ errors: [] }),
        } as unknown as Response)
        .mockResolvedValueOnce(jsonResponse({ data: [] }));

      const { promise } = run(client.getLists());
      const result = await promise;

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('throws KlaviyoApiError after exhausting all retries on 429', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ errors: [] }),
      } as unknown as Response);

      const { promise } = run(client.getLists());
      await expect(promise).rejects.toSatisfy((e: unknown) => {
        return e instanceof KlaviyoApiError && e.status === 429;
      });
      // MAX_RETRIES = 4, so 5 total attempts
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  // --------------------------------------------------------------------------
  // Server error retry
  // --------------------------------------------------------------------------
  describe('server error retry (5xx)', () => {
    test('retries on 503 and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ errors: [{ detail: 'Service unavailable' }] }),
        } as unknown as Response)
        .mockResolvedValueOnce(jsonResponse({ data: [] }));

      const { promise } = run(client.getLists());
      const result = await promise;

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // KlaviyoApiError properties
  // --------------------------------------------------------------------------
  describe('KlaviyoApiError', () => {
    test('exposes status and errors array', async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(400, [
          { id: 'e1', status: 400, code: 'bad_field', title: 'Bad field', detail: 'email is invalid' },
        ])
      );

      const { promise } = run(client.createList('x'));
      await expect(promise).rejects.toSatisfy((e: unknown) => {
        if (!(e instanceof KlaviyoApiError)) return false;
        return (
          e.status === 400 &&
          e.errors.length === 1 &&
          (e.errors[0] as { detail: string }).detail === 'email is invalid'
        );
      });
    });
  });

  // --------------------------------------------------------------------------
  // getFlows
  // --------------------------------------------------------------------------
  describe('getFlows', () => {
    test('returns flow resources', async () => {
      const flows = [
        { type: 'flow', id: 'flow-1', attributes: { name: 'Welcome', status: 'live', archived: false, created: '', updated: '' } },
      ];
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: flows }));

      const { promise } = run(client.getFlows());
      const result = await promise;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('flow-1');
    });
  });

  // --------------------------------------------------------------------------
  // createEvent
  // --------------------------------------------------------------------------
  describe('createEvent', () => {
    test('sends event and resolves void on success', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 202));

      const { promise } = run(client.createEvent({
        metric_name: 'Purchased',
        profile_email: 'user@example.com',
        value: 49.99,
        properties: { product: 'Widget' },
      }));
      await expect(promise).resolves.toBeUndefined();
    });
  });
});
