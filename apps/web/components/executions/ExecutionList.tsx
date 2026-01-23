'use client';

import { ExecutionStatus } from '@prisma/client';
import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { ExecutionSummary } from '@/lib/api/types';
import { formatDateTime, formatRelativeTime } from '@/lib/utils/formatters';

export interface ExecutionListProps {
  executions: ExecutionSummary[];
  isLoading?: boolean;
}

function getStatusVariant(
  status: ExecutionStatus
): 'success' | 'error' | 'warning' | 'secondary' {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'error';
    case 'pending':
    case 'running':
    case 'retrying':
      return 'warning';
    default:
      return 'secondary';
  }
}

function getStatusLabel(status: ExecutionStatus): string {
  switch (status) {
    case 'succeeded':
      return 'Succeeded';
    case 'failed':
      return 'Failed';
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'retrying':
      return 'Retrying';
    default:
      return status;
  }
}

export function ExecutionList({ executions, isLoading }: ExecutionListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-20 bg-muted rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No executions found
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            No executions match your current filters. Try adjusting your search
            criteria.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {executions.map((execution) => (
        <Link
          key={execution.id}
          href={`/history/${execution.id}`}
          className="block"
        >
          <Card className="hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-start justify-between gap-4">
              {/* Left Side: Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={getStatusVariant(execution.status)}>
                    {getStatusLabel(execution.status)}
                  </Badge>
                </div>

                <h3 className="text-base font-medium text-foreground mb-1">
                  Execution {execution.id.slice(0, 8)}
                </h3>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span
                    className="flex items-center gap-1"
                    title={formatDateTime(execution.started_at)}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {formatRelativeTime(execution.started_at)}
                  </span>

                  {execution.error_message && (
                    <span className="flex items-center gap-1 text-error">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Error
                    </span>
                  )}
                </div>
              </div>

              {/* Right Side: Arrow */}
              <div className="flex-shrink-0 text-muted-foreground">
                <svg
                  className="w-5 h-5"
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
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
