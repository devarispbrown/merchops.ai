'use client';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  message?: string;
  lastChecked: Date;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  database: HealthCheckResult;
  redis: HealthCheckResult;
  shopify?: HealthCheckResult;
}

export interface HealthStatusProps {
  health: SystemHealth;
}

export function HealthStatus({ health }: HealthStatusProps) {
  const getStatusBadge = (status: HealthCheckResult['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success">Healthy</Badge>;
      case 'degraded':
        return <Badge variant="warning">Degraded</Badge>;
      case 'down':
        return <Badge variant="error">Down</Badge>;
    }
  };

  const getStatusIcon = (status: HealthCheckResult['status']) => {
    switch (status) {
      case 'healthy':
        return (
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        );
      case 'degraded':
        return <div className="w-2 h-2 rounded-full bg-warning" />;
      case 'down':
        return <div className="w-2 h-2 rounded-full bg-error" />;
    }
  };

  const formatLatency = (latency?: number) => {
    if (!latency) return 'N/A';
    return `${latency}ms`;
  };

  const formatLastChecked = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <Card>
      <div className="space-y-6">
        {/* Overall Status */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            System Health
          </h2>
          {getStatusBadge(health.overall)}
        </div>

        {/* Individual Services */}
        <div className="space-y-4">
          {/* Database */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3 flex-1">
              {getStatusIcon(health.database.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-foreground">
                    Database
                  </h3>
                  {getStatusBadge(health.database.status)}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Latency: {formatLatency(health.database.latency)}</span>
                  <span>•</span>
                  <span>{formatLastChecked(health.database.lastChecked)}</span>
                </div>
                {health.database.message && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {health.database.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Redis */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3 flex-1">
              {getStatusIcon(health.redis.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-foreground">Redis</h3>
                  {getStatusBadge(health.redis.status)}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Latency: {formatLatency(health.redis.latency)}</span>
                  <span>•</span>
                  <span>{formatLastChecked(health.redis.lastChecked)}</span>
                </div>
                {health.redis.message && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {health.redis.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Shopify (optional) */}
          {health.shopify && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3 flex-1">
                {getStatusIcon(health.shopify.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-foreground">
                      Shopify API
                    </h3>
                    {getStatusBadge(health.shopify.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      Latency: {formatLatency(health.shopify.latency)}
                    </span>
                    <span>•</span>
                    <span>{formatLastChecked(health.shopify.lastChecked)}</span>
                  </div>
                  {health.shopify.message && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {health.shopify.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Last Updated */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Health checks run every 30 seconds
          </p>
        </div>
      </div>
    </Card>
  );
}
