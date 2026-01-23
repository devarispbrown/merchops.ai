# MerchOps Background Workers Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-23
**Audience:** Developers and Operations

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Queue Reference](#queue-reference)
4. [Job Types](#job-types)
5. [Running Workers](#running-workers)
6. [Worker Configuration](#worker-configuration)
7. [Monitoring Workers](#monitoring-workers)
8. [Handling Failed Jobs](#handling-failed-jobs)
9. [Scheduled Jobs](#scheduled-jobs)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

MerchOps uses **BullMQ** backed by **Redis** for background job processing. This architecture ensures:

- **Non-blocking UI**: Heavy operations run asynchronously
- **Reliability**: Jobs persist in Redis and survive restarts
- **Retries**: Failed jobs automatically retry with exponential backoff
- **Observability**: Full logging with correlation IDs across job chains
- **Scalability**: Workers can be scaled horizontally

### Core Principles

1. **Idempotency**: All jobs are designed to be safely retried
2. **Traceability**: Every job carries a correlation ID
3. **Isolation**: Jobs process one workspace at a time
4. **Resilience**: Jobs handle transient failures gracefully

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Application                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Routes    │  │   Actions   │  │  Webhooks   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│                  ┌──────────────┐                               │
│                  │ Queue Client │                               │
│                  └──────┬───────┘                               │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │         Redis         │
              │  ┌─────────────────┐  │
              │  │ shopify-sync    │  │
              │  │ event-compute   │  │
              │  │ opportunity-gen │  │
              │  │ execution       │  │
              │  │ outcome-compute │  │
              │  └─────────────────┘  │
              └───────────┬───────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Worker 1   │  │   Worker 2   │  │   Worker N   │
│              │  │              │  │              │
│ - Process    │  │ - Process    │  │ - Process    │
│ - Log        │  │ - Log        │  │ - Log        │
│ - Retry      │  │ - Retry      │  │ - Retry      │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Components

| Component | Description | Location |
|-----------|-------------|----------|
| Queue Definitions | Queue names and configuration | `apps/web/server/jobs/config.ts` |
| Queue Instances | BullMQ queue objects | `apps/web/server/jobs/queues.ts` |
| Workers | Job processors | `apps/web/server/jobs/workers/*.ts` |
| Job Data Types | TypeScript interfaces | `apps/web/server/jobs/types.ts` |

---

## Queue Reference

MerchOps uses five primary queues:

### Queue Summary

| Queue Name | Purpose | Priority | Retry Attempts |
|------------|---------|----------|----------------|
| `shopify-sync` | Sync data from Shopify API | High | 5 |
| `event-compute` | Compute business events from data | Normal | 3 |
| `opportunity-generate` | Generate opportunities from events | Normal | 3 |
| `execution` | Execute approved actions | Critical | 5 |
| `outcome-compute` | Compute outcomes from executions | Normal | 5 |

### Detailed Queue Specifications

#### shopify-sync

**Purpose:** Synchronize data from Shopify (products, orders, customers, inventory)

```typescript
// Configuration
{
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000, // Start at 2 seconds
  },
  removeOnComplete: { age: 3600, count: 100 },
  removeOnFail: { age: 604800 }, // 7 days
}
```

**Job Types:**
- `initial-sync`: Full data sync on new connection
- `incremental-sync`: Periodic refresh
- `webhook-process`: Process incoming webhook data

---

#### event-compute

**Purpose:** Transform raw Shopify data into business events

```typescript
// Configuration
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: { age: 3600, count: 100 },
  removeOnFail: { age: 604800 },
}
```

**Job Types:**
- `compute-inventory-events`: Inventory threshold detection
- `compute-velocity-events`: Sales velocity analysis
- `compute-customer-events`: Customer inactivity detection

---

#### opportunity-generate

**Purpose:** Create opportunities from computed events

```typescript
// Configuration
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: { age: 3600, count: 100 },
  removeOnFail: { age: 604800 },
}
```

**Job Types:**
- `generate-from-event`: Create opportunity from single event
- `generate-batch`: Batch opportunity generation

---

#### execution

**Purpose:** Execute approved actions against Shopify or other providers

```typescript
// Configuration
{
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 3000, // Start at 3 seconds (rate limit friendly)
  },
  removeOnComplete: { age: 86400, count: 1000 }, // 24 hours
  removeOnFail: { age: 604800 }, // 7 days
}
```

**Job Types:**
- `execute-discount`: Create Shopify discount
- `execute-product-pause`: Update product status
- `execute-email`: Send win-back email

---

#### outcome-compute

**Purpose:** Analyze execution results and compute helped/neutral/hurt

```typescript
// Configuration
{
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: { age: 3600, count: 100 },
  removeOnFail: { age: 604800 },
}
```

**Job Types:**
- `compute-discount-outcome`: Analyze discount performance
- `compute-email-outcome`: Analyze email engagement
- `compute-pause-outcome`: Analyze product pause impact

---

## Job Types

### Shopify Sync Jobs

#### initial-sync

Triggered when a new Shopify store is connected.

```typescript
interface InitialSyncJobData {
  workspaceId: string;
  connectionId: string;
  correlationId: string;
}

// Processing steps:
// 1. Fetch all products (paginated)
// 2. Fetch all inventory levels
// 3. Fetch recent orders (last 90 days)
// 4. Fetch customer data
// 5. Store in ShopifyObjectCache
// 6. Enqueue event-compute jobs
```

**Typical Duration:** 2-15 minutes (depending on store size)

---

#### webhook-process

Process incoming Shopify webhooks.

```typescript
interface WebhookProcessJobData {
  workspaceId: string;
  webhookType: 'orders/create' | 'products/update' | 'inventory_levels/update';
  payload: Record<string, unknown>;
  correlationId: string;
  receivedAt: string;
}

// Processing steps:
// 1. Parse webhook payload
// 2. Update ShopifyObjectCache
// 3. Enqueue event-compute job
```

**Typical Duration:** 100-500ms

---

### Event Compute Jobs

#### compute-inventory-events

Detect inventory threshold crossings.

```typescript
interface ComputeInventoryEventsJobData {
  workspaceId: string;
  productIds?: string[]; // Optional: specific products to check
  correlationId: string;
}

// Events generated:
// - inventory_threshold_crossed
// - product_out_of_stock
// - product_back_in_stock
```

---

#### compute-velocity-events

Detect unusual sales velocity.

```typescript
interface ComputeVelocityEventsJobData {
  workspaceId: string;
  windowDays: number; // Lookback window
  correlationId: string;
}

// Events generated:
// - velocity_spike (> 2x normal rate)
```

---

#### compute-customer-events

Detect customer inactivity.

```typescript
interface ComputeCustomerEventsJobData {
  workspaceId: string;
  inactivityThresholds: number[]; // [30, 60, 90] days
  correlationId: string;
}

// Events generated:
// - customer_inactivity_threshold (at each threshold)
```

---

### Opportunity Generate Jobs

#### generate-from-event

Create an opportunity from a triggering event.

```typescript
interface GenerateFromEventJobData {
  workspaceId: string;
  eventId: string;
  correlationId: string;
}

// Processing steps:
// 1. Load event details
// 2. Determine opportunity type
// 3. Compute priority, why-now, counterfactual
// 4. Generate AI content (with fallback)
// 5. Create opportunity record
// 6. Link to event
```

---

### Execution Jobs

#### execute-discount

Create a discount in Shopify.

```typescript
interface ExecuteDiscountJobData {
  workspaceId: string;
  executionId: string;
  idempotencyKey: string;
  payload: {
    discountCode: string;
    discountPercent: number;
    productIds: string[];
    startsAt: string;
    endsAt: string;
  };
  correlationId: string;
}

// Processing steps:
// 1. Check idempotency (skip if already executed)
// 2. Create price rule in Shopify
// 3. Create discount code in Shopify
// 4. Update execution status
// 5. Enqueue outcome-compute job (delayed)
```

---

#### execute-product-pause

Pause a low-inventory product.

```typescript
interface ExecuteProductPauseJobData {
  workspaceId: string;
  executionId: string;
  idempotencyKey: string;
  payload: {
    productId: string;
    previousStatus: 'active' | 'draft' | 'archived';
  };
  correlationId: string;
}

// Processing steps:
// 1. Check idempotency
// 2. Update product status to 'draft' in Shopify
// 3. Store previous status for rollback
// 4. Update execution status
```

---

#### execute-email

Send a win-back email.

```typescript
interface ExecuteEmailJobData {
  workspaceId: string;
  executionId: string;
  idempotencyKey: string;
  payload: {
    recipientEmail: string;
    subject: string;
    body: string;
    customerId: string;
  };
  correlationId: string;
}

// Processing steps:
// 1. Check idempotency
// 2. Send via email provider (Postmark/SendGrid)
// 3. Store message ID
// 4. Update execution status
// 5. Enqueue outcome-compute job (delayed 7 days)
```

---

### Outcome Compute Jobs

#### compute-discount-outcome

Analyze discount campaign performance.

```typescript
interface ComputeDiscountOutcomeJobData {
  workspaceId: string;
  executionId: string;
  correlationId: string;
  baselinePeriod: {
    start: string;
    end: string;
  };
  measurementPeriod: {
    start: string;
    end: string;
  };
}

// Processing steps:
// 1. Fetch baseline metrics (conversion rate, AOV)
// 2. Fetch measurement period metrics
// 3. Calculate uplift
// 4. Determine outcome (helped/neutral/hurt)
// 5. Store evidence JSON
// 6. Update confidence score
```

---

## Running Workers

### Development Mode

```bash
# Run all workers in development
pnpm run workers

# Run specific worker
pnpm run worker:shopify-sync
pnpm run worker:event-compute
pnpm run worker:opportunity-generate
pnpm run worker:execution
pnpm run worker:outcome-compute
```

### Production Mode

Workers should run as separate processes for reliability:

```bash
# Using process manager (PM2)
pm2 start ecosystem.config.js

# ecosystem.config.js example
module.exports = {
  apps: [
    {
      name: 'worker-shopify-sync',
      script: 'npm',
      args: 'run worker:shopify-sync',
      instances: 2,
      exec_mode: 'cluster',
    },
    {
      name: 'worker-execution',
      script: 'npm',
      args: 'run worker:execution',
      instances: 1, // Single instance for consistency
    },
    // ... other workers
  ],
};
```

### Docker Deployment

```dockerfile
# Dockerfile.worker
FROM node:20-alpine

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

CMD ["pnpm", "run", "workers"]
```

```yaml
# docker-compose.production.yml
services:
  worker-sync:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: pnpm run worker:shopify-sync
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
      - postgres

  worker-execution:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: pnpm run worker:execution
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
      - postgres
```

---

## Worker Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `REDIS_HOST` | Redis host (if not using URL) | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | (none) |
| `REDIS_TLS` | Enable TLS | `false` |
| `WORKER_CONCURRENCY` | Jobs per worker | `5` |

### Concurrency Configuration

```typescript
// apps/web/server/jobs/config.ts
export const defaultWorkerOptions = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  maxStalledCount: 3,
  stalledInterval: 30000, // 30 seconds
};
```

**Recommended Concurrency by Queue:**

| Queue | Recommended | Reason |
|-------|-------------|--------|
| `shopify-sync` | 5 | IO-bound, can parallelize |
| `event-compute` | 10 | CPU-light, fast operations |
| `opportunity-generate` | 5 | May involve AI calls |
| `execution` | 2 | Rate limit sensitive |
| `outcome-compute` | 5 | IO-bound, queries |

---

## Monitoring Workers

### BullMQ Dashboard

Use Bull Board for a web-based monitoring interface:

```bash
# Install Bull Board
pnpm add @bull-board/express @bull-board/api

# Add to your app (development only)
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [
    new BullMQAdapter(shopifySyncQueue),
    new BullMQAdapter(eventComputeQueue),
    new BullMQAdapter(executionQueue),
  ],
  serverAdapter,
});

// Mount at /admin/queues
app.use('/admin/queues', serverAdapter.getRouter());
```

### Redis CLI Monitoring

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# List all queue keys
KEYS bull:*

# Check waiting jobs
LLEN bull:shopify-sync:wait
LLEN bull:execution:wait

# Check active jobs
LLEN bull:shopify-sync:active

# Check completed jobs
LLEN bull:shopify-sync:completed

# Check failed jobs
LLEN bull:shopify-sync:failed

# Get job details
HGET bull:execution:12345 data

# Monitor all commands in real-time
MONITOR
```

### Queue Health Metrics

```typescript
// apps/web/server/jobs/monitoring.ts
import { Queue } from 'bullmq';

export async function getQueueMetrics(queue: Queue) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    name: queue.name,
    waiting,
    active,
    completed,
    failed,
    delayed,
    health: failed > 100 ? 'degraded' : 'healthy',
  };
}
```

### Log Monitoring

Workers log to stdout with structured JSON (pino):

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.000Z",
  "correlationId": "job_abc123",
  "workspaceId": "ws_xyz789",
  "queue": "execution",
  "jobId": "job_12345",
  "status": "completed",
  "duration": 1523,
  "msg": "Job completed successfully"
}
```

---

## Handling Failed Jobs

### Automatic Retry Behavior

Jobs automatically retry with exponential backoff:

```
Attempt 1: Immediate
Attempt 2: +1 second (or configured delay)
Attempt 3: +2 seconds
Attempt 4: +4 seconds
Attempt 5: +8 seconds (then fails permanently)
```

### Viewing Failed Jobs

```bash
# Redis CLI
redis-cli LRANGE bull:execution:failed 0 10

# Programmatically
const failedJobs = await executionQueue.getFailed(0, 100);
for (const job of failedJobs) {
  console.log({
    id: job.id,
    name: job.name,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    data: job.data,
  });
}
```

### Manual Retry

```typescript
// Retry a specific failed job
const job = await executionQueue.getJob('job_12345');
if (job && (await job.isFailed())) {
  await job.retry();
}

// Retry all failed jobs in queue
const failedJobs = await executionQueue.getFailed();
for (const job of failedJobs) {
  await job.retry();
}
```

### Removing Failed Jobs

```typescript
// Remove a specific failed job
const job = await executionQueue.getJob('job_12345');
if (job) {
  await job.remove();
}

// Clean old failed jobs (older than 24 hours)
await executionQueue.clean(24 * 60 * 60 * 1000, 'failed');
```

### Error Classification

Jobs track error codes for better debugging:

| Error Code | Description | Retryable |
|------------|-------------|-----------|
| `TRANSIENT_ERROR` | Temporary network/service issue | Yes |
| `RATE_LIMITED` | API rate limit hit | Yes (with delay) |
| `INVALID_DATA` | Bad job data | No |
| `NOT_FOUND` | Resource not found | No |
| `UNAUTHORIZED` | Auth token invalid/expired | No |
| `PROVIDER_ERROR` | External service error | Maybe |

### Dead Letter Queue Pattern

For jobs that exceed retry limits:

```typescript
// On final failure, move to dead letter queue
executionQueue.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // Move to DLQ for manual review
    await deadLetterQueue.add('failed-execution', {
      originalJobId: job.id,
      originalQueue: 'execution',
      data: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });

    // Alert operations team
    await alertService.notify({
      level: 'error',
      message: `Execution job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`,
      context: { workspaceId: job.data.workspaceId },
    });
  }
});
```

---

## Scheduled Jobs

### Scheduler Configuration

```typescript
// apps/web/server/jobs/config.ts
export const SCHEDULER_CONFIG = {
  // Check for decayed opportunities every hour
  DECAY_CHECK: {
    pattern: '0 * * * *', // Every hour at minute 0
    jobName: 'decay-check',
  },
  // Compute outcomes daily at 2 AM
  OUTCOME_COMPUTE: {
    pattern: '0 2 * * *', // Daily at 2 AM
    jobName: 'daily-outcome-compute',
  },
  // Refresh data every 6 hours
  DATA_SYNC: {
    pattern: '0 */6 * * *', // Every 6 hours
    jobName: 'data-sync-refresh',
  },
};
```

### Setting Up Schedulers

```typescript
// apps/web/server/jobs/scheduler.ts
import { Queue, QueueScheduler } from 'bullmq';
import { SCHEDULER_CONFIG, redisConnection } from './config';

// QueueScheduler is required for delayed jobs and retries
export function setupSchedulers() {
  // Decay check scheduler
  const decayScheduler = new QueueScheduler('opportunity-generate', {
    connection: redisConnection,
  });

  // Add repeatable job
  opportunityGenerateQueue.add(
    SCHEDULER_CONFIG.DECAY_CHECK.jobName,
    { type: 'decay-check' },
    {
      repeat: {
        pattern: SCHEDULER_CONFIG.DECAY_CHECK.pattern,
      },
    }
  );

  // Outcome computation scheduler
  outcomeComputeQueue.add(
    SCHEDULER_CONFIG.OUTCOME_COMPUTE.jobName,
    { type: 'batch-compute' },
    {
      repeat: {
        pattern: SCHEDULER_CONFIG.OUTCOME_COMPUTE.pattern,
      },
    }
  );

  return { decayScheduler };
}
```

### Managing Repeatable Jobs

```typescript
// List all repeatable jobs
const repeatableJobs = await queue.getRepeatableJobs();
console.log(repeatableJobs);

// Remove a repeatable job
await queue.removeRepeatableByKey(repeatableJobs[0].key);

// Pause repeatable jobs
await queue.pause();

// Resume repeatable jobs
await queue.resume();
```

---

## Best Practices

### 1. Always Use Idempotency Keys

```typescript
// Good: Deterministic idempotency key
const idempotencyKey = `exec:${actionDraftId}:${approvedAt.getTime()}`;

// Bad: Random or time-based key
const idempotencyKey = `exec:${uuid()}`;
```

### 2. Carry Correlation IDs

```typescript
// Always pass correlationId through job chains
await eventComputeQueue.add('compute', {
  workspaceId,
  correlationId: request.correlationId, // From original request
});
```

### 3. Handle Rate Limits Gracefully

```typescript
// Check for rate limit headers
if (response.headers['x-shopify-shop-api-call-limit']) {
  const [used, limit] = response.headers['x-shopify-shop-api-call-limit'].split('/');
  if (parseInt(used) / parseInt(limit) > 0.8) {
    // Delay next job
    await delay(1000);
  }
}
```

### 4. Log Comprehensively

```typescript
logger.info({
  correlationId: job.data.correlationId,
  workspaceId: job.data.workspaceId,
  jobId: job.id,
  jobName: job.name,
  attempt: job.attemptsMade,
}, 'Starting job processing');

// ... process job

logger.info({
  correlationId: job.data.correlationId,
  jobId: job.id,
  duration: Date.now() - startTime,
}, 'Job completed successfully');
```

### 5. Validate Job Data

```typescript
// Use Zod to validate job data
const ExecuteDiscountJobSchema = z.object({
  workspaceId: z.string().uuid(),
  executionId: z.string().uuid(),
  idempotencyKey: z.string(),
  payload: DiscountPayloadSchema,
  correlationId: z.string(),
});

// In worker
const parseResult = ExecuteDiscountJobSchema.safeParse(job.data);
if (!parseResult.success) {
  throw new Error(`Invalid job data: ${parseResult.error.message}`);
}
```

### 6. Use Appropriate Job Priorities

```typescript
// Critical execution jobs get higher priority
await executionQueue.add('execute-discount', data, {
  priority: JOB_PRIORITIES.CRITICAL, // 10
});

// Background sync jobs get lower priority
await shopifySyncQueue.add('incremental-sync', data, {
  priority: JOB_PRIORITIES.LOW, // -5
});
```

---

## Troubleshooting

### Jobs Stuck in Active State

**Symptoms:** Jobs remain "active" but nothing is processing

**Causes:**
- Worker crashed mid-processing
- Worker scaled down while jobs active
- Stalled job detection not working

**Solutions:**
```bash
# Check for stalled jobs
redis-cli LRANGE bull:execution:stalled 0 -1

# Move stalled jobs back to waiting
# (Worker does this automatically via stalledInterval)

# Or manually fix
redis-cli
> LPUSH bull:execution:wait "job_id"
> LREM bull:execution:active 1 "job_id"
```

---

### Jobs Not Being Picked Up

**Symptoms:** Jobs in waiting queue but not processing

**Causes:**
- No workers running
- Workers not connected to Redis
- Queue paused

**Solutions:**
```bash
# Check if workers are running
ps aux | grep worker

# Check Redis connection
redis-cli -u $REDIS_URL ping

# Check if queue is paused
redis-cli GET bull:execution:meta:paused

# Resume if paused
node -e "require('./server/jobs/queues').executionQueue.resume()"
```

---

### High Memory Usage in Redis

**Symptoms:** Redis memory growing, jobs not cleaning up

**Causes:**
- Jobs not being removed after completion
- Large job payloads
- Too many failed jobs retained

**Solutions:**
```bash
# Check memory usage
redis-cli INFO memory

# Clean old completed jobs
node -e "require('./server/jobs/queues').cleanAllQueues(3600000)"

# Check largest keys
redis-cli --bigkeys
```

---

### Job Processing Slow

**Symptoms:** Jobs taking longer than expected

**Causes:**
- Database queries slow
- External API latency
- Worker concurrency too low

**Solutions:**
```bash
# Check job processing times
redis-cli HGET bull:execution:12345 processedOn

# Increase concurrency
WORKER_CONCURRENCY=10 pnpm run workers

# Profile slow queries
# Enable Prisma query logging
```

---

### Worker Crashes on Startup

**Symptoms:** Worker process exits immediately

**Causes:**
- Redis connection failure
- Missing environment variables
- Code errors

**Solutions:**
```bash
# Check Redis connection
redis-cli -u $REDIS_URL ping

# Verify environment
env | grep REDIS

# Run with verbose logging
LOG_LEVEL=debug pnpm run workers
```

---

## Reference

### Job Priority Values

```typescript
export const JOB_PRIORITIES = {
  CRITICAL: 10,  // Execution jobs
  HIGH: 5,       // Sync jobs
  NORMAL: 1,     // Default
  LOW: -5,       // Background cleanup
};
```

### Queue Utility Functions

```typescript
// apps/web/server/jobs/queues.ts

// Get all queues
export function getAllQueues(): Queue[]

// Close all queues gracefully
export async function closeAllQueues(): Promise<void>

// Pause all queues
export async function pauseAllQueues(): Promise<void>

// Resume all queues
export async function resumeAllQueues(): Promise<void>

// Clean old jobs from all queues
export async function cleanAllQueues(grace?: number): Promise<void>
```

---

**End of Background Workers Guide**
