'use client';

import { Check } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface PlanInfo {
  id: string;
  name: string;
  price: number;
  period?: string;
  subtitle?: string;
  features: string[];
  isRecommended?: boolean;
}

export interface PlanCardProps {
  plan: PlanInfo;
  isCurrentPlan: boolean;
  onSelect: () => void;
}

export function PlanCard({ plan, isCurrentPlan, onSelect }: PlanCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-md p-8 flex flex-col transition-calm',
        plan.isRecommended
          ? 'border-2 border-teal-500 ring-4 ring-teal-50'
          : 'border border-gray-100'
      )}
    >
      {plan.isRecommended && (
        <span className="inline-flex self-start px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-100 rounded-full mb-4">
          Most Popular
        </span>
      )}

      <h3 className="text-xl font-semibold text-gray-900 mb-1">{plan.name}</h3>
      {plan.subtitle && (
        <p className="text-sm text-gray-500 mb-4">{plan.subtitle}</p>
      )}

      <div className="flex items-baseline mb-6">
        <span className="text-4xl font-bold text-gray-900">
          ${plan.price}
        </span>
        <span className="text-gray-500 ml-1">{plan.period || '/mo'}</span>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start text-sm text-gray-600">
            <Check className="w-5 h-5 text-teal-500 mr-2 flex-shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {isCurrentPlan ? (
        <Badge variant="secondary" className="w-full justify-center py-3">
          Current Plan
        </Badge>
      ) : (
        <Button
          variant={plan.isRecommended ? 'primary' : 'secondary'}
          fullWidth
          onClick={onSelect}
        >
          Select Plan
        </Button>
      )}
    </div>
  );
}
