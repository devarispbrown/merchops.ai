# Billing Components - Usage Examples

## Quick Start

### Basic Billing Page

```tsx
'use client';

import { UsageDisplay, BillingHistory } from '@/components/billing';
import { useSubscription, useUsage } from '@/lib/hooks/useBilling';
import { Card } from '@/components/ui/Card';

export default function BillingPage() {
  const { data: subscription } = useSubscription();
  const { data: usage } = useUsage();

  return (
    <div>
      <h1>Billing</h1>

      <Card>
        <h2>{subscription?.plan_name}</h2>
        <p>Status: {subscription?.status}</p>
      </Card>

      <Card>
        <UsageDisplay
          metric="Active Opportunities"
          used={usage?.opportunities.used || 0}
          limit={usage?.opportunities.limit || 0}
          isUnlimited={usage?.opportunities.is_unlimited}
        />
      </Card>

      <BillingHistory events={[]} />
    </div>
  );
}
```

---

## Component Examples

### 1. UsageDisplay - Basic

```tsx
<UsageDisplay
  metric="Monthly Executions"
  used={42}
  limit={100}
/>
```

### 2. UsageDisplay - At Limit

```tsx
<UsageDisplay
  metric="Active Opportunities"
  used={20}
  limit={20}
/>
// Shows red (100% usage)
```

### 3. UsageDisplay - Unlimited

```tsx
<UsageDisplay
  metric="API Calls"
  used={1234}
  limit={0}
  isUnlimited={true}
/>
// Shows "Unlimited" instead of numbers
```

---

### 4. PlanCard - Current Plan

```tsx
<PlanCard
  plan={{
    id: 'growth',
    name: 'Growth',
    price: 149,
    subtitle: 'For stores $50K-$500K/mo',
    features: [
      'Up to 20 active opportunities',
      'Advanced analytics',
      'Priority support'
    ],
    isRecommended: true
  }}
  isCurrentPlan={true}
  onSelect={() => {}}
/>
// Shows "Current Plan" badge
```

### 5. PlanCard - Upgrade Option

```tsx
<PlanCard
  plan={{
    id: 'pro',
    name: 'Pro',
    price: 399,
    features: ['Unlimited everything']
  }}
  isCurrentPlan={false}
  onSelect={() => handleUpgrade('pro')}
/>
// Shows "Select Plan" button
```

---

### 6. UpgradeModal - Complete

```tsx
'use client';

import { useState } from 'react';
import { UpgradeModal } from '@/components/billing';
import { Button } from '@/components/ui/Button';

export function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Upgrade Plan
      </Button>

      <UpgradeModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentPlanId="starter"
      />
    </>
  );
}
```

---

### 7. UpgradePrompt - Warning (80%)

```tsx
<UpgradePrompt
  metric="active opportunities"
  percentage={85}
  isAtLimit={false}
/>
// Yellow banner: "You're approaching your limit"
```

### 8. UpgradePrompt - Alert (100%)

```tsx
<UpgradePrompt
  metric="monthly executions"
  percentage={100}
  isAtLimit={true}
/>
// Red banner: "You've reached your limit"
```

### 9. UpgradePrompt - Hidden

```tsx
<UpgradePrompt
  metric="active opportunities"
  percentage={50}
  isAtLimit={false}
/>
// Returns null (not shown)
```

---

### 10. BillingHistory - With Data

```tsx
<BillingHistory
  events={[
    {
      id: 'inv_123',
      date: '2026-01-01T00:00:00Z',
      amount: 14900, // $149.00 in cents
      status: 'paid',
      invoice_url: 'https://stripe.com/invoices/inv_123'
    },
    {
      id: 'inv_124',
      date: '2026-02-01T00:00:00Z',
      amount: 14900,
      status: 'pending'
    }
  ]}
  isLoading={false}
/>
```

### 11. BillingHistory - Loading

```tsx
<BillingHistory
  events={[]}
  isLoading={true}
/>
// Shows skeleton loading state
```

### 12. BillingHistory - Empty

```tsx
<BillingHistory
  events={[]}
  isLoading={false}
/>
// Shows "No billing history yet" message
```

---

## Hook Examples

### useSubscription

```tsx
'use client';

import { useSubscription } from '@/lib/hooks/useBilling';

export function SubscriptionStatus() {
  const { data, isLoading, error } = useSubscription();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading subscription</div>;
  if (!data) return <div>No subscription</div>;

  return (
    <div>
      <h2>{data.plan_name}</h2>
      <p>Status: {data.status}</p>

      {data.status === 'trialing' && data.trial_end && (
        <p>Trial ends: {new Date(data.trial_end).toLocaleDateString()}</p>
      )}

      {data.status === 'active' && (
        <p>Renews: {new Date(data.current_period_end).toLocaleDateString()}</p>
      )}
    </div>
  );
}
```

---

### useUsage

```tsx
'use client';

import { useUsage } from '@/lib/hooks/useBilling';
import { UsageDisplay } from '@/components/billing';

export function UsageMetrics() {
  const { data, isLoading } = useUsage();

  if (isLoading) return <div>Loading usage...</div>;
  if (!data) return null;

  const oppsPercentage =
    (data.opportunities.used / data.opportunities.limit) * 100;

  return (
    <div>
      <UsageDisplay
        metric="Opportunities"
        used={data.opportunities.used}
        limit={data.opportunities.limit}
        isUnlimited={data.opportunities.is_unlimited}
      />

      {oppsPercentage >= 80 && (
        <p className="text-yellow-600">
          Warning: You're at {oppsPercentage.toFixed(0)}% of your limit
        </p>
      )}
    </div>
  );
}
```

---

### useCreateCheckout

```tsx
'use client';

import { useCreateCheckout } from '@/lib/hooks/useBilling';
import { Button } from '@/components/ui/Button';

export function UpgradeButton({ planId }: { planId: string }) {
  const createCheckout = useCreateCheckout();

  const handleUpgrade = () => {
    createCheckout.mutate({ plan_id: planId });
    // Automatically redirects to Stripe on success
  };

  return (
    <Button
      onClick={handleUpgrade}
      disabled={createCheckout.isPending}
    >
      {createCheckout.isPending ? 'Redirecting...' : 'Upgrade Now'}
    </Button>
  );
}
```

---

### useCreatePortal

```tsx
'use client';

import { useCreatePortal } from '@/lib/hooks/useBilling';
import { Button } from '@/components/ui/Button';

export function ManageSubscriptionButton() {
  const createPortal = useCreatePortal();

  return (
    <Button
      variant="secondary"
      onClick={() => createPortal.mutate()}
      disabled={createPortal.isPending}
    >
      {createPortal.isPending ? 'Opening...' : 'Manage Subscription'}
    </Button>
  );
}
```

---

## Advanced Patterns

### Conditional Upgrade Prompts

```tsx
'use client';

import { useUsage } from '@/lib/hooks/useBilling';
import { UpgradePrompt } from '@/components/billing';

export function SmartUpgradePrompts() {
  const { data: usage } = useUsage();

  if (!usage) return null;

  const oppsPercent = usage.opportunities.is_unlimited
    ? 0
    : (usage.opportunities.used / usage.opportunities.limit) * 100;

  const execsPercent = usage.executions.is_unlimited
    ? 0
    : (usage.executions.used / usage.executions.limit) * 100;

  return (
    <div className="space-y-4">
      {oppsPercent >= 80 && (
        <UpgradePrompt
          metric="opportunities"
          percentage={oppsPercent}
          isAtLimit={oppsPercent >= 100}
        />
      )}

      {execsPercent >= 80 && (
        <UpgradePrompt
          metric="executions"
          percentage={execsPercent}
          isAtLimit={execsPercent >= 100}
        />
      )}
    </div>
  );
}
```

---

### Trial Countdown Timer

```tsx
'use client';

import { useSubscription } from '@/lib/hooks/useBilling';
import { Badge } from '@/components/ui/Badge';

export function TrialCountdown() {
  const { data: subscription } = useSubscription();

  if (subscription?.status !== 'trialing' || !subscription.trial_end) {
    return null;
  }

  const trialEnd = new Date(subscription.trial_end);
  const now = new Date();
  const daysLeft = Math.ceil(
    (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft <= 0) {
    return (
      <Badge variant="error">
        Trial expired - Please select a plan
      </Badge>
    );
  }

  return (
    <Badge variant="warning">
      {daysLeft} day{daysLeft === 1 ? '' : 's'} left in trial
    </Badge>
  );
}
```

---

### Usage Warning in Header

```tsx
'use client';

import { useUsage } from '@/lib/hooks/useBilling';
import { AlertTriangle } from 'lucide-react';

export function HeaderWarning() {
  const { data: usage } = useUsage();

  if (!usage) return null;

  const oppsPercent = usage.opportunities.is_unlimited
    ? 0
    : (usage.opportunities.used / usage.opportunities.limit) * 100;

  if (oppsPercent < 90) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-yellow-800">
        <AlertTriangle className="w-4 h-4" />
        <span>
          You're at {oppsPercent.toFixed(0)}% of your opportunity limit.
        </span>
        <button className="underline font-medium">
          Upgrade
        </button>
      </div>
    </div>
  );
}
```

---

## Testing Examples

### Unit Test - UsageDisplay

```tsx
import { render, screen } from '@testing-library/react';
import { UsageDisplay } from '@/components/billing';

describe('UsageDisplay', () => {
  it('shows green for normal usage', () => {
    render(
      <UsageDisplay metric="Test" used={30} limit={100} />
    );
    expect(screen.getByText('30 / 100')).toBeInTheDocument();
  });

  it('shows unlimited text when unlimited', () => {
    render(
      <UsageDisplay metric="Test" used={999} limit={0} isUnlimited />
    );
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
  });
});
```

---

### Integration Test - Hooks

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubscription } from '@/lib/hooks/useBilling';

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useSubscription', () => {
  it('fetches subscription data', async () => {
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeDefined();
  });
});
```

---

## Common Patterns

### Pattern: Inline Usage Badge

```tsx
<div className="flex items-center gap-2">
  <span>Opportunities</span>
  <Badge variant={percentage >= 80 ? 'error' : 'secondary'}>
    {used} / {limit}
  </Badge>
</div>
```

### Pattern: Usage Alert Card

```tsx
{percentage >= 90 && (
  <Card className="border-yellow-200 bg-yellow-50">
    <h3>Approaching Limit</h3>
    <p>You're at {percentage}% of your {metric} limit.</p>
    <Button onClick={openUpgradeModal}>Upgrade</Button>
  </Card>
)}
```

### Pattern: Plan Comparison

```tsx
<div className="grid grid-cols-3 gap-4">
  {PLANS.map(plan => (
    <PlanCard
      key={plan.id}
      plan={plan}
      isCurrentPlan={plan.id === currentPlanId}
      onSelect={() => handleSelect(plan.id)}
    />
  ))}
</div>
```

---

## Tips & Best Practices

1. Always handle loading states
2. Show user-friendly error messages
3. Disable buttons during mutations
4. Provide immediate visual feedback
5. Use optimistic updates where safe
6. Cache subscription data (staleTime: 60s)
7. Invalidate cache after upgrades
8. Test with real Stripe data
9. Handle edge cases (no subscription, expired trial)
10. Monitor usage threshold UX

---

## Troubleshooting

**Issue**: Modal doesn't close after upgrade
**Solution**: Stripe redirects away, modal doesn't need to close

**Issue**: Usage shows 0 / 0
**Solution**: Check API response, ensure limits are set

**Issue**: Buttons stay disabled
**Solution**: Check mutation error handling

**Issue**: Percentages over 100%
**Solution**: Cap with Math.min(percentage, 100)

**Issue**: Trial countdown negative
**Solution**: Check Math.ceil and handle <= 0 case
