'use client';

import { ExecutionStatus } from '@prisma/client';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { ExecutionResponse } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import {
  formatDateTime,
  formatJSON,
  formatDuration,
} from '@/lib/utils/formatters';

export interface ExecutionDetailProps {
  execution: ExecutionResponse;
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

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-muted hover:bg-accent transition-calm"
      >
        <span className="font-medium text-foreground">{title}</span>
        <svg
          className={cn('w-5 h-5 text-muted-foreground transition-transform', {
            'rotate-180': isOpen,
          })}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && <div className="p-4 bg-card">{children}</div>}
    </div>
  );
}

function JSONBlock({ data }: { data: unknown }) {
  return (
    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono border border-border">
      <code>{formatJSON(data)}</code>
    </pre>
  );
}

function StatusTimeline({ execution }: { execution: ExecutionResponse }) {
  const timeline = [
    {
      label: 'Started',
      timestamp: execution.started_at,
      status: 'completed',
    },
  ];

  if (execution.status === 'running' || execution.status === 'retrying') {
    timeline.push({
      label: execution.status === 'retrying' ? 'Retrying' : 'Running',
      timestamp: new Date().toISOString(),
      status: 'current',
    });
  }

  if (execution.finished_at) {
    timeline.push({
      label: execution.status === 'succeeded' ? 'Succeeded' : 'Failed',
      timestamp: execution.finished_at,
      status: 'completed',
    });
  }

  return (
    <div className="space-y-3">
      {timeline.map((item, index) => (
        <div key={index} className="flex items-start gap-3">
          <div className="relative">
            <div
              className={cn(
                'w-2 h-2 rounded-full mt-2',
                item.status === 'completed'
                  ? 'bg-primary'
                  : 'bg-warning animate-pulse'
              )}
            />
            {index < timeline.length - 1 && (
              <div className="absolute left-1 top-4 w-px h-8 bg-border" />
            )}
          </div>
          <div className="flex-1 pt-0.5">
            <div className="text-sm font-medium text-foreground">
              {item.label}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateTime(item.timestamp)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExecutionDetail({ execution }: ExecutionDetailProps) {
  const duration =
    execution.finished_at && execution.started_at
      ? new Date(execution.finished_at).getTime() -
        new Date(execution.started_at).getTime()
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={getStatusVariant(execution.status)}>
                {getStatusLabel(execution.status)}
              </Badge>
              {execution.status === 'retrying' && (
                <span className="text-xs text-muted-foreground">
                  Attempting retry
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Execution Details
            </h2>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Execution ID:</span>
            <span className="ml-2 font-mono text-foreground">
              {execution.id}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Idempotency Key:</span>
            <span className="ml-2 font-mono text-xs text-foreground">
              {execution.idempotency_key}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Started:</span>
            <span className="ml-2 text-foreground">
              {formatDateTime(execution.started_at)}
            </span>
          </div>
          {execution.finished_at && (
            <div>
              <span className="text-muted-foreground">Finished:</span>
              <span className="ml-2 text-foreground">
                {formatDateTime(execution.finished_at)}
              </span>
            </div>
          )}
          {duration && (
            <div>
              <span className="text-muted-foreground">Duration:</span>
              <span className="ml-2 text-foreground">
                {formatDuration(duration)}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Status Timeline */}
      <Card>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Execution Timeline
        </h3>
        <StatusTimeline execution={execution} />
      </Card>

      {/* Error Details */}
      {execution.status === 'failed' && execution.error_message && (
        <Card className="border-error">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-error"
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
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-error mb-2">
                Execution Failed
              </h3>
              {execution.error_code && (
                <div className="text-sm text-muted-foreground mb-2">
                  Error Code: <code className="font-mono">{execution.error_code}</code>
                </div>
              )}
              <p className="text-sm text-foreground">{execution.error_message}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Request Payload */}
      <CollapsibleSection title="Request Payload" defaultOpen={false}>
        <JSONBlock data={execution.request_payload} />
      </CollapsibleSection>

      {/* Provider Response */}
      {execution.provider_response && (
        <CollapsibleSection title="Provider Response" defaultOpen={false}>
          <JSONBlock data={execution.provider_response} />
        </CollapsibleSection>
      )}

      {/* Action Draft Details */}
      <CollapsibleSection title="Action Draft Details" defaultOpen={false}>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Operator Intent:</span>
            <span className="ml-2 text-foreground">
              {execution.draft.operator_intent.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Execution Type:</span>
            <span className="ml-2 text-foreground">
              {execution.draft.execution_type.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Opportunity ID:</span>
            <span className="ml-2 font-mono text-xs text-foreground">
              {execution.draft.opportunity_id}
            </span>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
