'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

import { ApprovalButton } from './ApprovalButton';

interface Opportunity {
  id: string;
  type: string;
  priorityBucket: 'high' | 'medium' | 'low';
  title: string;
  whyNow: string;
  counterfactual: string;
  impactRange: string;
  confidence: number;
  decayAt: Date;
  createdAt: Date;
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
  const daysUntilDecay = Math.ceil(
    (opportunity.decayAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className="hover:shadow-md transition-calm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-foreground mb-2">
              {opportunity.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Confidence: {confidencePercent}%</span>
              <span>•</span>
              <span>
                {daysUntilDecay > 0
                  ? `Decays in ${daysUntilDecay} day${daysUntilDecay !== 1 ? 's' : ''}`
                  : 'Decaying soon'}
              </span>
            </div>
          </div>
          <Badge variant={opportunity.priorityBucket}>
            {opportunity.priorityBucket.charAt(0).toUpperCase() +
              opportunity.priorityBucket.slice(1)}
          </Badge>
        </div>

        {/* Why Now */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded" />
            <span className="text-sm font-medium text-foreground">Why now</span>
          </div>
          <p className="text-sm text-muted-foreground pl-3">
            {opportunity.whyNow}
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
                {opportunity.impactRange}
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
