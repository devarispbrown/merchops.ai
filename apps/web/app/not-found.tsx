import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full text-center">
        <div className="space-y-6">
          {/* Calm 404 indicator */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted">
            <span className="text-3xl font-medium text-muted-foreground">
              404
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Page not found
            </h1>
            <p className="text-sm text-muted-foreground">
              The page you are looking for does not exist or has been moved.
            </p>
          </div>

          {/* Primary actions */}
          <div className="space-y-3 pt-2">
            <Button asChild variant="primary" fullWidth>
              <Link href="/queue">Go to opportunities</Link>
            </Button>
            <Button asChild variant="secondary" fullWidth>
              <Link href="/">Go home</Link>
            </Button>
          </div>

          {/* Navigation help */}
          <div className="pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">
              Common destinations:
            </p>
            <nav className="flex flex-col gap-2">
              <Link
                href="/queue"
                className="text-sm text-primary hover:underline transition-calm"
              >
                Opportunities queue
              </Link>
              <Link
                href="/history"
                className="text-sm text-primary hover:underline transition-calm"
              >
                Execution history
              </Link>
              <Link
                href="/settings"
                className="text-sm text-primary hover:underline transition-calm"
              >
                Settings
              </Link>
              <Link
                href="/admin"
                className="text-sm text-primary hover:underline transition-calm"
              >
                Admin dashboard
              </Link>
            </nav>
          </div>
        </div>
      </Card>
    </div>
  );
}
