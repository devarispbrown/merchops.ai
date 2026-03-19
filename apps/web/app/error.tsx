'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('Global error:', error);

    // Report to Sentry via the SDK — enabled flag in sentry.client.config.ts
    // ensures this is a no-op when NEXT_PUBLIC_SENTRY_DSN is not set.
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-lg w-full">
        <div className="space-y-6">
          {/* Calm error indicator */}
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-error/10">
            <svg
              className="w-6 h-6 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              We encountered an unexpected issue. Your data is safe, and we have
              been notified of the problem.
            </p>
          </div>

          {/* Error details in development only */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground mb-2">
                Technical details
              </summary>
              <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                {error.message}
                {error.stack && (
                  <>
                    {'\n\n'}
                    {error.stack}
                  </>
                )}
              </pre>
            </details>
          )}

          {/* Recovery options */}
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Button onClick={reset} variant="primary" fullWidth>
                Try again
              </Button>
              <Button
                onClick={() => (window.location.href = '/queue')}
                variant="secondary"
                fullWidth
              >
                Go to opportunities
              </Button>
            </div>

            <div className="text-center">
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-muted-foreground hover:text-foreground transition-calm"
              >
                Or reload the page
              </button>
            </div>
          </div>

          {/* Support information */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              If this problem persists, please contact support with error ID:{' '}
              {error.digest || 'N/A'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
