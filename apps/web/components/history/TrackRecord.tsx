'use client';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { ConfidenceScoresResponse } from '@/lib/api/types';
import { formatPercentage } from '@/lib/utils/formatters';

export interface TrackRecordProps {
  confidenceScores: ConfidenceScoresResponse;
}

function getTrendIcon(trend: 'improving' | 'stable' | 'declining') {
  switch (trend) {
    case 'improving':
      return (
        <svg
          className="w-4 h-4 text-success"
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
      );
    case 'declining':
      return (
        <svg
          className="w-4 h-4 text-error"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
          />
        </svg>
      );
    case 'stable':
    default:
      return (
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14"
          />
        </svg>
      );
  }
}

function getTrendLabel(trend: 'improving' | 'stable' | 'declining'): string {
  switch (trend) {
    case 'improving':
      return 'Improving';
    case 'declining':
      return 'Declining';
    case 'stable':
    default:
      return 'Stable';
  }
}

function getIntentLabel(intent: string): string {
  return intent
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function TrackRecord({ confidenceScores }: TrackRecordProps) {
  const { scores, overall_confidence } = confidenceScores;

  // Calculate overall stats
  const totalExecutions = scores.reduce((sum, s) => sum + s.recent_executions, 0);
  const totalHelped = scores.reduce((sum, s) => sum + s.helped_count, 0);
  const totalNeutral = scores.reduce((sum, s) => sum + s.neutral_count, 0);
  const totalHurt = scores.reduce((sum, s) => sum + s.hurt_count, 0);

  // Determine overall trend
  const improvingCount = scores.filter(s => s.trend === 'improving').length;
  const decliningCount = scores.filter(s => s.trend === 'declining').length;
  const overallTrend = improvingCount > decliningCount ? 'improving'
    : decliningCount > improvingCount ? 'declining'
    : 'stable';

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Overall Track Record
            </h3>
            <p className="text-sm text-muted-foreground">
              Performance across all executed actions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon(overallTrend)}
            <span className="text-sm font-medium text-muted-foreground">
              {getTrendLabel(overallTrend)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-foreground">
              {totalExecutions}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Total Executions
            </div>
          </div>

          <div className="text-center p-4 bg-success/10 rounded-lg">
            <div className="text-2xl font-bold text-success">
              {totalHelped}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Helped</div>
          </div>

          <div className="text-center p-4 bg-secondary/10 rounded-lg">
            <div className="text-2xl font-bold text-foreground">
              {totalNeutral}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Neutral</div>
          </div>

          <div className="text-center p-4 bg-error/10 rounded-lg">
            <div className="text-2xl font-bold text-error">{totalHurt}</div>
            <div className="text-xs text-muted-foreground mt-1">Hurt</div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Overall Confidence
            </span>
            <span className="text-xl font-bold text-primary">
              {formatPercentage(overall_confidence)}
            </span>
          </div>
        </div>
      </Card>

      {/* By Operator Intent */}
      {scores.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Performance by Intent
          </h3>
          <div className="space-y-4">
            {scores.map((score) => {
              const total = score.helped_count + score.neutral_count + score.hurt_count;

              return (
                <div
                  key={score.operator_intent}
                  className="p-4 bg-muted rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-foreground">
                        {getIntentLabel(score.operator_intent)}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {score.recent_executions} executions
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          score.score > 0.6
                            ? 'success'
                            : score.score > 0.3
                            ? 'warning'
                            : 'error'
                        }
                      >
                        {formatPercentage(score.score)} confidence
                      </Badge>
                      {getTrendIcon(score.trend)}
                    </div>
                  </div>

                  {/* Outcome Breakdown */}
                  {total > 0 && (
                    <>
                      <div className="flex gap-2 mb-2">
                        <div className="flex-1 bg-success/20 rounded-full h-2 relative overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-success"
                            style={{
                              width: `${(score.helped_count / total) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="flex-1 bg-secondary/20 rounded-full h-2 relative overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-secondary"
                            style={{
                              width: `${(score.neutral_count / total) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="flex-1 bg-error/20 rounded-full h-2 relative overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-error"
                            style={{
                              width: `${(score.hurt_count / total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{score.helped_count} helped</span>
                        <span>{score.neutral_count} neutral</span>
                        <span>{score.hurt_count} hurt</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {scores.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No outcomes recorded yet. Execute some actions to build your track
              record.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
