/**
 * User, Workspace, and Shopify Connection Test Fixtures
 *
 * Sample data for authentication and workspace testing.
 */

import { ShopifyConnectionStatus } from '@prisma/client';
import crypto from 'crypto';

// ============================================================================
// TEST PASSWORDS
// ============================================================================

/**
 * Test password (plain text - only for testing)
 */
export const TEST_PASSWORD = 'TestPassword123!';

/**
 * Hashed test password (bcrypt hash of TEST_PASSWORD)
 * Generated with: bcrypt.hash('TestPassword123!', 10)
 */
export const TEST_PASSWORD_HASH = '$2b$10$rOlMq7VXZxOkYKZJ5Z5YQeX7vF8.0YgX9Z5ZqZ5Z5Z5Z5Z5Z5Z5ZO';

/**
 * Invalid password for negative testing
 */
export const INVALID_PASSWORD = 'WrongPassword456!';

// ============================================================================
// ENCRYPTION TEST KEY
// ============================================================================

/**
 * Test encryption key for Shopify tokens (only for testing)
 * In production, this comes from ENCRYPTION_KEY env var
 */
export const TEST_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

/**
 * Encrypt a test token (simulates production encryption)
 */
export function encryptTestToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(TEST_ENCRYPTION_KEY, 'hex'),
    iv
  );
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Sample encrypted Shopify access token
 */
export const TEST_SHOPIFY_TOKEN_ENCRYPTED = encryptTestToken('shpat_test1234567890abcdef');

// ============================================================================
// WORKSPACES
// ============================================================================

export const workspaceActive = {
  id: 'workspace-test-123',
  name: 'Test Store Inc.',
  created_at: new Date('2024-01-01T10:00:00Z'),
  updated_at: new Date('2024-01-01T10:00:00Z'),
};

export const workspaceSecondary = {
  id: 'workspace-test-456',
  name: 'Another Store LLC',
  created_at: new Date('2024-01-05T14:30:00Z'),
  updated_at: new Date('2024-01-05T14:30:00Z'),
};

export const workspaceNew = {
  id: 'workspace-test-789',
  name: 'Brand New Store',
  created_at: new Date('2024-01-15T09:00:00Z'),
  updated_at: new Date('2024-01-15T09:00:00Z'),
};

// ============================================================================
// USERS
// ============================================================================

export const userOwner = {
  id: 'user-owner-1',
  email: 'owner@teststore.com',
  password_hash: TEST_PASSWORD_HASH,
  workspace_id: workspaceActive.id,
  created_at: new Date('2024-01-01T10:00:00Z'),
};

export const userAdmin = {
  id: 'user-admin-1',
  email: 'admin@teststore.com',
  password_hash: TEST_PASSWORD_HASH,
  workspace_id: workspaceActive.id,
  created_at: new Date('2024-01-02T11:00:00Z'),
};

export const userMember = {
  id: 'user-member-1',
  email: 'member@teststore.com',
  password_hash: TEST_PASSWORD_HASH,
  workspace_id: workspaceActive.id,
  created_at: new Date('2024-01-03T12:00:00Z'),
};

export const userSecondWorkspace = {
  id: 'user-second-1',
  email: 'owner@anotherstore.com',
  password_hash: TEST_PASSWORD_HASH,
  workspace_id: workspaceSecondary.id,
  created_at: new Date('2024-01-05T14:30:00Z'),
};

export const userNewWorkspace = {
  id: 'user-new-1',
  email: 'owner@newstore.com',
  password_hash: TEST_PASSWORD_HASH,
  workspace_id: workspaceNew.id,
  created_at: new Date('2024-01-15T09:00:00Z'),
};

// ============================================================================
// SHOPIFY CONNECTIONS
// ============================================================================

export const shopifyConnectionActive = {
  id: 'shopify-conn-1',
  workspace_id: workspaceActive.id,
  store_domain: 'test-store.myshopify.com',
  access_token_encrypted: TEST_SHOPIFY_TOKEN_ENCRYPTED,
  scopes: 'read_products,write_products,read_inventory,read_orders,read_customers,write_price_rules,write_discounts',
  status: ShopifyConnectionStatus.active,
  installed_at: new Date('2024-01-01T10:15:00Z'),
  revoked_at: null,
};

export const shopifyConnectionSecondary = {
  id: 'shopify-conn-2',
  workspace_id: workspaceSecondary.id,
  store_domain: 'another-store.myshopify.com',
  access_token_encrypted: encryptTestToken('shpat_test0987654321fedcba'),
  scopes: 'read_products,write_products,read_inventory,read_orders,read_customers,write_price_rules,write_discounts',
  status: ShopifyConnectionStatus.active,
  installed_at: new Date('2024-01-05T14:45:00Z'),
  revoked_at: null,
};

export const shopifyConnectionRevoked = {
  id: 'shopify-conn-revoked',
  workspace_id: 'workspace-revoked-999',
  store_domain: 'revoked-store.myshopify.com',
  access_token_encrypted: encryptTestToken('shpat_revoked123456'),
  scopes: 'read_products,write_products,read_inventory,read_orders,read_customers,write_price_rules,write_discounts',
  status: ShopifyConnectionStatus.revoked,
  installed_at: new Date('2024-01-01T08:00:00Z'),
  revoked_at: new Date('2024-01-10T15:30:00Z'),
};

export const shopifyConnectionError = {
  id: 'shopify-conn-error',
  workspace_id: 'workspace-error-888',
  store_domain: 'error-store.myshopify.com',
  access_token_encrypted: encryptTestToken('shpat_error789012'),
  scopes: 'read_products,write_products,read_inventory,read_orders,read_customers,write_price_rules,write_discounts',
  status: ShopifyConnectionStatus.error,
  installed_at: new Date('2024-01-12T10:00:00Z'),
  revoked_at: null,
};

// ============================================================================
// NEXT-AUTH SESSION DATA
// ============================================================================

export const sessionUserOwner = {
  user: {
    id: userOwner.id,
    email: userOwner.email,
    workspaceId: userOwner.workspace_id,
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
};

export const sessionUserAdmin = {
  user: {
    id: userAdmin.id,
    email: userAdmin.email,
    workspaceId: userAdmin.workspace_id,
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

export const sessionUserMember = {
  user: {
    id: userMember.id,
    email: userMember.email,
    workspaceId: userMember.workspace_id,
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

// ============================================================================
// JWT TOKENS
// ============================================================================

export const jwtTokenOwner = {
  id: userOwner.id,
  email: userOwner.email,
  workspaceId: userOwner.workspace_id,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
};

export const jwtTokenExpired = {
  id: userOwner.id,
  email: userOwner.email,
  workspaceId: userOwner.workspace_id,
  iat: Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60, // 31 days ago
  exp: Math.floor(Date.now() / 1000) - 24 * 60 * 60, // Expired yesterday
};

// ============================================================================
// SIGNUP/SIGNIN REQUEST PAYLOADS
// ============================================================================

export const signupRequestValid = {
  email: 'newuser@example.com',
  password: TEST_PASSWORD,
  workspaceName: 'New User Store',
};

export const signupRequestInvalidEmail = {
  email: 'invalid-email',
  password: TEST_PASSWORD,
  workspaceName: 'Test Store',
};

export const signupRequestWeakPassword = {
  email: 'newuser@example.com',
  password: '123',
  workspaceName: 'Test Store',
};

export const signupRequestDuplicateEmail = {
  email: userOwner.email,
  password: TEST_PASSWORD,
  workspaceName: 'Duplicate Store',
};

export const signinRequestValid = {
  email: userOwner.email,
  password: TEST_PASSWORD,
};

export const signinRequestWrongPassword = {
  email: userOwner.email,
  password: INVALID_PASSWORD,
};

export const signinRequestNonexistentUser = {
  email: 'nonexistent@example.com',
  password: TEST_PASSWORD,
};

// ============================================================================
// OAUTH FLOW DATA
// ============================================================================

export const shopifyOAuthStartParams = {
  shop: 'new-shop.myshopify.com',
};

export const shopifyOAuthCallbackParams = {
  code: 'oauth_code_abc123xyz789',
  hmac: 'valid_hmac_signature_here',
  shop: 'new-shop.myshopify.com',
  state: 'random_state_nonce_12345',
  timestamp: Math.floor(Date.now() / 1000).toString(),
};

export const shopifyOAuthTokenResponse = {
  access_token: 'shpat_new_token_1234567890',
  scope: 'read_products,write_products,read_inventory,read_orders,read_customers,write_price_rules,write_discounts',
};

// ============================================================================
// SHOPIFY STORE INFO
// ============================================================================

export const shopifyStoreInfo = {
  shop: {
    id: 12345678901,
    name: 'Test Store',
    email: 'store@teststore.com',
    domain: 'test-store.myshopify.com',
    province: 'California',
    country: 'US',
    address1: '123 Commerce St',
    zip: '94102',
    city: 'San Francisco',
    source: null,
    phone: '+1-555-123-4567',
    latitude: 37.7749,
    longitude: -122.4194,
    primary_locale: 'en',
    address2: null,
    created_at: '2023-06-01T12:00:00-07:00',
    updated_at: '2024-01-15T10:00:00-08:00',
    country_code: 'US',
    country_name: 'United States',
    currency: 'USD',
    customer_email: 'support@teststore.com',
    timezone: '(GMT-08:00) America/Los_Angeles',
    iana_timezone: 'America/Los_Angeles',
    shop_owner: 'John Doe',
    money_format: '${{amount}}',
    money_with_currency_format: '${{amount}} USD',
    weight_unit: 'lb',
    province_code: 'CA',
    taxes_included: false,
    auto_configure_tax_inclusivity: null,
    tax_shipping: null,
    county_taxes: true,
    plan_display_name: 'Shopify',
    plan_name: 'professional',
    has_discounts: true,
    has_gift_cards: true,
    myshopify_domain: 'test-store.myshopify.com',
    google_apps_domain: null,
    google_apps_login_enabled: null,
    money_in_emails_format: '${{amount}}',
    money_with_currency_in_emails_format: '${{amount}} USD',
    eligible_for_payments: true,
    requires_extra_payments_agreement: false,
    password_enabled: false,
    has_storefront: true,
    finances: true,
    primary_location_id: 1234567890,
    checkout_api_supported: true,
    multi_location_enabled: true,
    setup_required: false,
    pre_launch_enabled: false,
    enabled_presentment_currencies: ['USD'],
  },
};

// ============================================================================
// ALL WORKSPACES
// ============================================================================

export const allWorkspaces = [
  workspaceActive,
  workspaceSecondary,
  workspaceNew,
];

// ============================================================================
// ALL USERS
// ============================================================================

export const allUsers = [
  userOwner,
  userAdmin,
  userMember,
  userSecondWorkspace,
  userNewWorkspace,
];

// ============================================================================
// ALL SHOPIFY CONNECTIONS
// ============================================================================

export const allShopifyConnections = [
  shopifyConnectionActive,
  shopifyConnectionSecondary,
  shopifyConnectionRevoked,
  shopifyConnectionError,
];
