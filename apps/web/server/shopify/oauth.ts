/**
 * Shopify OAuth Utilities
 *
 * Handles OAuth flow, token exchange, shop validation, and token encryption.
 * All operations follow Shopify's security best practices.
 */

import crypto from 'crypto';
import { SHOPIFY_CONFIG, getScopeString } from './config';
import { z } from 'zod';

/**
 * Get the encryption key, validating it on first use
 * Deferred validation to support Next.js build phase
 */
let _encryptionKey: string | null = null;

function getEncryptionKey(): string {
  if (_encryptionKey !== null) {
    return _encryptionKey;
  }

  const key = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;

  if (!key || key.length !== 64) {
    throw new Error(
      'SHOPIFY_TOKEN_ENCRYPTION_KEY must be set and be 64 hex characters (32 bytes)'
    );
  }

  _encryptionKey = key;
  return _encryptionKey;
}

// Token response from Shopify
const tokenResponseSchema = z.object({
  access_token: z.string(),
  scope: z.string(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

/**
 * Validates a Shopify shop domain
 * Ensures it follows the *.myshopify.com pattern
 */
export function validateShop(shop: string): boolean {
  const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

  if (!shopPattern.test(shop)) {
    return false;
  }

  // Additional check: no double hyphens
  if (shop.includes('--')) {
    return false;
  }

  return true;
}

/**
 * Generates a cryptographically secure random state for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates the OAuth authorization URL
 *
 * @param shop - The shop domain (e.g., my-store.myshopify.com)
 * @param state - CSRF protection state (should be stored in session)
 * @returns Authorization URL to redirect user to
 */
export function generateAuthUrl(shop: string, state: string): string {
  if (!validateShop(shop)) {
    throw new Error('Invalid shop domain');
  }

  const { apiKey, appUrl } = SHOPIFY_CONFIG.credentials;
  const scopes = getScopeString();
  const redirectUri = `${appUrl}/api/shopify/callback`;

  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
    grant_options: '[]', // Empty array for online access mode (MVP acceptable)
  });

  return `${SHOPIFY_CONFIG.authUrl(shop)}?${params.toString()}`;
}

/**
 * Verifies HMAC signature from Shopify OAuth callback
 *
 * @param query - Query parameters from OAuth callback
 * @returns True if HMAC is valid
 */
export function verifyHmac(query: Record<string, string>): boolean {
  const { hmac, ...params } = query;

  if (!hmac) {
    return false;
  }

  // Build message from sorted params (excluding hmac)
  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  // Calculate expected HMAC
  const { apiSecret } = SHOPIFY_CONFIG.credentials;
  const generatedHash = crypto
    .createHmac('sha256', apiSecret)
    .update(message)
    .digest('hex');

  // Convert to buffers for timing-safe comparison
  const hmacBuffer = Buffer.from(hmac, 'utf8');
  const generatedBuffer = Buffer.from(generatedHash, 'utf8');

  // Validate buffer lengths match before comparison (prevents timing attacks)
  if (hmacBuffer.length !== generatedBuffer.length) {
    return false;
  }

  try {
    // Use timing-safe comparison
    return crypto.timingSafeEqual(hmacBuffer, generatedBuffer);
  } catch (error) {
    // timingSafeEqual throws if buffers have different lengths
    // This should not happen due to length check above, but handle defensively
    return false;
  }
}

/**
 * Exchanges authorization code for access token
 *
 * @param shop - The shop domain
 * @param code - Authorization code from OAuth callback
 * @returns Access token and granted scopes
 */
export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<TokenResponse> {
  if (!validateShop(shop)) {
    throw new Error('Invalid shop domain');
  }

  const { apiKey, apiSecret } = SHOPIFY_CONFIG.credentials;
  const tokenUrl = SHOPIFY_CONFIG.tokenUrl(shop);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Token exchange failed: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();

  // Validate response structure
  const tokenResponse = tokenResponseSchema.parse(data);

  return tokenResponse;
}

/**
 * Encrypts an access token for storage
 * Uses AES-256-GCM with random IV for each encryption
 *
 * @param token - Plain text access token
 * @returns Encrypted token in format: iv:authTag:encryptedData (hex encoded)
 */
export function encryptToken(token: string): string {
  const encryptionKey = getEncryptionKey();

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(encryptionKey, 'hex'),
    iv
  );

  // Encrypt
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag
  const authTag = cipher.getAuthTag().toString('hex');

  // Return in format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an access token from storage
 *
 * @param encryptedToken - Encrypted token in format: iv:authTag:encryptedData
 * @returns Plain text access token
 */
export function decryptToken(encryptedToken: string): string {
  const encryptionKey = getEncryptionKey();

  try {
    // Parse encrypted token format
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    // Convert from hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(encryptionKey, 'hex'),
      iv
    );

    // Set auth tag
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(
      `Token decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validates that granted scopes match required scopes
 *
 * @param grantedScopes - Comma-separated scope string from Shopify
 * @returns True if all required scopes are granted
 */
export function validateGrantedScopes(grantedScopes: string): boolean {
  const granted = grantedScopes.split(',').map((s) => s.trim());
  const required = SHOPIFY_CONFIG.SCOPES;

  return required.every((scope) => granted.includes(scope));
}
