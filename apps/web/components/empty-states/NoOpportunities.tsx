'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';

export function NoOpportunities() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold text-foreground mb-3">
          All Caught Up
        </h2>

        <p className="text-base text-muted-foreground mb-6 leading-relaxed">
          Your queue is empty. MerchOps is actively monitoring your store and will surface new 
          opportunities as signals are detected.
        </p>

        <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            How opportunities are created:
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary font-medium">•</span>
              <span>Inventory levels cross thresholds or products go out of stock</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-medium">•</span>
              <span>Customer segments show inactivity patterns worth addressing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-medium">•</span>
              <span>Product velocity spikes indicate trending items</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-medium">•</span>
              <span>Other store signals suggest actionable moments</span>
            </li>
          </ul>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Opportunities are prioritized by urgency and impact. You&apos;ll be notified when new ones appear.
        </p>

        <Link href="/settings/shopify">
          <Button variant="ghost">
            View Connection Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
