'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';

interface LimitExceededBannerProps {
  metric: string;
  used: number;
  limit: number;
  onDismiss?: () => void;
}

export function LimitExceededBanner({ metric, used, limit, onDismiss }: LimitExceededBannerProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-900">
            Plan limit reached
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            You&apos;ve used {used} of {limit} {metric} this billing period.
            Upgrade your plan to continue.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <Link href="/settings/billing">
              <Button variant="primary" size="sm">
                Upgrade Plan
              </Button>
            </Link>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
