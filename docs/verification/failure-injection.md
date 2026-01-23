# MerchOps Failure Injection Testing Guide

> Reference: [CLAUDE.md](/CLAUDE.md) - Performance and Reliability
> Last Updated: 2026-01-23
> Purpose: Document resilience testing procedures and expected behaviors

This document defines how to test system resilience through controlled failure injection. Each failure mode includes setup instructions, expected behavior, and verification criteria.

---

## Overview

MerchOps must handle failures gracefully per the product guardrails:
- **Calm over clever**: Failures should not cause user panic
- **Control over automation**: Failures must not trigger unintended actions
- **Explainability over opacity**: Failures must surface clear, actionable errors

### Failure Categories

| Category | Impact | Recovery Priority |
|----------|--------|-------------------|
| Infrastructure | Service unavailability | High |
| External API | Degraded functionality | Medium |
| Data Integrity | Potential corruption | Critical |
| Security | Access/auth issues | Critical |

---

## 1. Redis Connection Failure

### Scenario
BullMQ job queue loses connection to Redis.

### Setup
```bash
# Option A: Stop Redis container
docker stop merchops-redis

# Option B: Block Redis port
sudo iptables -A INPUT -p tcp --dport 6379 -j DROP

# Option C: In test environment
# Use mock that throws ECONNREFUSED
```

### Test Code
```typescript
// tests/integration/resilience/redis-failure.test.ts
describe('Redis Connection Failure', () => {
  beforeEach(async () => {
    await mockRedis.disconnect();
  });

  it('queues jobs to fallback when Redis unavailable', async () => {
    const result = await jobQueue.enqueue('process-webhook', payload);
    expect(result.status).toBe('queued-fallback');
  });

  it('does not lose jobs during Redis outage', async () => {
    const jobsBefore = await countPendingJobs();
    await mockRedis.disconnect();
    await enqueueJob('test-job', {});
    await mockRedis.reconnect();
    const jobsAfter = await countPendingJobs();
    expect(jobsAfter).toBe(jobsBefore + 1);
  });

  it('UI remains responsive during Redis outage', async () => {
    await mockRedis.disconnect();
    const response = await fetch('/api/opportunities');
    expect(response.status).toBe(200); // Serves from DB, not cache
  });
});
```

### Expected Behavior

| Component | Expected Behavior | Verified |
|-----------|-------------------|----------|
| Job Queue | Jobs written to fallback store (DB) | `[ ]` |
| Background Workers | Pause processing, no crashes | `[ ]` |
| UI | Remains responsive, shows degraded indicator | `[ ]` |
| New Webhooks | Accepted and persisted for later processing | `[ ]` |
| Approvals | Blocked with clear error message | `[ ]` |

### Recovery Behavior

| Condition | Expected Behavior | Verified |
|-----------|-------------------|----------|
| Redis reconnects | Fallback jobs migrate to Redis queue | `[ ]` |
| Jobs resume | Process in order, no duplicates | `[ ]` |
| No data loss | All queued jobs eventually process | `[ ]` |

### User-Facing Message
```
Background processing is temporarily unavailable. Your actions have been saved
and will be processed when the system recovers. No data has been lost.
```

---

## 2. Shopify API Timeout

### Scenario
Shopify API requests exceed timeout threshold (30s default).

### Setup
```typescript
// Mock Shopify client with delayed responses
const mockShopifyClient = {
  async request(endpoint: string) {
    await sleep(35000); // 35 second delay
    return { data: {} };
  }
};

// Or use network simulation
// tc qdisc add dev eth0 root netem delay 35000ms
```

### Test Code
```typescript
// tests/integration/resilience/shopify-timeout.test.ts
describe('Shopify API Timeout', () => {
  it('times out gracefully after 30 seconds', async () => {
    mockShopify.setLatency(35000);

    const result = await shopifyClient.getProducts();

    expect(result.error).toBe('TIMEOUT');
    expect(result.retryAfter).toBeDefined();
  });

  it('does not block execution queue during timeout', async () => {
    mockShopify.setLatency(35000);

    const execution1 = executeAction(action1); // Will timeout
    const execution2 = executeAction(action2); // Should not wait

    const result2 = await Promise.race([
      execution2,
      sleep(5000).then(() => 'blocked')
    ]);

    expect(result2).not.toBe('blocked');
  });

  it('marks execution as failed after timeout', async () => {
    mockShopify.setLatency(35000);

    await executeAction(action);

    const execution = await db.executions.findFirst({
      where: { actionId: action.id }
    });
    expect(execution.status).toBe('failed');
    expect(execution.errorCode).toBe('SHOPIFY_TIMEOUT');
  });
});
```

### Expected Behavior

| Component | Expected Behavior | Verified |
|-----------|-------------------|----------|
| API Call | Aborted after 30s timeout | `[ ]` |
| Execution Record | Marked as failed with SHOPIFY_TIMEOUT | `[ ]` |
| Retry Logic | Scheduled for retry with backoff | `[ ]` |
| Other Executions | Not blocked by timeout | `[ ]` |
| UI | Shows "pending" then "failed" with retry option | `[ ]` |

### Retry Schedule
| Attempt | Delay | Max Attempts |
|---------|-------|--------------|
| 1 | 30s | |
| 2 | 60s | |
| 3 | 120s | |
| 4 | 300s | |
| 5 | 600s | 5 (then hard fail) |

### User-Facing Message
```
Action could not be completed - Shopify is not responding.
We'll automatically retry in [X minutes]. You can also retry manually.
```

---

## 3. Shopify Rate Limiting

### Scenario
Shopify returns 429 Too Many Requests response.

### Setup
```typescript
// Mock rate limit response
const mockShopifyRateLimit = {
  status: 429,
  headers: {
    'Retry-After': '2.0',
    'X-Shopify-Shop-Api-Call-Limit': '40/40'
  },
  body: {
    errors: 'Throttled'
  }
};
```

### Test Code
```typescript
// tests/integration/resilience/shopify-rate-limit.test.ts
describe('Shopify Rate Limiting', () => {
  it('respects Retry-After header', async () => {
    mockShopify.setRateLimited(true, 2.0);

    const start = Date.now();
    await shopifyClient.getProducts();
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(2000);
  });

  it('implements request bucket tracking', async () => {
    // Simulate approaching limit
    mockShopify.setCallLimit('39/40');

    const canMakeCall = await rateLimiter.canMakeCall();
    expect(canMakeCall).toBe(true);

    mockShopify.setCallLimit('40/40');
    const canMakeCallAtLimit = await rateLimiter.canMakeCall();
    expect(canMakeCallAtLimit).toBe(false);
  });

  it('queues requests when rate limited', async () => {
    mockShopify.setRateLimited(true, 5.0);

    const requests = [
      shopifyClient.getProducts(),
      shopifyClient.getOrders(),
      shopifyClient.getInventory()
    ];

    // All should eventually complete
    const results = await Promise.all(requests);
    expect(results.every(r => r.success)).toBe(true);
  });

  it('prioritizes user-initiated requests', async () => {
    mockShopify.setCallLimit('39/40');

    // Background sync should defer
    const backgroundResult = await shopifyClient.syncProducts({
      priority: 'background'
    });
    expect(backgroundResult.deferred).toBe(true);

    // User approval should proceed
    const userResult = await shopifyClient.createDiscount({
      priority: 'user-initiated'
    });
    expect(userResult.success).toBe(true);
  });
});
```

### Expected Behavior

| Component | Expected Behavior | Verified |
|-----------|-------------------|----------|
| Rate Limiter | Tracks X-Shopify-Shop-Api-Call-Limit | `[ ]` |
| Background Jobs | Pause when approaching limit | `[ ]` |
| User Actions | Prioritized over background sync | `[ ]` |
| Retry Logic | Respects Retry-After header exactly | `[ ]` |
| Request Queue | FIFO with priority lanes | `[ ]` |

### Rate Limit Strategy
```
Shopify Limit: 40 calls / app / store

Budget Allocation:
- User Actions: 20 calls reserved
- Background Sync: 15 calls
- Buffer: 5 calls

When at 35/40:
- Pause background sync
- Allow user actions only

When at 40/40:
- Queue all requests
- Wait for Retry-After
```

### User-Facing Message
```
Shopify is temporarily limiting requests. Your action has been queued
and will complete in approximately [X seconds].
```

---

## 4. Database Connection Loss

### Scenario
PostgreSQL database becomes unreachable.

### Setup
```bash
# Option A: Stop Postgres
docker stop merchops-postgres

# Option B: Block port
sudo iptables -A INPUT -p tcp --dport 5432 -j DROP

# Option C: Prisma mock
mockPrisma.$disconnect();
```

### Test Code
```typescript
// tests/integration/resilience/database-failure.test.ts
describe('Database Connection Loss', () => {
  it('returns 503 for API requests', async () => {
    await mockDb.disconnect();

    const response = await fetch('/api/opportunities');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database temporarily unavailable',
      retryAfter: 30
    });
  });

  it('prevents new executions during outage', async () => {
    await mockDb.disconnect();

    const result = await approveAction(actionId);

    expect(result.error).toBe('DATABASE_UNAVAILABLE');
    expect(result.actionTaken).toBe(false);
  });

  it('preserves in-flight execution state', async () => {
    // Start execution
    const execution = await startExecution(actionId);

    // DB goes down mid-execution
    await mockDb.disconnect();

    // Execution should be marked as interrupted
    await mockDb.reconnect();
    const state = await getExecutionState(execution.id);

    expect(state.status).toBeOneOf(['interrupted', 'pending_retry']);
  });

  it('health check reports database status', async () => {
    await mockDb.disconnect();

    const health = await fetch('/api/health');
    const body = await health.json();

    expect(body.database).toBe('unhealthy');
    expect(body.status).toBe('degraded');
  });
});
```

### Expected Behavior

| Component | Expected Behavior | Verified |
|-----------|-------------------|----------|
| API Routes | Return 503 Service Unavailable | `[ ]` |
| UI | Show maintenance/retry message | `[ ]` |
| Background Jobs | Pause, do not crash | `[ ]` |
| Webhooks | Return 503 (Shopify will retry) | `[ ]` |
| Executions | No new executions allowed | `[ ]` |
| Health Check | Report degraded status | `[ ]` |

### Critical Invariant
```
NO EXECUTION MAY PROCEED WITHOUT DATABASE WRITE CONFIRMATION
```

### Recovery Behavior

| Step | Action | Verified |
|------|--------|----------|
| 1 | Connection pool attempts reconnect | `[ ]` |
| 2 | Health check returns healthy | `[ ]` |
| 3 | Background jobs resume | `[ ]` |
| 4 | Interrupted executions retry | `[ ]` |
| 5 | Webhook backlog processes | `[ ]` |

### User-Facing Message
```
MerchOps is experiencing a temporary issue. Your data is safe.
Please try again in a few moments.
```

---

## 5. Webhook Replay Attacks

### Scenario
Malicious actor replays previously valid webhook payloads.

### Setup
```typescript
// Capture valid webhook
const validWebhook = {
  headers: capturedHeaders,
  body: capturedBody,
  signature: capturedHmac
};

// Replay after time window
await sleep(310000); // 5+ minutes
await sendWebhook(validWebhook);
```

### Test Code
```typescript
// tests/integration/security/webhook-replay.test.ts
describe('Webhook Replay Attack Prevention', () => {
  it('rejects webhooks with old timestamps', async () => {
    const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const webhook = createWebhook({ timestamp: oldTimestamp });

    const result = await processWebhook(webhook);

    expect(result.rejected).toBe(true);
    expect(result.reason).toBe('TIMESTAMP_EXPIRED');
  });

  it('rejects duplicate webhook IDs', async () => {
    const webhook = createWebhook({ id: 'webhook-123' });

    // First submission succeeds
    const first = await processWebhook(webhook);
    expect(first.processed).toBe(true);

    // Replay rejected
    const replay = await processWebhook(webhook);
    expect(replay.rejected).toBe(true);
    expect(replay.reason).toBe('DUPLICATE_WEBHOOK');
  });

  it('rejects webhooks with invalid HMAC', async () => {
    const webhook = createWebhook();
    webhook.signature = 'tampered-signature';

    const result = await processWebhook(webhook);

    expect(result.rejected).toBe(true);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('logs security events for rejected webhooks', async () => {
    const webhook = createWebhook({ id: 'replay-attempt-456' });
    await processWebhook(webhook); // First
    await processWebhook(webhook); // Replay

    const securityLog = await getSecurityLogs({
      type: 'WEBHOOK_REPLAY_ATTEMPT'
    });
    expect(securityLog).toContainEvent({
      webhookId: 'replay-attempt-456',
      severity: 'warning'
    });
  });
});
```

### Expected Behavior

| Attack Vector | Defense | Verified |
|--------------|---------|----------|
| Old timestamp (> 5 min) | Reject with TIMESTAMP_EXPIRED | `[ ]` |
| Duplicate webhook ID | Reject with DUPLICATE_WEBHOOK | `[ ]` |
| Invalid HMAC signature | Reject with INVALID_SIGNATURE | `[ ]` |
| Modified payload | HMAC verification fails | `[ ]` |
| Missing headers | Reject with MISSING_HEADERS | `[ ]` |

### Webhook Validation Flow
```
1. Check X-Shopify-Webhook-Id not in processed set
2. Check X-Shopify-Hmac-Sha256 matches computed HMAC
3. Check timestamp within 5-minute window
4. Add webhook ID to processed set (TTL: 24 hours)
5. Process webhook
```

### Security Logging
All rejected webhooks must be logged with:
- Timestamp
- Source IP
- Rejection reason
- Webhook ID (if present)
- Partial payload hash

---

## 6. Double-Submission of Approvals

### Scenario
User double-clicks approve button, or network issues cause duplicate requests.

### Setup
```typescript
// Simulate rapid double-click
const approval1 = approveAction(actionId);
const approval2 = approveAction(actionId);

// Both fire before first completes
await Promise.all([approval1, approval2]);
```

### Test Code
```typescript
// tests/integration/resilience/double-approval.test.ts
describe('Double-Submission Prevention', () => {
  it('only creates one execution for rapid approvals', async () => {
    const actionId = 'action-123';

    // Simulate double-click
    const results = await Promise.all([
      approveAction(actionId),
      approveAction(actionId)
    ]);

    // One succeeds, one rejected
    const successes = results.filter(r => r.success);
    const rejections = results.filter(r => r.rejected);

    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);
    expect(rejections[0].reason).toBe('APPROVAL_IN_PROGRESS');
  });

  it('uses idempotency key from client', async () => {
    const idempotencyKey = 'user-session-123-action-456-approval';

    const result1 = await approveAction(actionId, { idempotencyKey });
    const result2 = await approveAction(actionId, { idempotencyKey });

    expect(result1.executionId).toBe(result2.executionId);
  });

  it('returns existing result for duplicate request', async () => {
    const idempotencyKey = 'idem-key-789';

    const result1 = await approveAction(actionId, { idempotencyKey });
    // Simulate network retry
    const result2 = await approveAction(actionId, { idempotencyKey });

    expect(result2.fromCache).toBe(true);
    expect(result2.executionId).toBe(result1.executionId);
  });

  it('UI disables button after first click', async () => {
    const page = await browser.newPage();
    await page.goto('/opportunities/123');

    const approveButton = await page.$('[data-testid="approve-button"]');
    await approveButton.click();

    // Button should be disabled
    const isDisabled = await approveButton.getAttribute('disabled');
    expect(isDisabled).toBe('true');

    // Shows loading state
    const buttonText = await approveButton.textContent();
    expect(buttonText).toContain('Approving');
  });
});
```

### Expected Behavior

| Layer | Defense | Verified |
|-------|---------|----------|
| UI | Button disabled after click | `[ ]` |
| API | Idempotency key check | `[ ]` |
| Database | Unique constraint on execution per action | `[ ]` |
| Response | Return cached result for duplicates | `[ ]` |

### Idempotency Implementation
```typescript
// Server-side idempotency
async function approveAction(actionId: string, options: ApprovalOptions) {
  const idempotencyKey = options.idempotencyKey ||
    `${session.id}-${actionId}-${Date.now()}`;

  // Check for existing execution with this key
  const existing = await db.executions.findFirst({
    where: { idempotencyKey }
  });

  if (existing) {
    return {
      success: true,
      executionId: existing.id,
      fromCache: true
    };
  }

  // Acquire lock (Redis or DB advisory lock)
  const lock = await acquireLock(`approval:${actionId}`, { ttl: 30000 });
  if (!lock) {
    return {
      rejected: true,
      reason: 'APPROVAL_IN_PROGRESS'
    };
  }

  try {
    // Create execution
    const execution = await db.executions.create({
      data: { actionDraftId: actionId, idempotencyKey, status: 'pending' }
    });
    return { success: true, executionId: execution.id };
  } finally {
    await releaseLock(lock);
  }
}
```

### User-Facing Behavior
- Button shows "Approving..." immediately
- Duplicate clicks show "Already processing"
- Network retries return same result
- No duplicate Shopify API calls

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Test environment isolated from production
- [ ] Mock services configured
- [ ] Database seeded with test data
- [ ] Logging enabled for failure capture

### Test Execution Order
1. [ ] Database Connection Loss (most critical)
2. [ ] Double-Submission Prevention (data integrity)
3. [ ] Webhook Replay Attacks (security)
4. [ ] Redis Connection Failure (infrastructure)
5. [ ] Shopify API Timeout (external dependency)
6. [ ] Shopify Rate Limiting (external dependency)

### Post-Test Verification
- [ ] All expected behaviors verified
- [ ] No data corruption detected
- [ ] All error messages user-friendly
- [ ] Logs contain sufficient diagnostic info
- [ ] Recovery procedures tested

---

## Automated Chaos Testing

### Integration with CI
```yaml
# .github/workflows/chaos-tests.yml
name: Chaos Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Nightly
  workflow_dispatch:

jobs:
  chaos:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup test environment
        run: docker-compose -f docker-compose.test.yml up -d
      - name: Run failure injection tests
        run: pnpm test:chaos
      - name: Upload failure reports
        uses: actions/upload-artifact@v4
        with:
          name: chaos-test-results
          path: ./test-results/chaos/
```

### Test Commands
```bash
# Run all failure injection tests
pnpm test:chaos

# Run specific failure scenarios
pnpm test:chaos --grep "redis"
pnpm test:chaos --grep "shopify"
pnpm test:chaos --grep "database"
pnpm test:chaos --grep "security"
```

---

## Incident Response Mapping

| Failure Mode | Detection | Response | Recovery Time Target |
|--------------|-----------|----------|---------------------|
| Redis down | Health check + alerts | Auto-failover to fallback | < 5 min |
| Shopify timeout | Error rate spike | Increase timeout, notify user | Immediate degraded mode |
| Shopify rate limit | 429 responses | Automatic backoff | Self-healing |
| Database down | Health check + alerts | Failover to replica | < 2 min |
| Webhook replay | Security log alerts | Block source IP if repeated | Immediate |
| Double-submit | None (prevented) | N/A | N/A |
