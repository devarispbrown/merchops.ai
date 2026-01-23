'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EventsList } from '@/components/opportunities/EventsList';
import {
  WhyNowCard,
  CounterfactualCard,
  ImpactRangeDisplay,
  ConfidenceIndicatorDisplay,
} from '@/components/opportunities/OpportunityDetail';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useCreateDraft } from '@/lib/hooks/useDrafts';
import {
  useOpportunity,
  useDismissOpportunity,
} from '@/lib/hooks/useOpportunities';
import { useToast } from '@/lib/hooks/useToast';
import { OperatorIntent, ExecutionType } from '@/server/actions/types';

export default function OpportunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);

  // Fetch opportunity data
  const { data: opportunity, isLoading, error } = useOpportunity(params.id);

  // Mutations
  const createDraftMutation = useCreateDraft();
  const dismissOpportunityMutation = useDismissOpportunity();

  // Map opportunity type to operator intent and execution type
  const getActionConfig = (opportunityType: string) => {
    switch (opportunityType) {
      case 'reduce_inventory_risk':
        return {
          operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
          executionType: ExecutionType.DISCOUNT_DRAFT,
        };
      case 'reengage_dormant_customers':
        return {
          operatorIntent: OperatorIntent.REENGAGE_DORMANT,
          executionType: ExecutionType.WINBACK_EMAIL,
        };
      case 'protect_margin':
        return {
          operatorIntent: OperatorIntent.PROTECT_MARGIN,
          executionType: ExecutionType.PAUSE_PRODUCT,
        };
      default:
        return {
          operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
          executionType: ExecutionType.DISCOUNT_DRAFT,
        };
    }
  };

  const handleCreateDraft = async () => {
    if (!opportunity) return;

    try {
      const config = getActionConfig(opportunity.type);
      const result = await createDraftMutation.mutateAsync({
        opportunityId: params.id,
        operatorIntent: config.operatorIntent,
        executionType: config.executionType,
      });
      showToast('Draft created successfully', 'success');
      router.push(`/drafts/${result.id}`);
    } catch (error) {
      console.error('Failed to create draft:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to create draft',
        'error'
      );
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissOpportunityMutation.mutateAsync(params.id);
      showToast('Opportunity dismissed', 'success');
      router.push('/queue');
    } catch (error) {
      console.error('Failed to dismiss opportunity:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to dismiss opportunity',
        'error'
      );
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading opportunity...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !opportunity) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <p className="text-red-600">Failed to load opportunity</p>
          <Button onClick={() => router.push('/queue')}>Back to Queue</Button>
        </div>
      </div>
    );
  }

  const daysUntilDecay = opportunity.decay_at
    ? Math.ceil(
        (new Date(opportunity.decay_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/queue')}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Queue
            </Button>
            <Badge
              variant={
                opportunity.priority_bucket === 'high'
                  ? 'high'
                  : opportunity.priority_bucket === 'medium'
                    ? 'medium'
                    : 'low'
              }
            >
              {opportunity.priority_bucket} Priority
            </Badge>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">
            {formatOpportunityType(opportunity.type)}
          </h1>
          <p className="text-muted-foreground">{opportunity.rationale}</p>
        </div>

        {daysUntilDecay !== null && daysUntilDecay > 0 && (
          <Card className="px-4 py-3">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-warning"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {daysUntilDecay} days
                </p>
                <p className="text-xs text-muted-foreground">until decay</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <WhyNowCard whyNow={opportunity.why_now} />
          <CounterfactualCard counterfactual={opportunity.counterfactual} />
          {opportunity.events && (
            <EventsList
              events={opportunity.events.map((e) => ({
                ...e,
                type: e.type as unknown as import('@/server/events/types').EventType,
              }))}
            />
          )}
        </div>

        <div className="space-y-6">
          <ImpactRangeDisplay impactRange={opportunity.impact_range} />
          <ConfidenceIndicatorDisplay confidence={opportunity.confidence} />

          {/* Action Buttons */}
          <Card>
            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={handleCreateDraft}
                disabled={createDraftMutation.isPending}
              >
                {createDraftMutation.isPending ? 'Creating Draft...' : 'Create Draft'}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setShowDismissConfirm(true)}
                disabled={dismissOpportunityMutation.isPending}
              >
                {dismissOpportunityMutation.isPending ? 'Dismissing...' : 'Dismiss'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Dismissed opportunities won&apos;t reappear unless conditions
                change significantly
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Dismiss Confirmation Modal */}
      <Modal
        isOpen={showDismissConfirm}
        onClose={() => setShowDismissConfirm(false)}
        title="Dismiss Opportunity"
        description="Are you sure you want to dismiss this opportunity?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowDismissConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowDismissConfirm(false);
                handleDismiss();
              }}
              disabled={dismissOpportunityMutation.isPending}
            >
              Dismiss
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Dismissed opportunities will not reappear unless conditions change
          significantly.
        </p>
      </Modal>
    </div>
  );
}

function formatOpportunityType(type: string): string {
  const formatted: Record<string, string> = {
    reduce_inventory_risk: 'Reduce Inventory Risk',
    reengage_dormant_customers: 'Re-engage Dormant Customers',
    protect_margin: 'Protect Margin',
  };
  return formatted[type] || type;
}
