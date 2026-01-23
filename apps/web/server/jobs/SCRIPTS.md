# Job System Scripts Reference

Recommended npm scripts to add to your `package.json` for job system management.

## Package.json Scripts

```json
{
  "scripts": {
    "jobs:start": "tsx watch server/jobs/index.ts",
    "jobs:dev": "NODE_ENV=development LOG_LEVEL=debug tsx watch server/jobs/index.ts",
    "jobs:prod": "NODE_ENV=production node dist/server/jobs/index.js",
    "jobs:test": "NODE_ENV=test vitest run server/jobs/**/*.test.ts",
    "jobs:test:watch": "NODE_ENV=test vitest watch server/jobs/**/*.test.ts",
    "jobs:health": "tsx scripts/check-job-health.ts",
    "jobs:clean": "tsx scripts/clean-queues.ts"
  }
}
```

## Script Descriptions

### Development

**`npm run jobs:start`**
- Starts all job workers in watch mode
- Auto-reloads on file changes
- Uses default log level (info)

**`npm run jobs:dev`**
- Starts all job workers in development mode
- Debug log level for verbose output
- Auto-reloads on file changes
- Best for local development

### Production

**`npm run jobs:prod`**
- Runs compiled JavaScript from dist/
- Production log level (info)
- No auto-reload
- Use with PM2 or systemd for process management

### Testing

**`npm run jobs:test`**
- Runs all job system tests once
- Uses test environment (silent logs)
- Good for CI/CD pipelines

**`npm run jobs:test:watch`**
- Runs tests in watch mode
- Re-runs on file changes
- Good for TDD workflow

### Maintenance

**`npm run jobs:health`**
- Checks health of all workers
- Reports scheduler status
- Useful for monitoring scripts

**`npm run jobs:clean`**
- Cleans old completed/failed jobs from Redis
- Configurable grace period
- Run periodically to prevent Redis bloat

## Helper Scripts

Create these utility scripts in `/scripts/` directory:

### check-job-health.ts

```typescript
import { getJobSystemHealth } from '../apps/web/server/jobs';
import { getSchedulerHealth } from '../apps/web/server/jobs/scheduler';

async function checkHealth() {
  try {
    const jobHealth = await getJobSystemHealth();
    const schedulerHealth = await getSchedulerHealth();

    console.log('Job System Health:', jobHealth);
    console.log('Scheduler Health:', schedulerHealth);

    if (!jobHealth.healthy || !schedulerHealth.healthy) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

checkHealth();
```

### clean-queues.ts

```typescript
import { cleanAllQueues } from '../apps/web/server/jobs/queues';

async function cleanQueues() {
  try {
    const graceMs = parseInt(process.env.CLEAN_GRACE_MS || '3600000', 10);
    console.log(`Cleaning queues with grace period: ${graceMs}ms`);

    await cleanAllQueues(graceMs);

    console.log('Queues cleaned successfully');
    process.exit(0);
  } catch (error) {
    console.error('Failed to clean queues:', error);
    process.exit(1);
  }
}

cleanQueues();
```

### trigger-job.ts

```typescript
import { enqueueJob } from '../apps/web/server/jobs/queues';
import { QUEUE_NAMES } from '../apps/web/server/jobs/config';

async function triggerJob() {
  const queueName = process.argv[2];
  const workspaceId = process.argv[3];

  if (!queueName || !workspaceId) {
    console.error('Usage: npm run jobs:trigger <queue-name> <workspace-id>');
    process.exit(1);
  }

  try {
    const { id } = await enqueueJob(queueName, { workspaceId });
    console.log(`Job enqueued: ${id} to ${queueName}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to enqueue job:', error);
    process.exit(1);
  }
}

triggerJob();
```

## PM2 Configuration

For production deployment with PM2:

### ecosystem.config.js

```javascript
module.exports = {
  apps: [
    {
      name: 'merchops-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'merchops-jobs',
      script: 'dist/server/jobs/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_CONCURRENCY: 5,
        LOG_LEVEL: 'info',
      },
      max_memory_restart: '500M',
      error_file: 'logs/jobs-error.log',
      out_file: 'logs/jobs-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
```

### PM2 Commands

```bash
# Start all apps
pm2 start ecosystem.config.js

# Start only workers
pm2 start ecosystem.config.js --only merchops-jobs

# Restart workers
pm2 restart merchops-jobs

# Stop workers
pm2 stop merchops-jobs

# View logs
pm2 logs merchops-jobs

# Monitor
pm2 monit
```

## Docker Configuration

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Start job workers
CMD ["node", "dist/server/jobs/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  jobs:
    build: .
    depends_on:
      redis:
        condition: service_healthy
    environment:
      - REDIS_URL=redis://redis:6379
      - WORKER_CONCURRENCY=5
      - LOG_LEVEL=info
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "scripts/check-job-health.js"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis-data:
```

## Kubernetes Deployment

### deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: merchops-jobs
spec:
  replicas: 2
  selector:
    matchLabels:
      app: merchops-jobs
  template:
    metadata:
      labels:
        app: merchops-jobs
    spec:
      containers:
      - name: jobs
        image: merchops-jobs:latest
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        - name: WORKER_CONCURRENCY
          value: "5"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - node
            - scripts/check-job-health.js
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          exec:
            command:
            - node
            - scripts/check-job-health.js
          initialDelaySeconds: 10
          periodSeconds: 10
```

## Monitoring Scripts

### Prometheus Metrics Exporter

```typescript
// server/jobs/metrics-server.ts
import express from 'express';
import { exportPrometheus } from './server/observability/metrics';

const app = express();
const PORT = process.env.METRICS_PORT || 9090;

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(exportPrometheus());
});

app.listen(PORT, () => {
  console.log(`Metrics server listening on port ${PORT}`);
});
```

### Add to package.json:

```json
{
  "scripts": {
    "metrics:start": "tsx server/jobs/metrics-server.ts"
  }
}
```

## Cron Jobs (Alternative to Built-in Scheduler)

If running in environment without persistent workers, use system cron:

```cron
# Run decay check every hour
0 * * * * cd /app && npm run jobs:trigger opportunity-generate ws_all

# Run outcome computation daily at 2 AM
0 2 * * * cd /app && npm run jobs:trigger outcome-compute ws_all

# Run data sync every 6 hours
0 */6 * * * cd /app && npm run jobs:trigger shopify-sync ws_all

# Clean queues weekly
0 3 * * 0 cd /app && npm run jobs:clean
```

## Environment-Specific Configurations

### .env.development

```bash
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=2
LOG_LEVEL=debug
NODE_ENV=development
```

### .env.production

```bash
REDIS_URL=rediss://...upstash.io:6379
WORKER_CONCURRENCY=5
LOG_LEVEL=info
NODE_ENV=production
SENTRY_DSN=https://...@sentry.io/...
```

### .env.test

```bash
REDIS_URL=redis://localhost:6380
WORKER_CONCURRENCY=1
LOG_LEVEL=silent
NODE_ENV=test
```

## Useful Commands

### Check Redis Connection

```bash
redis-cli -u $REDIS_URL ping
```

### Monitor Redis

```bash
redis-cli -u $REDIS_URL --latency
redis-cli -u $REDIS_URL INFO memory
```

### View Queue Stats

```bash
# Via redis-cli
redis-cli -u $REDIS_URL KEYS "bull:*"
redis-cli -u $REDIS_URL LLEN "bull:shopify-sync:waiting"
redis-cli -u $REDIS_URL ZCARD "bull:shopify-sync:failed"
```

### Clear Specific Queue

```bash
redis-cli -u $REDIS_URL DEL "bull:shopify-sync:*"
```

## Troubleshooting Commands

### Check Running Workers

```bash
ps aux | grep "tsx.*jobs/index"
```

### View Worker Logs

```bash
tail -f logs/jobs-out.log
tail -f logs/jobs-error.log
```

### Test Job Processing

```bash
npm run jobs:trigger shopify-sync ws_test_123
```

### Force Clean All Queues

```bash
npm run jobs:clean
# OR
redis-cli -u $REDIS_URL FLUSHDB
```
