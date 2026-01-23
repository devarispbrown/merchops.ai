'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ExecutionDetail } from '@/components/executions/ExecutionDetail';
import { OutcomeCard } from '@/components/history/OutcomeCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useExecution } from '@/lib/hooks/useExecutions';

export default function ExecutionDetailPage() {
  const params = useParams();
  const executionId = params.id as string;

  const { data: execution, isLoading: isLoadingExecution } =
    useExecution(executionId);

  if (isLoadingExecution) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card className="animate-pulse">
          <div className="h-64 bg-muted rounded" />
        </Card>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-muted-foreground"
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
            <h3 className="text-lg font-medium text-foreground mb-2">
              Execution not found
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              The execution you are looking for does not exist or you do not
              have permission to view it.
            </p>
            <Link href="/history">
              <Button variant="primary">Back to History</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <Link
          href="/history"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to History
        </Link>
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Execution Details
        </h1>
        <p className="text-muted-foreground">
          Full request payload, provider response, and outcome assessment.
        </p>
      </div>

      {/* Execution Detail */}
      <ExecutionDetail execution={execution} />

      {/* Outcome Card */}
      {execution.outcome && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Outcome Assessment
          </h2>
          <OutcomeCard outcome={execution.outcome} />
        </div>
      )}

      {/* No Outcome Yet */}
      {!execution.outcome && execution.status === 'succeeded' && (
        <div className="mt-6">
          <Card>
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-medium text-foreground mb-2">
                Outcome assessment pending
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                This execution completed successfully. The outcome will be
                computed once sufficient evidence has been collected.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Link to Original Opportunity */}
      {execution.draft.opportunity_id && (
        <div className="mt-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-foreground mb-1">
                  Original Opportunity
                </h3>
                <p className="text-sm text-muted-foreground">
                  View the opportunity that generated this action
                </p>
              </div>
              <Link
                href={`/queue/${execution.draft.opportunity_id}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                View opportunity
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
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
