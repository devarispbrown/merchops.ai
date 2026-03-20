'use client';

import { Download } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface BillingEvent {
  id: string;
  date: string;
  description?: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  invoice_url?: string | null;
}

export interface BillingHistoryProps {
  events: BillingEvent[];
  isLoading?: boolean;
}

export function BillingHistory({ events, isLoading }: BillingHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-4">
              <div className="h-10 w-24 bg-muted rounded" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
              <div className="h-6 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            No billing history yet
          </p>
        </div>
      </Card>
    );
  }

  const getStatusBadge = (status: BillingEvent['status']) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success">Paid</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'failed':
        return <Badge variant="error">Failed</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <div className="space-y-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between py-3 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  ${(event.amount / 100).toFixed(2)}
                </p>
                <p className="text-muted-foreground">{formatDate(event.date)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getStatusBadge(event.status)}

              {event.invoice_url && event.status === 'paid' && (
                <a
                  href={event.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-calm"
                >
                  <Download className="w-4 h-4" />
                  <span className="sr-only">Download invoice</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
