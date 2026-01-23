# CLAUDE.md — MerchOps Beta MVP (Next.js Full‑Stack)

## Mission

Build MerchOps into a **beta‑ready** product for Shopify merchants: a calm operator console that detects store signals, turns them into prioritized opportunities, drafts safe actions, and executes **only with explicit approval**.

This file is the single operating system for planning, implementation, validation, and release.

Hard rule: **A feature is not done until** lint, typecheck, unit tests, integration tests, and E2E tests pass, and all JTBD + acceptance criteria are met.

---

## Product Guardrails

1. Calm over clever
2. Control over automation
3. Explainability over opacity
4. Trust compounds faster than features

Violating guardrails is a bug.

---

## Beta Readiness Standard

Target score: **> 9.5 / 10**.

Beta readiness means:
• Real merchants can connect Shopify, see real opportunities, approve actions, and see outcomes
• No silent side effects and no unreviewed sends
• Observability is good enough to debug any incident within minutes
• All data is auditable, replayable, and safe to evolve

---

## ICP

Primary:
• Shopify DTC operator for a single store
• $1M–$50M GMV
• Small team, wants leverage without losing control

Secondary (not in MVP): agencies managing multiple stores.

---

## Core JTBD

JTBD‑1: Detect opportunities from store signals without constant dashboard babysitting.
JTBD‑2: Understand why an opportunity surfaced now and what happens if nothing is done.
JTBD‑3: Review and edit drafts safely, approve intentionally, and execute deterministically.
JTBD‑4: Track outcomes and build confidence that MerchOps is learning for this store.

---

## Scope

### In scope (Beta MVP)

• Auth + single workspace
• Shopify OAuth + data sync + webhook ingestion
• Event computation + immutable event store
• Opportunity engine with prioritization, why‑now, counterfactual, decay
• Draft actions: discount draft, win‑back email draft, pause product
• Approval queue + payload preview
• Execution engine with idempotency + retries
• Learning loop (helped/neutral/hurt) + confidence signals
• Observability + admin diagnostics

### Explicit non‑goals

• Autonomous sending or auto‑execution by default
• Multi‑store workspaces
• Agency permissions / roles beyond simple single‑user
• SMS/push/paid ads
• Attribution modeling and revenue guarantees
• Theme/checkout modification

---

## Technical Stack (Opinionated, Production‑Grade)

### Frontend

• Next.js (App Router) + TypeScript
• Tailwind + component library as needed (keep surfaces calm, minimal chrome)
• TanStack Query for client cache, optimistic UI where safe
• Zod for runtime input validation across client and server

### Backend

• Next.js server actions or route handlers for internal API
• Background jobs: BullMQ + Redis (Upstash or managed Redis)
• DB: Postgres (managed)
• ORM: Prisma (migrations tracked, no manual drift)

### Auth

• NextAuth (Auth.js) with email/password or magic link
• Session‑bound workspace, strict multi‑tenant boundaries

### Shopify

• Shopify OAuth (online tokens acceptable for MVP; plan for offline tokens)
• Webhooks for: orders/create, orders/paid, products/update, inventory_levels/update (and whichever are required for supported signals)
• API access via official Shopify SDK

### Email Provider (for win‑back drafts)

• MVP: email drafts only OR send via provider with sandbox mode available (Postmark/SendGrid).
• If sending is implemented in beta: always explicit approval and visible payload preview.

### Observability

• Structured logging (pino)
• Error tracking (Sentry)
• Metrics (basic counters + timings)
• Correlation IDs across request → job → execution

### Security

• Encrypt secrets at rest
• Least‑privilege OAuth scopes
• Never store payment data
• PII minimization and retention policy

---

## Repo Structure

```
/apps/web
  /app
  /components
  /lib
  /server
    /auth
    /db
    /shopify
    /events
    /opportunities
    /actions
    /jobs
    /observability
  /tests

/packages/shared
  /types
  /schemas (zod)
  /prompts

/prisma
  schema.prisma
  migrations/

/.github/workflows
  ci.yml
```

---

## Data Model (Minimum Viable, Future‑Proof)

### Tenancy

• Workspace: 1:1 with Shopify store for MVP
• User: belongs to workspace

### Core tables

• `workspaces`
• `users`
• `shopify_connections` (store_domain, access_token ref, scopes, status, revoked_at)

### Ingestion + compute

• `shopify_objects_cache` (optional; for denormalized snapshots, versioned)
• `events` (immutable):
– id, workspace_id, type, occurred_at, payload_json, dedupe_key, source, created_at

### Opportunities

• `opportunities`:
– id, workspace_id, type, priority_bucket, why_now, rationale, impact_range, counterfactual, decay_at, confidence, state, created_at
• `opportunity_event_links`:
– opportunity_id, event_id

### Actions

• `action_drafts`:
– id, workspace_id, opportunity_id, operator_intent, execution_type, payload_json, editable_fields_json, state
• `executions` (immutable):
– id, workspace_id, action_draft_id, request_payload_json, provider_response_json, status, error_code, error_message, started_at, finished_at, idempotency_key

### Learning loop

• `outcomes`:
– execution_id, outcome (helped|neutral|hurt), computed_at, evidence_json

### Prompt audit

• `ai_generations`:
– id, workspace_id, prompt_version, inputs_json, outputs_json, model, tokens, latency_ms, created_at

Acceptance criteria:
• Every opportunity links back to events
• Every execution links back to a draft and opportunity
• Nothing destructive is done without immutable execution logs

---

## Event Ingestion Layer

### Supported events (beta MVP)

• Inventory threshold crossed
• Product out of stock
• Product back in stock
• Velocity spike on product(s)
• Customer inactivity threshold crossed (30/60/90)

Requirements:
• Events computed server‑side from Shopify data and/or webhooks
• Events are immutable and deduped by `dedupe_key`
• Idempotent processing end‑to‑end

Acceptance criteria:
• Same event never generated twice for same condition window
• Events can be replayed deterministically in test harness
• Ingestion handles webhook retries safely (Shopify retries)
• Webhook authenticity verified (HMAC)

---

## Opportunity Engine (Differentiation Contract)

Definition:
An opportunity is a ranked, explainable suggestion derived from events with an explicit "why now" and a counterfactual.

### Opportunity semantics

Each opportunity MUST include:
• Triggering event(s)
• Operator intent: reduce inventory risk, re‑engage dormant customers, protect margin
• Rationale (plain language, store‑specific)
• Why now (explicit, non‑generic)
• Counterfactual (what likely happens if no action is taken)
• Expected impact range (directional; no guarantees)
• Priority bucket: high/medium/low
• Decay policy: degrade or expire at `decay_at`

### Prioritization

Priority is deterministic and based on:
• Urgency (time to stockout, decay window, cohort size)
• Estimated consequence magnitude (ranges ok)
• Confidence (derived from store history + global priors if available)
• Novelty (avoid repeating noise)

### State machine

new → viewed → (approved → executed → resolved) OR dismissed OR expired

Acceptance criteria:
• Opportunity generation is deterministic given inputs and versioned logic
• Dismissed/expired opportunities do not reappear unless material change in inputs
• Queue always explains why top items are top
• Every opportunity is traceable to event IDs
• Every opportunity has decay behavior and can expire

---

## Actions (Operator Intents + Execution Types)

### Operator intents (user‑facing)

• Reduce inventory risk
• Re‑engage dormant customers
• Protect margin on high performers

### Execution types (mechanics)

1. Discount draft (Shopify price rule / discount code)
2. Win‑back email draft (provider draft or send, if implemented)
3. Pause low‑inventory product (Shopify product status)

Requirements:
• Always draft first
• Payload preview before approval
• Inline editing of safe fields (copy, audience segment, discount %, start/end dates)
• Strict validation of payloads (Zod + server validation)
• Approval produces immutable execution record

Acceptance criteria:
• User can preview exact payload
• Edits are validated and persisted
• Approval creates an execution request with idempotency key
• Failures show actionable errors and do not partially execute
• Operator intent wording stays stable even if mechanics evolve

---

## AI Usage (Safe, Auditable, Non‑Magical)

Scope:
• AI drafts copy, explains rationale, writes why‑now, and counterfactual framing
• AI does not execute actions and cannot bypass approval

Prompting requirements:
• Prompts are versioned (`prompt_version`)
• Inputs/outputs logged to `ai_generations`
• Output must include:
– rationale
– why_now
– counterfactual
– disclaimers avoided; use precise uncertainty language ("likely", "range", "based on last 14 days")
• Must never invent metrics that are not computed

Acceptance criteria:
• Same inputs produce materially similar outputs
• If AI fails, system falls back to deterministic templates
• No hallucinated numeric claims
• AI output always includes counterfactual and why‑now

---

## Approval Queue UI (Magic Patterns Baseline)

Requirements:
• Central queue grouped by priority bucket
• Clear separation between suggestion, draft, and execution
• Inline edit for drafts
• One‑click dismiss with "don't show again unless changed" semantics
• Execution history view with outcome state and evidence

Acceptance criteria:
• Nothing executes without approval
• User always knows what has run and what is pending
• Each queue item shows why‑now and counterfactual
• Queue naturally clears via decay and dismiss

---

## Execution Engine

Requirements:
• Executes approved actions with idempotency keys
• Retries with exponential backoff for transient errors
• Hard stop with clear status after repeated failures
• Stores provider responses and error classification

Acceptance criteria:
• No partial executions
• Idempotent semantics verified via tests
• Execution logs visible in UI
• Rollback behavior documented per action:
– Discount: disable/delete rule if possible
– Product pause: restore prior status
– Email: if already sent, no rollback; surface "sent" state explicitly

---

## Learning Loop (Make it Feel Smarter)

Requirements:
• Every execution resolves to helped/neutral/hurt (async)
• Resolution computed via simple heuristics in MVP:
– Discounts: uplift in conversion / revenue vs baseline window
– Win‑back: open/click/convert rates vs baseline
– Product pause: reduction in stockouts/backorders or operational metric proxy
• Confidence score per operator intent derived from recent outcomes

Acceptance criteria:
• Outcomes are computed and stored with evidence_json
• Confidence changes deterministically
• UI shows confidence and recent track record without hype

---

## Security and Compliance Practices

Requirements:
• Shopify webhook HMAC verification
• CSRF protection for state‑changing routes
• Token encryption and rotation strategy
• Principle of least privilege scopes
• Workspace isolation in all queries (no cross‑tenant leakage)
• Secrets only in server runtime, never in client

Acceptance criteria:
• Pen test checklist passes (baseline: OWASP Top 10)
• No secrets in client bundles (verify)
• Multi‑tenant tests confirm isolation

---

## Performance and Reliability

SLO targets (beta):
• Dashboard TTI < 2s warm, < 4s cold
• Background jobs do not block UI
• Webhook ingestion within 5s p95
• Opportunity generation within 5 minutes of triggering event p95

Acceptance criteria:
• Load tests for key endpoints
• Job queue resilience validated (Redis restart simulation)
• Graceful degradation on Shopify API throttling

---

## CI/CD Quality Gates

Must run on every PR and main:
• `pnpm lint`
• `pnpm typecheck`
• `pnpm test` (unit + integration)
• `pnpm test:e2e` (Playwright)
• `pnpm prisma:validate` + migration check

Feature complete definition:
• All acceptance criteria implemented
• Tests added for logic and state transitions
• E2E covers critical flows
• No TODOs in core paths
• Observability added for new flows

---

## Testing Strategy

### Unit

• Opportunity prioritization and decay logic
• Dedupe keys and idempotency keys
• Payload validation (Zod)
• State machines

### Integration

• Shopify webhook ingestion and signature verification
• Shopify API calls mocked with contract tests
• BullMQ workers execute and persist logs

### E2E (Playwright)

Critical flows:

1. Sign up → connect Shopify (mock) → dashboard shows queue
2. Opportunity detail shows why‑now + counterfactual
3. Edit draft → approve → execution success shown
4. Execution failure surfaces actionable error
5. Dismiss opportunity → does not return unless input changes

---

## Feature Workstreams and Parallel Agents

Work must be planned and executed in parallel. Use these agents concurrently and keep them unblocked.

### Agent roles

• `product-spec` — refines JTBD and acceptance criteria into testable statements
• `architect` — system design, data model, boundaries, background jobs
• `frontend` — Next.js UI implementation from Magic Patterns
• `backend` — API/routes, Shopify integration, queue workers
• `ai-prompt` — prompt contracts, versioning, audit tables, fallbacks
• `qa` — test plan, Playwright flows, failure injection
• `security` — scopes, secret handling, webhook verification, threat model
• `release` — CI/CD, env config, migrations, deploy runbook

### Parallelization rules

• At least 3 workstreams active at all times: frontend, backend, qa
• No agent waits on perfect design; stub interfaces and iterate
• Every workstream lands behind flags if needed

---

## Implementation Plan (Autonomous Execution)

Do not pause for check-ins. Execute the plan end‑to‑end.

### Phase 0: Foundations

• Next.js app scaffold, lint/typecheck/test harness
• Prisma + Postgres + migrations
• Auth + workspace scoping
• CI workflow with quality gates

### Phase 1: Shopify Connectivity

• OAuth + token storage + revoke handling
• Webhook receiver + HMAC verification
• Initial sync jobs (orders/customers/products/inventory)

### Phase 2: Events + Opportunities

• Event computation jobs + dedupe
• Opportunity engine with priority, why‑now, counterfactual, decay
• Queue API + UI list/detail

### Phase 3: Draft Actions + Approval

• Draft creation for each execution type
• Inline edit + payload preview
• Approval writes execution record, enqueues job

### Phase 4: Execution Engine

• Shopify mutations for discount + product status
• Email draft/send integration if included
• Idempotency + retries + error taxonomy

### Phase 5: Learning Loop

• Outcome resolvers per action type
• Confidence scoring per operator intent
• UI surfacing and audit trail

### Phase 6: Beta Hardening

• Rate limiting + throttling handling
• Sentry + metrics + admin diagnostics
• E2E coverage for critical flows
• Security checklist + tenant isolation tests
• Deploy runbook + rollback plan

---

## Acceptance Criteria (Beta MVP)

### A. Auth + Workspace

• User can sign up/login/logout
• Exactly one workspace per user
• Exactly one Shopify store connected per workspace
• Without Shopify connection, app is read‑only with clear CTA

### B. Shopify Integration

• OAuth handshake succeeds
• Webhooks verified and ingested
• Revocation disables all actions immediately
• API throttling handled gracefully

### C. Events

• Server‑computed, immutable, deduped
• Replayable in test harness
• Deterministic timestamps

### D. Opportunities

• Priority bucket + why‑now + counterfactual + decay always present
• Deterministic generation per versioned logic
• Dismissed/expired items do not reappear without material change

### E. Actions

• Draft first, editable, previewable
• Approval required for execution
• Execution idempotent with immutable logs
• Failure modes visible and actionable

### F. Learning

• Every execution resolves helped/neutral/hurt
• Confidence updates deterministically
• UI shows confidence without hype

### G. Quality Gates

• Lint/typecheck/tests/E2E green
• No secrets in client
• Tenant isolation verified
• Observability sufficient to reconstruct any run

---

## Done Definition

Beta MVP is done when:
• Real store can connect, generate at least one real opportunity, draft and approve an action, execute safely, and see outcome + confidence
• Nothing executes without approval
• Full auditability: event → opportunity → draft → execution → outcome
• CI gates are green and release runbook exists
• Beta readiness score > 9.5/10 based on verification checklist

---

## Beta Verification Checklist (Scored)

This checklist is executed before declaring beta. Each item is scored 0–1. Target: ≥ 9.5 / 10. If score < 9.5, continue implementing and fixing. Do not stop.

### 1. First-Run Experience (1.0)

• Fresh user can sign up without assistance
• Shopify OAuth completes on first attempt
• Clear empty state before data arrives
• First opportunity appears within expected window

Score: ___ / 1.0

### 2. Opportunity Quality (1.0)

• Every opportunity includes:
  – priority bucket
  – why-now explanation
  – counterfactual
  – decay behavior
• Top opportunity feels obviously "most important"
• No generic or filler copy

Score: ___ / 1.0

### 3. Determinism and Repeatability (1.0)

• Same inputs + same version → same opportunity output
• Event replay reproduces opportunities exactly
• No duplicate opportunities across refreshes

Score: ___ / 1.0

### 4. Approval Safety (1.0)

• Nothing executes without explicit approval
• Approval step shows full, accurate payload
• Cancel/dismiss is respected permanently unless inputs change

Score: ___ / 1.0

### 5. Execution Correctness (1.0)

• Idempotency keys prevent double execution
• Transient failures retry safely
• Hard failures surface clear, actionable errors
• No partial executions observed in fault injection tests

Score: ___ / 1.0

### 6. Learning Loop Visibility (1.0)

• Every execution resolves to helped / neutral / hurt
• Evidence is inspectable (metrics window, comparison logic)
• Confidence indicators update deterministically
• Confidence never jumps erratically

Score: ___ / 1.0

### 7. UI Clarity and Calm (1.0)

• No cluttered screens or dense dashboards
• User always knows what has run vs pending
• Queue naturally shrinks via decay and dismiss
• No dark patterns or urgency pressure

Score: ___ / 1.0

### 8. Observability and Debuggability (1.0)

• Every user-visible action traceable via logs
• Correlation IDs link UI → job → execution
• Errors diagnosable within minutes

Score: ___ / 1.0

### 9. Security and Isolation (1.0)

• Webhook signatures verified
• OAuth scopes minimal and correct
• No cross-workspace data access possible
• No secrets shipped to client bundles

Score: ___ / 1.0

### 10. Performance and Resilience (1.0)

• Dashboard loads within SLOs
• Background jobs do not block UI
• Shopify rate limits handled gracefully
• Redis or worker restarts do not corrupt state

Score: ___ / 1.0

---

## Final Score

Sum all sections. Target ≥ 9.5 / 10.

If score < 9.5:
• Identify failing sections
• Implement fixes
• Re-run checklist
• Repeat until threshold is met

This checklist is non-negotiable. Passing it is the definition of beta readiness.
