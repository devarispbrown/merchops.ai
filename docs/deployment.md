# MerchOps Deployment Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-23
**Audience:** DevOps, Release Engineers, and Developers

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Requirements](#environment-requirements)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Redis Setup](#redis-setup)
7. [Deployment Steps](#deployment-steps)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Monitoring Setup](#monitoring-setup)
10. [Rollback Procedures](#rollback-procedures)
11. [Maintenance Operations](#maintenance-operations)

---

## Overview

MerchOps is deployed as a Next.js application with background workers. This guide covers deployment to production environments.

### Deployment Architecture

```
                                   ┌─────────────────────┐
                                   │    Load Balancer    │
                                   │  (Vercel/Cloudflare)│
                                   └──────────┬──────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
             ┌──────▼──────┐          ┌───────▼───────┐         ┌───────▼───────┐
             │  Web App    │          │   Web App     │         │   Web App     │
             │  Instance 1 │          │   Instance 2  │         │   Instance N  │
             └──────┬──────┘          └───────┬───────┘         └───────┬───────┘
                    │                         │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
             ┌──────▼──────┐          ┌───────▼───────┐         ┌───────▼───────┐
             │  PostgreSQL │          │     Redis     │         │   Workers     │
             │  (Managed)  │          │   (Managed)   │         │   (Scalable)  │
             └─────────────┘          └───────────────┘         └───────────────┘
```

### Deployment Platforms

MerchOps can be deployed to:

| Platform | Best For | Notes |
|----------|----------|-------|
| **Vercel** | Next.js hosting | Automatic deployments, edge functions |
| **Railway** | Full stack | PostgreSQL, Redis included |
| **AWS** | Enterprise | ECS/EKS for containers |
| **Docker** | Any platform | Container-based deployment |

---

## Environment Requirements

### Production Requirements

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| **Node.js** | 20.x | 20.x LTS | Runtime version |
| **Memory** | 512 MB | 1-2 GB | Per instance |
| **CPU** | 0.5 vCPU | 1-2 vCPU | Per instance |
| **Instances** | 1 | 2+ | For high availability |

### Database Requirements

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| **PostgreSQL** | 14.x | 16.x | Managed preferred |
| **Storage** | 10 GB | 50+ GB | Based on data volume |
| **Connections** | 25 | 100 | Connection pooling recommended |
| **IOPS** | 1000 | 3000+ | For query performance |

### Redis Requirements

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| **Redis** | 7.x | 7.2.x | For BullMQ |
| **Memory** | 256 MB | 1+ GB | Based on queue depth |
| **Persistence** | RDB | AOF + RDB | For job durability |

### Worker Requirements

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| **Memory** | 256 MB | 512 MB | Per worker process |
| **Workers** | 1 | 2-5 | Based on job volume |
| **Concurrency** | 5 | 5-10 | Jobs per worker |

---

## Infrastructure Setup

### Vercel Deployment

1. **Connect Repository**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Login
   vercel login

   # Link project
   vercel link
   ```

2. **Configure Build Settings**
   - Framework: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

3. **Environment Variables**
   - Add all required environment variables in Vercel dashboard
   - Use Vercel environment variable groups for staging/production

4. **Deployment**
   ```bash
   # Deploy to preview
   vercel

   # Deploy to production
   vercel --prod
   ```

### Railway Deployment

1. **Create Project**
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli

   # Login
   railway login

   # Initialize
   railway init
   ```

2. **Add Services**
   - Add PostgreSQL from Railway templates
   - Add Redis from Railway templates
   - Add application service

3. **Configure Build**
   ```bash
   # railway.toml
   [build]
   builder = "NIXPACKS"
   buildCommand = "pnpm install && pnpm build"

   [deploy]
   startCommand = "pnpm start"
   restartPolicyType = "ON_FAILURE"
   restartPolicyMaxRetries = 3
   ```

4. **Deploy**
   ```bash
   railway up
   ```

### Docker Deployment

**Dockerfile:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN pnpm prisma:generate

# Build
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
```

**docker-compose.production.yml:**
```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  workers:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?schema=public` |
| `REDIS_URL` | Redis connection string | `redis://:password@host:6379/0` |
| `NEXTAUTH_SECRET` | Session encryption key (32+ chars) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application URL | `https://app.merchops.ai` |
| `SHOPIFY_CLIENT_ID` | Shopify OAuth client ID | From Shopify Partner Dashboard |
| `SHOPIFY_CLIENT_SECRET` | Shopify OAuth secret | From Shopify Partner Dashboard |
| `SHOPIFY_SCOPES` | OAuth scopes | See below |
| `NODE_ENV` | Environment | `production` |
| `LOG_LEVEL` | Logging level | `info` or `warn` |

### Shopify Scopes

```bash
SHOPIFY_SCOPES="read_products,write_products,read_orders,read_customers,read_inventory,write_inventory,write_discounts,read_price_rules,write_price_rules"
```

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry error tracking | Empty (disabled) |
| `EMAIL_PROVIDER_API_KEY` | Postmark/SendGrid API key | Required for email |
| `WEBHOOK_SECRET` | Shopify webhook HMAC secret | Generated |
| `WORKER_CONCURRENCY` | Jobs per worker | `5` |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |

### Environment Variable Security

1. **Never commit secrets** - Use environment variables or secret managers
2. **Rotate regularly** - Quarterly or after any suspected compromise
3. **Separate by environment** - Different secrets for staging/production
4. **Use managed secrets** - Vercel Secrets, AWS Secrets Manager, etc.

### Generating Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate WEBHOOK_SECRET
openssl rand -hex 32
```

---

## Database Setup

### PostgreSQL Configuration

#### Connection String Format

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=require
```

#### Recommended Settings

```sql
-- Connection pool settings
max_connections = 100
shared_buffers = 256MB
work_mem = 4MB

-- Performance
effective_cache_size = 768MB
maintenance_work_mem = 64MB

-- WAL
wal_level = replica
max_wal_senders = 3
```

### Initial Database Setup

```bash
# Create database
createdb -h HOST -U USER merchops_production

# Run migrations
DATABASE_URL="postgresql://..." pnpm prisma:migrate

# Verify
DATABASE_URL="postgresql://..." pnpm prisma:validate
```

### Managed Database Providers

| Provider | Notes |
|----------|-------|
| **Neon** | Serverless PostgreSQL, generous free tier |
| **Supabase** | PostgreSQL with extras, good free tier |
| **Railway** | Integrated with deployment |
| **AWS RDS** | Enterprise-grade |
| **Heroku Postgres** | Simple setup |

### Connection Pooling

For production, use a connection pooler like PgBouncer or built-in pooling:

```bash
# With Prisma Data Proxy
DATABASE_URL="prisma://aws-us-east-1.prisma-data.com/?api_key=..."

# With PgBouncer
DATABASE_URL="postgresql://user:pass@pgbouncer-host:6432/db?pgbouncer=true"
```

### Database Backup

```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
psql $DATABASE_URL < backup_20240115_120000.sql
```

### Migration Workflow

```bash
# 1. Create migration (development)
pnpm prisma:migrate:create --name add_feature

# 2. Review migration
cat prisma/migrations/*/migration.sql

# 3. Apply to staging
DATABASE_URL=$STAGING_DATABASE_URL pnpm prisma:migrate

# 4. Apply to production
DATABASE_URL=$PRODUCTION_DATABASE_URL pnpm prisma:migrate
```

---

## Redis Setup

### Redis Configuration

#### Connection String Format

```
redis://[:PASSWORD@]HOST:PORT[/DATABASE]
```

With TLS:
```
rediss://[:PASSWORD@]HOST:PORT[/DATABASE]
```

#### Recommended Settings

```
# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
appendonly yes
appendfsync everysec

# Security
requirepass YOUR_PASSWORD
```

### Managed Redis Providers

| Provider | Notes |
|----------|-------|
| **Upstash** | Serverless Redis, pay-per-request |
| **Redis Cloud** | Managed Redis Labs |
| **Railway** | Integrated with deployment |
| **AWS ElastiCache** | Enterprise-grade |
| **Heroku Redis** | Simple setup |

### Redis for BullMQ

BullMQ requires specific Redis configuration:

```typescript
// apps/web/server/jobs/config.ts
export const redisConnection = {
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: null,  // Required for BullMQ
  enableReadyCheck: false,      // Recommended for managed Redis
};
```

### Redis Health Check

```bash
# Test connection
redis-cli -u $REDIS_URL ping
# Expected: PONG

# Check memory
redis-cli -u $REDIS_URL INFO memory

# Check queues
redis-cli -u $REDIS_URL KEYS "bull:*"
```

---

## Deployment Steps

### Pre-Deployment Checklist

- [ ] All CI quality gates pass (lint, typecheck, tests)
- [ ] Staging deployment verified
- [ ] Database migrations reviewed
- [ ] Environment variables configured
- [ ] Backup of production database completed
- [ ] Rollback plan documented
- [ ] On-call engineer available

### Deployment Process

#### Step 1: Verify CI Status

```bash
# Check CI status
gh pr checks

# Or manually verify
pnpm lint
pnpm typecheck
pnpm test
```

#### Step 2: Database Migration (if needed)

```bash
# Review pending migrations
pnpm prisma migrate status

# Apply migrations
pnpm prisma:migrate
```

#### Step 3: Deploy Application

**Vercel:**
```bash
# Deploy to production
vercel --prod
```

**Railway:**
```bash
railway up --environment production
```

**Docker:**
```bash
# Build and push
docker build -t merchops:latest .
docker push registry/merchops:latest

# Deploy (platform-specific)
kubectl apply -f k8s/deployment.yaml
```

#### Step 4: Deploy Workers

Workers should be deployed separately for reliability:

```bash
# Railway
railway up --service workers

# Docker Compose
docker-compose -f docker-compose.production.yml up -d workers

# Kubernetes
kubectl apply -f k8s/workers.yaml
```

#### Step 5: Verify Deployment

```bash
# Health check
curl -f https://app.merchops.ai/api/health

# Check logs
vercel logs --follow
# or
railway logs --follow
```

---

## Post-Deployment Verification

### Immediate Checks (0-5 minutes)

```bash
# 1. Health check endpoint
curl -f https://app.merchops.ai/api/health
# Expected: {"status":"ok","timestamp":"..."}

# 2. Application loads
curl -s -o /dev/null -w "%{http_code}" https://app.merchops.ai
# Expected: 200

# 3. Database connectivity
# (Implicit in health check)

# 4. Redis connectivity
# (Implicit in health check)
```

### Functional Checks (5-15 minutes)

1. **Sign-Up Flow**
   - Create new test account
   - Verify email confirmation (if enabled)
   - Verify redirect to onboarding

2. **Login Flow**
   - Login with existing test account
   - Verify session created
   - Verify dashboard loads

3. **Shopify Integration**
   - Verify OAuth flow (with test store)
   - Verify webhooks receiving (check logs)

4. **Background Jobs**
   - Verify job queues processing
   - Check no stuck jobs

### Monitoring Checks

```bash
# Check error rates in Sentry
# (Via Sentry dashboard)

# Check application metrics
# (Via platform dashboard)

# Check queue depths
redis-cli -u $REDIS_URL LLEN bull:execution:waiting
```

### Verification Checklist

- [ ] Health check returns 200
- [ ] Application accessible via browser
- [ ] Sign-up flow works
- [ ] Login flow works
- [ ] Dashboard loads within SLO
- [ ] No error spike in Sentry
- [ ] Background jobs processing
- [ ] Webhook endpoints responding

---

## Monitoring Setup

### Error Tracking (Sentry)

```typescript
// apps/web/lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [
    new Sentry.Integrations.Prisma({ client: prisma }),
  ],
});
```

### Logging

Structured logging with pino:

```typescript
// apps/web/server/observability/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

### Health Check Endpoint

```typescript
// apps/web/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { redis } from '@/server/redis';

export async function GET() {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  const status = Object.values(checks).every((c) => c === 'ok')
    ? 'ok'
    : 'degraded';

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    checks,
  });
}
```

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Error rate | < 0.1% | > 1% |
| Response time p95 | < 500ms | > 1000ms |
| Queue depth | < 100 | > 1000 |
| Availability | > 99.9% | < 99% |

---

## Rollback Procedures

### When to Rollback

- Critical bug affecting all users
- Data corruption
- Security vulnerability
- Complete service outage

### Application Rollback

**Vercel:**
```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback <deployment-url>
```

**Railway:**
```bash
# Rollback
railway rollback

# Or redeploy specific commit
railway up --commit <commit-sha>
```

**Docker:**
```bash
# Rollback to previous image
docker pull registry/merchops:previous-tag
kubectl set image deployment/merchops merchops=registry/merchops:previous-tag
```

### Database Rollback

**If migration was additive (safe):**
- Usually no database rollback needed
- Deploy previous application version

**If migration requires reversal:**
```bash
# Create down migration
pnpm prisma:migrate:create --name rollback_feature

# Apply
pnpm prisma:migrate
```

**If data restoration needed:**
```bash
# Restore from backup
pg_restore -h HOST -U USER -d merchops_production backup.dump
```

### Rollback Verification

- [ ] Previous version deployed
- [ ] Health check passing
- [ ] Error rates returning to baseline
- [ ] User flows working
- [ ] Database integrity verified

---

## Maintenance Operations

### Routine Maintenance

#### Daily
- Review error logs
- Check queue depths
- Monitor disk usage

#### Weekly
- Review slow queries
- Check database connections
- Verify backup integrity

#### Monthly
- Rotate secrets
- Review security alerts
- Update dependencies

### Database Maintenance

```sql
-- Vacuum and analyze (run during low traffic)
VACUUM ANALYZE;

-- Check table sizes
SELECT schemaname, relname, pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname))
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;

-- Check index usage
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

### Redis Maintenance

```bash
# Check memory usage
redis-cli INFO memory

# Clean old job data
node -e "require('./server/jobs/queues').cleanAllQueues(86400000)"

# Check persistence status
redis-cli INFO persistence
```

### Queue Maintenance

```typescript
// Clean completed jobs older than 1 hour
await queue.clean(3600000, 'completed');

// Clean failed jobs older than 7 days
await queue.clean(604800000, 'failed');

// Drain queue (remove all waiting jobs)
await queue.drain();

// Pause queue for maintenance
await queue.pause();

// Resume queue
await queue.resume();
```

---

## Appendix

### Environment Variables Template

```bash
# Core
DATABASE_URL="postgresql://user:password@host:5432/db?schema=public&sslmode=require"
REDIS_URL="rediss://:password@host:6379"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://app.merchops.ai"
NODE_ENV="production"
LOG_LEVEL="info"

# Shopify
SHOPIFY_CLIENT_ID="your-client-id"
SHOPIFY_CLIENT_SECRET="your-client-secret"
SHOPIFY_SCOPES="read_products,write_products,read_orders,read_customers,read_inventory,write_inventory,write_discounts,read_price_rules,write_price_rules"
WEBHOOK_SECRET="generate-with-openssl-rand-hex-32"

# Observability
SENTRY_DSN="https://xxx@sentry.io/xxx"

# Email (optional)
EMAIL_PROVIDER_API_KEY="your-postmark-or-sendgrid-key"

# Workers
WORKER_CONCURRENCY="5"
```

### Deployment Commands Reference

```bash
# Vercel
vercel                    # Deploy to preview
vercel --prod             # Deploy to production
vercel ls                 # List deployments
vercel rollback <url>     # Rollback deployment
vercel logs               # View logs
vercel env pull           # Pull env vars

# Railway
railway login             # Authenticate
railway up                # Deploy
railway logs              # View logs
railway rollback          # Rollback
railway variables         # View env vars

# Prisma
pnpm prisma:migrate       # Apply migrations
pnpm prisma:validate      # Validate schema
pnpm prisma:studio        # Database browser
```

### Useful Scripts

```bash
# scripts/backup-db.sh
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backups/backup_$TIMESTAMP.sql
echo "Backup created: backups/backup_$TIMESTAMP.sql"

# scripts/check-queues.sh
#!/bin/bash
redis-cli -u $REDIS_URL KEYS "bull:*:waiting" | while read key; do
  echo "$key: $(redis-cli -u $REDIS_URL LLEN $key)"
done
```

---

**End of Deployment Guide**
