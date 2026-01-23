import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface NotFoundProps {
  title?: string;
  message?: string;
  showHomeLink?: boolean;
  showBackLink?: boolean;
}

export function NotFound({
  title = 'Page not found',
  message = 'The page you are looking for does not exist or has been moved.',
  showHomeLink = true,
  showBackLink = true,
}: NotFoundProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <div className="space-y-6">
          {/* Calm 404 indicator */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
            <span className="text-2xl font-medium text-muted-foreground">
              404
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>

          <div className="space-y-3 pt-2">
            {showHomeLink && (
              <Button asChild variant="primary" fullWidth>
                <Link href="/queue">Go to opportunities</Link>
              </Button>
            )}
            {showBackLink && (
              <Button
                onClick={() => window.history.back()}
                variant="ghost"
                fullWidth
              >
                Go back
              </Button>
            )}
          </div>

          {/* Navigation help */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">
              You might be looking for:
            </p>
            <nav className="flex flex-col gap-2">
              <Link
                href="/queue"
                className="text-sm text-primary hover:underline"
              >
                Opportunities queue
              </Link>
              <Link
                href="/history"
                className="text-sm text-primary hover:underline"
              >
                Execution history
              </Link>
              <Link
                href="/settings"
                className="text-sm text-primary hover:underline"
              >
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </Card>
    </div>
  );
}
