'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCreateCheckout } from '@/lib/hooks/useBilling';

import { PlanCard, type PlanInfo } from './PlanCard';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanId?: string;
}

const PLANS: PlanInfo[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    subtitle: 'For stores under $50K/mo',
    features: [
      'Up to 5 active opportunities',
      'Email win-back campaigns',
      'Basic discount management',
      'Standard support',
      '30-day outcome tracking',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 149,
    subtitle: 'For stores $50K-$500K/mo',
    features: [
      'Up to 20 active opportunities',
      'Advanced email campaigns',
      'Smart discount optimization',
      'Priority support',
      'Advanced analytics',
      'Custom opportunity rules',
    ],
    isRecommended: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 399,
    subtitle: 'For stores $500K+/mo',
    features: [
      'Unlimited active opportunities',
      'Multi-channel campaigns',
      'AI-powered optimization',
      'Dedicated support',
      'Advanced analytics & reporting',
      'Custom integrations',
      'API access',
    ],
  },
];

export function UpgradeModal({
  isOpen,
  onClose,
  currentPlanId,
}: UpgradeModalProps) {
  const createCheckout = useCreateCheckout();

  const handleSelectPlan = async (planId: string) => {
    try {
      await createCheckout.mutateAsync({ plan_id: planId });
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upgrade Your Plan"
      description="Choose the plan that best fits your store's needs"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={plan.id === currentPlanId}
            onSelect={() => handleSelectPlan(plan.id)}
          />
        ))}
      </div>

      {createCheckout.isError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            Failed to create checkout session. Please try again.
          </p>
        </div>
      )}
    </Modal>
  );
}
