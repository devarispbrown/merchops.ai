/**
 * Shopify Configuration
 *
 * Central configuration for Shopify app integration including
 * OAuth scopes, API version, and app credentials.
 */

import { z } from 'zod';

// Environment variable validation
const shopifyEnvSchema = z.object({
  SHOPIFY_API_KEY: z.string().min(1, 'SHOPIFY_API_KEY is required'),
  SHOPIFY_API_SECRET: z.string().min(1, 'SHOPIFY_API_SECRET is required'),
  SHOPIFY_APP_URL: z.string().url('SHOPIFY_APP_URL must be a valid URL'),
  SHOPIFY_SCOPES: z.string().min(1, 'SHOPIFY_SCOPES is required'),
});

// Validate and parse environment variables
function getShopifyEnv() {
  const env = {
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    SHOPIFY_SCOPES: process.env.SHOPIFY_SCOPES,
  };

  try {
    return shopifyEnvSchema.parse(env);
  } catch (error) {
    console.error('Shopify configuration error:', error);
    throw new Error('Invalid Shopify environment configuration');
  }
}

// Shopify API Configuration
export const SHOPIFY_CONFIG = {
  // API Version (use stable version)
  API_VERSION: '2024-01',

  // OAuth Scopes (minimal required for MVP)
  // Scopes are defined in env for flexibility but validated here
  SCOPES: [
    'read_products',
    'write_products',
    'read_inventory',
    'read_orders',
    'read_customers',
    'write_price_rules',
    'write_discounts',
  ] as const,

  // Webhook Topics
  WEBHOOK_TOPICS: [
    'orders/create',
    'orders/paid',
    'products/update',
    'inventory_levels/update',
    'customers/update',
  ] as const,

  // Rate Limiting
  RATE_LIMIT: {
    MAX_REQUESTS_PER_SECOND: 2, // Shopify REST Admin API limit
    BACKOFF_INITIAL_MS: 1000,
    BACKOFF_MAX_MS: 32000,
    BACKOFF_MULTIPLIER: 2,
    MAX_RETRIES: 5,
  },

  // Request Timeouts
  TIMEOUTS: {
    DEFAULT_MS: 30000, // 30 seconds
    WEBHOOK_MS: 5000, // 5 seconds for webhook acknowledgment
  },

  // Get credentials from environment
  get credentials() {
    const env = getShopifyEnv();
    return {
      apiKey: env.SHOPIFY_API_KEY,
      apiSecret: env.SHOPIFY_API_SECRET,
      appUrl: env.SHOPIFY_APP_URL,
      scopes: env.SHOPIFY_SCOPES,
    };
  },

  // OAuth URLs
  get authUrl() {
    return (shop: string) =>
      `https://${shop}/admin/oauth/authorize`;
  },

  get tokenUrl() {
    return (shop: string) =>
      `https://${shop}/admin/oauth/access_token`;
  },

  // API Base URL
  get apiUrl() {
    return (shop: string) =>
      `https://${shop}/admin/api/${this.API_VERSION}`;
  },

  // Webhook URL
  get webhookUrl() {
    const env = getShopifyEnv();
    return `${env.SHOPIFY_APP_URL}/api/shopify/webhooks`;
  },
} as const;

// Type exports
export type ShopifyScope = (typeof SHOPIFY_CONFIG.SCOPES)[number];
export type WebhookTopic = (typeof SHOPIFY_CONFIG.WEBHOOK_TOPICS)[number];

// Helper to validate scopes
export function validateScopes(scopes: string[]): boolean {
  const requiredScopes = SHOPIFY_CONFIG.SCOPES;
  return requiredScopes.every((scope) => scopes.includes(scope));
}

// Helper to get scope string
export function getScopeString(): string {
  return SHOPIFY_CONFIG.SCOPES.join(',');
}
