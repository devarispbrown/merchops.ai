'use client';

import { AlertTriangle, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import { UpgradeModal } from './UpgradeModal';

export interface UpgradePromptProps {
  metric: string;
  percentage: number;
  isAtLimit: boolean;
}

export function UpgradePrompt({
  metric,
  percentage,
  isAtLimit,
}: UpgradePromptProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (percentage < 80) {
    return null;
  }

  const isAlert = isAtLimit;

  return (
    <>
      <div
        className={cn(
          'rounded-lg border p-4',
          isAlert
            ? 'bg-red-50 border-red-200'
            : 'bg-yellow-50 border-yellow-200'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {isAlert ? (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            ) : (
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                'text-sm font-semibold mb-1',
                isAlert ? 'text-red-900' : 'text-yellow-900'
              )}
            >
              {isAlert
                ? `You've reached your ${metric} limit`
                : `You're approaching your ${metric} limit`}
            </h3>
            <p
              className={cn(
                'text-sm mb-3',
                isAlert ? 'text-red-700' : 'text-yellow-700'
              )}
            >
              {isAlert
                ? `Upgrade to continue using ${metric}.`
                : `You're at ${percentage.toFixed(0)}% of your ${metric} limit. Upgrade to avoid interruptions.`}
            </p>

            <Button
              variant={isAlert ? 'danger' : 'primary'}
              size="sm"
              onClick={() => setIsModalOpen(true)}
            >
              Upgrade Now
            </Button>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
