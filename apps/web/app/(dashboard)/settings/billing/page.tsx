'use client';

import { CreditCard, ExternalLink, Calendar, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { BillingHistory } from '@/components/billing/BillingHistory';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { UsageDisplay } from '@/components/billing/UsageDisplay';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  useSubscription,
  useUsage,
  useCreatePortal,
} from '@/lib/hooks/useBilling';

export default function BillingPage() {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const { data: subscription, isLoading: isLoadingSubscription } =
    useSubscription();
  const { data: usage, isLoading: isLoadingUsage } = useUsage();
  const createPortal = useCreatePortal();

  const handleManageSubscription = () => {
    createPortal.mutate();
  };

  const getStatusBadge = () => {
    if (!subscription) return null;

    switch (subscription.status) {
      case 'trialing':
        return <Badge variant="warning">Trial</Badge>;
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'past_due':
        return <Badge variant="error">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="error">Canceled</Badge>;
      case 'incomplete':
        return <Badge variant="warning">Incomplete</Badge>;
      default:
        return null;
    }
  };

  const getTrialDaysRemaining = () => {
    if (!subscription?.trial_end) return null;

    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const daysRemaining = Math.ceil(
      (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysRemaining > 0 ? daysRemaining : 0;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const trialDaysRemaining = getTrialDaysRemaining();

  // Calculate usage percentages for prompts
  const opportunitiesPercentage = usage?.opportunities.is_unlimited
    ? 0
    : ((usage?.opportunities.used || 0) / (usage?.opportunities.limit || 1)) *
      100;

  const executionsPercentage = usage?.executions.is_unlimited
    ? 0
    : ((usage?.executions.used || 0) / (usage?.executions.limit || 1)) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Billing & Usage
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription, view usage, and billing history.
        </p>
      </div>

      <div className="space-y-6">
        {/* Trial Banner */}
        {subscription?.status === 'trialing' && trialDaysRemaining !== null && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Calendar className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-teal-900 mb-1">
                  Trial Active
                </h3>
                <p className="text-sm text-teal-700 mb-3">
                  {trialDaysRemaining > 0 ? (
                    <>
                      Your trial ends in{' '}
                      <strong>{trialDaysRemaining} days</strong>. Select a plan
                      to continue after your trial.
                    </>
                  ) : (
                    <>
                      Your trial has ended. Select a plan to continue using
                      MerchOps.
                    </>
                  )}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsUpgradeModalOpen(true)}
                >
                  Choose a Plan
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan Card */}
        <Card>
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Current Plan
                </h2>
                <p className="text-sm text-muted-foreground">
                  Subscription details and status
                </p>
              </div>
            </div>
            {getStatusBadge()}
          </div>

          {isLoadingSubscription ? (
            <div className="space-y-4">
              <div className="animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
          ) : subscription ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-foreground">
                  {subscription.plan_name}
                </h3>
                {subscription.status === 'trialing' && trialDaysRemaining !== null && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Trial ends {formatDate(subscription.trial_end!)}
                  </p>
                )}
                {subscription.status === 'active' && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Next billing date:{' '}
                    {formatDate(subscription.current_period_end)}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsUpgradeModalOpen(true)}
                >
                  Upgrade Plan
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={createPortal.isPending}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Manage Subscription
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                No active subscription
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsUpgradeModalOpen(true)}
              >
                Choose a Plan
              </Button>
            </div>
          )}
        </Card>

        {/* Usage Metrics Card */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Usage This Period
              </h2>
              <p className="text-sm text-muted-foreground">
                Track your current plan usage
              </p>
            </div>
          </div>

          {isLoadingUsage ? (
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                  <div className="h-2 bg-muted rounded w-full" />
                </div>
              ))}
            </div>
          ) : usage ? (
            <div className="space-y-6">
              {/* Upgrade prompts */}
              {opportunitiesPercentage >= 80 && (
                <UpgradePrompt
                  metric="active opportunities"
                  percentage={opportunitiesPercentage}
                  isAtLimit={opportunitiesPercentage >= 100}
                />
              )}

              {executionsPercentage >= 80 && (
                <UpgradePrompt
                  metric="monthly executions"
                  percentage={executionsPercentage}
                  isAtLimit={executionsPercentage >= 100}
                />
              )}

              {/* Usage displays */}
              <UsageDisplay
                metric="Active Opportunities"
                used={usage.opportunities.used}
                limit={usage.opportunities.limit}
                isUnlimited={usage.opportunities.is_unlimited}
              />

              <UsageDisplay
                metric="Monthly Executions"
                used={usage.executions.used}
                limit={usage.executions.limit}
                isUnlimited={usage.executions.is_unlimited}
              />
            </div>
          ) : null}
        </Card>

        {/* Billing History */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Billing History
          </h2>
          <BillingHistory
            events={[
              // Mock data for now - will be replaced with actual API
            ]}
            isLoading={false}
          />
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentPlanId={subscription?.plan_id}
      />
    </div>
  );
}
