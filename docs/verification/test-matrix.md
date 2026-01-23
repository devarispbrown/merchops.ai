# MerchOps Beta MVP - Test Matrix

> Reference: [CLAUDE.md](/CLAUDE.md)
> Last Updated: 2026-01-23
> Target: Beta Readiness Score > 9.5 / 10

This document maps Jobs-to-be-Done (JTBD) to features, acceptance criteria, and test coverage. Use this matrix to track test implementation progress and ensure complete coverage.

---

## Coverage Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not implemented |
| `[P]` | Partially implemented |
| `[X]` | Fully implemented and passing |
| `N/A` | Not applicable for this test type |

---

## JTBD-1: Detect opportunities from store signals without constant dashboard babysitting

### Feature: Event Ingestion Layer

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Events computed server-side from Shopify data and/or webhooks | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Events are immutable and deduped by `dedupe_key` | `[ ]` | `[ ]` | N/A | `[ ]` |
| Idempotent processing end-to-end | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Same event never generated twice for same condition window | `[ ]` | `[ ]` | N/A | `[ ]` |
| Events can be replayed deterministically in test harness | `[ ]` | `[ ]` | N/A | `[ ]` |
| Ingestion handles webhook retries safely | N/A | `[ ]` | `[ ]` | `[ ]` |
| Webhook authenticity verified (HMAC) | `[ ]` | `[ ]` | N/A | `[ ]` |

#### Supported Events (Beta MVP)

| Event Type | Unit Tests | Integration Tests | Notes |
|------------|-----------|-------------------|-------|
| Inventory threshold crossed | `[ ]` | `[ ]` | Computed from inventory_levels/update webhook |
| Product out of stock | `[ ]` | `[ ]` | Computed from inventory levels |
| Product back in stock | `[ ]` | `[ ]` | Transition detection |
| Velocity spike on product(s) | `[ ]` | `[ ]` | Computed from orders/create patterns |
| Customer inactivity threshold (30/60/90 days) | `[ ]` | `[ ]` | Batch computed from order history |

### Feature: Shopify Integration

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| OAuth handshake succeeds | N/A | `[ ]` | `[ ]` | `[ ]` |
| Webhooks verified and ingested | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Revocation disables all actions immediately | N/A | `[ ]` | `[ ]` | `[ ]` |
| API throttling handled gracefully | N/A | `[ ]` | N/A | `[ ]` |
| Initial sync jobs complete (orders/customers/products/inventory) | N/A | `[ ]` | `[ ]` | `[ ]` |

### Feature: Background Job Processing

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| BullMQ workers execute and persist logs | N/A | `[ ]` | N/A | `[ ]` |
| Jobs do not block UI | N/A | `[ ]` | `[ ]` | `[ ]` |
| Redis restart does not corrupt state | N/A | `[ ]` | N/A | `[ ]` |

---

## JTBD-2: Understand why an opportunity surfaced now and what happens if nothing is done

### Feature: Opportunity Engine

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Every opportunity includes triggering event(s) | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Every opportunity includes operator intent | `[ ]` | N/A | `[ ]` | `[ ]` |
| Every opportunity includes rationale (plain language, store-specific) | `[ ]` | N/A | `[ ]` | `[ ]` |
| Every opportunity includes why-now (explicit, non-generic) | `[ ]` | N/A | `[ ]` | `[ ]` |
| Every opportunity includes counterfactual | `[ ]` | N/A | `[ ]` | `[ ]` |
| Every opportunity includes expected impact range | `[ ]` | N/A | `[ ]` | `[ ]` |
| Every opportunity includes priority bucket (high/medium/low) | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Every opportunity includes decay policy (decay_at) | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

### Feature: Opportunity Prioritization

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Priority is deterministic based on urgency | `[ ]` | `[ ]` | N/A | `[ ]` |
| Priority considers consequence magnitude | `[ ]` | `[ ]` | N/A | `[ ]` |
| Priority considers confidence (store history + priors) | `[ ]` | `[ ]` | N/A | `[ ]` |
| Priority considers novelty (avoid repeating noise) | `[ ]` | `[ ]` | N/A | `[ ]` |
| Queue explains why top items are top | N/A | N/A | `[ ]` | `[ ]` |

### Feature: Opportunity State Machine

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| State transitions: new -> viewed | `[ ]` | N/A | `[ ]` | `[ ]` |
| State transitions: viewed -> approved | `[ ]` | N/A | `[ ]` | `[ ]` |
| State transitions: approved -> executed | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| State transitions: executed -> resolved | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| State transitions: any -> dismissed | `[ ]` | N/A | `[ ]` | `[ ]` |
| State transitions: any -> expired | `[ ]` | `[ ]` | N/A | `[ ]` |
| Dismissed/expired do not reappear unless material change | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

### Feature: AI-Generated Content

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Prompts are versioned (prompt_version) | `[ ]` | N/A | N/A | `[ ]` |
| Inputs/outputs logged to ai_generations | N/A | `[ ]` | N/A | `[ ]` |
| Output includes rationale | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Output includes why_now | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Output includes counterfactual | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Uses precise uncertainty language | `[ ]` | N/A | `[ ]` | `[ ]` |
| No hallucinated numeric claims | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Same inputs produce materially similar outputs | `[ ]` | `[ ]` | N/A | `[ ]` |
| System falls back to deterministic templates on AI failure | `[ ]` | `[ ]` | N/A | `[ ]` |

---

## JTBD-3: Review and edit drafts safely, approve intentionally, and execute deterministically

### Feature: Draft Actions

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Always draft first (no direct execution) | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Payload preview before approval | N/A | N/A | `[ ]` | `[ ]` |
| Inline editing of safe fields | N/A | N/A | `[ ]` | `[ ]` |
| Strict validation of payloads (Zod + server) | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Edits are validated and persisted | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

#### Execution Types

| Execution Type | Draft Tests | Edit Tests | Validate Tests | Execute Tests |
|---------------|------------|-----------|----------------|--------------|
| Discount draft (Shopify price rule) | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Win-back email draft | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Pause low-inventory product | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

#### Editable Fields by Execution Type

| Execution Type | Editable Fields | Validation Tests |
|---------------|-----------------|------------------|
| Discount draft | discount %, start date, end date, copy | `[ ]` |
| Win-back email | subject, body copy, audience segment | `[ ]` |
| Pause product | none (binary action) | `[ ]` |

### Feature: Approval Queue

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Nothing executes without approval | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Central queue grouped by priority bucket | N/A | N/A | `[ ]` | `[ ]` |
| Clear separation: suggestion vs draft vs execution | N/A | N/A | `[ ]` | `[ ]` |
| One-click dismiss with "don't show again" semantics | N/A | `[ ]` | `[ ]` | `[ ]` |
| User always knows what has run vs pending | N/A | N/A | `[ ]` | `[ ]` |
| Each queue item shows why-now and counterfactual | N/A | N/A | `[ ]` | `[ ]` |
| Queue naturally clears via decay and dismiss | N/A | `[ ]` | `[ ]` | `[ ]` |

### Feature: Execution Engine

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Approval creates execution request with idempotency key | `[ ]` | `[ ]` | N/A | `[ ]` |
| Idempotent semantics verified | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Retries with exponential backoff for transient errors | `[ ]` | `[ ]` | N/A | `[ ]` |
| Hard stop with clear status after repeated failures | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Stores provider responses and error classification | `[ ]` | `[ ]` | N/A | `[ ]` |
| No partial executions | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Execution logs visible in UI | N/A | N/A | `[ ]` | `[ ]` |
| Failures show actionable errors | N/A | `[ ]` | `[ ]` | `[ ]` |

#### Rollback Behavior Tests

| Execution Type | Rollback Possible | Rollback Tested | Notes |
|---------------|-------------------|-----------------|-------|
| Discount | Yes (disable/delete rule) | `[ ]` | |
| Product pause | Yes (restore prior status) | `[ ]` | |
| Email | No (surface "sent" state) | `[ ]` | Cannot unsend |

---

## JTBD-4: Track outcomes and build confidence that MerchOps is learning for this store

### Feature: Learning Loop

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Every execution resolves to helped/neutral/hurt | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Resolution computed via heuristics | `[ ]` | `[ ]` | N/A | `[ ]` |
| Outcomes stored with evidence_json | `[ ]` | `[ ]` | N/A | `[ ]` |
| Confidence score per operator intent | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Confidence changes deterministically | `[ ]` | `[ ]` | N/A | `[ ]` |
| UI shows confidence without hype | N/A | N/A | `[ ]` | `[ ]` |

#### Outcome Resolution Heuristics

| Execution Type | Heuristic | Unit Tests | Integration Tests |
|---------------|-----------|-----------|-------------------|
| Discounts | Uplift in conversion/revenue vs baseline | `[ ]` | `[ ]` |
| Win-back email | Open/click/convert rates vs baseline | `[ ]` | `[ ]` |
| Product pause | Reduction in stockouts/backorders | `[ ]` | `[ ]` |

### Feature: Execution History

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Execution history view accessible | N/A | N/A | `[ ]` | `[ ]` |
| Outcome state visible | N/A | N/A | `[ ]` | `[ ]` |
| Evidence inspectable | N/A | N/A | `[ ]` | `[ ]` |

---

## Cross-Cutting Concerns

### Auth + Workspace

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| User can sign up | N/A | `[ ]` | `[ ]` | `[ ]` |
| User can login | N/A | `[ ]` | `[ ]` | `[ ]` |
| User can logout | N/A | `[ ]` | `[ ]` | `[ ]` |
| Exactly one workspace per user | `[ ]` | `[ ]` | N/A | `[ ]` |
| Exactly one Shopify store per workspace | `[ ]` | `[ ]` | N/A | `[ ]` |
| Without Shopify connection, app is read-only with clear CTA | N/A | N/A | `[ ]` | `[ ]` |
| Session-bound workspace, strict multi-tenant boundaries | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

### Data Model Integrity

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Every opportunity links back to events | `[ ]` | `[ ]` | N/A | `[ ]` |
| Every execution links back to draft and opportunity | `[ ]` | `[ ]` | N/A | `[ ]` |
| Nothing destructive without immutable execution logs | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Opportunity generation deterministic per versioned logic | `[ ]` | `[ ]` | N/A | `[ ]` |

### Security

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Shopify webhook HMAC verification | `[ ]` | `[ ]` | N/A | `[ ]` |
| CSRF protection for state-changing routes | N/A | `[ ]` | `[ ]` | `[ ]` |
| Token encryption at rest | N/A | `[ ]` | N/A | `[ ]` |
| Principle of least privilege scopes | `[ ]` | N/A | N/A | `[ ]` |
| Workspace isolation in all queries | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Secrets only in server runtime | N/A | `[ ]` | `[ ]` | `[ ]` |
| No secrets in client bundles | N/A | N/A | `[ ]` | `[ ]` |
| OWASP Top 10 checklist passes | N/A | `[ ]` | `[ ]` | `[ ]` |

### Performance

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Dashboard TTI < 2s warm | N/A | N/A | `[ ]` | `[ ]` |
| Dashboard TTI < 4s cold | N/A | N/A | `[ ]` | `[ ]` |
| Background jobs do not block UI | N/A | `[ ]` | `[ ]` | `[ ]` |
| Webhook ingestion within 5s p95 | N/A | `[ ]` | N/A | `[ ]` |
| Opportunity generation within 5 minutes of trigger p95 | N/A | `[ ]` | N/A | `[ ]` |

### Observability

| Acceptance Criterion | Unit | Integration | E2E | Coverage Status |
|---------------------|------|-------------|-----|-----------------|
| Structured logging (pino) | N/A | `[ ]` | N/A | `[ ]` |
| Error tracking (Sentry) | N/A | `[ ]` | N/A | `[ ]` |
| Metrics (counters + timings) | N/A | `[ ]` | N/A | `[ ]` |
| Correlation IDs across request -> job -> execution | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Every user-visible action traceable via logs | N/A | `[ ]` | `[ ]` | `[ ]` |
| Errors diagnosable within minutes | N/A | N/A | `[ ]` | `[ ]` |

---

## E2E Critical Flows (Playwright)

| Flow | Description | Status |
|------|-------------|--------|
| E2E-1 | Sign up -> connect Shopify (mock) -> dashboard shows queue | `[ ]` |
| E2E-2 | Opportunity detail shows why-now + counterfactual | `[ ]` |
| E2E-3 | Edit draft -> approve -> execution success shown | `[ ]` |
| E2E-4 | Execution failure surfaces actionable error | `[ ]` |
| E2E-5 | Dismiss opportunity -> does not return unless input changes | `[ ]` |

---

## Test File Mapping

| Test Category | Expected File Path | Status |
|--------------|-------------------|--------|
| Unit: Event computation | `/apps/web/tests/unit/events/*.test.ts` | `[ ]` |
| Unit: Opportunity prioritization | `/apps/web/tests/unit/opportunities/*.test.ts` | `[ ]` |
| Unit: Dedupe keys | `/apps/web/tests/unit/events/dedupe.test.ts` | `[ ]` |
| Unit: Idempotency keys | `/apps/web/tests/unit/execution/idempotency.test.ts` | `[ ]` |
| Unit: Payload validation (Zod) | `/apps/web/tests/unit/validation/*.test.ts` | `[ ]` |
| Unit: State machines | `/apps/web/tests/unit/state-machines/*.test.ts` | `[ ]` |
| Integration: Shopify webhooks | `/apps/web/tests/integration/shopify/*.test.ts` | `[ ]` |
| Integration: Shopify API (mocked) | `/apps/web/tests/integration/shopify/api.test.ts` | `[ ]` |
| Integration: BullMQ workers | `/apps/web/tests/integration/jobs/*.test.ts` | `[ ]` |
| Integration: Auth flows | `/apps/web/tests/integration/auth/*.test.ts` | `[ ]` |
| E2E: Critical flows | `/apps/web/tests/e2e/*.spec.ts` | `[ ]` |

---

## Coverage Summary

| Category | Total Criteria | Covered | Percentage |
|----------|---------------|---------|------------|
| JTBD-1: Detection | 23 | 0 | 0% |
| JTBD-2: Understanding | 35 | 0 | 0% |
| JTBD-3: Execution | 32 | 0 | 0% |
| JTBD-4: Learning | 15 | 0 | 0% |
| Cross-Cutting | 30 | 0 | 0% |
| **Total** | **135** | **0** | **0%** |

---

## Notes

- This matrix should be updated as tests are implemented
- Coverage status should be verified by CI pipeline
- Any criterion marked N/A should have documented rationale
- All criteria must be covered before declaring beta readiness
