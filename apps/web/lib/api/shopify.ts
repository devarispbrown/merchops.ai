/**
 * Shopify API Client
 * API methods for Shopify connection management
 */

import { get, post, del } from './client';
import type {
  ShopifyConnectionResponse,
  InitiateConnectionRequest,
  InitiateConnectionResponse,
} from './types';

// ============================================================================
// SHOPIFY CONNECTION API
// ============================================================================

/**
 * Get current Shopify connection status
 */
export async function getConnectionStatus(): Promise<ShopifyConnectionResponse | null> {
  return get<ShopifyConnectionResponse | null>('/shopify/connection');
}

/**
 * Initiate Shopify OAuth connection
 * Returns authorization URL to redirect user to
 */
export async function initiateConnection(
  data: InitiateConnectionRequest
): Promise<InitiateConnectionResponse> {
  return post<InitiateConnectionResponse>('/shopify/connect', data);
}

/**
 * Disconnect Shopify store
 * Revokes access token and updates connection status
 */
export async function disconnect(): Promise<void> {
  await del('/shopify/connection');
}
