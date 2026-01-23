# MerchOps AI Prompt System

## Overview

The MerchOps prompt system provides versioned, auditable AI generation with deterministic fallbacks. All prompts are designed to never hallucinate metrics, use manipulative language, or violate the product's "calm over clever" principle.

## Architecture

### Core Principles

1. **Versioning**: Every prompt has a version identifier (e.g., `opportunity-rationale-v1`)
2. **Audit Trail**: All AI generations are logged to `ai_generations` table
3. **Deterministic Fallbacks**: Safe template-based generation when AI is unavailable
4. **Structured I/O**: All prompts use typed inputs and outputs
5. **No Hallucination**: Prompts never invent metrics not provided in input

### Directory Structure

```
/packages/shared/prompts/
  types.ts                    # Core type definitions
  opportunity-rationale.ts    # Opportunity explanation prompt
  discount-copy.ts            # Discount email copy prompt
  winback-email.ts            # Win-back email prompt
  index.ts                    # Central registry

/apps/web/server/ai/
  generate.ts                 # AI generation engine with logging
  fallbacks.ts                # Deterministic fallback generators
```

## Prompt Versioning Strategy

### Version Format

Versions follow the pattern: `{prompt-name}-v{number}`

Examples:
- `opportunity-rationale-v1`
- `discount-copy-v1`
- `winback-email-v1`

### When to Create a New Version

Create a new version when:
1. System prompt changes materially
2. Output schema changes (new required fields)
3. Prompt behavior needs to change for better results
4. Compliance or safety requirements change

Do NOT create a new version for:
- Minor wording tweaks
- Bug fixes in fallback templates
- Code refactoring without behavior change

### Version Migration

Old versions remain in the codebase but are not used for new generations. To migrate:

1. Create new version file (e.g., `opportunity-rationale-v2.ts`)
2. Add to `PROMPT_REGISTRY` in `index.ts`
3. Update calling code to use new version
4. Keep old version for audit trail and comparison

## Available Prompts

### 1. Opportunity Rationale (`opportunity-rationale-v1`)

**Purpose**: Generate explanation for why an opportunity surfaced, why now, and counterfactual.

**Input**:
```typescript
{
  workspaceId: string;
  opportunityType: string;
  operatorIntent: string;
  eventsSummary: string;
  storeContext?: {
    storeName?: string;
    productName?: string;
    currentInventory?: number;
    velocityLast14Days?: number;
    lastPurchaseDate?: string;
    customerSegmentSize?: number;
  };
  timeWindow: {
    startDate: string;
    endDate: string;
  };
}
```

**Output**:
```typescript
{
  rationale: string;
  why_now: string;
  counterfactual: string;
  impact_range?: string;
  confidence_note?: string;
}
```

**Fallback Behavior**: Uses template-based generation with operator intent-specific logic. Never invents metrics.

### 2. Discount Copy (`discount-copy-v1`)

**Purpose**: Generate calm, informative discount copy for emails/notifications.

**Input**:
```typescript
{
  workspaceId: string;
  productName: string;
  discountPercent: number;
  urgencyLevel: "low" | "medium" | "high";
  storeName?: string;
  inventoryRemaining?: number;
  expiryDate?: string;
  context?: string;
}
```

**Output**:
```typescript
{
  rationale: string;
  why_now: string;
  counterfactual: string;
  subject_line: string;
  body_copy: string;
  cta_text: string;
}
```

**Fallback Behavior**: Template-based copy that respects urgency level without manipulation. Subject lines kept under 50 characters.

### 3. Win-back Email (`winback-email-v1`)

**Purpose**: Generate warm, welcoming win-back email for dormant customers.

**Input**:
```typescript
{
  workspaceId: string;
  customerName?: string;
  lastPurchaseDate: string;
  daysSinceLastPurchase: number;
  recommendedProducts?: string[];
  storeName?: string;
  previousPurchaseCategory?: string;
  incentivePercent?: number;
}
```

**Output**:
```typescript
{
  rationale: string;
  why_now: string;
  counterfactual: string;
  subject: string;
  body: string;
  cta: string;
  personalization_notes?: string;
}
```

**Fallback Behavior**: Warm, personalized template using available data. Never guilt-trips or begs.

## Usage

### Basic Generation

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
    eventsSummary: "Inventory threshold crossed for Product X",
    storeContext: {
      productName: "Product X",
      currentInventory: 12,
      velocityLast14Days: 8,
    },
    timeWindow: {
      startDate: "2026-01-01",
      endDate: "2026-01-15",
    },
  },
  prisma
);

console.log(output.rationale);
console.log(output.why_now);
console.log(output.counterfactual);
```

### Batch Generation

```typescript
import { generateBatch } from "@/server/ai/generate";
import { discountCopyPrompt } from "@merchops/shared/prompts";

const inputs = [
  { workspaceId: "ws-1", productName: "Product A", discountPercent: 15, urgencyLevel: "medium" },
  { workspaceId: "ws-1", productName: "Product B", discountPercent: 20, urgencyLevel: "high" },
];

const outputs = await generateBatch(discountCopyPrompt, inputs, prisma);
```

### Using Fallback Directly

```typescript
import { generateOpportunityRationaleFallback } from "@/server/ai/fallbacks";

const output = generateOpportunityRationaleFallback({
  workspaceId: "workspace-123",
  opportunityType: "inventory_clearance",
  operatorIntent: "reduce_inventory_risk",
  eventsSummary: "Inventory threshold crossed",
  storeContext: { productName: "Product X", currentInventory: 12 },
  timeWindow: { startDate: "2026-01-01", endDate: "2026-01-15" },
});
```

## Audit Table Schema

All AI generations are logged to the `ai_generations` table:

```prisma
model AiGeneration {
  id             String   @id @default(uuid())
  workspace_id   String
  prompt_version String   // e.g., "opportunity-rationale-v1"
  inputs_json    Json     // Complete input data
  outputs_json   Json     // Complete output data
  model          String   // Model identifier or "fallback-template"
  tokens         Int      // Token count (0 for fallback)
  latency_ms     Int      // Generation time in milliseconds
  created_at     DateTime @default(now())

  workspace Workspace @relation(fields: [workspace_id], references: [id], onDelete: Cascade)

  @@index([workspace_id, prompt_version])
  @@index([created_at])
  @@index([model])
}
```

### Query Examples

**Get generation history for a workspace**:
```typescript
import { getGenerationHistory } from "@/server/ai/generate";

const history = await getGenerationHistory("workspace-123", prisma, {
  promptVersion: "opportunity-rationale-v1",
  limit: 50,
});
```

**Get token usage statistics**:
```typescript
import { getTokenStats } from "@/server/ai/generate";

const stats = await getTokenStats("workspace-123", prisma, {
  start: new Date("2026-01-01"),
  end: new Date("2026-01-31"),
});

console.log(`Total tokens: ${stats.total_tokens}`);
console.log(`Fallback rate: ${(stats.fallback_rate * 100).toFixed(1)}%`);
```

## Fallback Behavior

### When Fallbacks Are Used

1. AI service is unavailable
2. AI service returns invalid JSON
3. AI service times out
4. `AI_ENABLED` flag is false (default in development)
5. Quota or rate limits exceeded

### Fallback Guarantees

All fallback templates guarantee:
- Valid output structure matching schema
- No hallucinated metrics or numbers
- Uncertainty language throughout
- Required fields always populated
- Calm, professional tone
- No manipulation or dark patterns

### Testing Fallbacks

Fallbacks can be tested independently:

```typescript
import { opportunityRationalePrompt } from "@merchops/shared/prompts";

const input = {
  workspaceId: "test-ws",
  opportunityType: "inventory_clearance",
  operatorIntent: "reduce_inventory_risk",
  eventsSummary: "Test event",
  timeWindow: { startDate: "2026-01-01", endDate: "2026-01-15" },
};

const output = opportunityRationalePrompt.fallbackGenerator(input);

expect(output.rationale).toBeTruthy();
expect(output.why_now).toBeTruthy();
expect(output.counterfactual).toBeTruthy();
```

## Adding New Prompts

### Step 1: Define Types

Create new input/output interfaces extending base types:

```typescript
// packages/shared/prompts/my-new-prompt.ts
import type { PromptInput, PromptOutput, PromptTemplate } from "./types";

export interface MyPromptInput extends PromptInput {
  workspaceId: string;
  // ... your fields
}

export interface MyPromptOutput extends PromptOutput {
  rationale: string;
  why_now: string;
  counterfactual: string;
  // ... your fields
}
```

### Step 2: Create System Prompt

Write clear instructions following existing patterns:

```typescript
const SYSTEM_PROMPT = `You are a [role] for a Shopify merchant operations console.

Your role is to [purpose].

CRITICAL RULES:
1. NEVER invent metrics or numbers not provided
2. ALWAYS use uncertainty language
3. ALWAYS include rationale, why_now, and counterfactual
...
`;
```

### Step 3: Create User Prompt Template

```typescript
function generateUserPrompt(input: MyPromptInput): string {
  return `Generate [output] for:

Field: ${input.field}
...

Generate JSON output with [required fields].
Use ONLY the data provided.`;
}
```

### Step 4: Create Fallback Generator

```typescript
function generateFallback(input: MyPromptInput): MyPromptOutput {
  // Template-based generation
  return {
    rationale: "...",
    why_now: "...",
    counterfactual: "...",
    // ... your fields
  };
}
```

### Step 5: Export Template

```typescript
export const myPrompt: PromptTemplate<MyPromptInput, MyPromptOutput> = {
  version: "my-prompt-v1",
  systemPrompt: SYSTEM_PROMPT,
  userPromptTemplate: generateUserPrompt,
  outputSchema: {
    description: "...",
    required: ["rationale", "why_now", "counterfactual"],
  },
  fallbackGenerator: generateFallback,
};
```

### Step 6: Register in Index

```typescript
// packages/shared/prompts/index.ts
export * from "./my-new-prompt";
import { myPrompt } from "./my-new-prompt";

export const PROMPT_REGISTRY = {
  // ... existing prompts
  [myPrompt.version]: myPrompt,
} as const;
```

### Step 7: Add Tests

```typescript
import { myPrompt } from "@merchops/shared/prompts";

describe("my-prompt-v1", () => {
  it("generates valid output", () => {
    const input = { ... };
    const output = myPrompt.fallbackGenerator(input);

    expect(output.rationale).toBeTruthy();
    expect(output.why_now).toBeTruthy();
    expect(output.counterfactual).toBeTruthy();
  });

  it("never invents metrics", () => {
    const input = { workspaceId: "test", /* minimal data */ };
    const output = myPrompt.fallbackGenerator(input);

    expect(output.rationale).not.toMatch(/\d{2,}/); // No large numbers
  });
});
```

## Safety Guidelines

### Prohibited Patterns

Never use these patterns in prompts or outputs:

❌ Absolute claims: "will definitely", "guaranteed to"
❌ Pressure tactics: "Act now!", "Last chance!"
❌ Guilt trips: "We miss you!", "Don't let us down"
❌ Invented metrics: "40% increase", "guaranteed savings"
❌ Dark patterns: Fake urgency, hidden costs, manipulation

### Required Patterns

Always include these in outputs:

✅ Uncertainty language: "likely", "estimated", "based on"
✅ Time context: "last 14 days", "within 7-10 days"
✅ Data basis: "based on X metric from Y period"
✅ Counterfactual: What happens if no action taken
✅ Calm tone: Professional, respectful, not pushy

### Validation

Use utility functions to validate outputs:

```typescript
import { validateOutput, sanitizeOutput } from "@/server/ai/fallbacks";

// Validate required fields
if (!validateOutput(output)) {
  throw new Error("Invalid output: missing required fields");
}

// Sanitize text to remove prohibited phrases
const sanitized = sanitizeOutput(output.body_copy);
```

## Monitoring and Observability

### Key Metrics to Track

1. **Fallback Rate**: Percentage of generations using fallback
2. **Token Usage**: Total tokens consumed per workspace
3. **Latency**: P50, P95, P99 generation times
4. **Error Rate**: Failed generations / total attempts
5. **Version Distribution**: Which prompt versions are most used

### Alerts

Set up alerts for:
- Fallback rate > 50% (AI service issue)
- P95 latency > 5 seconds (performance degradation)
- Error rate > 10% (integration problem)
- Sudden spike in token usage (potential abuse)

### Debugging

To debug a generation issue:

1. Query `ai_generations` table with generation ID
2. Inspect `inputs_json` and `outputs_json`
3. Check `model` field (was fallback used?)
4. Review `latency_ms` and `tokens`
5. Compare with other generations of same prompt version

## Integration with Opportunity Engine

Prompts integrate with opportunity engine at generation time:

```typescript
// Example: Generate opportunity with rationale
import { generateAndLog } from "@/server/ai/generate";
import { opportunityRationalePrompt } from "@merchops/shared/prompts";

async function createOpportunity(data: OpportunityData) {
  // Generate AI rationale
  const rationale = await generateAndLog(
    opportunityRationalePrompt,
    {
      workspaceId: data.workspaceId,
      opportunityType: data.type,
      operatorIntent: data.intent,
      eventsSummary: data.events.map(e => e.type).join(", "),
      storeContext: data.context,
      timeWindow: data.timeWindow,
    },
    prisma
  );

  // Create opportunity with generated rationale
  const opportunity = await prisma.opportunity.create({
    data: {
      workspace_id: data.workspaceId,
      type: data.type,
      rationale: rationale.rationale,
      why_now: rationale.why_now,
      counterfactual: rationale.counterfactual,
      impact_range: rationale.impact_range,
      // ... other fields
    },
  });

  return opportunity;
}
```

## Testing Strategy

### Unit Tests

Test fallback generators independently:

```typescript
import { opportunityRationalePrompt } from "@merchops/shared/prompts";

test("fallback never invents metrics", () => {
  const input = {
    workspaceId: "test",
    opportunityType: "test",
    operatorIntent: "reduce_inventory_risk",
    eventsSummary: "test",
    timeWindow: { startDate: "2026-01-01", endDate: "2026-01-15" },
  };

  const output = opportunityRationalePrompt.fallbackGenerator(input);

  // Should not contain any large numbers we didn't provide
  expect(output.rationale).not.toMatch(/\d{3,}/);
  expect(output.why_now).toBeTruthy();
  expect(output.counterfactual).toBeTruthy();
});
```

### Integration Tests

Test full generation flow with mocked AI:

```typescript
import { generateAndLog } from "@/server/ai/generate";
import { opportunityRationalePrompt } from "@merchops/shared/prompts";

test("logs generation to database", async () => {
  const output = await generateAndLog(
    opportunityRationalePrompt,
    testInput,
    prisma
  );

  const logged = await prisma.aiGeneration.findFirst({
    where: {
      workspace_id: testInput.workspaceId,
      prompt_version: "opportunity-rationale-v1",
    },
    orderBy: { created_at: "desc" },
  });

  expect(logged).toBeTruthy();
  expect(logged?.outputs_json).toEqual(output);
});
```

### E2E Tests

Test prompts in full opportunity flow:

```typescript
test("opportunity generation uses AI rationale", async () => {
  // Trigger event that creates opportunity
  await triggerInventoryEvent();

  // Check opportunity was created with rationale
  const opportunity = await findLatestOpportunity();

  expect(opportunity.rationale).toBeTruthy();
  expect(opportunity.why_now).toBeTruthy();
  expect(opportunity.counterfactual).toBeTruthy();

  // Check AI generation was logged
  const generation = await prisma.aiGeneration.findFirst({
    where: { workspace_id: opportunity.workspace_id },
    orderBy: { created_at: "desc" },
  });

  expect(generation).toBeTruthy();
});
```

## Future Enhancements

### Planned Improvements

1. **A/B Testing**: Compare AI vs fallback effectiveness
2. **Human Feedback Loop**: Allow merchants to rate generated copy
3. **Custom Store Voice**: Learn store's tone and style over time
4. **Multi-language Support**: Generate in customer's preferred language
5. **Prompt Optimization**: Automatic prompt refinement based on outcomes
6. **Cost Tracking**: Per-workspace cost allocation and budgets

### Not Planned (Out of Scope)

- Autonomous generation without approval
- Real-time generation (all async via jobs)
- Prompt injection by users
- Unversioned prompts
- AI-generated action execution

## Compliance and Safety

### Data Handling

- All inputs/outputs stored in `ai_generations` table
- PII minimized in logged data
- Retention policy: 90 days (configurable)
- GDPR compliance: deletion on workspace deletion

### Safety Measures

1. Output validation before storage
2. Prohibited phrase detection
3. Hallucination prevention via fallbacks
4. Human review for all AI-generated copy before sending
5. Audit trail for all generations

### Responsible AI Practices

- Transparency: Users know when AI is used
- Control: Users can edit all AI outputs
- Fallback: System works without AI
- Audit: All generations logged and traceable
- Safety: No autonomous actions without approval
