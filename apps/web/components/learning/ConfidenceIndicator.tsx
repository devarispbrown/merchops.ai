import { Card } from '@/components/ui/Card';

interface ConfidenceIndicatorProps {
  confidence: number; // 0-100
  trend?: 'improving' | 'stable' | 'declining';
  recentExecutions?: number;
  helpedCount?: number;
  neutralCount?: number;
  hurtCount?: number;
}

export function ConfidenceIndicator({
  confidence,
  trend = 'stable',
  recentExecutions = 0,
  helpedCount = 0,
  neutralCount = 0,
  hurtCount = 0,
}: ConfidenceIndicatorProps) {
  const confidenceColor = getConfidenceColor(confidence);
  const trendIcon = getTrendIcon(trend);
  const trendColor = getTrendColor(trend);

  return (
    <Card>
      <div className="space-y-4">
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
            <h3 className="text-sm font-semibold text-foreground">Confidence</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-semibold ${confidenceColor}`}>
              {confidence}%
            </span>
            {trend !== 'stable' && (
              <span className={trendColor}>{trendIcon}</span>
            )}
          </div>
        </div>

        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`rounded-full h-2 transition-calm ${
              confidence >= 75
                ? 'bg-success'
                : confidence >= 50
                  ? 'bg-warning'
                  : 'bg-muted-foreground'
            }`}
            style={{ width: `${confidence}%` }}
          />
        </div>

        {recentExecutions > 0 && (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recent Track Record
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-sm text-foreground">
                    {helpedCount} helped
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-sm text-foreground">
                    {neutralCount} neutral
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-error" />
                  <span className="text-sm text-foreground">{hurtCount} hurt</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Based on {recentExecutions} recent execution
              {recentExecutions !== 1 ? 's' : ''}
            </p>
          </>
        )}

        {recentExecutions === 0 && (
          <p className="text-xs text-muted-foreground">
            No executions yet. Confidence based on global priors.
          </p>
        )}
      </div>
    </Card>
  );
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 75) return 'text-success';
  if (confidence >= 50) return 'text-warning';
  return 'text-muted-foreground';
}

function getTrendIcon(trend: 'improving' | 'stable' | 'declining'): JSX.Element {
  switch (trend) {
    case 'improving':
      return (
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
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      );
    case 'declining':
      return (
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
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      );
    default:
      return <></>;
  }
}

function getTrendColor(trend: 'improving' | 'stable' | 'declining'): string {
  switch (trend) {
    case 'improving':
      return 'text-success';
    case 'declining':
      return 'text-error';
    default:
      return 'text-muted-foreground';
  }
}
