'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

import { PayloadPreview } from './PayloadPreview';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => Promise<void>;
  payload: Record<string, unknown>;
  executionType: string;
  operatorIntent: string;
}

export function ApprovalModal({
  isOpen,
  onClose,
  onApprove,
  payload,
  executionType,
  operatorIntent,
}: ApprovalModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async () => {
    if (!confirmed) return;

    setIsApproving(true);
    try {
      await onApprove();
      setConfirmed(false);
      onClose();
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Approve Action"
      description="Review the full execution details before approving"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isApproving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleApprove}
            disabled={!confirmed || isApproving}
          >
            {isApproving ? 'Executing...' : 'Approve and Execute'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Warning Banner */}
        <div className="flex gap-3 p-4 rounded-lg bg-warning-light border border-warning/20">
          <svg
            className="w-5 h-5 text-warning flex-shrink-0 mt-0.5"
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
          <div className="space-y-1">
            <p className="text-sm font-medium text-warning">
              This action will be executed immediately
            </p>
            <p className="text-sm text-foreground">
              Once approved, this action will be sent to your store. Make sure you
              have reviewed all details carefully.
            </p>
          </div>
        </div>

        {/* Action Details */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Action Type
              </p>
              <p className="text-sm font-medium text-foreground">
                {formatExecutionType(executionType)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Intent
              </p>
              <p className="text-sm font-medium text-foreground">
                {formatOperatorIntent(operatorIntent)}
              </p>
            </div>
          </div>
        </div>

        {/* Payload Preview */}
        <PayloadPreview
          payload={payload}
          title="Execution Payload"
          description="This is exactly what will be sent"
        />

        {/* Confirmation Checkbox */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted border border-border">
          <input
            type="checkbox"
            id="confirm-execution"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <label
            htmlFor="confirm-execution"
            className="text-sm text-foreground cursor-pointer"
          >
            I understand this action will be executed immediately and cannot be
            undone. I have reviewed the payload and confirm this is correct.
          </label>
        </div>
      </div>
    </Modal>
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
