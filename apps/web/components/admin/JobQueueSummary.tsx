'use client';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  paused: boolean;
  processingRate?: number; // jobs per minute
}

export interface JobQueueSummaryProps {
  queues: QueueStats[];
}

export function JobQueueSummary({ queues }: JobQueueSummaryProps) {
  const totalWaiting = queues.reduce((sum, q) => sum + q.waiting, 0);
  const totalActive = queues.reduce((sum, q) => sum + q.active, 0);
  const totalFailed = queues.reduce((sum, q) => sum + q.failed, 0);

  const hasCriticalIssues = queues.some((q) => q.failed > 10 || q.paused);

  const formatRate = (rate?: number) => {
    if (!rate) return 'N/A';
    if (rate < 1) return `${(rate * 60).toFixed(1)}/hr`;
    return `${rate.toFixed(1)}/min`;
  };

  const getQueueStatusBadge = (queue: QueueStats) => {
    if (queue.paused) {
      return <Badge variant="warning">Paused</Badge>;
    }
    if (queue.failed > 10) {
      return <Badge variant="error">Issues</Badge>;
    }
    if (queue.active > 0) {
      return <Badge variant="success">Active</Badge>;
    }
    return <Badge variant="secondary">Idle</Badge>;
  };

  return (
    <Card>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Job Queue Summary
          </h2>
          {hasCriticalIssues && (
            <Badge variant="error">Attention needed</Badge>
          )}
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <div className="text-2xl font-semibold text-foreground">
              {totalWaiting}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Waiting</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <div className="text-2xl font-semibold text-success">
              {totalActive}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Active</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <div
              className={`text-2xl font-semibold ${totalFailed > 0 ? 'text-error' : 'text-muted-foreground'}`}
            >
              {totalFailed}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Failed</div>
          </div>
        </div>

        {/* Individual Queues */}
        <div className="space-y-3">
          {queues.map((queue) => (
            <div
              key={queue.name}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">
                  {queue.name}
                </h3>
                {getQueueStatusBadge(queue)}
              </div>

              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground mb-1">Waiting</div>
                  <div className="font-medium text-foreground">
                    {queue.waiting}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Active</div>
                  <div className="font-medium text-success">{queue.active}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Completed</div>
                  <div className="font-medium text-foreground">
                    {queue.completed}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Failed</div>
                  <div
                    className={`font-medium ${queue.failed > 0 ? 'text-error' : 'text-muted-foreground'}`}
                  >
                    {queue.failed}
                  </div>
                </div>
              </div>

              {queue.processingRate !== undefined && (
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Processing rate: {formatRate(queue.processingRate)}
                  </span>
                </div>
              )}

              {/* Failed jobs alert */}
              {queue.failed > 10 && (
                <div className="mt-3 p-2 rounded bg-error/10 border border-error/20">
                  <p className="text-xs text-error">
                    High failure rate detected. Review error logs.
                  </p>
                </div>
              )}

              {/* Paused notice */}
              {queue.paused && (
                <div className="mt-3 p-2 rounded bg-warning/10 border border-warning/20">
                  <p className="text-xs text-warning">
                    This queue is currently paused.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Queue stats updated in real-time
          </p>
        </div>
      </div>
    </Card>
  );
}
