/**
 * Shopify integration types for MerchOps
 *
 * Covers OAuth connections, webhooks, and API interactions.
 * Follows Shopify's webhook and REST/GraphQL API contracts.
 */

/**
 * Shopify OAuth connection status
 */
export type ShopifyConnectionStatus =
  | 'pending'      // OAuth initiated but not completed
  | 'connected'    // Active connection with valid token
  | 'expired'      // Token expired, needs refresh
  | 'revoked'      // User revoked access
  | 'error';       // Connection error

/**
 * Shopify connection entity
 * Stores OAuth credentials and connection metadata
 */
export interface ShopifyConnection {
  /** Unique connection identifier */
  id: string;

  /** Associated workspace ID */
  workspaceId: string;

  /** Shopify store domain (e.g., "example.myshopify.com") */
  storeDomain: string;

  /** Connection status */
  status: ShopifyConnectionStatus;

  /**
   * OAuth scopes granted
   * Stored as comma-separated string
   */
  scopes: string;

  /**
   * Encrypted access token reference
   * Actual token stored in secure vault
   */
  accessTokenRef: string;

  /** Token expiration timestamp (for online tokens) */
  expiresAt: Date | null;

  /** Timestamp when connection was revoked */
  revokedAt: Date | null;

  /** Last successful API call timestamp */
  lastSyncAt: Date | null;

  /** Connection creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Optional error message for failed connections */
  errorMessage: string | null;
}

/**
 * Shopify webhook topic types
 * Subset relevant to MerchOps MVP
 */
export type ShopifyWebhookTopic =
  | 'orders/create'
  | 'orders/paid'
  | 'orders/updated'
  | 'products/create'
  | 'products/update'
  | 'products/delete'
  | 'inventory_levels/update'
  | 'customers/create'
  | 'customers/update'
  | 'app/uninstalled';

/**
 * Base webhook payload structure
 * All Shopify webhooks include these fields
 */
export interface ShopifyWebhookBase {
  /** Shopify store domain that sent webhook */
  shop_domain: string;

  /** Webhook ID from Shopify */
  webhook_id: string;

  /** Event timestamp */
  occurred_at: string;
}

/**
 * Order webhook payload
 * Fired for orders/create, orders/paid, orders/updated
 */
export interface ShopifyOrderWebhook extends ShopifyWebhookBase {
  id: number;
  order_number: number;
  email: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  line_items: Array<{
    id: number;
    product_id: number;
    variant_id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
  created_at: string;
  updated_at: string;
}

/**
 * Product webhook payload
 * Fired for products/create, products/update, products/delete
 */
export interface ShopifyProductWebhook extends ShopifyWebhookBase {
  id: number;
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  vendor: string;
  product_type: string;
  tags: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku: string;
    inventory_quantity: number;
    inventory_management: string | null;
  }>;
  created_at: string;
  updated_at: string;
}

/**
 * Inventory level webhook payload
 * Fired for inventory_levels/update
 */
export interface ShopifyInventoryWebhook extends ShopifyWebhookBase {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

/**
 * Customer webhook payload
 * Fired for customers/create, customers/update
 */
export interface ShopifyCustomerWebhook extends ShopifyWebhookBase {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
  tags: string;
  state: string;
  created_at: string;
  updated_at: string;
  last_order_id: number | null;
  last_order_name: string | null;
}

/**
 * App uninstalled webhook
 * Fired when merchant uninstalls the app
 */
export interface ShopifyAppUninstalledWebhook extends ShopifyWebhookBase {
  id: number;
}

/**
 * Union type of all webhook payloads
 */
export type ShopifyWebhookPayload =
  | ShopifyOrderWebhook
  | ShopifyProductWebhook
  | ShopifyInventoryWebhook
  | ShopifyCustomerWebhook
  | ShopifyAppUninstalledWebhook;

/**
 * Incoming webhook request data
 * Before validation and processing
 */
export interface ShopifyWebhookRequest {
  /** Webhook topic from X-Shopify-Topic header */
  topic: ShopifyWebhookTopic;

  /** Store domain from X-Shopify-Shop-Domain header */
  shopDomain: string;

  /** HMAC signature for verification */
  hmac: string;

  /** Raw webhook body */
  body: string;

  /** Parsed webhook payload */
  payload: ShopifyWebhookPayload;
}

/**
 * Shopify API response wrapper
 * Generic type for API call results
 */
export interface ShopifyApiResponse<T = unknown> {
  /** API call success status */
  success: boolean;

  /** Response data (if successful) */
  data?: T;

  /** Error information (if failed) */
  error?: {
    message: string;
    code?: string;
    statusCode?: number;
  };

  /** Rate limit information */
  rateLimit?: {
    remaining: number;
    limit: number;
    resetAt: Date;
  };
}

/**
 * Shopify OAuth initialization parameters
 */
export interface ShopifyOAuthInit {
  /** Shop domain to connect */
  shop: string;

  /** Requested scopes */
  scopes: string[];

  /** OAuth redirect URI */
  redirectUri: string;

  /** State parameter for CSRF protection */
  state: string;
}

/**
 * Shopify OAuth callback parameters
 */
export interface ShopifyOAuthCallback {
  /** Shop domain */
  shop: string;

  /** Authorization code */
  code: string;

  /** State parameter (must match init) */
  state: string;

  /** HMAC for verification */
  hmac: string;
}

/**
 * Shopify access token response
 */
export interface ShopifyAccessTokenResponse {
  /** Access token (to be encrypted) */
  access_token: string;

  /** Granted scopes */
  scope: string;

  /** Expiration timestamp (online tokens only) */
  expires_in?: number;

  /** Associated user (online tokens only) */
  associated_user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}
