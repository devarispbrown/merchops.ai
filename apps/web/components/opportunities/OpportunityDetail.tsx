import { Card } from '@/components/ui/Card';

interface OpportunityDetailProps {
  whyNow: string;
  counterfactual: string;
  impactRange: string;
  confidence: number;
}

export function OpportunityDetail({
  whyNow,
  counterfactual,
  impactRange,
  confidence,
}: OpportunityDetailProps) {
  return (
    <div className="space-y-4">
      <WhyNowCard whyNow={whyNow} />
      <CounterfactualCard counterfactual={counterfactual} />
      <ImpactRangeDisplay impactRange={impactRange} />
      <ConfidenceIndicatorDisplay confidence={confidence} />
    </div>
  );
}

interface WhyNowCardProps {
  whyNow: string;
}

export function WhyNowCard({ whyNow }: WhyNowCardProps) {
  return (
    <Card>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary"
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
          <h3 className="text-sm font-semibold text-foreground">Why now</h3>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{whyNow}</p>
      </div>
    </Card>
  );
}

interface CounterfactualCardProps {
  counterfactual: string;
}

export function CounterfactualCard({ counterfactual }: CounterfactualCardProps) {
  return (
    <Card>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-warning"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">
            If no action is taken
          </h3>
        </div>
        <p className="text-sm text-foreground leading-relaxed">
          {counterfactual}
        </p>
      </div>
    </Card>
  );
}

interface ImpactRangeDisplayProps {
  impactRange: string;
}

export function ImpactRangeDisplay({ impactRange }: ImpactRangeDisplayProps) {
  return (
    <Card>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-success"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">
            Expected impact
          </h3>
        </div>
        <p className="text-base font-medium text-foreground">{impactRange}</p>
      </div>
    </Card>
  );
}

interface ConfidenceIndicatorDisplayProps {
  confidence: number;
}

export function ConfidenceIndicatorDisplay({
  confidence,
}: ConfidenceIndicatorDisplayProps) {
  const percentage = Math.round(confidence * 100);
  const getConfidenceColor = (value: number) => {
    if (value >= 75) return 'text-success';
    if (value >= 50) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-foreground">
              Confidence
            </h3>
          </div>
          <span
            className={`text-2xl font-semibold ${getConfidenceColor(percentage)}`}
          >
            {percentage}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-calm"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Based on similar opportunities and recent outcomes
        </p>
      </div>
    </Card>
  );
}
