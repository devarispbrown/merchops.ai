# MerchOps Beta MVP - Deployment Runbook

**Version:** 1.0.0
**Last Updated:** 2026-01-23
**Owner:** DevOps / Release Engineering

---

## Table of Contents

1. [Overview](#overview)
2. [Local Development Setup](#local-development-setup)
3. [Environment Configuration](#environment-configuration)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [Rollback Procedures](#rollback-procedures)
7. [Database Migrations](#database-migrations)
8. [Monitoring and Health Checks](#monitoring-and-health-checks)
9. [Incident Response](#incident-response)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This runbook provides comprehensive deployment procedures for MerchOps Beta MVP. All deployments must pass CI/CD quality gates and follow the principle of calm, deliberate execution.

### Deployment Principles

- **No silent side effects**: Every deployment is logged and auditable
- **Approval required**: Production deployments require explicit approval
- **Rollback ready**: Every deployment has a tested rollback path
- **Observable**: Full correlation IDs across request → job → execution

### Quality Gates

All environments require passing:
- ✓ `pnpm lint`
- ✓ `pnpm typecheck`
- ✓ `pnpm test` (unit + integration)
- ✓ `pnpm test:e2e` (Playwright)
- ✓ `pnpm prisma:validate`

---

## Local Development Setup

### Prerequisites

- **Node.js**: v20.0.0 or higher
- **pnpm**: v8.0.0 or higher
- **PostgreSQL**: v14+ (local or Docker)
- **Redis**: v7+ (local or Docker)
- **Git**: Latest stable

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd merchops.ai
```

### Step 2: Install Dependencies

```bash
pnpm install
```

### Step 3: Setup Local Services

#### Option A: Docker Compose (Recommended)

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Verify services are running
docker-compose ps
```

#### Option B: Local Installation

**PostgreSQL:**
```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb merchops_dev
```

**Redis:**
```bash
# macOS
brew install redis
brew services start redis
```

### Step 4: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your local configuration
# Required minimum for local development:
# - DATABASE_URL
# - REDIS_URL
# - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
# - NEXTAUTH_URL (http://localhost:3000)
```

### Step 5: Database Setup

```bash
# Generate Prisma Client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate:dev

# (Optional) Seed database
pnpm db:seed

# Verify schema
pnpm prisma:validate
```

### Step 6: Start Development Server

```bash
# Start Next.js dev server
pnpm dev

# Application will be available at:
# http://localhost:3000
```

### Step 7: Verify Setup

```bash
# Run linter
pnpm lint

# Run type check
pnpm typecheck

# Run tests
pnpm test

# Run E2E tests (optional, requires running server)
pnpm test:e2e
```

### Local Development Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build for production
pnpm start                  # Start production server

# Quality Checks
pnpm lint                   # Run ESLint
pnpm lint:fix               # Fix linting issues
pnpm typecheck              # TypeScript type checking
pnpm format                 # Format code with Prettier
pnpm format:check           # Check code formatting

# Testing
pnpm test                   # Run all tests
pnpm test:unit              # Run unit tests only
pnpm test:integration       # Run integration tests only
pnpm test:e2e               # Run E2E tests
pnpm test:watch             # Run tests in watch mode
pnpm test:coverage          # Generate coverage report

# Database
pnpm prisma:studio          # Open Prisma Studio
pnpm prisma:format          # Format schema file
pnpm prisma:reset           # Reset database (⚠️  destructive)
```

---

## Environment Configuration

### Environment Variables

All environments require these variables. See `.env.example` for complete list.

#### Critical Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | Yes | `redis://host:6379/0` |
| `NEXTAUTH_SECRET` | NextAuth.js secret (32+ chars) | Yes | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application URL | Yes | `https://app.merchops.ai` |
| `SHOPIFY_CLIENT_ID` | Shopify OAuth client ID | Yes | From Shopify Partner Dashboard |
| `SHOPIFY_CLIENT_SECRET` | Shopify OAuth secret | Yes | From Shopify Partner Dashboard |
| `SHOPIFY_SCOPES` | OAuth scopes | Yes | See `.env.example` |
| `SENTRY_DSN` | Sentry error tracking | No | From Sentry dashboard |
| `NODE_ENV` | Environment mode | Yes | `development`, `staging`, `production` |
| `LOG_LEVEL` | Logging verbosity | Yes | `debug`, `info`, `warn`, `error` |

#### Environment-Specific Values

**Development:**
- `NODE_ENV=development`
- `LOG_LEVEL=debug`
- `NEXTAUTH_URL=http://localhost:3000`

**Staging:**
- `NODE_ENV=staging`
- `LOG_LEVEL=info`
- `NEXTAUTH_URL=https://staging.merchops.ai`

**Production:**
- `NODE_ENV=production`
- `LOG_LEVEL=warn`
- `NEXTAUTH_URL=https://app.merchops.ai`

### Secret Management

#### Development
- Use `.env` file (gitignored)
- Never commit secrets to version control

#### Staging/Production
- Use platform secret management (Vercel/Railway/AWS Secrets Manager)
- Rotate secrets quarterly or after any suspected compromise
- Use separate credentials per environment

---

## Staging Deployment

### Automatic Deployment (Recommended)

Staging deploys automatically on merge to `main` branch after CI passes.

**Process:**
1. Create PR with changes
2. Wait for CI to pass (all quality gates green)
3. Merge to `main`
4. Deployment triggers automatically
5. Verify deployment health checks

### Manual Deployment

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Verify all checks pass locally
pnpm lint && pnpm typecheck && pnpm test

# Deploy to staging (platform-specific)
# Vercel:
vercel --prod --scope=staging

# Railway:
railway up --environment=staging

# Custom:
./scripts/deploy-staging.sh
```

### Post-Deployment Verification

```bash
# Check deployment status
curl -f https://staging.merchops.ai/api/health

# Verify database migrations
# (Check platform logs or run migration status)

# Smoke test critical flows
pnpm test:e2e --config=playwright.staging.config.ts

# Monitor error tracking
# Check Sentry dashboard for new errors
```

### Staging Environment Checklist

- [ ] All CI quality gates passed
- [ ] Database migrations applied successfully
- [ ] Environment variables configured correctly
- [ ] Health check endpoint returns 200
- [ ] No critical errors in logs (first 5 minutes)
- [ ] Background jobs processing (check Redis queue)
- [ ] Shopify webhooks receiving events (if configured)
- [ ] Sentry receiving error reports (test with intentional error)

---

## Production Deployment

### Pre-Deployment Checklist

**⚠️  CRITICAL: Complete ALL items before deploying to production**

- [ ] All staging verification completed successfully
- [ ] Staging deployed for minimum 24 hours with no critical issues
- [ ] Database backup completed within last hour
- [ ] Migration plan reviewed and tested in staging
- [ ] Rollback plan documented and tested
- [ ] On-call engineer available for 2 hours post-deployment
- [ ] Incident response team notified
- [ ] Customer communication prepared (if needed)
- [ ] Feature flags configured correctly
- [ ] Monitoring dashboards ready
- [ ] Rate limits and quotas verified

### Deployment Window

**Recommended:**
- Tuesday-Thursday, 10:00-14:00 PST
- Avoid Fridays, weekends, holidays
- Avoid high-traffic periods (Black Friday, Cyber Monday)

**Required Presence:**
- Release engineer (primary)
- Backend engineer (backup)
- On-call SRE

### Production Deployment Steps

#### 1. Pre-Deployment

```bash
# Create deployment tracking issue
gh issue create --title "Production Deployment: YYYY-MM-DD" \
  --body "Deployment checklist..."

# Verify production access
# (Ensure credentials and permissions are current)

# Create database backup
./scripts/backup-production-db.sh

# Tag release
git tag -a v0.1.0 -m "Production release 0.1.0"
git push origin v0.1.0
```

#### 2. Database Migration (if required)

```bash
# Review migration files
cat prisma/migrations/*/migration.sql

# Estimate migration duration
# (Test in staging with production-sized dataset)

# Enable maintenance mode (if migration is long-running)
# Platform-specific command

# Run migration
pnpm prisma:migrate

# Verify migration success
pnpm prisma:validate

# Disable maintenance mode
```

#### 3. Application Deployment

```bash
# Deploy application
# Vercel:
vercel --prod --scope=production

# Railway:
railway up --environment=production

# Monitor deployment progress
# (Platform-specific dashboard)

# Wait for health checks to pass
```

#### 4. Post-Deployment Verification

```bash
# Immediate checks (0-5 minutes)
curl -f https://app.merchops.ai/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Check error rates
# Sentry dashboard - should show no spike

# Verify background jobs
# Redis queue dashboard - jobs processing normally

# Test critical user flows
# 1. Sign up → Connect Shopify
# 2. View opportunities queue
# 3. Approve action → Execute
# 4. View execution history
```

#### 5. Monitoring Period

**First 30 minutes:**
- Monitor error rates (Sentry)
- Monitor API response times
- Monitor database connection pool
- Monitor Redis queue depths
- Watch for webhook failures

**First 2 hours:**
- Review all execution logs
- Verify no failed jobs in queue
- Check customer support channels
- Monitor user signup flow
- Verify Shopify integration health

**First 24 hours:**
- Daily error rate review
- Performance metrics comparison
- Customer feedback monitoring
- Background job success rates

### Production Deployment Checklist

- [ ] Database backup verified
- [ ] Migrations applied successfully
- [ ] Application deployed and healthy
- [ ] Health check returning 200
- [ ] No error spike in Sentry (first 30 min)
- [ ] API response times within SLO
- [ ] Background jobs processing
- [ ] Shopify webhooks working
- [ ] User signup flow tested
- [ ] Critical flows E2E tested
- [ ] Monitoring dashboards reviewed
- [ ] Team notified of successful deployment
- [ ] Deployment issue updated and closed

---

## Rollback Procedures

### When to Rollback

**Immediate rollback required:**
- Critical bug affecting all users
- Data corruption or loss
- Security vulnerability discovered
- Complete service outage
- Database migration failure

**Consider rollback:**
- Error rate spike > 5x baseline
- User-facing feature completely broken
- Performance degradation > 50% baseline
- Background jobs failing > 20%

### Rollback Decision Matrix

| Severity | Impact | Action | Timeline |
|----------|--------|--------|----------|
| **P0** | Service down | Immediate rollback | < 5 minutes |
| **P1** | Critical feature broken | Evaluate → Rollback | < 15 minutes |
| **P2** | Degraded performance | Fix forward or rollback | < 1 hour |
| **P3** | Minor issue | Fix forward | < 24 hours |

### Application Rollback

```bash
# Identify last known good version
git log --oneline -10

# Rollback application (platform-specific)
# Vercel:
vercel rollback <deployment-url>

# Railway:
railway rollback --environment=production

# Verify rollback
curl -f https://app.merchops.ai/api/health

# Monitor for 30 minutes
# Ensure error rates return to baseline
```

### Database Rollback

**⚠️  Database rollbacks are complex and risky. Follow this procedure carefully.**

#### Scenario 1: Migration Not Yet Applied

```bash
# Simply don't apply the migration
# Deploy previous application version
```

#### Scenario 2: Migration Applied, No Data Written

```bash
# Create down migration
pnpm prisma:migrate:create --name rollback_feature_name

# Edit migration file to reverse changes
# Test in staging first
# Apply in production
pnpm prisma:migrate
```

#### Scenario 3: Migration Applied, Data Written

```bash
# This is the most complex scenario
# Options:
# 1. Write data migration to reverse changes (preferred)
# 2. Restore from backup (data loss risk)
# 3. Fix forward (if feasible)

# If restoring from backup:
./scripts/restore-production-db.sh <backup-timestamp>

# Verify data integrity
# Test critical queries
# Resume application
```

### Rollback Verification Checklist

- [ ] Application version confirmed reverted
- [ ] Health checks passing
- [ ] Error rates back to baseline
- [ ] Database integrity verified
- [ ] Background jobs processing
- [ ] User flows tested
- [ ] Team notified of rollback
- [ ] Post-mortem scheduled
- [ ] Root cause investigation started

---

## Database Migrations

### Migration Best Practices

1. **Always test in staging first**
2. **Migrations should be backwards compatible when possible**
3. **Use feature flags for schema changes affecting app logic**
4. **Never combine schema changes with data migrations**
5. **Estimate migration duration with production-sized data**

### Migration Types

#### Safe Migrations (No Downtime)

- Adding nullable columns
- Adding new tables
- Adding indexes with `CONCURRENT` (PostgreSQL)
- Adding non-unique indexes

#### Risky Migrations (Potential Downtime)

- Removing columns (use 2-phase deploy)
- Renaming columns
- Changing column types
- Adding NOT NULL constraints
- Large data migrations

### Migration Workflow

#### 1. Development

```bash
# Create migration
pnpm prisma:migrate:create --name add_confidence_to_opportunities

# Edit migration file if needed
# Review generated SQL

# Apply locally
pnpm prisma:migrate:dev

# Test application with new schema
pnpm test
```

#### 2. Staging

```bash
# Deploy to staging (includes migration)
# Verify migration applied successfully

# Check migration status
pnpm prisma migrate status

# Test application thoroughly
pnpm test:e2e
```

#### 3. Production

```bash
# Review migration plan
cat prisma/migrations/*/migration.sql

# Estimate duration (from staging metrics)
# If > 30 seconds, consider maintenance window

# Apply migration
pnpm prisma:migrate

# Verify
pnpm prisma:validate
```

### Two-Phase Migration (For Breaking Changes)

**Phase 1: Additive (Week 1)**
```sql
-- Add new column (nullable)
ALTER TABLE opportunities ADD COLUMN confidence_v2 DECIMAL(3,2);

-- Create new index
CREATE INDEX CONCURRENTLY idx_opportunities_confidence_v2
  ON opportunities(confidence_v2);
```

**Application deploys, writes to both columns**

**Phase 2: Cleanup (Week 2)**
```sql
-- Remove old column
ALTER TABLE opportunities DROP COLUMN confidence;

-- Rename new column
ALTER TABLE opportunities RENAME COLUMN confidence_v2 TO confidence;
```

### Migration Monitoring

```bash
# Check migration status
pnpm prisma migrate status

# View migration history
pnpm prisma migrate resolve --help

# Verify schema matches migrations
pnpm prisma:validate
```

---

## Monitoring and Health Checks

### Health Check Endpoint

**Endpoint:** `GET /api/health`

**Response (Healthy):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-23T10:30:00.000Z",
  "version": "0.1.0",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "jobs": "ok"
  }
}
```

**Response (Unhealthy):**
```json
{
  "status": "degraded",
  "timestamp": "2026-01-23T10:30:00.000Z",
  "version": "0.1.0",
  "checks": {
    "database": "ok",
    "redis": "error",
    "jobs": "degraded"
  },
  "errors": [
    "Redis connection timeout"
  ]
}
```

### Key Metrics to Monitor

#### Application Metrics

- **Request rate**: req/sec
- **Error rate**: errors/sec (target: < 0.1%)
- **Response time**: p50, p95, p99 (target: < 500ms p95)
- **Availability**: uptime percentage (target: > 99.9%)

#### Database Metrics

- **Connection pool**: active/idle connections
- **Query performance**: slow queries (> 1s)
- **Lock contention**: wait times
- **Storage**: disk usage percentage

#### Background Jobs

- **Queue depth**: pending jobs count
- **Processing rate**: jobs/sec
- **Failure rate**: failed jobs percentage
- **Wait time**: time in queue before processing

#### Business Metrics

- **Opportunity generation rate**: opportunities/hour
- **Approval rate**: approvals/opportunities
- **Execution success rate**: successful executions/attempts
- **Learning loop resolution rate**: outcomes computed/executions

### Monitoring Tools

- **Sentry**: Error tracking and performance monitoring
- **Logs**: Structured logging with correlation IDs
- **Platform metrics**: Vercel/Railway dashboards
- **Database**: PostgreSQL slow query log
- **Redis**: INFO command metrics

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error rate | > 1% | > 5% | Investigate immediately |
| Response time p95 | > 1s | > 3s | Check database queries |
| Database connections | > 80% | > 95% | Scale up connection pool |
| Queue depth | > 1000 | > 5000 | Check worker health |
| Disk usage | > 80% | > 90% | Expand storage |

---

## Incident Response

### Incident Severity Levels

**P0 - Critical**
- Complete service outage
- Data loss or corruption
- Security breach
- Response time: < 5 minutes

**P1 - High**
- Major feature completely broken
- Significant performance degradation
- Affecting > 50% of users
- Response time: < 15 minutes

**P2 - Medium**
- Minor feature broken
- Affecting < 50% of users
- Workaround available
- Response time: < 1 hour

**P3 - Low**
- Cosmetic issues
- Affecting < 10% of users
- No impact on core functionality
- Response time: < 24 hours

### Incident Response Procedure

#### 1. Detect and Alert

- Monitor alerts in Sentry, logs, health checks
- Customer reports via support channels
- Automated monitoring triggers

#### 2. Assess and Classify

```bash
# Quick assessment commands
curl -f https://app.merchops.ai/api/health
# Check Sentry dashboard
# Review recent deployments
# Check database status
```

#### 3. Communicate

- Create incident channel (#incident-YYYY-MM-DD)
- Notify on-call team
- Update status page
- Communicate to customers (if P0/P1)

#### 4. Mitigate

**Immediate actions:**
- Rollback recent deployment (if applicable)
- Scale up resources (if performance issue)
- Disable problematic feature flag
- Enable maintenance mode (if necessary)

#### 5. Resolve

- Implement fix
- Test in staging
- Deploy to production
- Verify resolution
- Monitor for 1 hour

#### 6. Post-Mortem

- Schedule post-mortem meeting (within 48 hours)
- Document timeline, root cause, resolution
- Identify action items to prevent recurrence
- Update runbooks

### Incident Communication Template

**Initial Update:**
```
[INCIDENT] [P0/P1/P2/P3] Brief description

Status: Investigating / Identified / Monitoring / Resolved
Started: YYYY-MM-DD HH:MM UTC
Impact: Description of user impact
Next Update: HH:MM UTC
```

**Resolution Update:**
```
[RESOLVED] Brief description

Duration: X hours Y minutes
Root Cause: Brief explanation
Resolution: What was done
Post-Mortem: Link to doc (when available)
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Health Check Failing

**Symptoms:**
- `/api/health` returns 500 or times out
- Application not responding

**Investigation:**
```bash
# Check application logs
# Platform-specific log viewing

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check environment variables
# Platform-specific env viewing
```

**Solutions:**
- Restart application
- Check database connection limits
- Verify Redis is running
- Check network connectivity

---

#### Issue: Database Migration Failed

**Symptoms:**
- Migration command exits with error
- Application can't connect to database

**Investigation:**
```bash
# Check migration status
pnpm prisma migrate status

# View migration history
# Review migration files

# Check database logs
# Platform-specific
```

**Solutions:**
- Resolve migration manually
- Mark migration as resolved: `pnpm prisma migrate resolve --applied <migration-name>`
- Rollback and retry
- Contact DBA for complex issues

---

#### Issue: Background Jobs Not Processing

**Symptoms:**
- Queue depth increasing
- Jobs stuck in waiting state
- No job completion logs

**Investigation:**
```bash
# Check Redis connection
redis-cli -u $REDIS_URL ping

# Check queue stats
# Use BullMQ dashboard or CLI

# Review worker logs
# Check for errors in job processing
```

**Solutions:**
- Restart workers
- Check Redis memory limits
- Verify queue configuration
- Scale up workers if needed

---

#### Issue: Shopify Webhook Failures

**Symptoms:**
- Events not appearing in dashboard
- Webhook verification errors
- High error rate in webhook endpoint

**Investigation:**
```bash
# Check webhook endpoint logs
# Look for HMAC verification failures

# Verify webhook configuration in Shopify
# Check webhook secret matches

# Test webhook manually
curl -X POST https://app.merchops.ai/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: ..." \
  -d '{...}'
```

**Solutions:**
- Verify webhook secret is correct
- Check HMAC verification logic
- Ensure endpoint is publicly accessible
- Review Shopify webhook logs

---

#### Issue: High Memory Usage

**Symptoms:**
- Application crashes with OOM
- Response times degrading
- Memory usage growing over time

**Investigation:**
```bash
# Check memory metrics
# Platform-specific monitoring

# Review recent changes
# Look for memory leaks in new code

# Analyze heap dump (if available)
```

**Solutions:**
- Increase memory allocation
- Optimize database queries (reduce result set size)
- Fix memory leaks
- Implement pagination
- Add caching strategically

---

### Emergency Contacts

- **On-Call Engineer**: [Rotation schedule link]
- **Database Admin**: [Contact info]
- **Platform Support**: [Vercel/Railway support]
- **Security Team**: [Contact info]

---

### Quick Reference Commands

```bash
# Health check
curl -f https://app.merchops.ai/api/health

# Database status
pnpm prisma migrate status

# View logs (platform-specific)
vercel logs
railway logs

# Rollback deployment
vercel rollback <deployment-url>
railway rollback

# Emergency maintenance mode
# Platform-specific command

# Database backup
./scripts/backup-production-db.sh

# Database restore
./scripts/restore-production-db.sh <timestamp>
```

---

## Appendix

### Migration Checklist Template

```markdown
## Migration: [Name]

**Date:** YYYY-MM-DD
**Engineer:** [Name]
**Ticket:** [Link]

### Pre-Migration
- [ ] Tested in staging
- [ ] Estimated duration: [X minutes]
- [ ] Backup completed
- [ ] Rollback plan documented

### Migration
- [ ] Migration applied
- [ ] Schema validated
- [ ] Application deployed
- [ ] Health checks passing

### Post-Migration
- [ ] Data integrity verified
- [ ] Performance metrics normal
- [ ] No errors in logs
- [ ] Team notified
```

### Deployment Checklist Template

```markdown
## Deployment: [Version]

**Date:** YYYY-MM-DD
**Engineer:** [Name]
**Release Notes:** [Link]

### Pre-Deployment
- [ ] All CI checks passed
- [ ] Staging verified 24h+
- [ ] Database backup completed
- [ ] On-call notified

### Deployment
- [ ] Application deployed
- [ ] Migrations applied (if any)
- [ ] Health checks passing
- [ ] E2E smoke tests passed

### Post-Deployment
- [ ] Error rates normal
- [ ] Performance metrics normal
- [ ] Background jobs processing
- [ ] User flows verified
- [ ] Team notified
```

---

**End of Runbook**

For questions or updates, contact the DevOps team or create an issue in the repository.
