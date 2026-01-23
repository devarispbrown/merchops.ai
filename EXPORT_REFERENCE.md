# MerchOps Module Exports Reference

Quick reference guide for all the newly created and fixed module exports.

## Draft Actions (`/apps/web/server/actions/drafts/`)

### create.ts
```typescript
import { createActionDraft } from '@/server/actions/drafts/create';

// Create a new action draft from an opportunity
const draft = await createActionDraft({
  workspaceId: string,
  opportunityId: string,
});

// Returns: Draft object with id, payload, editableFields
```

### edit.ts
```typescript
import { editActionDraft } from '@/server/actions/drafts/edit';

// Edit an existing draft
const result = await editActionDraft({
  draftId: string,
  updates: Record<string, unknown>,
});

// Returns: UpdateDraftResult with success flag and updated draft
```

### approve.ts
```typescript
import { approveActionDraft } from '@/server/actions/drafts/approve';

// Approve a draft and queue execution
const result = await approveActionDraft({
  draftId: string,
});

// Returns: { draft, execution, job }
```

## Outcome Resolvers (`/apps/web/server/learning/outcomes/resolvers/`)

### discount.ts
```typescript
import { resolveDiscountOutcome } from '@/server/learning/outcomes/resolvers/discount';

const outcome = await resolveDiscountOutcome({
  workspace_id: string,
  execution_payload: any,
  executed_at: Date,
});

// Returns: OutcomeComputationResult with outcome type and evidence
```

### winback.ts
```typescript
import { resolveWinbackOutcome } from '@/server/learning/outcomes/resolvers/winback';

const outcome = await resolveWinbackOutcome({
  workspace_id: string,
  execution_payload: any,
  executed_at: Date,
});

// Returns: OutcomeComputationResult with outcome type and evidence
```

### pause.ts
```typescript
import { resolvePauseProductOutcome } from '@/server/learning/outcomes/resolvers/pause';

const outcome = await resolvePauseProductOutcome({
  workspace_id: string,
  execution_payload: any,
  executed_at: Date,
});

// Returns: OutcomeComputationResult with outcome type and evidence
```

## Confidence Scores (`/apps/web/server/learning/confidence.ts`)

```typescript
import {
  updateConfidenceScores,
  calculateConfidence,
  calculateAllConfidenceScores,
  getConfidenceLevel,
  getConfidenceExplanation
} from '@/server/learning/confidence';

// Update and persist confidence scores for a workspace
const scores = await updateConfidenceScores(workspaceId);

// Calculate confidence for a specific intent
const score = await calculateConfidence(workspaceId, operatorIntent);

// Calculate all confidence scores
const allScores = await calculateAllConfidenceScores(workspaceId);

// Get human-readable confidence level
const level = getConfidenceLevel(score.score); // "High" | "Medium" | "Low"

// Get detailed explanation
const explanation = getConfidenceExplanation(score);
```

## AI Generation (`/apps/web/server/ai/`)

### generate.ts
```typescript
import { generateOpportunityContent } from '@/server/ai/generate';

const content = await generateOpportunityContent({
  workspaceId: string,
  opportunityType: string,
  operatorIntent: string,
  storeContext?: Record<string, any>,
  prisma: PrismaClient,
});

// Returns: { rationale, why_now, counterfactual, impact_range?, confidence_note? }
```

### fallbacks.ts
```typescript
import {
  getOpportunityFallback,
  generateOpportunityRationaleFallback,
  generateDiscountCopyFallback,
  generateWinbackEmailFallback
} from '@/server/ai/fallbacks';

// Get opportunity fallback (alias for generateOpportunityRationaleFallback)
const content = getOpportunityFallback({
  workspaceId: string,
  opportunityType: string,
  operatorIntent: string,
  storeContext: Record<string, any>,
  eventsSummary: string,
  timeWindow: { start: Date, end: Date },
});

// Generate discount copy fallback
const discountCopy = generateDiscountCopyFallback({
  workspaceId: string,
  productName: string,
  discountPercent: number,
  inventoryRemaining?: number,
  expiryDate?: string,
});

// Generate winback email fallback
const emailCopy = generateWinbackEmailFallback({
  workspaceId: string,
  customerName?: string,
  daysSinceLastPurchase: number,
  recommendedProducts?: string[],
  previousPurchaseCategory?: string,
  incentivePercent?: number,
});
```

## Shared Schemas (`/packages/shared/schemas/action.ts`)

```typescript
import {
  validatePayloadForExecutionType,
  type ExecutionType,
  type OperatorIntent,
  type ActionDraft,
  // ... other types and schemas
} from '@merchops/shared/schemas/action';

// Validate payload against execution type schema
const validatedPayload = validatePayloadForExecutionType(
  executionType,
  payload
);
```

## Usage Examples

### Complete Draft Flow

```typescript
import { createActionDraft } from '@/server/actions/drafts/create';
import { editActionDraft } from '@/server/actions/drafts/edit';
import { approveActionDraft } from '@/server/actions/drafts/approve';

// 1. Create draft
const draft = await createActionDraft({
  workspaceId: 'workspace-123',
  opportunityId: 'opp-456',
});

// 2. Edit draft (optional)
const edited = await editActionDraft({
  draftId: draft.id,
  updates: {
    discount_value: 25,
    ends_at: new Date('2026-02-01').toISOString(),
  },
});

// 3. Approve and execute
const result = await approveActionDraft({
  draftId: draft.id,
});

console.log('Execution queued:', result.execution.id);
```

### Outcome Tracking Flow

```typescript
import { resolveDiscountOutcome } from '@/server/learning/outcomes/resolvers/discount';
import { updateConfidenceScores } from '@/server/learning/confidence';

// After execution completes, resolve outcome
const outcome = await resolveDiscountOutcome({
  workspace_id: 'workspace-123',
  execution_payload: execution.request_payload_json,
  executed_at: execution.started_at,
});

// Update confidence scores based on new outcome
const scores = await updateConfidenceScores('workspace-123');

console.log('Outcome:', outcome.outcome); // "helped" | "neutral" | "hurt"
console.log('New confidence scores:', scores);
```

### AI Content Generation Flow

```typescript
import { generateOpportunityContent } from '@/server/ai/generate';
import { prisma } from '@/server/db/client';

// Generate content for opportunity
const content = await generateOpportunityContent({
  workspaceId: 'workspace-123',
  opportunityType: 'inventory_clearance',
  operatorIntent: 'reduce_inventory_risk',
  storeContext: {
    productName: 'Summer Dress',
    currentInventory: 45,
  },
  prisma,
});

console.log('Rationale:', content.rationale);
console.log('Why now:', content.why_now);
console.log('Impact range:', content.impact_range);
```

## Import Path Reference

- **Server Actions**: `@/server/actions/drafts/{create|edit|approve}`
- **Outcome Resolvers**: `@/server/learning/outcomes/resolvers/{discount|winback|pause}`
- **Confidence**: `@/server/learning/confidence`
- **AI Generation**: `@/server/ai/{generate|fallbacks}`
- **Shared Schemas**: `@merchops/shared/schemas/action`

## Notes

1. All functions use TypeScript for type safety
2. Wrapper functions handle workspace context automatically when needed
3. Error handling is inherited from internal implementations
4. All async functions return Promises
5. Database operations use Prisma client from `@/server/db/client`
