'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

import { ApprovalButton } from './ApprovalButton';

interface Opportunity {
  id: string;
  type: string;
  priority_bucket: 'high' | 'medium' | 'low';
  rationale: string;
  why_now: string;
  counterfactual: string;
  impact_range: string;
  confidence: number;
  decay_at: string | null;
  created_at: string;
}

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const confidencePercent = Math.round(opportunity.confidence * 100);
  const daysUntilDecay = opportunity.decay_at
    ? Math.ceil(
        (new Date(opportunity.decay_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <Card className="hover:shadow-md transition-calm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-foreground mb-2">
              {opportunity.rationale}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Confidence: {confidencePercent}%</span>
              {daysUntilDecay !== null && (
                <>
                  <span>•</span>
                  <span>
                    {daysUntilDecay > 0
                      ? `Decays in ${daysUntilDecay} day${daysUntilDecay !== 1 ? 's' : ''}`
                      : 'Decaying soon'}
                  </span>
                </>
              )}
            </div>
          </div>
          <Badge variant={opportunity.priority_bucket}>
            {opportunity.priority_bucket.charAt(0).toUpperCase() +
              opportunity.priority_bucket.slice(1)}
          </Badge>
        </div>

        {/* Why Now */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded" />
            <span className="text-sm font-medium text-foreground">Why now</span>
          </div>
          <p className="text-sm text-muted-foreground pl-3">
            {opportunity.why_now}
          </p>
        </div>

        {/* Counterfactual - shown when expanded */}
        {isExpanded && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-warning rounded" />
                <span className="text-sm font-medium text-foreground">
                  If no action is taken
                </span>
              </div>
              <p className="text-sm text-muted-foreground pl-3">
                {opportunity.counterfactual}
              </p>
            </div>

            {/* Impact Range */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-success rounded" />
                <span className="text-sm font-medium text-foreground">
                  Expected impact
                </span>
              </div>
              <p className="text-sm text-muted-foreground pl-3">
                {opportunity.impact_range}
              </p>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDismissed(true)}
            >
              Dismiss
            </Button>
          </div>

          <ApprovalButton opportunityId={opportunity.id} />
        </div>
      </div>
    </Card>
  );
}
