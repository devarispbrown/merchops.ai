/**
 * Shopify API Client
 *
 * Provides a robust client for interacting with Shopify Admin API.
 * Includes rate limiting, exponential backoff, request logging with correlation IDs.
 */

import { SHOPIFY_CONFIG } from './config';
import { decryptToken } from './oauth';
import { z } from 'zod';
import crypto from 'crypto';

// Shopify API response schemas
const shopifyProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  status: z.string(),
  variants: z.array(z.any()),
  images: z.array(z.any()).optional(),
});

const shopifyOrderSchema = z.object({
  id: z.number(),
  order_number: z.number(),
  email: z.string().optional(),
  total_price: z.string(),
  line_items: z.array(z.any()),
  created_at: z.string(),
});

const shopifyCustomerSchema = z.object({
  id: z.number(),
  email: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  orders_count: z.number().optional(),
  total_spent: z.string().optional(),
});

const shopifyInventoryLevelSchema = z.object({
  inventory_item_id: z.number(),
  location_id: z.number(),
  available: z.number().nullable(),
  updated_at: z.string(),
});

// Rate limiter class for Shopify API
class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastRequestTime = 0;

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minInterval = 1000 / SHOPIFY_CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_SECOND;

      if (timeSinceLastRequest < minInterval) {
        await this.sleep(minInterval - timeSinceLastRequest);
      }

      const task = this.queue.shift();
      if (task) {
        this.lastRequestTime = Date.now();
        await task();
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Shopify API Error
export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown,
    public correlationId?: string
  ) {
    super(message);
    this.name = 'ShopifyApiError';
  }
}

// Request options
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  correlationId?: string;
  retries?: number;
}

/**
 * Shopify API Client with rate limiting and error handling
 */
export class ShopifyClient {
  private baseUrl: string;
  private accessToken: string;
  private rateLimiter: RateLimiter;
  private shop: string;

  constructor(shop: string, encryptedToken: string) {
    this.shop = shop;
    this.baseUrl = SHOPIFY_CONFIG.apiUrl(shop);
    this.accessToken = decryptToken(encryptedToken);
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Make a request to Shopify API with rate limiting and retries
   */
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

    // Log request
    console.log('[Shopify Client]', {
      correlationId,
      method,
      url,
      attempt: retries + 1,
    });

    try {
      const response = await this.rateLimiter.schedule(async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken,
          'X-Correlation-ID': correlationId,
        };

        return fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(SHOPIFY_CONFIG.TIMEOUTS.DEFAULT_MS),
        });
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : this.calculateBackoff(retries);

        if (retries < SHOPIFY_CONFIG.RATE_LIMIT.MAX_RETRIES) {
          console.log('[Shopify Client] Rate limited, retrying after', {
            correlationId,
            waitTime,
            retries: retries + 1,
          });

          await this.sleep(waitTime);
          return this.request<T>(endpoint, { ...options, retries: retries + 1 });
        }

        throw new ShopifyApiError(
          'Rate limit exceeded',
          429,
          undefined,
          correlationId
        );
      }

      // Handle server errors with retry
      if (response.status >= 500) {
        if (retries < SHOPIFY_CONFIG.RATE_LIMIT.MAX_RETRIES) {
          const waitTime = this.calculateBackoff(retries);
          console.log('[Shopify Client] Server error, retrying after', {
            correlationId,
            status: response.status,
            waitTime,
            retries: retries + 1,
          });

          await this.sleep(waitTime);
          return this.request<T>(endpoint, { ...options, retries: retries + 1 });
        }
      }

      // Parse response
      const responseData = await response.json();

      if (!response.ok) {
        throw new ShopifyApiError(
          `Shopify API error: ${response.statusText}`,
          response.status,
          responseData,
          correlationId
        );
      }

      // Log success
      console.log('[Shopify Client] Success', {
        correlationId,
        status: response.status,
      });

      return responseData as T;
    } catch (error) {
      // Log error
      console.error('[Shopify Client] Error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ShopifyApiError) {
        throw error;
      }

      throw new ShopifyApiError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        undefined,
        correlationId
      );
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retries: number): number {
    const { BACKOFF_INITIAL_MS, BACKOFF_MULTIPLIER, BACKOFF_MAX_MS } =
      SHOPIFY_CONFIG.RATE_LIMIT;

    const delay = Math.min(
      BACKOFF_INITIAL_MS * Math.pow(BACKOFF_MULTIPLIER, retries),
      BACKOFF_MAX_MS
    );

    // Add jitter (0-25% of delay)
    const jitter = delay * 0.25 * Math.random();

    return delay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get products with pagination
   */
  async getProducts(options: {
    limit?: number;
    sinceId?: number;
    correlationId?: string;
  } = {}): Promise<z.infer<typeof shopifyProductSchema>[]> {
    const { limit = 50, sinceId, correlationId } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(sinceId && { since_id: sinceId.toString() }),
    });

    const response = await this.request<{ products: unknown[] }>(
      `/products.json?${params.toString()}`,
      { correlationId }
    );

    return z.array(shopifyProductSchema).parse(response.products);
  }

  /**
   * Get orders with pagination
   */
  async getOrders(options: {
    limit?: number;
    sinceId?: number;
    status?: 'open' | 'closed' | 'any';
    correlationId?: string;
  } = {}): Promise<z.infer<typeof shopifyOrderSchema>[]> {
    const { limit = 50, sinceId, status = 'any', correlationId } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      status,
      ...(sinceId && { since_id: sinceId.toString() }),
    });

    const response = await this.request<{ orders: unknown[] }>(
      `/orders.json?${params.toString()}`,
      { correlationId }
    );

    return z.array(shopifyOrderSchema).parse(response.orders);
  }

  /**
   * Get customers with pagination
   */
  async getCustomers(options: {
    limit?: number;
    sinceId?: number;
    correlationId?: string;
  } = {}): Promise<z.infer<typeof shopifyCustomerSchema>[]> {
    const { limit = 50, sinceId, correlationId } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(sinceId && { since_id: sinceId.toString() }),
    });

    const response = await this.request<{ customers: unknown[] }>(
      `/customers.json?${params.toString()}`,
      { correlationId }
    );

    return z.array(shopifyCustomerSchema).parse(response.customers);
  }

  /**
   * Get inventory levels for a location
   */
  async getInventoryLevels(options: {
    locationId?: number;
    inventoryItemIds?: number[];
    limit?: number;
    correlationId?: string;
  } = {}): Promise<z.infer<typeof shopifyInventoryLevelSchema>[]> {
    const { locationId, inventoryItemIds, limit = 50, correlationId } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(locationId && { location_ids: locationId.toString() }),
      ...(inventoryItemIds && {
        inventory_item_ids: inventoryItemIds.join(','),
      }),
    });

    const response = await this.request<{ inventory_levels: unknown[] }>(
      `/inventory_levels.json?${params.toString()}`,
      { correlationId }
    );

    return z.array(shopifyInventoryLevelSchema).parse(response.inventory_levels);
  }

  /**
   * Get shop information
   */
  async getShop(correlationId?: string): Promise<{ shop: Record<string, unknown> }> {
    return this.request<{ shop: Record<string, unknown> }>(
      '/shop.json',
      { correlationId }
    );
  }

  /**
   * Create a price rule
   * POST /admin/api/2024-01/price_rules.json
   */
  async createPriceRule(
    priceRule: Record<string, unknown>,
    correlationId?: string
  ): Promise<{ price_rule: Record<string, unknown> }> {
    return this.request<{ price_rule: Record<string, unknown> }>(
      '/price_rules.json',
      { method: 'POST', body: { price_rule: priceRule }, correlationId }
    );
  }

  /**
   * Create a discount code under a price rule
   * POST /admin/api/2024-01/price_rules/{id}/discount_codes.json
   */
  async createDiscountCode(
    priceRuleId: number,
    discountCode: Record<string, unknown>,
    correlationId?: string
  ): Promise<{ discount_code: Record<string, unknown> }> {
    return this.request<{ discount_code: Record<string, unknown> }>(
      `/price_rules/${priceRuleId}/discount_codes.json`,
      { method: 'POST', body: { discount_code: discountCode }, correlationId }
    );
  }

  /**
   * Delete a price rule (and all its discount codes)
   * DELETE /admin/api/2024-01/price_rules/{id}.json
   */
  async deletePriceRule(
    priceRuleId: number,
    correlationId?: string
  ): Promise<void> {
    await this.request<unknown>(
      `/price_rules/${priceRuleId}.json`,
      { method: 'DELETE', correlationId }
    );
  }
}
