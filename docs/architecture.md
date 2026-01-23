# MerchOps Architecture

**Version:** 1.0.0
**Last Updated:** January 2026
**Status:** Beta MVP

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Design Principles](#design-principles)
3. [Event Flow Diagram](#event-flow-diagram)
4. [Core Architecture Layers](#core-architecture-layers)
5. [Data Model](#data-model)
6. [Data Ownership Boundaries](#data-ownership-boundaries)
7. [Background Job Topology](#background-job-topology)
8. [Security Boundaries](#security-boundaries)
9. [API Design Principles](#api-design-principles)
10. [Observability Architecture](#observability-architecture)
11. [Technology Stack](#technology-stack)
12. [Appendix: State Machines](#appendix-state-machines)

---

## System Overview

### What is MerchOps?

MerchOps is a **calm operator console** for Shopify merchants that:

1. **Detects** store signals (inventory changes, customer inactivity, velocity spikes)
2. **Transforms** signals into prioritized opportunities with clear explanations
3. **Drafts** safe, reviewable actions (discounts, win-back emails, product pauses)
4. **Executes** only with explicit merchant approval
5. **Learns** from outcomes to build confidence over time

### Core Value Proposition

MerchOps provides **leverage without loss of control**. Unlike fully autonomous systems that make decisions behind the scenes, MerchOps:

- Surfaces opportunities the merchant might miss
- Explains **why now** and **what happens if nothing is done**
- Prepares action drafts that are fully reviewable and editable
- Requires explicit approval before any execution
- Tracks outcomes to prove value transparently

### Target Merchant Profile

| Attribute | Description |
|-----------|-------------|
| Platform | Shopify DTC (Direct-to-Consumer) |
| Store Count | Single store (MVP) |
| GMV Range | $1M - $50M annually |
| Team Size | Small, often 1-3 people managing operations |
| Pain Point | Wants operational leverage without ceding control |

---

## Design Principles

MerchOps adheres to four non-negotiable product guardrails. **Violating these is considered a bug.**

### 1. Calm Over Clever

The system should reduce cognitive load, not add to it.

- No notification spam or artificial urgency
- Opportunities naturally decay and expire
- UI is minimal, focused, and uncluttered
- Information density is appropriate for the decision at hand

### 2. Control Over Automation

The merchant is always in control.

- **Nothing executes without explicit approval**
- Actions can be edited before approval
- Dismissed opportunities stay dismissed (unless material change)
- Full visibility into what will happen before it happens

### 3. Explainability Over Opacity

Every suggestion must be justified.

- **Why Now:** Explicit, non-generic explanation of timing
- **Rationale:** Plain language, store-specific reasoning
- **Counterfactual:** What happens if no action is taken
- **Impact Range:** Honest ranges, never false precision

### 4. Trust Compounds Faster Than Features

Reliability and predictability build long-term value.

- Deterministic behavior given the same inputs
- No silent side effects
- Full audit trail for every action
- Outcomes tracked and confidence earned transparently

---

## Event Flow Diagram

The complete data flow from Shopify store to learning loop:

```
+------------------+
|  Shopify Store   |
+--------+---------+
         |
         | Webhooks (orders/create, products/update, inventory_levels/update)
         v
+--------+---------+
|    Webhooks      |-----> [HMAC Signature Verification]
| (API Endpoint)   |       - Timing-safe comparison
+--------+---------+       - Reject invalid signatures
         |
         | Validated payload
         v
+--------+---------+
| Event Computation|-----> [Immutable Event Store]
|   (Background    |       - events table
|     Jobs)        |       - Dedupe by dedupe_key
+--------+---------+       - Source tracking (webhook/sync/computed)
         |
         | Computed events
         v
+--------+---------+
| Opportunity      |
|   Engine         |
+------------------+
   |  |  |  |
   |  |  |  +----> [Decay Scheduling]
   |  |  |         - Type-specific decay windows
   |  |  |         - Hourly decay check job
   |  |  |
   |  |  +-------> [Counterfactual Generation]
   |  |            - What happens if no action
   |  |            - AI-assisted or template fallback
   |  |
   |  +----------> [Why-Now Generation]
   |               - Timing explanation
   |               - Store-specific context
   |
   +-------------> [Priority Calculation]
                   - Urgency score
                   - Consequence magnitude
                   - Confidence factor
                   - Novelty factor
         |
         | Prioritized opportunities
         v
+--------+---------+
| Opportunity      |-----> [User Dashboard]
|   Queue          |       - Grouped by priority bucket
+--------+---------+       - State: new/viewed/approved/dismissed/expired
         |
         | User selects opportunity
         v
+--------+---------+
| Draft Creation   |-----> [AI Copy Generation]
|                  |       - Versioned prompts
|                  |       - Fallback templates
+--------+---------+       - Audit logged to ai_generations
         |
         | Draft ready for review
         v
+--------+---------+
| Approval Queue   |-----> [User Review/Edit]
|                  |       - Full payload preview
|                  |       - Editable fields
+--------+---------+       - Validation (Zod schemas)
         |
         | EXPLICIT APPROVAL REQUIRED
         v
+--------+---------+
| Execution Engine |
+------------------+
   |  |  |
   |  |  +-------> [Response Storage]
   |  |            - Provider response JSON
   |  |            - Error classification
   |  |
   |  +----------> [Provider Call]
   |               - Shopify API
   |               - Email provider (Postmark/SendGrid)
   |
   +-------------> [Idempotency Check]
                   - Unique idempotency_key per execution
                   - Prevents double execution
         |
         | Execution complete
         v
+--------+---------+
| Outcome          |
| Computation      |
+------------------+
   |  |
   |  +----------> [Helped/Neutral/Hurt Resolution]
   |               - Type-specific resolvers
   |               - Observation window (7-14 days)
   |
   +-------------> [Evidence Collection]
                   - Metrics comparison
                   - Baseline vs actual
         |
         | Outcome recorded
         v
+--------+---------+
| Learning Loop    |
+------------------+
   |  |
   |  +----------> [Track Record]
   |               - Per-intent statistics
   |               - Trend calculation
   |
   +-------------> [Confidence Updates]
                   - Score: 0-100
                   - Based on recent 20 executions
```

---

## Core Architecture Layers

### Layer 1: Ingestion Layer

**Purpose:** Receive and validate data from Shopify.

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Webhook Handler | `/apps/web/app/api/webhooks/shopify/route.ts` | Receive Shopify webhooks |
| HMAC Verifier | `/apps/web/server/shopify/webhooks.ts` | Verify webhook authenticity |
| Sync Jobs | `/apps/web/server/jobs/` | Periodic data refresh |
| Object Cache | `shopify_objects_cache` table | Denormalized Shopify data |

**Key Behaviors:**
- Webhooks verified via HMAC-SHA256 (timing-safe comparison)
- Idempotent processing (Shopify retries handled safely)
- Rate limiting respected with graceful degradation

### Layer 2: Event Computation Layer

**Purpose:** Transform raw Shopify data into meaningful business events.

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Inventory Computer | `/apps/web/server/events/compute/inventory.ts` | Inventory threshold events |
| Velocity Computer | `/apps/web/server/events/compute/velocity.ts` | Sales velocity spike events |
| Customer Computer | `/apps/web/server/events/compute/customer.ts` | Customer inactivity events |
| Event Creator | `/apps/web/server/events/create.ts` | Persist events immutably |

**Supported Event Types:**

| Event Type | Trigger Condition |
|------------|-------------------|
| `inventory_threshold_crossed` | Inventory drops below configured threshold |
| `product_out_of_stock` | Variant reaches zero inventory |
| `product_back_in_stock` | Previously OOS product restocked |
| `velocity_spike` | Sales velocity exceeds 2x+ baseline |
| `customer_inactivity_threshold` | Customer inactive for 30/60/90 days |

**Event Guarantees:**
- Events are immutable once created
- Deduplication via `dedupe_key` (unique per workspace)
- Deterministic: same inputs + same version = same events
- Replayable in test harness

### Layer 3: Opportunity Engine

**Purpose:** Generate prioritized, explainable opportunities from events.

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Opportunity Types | `/apps/web/server/opportunities/types.ts` | Type definitions |
| Priority Scoring | Computed per opportunity | Urgency, consequence, confidence, novelty |
| AI Generation | `/apps/web/server/ai/generate.ts` | Why-now, rationale, counterfactual |
| Decay Management | Background job | Expire stale opportunities |

**Opportunity Structure:**

Every opportunity MUST include:

```typescript
interface Opportunity {
  id: string;
  workspace_id: string;
  type: OpportunityType;
  priority_bucket: 'high' | 'medium' | 'low';
  why_now: string;           // Explicit timing explanation
  rationale: string;         // Store-specific reasoning
  counterfactual: string;    // What happens if no action
  impact_range: string;      // e.g., "5-15 units", "$200-$500"
  decay_at: Date | null;     // When opportunity expires
  confidence: number;        // 0.0 - 1.0
  state: OpportunityState;
  event_ids: string[];       // Triggering events
}
```

**Priority Calculation:**

```
priority_score =
  (urgency * 0.35) +
  (consequence * 0.30) +
  (confidence * 0.20) +
  (novelty * 0.15)

priority_bucket =
  score >= 70 ? 'high' :
  score >= 40 ? 'medium' :
  'low'
```

### Layer 4: Action System

**Purpose:** Create, edit, and validate action drafts.

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Draft Creator | `/apps/web/server/actions/drafts/create.ts` | Generate initial drafts |
| Draft Editor | `/apps/web/server/actions/drafts/edit.ts` | Apply user edits |
| Draft Approver | `/apps/web/server/actions/drafts/approve.ts` | Transition to execution |
| Payload Schemas | `/apps/web/server/actions/types.ts` | Zod validation |

**Supported Execution Types:**

| Type | Intent | Shopify Integration |
|------|--------|---------------------|
| `discount_draft` | Reduce inventory risk | Price Rules + Discount Codes |
| `winback_email_draft` | Re-engage dormant customers | Email provider (Postmark/SendGrid) |
| `pause_product` | Protect margin on low inventory | Product status update |

**Editable Fields:**

Each execution type defines which fields users can safely edit:

```typescript
// Discount drafts allow editing:
- title, value, starts_at, ends_at, usage_limit

// Win-back emails allow editing:
- subject, preview_text, body_html, body_text, send_at

// Pause product allows editing:
- reason, restore_at, notify_customers, redirect_to_similar
```

### Layer 5: Execution Engine

**Purpose:** Execute approved actions with safety guarantees.

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Discount Executor | `/apps/web/server/actions/execute/discount.ts` | Create Shopify discounts |
| Email Executor | `/apps/web/server/actions/execute/email.ts` | Send via email provider |
| Pause Executor | `/apps/web/server/actions/execute/pause-product.ts` | Update product status |

**Execution Guarantees:**

1. **Idempotency:** Each execution has a unique `idempotency_key`
2. **No Partial Execution:** Atomic operations or full rollback
3. **Retry Safety:** Exponential backoff (3s, 6s, 12s...) for transient errors
4. **Error Classification:** Clear taxonomy for actionable error messages

**Error Taxonomy:**

| Category | Retryable | Example Codes |
|----------|-----------|---------------|
| Network | Yes | `NETWORK_ERROR`, `TIMEOUT` |
| Rate Limit | Yes | `RATE_LIMIT_EXCEEDED` |
| Auth | No | `INVALID_TOKEN`, `TOKEN_EXPIRED` |
| Validation | No | `INVALID_PAYLOAD`, `PRODUCT_NOT_FOUND` |
| Business | No | `DISCOUNT_ALREADY_EXISTS` |

### Layer 6: Learning Loop

**Purpose:** Measure outcomes and build confidence.

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Outcome Computer | `/apps/web/server/learning/outcomes/compute.ts` | Route to resolvers |
| Discount Resolver | `/apps/web/server/learning/outcomes/resolvers/discount.ts` | Discount outcome logic |
| Winback Resolver | `/apps/web/server/learning/outcomes/resolvers/winback.ts` | Email outcome logic |
| Pause Resolver | `/apps/web/server/learning/outcomes/resolvers/pause.ts` | Pause outcome logic |
| Confidence Scorer | `/apps/web/server/learning/confidence.ts` | Calculate confidence scores |

**Outcome Resolution:**

| Execution Type | Observation Window | Resolution Logic |
|----------------|-------------------|------------------|
| Discount | 7 days | Conversion/revenue uplift vs baseline |
| Win-back Email | 14 days | Open/click/convert rates vs baseline |
| Pause Product | 14 days | Stockout/backorder reduction |

**Outcome Types:**

| Type | Meaning |
|------|---------|
| `helped` | Measurable positive impact |
| `neutral` | No significant change |
| `hurt` | Measurable negative impact |

**Confidence Calculation:**

```typescript
// Based on last 20 executions for the operator intent
confidence_score =
  (success_rate * 70) -    // 0-70 points for helped rate
  (harm_rate * 30) +       // -30 penalty for hurt rate
  (volume_bonus)           // 0-10 points for data sufficiency

// Result clamped to 0-100
```

---

## Data Model

### Entity Relationship Overview

```
Workspace (1)
    |
    +---> User (many)
    |
    +---> ShopifyConnection (1, MVP)
    |
    +---> ShopifyObjectCache (many)
    |
    +---> Event (many, immutable)
    |       |
    |       +---> OpportunityEventLink (many)
    |
    +---> Opportunity (many)
    |       |
    |       +---> ActionDraft (many)
    |               |
    |               +---> Execution (many, immutable)
    |                       |
    |                       +---> Outcome (1)
    |
    +---> AiGeneration (many, audit log)
```

### Core Tables

#### Tenancy

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `workspaces` | Tenant container | `id`, `name`, `created_at` |
| `users` | User accounts | `id`, `email`, `password_hash`, `workspace_id` |

#### Shopify Integration

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `shopify_connections` | OAuth credentials | `workspace_id` (unique), `store_domain`, `access_token_encrypted`, `status` |
| `shopify_objects_cache` | Denormalized data | `workspace_id`, `object_type`, `shopify_id`, `data_json`, `version` |

#### Event Store (Immutable)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `events` | Business events | `workspace_id`, `type`, `occurred_at`, `payload_json`, `dedupe_key`, `source` |

#### Opportunities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `opportunities` | Suggested actions | `workspace_id`, `type`, `priority_bucket`, `why_now`, `counterfactual`, `state` |
| `opportunity_event_links` | Event-opportunity M:N | `opportunity_id`, `event_id` |

#### Actions

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `action_drafts` | Editable drafts | `workspace_id`, `opportunity_id`, `operator_intent`, `execution_type`, `payload_json`, `state` |
| `executions` | Immutable execution log | `workspace_id`, `action_draft_id`, `request_payload_json`, `provider_response_json`, `status`, `idempotency_key` |

#### Learning

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `outcomes` | Execution results | `execution_id`, `outcome` (helped/neutral/hurt), `evidence_json` |

#### AI Audit

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `ai_generations` | Prompt audit trail | `workspace_id`, `prompt_version`, `inputs_json`, `outputs_json`, `model`, `tokens` |

---

## Data Ownership Boundaries

### Workspace Boundary

**Rule:** All data is scoped to a workspace. No cross-workspace data access is permitted.

```typescript
// Every query must include workspace_id
const opportunities = await prisma.opportunity.findMany({
  where: {
    workspace_id: session.user.workspaceId, // REQUIRED
    state: 'new',
  },
});
```

**Enforcement:**
- Session always includes `workspaceId`
- All Prisma queries filtered by workspace
- Integration tests verify isolation

### Immutable vs Mutable Data

| Category | Tables | Write Policy |
|----------|--------|--------------|
| Immutable | `events`, `executions`, `outcomes`, `ai_generations` | Insert only, no updates/deletes |
| Mutable State | `opportunities`, `action_drafts` | State transitions only |
| Mutable Data | `users`, `workspaces`, `shopify_connections`, `shopify_objects_cache` | Full CRUD |

**Rationale:**
- Immutable data provides audit trail
- State machine transitions are validated
- Replay and debugging require historical accuracy

### PII Handling

| Data Type | Storage | Retention |
|-----------|---------|-----------|
| Customer Email | `events.payload_json` | Per retention policy |
| Customer Name | `events.payload_json` | Per retention policy |
| Access Tokens | `shopify_connections.access_token_encrypted` | Encrypted at rest |
| Passwords | `users.password_hash` | Bcrypt hashed |

**PII Minimization:**
- Only store PII necessary for functionality
- No payment data ever stored
- Customer data in events is operational, not for marketing
- Retention policies configurable per workspace (future)

---

## Background Job Topology

### Queue Architecture

MerchOps uses **BullMQ** with **Redis** for reliable background job processing.

```
                    +-------------------+
                    |       Redis       |
                    | (Upstash/Managed) |
                    +--------+----------+
                             |
         +-------------------+-------------------+
         |                   |                   |
+--------v--------+ +--------v--------+ +--------v--------+
| shopify-sync    | | event-compute   | | opportunity-    |
|     Queue       | |     Queue       | | generate Queue  |
+-----------------+ +-----------------+ +-----------------+
         |                   |                   |
+--------v--------+ +--------v--------+ +--------v--------+
|    Worker       | |    Worker       | |    Worker       |
| (5 concurrency) | | (5 concurrency) | | (5 concurrency) |
+-----------------+ +-----------------+ +-----------------+

                    +-------------------+
                    |       Redis       |
                    +--------+----------+
                             |
         +-------------------+-------------------+
         |                   |
+--------v--------+ +--------v--------+
| execution       | | outcome-compute |
|     Queue       | |     Queue       |
+-----------------+ +-----------------+
         |                   |
+--------v--------+ +--------v--------+
|    Worker       | |    Worker       |
| (5 concurrency) | | (5 concurrency) |
+-----------------+ +-----------------+
```

### Queue Definitions

| Queue Name | Purpose | Priority |
|------------|---------|----------|
| `shopify-sync` | Initial sync and periodic refresh | High |
| `event-compute` | Compute events from raw data | Normal |
| `opportunity-generate` | Generate opportunities from events | Normal |
| `execution` | Execute approved actions | Critical |
| `outcome-compute` | Compute helped/neutral/hurt | Normal |

### Worker Configuration

```typescript
// Default worker settings
{
  concurrency: 5,
  maxStalledCount: 3,
  stalledInterval: 30000, // 30 seconds
}
```

### Job Dependencies

```
[Webhook Received]
        |
        v
[shopify-sync] ---> [event-compute] ---> [opportunity-generate]
        |
        | (async, after approval)
        v
[execution] ---> [outcome-compute] (scheduled after observation window)
```

### Retry Behavior

| Queue | Max Attempts | Backoff Strategy | Initial Delay |
|-------|-------------|------------------|---------------|
| `shopify-sync` | 5 | Exponential | 2000ms |
| `event-compute` | 3 | Exponential | 1000ms |
| `opportunity-generate` | 3 | Exponential | 1000ms |
| `execution` | 5 | Exponential | 3000ms |
| `outcome-compute` | 5 | Exponential | 1000ms |

### Scheduled Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `decay-check` | Every hour (`0 * * * *`) | Expire stale opportunities |
| `daily-outcome-compute` | Daily at 2 AM (`0 2 * * *`) | Batch compute outcomes |
| `data-sync-refresh` | Every 6 hours (`0 */6 * * *`) | Refresh Shopify data |

### Job Data Cleanup

```typescript
// Completed jobs: keep for 1 hour, max 100
removeOnComplete: { age: 3600, count: 100 }

// Failed jobs: keep for 7 days (debugging)
removeOnFail: { age: 604800 }

// Execution jobs: keep longer for audit
removeOnComplete: { age: 86400, count: 1000 }
```

---

## Security Boundaries

### Authentication Flow

```
User Login Request
        |
        v
+-------+-------+
| NextAuth.js   |
| (JWT Strategy)|
+-------+-------+
        |
        | Verify credentials
        v
+-------+-------+
| Prisma Query  |
| (users table) |
+-------+-------+
        |
        | Hash comparison (bcrypt)
        v
+-------+-------+
| JWT Token     |
| Generation    |
+-------+-------+
        |
        | Token contains: id, email, workspaceId
        v
+-------+-------+
| Set Cookie    |
| (httpOnly)    |
+---------------+
```

**JWT Contents:**

```typescript
interface JWT {
  id: string;           // User ID
  email: string;        // User email
  workspaceId: string;  // Tenant boundary
}
```

**Session Configuration:**

```typescript
{
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
}
```

### Authorization Rules

| Resource | Rule | Enforcement |
|----------|------|-------------|
| Workspace data | User must belong to workspace | `workspace_id = session.user.workspaceId` |
| Shopify connection | One per workspace (MVP) | Unique constraint on `workspace_id` |
| Action execution | Explicit approval required | State machine transition validation |
| Admin endpoints | Future: role-based | Not in MVP scope |

### Webhook Security

```typescript
// HMAC verification for Shopify webhooks
export function verifyWebhookHmac(
  body: string | Buffer,
  hmacHeader: string
): boolean {
  const hash = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  // Timing-safe comparison prevents timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(hmacHeader)
  );
}
```

### Tenant Isolation

**Database Level:**
- Every table has `workspace_id` column
- All queries filter by `workspace_id`
- No stored procedures that bypass filtering

**Application Level:**
- Session always includes `workspaceId`
- Middleware validates session before data access
- Integration tests verify no cross-tenant leakage

**Testing:**
- Multi-tenant isolation test suite
- Fuzz testing for boundary violations

### Secrets Management

| Secret | Storage | Access |
|--------|---------|--------|
| Database URL | Environment variable | Server runtime only |
| Shopify API Secret | Environment variable | Server runtime only |
| Access Tokens | Encrypted in DB | Decrypt at runtime |
| NextAuth Secret | Environment variable | Server runtime only |

**Never in Client:**
- API keys
- Access tokens
- Database credentials
- Shopify secrets

---

## API Design Principles

### Internal-First

MerchOps APIs are designed for internal consumption first.

**Characteristics:**
- Server Actions and Route Handlers
- Type-safe with TypeScript end-to-end
- Zod validation on all inputs
- No public API in MVP

**Example Server Action:**

```typescript
// /apps/web/app/actions/opportunities.ts
export async function getOpportunities(
  filters: OpportunityFilters
): Promise<OpportunityWithEvents[]> {
  const session = await getServerSession();
  if (!session) throw new Error('Unauthorized');

  return prisma.opportunity.findMany({
    where: {
      workspace_id: session.user.workspaceId,
      ...buildFilters(filters),
    },
    include: { events: true },
  });
}
```

### Deterministic

Same inputs produce same outputs.

**Guarantees:**
- Event computation is deterministic given inputs + version
- Opportunity generation is deterministic given events + version
- Priority calculation uses explicit formula
- AI has fallback templates for consistency

**Versioning:**
- Prompt versions tracked in `prompt_version` field
- Logic versions can be tracked via git
- Breaking changes require migration

### Auditable

Every state change is traceable.

**Audit Trail:**
- `events` table: immutable record of signals
- `executions` table: immutable record of actions taken
- `outcomes` table: immutable record of results
- `ai_generations` table: immutable record of AI usage

**Correlation:**
- Correlation IDs propagate through entire flow
- Request -> Job -> Execution linked
- Logs include correlation ID for tracing

```typescript
// Correlation context
interface CorrelationContext {
  correlationId: string;
  workspaceId?: string;
  userId?: string;
  jobId?: string;
  jobName?: string;
}
```

---

## Observability Architecture

### Structured Logging

**Tool:** Pino (JSON logging with pretty print in development)

**Log Levels:**
- `production`: info
- `development`: debug
- `test`: silent

**Standard Fields:**

```json
{
  "level": "INFO",
  "time": "2026-01-23T12:00:00.000Z",
  "correlationId": "abc-123",
  "workspaceId": "ws-456",
  "jobId": "job-789",
  "message": "Job completed: opportunity-generate"
}
```

### Error Tracking

**Tool:** Sentry

**Captured:**
- Unhandled exceptions
- Rejected promises
- Failed job attempts
- API errors

**Context Enrichment:**
- Correlation ID
- Workspace ID (anonymized if needed)
- Job metadata
- Request path

### Metrics (Beta)

**Basic Counters:**
- Webhooks received
- Events computed
- Opportunities generated
- Executions completed/failed
- Outcomes by type

**Timings:**
- Webhook processing latency
- Job duration
- API response time
- Shopify API latency

### Correlation ID Flow

```
[HTTP Request]
     |
     | X-Correlation-ID header (or generate new)
     v
[Server Action] -----> correlationId injected into context
     |
     | Job data includes _correlationId
     v
[Background Job] ----> correlationId restored from job data
     |
     | Logger mixin adds correlationId to all logs
     v
[Execution] ---------> correlationId in execution logs
     |
     v
[All logs searchable by single correlationId]
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Key Features |
|------------|---------|--------------|
| Next.js 14+ | Framework | App Router, Server Actions, RSC |
| TypeScript | Type Safety | Strict mode enabled |
| Tailwind CSS | Styling | Calm, minimal design system |
| TanStack Query | Data Fetching | Client cache, optimistic updates |
| Zod | Validation | Runtime schema validation |

### Backend

| Technology | Purpose | Key Features |
|------------|---------|--------------|
| Next.js API | HTTP Layer | Route handlers, Server Actions |
| Prisma | ORM | Type-safe queries, migrations |
| PostgreSQL | Database | Managed (Neon, Supabase, etc.) |
| BullMQ | Job Queue | Redis-backed, retries, scheduling |
| Redis | Queue Backend | Upstash or managed Redis |

### Authentication

| Technology | Purpose | Key Features |
|------------|---------|--------------|
| NextAuth.js | Auth Framework | JWT strategy, credentials provider |
| bcrypt | Password Hashing | Secure password storage |

### Integrations

| Service | Purpose | Key Features |
|---------|---------|--------------|
| Shopify Admin API | Store Data | OAuth, REST API |
| Postmark/SendGrid | Email (MVP) | Draft or send emails |

### Observability

| Technology | Purpose | Key Features |
|------------|---------|--------------|
| Pino | Logging | Structured JSON logs |
| Sentry | Error Tracking | Exception monitoring |
| (Future) | Metrics | Prometheus-compatible |

---

## Appendix: State Machines

### Opportunity State Machine

```
           +-------+
           |  new  |
           +---+---+
               |
    +----------+----------+
    |          |          |
    v          v          v
+-------+  +-------+  +-------+
|viewed |  |expired|  |dismiss|
+---+---+  +-------+  +-------+
    |
    +----------+----------+
    |          |          |
    v          v          v
+--------+ +-------+  +-------+
|approved| |expired|  |dismiss|
+---+----+ +-------+  +-------+
    |
    v
+--------+
|executed|
+---+----+
    |
    v
+--------+
|resolved|
+--------+
```

**Valid Transitions:**

| From | To |
|------|-----|
| `new` | `viewed`, `dismissed`, `expired` |
| `viewed` | `approved`, `dismissed`, `expired` |
| `approved` | `executed`, `dismissed` |
| `executed` | `resolved` |
| `resolved` | (terminal) |
| `dismissed` | (terminal) |
| `expired` | (terminal) |

### Action Draft State Machine

```
       +-------+
       | draft |
       +---+---+
           |
    +------+------+
    |             |
    v             v
+-------+    +--------+
|edited |    |rejected|
+---+---+    +--------+
    |
    v
+--------+
|approved|
+---+----+
    |
    v
+--------+
|executed|
+--------+
```

### Execution Status

```
+--------+
| pending|
+---+----+
    |
    v
+--------+     +--------+
| running| --> |retrying| (on transient failure)
+---+----+     +---+----+
    |              |
    +------+-------+
           |
    +------+------+
    |             |
    v             v
+---------+   +------+
|succeeded|   |failed|
+---------+   +------+
```

---

## Related Documentation

- [CLAUDE.md](/CLAUDE.md) - Product specification and requirements
- [Security Documentation](/docs/security.md) - Detailed security practices
- [API Documentation](/docs/api/) - Internal API reference
- [Deployment Runbook](/docs/deploy-runbook.md) - Production deployment guide
- [Local Development](/docs/local-development.md) - Development setup
- [CI/CD Setup](/docs/ci-cd-setup.md) - Continuous integration configuration

---

*This document is the authoritative technical reference for the MerchOps architecture. For product requirements and acceptance criteria, refer to CLAUDE.md.*
