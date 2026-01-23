# MerchOps Background Job System

Complete BullMQ-based job processing system with Redis persistence, idempotent execution, and comprehensive observability.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Queues    │────▶│   Workers    │────▶│  Processors │
└─────────────┘     └──────────────┘     └─────────────┘
      │                    │                     │
      └────────────────────┴─────────────────────┘
                          │
                    ┌─────▼──────┐
                    │   Redis    │
                    └────────────┘
```

## Job Queues

### 1. Shopify Sync Queue
**Purpose**: Initial data sync and periodic refresh from Shopify API

**Jobs**:
- Initial sync on workspace connection
- Incremental sync every 6 hours
- Manual refresh triggered by user

**Configuration**:
- Retries: 5 attempts
- Backoff: Exponential (2s, 4s, 8s...)
- Priority: Normal to High

### 2. Event Compute Queue
**Purpose**: Compute business events from raw Shopify data

**Events Generated**:
- Inventory threshold crossed
- Product out of stock
- Product back in stock
- Velocity spike on products
- Customer inactivity (30/60/90 days)

**Configuration**:
- Retries: 3 attempts
- Backoff: Exponential (1s, 2s, 4s)
- Priority: High after sync

### 3. Opportunity Generate Queue
**Purpose**: Generate opportunities from computed events

**Opportunity Types**:
- Inventory risk discount
- Product pause recommendation
- Win-back email (30/60/90 day)
- Margin protection

**Configuration**:
- Retries: 3 attempts
- Backoff: Exponential (1s, 2s, 4s)
- Priority: Normal

### 4. Execution Queue
**Purpose**: Execute approved actions

**Execution Types**:
- Shopify discount creation
- Win-back email send
- Product status pause

**Configuration**:
- Retries: 5 attempts (critical)
- Backoff: Exponential (3s, 6s, 12s...)
- Priority: Critical
- Idempotency: Required

### 5. Outcome Compute Queue
**Purpose**: Compute helped/neutral/hurt outcomes

**Metrics Analyzed**:
- Discount: Conversion rate, revenue uplift
- Email: Open rate, click rate, conversion
- Product pause: Stockout prevention

**Configuration**:
- Retries: 5 attempts
- Backoff: Exponential (1s, 2s, 4s)
- Priority: Normal

## Scheduled Jobs

### Decay Check
**Frequency**: Every hour (0 * * * *)
**Purpose**: Mark expired opportunities as decayed
**Queue**: Opportunity Generate

### Outcome Computation
**Frequency**: Daily at 2 AM (0 2 * * *)
**Purpose**: Compute outcomes for completed executions
**Queue**: Outcome Compute

### Data Sync Refresh
**Frequency**: Every 6 hours (0 */6 * * *)
**Purpose**: Refresh Shopify data for all workspaces
**Queue**: Shopify Sync

## Job Flow

```
┌─────────────────┐
│  Shopify Sync   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Event Compute   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Opportunity Gen  │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Approve │ (User action)
    └────┬────┘
         │
         ▼
┌─────────────────┐
│   Execution     │
└────────┬────────┘
         │
         ▼ (24h+ later)
┌─────────────────┐
│Outcome Compute  │
└─────────────────┘
```

## Observability

### Correlation IDs
Every job carries a correlation ID that propagates through the entire chain:
- API Request → Job → Sub-jobs → Executions
- Enables distributed tracing
- Automatic injection via `injectCorrelationIntoJobData()`

### Logging
Structured logging with Pino:
- Job start/complete/failed
- Correlation context injected automatically
- Log levels by environment (debug in dev, info in prod)
- Job duration tracking

### Metrics
Basic counters and histograms:
- `jobs_processed_total{job, status}`
- `jobs_failed_total{job, error}`
- `job_duration_ms{job}`
- `executions_total{action, status}`
- `opportunities_generated_total{type, priority}`
- `outcomes_computed_total{outcome}`

### Error Tracking
Sentry integration:
- Exception capture with context
- Job-specific error fingerprinting
- Workspace and user context
- PII filtering

## Usage

### Starting the Job System

```typescript
import { startJobSystem, stopJobSystem } from './server/jobs';

// Start all workers and scheduler
await startJobSystem();

// Graceful shutdown
await stopJobSystem();
```

### Enqueueing Jobs

```typescript
import { shopifySyncQueue } from './server/jobs/queues';
import { injectCorrelationIntoJobData } from './lib/correlation';

// Enqueue a job
await shopifySyncQueue.add(
  'initial-sync',
  injectCorrelationIntoJobData({
    workspaceId: 'ws_123',
    syncType: 'initial',
  }),
  {
    priority: 10, // High priority
  }
);
```

### Using the Generic Enqueue Helper

```typescript
import { enqueueJob } from './server/jobs/queues';
import { QUEUE_NAMES } from './server/jobs/config';

// Enqueue to any queue
const { id, name } = await enqueueJob(
  QUEUE_NAMES.EXECUTION,
  {
    workspaceId: 'ws_123',
    actionDraftId: 'draft_456',
    executionType: 'discount',
    payload: { code: 'SAVE20', amount: 20 },
    idempotencyKey: 'exec-unique-key',
    approvedBy: 'user_789',
  }
);
```

## Idempotency

### Execution Jobs
All execution jobs MUST include an idempotency key:
```typescript
{
  idempotencyKey: `exec-${actionDraftId}-${timestamp}`
}
```

The processor checks if an execution with the same idempotency key exists before executing.

### Event Deduplication
Events use dedupe keys to prevent duplicates:
```typescript
{
  dedupeKey: `${eventType}-${resourceId}-${windowStart}`
}
```

## Resilience

### Redis Restart
- Workers reconnect automatically
- In-flight jobs are marked as stalled and retried
- No data loss for persisted jobs

### Worker Restart
- Jobs remain in queue
- Next available worker picks up jobs
- Stalled job detection (30s interval)

### Error Handling
- Automatic retries with exponential backoff
- Failed jobs kept for 7 days for debugging
- Error classification (timeout, network, auth, etc.)

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
REDIS_TLS=true

# Worker settings
WORKER_CONCURRENCY=5

# Logging
LOG_LEVEL=info
NODE_ENV=production

# Sentry
SENTRY_DSN=https://...
SENTRY_ENVIRONMENT=production
```

### Queue-Specific Options

Edit `/apps/web/server/jobs/config.ts`:

```typescript
export const queueJobOptions: Record<QueueName, Partial<JobsOptions>> = {
  [QUEUE_NAMES.EXECUTION]: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
};
```

## Monitoring

### Health Check

```typescript
import { getJobSystemHealth } from './server/jobs';

const health = await getJobSystemHealth();
// {
//   healthy: true,
//   workers: [
//     { name: 'shopify-sync', running: true, isPaused: false },
//     ...
//   ]
// }
```

### Scheduler Health

```typescript
import { getSchedulerHealth } from './server/jobs/scheduler';

const schedulerHealth = await getSchedulerHealth();
// {
//   healthy: true,
//   scheduledJobsCount: 3,
//   jobs: [
//     {
//       name: 'decay-check',
//       pattern: '0 * * * *',
//       exists: true,
//       isPaused: false,
//       nextRun: '2024-01-23T15:00:00Z'
//     },
//     ...
//   ]
// }
```

### Queue Management

```typescript
import {
  pauseAllQueues,
  resumeAllQueues,
  cleanAllQueues,
} from './server/jobs/queues';

// Pause all queues (maintenance mode)
await pauseAllQueues();

// Resume all queues
await resumeAllQueues();

// Clean old jobs (completed > 1 hour, failed > 24 hours)
await cleanAllQueues(3600000);
```

## Development

### Running Workers Locally

```bash
# Start Redis (Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Start workers
npm run jobs:start
```

### Testing Job Processing

```typescript
import { processShopifySync } from './server/jobs/processors/shopify-sync.processor';
import { Job } from 'bullmq';

// Create mock job
const mockJob = {
  id: 'test-job-1',
  data: {
    workspaceId: 'ws_test',
    syncType: 'initial',
  },
} as Job;

// Test processor directly
const result = await processShopifySync(mockJob);
```

### Debugging

Enable debug logs:
```bash
LOG_LEVEL=debug npm run jobs:start
```

## Production Deployment

### Horizontal Scaling
- Run multiple worker processes
- Each process handles concurrent jobs based on `WORKER_CONCURRENCY`
- Redis coordinates job distribution

### Resource Limits
- Monitor Redis memory usage
- Set `removeOnComplete` and `removeOnFail` to prevent bloat
- Use Redis maxmemory policy: `allkeys-lru`

### Monitoring
- Set up Prometheus scraping endpoint
- Configure Sentry alerts for failed jobs
- Monitor queue sizes and processing times

## Troubleshooting

### Jobs Not Processing
1. Check Redis connection: `redis-cli ping`
2. Check worker status: `getJobSystemHealth()`
3. Check queue pause state: `queue.isPaused()`

### Jobs Failing Repeatedly
1. Check error logs with correlation ID
2. Review job data for validation issues
3. Check external service availability (Shopify, email provider)

### Memory Issues
1. Clean old jobs: `cleanAllQueues()`
2. Reduce `removeOnComplete.count`
3. Increase Redis maxmemory

### Stalled Jobs
- Default stalled interval: 30s
- Increase if jobs legitimately take longer
- Check for worker crashes

## Security

### Sensitive Data
- Never log full payloads containing secrets
- Filter sensitive fields in Sentry (see `observability/sentry.ts`)
- Use environment variables for credentials

### Access Control
- Queue operations should be restricted to server-side code
- Use workspace isolation in all queries
- Validate job data before processing

## Future Enhancements

- [ ] Dead letter queue for permanently failed jobs
- [ ] Job prioritization based on workspace tier
- [ ] Job rate limiting per workspace
- [ ] Advanced retry strategies (circuit breaker)
- [ ] Job chaining and workflows
- [ ] Real-time job progress updates via WebSockets
- [ ] Admin UI for queue management
