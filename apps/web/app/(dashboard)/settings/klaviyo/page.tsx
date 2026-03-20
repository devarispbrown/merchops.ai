'use client';

import { Eye, EyeOff, Link2, Unlink } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function KlaviyoSettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [connection, setConnection] = useState<{
    connected: boolean;
    status?: string;
    connectedAt?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/klaviyo/status')
      .then((res) => res.json())
      .then((data) => {
        setConnection(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/klaviyo/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to connect');
      }

      setConnection({ connected: true, status: 'active', connectedAt: new Date().toISOString() });
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Klaviyo');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/klaviyo/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnection({ connected: false });
      setShowDisconnectConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect from Klaviyo');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-2">Klaviyo</h1>
          <p className="text-muted-foreground">Manage your Klaviyo integration.</p>
        </div>
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">Klaviyo</h1>
        <p className="text-muted-foreground">
          Connect your Klaviyo account to enable email campaign frequency caps and segment syncing.
        </p>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <Card>
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Connection Status</h2>
                <p className="text-sm text-muted-foreground">
                  Klaviyo API integration
                </p>
              </div>
            </div>
            {connection?.connected ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="warning">Not Connected</Badge>
            )}
          </div>

          {connection?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="text-foreground capitalize">{connection.status}</span>
              </div>
              {connection.connectedAt && (
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">Connected</span>
                  <span className="text-foreground">{formatDate(connection.connectedAt)}</span>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                {showDisconnectConfirm ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground flex-1">
                      Are you sure? This will disable Klaviyo features.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDisconnectConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDisconnectConfirm(true)}
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect Klaviyo
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="klaviyo-api-key" className="block text-sm font-medium text-foreground mb-2">
                  Private API Key
                </label>
                <div className="relative">
                  <input
                    id="klaviyo-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Find your private API key in Klaviyo under Account &gt; Settings &gt; API Keys.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleConnect}
                disabled={isConnecting || !apiKey.trim()}
              >
                <Link2 className="w-4 h-4 mr-2" />
                {isConnecting ? 'Connecting...' : 'Connect Klaviyo'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
