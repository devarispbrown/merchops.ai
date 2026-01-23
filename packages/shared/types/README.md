# MerchOps Shared Types

Comprehensive TypeScript type definitions for the MerchOps application. All types are strictly typed with JSDoc documentation and match the Prisma schema exactly.

## Overview

This package provides enterprise-grade type definitions for:

- **Workspace & User Management** - Multi-tenant workspace and user types
- **Shopify Integration** - OAuth, webhooks, and API response types
- **Event System** - Immutable event store with deduplication
- **Opportunity Engine** - Prioritized, explainable opportunity suggestions
- **Action Drafts** - Safe action drafting with editable fields
- **Execution Engine** - Idempotent execution with retry logic
- **Learning Loop** - Outcome tracking and confidence scoring
- **API Contracts** - Standardized response wrappers and error handling

## Type Categories

### 1. Workspace Types (`workspace.ts`)

Core workspace entity representing a single Shopify store.

```typescript
import { Workspace, WorkspaceWithUser, CreateWorkspaceInput } from '@merchops/shared/types';

// Basic workspace
const workspace: Workspace = {
  id: '...',
  name: 'My Store',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Workspace with user context
const workspaceWithUser: WorkspaceWithUser = {
  ...workspace,
  user: {
    id: '...',
    email: 'user@example.com',
    name: 'John Doe',
  },
};
```

### 2. User Types (`user.ts`)

User management with session handling.

```typescript
import { User, UserSession, PublicUserProfile } from '@merchops/shared/types';

// Session from NextAuth
const session: UserSession = {
  user: { id: '...', email: '...', name: '...', image: null },
  workspaceId: '...',
  expires: '2024-12-31T23:59:59Z',
};
```

### 3. Shopify Types (`shopify.ts`)

Complete Shopify integration types including OAuth and webhooks.

```typescript
import {
  ShopifyConnection,
  ShopifyWebhookPayload,
  ShopifyOrderWebhook,
  ShopifyApiResponse,
} from '@merchops/shared/types';

// Webhook handler
function handleWebhook(payload: ShopifyWebhookPayload) {
  if ('order_number' in payload) {
    const order = payload as ShopifyOrderWebhook;
    console.log(`Order ${order.order_number} received`);
  }
}
```

### 4. Event Types (`event.ts`)

Immutable event store with comprehensive payload types.

```typescript
import {
  Event,
  EventType,
  CreateEventInput,
  InventoryThresholdCrossedPayload,
} from '@merchops/shared/types';

// Create event
const eventInput: CreateEventInput = {
  workspaceId: '...',
  type: EventType.INVENTORY_THRESHOLD_CROSSED,
  payload: {
    productId: '...',
    variantId: '...',
    currentInventory: 5,
    threshold: 10,
    // ... other fields
  } as InventoryThresholdCrossedPayload,
  dedupeKey: 'inventory:product123:2024-01-23',
};
```

### 5. Opportunity Types (`opportunity.ts`)

Ranked, explainable opportunities with why-now and counterfactual.

```typescript
import {
  Opportunity,
  OpportunityType,
  PriorityBucket,
  CreateOpportunityInput,
} from '@merchops/shared/types';

const opportunity: CreateOpportunityInput = {
  workspaceId: '...',
  type: OpportunityType.REDUCE_INVENTORY_RISK,
  priorityBucket: PriorityBucket.HIGH,
  whyNow: 'Product inventory dropped to 5 units (50% threshold)',
  rationale: 'Clear excess inventory before it becomes deadstock',
  counterfactual: 'Without action, likely stockout in 3-5 days',
  decayAt: new Date('2024-02-01'),
  confidence: { score: 0.85, factors: [...], sampleSize: 12 },
  eventIds: ['event1', 'event2'],
};
```

### 6. Action Types (`action.ts`)

Action drafts with editable fields and payload preview.

```typescript
import {
  ActionDraft,
  DiscountDraftPayload,
  EditableFields,
  ExecutionType,
} from '@merchops/shared/types';

// Discount draft
const discountPayload: DiscountDraftPayload = {
  discountType: 'percentage',
  value: 20,
  code: 'CLEARANCE20',
  title: '20% Off Clearance',
  startsAt: '2024-01-23T00:00:00Z',
  endsAt: '2024-01-30T23:59:59Z',
  productIds: ['product123'],
};

// Editable fields
const editableFields: EditableFields[] = [
  {
    name: 'value',
    label: 'Discount Percentage',
    type: 'number',
    value: 20,
    validation: { required: true, min: 5, max: 50 },
    helpText: 'Discount percentage (5-50%)',
  },
];
```

### 7. Execution Types (`execution.ts`)

Immutable execution logs with retry configuration.

```typescript
import {
  Execution,
  ExecutionStatus,
  RetryConfig,
  CreateExecutionInput,
} from '@merchops/shared/types';

const executionInput: CreateExecutionInput = {
  workspaceId: '...',
  actionDraftId: '...',
  requestPayload: { /* ... */ },
  idempotencyKey: 'workspace:draft123:hash',
  correlationId: 'req-abc123',
  retryConfig: {
    maxRetries: 3,
    currentAttempt: 0,
    backoffStrategy: 'exponential',
    initialDelayMs: 1000,
    maxDelayMs: 30000,
  },
};
```

### 8. Outcome Types (`outcome.ts`)

Learning loop with evidence-based outcome determination.

```typescript
import {
  Outcome,
  OutcomeType,
  OutcomeEvidence,
  MetricComparison,
} from '@merchops/shared/types';

const evidence: OutcomeEvidence = {
  type: EvidenceType.REVENUE_UPLIFT,
  metrics: [
    {
      metric: 'revenue',
      baseline: 1000,
      actual: 1250,
      percentageChange: 25,
      unit: 'USD',
      timeWindow: '7 days',
    },
  ],
  summary: 'Revenue increased 25% vs baseline',
  collectedFrom: new Date('2024-01-23'),
  collectedTo: new Date('2024-01-30'),
  confidence: 0.9,
};
```

### 9. API Types (`api.ts`)

Standardized API responses and error handling.

```typescript
import {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  TypeGuards,
} from '@merchops/shared';

// Success response
const success: ApiResponse<Opportunity> = {
  success: true,
  data: opportunity,
  meta: {
    timestamp: new Date().toISOString(),
    requestId: 'req-123',
  },
};

// Error response
const error: ApiResponse<never> = {
  success: false,
  error: {
    code: 'validation_error',
    message: 'Invalid input',
    statusCode: 422,
    details: [
      { field: 'email', message: 'Invalid email format' },
    ],
  },
};

// Type guards
if (TypeGuards.isSuccessResponse(response)) {
  // response.data is typed correctly
  console.log(response.data);
} else {
  // response.error is typed correctly
  console.error(response.error.message);
}
```

## Enumerations

All enums are exported both as types and runtime values:

```typescript
import {
  EventType,
  OpportunityType,
  PriorityBucket,
  OpportunityState,
  OperatorIntent,
  ExecutionType,
  ExecutionStatus,
  OutcomeType,
} from '@merchops/shared';

// Runtime usage
const eventTypes = Object.values(EventType);
const isValidPriority = (value: string): value is PriorityBucket => {
  return Object.values(PriorityBucket).includes(value as PriorityBucket);
};
```

## Type Guards

Use the built-in type guards for runtime type checking:

```typescript
import { TypeGuards } from '@merchops/shared';

// API response guards
if (TypeGuards.isSuccessResponse(response)) {
  // TypeScript knows response.data exists
}

if (TypeGuards.isErrorResponse(response)) {
  // TypeScript knows response.error exists
}

if (TypeGuards.isApiError(value)) {
  // TypeScript knows it's an ApiError
}
```

## Type Helpers

Utility type helpers for advanced type manipulation:

```typescript
import { TypeHelpers } from '@merchops/shared';

// Make specific keys required
type UserWithEmail = TypeHelpers.RequireKeys<User, 'email'>;

// Make specific keys optional
type PartialWorkspace = TypeHelpers.OptionalKeys<Workspace, 'settings'>;

// Deep readonly
type ImmutableEvent = TypeHelpers.DeepReadonly<Event>;

// Nullable and Optional
type NullableString = TypeHelpers.Nullable<string>; // string | null
type OptionalString = TypeHelpers.Optional<string>; // string | null | undefined
```

## Best Practices

### 1. Always Use Strict Types

```typescript
// Good: Explicit type annotation
const opportunity: Opportunity = createOpportunity();

// Bad: Type inference might be too broad
const opportunity = createOpportunity();
```

### 2. Use Input Types for Creation

```typescript
// Good: Use dedicated input types
function createEvent(input: CreateEventInput): Promise<Event> {
  // ...
}

// Bad: Partial types lose validation
function createEvent(input: Partial<Event>): Promise<Event> {
  // ...
}
```

### 3. Leverage Union Types

```typescript
// Event payload is a discriminated union
function handleEvent(event: Event) {
  switch (event.type) {
    case EventType.INVENTORY_THRESHOLD_CROSSED:
      // TypeScript narrows payload to InventoryThresholdCrossedPayload
      const payload = event.payload as InventoryThresholdCrossedPayload;
      console.log(payload.currentInventory);
      break;
    // ...
  }
}
```

### 4. Use Type Guards for API Responses

```typescript
import { TypeGuards } from '@merchops/shared';

async function fetchOpportunity(id: string) {
  const response = await api.get<Opportunity>(`/opportunities/${id}`);

  if (TypeGuards.isSuccessResponse(response)) {
    return response.data; // Typed as Opportunity
  } else {
    throw new Error(response.error.message); // Typed as ApiError
  }
}
```

### 5. Maintain Type-Schema Alignment

All types MUST match the Prisma schema exactly. When updating types:

1. Update Prisma schema first
2. Generate migration
3. Update TypeScript types
4. Run typecheck
5. Update Zod schemas (in `/schemas`)

## Type Coverage

- **100% strict mode** - All types use strictest TypeScript settings
- **Comprehensive JSDoc** - Every interface and type is documented
- **No `any` types** - All types are explicitly defined
- **Exhaustive unions** - All payload types are strictly typed
- **Immutability** - Core entities (Event, Execution, Outcome) are immutable

## Integration with Prisma

These types complement Prisma-generated types:

```typescript
import { Event as PrismaEvent } from '@prisma/client';
import { Event as AppEvent } from '@merchops/shared/types';

// Prisma types for database operations
async function findEvent(id: string): Promise<PrismaEvent | null> {
  return prisma.event.findUnique({ where: { id } });
}

// App types for business logic
function processEvent(event: AppEvent) {
  // Business logic uses app types
}

// Conversion between types
function toAppEvent(prismaEvent: PrismaEvent): AppEvent {
  return {
    ...prismaEvent,
    payload: JSON.parse(prismaEvent.payloadJson),
    metadata: prismaEvent.metadata ? JSON.parse(prismaEvent.metadata) : undefined,
  };
}
```

## Migration Guide

When types change:

1. **Breaking changes**: Increment major version
2. **New optional fields**: Increment minor version
3. **Documentation only**: Increment patch version

### Example Migration

```typescript
// Before: v0.1.0
interface Opportunity {
  id: string;
  whyNow: string;
}

// After: v0.2.0 (non-breaking: optional field)
interface Opportunity {
  id: string;
  whyNow: string;
  metadata?: Record<string, unknown>; // New optional field
}

// After: v1.0.0 (breaking: required field)
interface Opportunity {
  id: string;
  whyNow: string;
  confidence: ConfidenceScore; // New required field
}
```

## Testing Types

Use TypeScript's type system for compile-time tests:

```typescript
import { expectType } from 'tsd';
import { Event, EventType } from '@merchops/shared/types';

// Compile-time type assertions
const event: Event = {
  id: '123',
  type: EventType.INVENTORY_THRESHOLD_CROSSED,
  // ...
};

expectType<Event>(event);
expectType<string>(event.id);
expectType<Date>(event.createdAt);
```

## Contributing

When adding new types:

1. Add comprehensive JSDoc comments
2. Use strict typing (no `any`, minimal `unknown`)
3. Export from `/types/index.ts`
4. Add usage examples to this README
5. Run `npm run typecheck` to verify
6. Update Zod schemas if needed

## License

Private - MerchOps Internal Use Only
