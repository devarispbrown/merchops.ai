'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApprovalModal } from '@/components/drafts/ApprovalModal';
import { DraftEditor } from '@/components/drafts/DraftEditor';
import { PayloadPreview } from '@/components/drafts/PayloadPreview';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useDraft, useUpdateDraft, useApproveDraft } from '@/lib/hooks/useDrafts';
import { useToast } from '@/lib/hooks/useToast';
import type { ExecutionType } from '@/server/actions/types';

export default function DraftDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  // Fetch draft data
  const { data: draft, isLoading, error } = useDraft(params.id);

  // Mutations
  const updateDraftMutation = useUpdateDraft();
  const approveDraftMutation = useApproveDraft();

  const handleSave = async (updatedPayload: Record<string, unknown>) => {
    try {
      await updateDraftMutation.mutateAsync({
        id: params.id,
        data: { updates: updatedPayload },
      });
      showToast('Draft saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save draft:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to save draft',
        'error'
      );
      throw error;
    }
  };

  const handleApprove = async () => {
    try {
      const result = await approveDraftMutation.mutateAsync({
        id: params.id,
        data: { confirmation: true },
      });
      showToast('Draft approved and queued for execution', 'success');
      // Redirect to execution detail or history
      router.push(`/history/${result.id}`);
    } catch (error) {
      console.error('Failed to approve draft:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to approve draft',
        'error'
      );
      throw error;
    }
  };

  const handleCancel = () => {
    router.push('/queue');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading draft...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !draft) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <p className="text-red-600">Failed to load draft</p>
          <Button onClick={() => router.push('/queue')}>Back to Queue</Button>
        </div>
      </div>
    );
  }

  // Use fetched draft data instead of mock
  const draftData = {
    id: draft.id,
    opportunity_id: draft.opportunity_id,
    operator_intent: draft.operator_intent,
    execution_type: draft.execution_type,
    state: draft.state,
    payload_json: draft.payload,
    editable_fields_json: draft.editable_fields,
    created_at: new Date(draft.created_at),
    opportunity: {
      type: draft.opportunity.type,
      priority_bucket: draft.opportunity.priority_bucket,
      why_now: '', // Will be populated from full opportunity if available
      rationale: draft.opportunity.rationale,
      impact_range: '', // Will be populated from full opportunity if available
    },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
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
              Back
            </Button>
            <Badge variant="secondary">{formatExecutionType(draftData.execution_type)}</Badge>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">
            Review Draft Action
          </h1>
          <p className="text-muted-foreground">
            {formatOperatorIntent(draftData.operator_intent)}
          </p>
        </div>

        <Card className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                draftData.opportunity.priority_bucket === 'high'
                  ? 'high'
                  : draftData.opportunity.priority_bucket === 'medium'
                    ? 'medium'
                    : 'low'
              }
            >
              {draftData.opportunity.priority_bucket} Priority
            </Badge>
          </div>
        </Card>
      </div>

      {/* Opportunity Context */}
      {draftData.opportunity.rationale && (
        <Card>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Opportunity Context
            </h3>
            <p className="text-sm text-foreground leading-relaxed">
              {draftData.opportunity.rationale}
            </p>
          </div>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Editor */}
        <div className="space-y-6">
          <DraftEditor
            executionType={draftData.execution_type as ExecutionType}
            payload={draftData.payload_json}
            onSave={handleSave}
            isSaving={updateDraftMutation.isPending}
          />

          {/* Action Buttons */}
          <Card>
            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={() => setIsApprovalModalOpen(true)}
                disabled={approveDraftMutation.isPending}
              >
                {approveDraftMutation.isPending
                  ? 'Approving...'
                  : 'Approve and Execute'}
              </Button>
              <Button variant="ghost" fullWidth onClick={handleCancel}>
                Cancel
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Approval will execute this action immediately in your store
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-6">
          <PayloadPreview
            payload={draftData.payload_json}
            title="Draft Payload"
            description="Current state of the action to be executed"
          />

          {/* Safety Notice */}
          <Card>
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
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
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Safe to edit
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You can modify any field shown in the editor. All changes are
                  validated before execution.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        onApprove={handleApprove}
        payload={draftData.payload_json}
        executionType={draftData.execution_type}
        operatorIntent={draftData.operator_intent}
      />
    </div>
  );
}

function formatExecutionType(type: string): string {
  const formatted: Record<string, string> = {
    discount_draft: 'Discount Code',
    winback_email_draft: 'Win-back Email',
    pause_product: 'Pause Product',
  };
  return formatted[type] || type;
}

function formatOperatorIntent(intent: string): string {
  const formatted: Record<string, string> = {
    reduce_inventory_risk: 'Reduce Inventory Risk',
    reengage_dormant_customers: 'Re-engage Dormant Customers',
    protect_margin: 'Protect Margin',
  };
  return formatted[intent] || intent;
}
