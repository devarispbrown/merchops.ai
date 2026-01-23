# MerchOps Shared Prompts

## Quick Start

```typescript
import { generateAndLog } from "@/server/ai/generate";
import { opportunityRationalePrompt } from "@merchops/shared/prompts";
import { prisma } from "@/server/db";

const output = await generateAndLog(
  opportunityRationalePrompt,
  {
    workspaceId: "workspace-123",
    opportunityType: "inventory_clearance",
    operatorIntent: "reduce_inventory_risk",
    eventsSummary: "Inventory threshold crossed",
    storeContext: {
      productName: "Winter Jacket",
      currentInventory: 12,
    },
    timeWindow: {
      startDate: "2026-01-01",
      endDate: "2026-01-15",
    },
  },
  prisma
);
```

## Available Prompts

### `opportunity-rationale-v1`
Generates explanation for why an opportunity surfaced, including why_now and counterfactual.

### `discount-copy-v1`
Generates calm, informative discount copy for emails/notifications.

### `winback-email-v1`
Generates warm, welcoming win-back email for dormant customers.

## Key Principles

1. **Never invent metrics** - Only use provided data
2. **Always use uncertainty language** - "likely", "estimated", "based on"
3. **Always include counterfactual** - What happens if no action taken
4. **Deterministic fallbacks** - System works without AI
5. **Audit everything** - All generations logged to database

## Safety Guarantees

✅ No hallucinated numbers or metrics
✅ No manipulative urgency tactics
✅ No guilt-tripping or dark patterns
✅ Calm, professional tone throughout
✅ Transparent uncertainty language

## Files

- `types.ts` - Core type definitions
- `opportunity-rationale.ts` - Opportunity explanation prompt
- `discount-copy.ts` - Discount email copy prompt
- `winback-email.ts` - Win-back email prompt
- `index.ts` - Central registry and exports

## Documentation

See `/docs/prompts.md` for complete documentation.

## Tests

See `/apps/web/server/ai/__tests__/prompts.test.ts` for test suite.
