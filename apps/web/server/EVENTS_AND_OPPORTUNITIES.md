# Events and Opportunities System

Complete implementation of the MerchOps event ingestion and opportunity engine as specified in CLAUDE.md.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Event System](#event-system)
3. [Opportunity Engine](#opportunity-engine)
4. [API Routes](#api-routes)
5. [Usage Examples](#usage-examples)
6. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

The system follows a deterministic, immutable event-driven architecture:

```
Shopify Data → Events (Immutable) → Opportunities → Actions → Executions
                    ↓                      ↓
              Deduplication          Prioritization
                                        Decay
```

### Key Principles

- **Immutability**: Events and executions are never modified or deleted
- **Deduplication**: Events use dedupe keys to prevent duplicates
- **Determinism**: Same inputs always produce same outputs
- **Explainability**: Every opportunity has why_now, rationale, and counterfactual
- **State Machine**: Opportunities follow strict state transition rules
- **Decay**: Opportunities expire based on type-specific time windows

---

## Event System

Location: `/apps/web/server/events/`

### Event Types

Defined in `types.ts`:

1. **INVENTORY_THRESHOLD_CROSSED** - Inventory drops below threshold
2. **PRODUCT_OUT_OF_STOCK** - Product reaches zero inventory
3. **PRODUCT_BACK_IN_STOCK** - Previously OOS product restocked
4. **VELOCITY_SPIKE** - Sales velocity exceeds baseline
5. **CUSTOMER_INACTIVE** - Customer crosses inactivity threshold (30/60/90 days)

### Event Creation

**File**: `create.ts`

```typescript
import { createEvent } from '@/server/events';

// Create event with automatic deduplication
const event = await createEvent({
  workspace_id: 'workspace-123',
  type: 'inventory_threshold_crossed',
  occurred_at: new Date(),
  payload: {
    product_id: 'prod-456',
    variant_id: 'var-789',
    product_title: 'Blue T-Shirt',
    variant_title: 'Medium',
    current_inventory: 5,
    threshold: 10,
    previous_inventory: 15,
  },
  source: 'computed',
});
```

**Deduplication**: Events are deduped by `(workspace_id, dedupe_key)`. The dedupe key is auto-generated based on event type and payload to prevent duplicates.

### Event Computation

Events are computed from Shopify data on a scheduled basis:

#### Inventory Events (`compute/inventory.ts`)

```typescript
import {
  computeInventoryThresholdEvents,
  computeOutOfStockEvents,
  computeBackInStockEvents,
} from '@/server/events';

// Compute inventory threshold events
await computeInventoryThresholdEvents(workspace_id, threshold);

// Compute out of stock events
await computeOutOfStockEvents(workspace_id);

// Compute back in stock events
await computeBackInStockEvents(workspace_id);
```

#### Velocity Events (`compute/velocity.ts`)

```typescript
import { computeVelocitySpikeEvents } from '@/server/events';

// Compute velocity spike events
await computeVelocitySpikeEvents(workspace_id);
```

**Algorithm**:
- Compares current 7-day velocity to 30-day baseline
- Triggers when current velocity ≥ 2x baseline
- Estimates days to stockout based on current inventory

#### Customer Events (`compute/customer.ts`)

```typescript
import { computeCustomerInactivityEvents } from '@/server/events';

// Compute customer inactivity events
await computeCustomerInactivityEvents(workspace_id);
```

**Thresholds**: 30, 60, 90 days inactive

---

## Opportunity Engine

Location: `/apps/web/server/opportunities/`

### Opportunity Types

Defined in `types.ts`:

1. **INVENTORY_CLEARANCE** - Clear low inventory with discount
2. **STOCKOUT_PREVENTION** - Prevent stockouts via pausing or restocking
3. **RESTOCK_NOTIFICATION** - Notify about restocked items
4. **WINBACK_CAMPAIGN** - Re-engage inactive customers
5. **HIGH_VELOCITY_PROTECTION** - Protect high-performing products

### Opportunity Structure

Every opportunity includes:

- **type**: Opportunity type
- **priority_bucket**: HIGH, MEDIUM, or LOW
- **why_now**: Explicit explanation of timing (non-generic)
- **rationale**: Store-specific plain language reasoning
- **impact_range**: Estimated impact (directional, no guarantees)
- **counterfactual**: What happens if no action taken
- **decay_at**: When opportunity expires
- **confidence**: 0.0-1.0 confidence score
- **state**: Current state in lifecycle

### Opportunity Creation

**File**: `create.ts`

```typescript
import { createOpportunityFromEvents } from '@/server/opportunities';

const opportunity = await createOpportunityFromEvents({
  workspace_id: 'workspace-123',
  type: OpportunityType.INVENTORY_CLEARANCE,
  event_ids: ['event-1', 'event-2'],
  operator_intent: 'reduce_inventory_risk',
  why_now: 'Blue T-Shirt inventory dropped to 5 units, below your 10 unit threshold.',
  rationale: 'Low inventory creates holding cost risk...',
  counterfactual: 'Without action, this inventory may sit for weeks...',
  impact_range: '2-4 units potentially cleared',
  confidence: 0.75,
});
```

**AI Generation**: The system includes fallback templates for all opportunity types. AI generation can be added later while maintaining deterministic fallbacks.

### Prioritization

**File**: `prioritize.ts`

Priority is calculated deterministically based on four factors:

1. **Urgency** (35%) - Time sensitivity and decay window
2. **Consequence** (30%) - Magnitude of potential impact
3. **Confidence** (20%) - Reliability of prediction
4. **Novelty** (15%) - First-time vs repeated opportunity

**Scoring**:
- Score: 0-100
- Buckets:
  - HIGH: score ≥ 70
  - MEDIUM: 40 ≤ score < 70
  - LOW: score < 40

```typescript
import { calculatePriority } from '@/server/opportunities';

const priorityScore = await calculatePriority({
  opportunity_type: OpportunityType.HIGH_VELOCITY_PROTECTION,
  events: [velocityEvent],
  confidence: 0.8,
  previous_opportunity_count: 0,
});

// {
//   bucket: 'high',
//   score: 85.5,
//   factors: {
//     urgency: 0.95,
//     consequence: 0.90,
//     confidence: 0.80,
//     novelty: 1.0
//   }
// }
```

### Decay Management

**File**: `decay.ts`

Opportunities decay based on type-specific windows:

| Type | Decay Window | Reason |
|------|--------------|--------|
| INVENTORY_CLEARANCE | 72 hours | Inventory condition may have changed |
| STOCKOUT_PREVENTION | 48 hours | Urgent action window passed |
| RESTOCK_NOTIFICATION | 24 hours | Restock momentum window closed |
| WINBACK_CAMPAIGN | 168 hours | Customer engagement window passed |
| HIGH_VELOCITY_PROTECTION | 36 hours | Velocity spike window passed |

**Expiration Job**:

```typescript
import { expireStaleOpportunities } from '@/server/opportunities';

// Run periodically (e.g., every hour via BullMQ)
const result = await expireStaleOpportunities(prisma);
console.log(`Expired ${result.count} opportunities`);
```

### State Machine

**File**: `state-machine.ts`

**State Flow**:
```
new → viewed → approved → executed → resolved
  ↓      ↓
dismissed  expired
```

**Valid Transitions**:
- `new` → `viewed`, `dismissed`, `expired`
- `viewed` → `approved`, `dismissed`, `expired`
- `approved` → `executed`, `dismissed`
- `executed` → `resolved`
- `resolved`, `dismissed`, `expired` → (terminal states)

```typescript
import { transitionState, markAsViewed } from '@/server/opportunities';

// Transition with validation
await transitionState(opportunity_id, OpportunityState.viewed, prisma);

// Helper functions
await markAsViewed(opportunity_id, prisma);
await markAsDismissed(opportunity_id, prisma);
```

**Error Handling**:
- `InvalidStateTransitionError` - Thrown for invalid transitions
- `OpportunityNotFoundError` - Thrown when opportunity doesn't exist

### Queries

**File**: `queries.ts`

```typescript
import {
  getOpportunityById,
  getOpportunityWithEvents,
  getOpportunitiesForWorkspace,
  getOpportunityQueue,
} from '@/server/opportunities';

// Get single opportunity
const opportunity = await getOpportunityById(id, workspace_id);

// Get with events
const opportunityWithEvents = await getOpportunityWithEvents(id, workspace_id);

// List with filters
const result = await getOpportunitiesForWorkspace(workspace_id, {
  state: ['new', 'viewed'],
  priority_bucket: 'high',
  limit: 20,
  offset: 0,
});

// Get priority queue (for UI)
const queue = await getOpportunityQueue(workspace_id, 20);
```

---

## API Routes

### GET /api/opportunities

List opportunities for workspace with filtering and pagination.

**Query Parameters**:
- `state` - Filter by state (new, viewed, etc.)
- `priority` - Filter by priority bucket (high, medium, low)
- `type` - Filter by opportunity type
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Response**:
```json
{
  "opportunities": [
    {
      "id": "opp-123",
      "type": "inventory_clearance",
      "priority_bucket": "high",
      "why_now": "...",
      "rationale": "...",
      "counterfactual": "...",
      "impact_range": "5-15 units",
      "decay_at": "2026-01-25T12:00:00Z",
      "confidence": 0.75,
      "state": "new",
      "events": [...],
      "action_drafts": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### GET /api/opportunities/[id]

Get single opportunity detail with events and action drafts.

**Response**:
```json
{
  "id": "opp-123",
  "type": "inventory_clearance",
  "priority_bucket": "high",
  "why_now": "...",
  "rationale": "...",
  "counterfactual": "...",
  "impact_range": "5-15 units",
  "decay_at": "2026-01-25T12:00:00Z",
  "confidence": 0.75,
  "state": "new",
  "events": [
    {
      "id": "evt-456",
      "type": "inventory_threshold_crossed",
      "occurred_at": "2026-01-23T10:00:00Z",
      "payload_json": {...}
    }
  ],
  "action_drafts": [...]
}
```

### PATCH /api/opportunities/[id]

Update opportunity state (view, dismiss).

**Request Body**:
```json
{
  "state": "viewed"
}
```

**Allowed States**: `viewed`, `dismissed`, `expired`

**Response**: Updated opportunity object

---

## Usage Examples

### Complete Flow

```typescript
import { prisma } from '@/server/db/client';
import {
  computeInventoryThresholdEvents,
  createOpportunityFromEvents,
  calculatePriority,
  getOpportunityQueue,
  markAsViewed,
} from '@/server/opportunities';

// 1. Compute events from Shopify data
await computeInventoryThresholdEvents(workspace_id, 10);

// 2. Fetch recent events
const events = await prisma.event.findMany({
  where: {
    workspace_id,
    type: 'inventory_threshold_crossed',
  },
  orderBy: { created_at: 'desc' },
  take: 1,
});

// 3. Create opportunity from event
if (events.length > 0) {
  const opportunity = await createOpportunityFromEvents({
    workspace_id,
    type: OpportunityType.INVENTORY_CLEARANCE,
    event_ids: [events[0].id],
    operator_intent: 'reduce_inventory_risk',
    why_now: 'Product inventory dropped below threshold',
    rationale: 'Low inventory creates holding cost risk',
    counterfactual: 'Inventory may sit for weeks',
    impact_range: '5-10 units',
  });
}

// 4. Get priority queue for UI
const queue = await getOpportunityQueue(workspace_id, 20);

// 5. User views opportunity
await markAsViewed(queue[0].id, prisma);
```

### Scheduled Jobs

```typescript
// Job: Compute events (run every hour)
async function computeEventsJob(workspace_id: string) {
  await Promise.all([
    computeInventoryThresholdEvents(workspace_id),
    computeVelocitySpikeEvents(workspace_id),
    computeCustomerInactivityEvents(workspace_id),
  ]);
}

// Job: Expire stale opportunities (run every hour)
async function expireOpportunitiesJob() {
  const result = await expireStaleOpportunities(prisma);
  console.log(`Expired ${result.count} opportunities`);
}
```

---

## Testing Strategy

### Unit Tests

**Events**:
- Dedupe key generation is deterministic
- Same event not created twice
- Event payload validation

**Opportunities**:
- Priority calculation is deterministic
- Decay time calculation
- State machine transitions
- Invalid transitions throw errors

### Integration Tests

**Event Computation**:
- Inventory threshold detection
- Velocity spike detection with realistic data
- Customer inactivity calculation

**Opportunity Creation**:
- Event → Opportunity flow
- Priority assignment
- Decay expiration

### E2E Tests (Playwright)

1. Event computation creates opportunities
2. Opportunity queue shows prioritized items
3. View opportunity transitions state
4. Dismiss opportunity removes from queue
5. Expired opportunities don't appear in queue

---

## File Structure

```
/apps/web/server/
├── events/
│   ├── types.ts              # Event types and payloads
│   ├── create.ts             # Event creation and deduplication
│   ├── index.ts              # Public API exports
│   └── compute/
│       ├── inventory.ts      # Inventory event computation
│       ├── velocity.ts       # Velocity spike computation
│       └── customer.ts       # Customer inactivity computation
│
├── opportunities/
│   ├── types.ts              # Opportunity types and structures
│   ├── create.ts             # Opportunity creation
│   ├── prioritize.ts         # Priority calculation
│   ├── decay.ts              # Decay and expiration
│   ├── state-machine.ts      # State transitions
│   ├── queries.ts            # Retrieval and filtering
│   └── index.ts              # Public API exports
│
└── EVENTS_AND_OPPORTUNITIES.md  # This file

/apps/web/app/api/
└── opportunities/
    ├── route.ts              # GET /api/opportunities
    └── [id]/
        └── route.ts          # GET, PATCH /api/opportunities/:id
```

---

## Next Steps

1. **Add BullMQ Jobs**:
   - Event computation job (hourly)
   - Opportunity expiration job (hourly)

2. **Add AI Generation**:
   - Implement `generateOpportunityExplanations` with AI
   - Version prompts and log to `ai_generations` table
   - Keep deterministic fallbacks

3. **Add Monitoring**:
   - Track event computation latency
   - Monitor opportunity creation rate
   - Alert on expiration rate anomalies

4. **Add Tests**:
   - Unit tests for all modules
   - Integration tests for computation flows
   - E2E tests for critical user journeys

---

## Acceptance Criteria Met

- ✅ Events are immutable and deduped
- ✅ Event computation is deterministic and replayable
- ✅ Opportunities have why_now, rationale, counterfactual
- ✅ Priority calculation is deterministic
- ✅ Opportunities decay based on type-specific windows
- ✅ State machine enforces valid transitions
- ✅ API routes support filtering and pagination
- ✅ Full workspace isolation (multi-tenant safe)
- ✅ Complete audit trail (events → opportunities → actions)

---

**Status**: Complete and ready for integration with action drafts and execution engine.
