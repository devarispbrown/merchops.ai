# Billing UI Components

Production-ready React components for Stripe billing integration in MerchOps.

## Components

### UsageDisplay

Visual progress bar for usage metrics with color-coded warnings.

**Props:**
- `metric: string` - Name of the metric (e.g., "Active Opportunities")
- `used: number` - Current usage count
- `limit: number` - Maximum allowed by plan
- `isUnlimited?: boolean` - Whether this metric has unlimited usage

**Behavior:**
- Green (0-60%): Normal usage
- Yellow (60-80%): Approaching limit
- Red (80-100%): At or near limit
- Shows "Unlimited" when `isUnlimited` is true

**Example:**
```tsx
<UsageDisplay
  metric="Active Opportunities"
  used={12}
  limit={20}
/>
```

---

### PlanCard

Individual pricing plan card for upgrade modal.

**Props:**
- `plan: PlanInfo` - Plan configuration object
- `isCurrentPlan: boolean` - Whether this is user's current plan
- `onSelect: () => void` - Callback when plan is selected

**PlanInfo Type:**
```typescript
interface PlanInfo {
  id: string;
  name: string;
  price: number;
  period?: string;
  subtitle?: string;
  features: string[];
  isRecommended?: boolean;
}
```

**Example:**
```tsx
<PlanCard
  plan={{
    id: 'growth',
    name: 'Growth',
    price: 149,
    subtitle: 'For stores $50K-$500K/mo',
    features: ['Up to 20 opportunities', 'Priority support'],
    isRecommended: true
  }}
  isCurrentPlan={false}
  onSelect={() => handleUpgrade('growth')}
/>
```

---

### UpgradeModal

Modal for selecting and upgrading to a different plan.

**Props:**
- `isOpen: boolean` - Modal visibility state
- `onClose: () => void` - Callback to close modal
- `currentPlanId?: string` - ID of user's current plan

**Behavior:**
- Displays all available plans in grid layout
- Highlights recommended plan (Growth)
- Disables current plan selection
- Redirects to Stripe checkout on selection

**Example:**
```tsx
const [isOpen, setIsOpen] = useState(false);

<UpgradeModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  currentPlanId="starter"
/>
```

---

### UpgradePrompt

Warning banner shown when approaching or at usage limits.

**Props:**
- `metric: string` - Name of the limited metric
- `percentage: number` - Current usage percentage (0-100)
- `isAtLimit: boolean` - Whether user has hit the limit

**Behavior:**
- Hidden when `percentage < 80`
- Yellow warning at 80-99%
- Red alert at 100%+
- Opens UpgradeModal on button click

**Example:**
```tsx
<UpgradePrompt
  metric="active opportunities"
  percentage={85}
  isAtLimit={false}
/>
```

---

### BillingHistory

List of past invoices and billing events.

**Props:**
- `events: BillingEvent[]` - Array of billing events
- `isLoading?: boolean` - Loading state

**BillingEvent Type:**
```typescript
interface BillingEvent {
  id: string;
  date: string;
  amount: number; // in cents
  status: 'paid' | 'pending' | 'failed';
  invoice_url?: string;
}
```

**Example:**
```tsx
<BillingHistory
  events={[
    {
      id: '1',
      date: '2026-01-01',
      amount: 14900, // $149.00
      status: 'paid',
      invoice_url: 'https://...'
    }
  ]}
  isLoading={false}
/>
```

---

## Hooks (useBilling.ts)

### useSubscription()

Fetches current subscription status.

**Returns:**
```typescript
{
  data: SubscriptionStatus | null;
  isLoading: boolean;
  error: Error | null;
}
```

### useUsage()

Fetches current usage metrics.

**Returns:**
```typescript
{
  data: UsageMetrics;
  isLoading: boolean;
  error: Error | null;
}
```

### useCreateCheckout()

Creates Stripe checkout session and redirects.

**Returns:**
```typescript
{
  mutate: (data: { plan_id: string }) => void;
  mutateAsync: (data: { plan_id: string }) => Promise<void>;
  isPending: boolean;
  isError: boolean;
}
```

### useCreatePortal()

Creates Stripe customer portal session and redirects.

**Returns:**
```typescript
{
  mutate: () => void;
  mutateAsync: () => Promise<void>;
  isPending: boolean;
  isError: boolean;
}
```

---

## Pricing Tiers

**Trial:** 14-day free trial (features of Growth)

**Starter:** $49/mo
- Stores under $50K/mo
- Up to 5 active opportunities
- Basic features

**Growth:** $149/mo (MOST POPULAR)
- Stores $50K-$500K/mo
- Up to 20 active opportunities
- Advanced features

**Pro:** $399/mo
- Stores $500K+/mo
- Unlimited opportunities
- All features + API access

---

## Design System

**Colors:**
- Primary/Teal: `#14b8a6` (teal-500)
- Success: Green
- Warning: Yellow
- Error: Red

**Spacing:**
- Card padding: `p-4`, `p-6`
- Gap: `gap-4`, `gap-6`
- Rounded: `rounded-xl`, `rounded-2xl`

**Typography:**
- Headings: `font-semibold`
- Body: `text-sm`, `text-base`
- Muted: `text-muted-foreground`

---

## Integration

All components are designed to work with:
- Next.js 14+ App Router
- TanStack Query for data fetching
- Tailwind CSS for styling
- TypeScript for type safety

Import components:
```tsx
import {
  UsageDisplay,
  PlanCard,
  UpgradeModal,
  UpgradePrompt,
  BillingHistory
} from '@/components/billing';
```

Import hooks:
```tsx
import {
  useSubscription,
  useUsage,
  useCreateCheckout,
  useCreatePortal
} from '@/lib/hooks/useBilling';
```
