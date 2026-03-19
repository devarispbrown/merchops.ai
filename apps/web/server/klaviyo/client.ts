/**
 * Klaviyo API Client
 *
 * Robust client for the Klaviyo v2024-02-15 REST API.
 * Uses JSON:API document format for all requests and responses.
 * Includes token-bucket rate limiting, exponential backoff, and
 * typed responses for every supported endpoint.
 *
 * Base URL: https://a.klaviyo.com
 * Auth header: Authorization: Klaviyo-API-Key {key}
 * Revision: 2024-02-15
 */

import crypto from 'crypto';

// ============================================================================
// CONSTANTS
// ============================================================================

const KLAVIYO_BASE_URL = 'https://a.klaviyo.com';
const KLAVIYO_REVISION = '2024-02-15';

const RATE_LIMIT = {
  GET_MAX_PER_SECOND: 350,
  POST_MAX_PER_SECOND: 75,
  MAX_RETRIES: 4,
  BACKOFF_INITIAL_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
  BACKOFF_MAX_MS: 30_000,
  REQUEST_TIMEOUT_MS: 30_000,
} as const;

const PROFILE_BATCH_SIZE = 100;

// ============================================================================
// TYPES
// ============================================================================

export interface KlaviyoProfile {
  email: string;
  first_name?: string;
  last_name?: string;
  properties?: Record<string, unknown>;
}

// JSON:API document shapes (minimal — only fields we read)

export interface KlaviyoListAttributes {
  name: string;
  created: string;
  updated: string;
}

export interface KlaviyoListResource {
  type: 'list';
  id: string;
  attributes: KlaviyoListAttributes;
}

export interface KlaviyoListsResponse {
  data: KlaviyoListResource[];
}

export interface KlaviyoCreateListResponse {
  data: KlaviyoListResource;
}

export interface KlaviyoCampaignAttributes {
  name: string;
  status: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
  send_time: string | null;
}

export interface KlaviyoCampaignResource {
  type: 'campaign';
  id: string;
  attributes: KlaviyoCampaignAttributes;
}

export interface KlaviyoCampaignResponse {
  data: KlaviyoCampaignResource;
}

export interface KlaviyoCampaignsResponse {
  data: KlaviyoCampaignResource[];
}

/**
 * Statistics returned by the Klaviyo campaign-values-reports endpoint.
 * Field names match the Klaviyo v2024-02-15 metric keys.
 */
export interface KlaviyoCampaignStatistics {
  /** Total number of messages sent */
  sent_count: number;
  /** Total number of messages delivered (sent minus bounces) */
  delivered_count: number;
  /** Total unique opens */
  open_count: number;
  /** Total unique clicks */
  click_count: number;
  /** Total bounces */
  bounce_count: number;
  /** Total unsubscribes */
  unsubscribe_count: number;
}

// Internal shape of the Klaviyo campaign-values-reports API response
interface KlaviyoCampaignValuesResults {
  data: Array<{
    type: string;
    id: string;
    attributes: {
      results: Array<{
        groupings: Record<string, unknown>;
        statistics: Record<string, number>;
      }>;
    };
  }>;
}

export interface KlaviyoProfileSubscriptionAttributes {
  email?: {
    marketing?: {
      consent?: string; // "SUBSCRIBED" | "UNSUBSCRIBED" | "NEVER_SUBSCRIBED"
      can_receive_email_marketing?: boolean;
      suppressions?: Array<{ reason: string; timestamp: string }>;
    };
  };
}

export interface KlaviyoProfileAttributes {
  email?: string;
  first_name?: string;
  last_name?: string;
  subscriptions?: KlaviyoProfileSubscriptionAttributes;
}

export interface KlaviyoProfileResource {
  type: 'profile';
  id: string;
  attributes: KlaviyoProfileAttributes;
}

export interface KlaviyoFlowAttributes {
  name: string;
  status: string;
  archived: boolean;
  created: string;
  updated: string;
}

export interface KlaviyoFlowResource {
  type: 'flow';
  id: string;
  attributes: KlaviyoFlowAttributes;
}

export interface KlaviyoFlowsResponse {
  data: KlaviyoFlowResource[];
}

export interface KlaviyoEventAttributes {
  metric_id: string;
  value?: number;
  properties?: Record<string, unknown>;
}

export interface KlaviyoCreateEventBody {
  metric_name: string;
  profile_email: string;
  value?: number;
  properties?: Record<string, unknown>;
}

// ============================================================================
// ERROR
// ============================================================================

interface KlaviyoApiErrorDetail {
  id?: string;
  status?: number;
  code?: string;
  title?: string;
  detail?: string;
}

export class KlaviyoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: KlaviyoApiErrorDetail[] = [],
    public readonly correlationId?: string
  ) {
    super(message);
    this.name = 'KlaviyoApiError';
  }
}

// ============================================================================
// RATE LIMITER
// ============================================================================

/**
 * Token-bucket rate limiter.
 *
 * Maintains separate buckets for GET (350 req/s) and POST (75 req/s).
 * Processes a serial queue so concurrent callers naturally queue up.
 */
class TokenBucketRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRatePerMs: number;
  private lastRefillTime: number;
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  constructor(maxRequestsPerSecond: number) {
    this.maxTokens = maxRequestsPerSecond;
    this.tokens = maxRequestsPerSecond;
    this.refillRatePerMs = maxRequestsPerSecond / 1000;
    this.lastRefillTime = Date.now();
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      if (!this.processing) {
        void this.process();
      }
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        const task = this.queue.shift();
        if (task) {
          await task();
        }
      } else {
        // Wait until we have a token
        const msToWait = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
        await sleep(msToWait);
      }
    }

    this.processing = false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const newTokens = elapsed * this.refillRatePerMs;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefillTime = now;
  }
}

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  correlationId?: string;
  retries?: number;
}

// ============================================================================
// CLIENT
// ============================================================================

export class KlaviyoClient {
  private readonly baseUrl: string;
  private readonly getLimiter: TokenBucketRateLimiter;
  private readonly postLimiter: TokenBucketRateLimiter;

  /**
   * @param apiKey - Klaviyo private API key (plain text, never logged)
   */
  constructor(private readonly apiKey: string) {
    this.baseUrl = KLAVIYO_BASE_URL;
    this.getLimiter = new TokenBucketRateLimiter(RATE_LIMIT.GET_MAX_PER_SECOND);
    this.postLimiter = new TokenBucketRateLimiter(RATE_LIMIT.POST_MAX_PER_SECOND);
  }

  // --------------------------------------------------------------------------
  // LISTS
  // --------------------------------------------------------------------------

  async getLists(correlationId?: string): Promise<KlaviyoListResource[]> {
    const response = await this.request<KlaviyoListsResponse>('/api/lists/', {
      method: 'GET',
      correlationId,
    });
    return response.data;
  }

  async createList(
    name: string,
    correlationId?: string
  ): Promise<KlaviyoListResource> {
    const response = await this.request<KlaviyoCreateListResponse>('/api/lists/', {
      method: 'POST',
      body: {
        data: {
          type: 'list',
          attributes: { name },
        },
      },
      correlationId,
    });
    return response.data;
  }

  /**
   * Add profiles to a Klaviyo list.
   * Automatically batches in groups of 100 (Klaviyo maximum).
   */
  async addProfilesToList(
    listId: string,
    profiles: KlaviyoProfile[],
    correlationId?: string
  ): Promise<void> {
    if (profiles.length === 0) {
      return;
    }

    // Chunk into batches of 100
    const batches = chunkArray(profiles, PROFILE_BATCH_SIZE);

    for (const batch of batches) {
      await this.request<unknown>(`/api/lists/${listId}/relationships/profiles/`, {
        method: 'POST',
        body: {
          data: batch.map((p) => ({
            type: 'profile',
            attributes: {
              email: p.email,
              ...(p.first_name !== undefined && { first_name: p.first_name }),
              ...(p.last_name !== undefined && { last_name: p.last_name }),
              ...(p.properties !== undefined && { properties: p.properties }),
            },
          })),
        },
        correlationId,
      });
    }
  }

  // --------------------------------------------------------------------------
  // PROFILES
  // --------------------------------------------------------------------------

  /**
   * Look up profiles by email addresses using the filter query parameter.
   * Returns the matched profile resources including subscription data.
   */
  async getProfilesByEmail(
    emails: string[],
    correlationId?: string
  ): Promise<KlaviyoProfileResource[]> {
    if (emails.length === 0) {
      return [];
    }

    const results: KlaviyoProfileResource[] = [];

    // Klaviyo filter only supports one email at a time via the simple filter syntax.
    // Request subscription fields so suppression status is available.
    for (const email of emails) {
      const encodedFilter = encodeURIComponent(`equals(email,"${email}")`);
      const data = await this.request<{ data: KlaviyoProfileResource[] }>(
        `/api/profiles/?filter=${encodedFilter}&fields[profile]=email,subscriptions`,
        { method: 'GET', correlationId }
      );
      results.push(...(data.data ?? []));
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // CAMPAIGNS
  // --------------------------------------------------------------------------

  async createCampaign(
    params: {
      name: string;
      listId: string;
      subject: string;
      previewText?: string;
      htmlContent?: string;
      fromEmail: string;
      fromName: string;
    },
    correlationId?: string
  ): Promise<KlaviyoCampaignResource> {
    const response = await this.request<KlaviyoCampaignResponse>('/api/campaigns/', {
      method: 'POST',
      body: {
        data: {
          type: 'campaign',
          attributes: {
            name: params.name,
            audiences: {
              included: [params.listId],
            },
            send_options: {
              use_smart_sending: true,
            },
            tracking_options: {
              is_tracking_clicks: true,
              is_tracking_opens: true,
            },
            send_strategy: {
              method: 'immediate',
            },
          },
          relationships: {
            campaign_messages: {
              data: [
                {
                  type: 'campaign-message',
                  attributes: {
                    channel: 'email',
                    label: params.name,
                    content: {
                      subject: params.subject,
                      preview_text: params.previewText ?? '',
                      ...(params.htmlContent ? { body: params.htmlContent } : {}),
                      from_email: params.fromEmail,
                      from_name: params.fromName,
                    },
                  },
                },
              ],
            },
          },
        },
      },
      correlationId,
    });
    return response.data;
  }

  async getCampaign(
    id: string,
    correlationId?: string
  ): Promise<KlaviyoCampaignResource> {
    const response = await this.request<KlaviyoCampaignResponse>(
      `/api/campaigns/${id}/`,
      { method: 'GET', correlationId }
    );
    return response.data;
  }

  /**
   * Fetch aggregate statistics for a single campaign using the Klaviyo
   * campaign-values-reports endpoint (POST /api/campaign-values-reports/).
   *
   * Returns counts for: sent, delivered, opens, clicks, bounces, unsubscribes.
   * If the campaign has no data yet every counter is 0.
   */
  async getCampaignStatistics(
    campaignId: string,
    correlationId?: string
  ): Promise<KlaviyoCampaignStatistics> {
    const response = await this.request<KlaviyoCampaignValuesResults>(
      '/api/campaign-values-reports/',
      {
        method: 'POST',
        body: {
          data: {
            type: 'campaign-values-report',
            attributes: {
              timeframe: { key: 'all_time' },
              conversion_metric_id: null,
              filter: `equals(campaign_id,"${campaignId}")`,
              statistics: [
                'sent_count',
                'delivered_count',
                'open_count',
                'click_count',
                'bounce_count',
                'unsubscribe_count',
              ],
            },
          },
        },
        correlationId,
      }
    );

    // Sum statistics across all result rows (there is usually exactly one)
    const totals: Record<string, number> = {
      sent_count: 0,
      delivered_count: 0,
      open_count: 0,
      click_count: 0,
      bounce_count: 0,
      unsubscribe_count: 0,
    };

    for (const row of response.data ?? []) {
      for (const result of row.attributes?.results ?? []) {
        for (const [key, value] of Object.entries(result.statistics ?? {})) {
          if (key in totals) {
            totals[key] += typeof value === 'number' ? value : 0;
          }
        }
      }
    }

    return totals as unknown as KlaviyoCampaignStatistics;
  }

  /**
   * List campaigns filtered by status and optional send_time lower bound.
   *
   * @param status       - Klaviyo campaign status to filter on (e.g. "Sent")
   * @param sentAfter    - Only return campaigns whose send_time is at or after this date
   * @param correlationId
   */
  async getCampaigns(
    status?: string,
    sentAfter?: Date,
    correlationId?: string
  ): Promise<KlaviyoCampaignResource[]> {
    const filters: string[] = ['equals(messages.channel,"email")'];

    if (status) {
      filters.push(`equals(status,"${status}")`);
    }

    if (sentAfter) {
      filters.push(`greater-or-equal(send_time,"${sentAfter.toISOString()}")`);
    }

    const filterParam = filters.length > 0
      ? `&filter=${encodeURIComponent(filters.join(','))}`
      : '';

    const response = await this.request<KlaviyoCampaignsResponse>(
      `/api/campaigns/?fields[campaign]=name,status,send_time,scheduled_at,created_at,updated_at,archived${filterParam}`,
      { method: 'GET', correlationId }
    );

    return response.data ?? [];
  }

  // --------------------------------------------------------------------------
  // FLOWS
  // --------------------------------------------------------------------------

  async getFlows(correlationId?: string): Promise<KlaviyoFlowResource[]> {
    const response = await this.request<KlaviyoFlowsResponse>('/api/flows/', {
      method: 'GET',
      correlationId,
    });
    return response.data;
  }

  // --------------------------------------------------------------------------
  // EVENTS
  // --------------------------------------------------------------------------

  async createEvent(
    event: KlaviyoCreateEventBody,
    correlationId?: string
  ): Promise<void> {
    await this.request<unknown>('/api/events/', {
      method: 'POST',
      body: {
        data: {
          type: 'event',
          attributes: {
            metric: {
              data: {
                type: 'metric',
                attributes: {
                  name: event.metric_name,
                },
              },
            },
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email: event.profile_email,
                },
              },
            },
            ...(event.value !== undefined && { value: event.value }),
            ...(event.properties !== undefined && { properties: event.properties }),
            time: new Date().toISOString(),
          },
        },
      },
      correlationId,
    });
  }

  // --------------------------------------------------------------------------
  // CORE REQUEST METHOD
  // --------------------------------------------------------------------------

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      correlationId = crypto.randomUUID(),
      retries = 0,
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const limiter = method === 'GET' ? this.getLimiter : this.postLimiter;

    // eslint-disable-next-line no-console
    console.log('[Klaviyo Client]', {
      correlationId,
      method,
      // Log path only — never log the full URL which might contain filter values with PII
      path: endpoint,
      attempt: retries + 1,
    });

    try {
      const response = await limiter.schedule(async () => {
        const headers: Record<string, string> = {
          'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
          'revision': KLAVIYO_REVISION,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Correlation-ID': correlationId,
        };

        return fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(RATE_LIMIT.REQUEST_TIMEOUT_MS),
        });
      });

      // Rate limited — back off and retry
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const waitMs = retryAfterHeader
          ? parseInt(retryAfterHeader, 10) * 1000
          : calculateBackoff(retries);

        if (retries < RATE_LIMIT.MAX_RETRIES) {
          // eslint-disable-next-line no-console
          console.log('[Klaviyo Client] Rate limited, retrying', {
            correlationId,
            waitMs,
            attempt: retries + 1,
          });
          await sleep(waitMs);
          return this.request<T>(endpoint, { ...options, retries: retries + 1 });
        }

        throw new KlaviyoApiError('Rate limit exceeded', 429, [], correlationId);
      }

      // Server error — retry with backoff
      if (response.status >= 500) {
        if (retries < RATE_LIMIT.MAX_RETRIES) {
          const waitMs = calculateBackoff(retries);
          // eslint-disable-next-line no-console
          console.log('[Klaviyo Client] Server error, retrying', {
            correlationId,
            status: response.status,
            waitMs,
            attempt: retries + 1,
          });
          await sleep(waitMs);
          return this.request<T>(endpoint, { ...options, retries: retries + 1 });
        }
      }

      // Parse response body (Klaviyo always returns JSON, even for 204-like responses)
      let responseData: unknown = null;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json') || contentType.includes('application/vnd.api+json')) {
        try {
          responseData = await response.json();
        } catch {
          // Non-JSON body on success (e.g. 204 No Content) — that is fine
        }
      }

      if (!response.ok) {
        const errors = extractErrors(responseData);
        const message = errors[0]?.detail ?? errors[0]?.title ?? `Klaviyo API error: ${response.statusText}`;

        console.error('[Klaviyo Client] API error', {
          correlationId,
          status: response.status,
          errors,
        });

        throw new KlaviyoApiError(message, response.status, errors, correlationId);
      }

      // eslint-disable-next-line no-console
      console.log('[Klaviyo Client] Success', {
        correlationId,
        status: response.status,
      });

      return responseData as T;
    } catch (error) {
      if (error instanceof KlaviyoApiError) {
        throw error;
      }

      console.error('[Klaviyo Client] Request failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new KlaviyoApiError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        [],
        correlationId
      );
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoff(retries: number): number {
  const delay = Math.min(
    RATE_LIMIT.BACKOFF_INITIAL_MS * Math.pow(RATE_LIMIT.BACKOFF_MULTIPLIER, retries),
    RATE_LIMIT.BACKOFF_MAX_MS
  );
  // Add up to 25% jitter
  return delay + delay * 0.25 * Math.random();
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function extractErrors(body: unknown): KlaviyoApiErrorDetail[] {
  if (
    body !== null &&
    typeof body === 'object' &&
    'errors' in body &&
    Array.isArray((body as { errors: unknown[] }).errors)
  ) {
    return (body as { errors: KlaviyoApiErrorDetail[] }).errors;
  }
  return [];
}
