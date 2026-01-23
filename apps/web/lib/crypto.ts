/**
 * Cryptography Utilities
 *
 * Provides secure encryption/decryption and key generation utilities.
 * Used for protecting sensitive data like OAuth tokens and API keys.
 *
 * Security features:
 * - AES-256-GCM authenticated encryption
 * - Unique IV (initialization vector) for each encryption
 * - Authentication tags prevent tampering
 * - Cryptographically secure random key generation
 *
 * CRITICAL SECURITY REQUIREMENTS:
 * - Never reuse IVs with the same key
 * - Always validate authentication tags
 * - Use constant-time comparisons where applicable
 * - Store encryption keys securely (never in code or client bundles)
 */

import crypto from 'crypto';

// Encryption algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Encrypted data format
 *
 * Structure: {iv}:{authTag}:{encryptedData}
 * All parts are base64 encoded for storage/transmission
 */
interface EncryptedData {
  iv: string;
  authTag: string;
  data: string;
}

/**
 * Encrypt a token or sensitive string
 *
 * Uses AES-256-GCM authenticated encryption to protect sensitive data.
 * Each encryption uses a unique random IV, ensuring that encrypting
 * the same plaintext multiple times produces different ciphertexts.
 *
 * @param token - Plaintext token or sensitive string to encrypt
 * @param key - Encryption key (must be 32 bytes / 256 bits)
 * @returns Encrypted data as a colon-separated string (iv:authTag:data)
 *
 * @throws {Error} If encryption fails
 *
 * @example
 * ```typescript
 * import { serverEnv } from '@/lib/env';
 *
 * const token = 'shopify-access-token-123';
 * const key = serverEnv.ENCRYPTION_KEY;
 * const encrypted = encryptToken(token, key);
 *
 * // Store encrypted in database
 * await prisma.shopifyConnection.create({
 *   data: { encryptedToken: encrypted }
 * });
 * ```
 */
export function encryptToken(token: string, key: string): string {
  // Validate inputs
  if (!token) {
    throw new Error('Token to encrypt is required');
  }
  if (!key) {
    throw new Error('Encryption key is required');
  }

  // Ensure key is the correct length (32 bytes)
  const keyBuffer = deriveKey(key);

  // Generate a random IV for this encryption
  // CRITICAL: Never reuse IVs with the same key
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  // Encrypt the token
  let encrypted = cipher.update(token, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get authentication tag
  // This proves the data hasn't been tampered with
  const authTag = cipher.getAuthTag();

  // Return formatted encrypted data: {iv}:{authTag}:{data}
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted token or sensitive string
 *
 * Validates the authentication tag before decrypting to ensure
 * the data hasn't been tampered with.
 *
 * @param encrypted - Encrypted data string (iv:authTag:data format)
 * @param key - Encryption key (must be the same key used for encryption)
 * @returns Decrypted plaintext token
 *
 * @throws {Error} If decryption fails or authentication tag is invalid
 *
 * @example
 * ```typescript
 * import { serverEnv } from '@/lib/env';
 *
 * const connection = await prisma.shopifyConnection.findUnique({
 *   where: { workspaceId }
 * });
 *
 * const key = serverEnv.ENCRYPTION_KEY;
 * const token = decryptToken(connection.encryptedToken, key);
 *
 * // Use token for Shopify API calls
 * ```
 */
export function decryptToken(encrypted: string, key: string): string {
  // Validate inputs
  if (!encrypted) {
    throw new Error('Encrypted token is required');
  }
  if (!key) {
    throw new Error('Encryption key is required');
  }

  // Parse encrypted data
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivBase64, authTagBase64, dataBase64] = parts;

  // Convert from base64
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const data = Buffer.from(dataBase64, 'base64');

  // Validate lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  // Ensure key is the correct length
  const keyBuffer = deriveKey(key);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);

  // Set authentication tag
  // This will be validated during decryption
  decipher.setAuthTag(authTag);

  // Decrypt
  try {
    let decrypted = decipher.update(data.toString('base64'), 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // Authentication tag validation failed or decryption error
    throw new Error('Decryption failed - data may be corrupted or tampered');
  }
}

/**
 * Generate a cryptographically secure idempotency key
 *
 * Idempotency keys are used to prevent duplicate executions
 * of actions (e.g., sending the same email twice, creating
 * duplicate discounts).
 *
 * Format: {prefix}_{timestamp}_{randomBytes}
 *
 * @param prefix - Optional prefix to namespace the key (e.g., 'email', 'discount')
 * @returns Unique idempotency key
 *
 * @example
 * ```typescript
 * const key = generateIdempotencyKey('email');
 * // => 'email_1704067200000_a1b2c3d4e5f6'
 *
 * await executeAction({
 *   type: 'send_email',
 *   idempotencyKey: key,
 *   payload: {...}
 * });
 * ```
 */
export function generateIdempotencyKey(prefix = 'action'): string {
  // Use current timestamp for temporal ordering
  const timestamp = Date.now();

  // Generate cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(8).toString('hex');

  // Combine into a unique key
  return `${prefix}_${timestamp}_${randomBytes}`;
}

/**
 * Generate a secure random token
 *
 * Useful for generating API keys, session tokens, or other
 * security-sensitive random values.
 *
 * @param length - Length in bytes (default: 32)
 * @returns Hex-encoded random token
 *
 * @example
 * ```typescript
 * const apiKey = generateSecureToken(32);
 * // => '64-character hex string'
 * ```
 */
export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure random string (URL-safe base64)
 *
 * @param length - Length in bytes (default: 32)
 * @returns URL-safe base64-encoded random string
 *
 * @example
 * ```typescript
 * const nonce = generateSecureString(16);
 * // => URL-safe base64 string
 * ```
 */
export function generateSecureString(length = 32): string {
  return crypto
    .randomBytes(length)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Hash a value using SHA-256
 *
 * One-way hashing for checksums, dedupe keys, etc.
 * NOT for password hashing (use bcrypt/argon2 for passwords).
 *
 * @param value - Value to hash
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const eventDedupeKey = hashValue(
 *   `${workspaceId}:${eventType}:${timestamp}`
 * );
 * ```
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Create a message authentication code (HMAC)
 *
 * Used for verifying message integrity and authenticity.
 *
 * @param message - Message to authenticate
 * @param secret - Secret key
 * @returns Hex-encoded HMAC-SHA256
 *
 * @example
 * ```typescript
 * const hmac = createHmac('webhook-payload', secretKey);
 * // Compare with received HMAC to verify authenticity
 * ```
 */
export function createHmac(message: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Verify an HMAC signature (timing-safe)
 *
 * @param message - Original message
 * @param signature - Received signature
 * @param secret - Secret key
 * @returns True if signature is valid
 */
export function verifyHmac(
  message: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac(message, secret);

  try {
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

/**
 * Derive a key of the correct length from any string
 *
 * Uses SHA-256 to derive a 32-byte key from any input string.
 * This allows using passphrases or environment variables as keys.
 *
 * @param key - Input key (any length)
 * @returns 32-byte key buffer
 */
function deriveKey(key: string): Buffer {
  // Hash the key to get exactly 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Constant-time string comparison
 *
 * Prevents timing attacks by comparing strings in constant time.
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
export function constantTimeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    // Strings have different lengths or other error
    return false;
  }
}

/**
 * Sanitize sensitive data for logging
 *
 * Redacts sensitive information while preserving structure for debugging.
 *
 * @param value - Value to sanitize
 * @param visibleChars - Number of characters to show (default: 4)
 * @returns Redacted string
 *
 * @example
 * ```typescript
 * const token = 'secret-token-12345';
 * console.log(redactSensitive(token));
 * // => 'secr...2345'
 * ```
 */
export function redactSensitive(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars * 2) {
    return '***';
  }

  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);

  return `${start}...${end}`;
}

// Type exports
export type { EncryptedData };
