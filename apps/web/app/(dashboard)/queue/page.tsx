'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useOpportunitiesList } from '@/lib/hooks/useOpportunities';
import { useShopifyConnection } from '@/lib/hooks/useShopifyConnection';

const NoOpportunities = dynamic(
  () =>
    import('@/components/empty-states/NoOpportunities').then(
      (mod) => mod.NoOpportunities
    ),
  {
    loading: () => <div className="h-48 bg-muted rounded animate-pulse" />,
  }
);

const NoShopifyConnection = dynamic(
  () =>
    import('@/components/empty-states/NoShopifyConnection').then(
      (mod) => mod.NoShopifyConnection
    ),
  {
    loading: () => <div className="h-48 bg-muted rounded animate-pulse" />,
  }
);

const SyncInProgress = dynamic(
  () =>
    import('@/components/empty-states/SyncInProgress').then(
      (mod) => mod.SyncInProgress
    ),
  {
    loading: () => <div className="h-48 bg-muted rounded animate-pulse" />,
  }
);

const OpportunityCard = dynamic(
  () =>
    import('@/components/opportunities/OpportunityCard').then(
      (mod) => mod.OpportunityCard
    ),
  {
    loading: () => <div className="h-40 bg-muted rounded-lg animate-pulse" />,
  }
);

// First-opportunity banner key for localStorage
const FIRST_OPP_BANNER_KEY = 'merchops_first_opp_banner_dismissed';

export default function QueuePage() {
  const { connection, isLoading: isLoadingConnection } = useShopifyConnection();
  const {
    data: opportunitiesData,
    isLoading: isLoadingOpportunities,
  } = useOpportunitiesList(
    {
      filters: {
        state: ['new', 'viewed'],
      },
      sort_by: 'priority_bucket',
      sort_order: 'desc',
    },
    {
      enabled: connection?.isConnected === true && connection?.syncState !== 'syncing',
    }
  );

  // Initialize banner dismissed state from localStorage (runs once on mount)
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(FIRST_OPP_BANNER_KEY) === 'true';
  });

  const opportunities = opportunitiesData?.data ?? [];

  const showFirstOppBanner = opportunities.length > 0 && !bannerDismissed;

  const dismissFirstOppBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem(FIRST_OPP_BANNER_KEY, 'true');
  };

  const highPriority = opportunities.filter((o) => o.priority_bucket === 'high');
  const mediumPriority = opportunities.filter((o) => o.priority_bucket === 'medium');
  const lowPriority = opportunities.filter((o) => o.priority_bucket === 'low');

  const isLoading = isLoadingConnection || isLoadingOpportunities;

  // Page header (shared across all states)
  const pageHeader = (
    <div className="mb-8">
      <h1 className="text-3xl font-semibold text-foreground mb-2">
        Opportunity Queue
      </h1>
      <p className="text-muted-foreground">
        Prioritized actions for your store. Review, edit, and approve when ready.
      </p>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        {pageHeader}
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
        </Card>
      </div>
    );
  }

  // No Shopify connection
  if (!connection?.isConnected) {
    return (
      <div className="max-w-5xl mx-auto">
        {pageHeader}
        <NoShopifyConnection />
      </div>
    );
  }

  // Sync in progress
  if (connection.syncState === 'syncing') {
    return (
      <div className="max-w-5xl mx-auto">
        {pageHeader}
        <SyncInProgress />
      </div>
    );
  }

  // No opportunities
  if (opportunities.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        {pageHeader}
        <NoOpportunities />
      </div>
    );
  }

  // Render priority-grouped queue
  return (
    <div className="max-w-5xl mx-auto">
      {pageHeader}

      {/* First-opportunity banner */}
      {showFirstOppBanner && (
        <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 p-4 flex items-center justify-between">
          <p className="text-sm text-teal-800">
            Your first opportunity is ready for review
          </p>
          <button
            onClick={dismissFirstOppBanner}
            className="text-teal-600 hover:text-teal-800 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-8">
        {highPriority.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="high">High Priority</Badge>
              <span className="text-sm text-muted-foreground">
                {highPriority.length}{' '}
                {highPriority.length === 1 ? 'opportunity' : 'opportunities'}
              </span>
            </div>
            <div className="space-y-4">
              {highPriority.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                />
              ))}
            </div>
          </section>
        )}

        {mediumPriority.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="medium">Medium Priority</Badge>
              <span className="text-sm text-muted-foreground">
                {mediumPriority.length}{' '}
                {mediumPriority.length === 1
                  ? 'opportunity'
                  : 'opportunities'}
              </span>
            </div>
            <div className="space-y-4">
              {mediumPriority.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                />
              ))}
            </div>
          </section>
        )}

        {lowPriority.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="low">Low Priority</Badge>
              <span className="text-sm text-muted-foreground">
                {lowPriority.length}{' '}
                {lowPriority.length === 1 ? 'opportunity' : 'opportunities'}
              </span>
            </div>
            <div className="space-y-4">
              {lowPriority.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
