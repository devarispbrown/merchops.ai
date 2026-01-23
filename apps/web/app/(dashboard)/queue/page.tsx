'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useShopifyConnection } from '@/lib/hooks/useShopifyConnection';

// Code splitting for heavy components
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

const OpportunityCard = dynamic(
  () =>
    import('@/components/opportunities/OpportunityCard').then(
      (mod) => mod.OpportunityCard
    ),
  {
    loading: () => <div className="h-40 bg-muted rounded-lg animate-pulse" />,
  }
);

// Mock data for initial UI development
const mockOpportunities = [
  {
    id: '1',
    type: 'reduce-inventory-risk',
    priorityBucket: 'high' as const,
    title: 'High-velocity item approaching stockout',
    whyNow:
      'Your "Classic Cotton Tee" has 12 units left and is selling at 3x normal rate over the past 7 days. At current velocity, you will stock out in 4 days.',
    counterfactual:
      'Without action, you will likely miss $2,400-$3,600 in revenue during the 2-week restock window, plus lose momentum on a trending product.',
    impactRange: '$2,400-$3,600 potential revenue at risk',
    confidence: 0.82,
    decayAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  },
  {
    id: '2',
    type: 're-engage-dormant',
    priorityBucket: 'medium' as const,
    title: 'Re-engage 127 customers at 60-day mark',
    whyNow:
      '127 previously active customers have not ordered in exactly 60 days. Historical data shows re-engagement attempts after 75 days have 40% lower success rates.',
    counterfactual:
      'Without outreach, 80-90% of this cohort will not return organically. You will lose an estimated $8,000-$12,000 in lifetime value from this segment.',
    impactRange: '$8,000-$12,000 LTV at risk',
    confidence: 0.68,
    decayAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '3',
    type: 'protect-margin',
    priorityBucket: 'low' as const,
    title: 'Seasonal demand shift detected',
    whyNow:
      'Your winter collection is showing declining engagement (down 35% week-over-week) while inventory remains at 89% of peak levels.',
    counterfactual:
      'Holding excess seasonal inventory past the season typically results in 60-70% markdowns or dead stock carrying costs.',
    impactRange: '$4,000-$6,000 margin protection opportunity',
    confidence: 0.55,
    decayAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

export default function QueuePage() {
  const [opportunities] = useState(mockOpportunities);
  const { connection, isLoading } = useShopifyConnection();

  const highPriority = opportunities.filter((o) => o.priorityBucket === 'high');
  const mediumPriority = opportunities.filter(
    (o) => o.priorityBucket === 'medium'
  );
  const lowPriority = opportunities.filter((o) => o.priorityBucket === 'low');

  // Show loading state
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Opportunity Queue
          </h1>
          <p className="text-muted-foreground">
            Prioritized actions for your store. Review, edit, and approve when ready.
          </p>
        </div>
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

  // Show connection prompt if not connected
  if (!connection?.isConnected) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Opportunity Queue
          </h1>
          <p className="text-muted-foreground">
            Prioritized actions for your store. Review, edit, and approve when ready.
          </p>
        </div>
        <NoShopifyConnection />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Opportunity Queue
        </h1>
        <p className="text-muted-foreground">
          Prioritized actions for your store. Review, edit, and approve when
          ready.
        </p>
      </div>

      {opportunities.length === 0 ? (
        <NoOpportunities />
      ) : (
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
      )}
    </div>
  );
}
