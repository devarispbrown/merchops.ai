/**
 * Shopify Schemas
 *
 * Zod validation schemas for Shopify integration
 */

import { z } from 'zod';

// Enum schemas
export const shopifyConnectionStatusSchema = z.enum(['active', 'revoked', 'error']);

// Base Shopify connection schema
export const shopifyConnectionSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  store_domain: z.string().regex(/^[a-zA-Z0-9-]+\.myshopify\.com$/, 'Invalid Shopify store domain'),
  access_token_encrypted: z.string(),
  scopes: z.string(),
  status: shopifyConnectionStatusSchema,
  installed_at: z.date(),
  revoked_at: z.date().nullable(),
});

// Schema for creating a Shopify connection
export const createShopifyConnectionSchema = z.object({
  workspace_id: z.string().uuid(),
  store_domain: z.string().regex(/^[a-zA-Z0-9-]+\.myshopify\.com$/, 'Invalid Shopify store domain'),
  access_token: z.string().min(1, 'Access token is required'), // Will be encrypted
  scopes: z.string().min(1, 'Scopes are required'),
});

// Schema for OAuth callback
export const shopifyOAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  shop: z.string().regex(/^[a-zA-Z0-9-]+\.myshopify\.com$/, 'Invalid shop domain'),
  state: z.string().min(1, 'State parameter is required'),
  hmac: z.string().min(1, 'HMAC is required'),
  timestamp: z.string().min(1, 'Timestamp is required'),
});

// Schema for webhook HMAC verification
export const shopifyWebhookSchema = z.object({
  headers: z.object({
    'x-shopify-hmac-sha256': z.string(),
    'x-shopify-shop-domain': z.string(),
    'x-shopify-topic': z.string(),
    'x-shopify-api-version': z.string(),
    'x-shopify-webhook-id': z.string(),
  }),
  body: z.unknown(), // Parsed JSON payload
});

// Shopify object cache schema
export const shopifyObjectCacheSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  object_type: z.enum(['product', 'inventory_level', 'customer', 'order', 'discount']),
  shopify_id: z.string().min(1, 'Shopify ID is required'),
  data_json: z.record(z.unknown()),
  version: z.number().int().positive(),
  synced_at: z.date(),
});

// Schema for creating/updating cache entries
export const upsertShopifyObjectSchema = z.object({
  workspace_id: z.string().uuid(),
  object_type: z.enum(['product', 'inventory_level', 'customer', 'order', 'discount']),
  shopify_id: z.string().min(1),
  data_json: z.record(z.unknown()),
});

// Schema for revoking connection
export const revokeShopifyConnectionSchema = z.object({
  workspace_id: z.string().uuid(),
});

// Schema for requested scopes
export const shopifyScopesSchema = z.array(
  z.enum([
    'read_products',
    'write_products',
    'read_orders',
    'read_customers',
    'write_customers',
    'read_inventory',
    'write_inventory',
    'read_price_rules',
    'write_price_rules',
    'read_discounts',
    'write_discounts',
  ])
);

// Types
export type ShopifyConnection = z.infer<typeof shopifyConnectionSchema>;
export type ShopifyConnectionStatus = z.infer<typeof shopifyConnectionStatusSchema>;
export type CreateShopifyConnectionInput = z.infer<typeof createShopifyConnectionSchema>;
export type ShopifyOAuthCallback = z.infer<typeof shopifyOAuthCallbackSchema>;
export type ShopifyWebhookPayload = z.infer<typeof shopifyWebhookSchema>;
export type ShopifyObjectCache = z.infer<typeof shopifyObjectCacheSchema>;
export type UpsertShopifyObjectInput = z.infer<typeof upsertShopifyObjectSchema>;
export type RevokeShopifyConnectionInput = z.infer<typeof revokeShopifyConnectionSchema>;
export type ShopifyScopes = z.infer<typeof shopifyScopesSchema>;
