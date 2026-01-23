# Opportunities Engine

Complete opportunity management system for MerchOps. Detects opportunities from store events, prioritizes them, manages their lifecycle, and prevents dismissed opportunities from reappearing.

## Overview

The opportunities engine is the core differentiator of MerchOps. It transforms raw events into actionable, explainable opportunities with:

- **Why now**: Explicit explanation of why this matters at this moment
- **Rationale**: Store-specific reasoning grounded in data
- **Counterfactual**: What happens if no action is taken
- **Priority**: Deterministic ranking based on urgency, consequence, confidence, and novelty
- **Decay**: Automatic expiration when opportunity window closes

## Architecture

```
Events → Creation → Prioritization → State Machine → Queries/Filters → Dismissal
           ↓           ↓                 ↓                ↓               ↓
       AI/Fallback  Scoring         Transitions      Pagination      Prevention
```

## Core Modules

### 1. Types (`types.ts`)

Defines all opportunity-related types, enums, and configurations:

- `OpportunityType`: INVENTORY_CLEARANCE, STOCKOUT_PREVENTION, etc.
- `OpportunityState`: new, viewed, approved, executed, resolved, dismissed, expired
- `PriorityBucket`: HIGH, MEDIUM, LOW
- `OperatorIntent`: reduce_inventory_risk, reengage_dormant_customers, protect_margin
- `DECAY_CONFIGS`: Type-specific decay windows
- `VALID_TRANSITIONS`: State machine rules

### 2. Creation (`create.ts`)

Creates opportunities from events with AI-generated or fallback explanations.

**Key Functions:**

```typescript
// Create opportunity from events
const opportunity = await createOpportunityFromEvents(
  {
    workspaceId: 'ws_123',
    eventIds: ['evt_1', 'evt_2'],
    type: OpportunityType.INVENTORY_CLEARANCE,
    operatorIntent: OperatorIntent.reduce_inventory_risk,
    storeContext: {
      productName: 'Blue Widget',
      currentInventory: 12,
      velocityLast14Days: 8,
    },
  },
  prisma
);

// Batch creation
const opportunities = await createOpportunitiesBatch(inputs, prisma);

// With deduplication
const { opportunity, isDuplicate } = await createOpportunityWithDeduplication(
  input,
  prisma
);
```

**Process:**

1. Validates events exist and belong to workspace
2. Generates rationale using AI or fallback templates
3. Links events via `opportunity_event_links`
4. Calculates priority using prioritization engine
5. Sets decay time based on opportunity type
6. Returns created opportunity

### 3. Prioritization (`prioritize.ts`)

Deterministic priority calculation based on weighted factors.

**Algorithm:**

```
priority_score = 
  urgency × 0.35 +
  consequence × 0.30 +
  confidence × 0.20 +
  novelty × 0.15
```

**Factors:**

- **Urgency** (0-1): Time sensitivity based on decay window and opportunity type
- **Consequence** (0-1): Magnitude of impact if action is or isn't taken
- **Confidence** (0-1): From learning loop (defaults to 0.5)
- **Novelty** (0-1): Diminishes with repeated similar opportunities

**Bucket Assignment:**

- HIGH: score ≥ 70
- MEDIUM: score ≥ 40
- LOW: score < 40

**Usage:**

```typescript
const priorityScore = await calculatePriority({
  opportunity_type: OpportunityType.HIGH_VELOCITY_PROTECTION,
  events: [event1, event2],
  confidence: 0.7,
  previous_opportunity_count: 2,
});
// { bucket: 'high', score: 78.5, factors: { urgency: 0.9, ... } }
```

### 4. Decay (`decay.ts`)

Manages opportunity expiration and decay windows.

**Decay Windows:**

- INVENTORY_CLEARANCE: 72 hours
- STOCKOUT_PREVENTION: 48 hours
- RESTOCK_NOTIFICATION: 24 hours
- WINBACK_CAMPAIGN: 168 hours (7 days)
- HIGH_VELOCITY_PROTECTION: 36 hours

**Key Functions:**

```typescript
// Get decay time for opportunity type
const decayAt = getDecayTime(OpportunityType.STOCKOUT_PREVENTION);

// Check if opportunity has decayed
const { shouldExpire, reason } = checkDecay(opportunity);

// Expire stale opportunities (scheduled job)
const { count, expired_ids } = await expireStaleOpportunities(prisma);

// Get decay statistics
const stats = await getDecayStats(workspaceId, prisma);
```

**Scheduled Job:**

Run `expireStaleOpportunities()` hourly via background job to automatically expire opportunities past their decay time.

### 5. State Machine (`state-machine.ts`)

Validates and executes state transitions.

**Valid Transitions:**

```
new → viewed → approved → executed → resolved
new → dismissed
new → expired
viewed → dismissed
viewed → expired
viewed → approved
approved → executed
approved → dismissed
```

**Usage:**

```typescript
// Transition with validation
const opportunity = await transitionState(
  opportunityId,
  OpportunityState.viewed,
  prisma
);

// Safe transition (no throw)
const { success, opportunity, error } = await tryTransitionState(
  opportunityId,
  OpportunityState.approved,
  prisma
);

// Helper functions
await markAsViewed(opportunityId, prisma);
await markAsApproved(opportunityId, prisma);
await markAsDismissed(opportunityId, prisma);

// Get state machine for opportunity
const stateMachine = await getStateMachine(opportunityId, prisma);
const canApprove = stateMachine.canTransitionTo(OpportunityState.approved);
```

**Errors:**

- `InvalidStateTransitionError`: Thrown when transition is not allowed
- `OpportunityNotFoundError`: Thrown when opportunity doesn't exist

### 6. Queries (`queries.ts`)

Comprehensive querying with filtering and pagination.

**Single Opportunity:**

```typescript
// By ID with workspace validation
const opportunity = await getOpportunityById(id, workspaceId, prisma);

// With linked events
const oppWithEvents = await getOpportunityWithEvents(id, workspaceId, prisma);

// With all relations (events + action drafts)
const oppWithAll = await getOpportunityWithRelations(id, workspaceId, prisma);
```

**List Queries:**

```typescript
// Filtered and paginated
const { opportunities, total } = await getOpportunitiesForWorkspace(
  workspaceId,
  {
    state: [OpportunityState.new, OpportunityState.viewed],
    priority_bucket: PriorityBucket.high,
    limit: 20,
    offset: 0,
    order_by: 'created_at',
    order_direction: 'desc',
  },
  prisma
);

// Active only (non-terminal states)
const active = await getActiveOpportunities(workspaceId, prisma);

// Grouped by priority
const byPriority = await getOpportunitiesByPriority(workspaceId, prisma);
// { high: [...], medium: [...], low: [...] }

// New opportunities (never viewed)
const newOpps = await getNewOpportunities(workspaceId, prisma);
```

**Search and Analytics:**

```typescript
// Text search
const results = await searchOpportunities(workspaceId, 'Blue Widget', prisma);

// Statistics
const stats = await getOpportunityStats(workspaceId, prisma);
// { total, by_state, by_priority, average_confidence }

// Pagination helper
const page = await paginateOpportunities(workspaceId, filters, 1, 20, prisma);
// { items, total, page, page_size, total_pages, has_next, has_prev }
```

### 7. Dismissal (`dismiss.ts`)

Handles dismissal with reappearance prevention.

**Dismissal Logic:**

When an opportunity is dismissed:
1. Transitions to `dismissed` state
2. Generates dismiss key: `{type}:{sorted_event_ids}`
3. Stores dismiss key to prevent identical opportunity from reappearing

**Reappearance Rules:**

Dismissed opportunity reappears ONLY if:
- Event set has changed by >50% (material change)
- OR completely different events

**Usage:**

```typescript
// Dismiss opportunity
const { opportunity, dismiss_key } = await dismissOpportunity(
  opportunityId,
  workspaceId,
  prisma
);

// Batch dismiss
const { succeeded, failed } = await dismissOpportunitiesBatch(
  [id1, id2, id3],
  workspaceId,
  prisma
);

// Check if dismissed
const dismissed = await isDismissed(
  OpportunityType.INVENTORY_CLEARANCE,
  ['evt_1', 'evt_2'],
  workspaceId,
  prisma
);

// Check with material change
const { should_filter, reason } = await shouldFilterDismissed(
  opportunityType,
  eventIds,
  workspaceId,
  prisma
);

// Undismiss (restore)
const restored = await undismissOpportunity(opportunityId, workspaceId, prisma);

// Dismissal analytics
const stats = await getDismissalStats(workspaceId, prisma);
```

## Complete Workflow Example

```typescript
import { prisma } from '../db/client';
import {
  createOpportunityFromEvents,
  markAsViewed,
  markAsApproved,
  dismissOpportunity,
  getActiveOpportunities,
  expireStaleOpportunities,
  OpportunityType,
  OperatorIntent,
} from './opportunities';

// 1. Create opportunity from events
const opportunity = await createOpportunityFromEvents(
  {
    workspaceId: 'ws_123',
    eventIds: ['evt_456', 'evt_789'],
    type: OpportunityType.INVENTORY_CLEARANCE,
    operatorIntent: OperatorIntent.reduce_inventory_risk,
    storeContext: {
      productName: 'Blue Widget',
      currentInventory: 12,
      velocityLast14Days: 8,
    },
  },
  prisma
);
// Priority automatically calculated and assigned

// 2. User views opportunity
await markAsViewed(opportunity.id, prisma);

// 3. User approves opportunity
await markAsApproved(opportunity.id, prisma);
// (Action draft creation happens in actions module)

// 4. OR user dismisses opportunity
await dismissOpportunity(opportunity.id, 'ws_123', prisma);
// Opportunity won't reappear unless events materially change

// 5. Background job: Expire stale opportunities
const { count } = await expireStaleOpportunities(prisma);
console.log(`Expired ${count} stale opportunities`);

// 6. Fetch active opportunities for UI
const active = await getActiveOpportunities('ws_123', prisma);
```

## Testing Guidelines

### Unit Tests

- **Prioritization**: Test all factor calculations are deterministic
- **Decay**: Test decay time calculations and expiration logic
- **State Machine**: Test all valid and invalid transitions
- **Dismiss Keys**: Test key generation and material change detection

### Integration Tests

- **Creation**: Test AI fallback when generation fails
- **Queries**: Test filtering, pagination, and workspace isolation
- **Dismissal**: Test reappearance prevention logic

### Test Utilities

```typescript
// Create test opportunity
const testOpp = await createOpportunityFromEvents(
  {
    workspaceId: testWorkspaceId,
    eventIds: testEventIds,
    type: OpportunityType.INVENTORY_CLEARANCE,
    operatorIntent: OperatorIntent.reduce_inventory_risk,
  },
  prisma
);

// Test state transitions
await expect(
  transitionState(testOpp.id, OpportunityState.resolved, prisma)
).rejects.toThrow(InvalidStateTransitionError);

// Test decay
const expiredOpp = await prisma.opportunity.create({
  data: {
    ...testData,
    decay_at: new Date(Date.now() - 1000), // Already expired
  },
});
const { shouldExpire } = checkDecay(expiredOpp);
expect(shouldExpire).toBe(true);
```

## Background Jobs

### Expire Stale Opportunities

**Schedule**: Hourly

**Job:**

```typescript
import { expireStaleOpportunities } from './opportunities';
import { prisma } from '../db/client';

export async function expireStaleOpportunitiesJob() {
  const { count, expired_ids } = await expireStaleOpportunities(prisma);
  console.log(`Expired ${count} opportunities:`, expired_ids);
  return { count };
}
```

Add to BullMQ queue:

```typescript
import { Queue } from 'bullmq';

const opportunityQueue = new Queue('opportunities', {
  connection: redisConnection,
});

// Schedule hourly
await opportunityQueue.add(
  'expire-stale',
  {},
  {
    repeat: { pattern: '0 * * * *' }, // Every hour at :00
  }
);
```

## API Integration Examples

### Next.js Server Action

```typescript
'use server';

import { prisma } from '@/server/db/client';
import { getActiveOpportunities } from '@/server/opportunities';

export async function fetchOpportunities(workspaceId: string) {
  const opportunities = await getActiveOpportunities(workspaceId, prisma);
  return opportunities;
}
```

### Route Handler

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { dismissOpportunity } from '@/server/opportunities';

export async function POST(req: NextRequest) {
  const { opportunityId, workspaceId } = await req.json();

  const result = await dismissOpportunity(opportunityId, workspaceId, prisma);

  return NextResponse.json(result);
}
```

## Performance Considerations

- **Indexes**: Ensure indexes exist on `workspace_id`, `state`, `priority_bucket`, `decay_at`
- **Pagination**: Always use pagination for list queries
- **Eager Loading**: Use `include` to avoid N+1 queries
- **Caching**: Cache dismissed keys and active opportunity counts
- **Batch Operations**: Use batch functions when processing multiple opportunities

## Security

- **Workspace Isolation**: All queries validate workspace ownership
- **State Validation**: State machine prevents invalid transitions
- **Input Validation**: All inputs validated before creation
- **Audit Trail**: All state changes logged via updated_at

## Observability

All operations log:
- Opportunity creation with correlation to events
- State transitions with before/after states
- Dismissals with dismiss keys
- Expiration runs with counts

Add correlation IDs for request tracing:

```typescript
import { logger } from '../observability/logger';

logger.info('opportunity_created', {
  opportunity_id: opportunity.id,
  workspace_id: workspaceId,
  type: opportunity.type,
  priority_bucket: opportunity.priority_bucket,
  correlation_id: req.headers.get('x-correlation-id'),
});
```

## Future Enhancements

- [ ] Confidence adjustment based on learning loop outcomes
- [ ] Smart re-prioritization when events update
- [ ] Opportunity merging for related events
- [ ] Custom decay windows per workspace
- [ ] ML-based priority scoring (still deterministic)
- [ ] Opportunity templates for custom types

## Troubleshooting

**Issue**: Opportunities not expiring

**Fix**: Check that background job is running hourly. Run `expireStaleOpportunities()` manually to catch up.

**Issue**: Dismissed opportunity reappears

**Fix**: Check if events have materially changed (>50% new events). If same events, check dismiss key logic.

**Issue**: Invalid state transition error

**Fix**: Review state machine rules. Ensure UI only shows valid next states.

**Issue**: Priority seems incorrect

**Fix**: Priority is deterministic. Check event payload for urgency/consequence factors. Verify confidence from learning loop.
