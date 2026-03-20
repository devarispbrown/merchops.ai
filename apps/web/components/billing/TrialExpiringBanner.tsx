'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { useSubscription } from '@/lib/hooks/useBilling';

export function TrialExpiringBanner() {
  const { data: subscription } = useSubscription();

  if (!subscription) return null;
  if (subscription.status !== 'trialing') return null;
  if (!subscription.trial_end) return null;

  const trialEnd = new Date(subscription.trial_end);
  const now = new Date();
  const daysRemaining = Math.ceil(
    (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Only show when <= 3 days remain
  if (daysRemaining > 3) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <p className="text-sm text-amber-800">
            Your trial ends in{' '}
            <strong>{daysRemaining > 0 ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}` : 'less than a day'}</strong>
            {' '}&mdash; choose a plan to continue using MerchOps.
          </p>
        </div>
        <Link href="/settings/billing">
          <Button variant="primary" size="sm">
            Choose a Plan
          </Button>
        </Link>
      </div>
    </div>
  );
}
