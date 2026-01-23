'use client';

import { Badge } from '@/components/ui/Badge';

interface ConnectionStatusProps {
  isConnected: boolean;
  storeDomain: string | null;
  lastSyncAt: string | null;
}

export function ConnectionStatus({
  isConnected,
  storeDomain,
  lastSyncAt,
}: ConnectionStatusProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Status</span>
        <Badge variant={isConnected ? 'success' : 'secondary'}>
          {isConnected ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {isConnected && storeDomain && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Store Domain</span>
            <span className="text-sm text-muted-foreground">{storeDomain}</span>
          </div>

          {lastSyncAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Last Sync</span>
              <span className="text-sm text-muted-foreground">
                {new Date(lastSyncAt).toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
