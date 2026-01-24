/**
 * Billing Hooks
 * TanStack Query hooks for Stripe billing management
 */

'use client';

import { useQuery, useMutation, type UseQueryOptions } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionStatus {
  subscription_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  plan_id: string;
  plan_name: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end?: string | null;
}

export interface UsageMetrics {
  opportunities: {
    used: number;
    limit: number;
    is_unlimited: boolean;
  };
  executions: {
    used: number;
    limit: number;
    is_unlimited: boolean;
  };
}

export interface CreateCheckoutRequest {
  plan_id: string;
}

export interface CreateCheckoutResponse {
  checkout_url: string;
}

export interface CreatePortalResponse {
  portal_url: string;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const billingKeys = {
  all: ['billing'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  usage: () => [...billingKeys.all, 'usage'] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
  const response = await fetch('/api/billing/status');
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch subscription status');
  }
  return response.json();
}

async function getUsageMetrics(): Promise<UsageMetrics> {
  const response = await fetch('/api/billing/usage');
  if (!response.ok) {
    throw new Error('Failed to fetch usage metrics');
  }
  return response.json();
}

async function createCheckoutSession(
  request: CreateCheckoutRequest
): Promise<CreateCheckoutResponse> {
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to create checkout session');
  }

  return response.json();
}

async function createPortalSession(): Promise<CreatePortalResponse> {
  const response = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to create portal session');
  }

  return response.json();
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Hook to fetch current subscription status
 */
export function useSubscription(
  options?: Omit<UseQueryOptions<SubscriptionStatus | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: () => getSubscriptionStatus(),
    staleTime: 60000, // 1 minute
    ...options,
  });
}

/**
 * Hook to fetch current usage metrics
 */
export function useUsage(
  options?: Omit<UseQueryOptions<UsageMetrics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: billingKeys.usage(),
    queryFn: () => getUsageMetrics(),
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Hook to create Stripe checkout session and redirect
 */
export function useCreateCheckout() {
  return useMutation({
    mutationFn: (data: CreateCheckoutRequest) => createCheckoutSession(data),
    onSuccess: (response: CreateCheckoutResponse) => {
      // Redirect to Stripe checkout
      window.location.href = response.checkout_url;
    },
  });
}

/**
 * Hook to create Stripe customer portal session and redirect
 */
export function useCreatePortal() {
  return useMutation({
    mutationFn: () => createPortalSession(),
    onSuccess: (response: CreatePortalResponse) => {
      // Redirect to Stripe portal
      window.location.href = response.portal_url;
    },
  });
}
