# BullMQ Job System Implementation Summary

## Overview

Complete BullMQ-based background job system for MerchOps with Redis persistence, comprehensive observability, idempotent execution, and graceful shutdown handling.

## Files Created

### Core Configuration
✅ `/apps/web/server/jobs/config.ts`
- Redis connection configuration
- Queue names registry (5 queues)
- Default job options with retry strategies
- Queue-specific options
- Scheduler configuration (3 scheduled jobs)
- Job priorities

### Queue Management
✅ `/apps/web/server/jobs/queues.ts`
- Queue initialization and singleton registry
- Queue instances for all 5 queues
- Queue event handlers for observability
- Management functions (pause, resume, clean)
- Generic `enqueueJob()` helper with correlation injection

### Job Processors
✅ `/apps/web/server/jobs/processors/shopify-sync.processor.ts`
- Initial and incremental Shopify data sync
- Handles products, orders, customers, inventory
- Mock data generators for development
- Validation and error handling

✅ `/apps/web/server/jobs/processors/event-compute.processor.ts`
- Computes business events from Shopify data
- Event types: inventory, velocity, customer inactivity
- Deduplication via dedupe keys
- Event storage with immutability

✅ `/apps/web/server/jobs/processors/opportunity-generate.processor.ts`
- Generates opportunities from events
- Priority buckets (high/medium/low)
- Why-now, rationale, counterfactual generation
- Operator intent mapping

✅ `/apps/web/server/jobs/processors/execution.processor.ts`
- Executes approved actions (discount, email, product pause)
- Idempotency checking via idempotency keys
- Provider response logging
- Error classification and retry logic

✅ `/apps/web/server/jobs/processors/outcome-compute.processor.ts`
- Computes helped/neutral/hurt outcomes
- Evidence-based analysis with baseline comparison
- Confidence scoring
- Multiple outcome determination strategies

### Workers (Already Existed)
✅ `/apps/web/server/jobs/workers/shopify-sync.worker.ts`
✅ `/apps/web/server/jobs/workers/event-compute.worker.ts`
✅ `/apps/web/server/jobs/workers/opportunity-generate.worker.ts`
✅ `/apps/web/server/jobs/workers/execution.worker.ts`
✅ `/apps/web/server/jobs/workers/outcome-compute.worker.ts`

All workers include:
- Worker initialization with BullMQ
- Event handlers (completed, failed, error, stalled)
- Graceful shutdown functions
- Integration with processors

### Scheduler
✅ `/apps/web/server/jobs/scheduler.ts`
- Scheduled job initialization
- Decay check (hourly)
- Outcome computation (daily at 2 AM)
- Data sync refresh (every 6 hours)
- Scheduler management functions (pause, resume, trigger)
- Health check endpoint

### Main Entry Point
✅ `/apps/web/server/jobs/index.ts`
- Starts all workers and scheduler
- Graceful shutdown handling (SIGTERM, SIGINT)
- Error handlers (uncaughtException, unhandledRejection)
- Job system health check
- Worker management (pause, resume, get status)

### Observability - Logger
✅ `/apps/web/server/observability/logger.ts`
- Pino-based structured logging
- Correlation ID injection via mixin
- Environment-specific log levels
- Helper functions for job/API/DB/execution logging
- Pretty printing in development
- Safe stringification with circular reference handling

### Observability - Metrics
✅ `/apps/web/server/observability/metrics.ts`
- Metrics registry with in-memory storage
- Counter metrics: jobs_processed, jobs_failed, executions_total
- Histogram metrics: job_duration, api_latency
- Timer helper class for automatic duration recording
- Aggregate statistics (count, sum, avg, percentiles)
- Prometheus export format

### Observability - Sentry
✅ `/apps/web/server/observability/sentry.ts`
- Sentry initialization with environment config
- Correlation context injection in beforeSend
- PII filtering for sensitive data
- Specialized error capture functions (job, execution, Shopify)
- User context management
- Breadcrumb support
- Transaction support for performance monitoring

### Correlation ID Library
✅ `/apps/web/lib/correlation.ts`
- Correlation ID generation (UUID v4)
- AsyncLocalStorage for context propagation
- Context management (get, set, update)
- Job data injection/extraction helpers
- Child correlation ID creation
- HTTP header utilities

### Documentation
✅ `/apps/web/server/jobs/README.md`
- Comprehensive architecture documentation
- Queue descriptions and configurations
- Job flow diagrams
- Usage examples
- Configuration guide
- Monitoring and troubleshooting
- Security best practices

✅ `/apps/web/server/jobs/IMPLEMENTATION.md` (this file)

## Job Flow Architecture

```
User Action / Webhook / Schedule
        │
        ▼
┌────────────────────────────────┐
│      Shopify Sync Queue        │ ← Initial sync, periodic refresh
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│     Event Compute Queue        │ ← Compute events from data
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  Opportunity Generate Queue    │ ← Generate opportunities
└────────────┬───────────────────┘
             │
        User Approval
             │
             ▼
┌────────────────────────────────┐
│      Execution Queue           │ ← Execute approved actions
└────────────┬───────────────────┘
             │
      (24+ hours later)
             │
             ▼
┌────────────────────────────────┐
│   Outcome Compute Queue        │ ← Compute outcomes
└────────────────────────────────┘
```

## Key Features

### 1. Idempotency
- **Executions**: Required idempotency key prevents duplicate executions
- **Events**: Dedupe key prevents duplicate event creation
- **Redis**: Persistent storage survives restarts

### 2. Observability
- **Correlation IDs**: Propagate through entire request-job-execution chain
- **Structured Logging**: Pino with automatic context injection
- **Metrics**: Counters, histograms, and timers for all operations
- **Error Tracking**: Sentry with context and fingerprinting

### 3. Resilience
- **Retry Logic**: Exponential backoff with configurable attempts
- **Error Handling**: Classification and actionable error messages
- **Graceful Shutdown**: Clean worker termination without job loss
- **Stalled Job Detection**: Automatic recovery from hung jobs

### 4. Scheduling
- **Cron-based**: Standard cron patterns for recurring jobs
- **Repeatable Jobs**: BullMQ repeatable job support
- **Manual Triggers**: API for manual job triggering
- **Health Monitoring**: Scheduler health check endpoint

### 5. Developer Experience
- **Mock Data**: Development mode with generated test data
- **Type Safety**: Full TypeScript coverage
- **Validation**: Zod-compatible data validation
- **Testing**: Processor functions testable independently

## Configuration

### Environment Variables Required

```bash
# Redis (Upstash or local)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false

# Worker settings
WORKER_CONCURRENCY=5

# Logging
LOG_LEVEL=info
NODE_ENV=production

# Sentry (optional)
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=
```

### Queue Configurations

| Queue | Retries | Backoff Start | Priority | Use Case |
|-------|---------|---------------|----------|----------|
| shopify-sync | 5 | 2s | Normal-High | Data fetching from Shopify |
| event-compute | 3 | 1s | High | Event computation from data |
| opportunity-generate | 3 | 1s | Normal | Opportunity generation |
| execution | 5 | 3s | Critical | Action execution (idempotent) |
| outcome-compute | 5 | 1s | Normal | Outcome computation |

### Scheduled Jobs

| Job | Pattern | Queue | Description |
|-----|---------|-------|-------------|
| decay-check | `0 * * * *` | opportunity-generate | Hourly decay check |
| daily-outcome-compute | `0 2 * * *` | outcome-compute | Daily outcome computation at 2 AM |
| data-sync-refresh | `0 */6 * * *` | shopify-sync | Data refresh every 6 hours |

## Testing Strategy

### Unit Tests (Recommended)
```typescript
// Test processors independently
import { processShopifySync } from './processors/shopify-sync.processor';

describe('Shopify Sync Processor', () => {
  it('should sync products successfully', async () => {
    const mockJob = createMockJob({
      workspaceId: 'ws_test',
      syncType: 'initial',
    });

    const result = await processShopifySync(mockJob);

    expect(result.resourcesCounts.products).toBeGreaterThan(0);
  });
});
```

### Integration Tests
```typescript
// Test full job flow
import { shopifySyncQueue } from './queues';

describe('Job Flow Integration', () => {
  it('should process sync job end-to-end', async () => {
    const job = await shopifySyncQueue.add('test-sync', {
      workspaceId: 'ws_test',
      syncType: 'initial',
    });

    // Wait for job completion
    const result = await job.waitUntilFinished(queueEvents);

    expect(result.status).toBe('success');
  });
});
```

## Deployment

### Docker Compose Example

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  web:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
      - WORKER_CONCURRENCY=5
    depends_on:
      - redis

volumes:
  redis-data:
```

### Production Considerations

1. **Redis**: Use managed Redis (Upstash, AWS ElastiCache, Redis Cloud)
2. **Workers**: Run multiple instances for high availability
3. **Monitoring**: Set up Prometheus + Grafana for metrics
4. **Alerting**: Configure Sentry alerts for job failures
5. **Scaling**: Adjust `WORKER_CONCURRENCY` based on load

## Migration Guide

### Existing System
If migrating from an existing job system:

1. Deploy new BullMQ system alongside old system
2. Route new jobs to BullMQ
3. Wait for old system to drain
4. Decommission old system

### Data Migration
No data migration needed - job system is stateless except for Redis queue state.

## Monitoring Endpoints

### Health Check
```typescript
GET /api/jobs/health

Response:
{
  "healthy": true,
  "workers": [
    {
      "name": "shopify-sync",
      "running": true,
      "isPaused": false
    },
    ...
  ]
}
```

### Scheduler Health
```typescript
GET /api/jobs/scheduler/health

Response:
{
  "healthy": true,
  "scheduledJobsCount": 3,
  "jobs": [
    {
      "name": "decay-check",
      "pattern": "0 * * * *",
      "exists": true,
      "isPaused": false,
      "nextRun": "2024-01-23T15:00:00Z"
    },
    ...
  ]
}
```

### Metrics
```typescript
GET /api/jobs/metrics

Response: Prometheus-compatible metrics
```

## Next Steps

1. **Database Integration**: Connect processors to actual Prisma queries
2. **Shopify SDK**: Integrate official Shopify SDK for API calls
3. **Email Provider**: Set up Postmark/SendGrid for email execution
4. **Testing**: Write comprehensive unit and integration tests
5. **Monitoring**: Set up Grafana dashboards for queue metrics
6. **Documentation**: Add API docs for job endpoints

## Support

For issues or questions:
1. Check logs with correlation ID
2. Review queue health endpoints
3. Inspect Redis for job state
4. Check Sentry for error details

## License

Internal MerchOps Beta MVP
