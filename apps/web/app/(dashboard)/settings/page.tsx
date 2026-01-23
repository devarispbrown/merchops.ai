'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useShopifyConnection } from '@/lib/hooks/useShopifyConnection';

// Code splitting for Shopify connection status
const ConnectionStatus = dynamic(
  () =>
    import('@/components/shopify/ConnectionStatus').then(
      (mod) => mod.ConnectionStatus
    ),
  {
    loading: () => <div className="h-6 w-32 bg-muted rounded animate-pulse" />,
  }
);

export default function SettingsPage() {
  const { connection, isLoading } = useShopifyConnection();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your Shopify connection and account preferences.
        </p>
      </div>

      <div className="space-y-6">
        <Link href="/settings/shopify">
          <Card className="hover:border-primary/50 cursor-pointer transition-calm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Shopify Connection
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage your store connection and permissions
                    </p>
                  </div>
                </div>

                {isLoading ? (
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/3"></div>
                  </div>
                ) : (
                  <ConnectionStatus
                    isConnected={connection?.isConnected ?? false}
                    storeDomain={connection?.storeDomain ?? null}
                    lastSyncAt={connection?.lastSyncAt ?? null}
                  />
                )}
              </div>

              <svg
                className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Card>
        </Link>

        <Card>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Account Settings
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Manage your profile and preferences
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-foreground">user@example.com</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <Button variant="secondary" size="sm">
              Edit Account
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Need Help?
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Check out our documentation or contact support if you have questions.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  Documentation
                </Button>
                <Button variant="ghost" size="sm">
                  Contact Support
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
