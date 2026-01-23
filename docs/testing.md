# MerchOps Testing Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-23
**Audience:** Developers

---

## Table of Contents

1. [Overview](#overview)
2. [Test Strategy](#test-strategy)
3. [Test Structure](#test-structure)
4. [Running Tests](#running-tests)
5. [Unit Tests](#unit-tests)
6. [Integration Tests](#integration-tests)
7. [E2E Tests](#e2e-tests)
8. [Test Fixtures and Mocks](#test-fixtures-and-mocks)
9. [Writing New Tests](#writing-new-tests)
10. [Code Coverage](#code-coverage)
11. [CI/CD Integration](#cicd-integration)
12. [Best Practices](#best-practices)

---

## Overview

MerchOps follows a comprehensive testing strategy aligned with the quality gates defined in [CLAUDE.md](/CLAUDE.md):

- **Unit Tests**: Test isolated logic, algorithms, and utilities
- **Integration Tests**: Test component interactions, database operations, and external services
- **E2E Tests**: Test complete user flows from UI to database

### Testing Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **Vitest** | Unit and integration tests | `apps/web/vitest.config.ts` |
| **Playwright** | E2E browser tests | `apps/web/playwright.config.ts` |
| **vitest-mock-extended** | Deep mocking utilities | - |
| **Testing Library** | React component testing | - |

### Test Requirements

From CLAUDE.md, all features require:

- Unit tests for logic and state transitions
- Integration tests for service interactions
- E2E tests for critical user flows
- Coverage targets: 80% statements, 75% branches, 75% functions

---

## Test Strategy

### Testing Pyramid

```
                    ┌─────────────┐
                    │    E2E      │  Few, slow, high confidence
                    │  (5 flows)  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │      Integration        │  Some, moderate speed
              │   (Shopify, DB, Jobs)   │
              └────────────┬────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │              Unit Tests              │  Many, fast, isolated
        │  (Prioritization, Validation, State) │
        └─────────────────────────────────────┘
```

### What to Test Where

| Layer | Test Type | Examples |
|-------|-----------|----------|
| Business Logic | Unit | Priority calculation, decay logic, confidence scoring |
| Validation | Unit | Zod schemas, payload validation |
| State Machines | Unit | Opportunity state transitions |
| API Routes | Integration | Request/response, auth, error handling |
| Shopify Integration | Integration | OAuth, webhooks, API calls (mocked) |
| Background Jobs | Integration | Job processing, queue behavior |
| User Flows | E2E | Sign-up, approval, execution |

### Critical Test Scenarios

From CLAUDE.md, these flows MUST have E2E coverage:

1. Sign up -> Connect Shopify (mock) -> Dashboard shows queue
2. Opportunity detail shows why-now + counterfactual
3. Edit draft -> Approve -> Execution success shown
4. Execution failure surfaces actionable error
5. Dismiss opportunity -> Does not return unless input changes

---

## Test Structure

### Directory Layout

```
apps/web/
├── tests/
│   ├── setup.ts                     # Global test setup and utilities
│   ├── unit/                        # Unit tests
│   │   ├── events/
│   │   │   ├── dedupe.test.ts
│   │   │   └── compute.test.ts
│   │   ├── opportunities/
│   │   │   ├── prioritization.test.ts
│   │   │   ├── decay.test.ts
│   │   │   └── state-machine.test.ts
│   │   ├── execution/
│   │   │   ├── idempotency.test.ts
│   │   │   └── validation.test.ts
│   │   ├── learning/
│   │   │   └── confidence.test.ts
│   │   └── validation/
│   │       └── schemas.test.ts
│   │
│   ├── integration/                 # Integration tests
│   │   ├── shopify/
│   │   │   ├── oauth.test.ts
│   │   │   ├── webhooks.test.ts
│   │   │   └── api.test.ts
│   │   ├── jobs/
│   │   │   ├── sync.test.ts
│   │   │   └── execution.test.ts
│   │   ├── auth/
│   │   │   └── session.test.ts
│   │   └── security/
│   │       └── tenant-isolation.test.ts
│   │
│   └── e2e/                         # E2E tests (Playwright)
│       ├── auth/
│       │   ├── signup.spec.ts
│       │   └── login.spec.ts
│       ├── onboarding/
│       │   ├── shopify-connect.spec.ts
│       │   └── empty-state.spec.ts
│       ├── opportunities/
│       │   ├── queue.spec.ts
│       │   └── detail.spec.ts
│       ├── actions/
│       │   ├── edit-draft.spec.ts
│       │   ├── approve.spec.ts
│       │   └── execution-error.spec.ts
│       ├── global-setup.ts
│       └── global-teardown.ts
│
├── vitest.config.ts                 # Vitest configuration
└── playwright.config.ts             # Playwright configuration
```

### Naming Conventions

| Type | File Pattern | Example |
|------|--------------|---------|
| Unit Test | `*.test.ts` | `prioritization.test.ts` |
| Integration Test | `*.test.ts` | `oauth.test.ts` |
| E2E Test | `*.spec.ts` | `signup.spec.ts` |
| Test Utilities | `*.utils.ts` | `db.utils.ts` |
| Fixtures | `fixtures/*.ts` | `fixtures/opportunities.ts` |

---

## Running Tests

### All Tests

```bash
# Run all tests (unit + integration)
pnpm test

# Run with verbose output
pnpm test -- --reporter=verbose

# Run in watch mode
pnpm test:watch
```

### Unit Tests Only

```bash
# Run unit tests
pnpm test:unit

# Run specific unit test file
pnpm test tests/unit/opportunities/prioritization.test.ts

# Run tests matching pattern
pnpm test -- --grep "prioritization"
```

### Integration Tests Only

```bash
# Run integration tests
pnpm test:integration

# Run specific integration test
pnpm test tests/integration/shopify/webhooks.test.ts

# Run with database (requires test DB)
DATABASE_URL=$TEST_DATABASE_URL pnpm test:integration
```

### E2E Tests (Playwright)

```bash
# Install browsers (first time)
npx playwright install

# Run all E2E tests
pnpm test:e2e

# Run specific E2E test file
pnpm test:e2e tests/e2e/auth/signup.spec.ts

# Run with UI mode (interactive)
pnpm test:e2e -- --ui

# Run with headed browser
pnpm test:e2e -- --headed

# Debug mode
pnpm test:e2e -- --debug

# Generate tests (record mode)
npx playwright codegen http://localhost:3000
```

### Coverage

```bash
# Generate coverage report
pnpm test:coverage

# Coverage report will be in:
# - ./coverage/index.html (HTML report)
# - ./coverage/lcov.info (for CI tools)
```

---

## Unit Tests

### Purpose

Unit tests verify isolated logic without external dependencies. All external dependencies (database, Redis, APIs) are mocked.

### Example: Opportunity Prioritization

```typescript
// tests/unit/opportunities/prioritization.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { calculatePriority, PriorityFactors } from '@/server/opportunities/prioritization';

describe('Opportunity Prioritization', () => {
  describe('calculatePriority', () => {
    it('assigns high priority to urgent opportunities', () => {
      const factors: PriorityFactors = {
        urgency: 0.9,          // High urgency (near stockout)
        consequenceMagnitude: 0.7,
        confidence: 0.8,
        novelty: 0.6,
      };

      const result = calculatePriority(factors);

      expect(result.bucket).toBe('high');
      expect(result.score).toBeGreaterThan(0.75);
    });

    it('assigns low priority to non-urgent opportunities', () => {
      const factors: PriorityFactors = {
        urgency: 0.2,
        consequenceMagnitude: 0.3,
        confidence: 0.5,
        novelty: 0.4,
      };

      const result = calculatePriority(factors);

      expect(result.bucket).toBe('low');
      expect(result.score).toBeLessThan(0.4);
    });

    it('is deterministic for same inputs', () => {
      const factors: PriorityFactors = {
        urgency: 0.5,
        consequenceMagnitude: 0.5,
        confidence: 0.5,
        novelty: 0.5,
      };

      const result1 = calculatePriority(factors);
      const result2 = calculatePriority(factors);

      expect(result1).toEqual(result2);
    });

    it('handles edge case of all minimum values', () => {
      const factors: PriorityFactors = {
        urgency: 0,
        consequenceMagnitude: 0,
        confidence: 0,
        novelty: 0,
      };

      const result = calculatePriority(factors);

      expect(result.bucket).toBe('low');
      expect(result.score).toBe(0);
    });

    it('handles edge case of all maximum values', () => {
      const factors: PriorityFactors = {
        urgency: 1,
        consequenceMagnitude: 1,
        confidence: 1,
        novelty: 1,
      };

      const result = calculatePriority(factors);

      expect(result.bucket).toBe('high');
      expect(result.score).toBe(1);
    });
  });
});
```

### Example: State Machine Transitions

```typescript
// tests/unit/opportunities/state-machine.test.ts
import { describe, it, expect } from 'vitest';
import {
  OpportunityStateMachine,
  OpportunityState,
  OpportunityEvent
} from '@/server/opportunities/state-machine';

describe('Opportunity State Machine', () => {
  describe('valid transitions', () => {
    it('transitions from new to viewed', () => {
      const machine = new OpportunityStateMachine('new');

      const nextState = machine.transition('VIEW');

      expect(nextState).toBe('viewed');
    });

    it('transitions from viewed to approved', () => {
      const machine = new OpportunityStateMachine('viewed');

      const nextState = machine.transition('APPROVE');

      expect(nextState).toBe('approved');
    });

    it('transitions from approved to executed', () => {
      const machine = new OpportunityStateMachine('approved');

      const nextState = machine.transition('EXECUTE');

      expect(nextState).toBe('executed');
    });

    it('allows dismissal from any non-terminal state', () => {
      const states: OpportunityState[] = ['new', 'viewed', 'approved'];

      for (const state of states) {
        const machine = new OpportunityStateMachine(state);
        const nextState = machine.transition('DISMISS');
        expect(nextState).toBe('dismissed');
      }
    });
  });

  describe('invalid transitions', () => {
    it('throws error for invalid transition', () => {
      const machine = new OpportunityStateMachine('new');

      expect(() => machine.transition('EXECUTE')).toThrow(
        'Invalid transition: new -> EXECUTE'
      );
    });

    it('cannot transition from terminal states', () => {
      const terminalStates: OpportunityState[] = ['dismissed', 'expired', 'resolved'];

      for (const state of terminalStates) {
        const machine = new OpportunityStateMachine(state);
        expect(() => machine.transition('VIEW')).toThrow();
      }
    });
  });
});
```

### Example: Idempotency Key Generation

```typescript
// tests/unit/execution/idempotency.test.ts
import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey } from '@/server/actions/idempotency';

describe('Idempotency Key Generation', () => {
  it('generates deterministic key from draft ID and timestamp', () => {
    const draftId = 'draft_abc123';
    const approvedAt = new Date('2024-01-15T10:00:00Z');

    const key1 = generateIdempotencyKey(draftId, approvedAt);
    const key2 = generateIdempotencyKey(draftId, approvedAt);

    expect(key1).toBe(key2);
    expect(key1).toBe('exec:draft_abc123:1705312800000');
  });

  it('generates different keys for different drafts', () => {
    const approvedAt = new Date('2024-01-15T10:00:00Z');

    const key1 = generateIdempotencyKey('draft_1', approvedAt);
    const key2 = generateIdempotencyKey('draft_2', approvedAt);

    expect(key1).not.toBe(key2);
  });

  it('generates different keys for different timestamps', () => {
    const draftId = 'draft_abc123';

    const key1 = generateIdempotencyKey(draftId, new Date('2024-01-15T10:00:00Z'));
    const key2 = generateIdempotencyKey(draftId, new Date('2024-01-15T10:00:01Z'));

    expect(key1).not.toBe(key2);
  });
});
```

---

## Integration Tests

### Purpose

Integration tests verify that components work together correctly. They may use:
- Real or test database
- Mocked external APIs (Shopify)
- Real Redis (or mocked)

### Example: Shopify Webhook Verification

```typescript
// tests/integration/shopify/webhooks.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import { verifyShopifyWebhook } from '@/server/shopify/webhooks';

describe('Shopify Webhook Verification', () => {
  const webhookSecret = 'test-secret';

  beforeEach(() => {
    process.env.SHOPIFY_WEBHOOK_SECRET = webhookSecret;
  });

  function generateValidSignature(body: string): string {
    return createHmac('sha256', webhookSecret)
      .update(body, 'utf8')
      .digest('base64');
  }

  it('accepts valid webhook signature', async () => {
    const body = JSON.stringify({ id: 123, topic: 'orders/create' });
    const signature = generateValidSignature(body);

    const result = await verifyShopifyWebhook({
      body,
      signature,
    });

    expect(result.valid).toBe(true);
  });

  it('rejects invalid webhook signature', async () => {
    const body = JSON.stringify({ id: 123, topic: 'orders/create' });
    const invalidSignature = 'invalid-signature';

    const result = await verifyShopifyWebhook({
      body,
      signature: invalidSignature,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid HMAC signature');
  });

  it('rejects tampered body', async () => {
    const originalBody = JSON.stringify({ id: 123, topic: 'orders/create' });
    const signature = generateValidSignature(originalBody);
    const tamperedBody = JSON.stringify({ id: 456, topic: 'orders/create' });

    const result = await verifyShopifyWebhook({
      body: tamperedBody,
      signature,
    });

    expect(result.valid).toBe(false);
  });

  it('uses timing-safe comparison', async () => {
    // This test ensures we don't leak timing information
    const body = JSON.stringify({ id: 123 });
    const validSignature = generateValidSignature(body);

    // Measure time for valid vs invalid signatures
    const times: { valid: number[]; invalid: number[] } = { valid: [], invalid: [] };

    for (let i = 0; i < 100; i++) {
      const startValid = process.hrtime.bigint();
      await verifyShopifyWebhook({ body, signature: validSignature });
      times.valid.push(Number(process.hrtime.bigint() - startValid));

      const startInvalid = process.hrtime.bigint();
      await verifyShopifyWebhook({ body, signature: 'wrong' });
      times.invalid.push(Number(process.hrtime.bigint() - startInvalid));
    }

    const avgValid = times.valid.reduce((a, b) => a + b) / times.valid.length;
    const avgInvalid = times.invalid.reduce((a, b) => a + b) / times.invalid.length;

    // Times should be similar (within 20%)
    expect(Math.abs(avgValid - avgInvalid) / avgValid).toBeLessThan(0.2);
  });
});
```

### Example: Tenant Isolation

```typescript
// tests/integration/security/tenant-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import {
  createTestWorkspace,
  createTestOpportunity,
  createTestUser
} from '@/tests/setup';

describe('Tenant Isolation', () => {
  let workspace1: { id: string };
  let workspace2: { id: string };
  let user1: { id: string };
  let user2: { id: string };

  beforeAll(async () => {
    // Create two separate workspaces
    workspace1 = await prisma.workspace.create({
      data: createTestWorkspace({ name: 'Workspace 1' }),
    });
    workspace2 = await prisma.workspace.create({
      data: createTestWorkspace({ name: 'Workspace 2' }),
    });

    // Create users in each workspace
    user1 = await prisma.user.create({
      data: createTestUser({
        email: 'user1@test.com',
        workspace_id: workspace1.id,
      }),
    });
    user2 = await prisma.user.create({
      data: createTestUser({
        email: 'user2@test.com',
        workspace_id: workspace2.id,
      }),
    });

    // Create opportunities in each workspace
    await prisma.opportunity.create({
      data: createTestOpportunity({
        workspace_id: workspace1.id,
        rationale: 'Workspace 1 opportunity',
      }),
    });
    await prisma.opportunity.create({
      data: createTestOpportunity({
        workspace_id: workspace2.id,
        rationale: 'Workspace 2 opportunity',
      }),
    });
  });

  afterAll(async () => {
    await prisma.opportunity.deleteMany({
      where: {
        workspace_id: { in: [workspace1.id, workspace2.id] },
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user1.id, user2.id] } },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: [workspace1.id, workspace2.id] } },
    });
  });

  it('user cannot access other workspace opportunities', async () => {
    // Query as user1 (workspace1)
    const opportunities = await prisma.opportunity.findMany({
      where: {
        workspace_id: workspace1.id,
      },
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].rationale).toBe('Workspace 1 opportunity');
  });

  it('cannot query opportunities without workspace filter', async () => {
    // This should be prevented by our query patterns
    // Using raw query to test isolation
    const result = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM opportunities
      WHERE workspace_id = ${workspace1.id}
    `;

    expect((result as any)[0].count).toBe('1');
  });

  it('cannot update opportunities in other workspace', async () => {
    const ws1Opportunity = await prisma.opportunity.findFirst({
      where: { workspace_id: workspace1.id },
    });

    // Attempt to update from "wrong" workspace context
    const result = await prisma.opportunity.updateMany({
      where: {
        id: ws1Opportunity!.id,
        workspace_id: workspace2.id, // Wrong workspace
      },
      data: {
        rationale: 'Hacked!',
      },
    });

    expect(result.count).toBe(0);

    // Verify original unchanged
    const unchanged = await prisma.opportunity.findUnique({
      where: { id: ws1Opportunity!.id },
    });
    expect(unchanged!.rationale).toBe('Workspace 1 opportunity');
  });
});
```

### Example: Job Processing

```typescript
// tests/integration/jobs/execution.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Queue, Worker, Job } from 'bullmq';
import { executionQueue, closeAllQueues } from '@/server/jobs/queues';
import { processExecutionJob } from '@/server/jobs/workers/execution';
import { redisConnection } from '@/server/jobs/config';

describe('Execution Job Processing', () => {
  let testQueue: Queue;
  let worker: Worker;

  beforeEach(async () => {
    testQueue = new Queue('test-execution', { connection: redisConnection });
    await testQueue.obliterate({ force: true }); // Clear queue
  });

  afterEach(async () => {
    if (worker) await worker.close();
    if (testQueue) {
      await testQueue.obliterate({ force: true });
      await testQueue.close();
    }
  });

  it('processes execution job successfully', async () => {
    const jobData = {
      workspaceId: 'test-ws',
      executionId: 'test-exec',
      idempotencyKey: 'test-key-1',
      payload: {
        discountCode: 'TEST10',
        discountPercent: 10,
        productIds: ['prod_123'],
      },
      correlationId: 'test-corr',
    };

    // Mock Shopify API
    vi.mock('@/server/shopify/client', () => ({
      createDiscount: vi.fn().mockResolvedValue({ id: 'discount_123' }),
    }));

    let processedJob: Job | null = null;

    worker = new Worker(
      'test-execution',
      async (job) => {
        processedJob = job;
        return await processExecutionJob(job);
      },
      { connection: redisConnection }
    );

    await testQueue.add('execute-discount', jobData);

    // Wait for job to process
    await new Promise((resolve) => {
      worker.on('completed', resolve);
    });

    expect(processedJob).not.toBeNull();
    expect(processedJob!.data.executionId).toBe('test-exec');
  });

  it('retries on transient failure', async () => {
    const jobData = {
      workspaceId: 'test-ws',
      executionId: 'test-exec-2',
      idempotencyKey: 'test-key-2',
      payload: {},
      correlationId: 'test-corr',
    };

    let attempts = 0;

    worker = new Worker(
      'test-execution',
      async (job) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient error');
        }
        return { success: true };
      },
      {
        connection: redisConnection,
        settings: { backoffStrategy: () => 100 }, // Fast retry for test
      }
    );

    await testQueue.add('execute-discount', jobData, { attempts: 5 });

    // Wait for completion
    await new Promise((resolve) => {
      worker.on('completed', resolve);
    });

    expect(attempts).toBe(3);
  });
});
```

---

## E2E Tests

### Purpose

E2E tests verify complete user flows through the browser, ensuring the entire stack works together.

### Playwright Configuration

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Example: Sign-Up Flow

```typescript
// tests/e2e/auth/signup.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sign Up Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('user can sign up with valid credentials', async ({ page }) => {
    // Fill out sign-up form
    await page.fill('[data-testid="email-input"]', 'newuser@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'SecurePassword123!');

    // Submit form
    await page.click('[data-testid="signup-button"]');

    // Verify redirect to dashboard/onboarding
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);

    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.click('[data-testid="signup-button"]');

    await expect(page.locator('[data-testid="email-error"]')).toContainText(
      'valid email'
    );
  });

  test('shows validation error for weak password', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="password-input"]', '123');
    await page.click('[data-testid="signup-button"]');

    await expect(page.locator('[data-testid="password-error"]')).toContainText(
      'at least 8 characters'
    );
  });

  test('shows error for existing email', async ({ page }) => {
    // Use an email that already exists in test database
    await page.fill('[data-testid="email-input"]', 'existing@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'SecurePassword123!');
    await page.click('[data-testid="signup-button"]');

    await expect(page.locator('[data-testid="form-error"]')).toContainText(
      'already exists'
    );
  });
});
```

### Example: Approval Flow

```typescript
// tests/e2e/actions/approve.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Action Approval Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    // Navigate to opportunity queue
    await page.goto('/queue');
    await page.waitForSelector('[data-testid="opportunity-card"]');
  });

  test('user can approve action with payload preview', async ({ page }) => {
    // Click on an opportunity
    await page.click('[data-testid="opportunity-card"]:first-child');

    // Wait for detail view
    await expect(page.locator('[data-testid="opportunity-detail"]')).toBeVisible();

    // Verify why-now and counterfactual are displayed
    await expect(page.locator('[data-testid="why-now"]')).toBeVisible();
    await expect(page.locator('[data-testid="counterfactual"]')).toBeVisible();

    // View draft action
    await page.click('[data-testid="view-draft-button"]');

    // Verify payload preview is shown
    await expect(page.locator('[data-testid="payload-preview"]')).toBeVisible();

    // Verify all editable fields are displayed
    await expect(page.locator('[data-testid="discount-code-field"]')).toBeVisible();
    await expect(page.locator('[data-testid="discount-percent-field"]')).toBeVisible();

    // Approve the action
    await page.click('[data-testid="approve-button"]');

    // Verify confirmation dialog
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-approve-button"]');

    // Verify success state
    await expect(page.locator('[data-testid="execution-status"]')).toContainText(
      'Pending'
    );
  });

  test('nothing executes without explicit approval', async ({ page }) => {
    // Click on opportunity
    await page.click('[data-testid="opportunity-card"]:first-child');

    // View draft but don't approve
    await page.click('[data-testid="view-draft-button"]');

    // Navigate away
    await page.goto('/queue');

    // Return to same opportunity
    await page.click('[data-testid="opportunity-card"]:first-child');

    // Verify still in draft state (not executed)
    await expect(page.locator('[data-testid="action-state"]')).toContainText(
      'Draft'
    );
  });

  test('dismissed opportunity does not reappear', async ({ page }) => {
    // Get opportunity ID before dismissing
    const opportunityId = await page
      .locator('[data-testid="opportunity-card"]:first-child')
      .getAttribute('data-opportunity-id');

    // Dismiss the opportunity
    await page.click('[data-testid="opportunity-card"]:first-child');
    await page.click('[data-testid="dismiss-button"]');

    // Confirm dismissal
    await page.click('[data-testid="confirm-dismiss-button"]');

    // Verify it's removed from queue
    await expect(page).toHaveURL('/queue');
    await expect(
      page.locator(`[data-opportunity-id="${opportunityId}"]`)
    ).not.toBeVisible();

    // Refresh page and verify still not present
    await page.reload();
    await expect(
      page.locator(`[data-opportunity-id="${opportunityId}"]`)
    ).not.toBeVisible();
  });
});
```

### Example: Execution Error Handling

```typescript
// tests/e2e/actions/execution-error.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Execution Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');
  });

  test('execution failure shows actionable error', async ({ page }) => {
    // Navigate to history to see a failed execution
    await page.goto('/history');

    // Click on failed execution
    await page.click('[data-testid="execution-row"][data-status="failed"]');

    // Verify error details are shown
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    // Verify error is actionable (not just "error occurred")
    const errorText = await page.locator('[data-testid="error-message"]').textContent();
    expect(errorText).not.toContain('An error occurred');
    expect(errorText?.length).toBeGreaterThan(20);

    // Verify retry option is available (if retryable)
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });
});
```

---

## Test Fixtures and Mocks

### Global Test Setup

```typescript
// tests/setup.ts
import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
export const prismaMock = mockDeep<PrismaClient>();

// Mock Redis
export const redisMock = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  // ... other methods
};

// Factory functions for test data
export function createTestWorkspace(overrides = {}) {
  return {
    id: 'test-workspace-id',
    name: 'Test Workspace',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createTestOpportunity(overrides = {}) {
  return {
    id: 'test-opportunity-id',
    workspace_id: 'test-workspace-id',
    type: 'inventory_clearance',
    priority_bucket: 'high',
    why_now: 'Inventory at critical threshold',
    rationale: 'Product has only 5 units remaining',
    impact_range: '5-15 units cleared',
    counterfactual: 'Likely stockout in 2-3 days',
    decay_at: new Date('2024-01-22'),
    confidence: 0.75,
    state: 'new',
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
    ...overrides,
  };
}

// Time utilities
export function mockCurrentTime(date: Date | string) {
  vi.useFakeTimers();
  vi.setSystemTime(typeof date === 'string' ? new Date(date) : date);
}

export function restoreTime() {
  vi.useRealTimers();
}

// Cleanup
afterEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
  restoreTime();
});
```

### Shopify API Mocks

```typescript
// tests/mocks/shopify.ts
import { vi } from 'vitest';

export const mockShopifyClient = {
  products: {
    list: vi.fn().mockResolvedValue([
      { id: 'prod_1', title: 'Test Product', status: 'active' },
    ]),
    get: vi.fn().mockResolvedValue({
      id: 'prod_1',
      title: 'Test Product',
      status: 'active',
    }),
    update: vi.fn().mockResolvedValue({ id: 'prod_1', status: 'draft' }),
  },

  inventory: {
    levels: vi.fn().mockResolvedValue([
      { inventory_item_id: 'inv_1', available: 5 },
    ]),
    set: vi.fn().mockResolvedValue({ inventory_item_id: 'inv_1', available: 10 }),
  },

  priceRules: {
    create: vi.fn().mockResolvedValue({ id: 'rule_1' }),
    delete: vi.fn().mockResolvedValue({ deleted: true }),
  },

  discountCodes: {
    create: vi.fn().mockResolvedValue({ id: 'code_1', code: 'TEST10' }),
  },
};

export function mockShopifyRateLimit() {
  mockShopifyClient.products.list.mockRejectedValueOnce(
    new Error('Exceeded 2 calls per second')
  );
}
```

---

## Writing New Tests

### Checklist for New Tests

1. **Unit Tests:**
   - [ ] Test happy path
   - [ ] Test edge cases (empty inputs, max values, etc.)
   - [ ] Test error conditions
   - [ ] Test determinism (same input = same output)
   - [ ] Mock all external dependencies

2. **Integration Tests:**
   - [ ] Test component interactions
   - [ ] Test database operations
   - [ ] Test with realistic data
   - [ ] Clean up test data after test

3. **E2E Tests:**
   - [ ] Test complete user flow
   - [ ] Add appropriate waits for async operations
   - [ ] Use data-testid attributes for selectors
   - [ ] Include visual verification where needed

### Test Template

```typescript
// tests/unit/feature/my-feature.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myFunction } from '@/server/feature/my-feature';
import { createTestData } from '@/tests/setup';

describe('My Feature', () => {
  describe('myFunction', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle happy path', () => {
      // Arrange
      const input = createTestData({ property: 'value' });

      // Act
      const result = myFunction(input);

      // Assert
      expect(result).toEqual({ expected: 'output' });
    });

    it('should handle edge case: empty input', () => {
      const result = myFunction({});
      expect(result).toBeNull();
    });

    it('should throw on invalid input', () => {
      expect(() => myFunction(null)).toThrow('Invalid input');
    });
  });
});
```

---

## Code Coverage

### Coverage Targets

From vitest.config.ts:

| Metric | Target |
|--------|--------|
| Lines | 80% |
| Statements | 80% |
| Branches | 75% |
| Functions | 75% |

### Generating Coverage Report

```bash
# Generate coverage
pnpm test:coverage

# View HTML report
open coverage/index.html
```

### Coverage Configuration

```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  reportsDirectory: './coverage',
  exclude: [
    '**/node_modules/**',
    '**/tests/**',
    '**/*.config.{js,ts}',
  ],
  include: [
    'app/**/*.{ts,tsx}',
    'server/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
  ],
  all: true,
  lines: 80,
  statements: 80,
  branches: 75,
  functions: 75,
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install

      - run: pnpm lint
      - run: pnpm typecheck

      - name: Run tests
        run: pnpm test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          PLAYWRIGHT_TEST_BASE_URL: http://localhost:3000

      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Best Practices

### General

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **One assertion per test** - Makes failures easier to diagnose
3. **Descriptive test names** - Should read like documentation
4. **Keep tests independent** - No test should depend on another
5. **Clean up after tests** - Reset state, clear mocks

### Async Testing

```typescript
// Good: Use async/await
it('should fetch data', async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

// Good: Wait for specific conditions in E2E
await expect(page.locator('[data-testid="result"]')).toBeVisible();
```

### Avoiding Flaky Tests

1. **Use proper waits** - Don't use arbitrary `setTimeout`
2. **Mock time-dependent code** - Use `vi.useFakeTimers()`
3. **Isolate external dependencies** - Mock APIs and services
4. **Use unique test data** - Avoid conflicts between tests

### Test Data

1. **Use factories** - `createTestOpportunity()` instead of inline objects
2. **Use realistic values** - Make test data believable
3. **Use constants for IDs** - Makes debugging easier
4. **Clean up after tests** - Remove created data

---

**End of Testing Guide**
