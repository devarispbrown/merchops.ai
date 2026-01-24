# Billing Module

Complete server-side billing implementation for MerchOps Stripe integration.

## Overview

This module provides:
- Subscription management with trial support
- Usage tracking and limit enforcement
- Stripe customer and payment handling
- Webhook event processing with audit trail

## Architecture

### Data Flow

```
User Signup → Create Subscription (Trial) → Track Usage → Enforce Limits
                                          ↓
                            Stripe Checkout → Webhook → Update Subscription
                                          ↓
                            Usage Tracking → BillingEvent Audit Log
```

### Multi-Tenancy

All functions enforce workspace scoping:
- Subscriptions are 1:1 with workspaces
- Usage records are scoped to subscription billing periods
- All queries filter by workspace_id

## Plan Tiers

| Tier | Price | Opportunities | Actions | Events | Trial |
|------|-------|--------------|---------|--------|-------|
| Trial | $0 | 100 | 50 | 5,000 | 14 days |
| Starter | $49/mo | 25 | 10 | 500 | - |
| Growth | $149/mo | 100 | 50 | 5,000 | - |
| Pro | $399/mo | Unlimited | Unlimited | Unlimited | - |

## Environment Variables

Required configuration:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from Stripe Dashboard)
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_GROWTH_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
```

## Usage Examples

### 1. Create Subscription on Signup

```typescript
import { getOrCreateSubscription } from '@/server/billing';

// In your signup handler
const subscription = await getOrCreateSubscription(
  workspaceId,
  email,
  userName
);

// User is now on 14-day trial
console.log(subscription.plan_tier); // 'trial'
console.log(subscription.trial_end); // Date 14 days from now
```

### 2. Check Usage Limits Before Action

```typescript
import { checkLimit, incrementUsage, USAGE_METRICS } from '@/server/billing';

// Before creating an opportunity
try {
  await checkLimit(workspaceId, USAGE_METRICS.OPPORTUNITIES);

  // Create the opportunity
  const opportunity = await createOpportunity(...);

  // Increment usage counter
  await incrementUsage(workspaceId, USAGE_METRICS.OPPORTUNITIES);
} catch (error) {
  if (error instanceof LimitExceededError) {
    // Show upgrade prompt to user
    return {
      error: 'Opportunity limit reached',
      upgrade_url: '/billing/upgrade'
    };
  }
  throw error;
}
```

### 3. Create Stripe Checkout Session

```typescript
import { getSubscription, createCheckoutSession, getStripePriceId } from '@/server/billing';

// User wants to upgrade to Growth plan
const subscription = await getSubscription(workspaceId);
const priceId = getStripePriceId('growth');

const session = await createCheckoutSession(
  subscription.stripe_customer_id,
  priceId,
  'https://app.merchops.ai/billing/success',
  'https://app.merchops.ai/billing/cancel',
  { workspace_id: workspaceId }
);

// Redirect user to session.url
redirect(session.url);
```

### 4. Display Usage Stats

```typescript
import { getUsageStats } from '@/server/billing';

const stats = await getUsageStats(workspaceId);

console.log(stats);
// {
//   workspace_id: '...',
//   plan_tier: 'growth',
//   status: 'active',
//   metrics: {
//     opportunities: {
//       metric: 'opportunities',
//       current: 45,
//       limit: 100,
//       unlimited: false,
//       percentage: 45
//     },
//     actions: { ... },
//     events: { ... }
//   }
// }
```

### 5. Handle Stripe Webhooks

```typescript
// In your API route: /api/webhooks/stripe

import { verifyWebhookSignature, processWebhookEvent } from '@/server/billing';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  // Verify webhook signature
  const event = verifyWebhookSignature(body, signature);

  // Process event (updates subscription, logs to BillingEvent)
  await processWebhookEvent(event);

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Module Files

### `plans.ts`
- Plan definitions (limits, prices, features)
- Helper functions for plan logic
- Trial period calculations

### `customer.ts`
- Stripe customer CRUD operations
- Checkout session creation
- Billing portal access

### `subscription.ts`
- Subscription CRUD operations
- Subscription state management
- Trial and cancellation handling

### `limit-enforcement.ts`
- Usage tracking per billing period
- Limit checking before actions
- Usage statistics and reporting

### `webhooks.ts`
- Stripe webhook verification
- Event handlers for subscription lifecycle
- Audit logging to BillingEvent table

## Database Tables

### `Subscription`
- `workspace_id` (unique) - Links to workspace
- `stripe_customer_id` (unique) - Stripe customer reference
- `stripe_subscription_id` (unique) - Active subscription reference
- `plan_tier` - Current plan level
- `status` - Subscription status
- `current_period_start/end` - Billing period dates
- `trial_start/end` - Trial period dates

### `UsageRecord`
- `subscription_id` - Links to subscription
- `metric` - Type of usage (opportunities/actions/events)
- `count` - Current count for period
- `period_start/end` - Billing period dates
- **Unique constraint**: `(subscription_id, metric, period_start)`

### `BillingEvent`
- `subscription_id` - Links to subscription
- `event_type` - Stripe event type
- `stripe_event_id` (unique) - Prevents duplicate processing
- `payload` - Full event data (JSON)
- `created_at` - Event timestamp

## Error Handling

### `LimitExceededError`
Thrown when usage limit is exceeded:

```typescript
catch (error) {
  if (error instanceof LimitExceededError) {
    console.log(error.metric);     // 'opportunities'
    console.log(error.limit);      // 100
    console.log(error.current);    // 101
    console.log(error.planTier);   // 'growth'
  }
}
```

### Stripe Errors
All Stripe operations wrap errors in `ExternalServiceError`:

```typescript
catch (error) {
  if (error instanceof ExternalServiceError) {
    // Stripe API failed
    // User message: "An external service is temporarily unavailable"
  }
}
```

## Billing Period Logic

Usage is tracked per billing period:

1. **Trial Period**: `trial_start` to `trial_end`
2. **Paid Period**: `current_period_start` to `current_period_end`
3. **Fallback**: Current month if periods not set

Usage resets automatically when new period starts (new `UsageRecord` created).

## Subscription States

```
Trial → Active → (Past Due) → Canceled
  ↓        ↓
  └─────→ Active (after payment)
```

### State Transitions

- `trialing`: In trial period, no payment required
- `incomplete`: Checkout started but not completed
- `active`: Paid and active
- `past_due`: Payment failed, grace period
- `canceled`: Subscription ended
- `unpaid`: Payment failed, no grace period

## Webhook Event Flow

### Checkout Completed
1. User completes Stripe checkout
2. `checkout.session.completed` webhook received
3. Subscription updated with `stripe_subscription_id`
4. Status set to `active`
5. Event logged to `BillingEvent`

### Invoice Payment Succeeded
1. Stripe charges customer
2. `invoice.payment_succeeded` webhook received
3. Subscription status set to `active`
4. Billing period dates updated
5. Event logged

### Invoice Payment Failed
1. Payment fails
2. `invoice.payment_failed` webhook received
3. Subscription status set to `past_due`
4. Event logged
5. TODO: Send notification to user

### Subscription Updated
1. Any subscription change in Stripe
2. `customer.subscription.updated` webhook received
3. Local subscription synced with Stripe state
4. Plan tier updated if price changed
5. Event logged

## Testing

### Unit Tests
Test plan logic, usage calculations, and state transitions:

```bash
pnpm test apps/web/server/billing/__tests__/plans.test.ts
pnpm test apps/web/server/billing/__tests__/usage.test.ts
```

### Integration Tests
Test with Stripe test mode:

```typescript
// Use Stripe test keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

// Test webhook locally with Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger customer.subscription.created
```

## Monitoring

### Important Metrics

1. **Trial Conversions**: Trials → Paid subscriptions
2. **Churn Rate**: Cancellations per month
3. **Usage Patterns**: Avg usage per plan tier
4. **Limit Exceeded Events**: Users hitting limits

### Audit Trail

All billing events logged to `BillingEvent` table:

```typescript
// Query recent billing events
const events = await prisma.billingEvent.findMany({
  where: { subscription_id },
  orderBy: { created_at: 'desc' },
  take: 50
});
```

## Security

### Webhook Verification
All webhooks verified with `STRIPE_WEBHOOK_SECRET`:
- Prevents replay attacks
- Ensures authenticity
- Protects against tampering

### PCI Compliance
- Never store credit card data
- Stripe handles all payment processing
- Only store Stripe customer/subscription IDs

### Multi-Tenant Isolation
- All queries scoped to workspace
- No cross-workspace data access
- Subscription belongs to exactly one workspace

## Common Patterns

### Check Before Create
Always check limits before creating resources:

```typescript
// CORRECT
await checkLimit(workspaceId, USAGE_METRICS.ACTIONS);
const action = await createAction(...);
await incrementUsage(workspaceId, USAGE_METRICS.ACTIONS);

// WRONG - creates action even if limit exceeded
const action = await createAction(...);
await incrementUsage(workspaceId, USAGE_METRICS.ACTIONS);
```

### Idempotent Webhooks
Webhook handlers are idempotent:
- `stripe_event_id` stored in `BillingEvent` (unique constraint)
- Duplicate events ignored
- Safe to retry

### Graceful Degradation
Handle missing subscription gracefully:

```typescript
const subscription = await getSubscription(workspaceId);

if (!subscription) {
  // Show setup billing prompt
  return { redirect: '/billing/setup' };
}

if (!isSubscriptionActive(subscription)) {
  // Show upgrade or payment update prompt
  return { redirect: '/billing/update' };
}
```

## Future Enhancements

Planned features:
- [ ] Usage-based billing for overage
- [ ] Annual subscription discounts
- [ ] Custom enterprise plans
- [ ] Multi-workspace subscriptions (agency tier)
- [ ] Proration on plan changes
- [ ] Detailed usage analytics dashboard
- [ ] Automated trial reminder emails
- [ ] Subscription pause/resume
