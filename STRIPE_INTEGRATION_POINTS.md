# Stripe Billing Integration Points - Implementation Summary

## Overview

This document summarizes the integration points updated for Stripe billing in MerchOps Beta MVP.

## Files Updated

### 1. Middleware Configuration
**File:** `apps/web/middleware.ts`

**Changes:**
- Added `/api/billing/webhooks` to public API routes array
- This allows Stripe webhook calls to bypass authentication

```typescript
const publicApiRoutes = ["/api/auth", "/api/health", "/api/billing/webhooks"];
```

**Rationale:** Stripe webhook endpoints must be publicly accessible to receive webhook events from Stripe's servers.

---

### 2. Production Environment Configuration
**File:** `render.yaml`

**Changes:**
- Added Stripe environment variables to both `merchops-web` and `merchops-worker` services
- All variables marked with `sync: false` to be set manually in Render dashboard

**Variables Added:**
```yaml
# Stripe (Payments)
- key: STRIPE_SECRET_KEY
  sync: false
- key: STRIPE_PUBLISHABLE_KEY
  sync: false
- key: STRIPE_WEBHOOK_SECRET
  sync: false
- key: STRIPE_STARTER_PRICE_ID
  sync: false
- key: STRIPE_GROWTH_PRICE_ID
  sync: false
- key: STRIPE_PRO_PRICE_ID
  sync: false
```

**Rationale:** Both web and worker services need access to Stripe credentials for subscription management and webhook processing.

---

### 3. Development Environment Template
**File:** `.env.example`

**Changes:**
- Added new "Stripe Payments" section with all required variables
- Included setup instructions and placeholder values
- Updated production checklist to include Stripe variables

**New Section:**
```bash
# =============================================================================
# OPTIONAL - Stripe Payments
# =============================================================================
# Create account at: https://dashboard.stripe.com/
# Set up products/prices for Starter ($49), Growth ($149), Pro ($399)

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Price IDs from Stripe Dashboard (Products > Prices)
STRIPE_STARTER_PRICE_ID="price_..."
STRIPE_GROWTH_PRICE_ID="price_..."
STRIPE_PRO_PRICE_ID="price_..."
```

**Rationale:** Developers need clear guidance on setting up Stripe for local development.

---

### 4. Opportunity Creation Limit Enforcement
**File:** `apps/web/server/opportunities/create.ts`

**Changes:**
- Added TODO comments for billing limit checks before opportunity creation
- Added TODO comments for usage increment after successful creation

**Code Added:**
```typescript
// TODO: Billing integration - uncomment when billing module is complete
// import { checkLimit, incrementUsage } from '@/server/billing';
// await checkLimit(workspace_id, 'opportunities');

// ... opportunity creation logic ...

// TODO: Billing integration - uncomment when billing module is complete
// await incrementUsage(workspace_id, 'opportunities');
```

**Rationale:** Plan-based limits on opportunities will be enforced once billing module is complete.

---

### 5. Action Execution Limit Enforcement
**File:** `apps/web/server/actions/execute/index.ts`

**Changes:**
- Added TODO comments for billing limit checks before action execution
- Added TODO comments for usage increment only on successful execution

**Code Added:**
```typescript
// TODO: Billing integration - uncomment when billing module is complete
// import { checkLimit, incrementUsage } from '@/server/billing';
// await checkLimit(workspaceId, 'actions');

// ... execution logic ...

// TODO: Billing integration - uncomment when billing module is complete
// Only increment usage on successful execution
// if (result.success) {
//   await incrementUsage(workspaceId, 'actions');
// }
```

**Rationale:** Only successful actions count toward plan limits to avoid charging for failures.

---

### 6. Event Ingestion Limit Enforcement
**File:** `apps/web/server/events/create.ts`

**Changes:**
- Added TODO comments for billing limit checks before event creation
- Added TODO comments for usage increment after successful creation

**Code Added:**
```typescript
// TODO: Billing integration - uncomment when billing module is complete
// import { checkLimit, incrementUsage } from '@/server/billing';
// await checkLimit(workspace_id, 'events');

// ... event creation logic ...

// TODO: Billing integration - uncomment when billing module is complete
// await incrementUsage(workspace_id, 'events');
```

**Rationale:** High-volume stores on lower tiers need event ingestion limits.

---

### 7. Settings Navigation
**File:** `apps/web/app/(dashboard)/settings/page.tsx`

**Changes:**
- Added billing card to settings page as first item
- Links to `/settings/billing` route
- Includes credit card icon and descriptive copy

**UI Addition:**
```typescript
<Link href="/settings/billing">
  <Card>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10">
            {/* Credit card icon */}
          </div>
          <div>
            <h2>Billing & Subscription</h2>
            <p>Manage your plan, usage, and payment method</p>
          </div>
        </div>
      </div>
      {/* Arrow icon */}
    </div>
  </Card>
</Link>
```

**Rationale:** Prominent placement ensures users can easily access billing management.

---

## Next Steps

### To Complete Billing Integration

1. **Uncomment Limit Enforcement** (after billing module is complete)
   - In `apps/web/server/opportunities/create.ts`
   - In `apps/web/server/actions/execute/index.ts`
   - In `apps/web/server/events/create.ts`

2. **Import Billing Functions**
   ```typescript
   import { checkLimit, incrementUsage } from '@/server/billing';
   ```

3. **Test Limit Enforcement**
   - Verify limits are enforced for each plan tier
   - Verify usage increments correctly
   - Verify error handling when limits are exceeded

4. **Production Setup**
   - Create Stripe products for Starter, Growth, Pro plans
   - Set up webhook endpoint in Stripe dashboard
   - Configure environment variables in Render
   - Test end-to-end subscription flow

---

## Plan Limits Reference

From `prisma/schema.prisma`:

| Plan     | Price | Opportunities | Actions | Events   |
|----------|-------|---------------|---------|----------|
| Starter  | $49   | 25/month      | 50/mo   | 1000/mo  |
| Growth   | $149  | 100/month     | 250/mo  | 10000/mo |
| Pro      | $399  | Unlimited     | 1000/mo | 50000/mo |

---

## Verification Checklist

- [x] Middleware updated with billing webhook route
- [x] Render.yaml includes all Stripe environment variables for web service
- [x] Render.yaml includes all Stripe environment variables for worker service
- [x] .env.example documents Stripe configuration
- [x] Opportunity creation has TODO for limit checks
- [x] Action execution has TODO for limit checks
- [x] Event creation has TODO for limit checks
- [x] Settings page includes billing navigation link
- [x] Production checklist updated with Stripe variables

---

## Files Modified

1. `/Users/devarisbrown/Code/projects/merchops.ai/apps/web/middleware.ts`
2. `/Users/devarisbrown/Code/projects/merchops.ai/render.yaml`
3. `/Users/devarisbrown/Code/projects/merchops.ai/.env.example`
4. `/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/opportunities/create.ts`
5. `/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/actions/execute/index.ts`
6. `/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/events/create.ts`
7. `/Users/devarisbrown/Code/projects/merchops.ai/apps/web/app/(dashboard)/settings/page.tsx`

---

## Security Considerations

1. **Webhook Authentication:** Stripe webhooks are public but verified via HMAC signature in the webhook handler
2. **Secret Management:** All Stripe secrets marked `sync: false` in render.yaml to prevent accidental exposure
3. **Client-Side Keys:** Only publishable key is safe for client-side use
4. **Webhook Endpoint:** Added to public routes but includes signature verification in handler

---

## Testing Notes

When billing module is complete, test:

1. **Limit Enforcement:**
   - Create opportunities up to plan limit
   - Verify error when limit exceeded
   - Verify upgrade prompt shown to user

2. **Usage Tracking:**
   - Verify usage increments correctly
   - Verify usage resets monthly
   - Verify usage visible in billing UI

3. **Webhook Processing:**
   - Simulate subscription created event
   - Simulate subscription updated event
   - Simulate subscription cancelled event
   - Verify database updates correctly

---

Generated: 2026-01-24
Status: Integration points ready, waiting for billing module completion
