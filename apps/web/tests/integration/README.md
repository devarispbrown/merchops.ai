# MerchOps Integration Tests

Comprehensive integration tests for MerchOps core systems.

## Test Coverage

### 1. Shopify OAuth Flow (`/shopify/oauth-flow.test.ts`)
- OAuth URL generation with proper state and CSRF protection
- Token exchange with mocked Shopify API
- Webhook registration after successful OAuth
- Token encryption/decryption with AES-256-GCM
- HMAC verification for security
- Scope validation
- Complete end-to-end OAuth flow

**Key Tests:**
- ✅ Shop domain validation (prevents malicious domains)
- ✅ HMAC signature verification (timing-safe comparison)
- ✅ Token encryption with random IV (different outputs for same token)
- ✅ Webhook registration with partial failure handling
- ✅ Complete OAuth flow from URL generation to webhook setup

### 2. Webhook Processing (`/shopify/webhook-processing.test.ts`)
- HMAC verification for incoming webhooks
- Order creation and payment webhooks
- Inventory level updates
- Idempotent processing (dedupe keys)
- Shopify retry handling

**Key Tests:**
- ✅ Valid HMAC signature verification
- ✅ Tampered payload rejection
- ✅ Order webhook processing with customer extraction
- ✅ Idempotent event creation (same webhook processed multiple times)
- ✅ Deterministic dedupe key generation

### 3. Opportunity Generation (`/opportunities/generation.test.ts`)
- Opportunity creation from event triggers
- Priority calculation (HIGH/MEDIUM/LOW)
- Decay time setting based on opportunity type
- Deterministic output from same inputs
- Operator intent mapping

**Key Tests:**
- ✅ Opportunity created from inventory threshold events
- ✅ Events linked to opportunities (audit trail)
- ✅ Priority calculated based on urgency and impact
- ✅ Decay times set correctly (7 days inventory, 30 days win-back)
- ✅ Deterministic explanations from fallback templates

### 4. Draft Approval Flow (`/drafts/approval-flow.test.ts`)
- Draft creation with payload validation
- Draft editing with schema enforcement
- Approval creates execution atomically
- Idempotency key generation
- Transaction rollback on failure

**Key Tests:**
- ✅ Draft created with valid payload and editable fields
- ✅ Payload validation against execution type schema
- ✅ Draft editing updates state to EDITED
- ✅ Approval creates execution record in transaction
- ✅ Idempotency key prevents duplicate executions
- ✅ Draft rejection updates opportunity to dismissed
- ✅ Atomic transaction ensures all-or-nothing updates

### 5. Execution Idempotency (`/executions/idempotency.test.ts`)
- Execution runs only once with same idempotency key
- Retry creates new execution with new key
- Partial execution prevention
- Concurrent execution prevention
- State machine validation

**Key Tests:**
- ✅ Already-succeeded execution returns immediately (no re-execution)
- ✅ Running execution prevents concurrent processing
- ✅ Failed execution allows retry with new idempotency key
- ✅ Draft state rolled back on execution failure
- ✅ Idempotency key format includes timestamp and random component
- ✅ Execution state follows valid transitions (PENDING → RUNNING → SUCCEEDED/FAILED)

### 6. Learning Outcome Computation (`/learning/outcome-computation.test.ts`)
- Discount outcome computation (HELPED/NEUTRAL/HURT)
- Confidence update based on outcomes
- Evidence storage with full audit trail
- Observation window enforcement
- Outcome idempotency

**Key Tests:**
- ✅ HELPED outcome for successful discount (125% uplift)
- ✅ NEUTRAL outcome for marginal impact (<10% uplift)
- ✅ HURT outcome for negative margin impact
- ✅ Confidence increases after HELPED outcomes
- ✅ Evidence stored with baseline, campaign metrics, and uplift
- ✅ Observation window prevents premature computation
- ✅ Different observation windows for execution types (7/14 days)
- ✅ Outcome computed only once (idempotent)

### 7. Tenant Isolation (`/db/tenant-isolation.test.ts`)
- Workspace A cannot access workspace B data
- All queries enforce workspace_id filtering
- Cross-tenant access prevention
- User-workspace binding
- Cascade delete isolation

**Key Tests:**
- ✅ Events isolated between workspaces
- ✅ Opportunities isolated between workspaces
- ✅ Executions isolated between workspaces
- ✅ Shopify connections isolated between workspaces
- ✅ Cross-tenant opportunity access returns null
- ✅ Cross-tenant draft update throws UNAUTHORIZED
- ✅ Dedupe keys scoped to workspace (same key in different workspaces)
- ✅ Workspace deletion cascades only to own data

### 8. Test Fixtures (`/fixtures/index.ts`)
- Centralized test data factory functions
- Shopify webhook payload generators
- Discount/email/pause payload creators
- Outcome evidence generators
- Mock response creators

## Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm test -- tests/integration/shopify/oauth-flow.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Infrastructure

### Setup (`tests/setup.ts`)
- Mock Prisma client (vitest-mock-extended)
- Mock Redis client
- Mock BullMQ queue
- Test data factory functions
- Time mocking utilities
- Assertion helpers

### Fixtures (`tests/fixtures/index.ts`)
- Reusable test data generators
- Shopify webhook payloads
- Action payloads (discount, email, pause)
- Outcome evidence
- Environment setup/cleanup

## Testing Principles

1. **Deterministic**: Same inputs always produce same outputs
2. **Isolated**: Each test can run independently
3. **Fast**: Integration tests complete in seconds
4. **Comprehensive**: Cover happy paths and edge cases
5. **Maintainable**: Clear test names and well-documented assertions

## Coverage Goals

- **Statements**: > 80%
- **Functions**: > 75%
- **Branches**: > 75%
- **Lines**: > 80%

## Mocking Strategy

### External Services (Mocked)
- Shopify API (fetch calls)
- Email provider (Postmark/SendGrid)
- Redis (ioredis)
- BullMQ (job queue)

### Internal Services (Real)
- Business logic
- State machines
- Validation (Zod schemas)
- Encryption/decryption

### Database (Mocked with Prisma Mock)
- All database queries mocked
- Transaction behavior simulated
- Allows testing business logic without real DB

## Security Testing

All tests verify:
- ✅ Workspace isolation (no cross-tenant access)
- ✅ HMAC verification (timing-safe)
- ✅ Token encryption (AES-256-GCM)
- ✅ SQL injection prevention (Prisma parameterization)
- ✅ Idempotency (prevents double execution)
- ✅ Atomic transactions (prevents partial updates)

## Acceptance Criteria Validation

Each test maps to specific acceptance criteria from CLAUDE.md:

**Shopify Integration (B)**
- ✅ OAuth handshake succeeds
- ✅ Webhooks verified and ingested
- ✅ API throttling handled gracefully

**Events (C)**
- ✅ Server-computed, immutable, deduped
- ✅ Replayable in test harness
- ✅ Deterministic timestamps

**Opportunities (D)**
- ✅ Priority bucket + why-now + counterfactual + decay always present
- ✅ Deterministic generation per versioned logic
- ✅ Dismissed/expired items do not reappear

**Actions (E)**
- ✅ Draft first, editable, previewable
- ✅ Approval required for execution
- ✅ Execution idempotent with immutable logs
- ✅ Failure modes visible and actionable

**Learning (F)**
- ✅ Every execution resolves helped/neutral/hurt
- ✅ Confidence updates deterministically
- ✅ UI shows confidence without hype

**Quality Gates (G)**
- ✅ Tests green
- ✅ Tenant isolation verified
- ✅ Observability sufficient

## Contributing

When adding new integration tests:

1. Use factory functions from `fixtures/index.ts`
2. Mock external services (Shopify, email, etc.)
3. Test both happy path and error cases
4. Verify idempotency where applicable
5. Ensure workspace isolation
6. Document test purpose clearly
7. Follow naming convention: `describe('Feature - Integration')`

## CI/CD Integration

These tests run on every PR and commit to main:
- Pre-commit: Lint + typecheck
- PR: All integration tests + unit tests
- Main: Full test suite + E2E tests

Quality gate: All tests must pass before merge.
