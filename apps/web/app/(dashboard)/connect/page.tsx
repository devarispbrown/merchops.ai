'use client';

import { useState } from 'react';

import { ConnectForm } from '@/components/shopify/ConnectForm';
import { Card } from '@/components/ui/Card';

export default function ConnectPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async (storeDomain: string) => {
    setIsLoading(true);
    setError('');

    try {
      // Initiate OAuth flow
      const response = await fetch('/api/shopify/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeDomain }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate connection');
      }

      const data = await response.json();
      
      // Redirect to Shopify OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect store');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Connect Your Shopify Store
        </h1>
        <p className="text-muted-foreground">
          Connect your store to start detecting opportunities and automating safe actions.
        </p>
      </div>

      <Card>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Store Connection
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            MerchOps will request the following permissions from your Shopify store:
          </p>
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Read Access:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>Products and inventory levels</li>
                <li>Orders and customer data</li>
                <li>Price rules and discounts</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Write Access:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>Create and manage discount codes</li>
                <li>Update product status (pause/activate)</li>
                <li>Create price rules (discounts)</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-4">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm">
                <p className="text-foreground font-medium mb-1">Your control, always</p>
                <p className="text-muted-foreground">
                  MerchOps will never execute any action without your explicit approval. 
                  Every suggestion can be reviewed, edited, or dismissed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-error-light border border-error/20 p-4">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        <ConnectForm onSubmit={handleConnect} isLoading={isLoading} />
      </Card>
    </div>
  );
}
