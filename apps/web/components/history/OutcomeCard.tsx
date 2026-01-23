'use client';

import { OutcomeType } from '@prisma/client';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { OutcomeResponse } from '@/lib/api/types';
import { formatDateTime, formatCurrency, formatPercentage } from '@/lib/utils/formatters';

export interface OutcomeCardProps {
  outcome: OutcomeResponse;
}

function getOutcomeVariant(
  outcome: OutcomeType
): 'success' | 'error' | 'secondary' {
  switch (outcome) {
    case 'helped':
      return 'success';
    case 'hurt':
      return 'error';
    case 'neutral':
    default:
      return 'secondary';
  }
}

function getOutcomeLabel(outcome: OutcomeType): string {
  switch (outcome) {
    case 'helped':
      return 'Helped';
    case 'hurt':
      return 'Hurt';
    case 'neutral':
      return 'Neutral';
    default:
      return outcome;
  }
}

function getOutcomeIcon(outcome: OutcomeType) {
  switch (outcome) {
    case 'helped':
      return (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'hurt':
      return (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'neutral':
    default:
      return (
        <svg
          className="w-6 h-6"
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
      );
  }
}

function renderMetric(key: string, value: unknown): string {
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('percent')) {
      return formatPercentage(value);
    }
    if (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('price')) {
      return formatCurrency(value);
    }
    return String(value);
  }
  return String(value);
}

export function OutcomeCard({ outcome }: OutcomeCardProps) {
  const { evidence } = outcome;
  const hasMetrics = evidence.baseline || evidence.result;

  return (
    <Card>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
              outcome.outcome === 'helped'
                ? 'bg-success/10 text-success'
                : outcome.outcome === 'hurt'
                ? 'bg-error/10 text-error'
                : 'bg-secondary/10 text-muted-foreground'
            }`}
          >
            {getOutcomeIcon(outcome.outcome)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-foreground">
                Outcome Assessment
              </h3>
              <Badge variant={getOutcomeVariant(outcome.outcome)}>
                {getOutcomeLabel(outcome.outcome)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Computed {formatDateTime(outcome.computed_at)}
            </p>
          </div>
        </div>

        {/* Evidence Summary */}
        {evidence.summary && (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm text-foreground">{evidence.summary}</p>
          </div>
        )}

        {/* Metrics Comparison */}
        {hasMetrics && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">
              Metrics Comparison
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Baseline Metrics */}
              {evidence.baseline && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase">
                    Baseline
                  </div>
                  <div className="space-y-1">
                    {Object.entries(evidence.baseline).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-medium text-foreground">
                          {renderMetric(key, value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Result Metrics */}
              {evidence.result && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase">
                    Result
                  </div>
                  <div className="space-y-1">
                    {Object.entries(evidence.result).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-medium text-foreground">
                          {renderMetric(key, value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Additional Context */}
        {evidence.context && Object.keys(evidence.context).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">
              Additional Context
            </h4>
            <div className="space-y-1">
              {Object.entries(evidence.context).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="font-medium text-foreground">
                    {renderMetric(key, value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {evidence.notes && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">{evidence.notes}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
