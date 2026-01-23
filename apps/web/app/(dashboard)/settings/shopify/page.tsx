'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ConnectionStatus } from '@/components/shopify/ConnectionStatus';
import { DisconnectModal } from '@/components/shopify/DisconnectModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useShopifyConnection } from '@/lib/hooks/useShopifyConnection';

export default function ShopifySettingsPage() {
  const { connection, isLoading, disconnect, isDisconnecting } = useShopifyConnection();
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const handleDisconnect = () => {
    disconnect();
    setShowDisconnectModal(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Shopify Connection
          </h1>
          <p className="text-muted-foreground">
            Manage your Shopify store connection and permissions.
          </p>
        </div>
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
        </Card>
      </div>
    );
  }

  const isConnected = connection?.isConnected ?? false;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Shopify Connection
        </h1>
        <p className="text-muted-foreground">
          Manage your Shopify store connection and permissions.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Connection Status
            </h2>
            <ConnectionStatus
              isConnected={isConnected}
              storeDomain={connection?.storeDomain ?? null}
              lastSyncAt={connection?.lastSyncAt ?? null}
            />
          </div>

          {isConnected ? (
            <div className="space-y-6">
              <div className="pt-6 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Granted Permissions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {connection?.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary">
                      {scope}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  These are the permissions MerchOps has to access your store data and perform actions.
                </p>
              </div>

              <div className="pt-6 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Disconnect Store
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Disconnecting your store will stop all opportunity detection and prevent any new actions 
                  from being executed. This action can be reversed by reconnecting your store.
                </p>
                <Button
                  variant="danger"
                  onClick={() => setShowDisconnectModal(true)}
                >
                  Disconnect Store
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-muted-foreground"
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
              <h3 className="text-lg font-medium text-foreground mb-2">
                No store connected
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Connect your Shopify store to start receiving intelligent opportunities 
                and automate safe actions.
              </p>
              <Link href="/connect">
                <Button variant="primary">Connect Shopify Store</Button>
              </Link>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            About Permissions
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            MerchOps requests minimal permissions required to operate safely and effectively.
          </p>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Why we need these permissions:</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-medium mt-0.5">•</span>
                  <div>
                    <span className="font-medium text-foreground">Read products & inventory:</span>
                    <span className="ml-1">To detect low stock situations and trending products</span>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-medium mt-0.5">•</span>
                  <div>
                    <span className="font-medium text-foreground">Read orders & customers:</span>
                    <span className="ml-1">To identify inactive customers and analyze purchasing patterns</span>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-medium mt-0.5">•</span>
                  <div>
                    <span className="font-medium text-foreground">Write discounts & product status:</span>
                    <span className="ml-1">To execute approved actions like creating discount codes or pausing products</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <div className="flex gap-3">
                <svg
                  className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <div className="text-sm">
                  <p className="text-foreground font-medium mb-1">Security & Privacy</p>
                  <p className="text-muted-foreground">
                    We never store payment information, and all actions require your explicit approval. 
                    You maintain complete control over your store.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <DisconnectModal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        onConfirm={handleDisconnect}
        isLoading={isDisconnecting}
      />
    </div>
  );
}
