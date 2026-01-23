# MerchOps Shared Schemas

This package contains all Zod validation schemas for the MerchOps Beta MVP. These schemas are used for runtime validation across both client and server, ensuring type safety and data integrity throughout the application.

## Design Principles

1. **Single Source of Truth**: Each schema directly matches the Prisma model
2. **Runtime Validation**: Zod provides runtime type checking beyond TypeScript's compile-time checks
3. **Reusability**: Schemas are shared between client API calls and server-side validation
4. **Composability**: Schemas can be extended and combined for complex validations

## Usage

### Basic Import

```typescript
import { createWorkspaceSchema, type CreateWorkspaceInput } from '@merchops/shared/schemas';

// Validate input
const result = createWorkspaceSchema.safeParse(userInput);
if (!result.success) {
  console.error(result.error);
}

// Type-safe data
const data: CreateWorkspaceInput = result.data;
```

### Server-Side API Validation

```typescript
import { createEventSchema } from '@merchops/shared/schemas';

export async function POST(req: Request) {
  const body = await req.json();

  // Validate and parse
  const validated = createEventSchema.parse(body);

  // Now validated.workspace_id is guaranteed to be a valid UUID
  await prisma.event.create({
    data: validated,
  });
}
```

### Client-Side Form Validation

```typescript
import { registerUserSchema } from '@merchops/shared/schemas';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm({
  resolver: zodResolver(registerUserSchema),
});
```

## Schema Organization

### Workspace (`workspace.ts`)
- `workspaceSchema` - Base workspace model
- `createWorkspaceSchema` - For creating workspaces
- `updateWorkspaceSchema` - For updating workspaces

### User (`user.ts`)
- `userSchema` - Base user model (includes password_hash)
- `publicUserSchema` - Public user data (no sensitive fields)
- `registerUserSchema` - Registration validation with password rules
- `loginUserSchema` - Login validation

### Shopify (`shopify.ts`)
- `shopifyConnectionSchema` - Shopify connection model
- `shopifyOAuthCallbackSchema` - OAuth callback validation
- `shopifyWebhookSchema` - Webhook payload validation
- `shopifyObjectCacheSchema` - Cached Shopify objects

### Event (`event.ts`)
- `eventSchema` - Base immutable event
- `createEventSchema` - Event creation
- Event-specific payload schemas:
  - `inventoryThresholdPayloadSchema`
  - `productOutOfStockPayloadSchema`
  - `velocitySpikePayloadSchema`
  - `customerInactivityPayloadSchema`

### Opportunity (`opportunity.ts`)
- `opportunitySchema` - Base opportunity model
- `createOpportunitySchema` - Requires why_now, rationale, counterfactual
- `queryOpportunitiesSchema` - Filtering and pagination
- Priority buckets and state enums

### Action (`action.ts`)
- `actionDraftSchema` - Base action draft
- `createActionDraftSchema` - Draft creation
- Execution-specific payload schemas:
  - `discountDraftPayloadSchema`
  - `winbackEmailDraftPayloadSchema`
  - `pauseProductPayloadSchema`
- Editable fields schemas for safe inline editing

### Execution (`execution.ts`)
- `executionSchema` - Immutable execution record
- `createExecutionSchema` - Requires idempotency key
- `executionErrorCodeSchema` - Structured error taxonomy
- Provider response schemas

### Outcome (`outcome.ts`)
- `outcomeSchema` - Learning loop outcome
- Evidence schemas by action type:
  - `discountOutcomeEvidenceSchema`
  - `winbackOutcomeEvidenceSchema`
  - `pauseProductOutcomeEvidenceSchema`
- `confidenceScoreSchema` - Confidence scoring output

### AI Generation (`ai-generation.ts`)
- `aiGenerationSchema` - AI audit trail
- Prompt-specific input/output schemas:
  - `opportunityRationaleInputSchema` / `opportunityRationaleOutputSchema`
  - `emailCopyInputSchema` / `emailCopyOutputSchema`
  - `discountCodeInputSchema` / `discountCodeOutputSchema`

## Validation Patterns

### Parse vs SafeParse

```typescript
// parse() - Throws on validation error
const data = schema.parse(input);

// safeParse() - Returns result object
const result = schema.safeParse(input);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

### Partial Updates

```typescript
// Allow partial updates
const partialSchema = updateWorkspaceSchema.partial();
```

### Custom Validation

```typescript
const schema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
});
```

## Best Practices

1. **Always validate at API boundaries**: Never trust client input
2. **Use safeParse for user input**: Provide friendly error messages
3. **Use parse for internal operations**: Let errors bubble up
4. **Extend schemas for relations**: Use `.extend()` for complex queries
5. **Version prompt schemas**: Include version in prompt inputs for auditability

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { createEventSchema } from '@merchops/shared/schemas';

describe('Event Schema', () => {
  it('validates correct event data', () => {
    const result = createEventSchema.safeParse({
      workspace_id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'product_out_of_stock',
      occurred_at: new Date(),
      payload_json: { product_id: '123' },
      dedupe_key: 'unique-key',
      source: 'webhook',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = createEventSchema.safeParse({
      workspace_id: 'invalid-uuid',
      // ... rest of data
    });

    expect(result.success).toBe(false);
  });
});
```

## Migration Guide

When Prisma schema changes:

1. Update the corresponding Zod schema
2. Update any derived schemas (create, update, query)
3. Update related payload/evidence schemas if needed
4. Run tests to ensure validation still works
5. Update API documentation

## Type Inference

All schemas export their inferred TypeScript types:

```typescript
import type {
  Opportunity,
  CreateOpportunityInput,
  QueryOpportunitiesInput
} from '@merchops/shared/schemas';
```

This ensures consistency between runtime validation and compile-time types.
