/**
 * TanStack Query Provider
 * Configures QueryClient with default options for the entire application
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { type ReactNode } from 'react';

// ============================================================================
// DEFAULT QUERY OPTIONS
// ============================================================================

const DEFAULT_STALE_TIME = 1000 * 60 * 5; // 5 minutes
const DEFAULT_CACHE_TIME = 1000 * 60 * 30; // 30 minutes
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY = (attemptIndex: number) =>
  Math.min(1000 * 2 ** attemptIndex, 30000); // Exponential backoff, max 30s

// ============================================================================
// QUERY CLIENT CONFIGURATION
// ============================================================================

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: how long until data is considered stale
        staleTime: DEFAULT_STALE_TIME,

        // Cache time: how long to keep unused data in cache
        gcTime: DEFAULT_CACHE_TIME,

        // Retry configuration
        retry: DEFAULT_RETRY_COUNT,
        retryDelay: DEFAULT_RETRY_DELAY,

        // Refetch configuration
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,

        // Error handling
        throwOnError: false,
      },
      mutations: {
        // Retry configuration for mutations (more conservative)
        retry: 1,
        retryDelay: DEFAULT_RETRY_DELAY,

        // Error handling
        throwOnError: false,
      },
    },
  });
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // NOTE: Avoid useState when initializing the query client if you don't
  // have a suspense boundary between this and the code that may suspend
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show DevTools in development only */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom"
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  );
}
