import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { OutcomeType } from '@/server/learning/types';

interface Outcome {
  id: string;
  outcome: OutcomeType;
  computed_at: Date;
  evidence_json: {
    baseline_value: number;
    observed_value: number;
    delta: number;
    delta_percentage: number;
    baseline_window: {
      start: Date;
      end: Date;
      metric_name: string;
    };
    observation_window: {
      start: Date;
      end: Date;
      metric_name: string;
    };
    notes?: string;
  };
}

interface OutcomeDisplayProps {
  outcome: Outcome;
  executionId?: string;
}

export function OutcomeDisplay({ outcome, executionId }: OutcomeDisplayProps) {
  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Outcome</h3>
          <OutcomeBadge outcome={outcome.outcome} />
        </div>

        <EvidenceSummary evidence={outcome.evidence_json} />

        {executionId && (
          <div className="pt-4 border-t border-border">
            <a
              href={`/history/${executionId}`}
              className="text-sm text-primary hover:text-primary/80 transition-calm inline-flex items-center gap-1"
            >
              View full evidence
              <svg
                className="w-4 h-4"
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
            </a>
          </div>
        )}
      </div>
    </Card>
  );
}

interface OutcomeBadgeProps {
  outcome: OutcomeType;
}

export function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
  const config: Record<
    OutcomeType,
    { variant: 'success' | 'error' | 'secondary'; label: string; icon: React.ReactNode }
  > = {
    [OutcomeType.HELPED]: {
      variant: 'success',
      label: 'Helped',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
    },
    [OutcomeType.NEUTRAL]: {
      variant: 'secondary',
      label: 'Neutral',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 12H4"
          />
        </svg>
      ),
    },
    [OutcomeType.HURT]: {
      variant: 'error',
      label: 'Hurt',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ),
    },
  };

  const { variant, label, icon } = config[outcome];

  return (
    <Badge variant={variant}>
      {icon}
      {label}
    </Badge>
  );
}

interface EvidenceSummaryProps {
  evidence: Outcome['evidence_json'];
}

function EvidenceSummary({ evidence }: EvidenceSummaryProps) {
  const {
    baseline_value,
    observed_value,
    delta,
    delta_percentage,
    baseline_window,
    observation_window,
    notes,
  } = evidence;

  const isPositive = delta > 0;
  const deltaColor = isPositive ? 'text-success' : 'text-error';

  return (
    <div className="space-y-4">
      {/* Metric Comparison */}
      <div className="p-4 rounded-lg bg-muted border border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {baseline_window.metric_name}
          </span>
          <span className={`text-lg font-semibold ${deltaColor}`}>
            {isPositive ? '+' : ''}
            {delta_percentage.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Baseline</p>
            <p className="text-base font-medium text-foreground">
              {formatValue(baseline_value)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Observed</p>
            <p className="text-base font-medium text-foreground">
              {formatValue(observed_value)}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-border space-y-1">
          <p className="text-xs text-muted-foreground">
            Baseline: {formatDateRange(baseline_window.start, baseline_window.end)}
          </p>
          <p className="text-xs text-muted-foreground">
            Observation:{' '}
            {formatDateRange(observation_window.start, observation_window.end)}
          </p>
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Analysis
          </p>
          <p className="text-sm text-foreground leading-relaxed">{notes}</p>
        </div>
      )}
    </div>
  );
}

function formatValue(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

function formatDateRange(start: Date, end: Date): string {
  const startDate = new Date(start).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endDate = new Date(end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${startDate} - ${endDate}`;
}
