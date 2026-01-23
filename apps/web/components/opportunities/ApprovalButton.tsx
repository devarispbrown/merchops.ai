'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface ApprovalButtonProps {
  opportunityId: string;
}

export function ApprovalButton(_props: ApprovalButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);

    // TODO: Implement actual approval logic
    // This will call the backend API to create an execution
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsApproving(false);
    setIsModalOpen(false);
  };

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
        Review & Approve
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Review Draft Action"
        description="Review the complete payload before approving execution. This action will be executed exactly as shown."
        size="lg"
      >
        <div className="space-y-6">
          {/* Action Type */}
          <div>
            <span className="text-sm font-medium text-foreground">
              Action Type
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              Discount Campaign (15% off selected products)
            </p>
          </div>

          {/* Execution Payload Preview */}
          <div>
            <span className="text-sm font-medium text-foreground block mb-2">
              Execution Payload
            </span>
            <div className="bg-muted p-4 rounded-md font-mono text-xs overflow-x-auto">
              <pre>{`{
  "action_type": "create_discount",
  "title": "Winter Clearance - 15% Off",
  "discount_code": "WINTER15",
  "value_type": "percentage",
  "value": "-15.0",
  "target_type": "collection",
  "target_id": "winter-collection",
  "starts_at": "2026-01-24T00:00:00Z",
  "ends_at": "2026-02-07T23:59:59Z",
  "usage_limit": 100,
  "minimum_purchase_amount": null
}`}</pre>
            </div>
          </div>

          {/* Editable Fields (Future Enhancement) */}
          <div className="p-4 bg-accent rounded-md border border-border">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5"
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
              <div>
                <p className="text-sm font-medium text-foreground">
                  Inline editing coming soon
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You&apos;ll be able to edit safe fields like discount
                  percentage, dates, and copy before approval.
                </p>
              </div>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-4 bg-warning-light rounded-md border border-warning/20">
            <div className="flex items-start gap-2">
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
              <div>
                <p className="text-sm font-medium text-warning">
                  This action will execute immediately
                </p>
                <p className="text-xs text-warning/80 mt-1">
                  Once approved, this discount will be created in your Shopify
                  store. Make sure you&apos;ve reviewed all details above.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            onClick={() => setIsModalOpen(false)}
            disabled={isApproving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleApprove}
            disabled={isApproving}
          >
            {isApproving ? 'Approving...' : 'Approve & Execute'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
