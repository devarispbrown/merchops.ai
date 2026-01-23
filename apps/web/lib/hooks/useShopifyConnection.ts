/**
 * Shopify Connection Hooks
 * React Query hooks for Shopify connection management
 */

'use client';

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import {
  getConnectionStatus,
  initiateConnection,
  disconnect,
} from '../api/shopify';
import type {
  ShopifyConnectionResponse,
  InitiateConnectionRequest,
  InitiateConnectionResponse,
} from '../api/types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const shopifyKeys = {
  all: ['shopify'] as const,
  connection: () => [...shopifyKeys.all, 'connection'] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Hook to fetch Shopify connection status
 */
export function useShopifyConnectionQuery(
  options?: Omit<UseQueryOptions<ShopifyConnectionResponse | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shopifyKeys.connection(),
    queryFn: () => getConnectionStatus(),
    // Check connection status frequently
    refetchOnMount: 'always',
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

/**
 * Transformed connection data for easier consumption by components
 */
interface TransformedConnection {
  isConnected: boolean;
  storeDomain: string | null;
  lastSyncAt: string | null;
  scopes: string[];
  id?: string;
  workspaceId?: string;
  installedAt?: string;
  revokedAt?: string | null;
}

/**
 * Combined hook that provides both connection status and disconnect mutation
 * @returns Object with connection data, loading states, disconnect function, and refetch
 */
export function useShopifyConnection(
  options?: Omit<UseQueryOptions<ShopifyConnectionResponse | null>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: shopifyKeys.connection(),
    queryFn: () => getConnectionStatus(),
    refetchOnMount: 'always',
    staleTime: 30000, // 30 seconds
    ...options,
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopifyKeys.connection() });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });

  // Transform the connection data for easier consumption
  const transformedConnection: TransformedConnection | null = query.data
    ? {
        isConnected: query.data.status === 'active',
        storeDomain: query.data.store_domain,
        lastSyncAt: query.data.installed_at, // Using installed_at as last sync for now
        scopes: query.data.scopes,
        id: query.data.id,
        workspaceId: query.data.workspace_id,
        installedAt: query.data.installed_at,
        revokedAt: query.data.revoked_at,
      }
    : null;

  return {
    connection: transformedConnection,
    isLoading: query.isLoading,
    error: query.error,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    refetch: query.refetch,
  };
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Hook to initiate Shopify OAuth connection
 * Returns authorization URL to redirect user to
 */
export function useInitiateConnection() {
  return useMutation({
    mutationFn: (data: InitiateConnectionRequest) => initiateConnection(data),
    onSuccess: (response: InitiateConnectionResponse) => {
      // Redirect to Shopify OAuth page
      window.location.href = response.authorization_url;
    },
  });
}

/**
 * Hook to disconnect Shopify store
 * Revokes access token and updates connection status
 */
export function useDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      // Invalidate connection status
      queryClient.invalidateQueries({ queryKey: shopifyKeys.connection() });

      // Clear all other cached data that depends on Shopify connection
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });
}
