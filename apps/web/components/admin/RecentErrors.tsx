'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface ErrorEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning';
  message: string;
  code?: string;
  context?: {
    workspaceId?: string;
    userId?: string;
    path?: string;
    [key: string]: unknown;
  };
  stack?: string;
}

export interface RecentErrorsProps {
  errors: ErrorEntry[];
  maxDisplay?: number;
  onViewFullLogs?: () => void;
}

export function RecentErrors({
  errors,
  maxDisplay = 10,
  onViewFullLogs,
}: RecentErrorsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const formatTimestamp = (date: Date) => {
    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  const getLevelBadge = (level: ErrorEntry['level']) => {
    return level === 'error' ? (
      <Badge variant="error">Error</Badge>
    ) : (
      <Badge variant="warning">Warning</Badge>
    );
  };

  const displayedErrors = errors.slice(0, maxDisplay);
  const hasMore = errors.length > maxDisplay;

  if (errors.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 mb-4">
            <svg
              className="w-6 h-6 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">
            No recent errors
          </h3>
          <p className="text-xs text-muted-foreground">
            System is running smoothly
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Errors
          </h2>
          <Badge variant="error">{errors.length}</Badge>
        </div>

        {/* Error List */}
        <div className="space-y-3">
          {displayedErrors.map((error) => {
            const isExpanded = expandedIds.has(error.id);

            return (
              <div
                key={error.id}
                className="p-4 rounded-lg border border-border bg-muted/30"
              >
                {/* Error Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getLevelBadge(error.level)}
                      {error.code && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {error.code}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{error.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {formatTimestamp(error.timestamp)}
                  </span>
                </div>

                {/* Context (always visible if present) */}
                {error.context && (
                  <div className="text-xs text-muted-foreground mb-2">
                    {error.context.workspaceId && (
                      <div>Workspace: {error.context.workspaceId}</div>
                    )}
                    {error.context.path && <div>Path: {error.context.path}</div>}
                  </div>
                )}

                {/* Expandable Stack Trace */}
                {error.stack && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleExpanded(error.id)}
                      className="text-xs text-primary hover:underline"
                    >
                      {isExpanded ? 'Hide' : 'Show'} stack trace
                    </button>
                    {isExpanded && (
                      <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            {hasMore && (
              <p className="text-xs text-muted-foreground">
                Showing {maxDisplay} of {errors.length} errors
              </p>
            )}
            {onViewFullLogs && (
              <Button
                onClick={onViewFullLogs}
                variant="ghost"
                size="sm"
                className="ml-auto"
              >
                View full logs
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
