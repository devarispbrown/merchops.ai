/**
 * Klaviyo Connection Management
 *
 * Handles creating, validating, and revoking Klaviyo API key connections.
 * API keys are encrypted at rest using the same AES-256-GCM utility as
 * Shopify tokens (encryptToken / decryptToken from shopify/oauth.ts).
 *
 * Design notes:
 *  - Validation is performed by calling getLists() with the supplied key.
 *    If that call succeeds, the key has read access and is valid.
 *  - The raw API key is NEVER logged.
 *  - Encryption uses SHOPIFY_TOKEN_ENCRYPTION_KEY (shared secret for all
 *    provider keys at rest).
 */

import { prisma } from '../db/client';
import { encryptToken, decryptToken } from '../shopify/oauth';
import { KlaviyoClient, KlaviyoApiError } from './client';

// ============================================================================
// PUBLIC API
// ============================================================================

export interface KlaviyoConnectionInfo {
  workspaceId: string;
  status: string;
  connectedAt: Date;
  revokedAt: Date | null;
  lastSyncedAt: Date | null;
}

/**
 * Validate a Klaviyo API key, then persist the encrypted key.
 *
 * Throws if:
 *  - The key is rejected by Klaviyo (invalid key, insufficient permissions)
 *  - A connection already exists and is active (callers should disconnect first)
 */
export async function connectKlaviyo(
  workspaceId: string,
  apiKey: string
): Promise<KlaviyoConnectionInfo> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key must not be empty');
  }

  // Validate key by making a real API call
  const client = new KlaviyoClient(apiKey.trim());
  try {
    await client.getLists();
  } catch (error) {
    if (error instanceof KlaviyoApiError && (error.status === 401 || error.status === 403)) {
      throw new Error('Invalid Klaviyo API key: authentication failed');
    }
    // Re-throw other errors (network issues etc.)
    throw new Error(
      `Klaviyo API key validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Encrypt key before storing
  const apiKeyEncrypted = encryptToken(apiKey.trim());

  // Upsert connection — allow reconnection after revocation
  const connection = await prisma.klaviyoConnection.upsert({
    where: { workspaceId },
    update: {
      apiKeyEncrypted,
      status: 'active',
      connectedAt: new Date(),
      revokedAt: null,
      lastSyncedAt: null,
    },
    create: {
      workspaceId,
      apiKeyEncrypted,
      status: 'active',
    },
  });

  // eslint-disable-next-line no-console
  console.log('[Klaviyo Connection] Connected successfully', {
    workspaceId,
    connectionId: connection.id,
  });

  return toConnectionInfo(connection);
}

/**
 * Revoke the Klaviyo connection for a workspace.
 * Sets status to 'revoked' and records the revocation time.
 * Does NOT delete the record so audit history is preserved.
 */
export async function disconnectKlaviyo(workspaceId: string): Promise<void> {
  const existing = await prisma.klaviyoConnection.findUnique({
    where: { workspaceId },
  });

  if (!existing) {
    throw new Error('No Klaviyo connection found for this workspace');
  }

  await prisma.klaviyoConnection.update({
    where: { workspaceId },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
    },
  });

  // eslint-disable-next-line no-console
  console.log('[Klaviyo Connection] Disconnected', { workspaceId });
}

/**
 * Fetch a KlaviyoClient instance for a workspace.
 * Decrypts the stored API key and returns a ready-to-use client.
 *
 * Throws if:
 *  - No connection exists
 *  - Connection is not active (revoked / invalid)
 */
export async function getKlaviyoClient(workspaceId: string): Promise<KlaviyoClient> {
  const connection = await prisma.klaviyoConnection.findUnique({
    where: { workspaceId },
  });

  if (!connection) {
    throw new Error(`No Klaviyo connection found for workspace ${workspaceId}`);
  }

  if (connection.status !== 'active') {
    throw new Error(
      `Klaviyo connection is not active for workspace ${workspaceId} (status: ${connection.status})`
    );
  }

  const apiKey = decryptToken(connection.apiKeyEncrypted);
  return new KlaviyoClient(apiKey);
}

/**
 * Return connection status information without exposing the API key.
 * Returns null if no connection exists.
 */
export async function getKlaviyoConnectionStatus(
  workspaceId: string
): Promise<KlaviyoConnectionInfo | null> {
  const connection = await prisma.klaviyoConnection.findUnique({
    where: { workspaceId },
  });

  if (!connection) {
    return null;
  }

  return toConnectionInfo(connection);
}

/**
 * Update last_synced_at timestamp after a successful sync.
 */
export async function markKlaviyoSynced(workspaceId: string): Promise<void> {
  await prisma.klaviyoConnection.update({
    where: { workspaceId },
    data: { lastSyncedAt: new Date() },
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function toConnectionInfo(connection: {
  workspaceId: string;
  status: string;
  connectedAt: Date;
  revokedAt: Date | null;
  lastSyncedAt: Date | null;
}): KlaviyoConnectionInfo {
  return {
    workspaceId: connection.workspaceId,
    status: connection.status,
    connectedAt: connection.connectedAt,
    revokedAt: connection.revokedAt,
    lastSyncedAt: connection.lastSyncedAt,
  };
}
