# Post-Deployment Checklist

Use this checklist after deploying MerchOps to any platform to ensure everything is working correctly.

## Overview

This checklist should be completed for:
- ✅ Initial production deployment
- ✅ Major version upgrades
- ✅ Platform migrations
- ✅ New environment setup (staging, production, etc.)

**Estimated time:** 30-45 minutes

---

## 1. Infrastructure Verification

### 1.1 Services Running

Verify all required services are running:

- [ ] **Web service** - Status: Running
- [ ] **Worker service** - Status: Running
- [ ] **PostgreSQL database** - Status: Available
- [ ] **Redis instance** - Status: Available

**How to check:**
- Render: Dashboard → Services (green status)
- Railway: Dashboard → Services (active status)
- Fly.io: `flyctl status`
- Vercel: Dashboard → Deployments (success)

### 1.2 Health Checks

Test health endpoints:

```bash
# Replace with your actual domain
DOMAIN="https://your-app.com"

# Application health check
curl $DOMAIN/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

- [ ] Health endpoint returns 200 OK
- [ ] Response includes timestamp
- [ ] Response time < 2 seconds

### 1.3 Database Connection

Verify database is accessible:

```bash
# Via platform shell
pnpm prisma db pull

# Expected: Schema pulled successfully
```

- [ ] Database connection successful
- [ ] All tables exist
- [ ] Migrations applied

**Check tables:**
```sql
-- Via platform database console or local connection
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Should return tables:
-- Workspace, User, ShopifyConnection, ShopifyObjectCache,
-- Event, Opportunity, OpportunityEventLink, ActionDraft,
-- Execution, Outcome, AiGeneration
```

- [ ] All 11 tables exist
- [ ] Indexes are present (check via `\d+ opportunities`)

### 1.4 Redis Connection

Verify Redis is accessible:

```bash
# Via platform shell or local connection
redis-cli -u $REDIS_URL ping

# Expected: PONG
```

- [ ] Redis connection successful
- [ ] PING returns PONG
- [ ] No authentication errors

---

## 2. Configuration Verification

### 2.1 Environment Variables

Verify all required environment variables are set:

**Required variables:**
- [ ] `DATABASE_URL` - Set and valid
- [ ] `REDIS_URL` - Set and valid
- [ ] `NEXTAUTH_SECRET` - Set (not placeholder)
- [ ] `NEXTAUTH_URL` - Matches actual URL
- [ ] `SHOPIFY_CLIENT_ID` - Set (not placeholder)
- [ ] `SHOPIFY_CLIENT_SECRET` - Set (not placeholder)
- [ ] `SHOPIFY_SCOPES` - All required scopes listed
- [ ] `SHOPIFY_WEBHOOK_SECRET` - Set (not placeholder)
- [ ] `ENCRYPTION_KEY` - Set (64 hex characters)
- [ ] `AI_PROVIDER` - Set to anthropic/openai/ollama
- [ ] `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` - Set
- [ ] `EMAIL_PROVIDER_API_KEY` - Set (not placeholder)
- [ ] `NODE_ENV` - Set to "production"

**Optional but recommended:**
- [ ] `SENTRY_DSN` - Set for error tracking
- [ ] `LOG_LEVEL` - Set to "info" or "warn"

**How to verify:**
```bash
# Via platform shell
echo $DATABASE_URL | grep -q "postgresql://" && echo "✓ DATABASE_URL set"
echo $NEXTAUTH_URL
# Should output your actual domain
```

### 2.2 Secrets Generation

Verify secrets are properly generated (not placeholder values):

```bash
# NEXTAUTH_SECRET should be 32+ random characters
echo $NEXTAUTH_SECRET | wc -c
# Should be > 32

# ENCRYPTION_KEY should be 64 hex characters
echo $ENCRYPTION_KEY | wc -c
# Should be 64

# SHOPIFY_WEBHOOK_SECRET should be 32+ random characters
echo $SHOPIFY_WEBHOOK_SECRET | wc -c
# Should be > 32
```

- [ ] `NEXTAUTH_SECRET` is cryptographically random
- [ ] `ENCRYPTION_KEY` is 64 hex characters
- [ ] `SHOPIFY_WEBHOOK_SECRET` is cryptographically random
- [ ] No secrets contain "your-" or "example-" prefixes

---

## 3. Application Verification

### 3.1 Landing Page

Visit the root URL:

```bash
# Open in browser
open https://your-app.com
```

- [ ] Landing page loads without errors
- [ ] Hero section visible
- [ ] "Join the beta" button works
- [ ] Page is responsive (test on mobile)
- [ ] No console errors in browser DevTools

### 3.2 Authentication Flow

Test user signup and login:

**Signup:**
1. Click "Join the beta" or visit `/signup`
2. Enter email and password
3. Submit form

- [ ] Signup form loads
- [ ] Email validation works
- [ ] Password requirements enforced
- [ ] Successful signup redirects to dashboard
- [ ] User record created in database

**Login:**
1. Log out
2. Visit `/login`
3. Enter same credentials
4. Submit form

- [ ] Login form loads
- [ ] Credentials accepted
- [ ] Successful login redirects to dashboard
- [ ] Session cookie set
- [ ] User stays logged in on refresh

**Verify in database:**
```sql
SELECT email, created_at FROM "User" ORDER BY created_at DESC LIMIT 5;
```

- [ ] Test user exists
- [ ] Email is correct
- [ ] Created timestamp is recent

### 3.3 Dashboard Access

Test protected routes:

```bash
# Visit dashboard (must be logged in)
open https://your-app.com/queue
```

- [ ] Dashboard loads (no 404 or 500)
- [ ] "Connect Shopify" prompt shown (if no store connected)
- [ ] No authentication errors
- [ ] Navigation works

---

## 4. Shopify Integration

### 4.1 OAuth Configuration

Verify Shopify app settings:

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Navigate to Apps → Your App → App Setup

- [ ] App URL matches `NEXTAUTH_URL`
- [ ] Allowed redirection URLs includes:
  ```
  https://your-app.com/api/auth/callback/shopify
  ```
- [ ] Client ID matches `SHOPIFY_CLIENT_ID`
- [ ] Scopes match `SHOPIFY_SCOPES`

### 4.2 OAuth Flow

Test Shopify connection:

1. Log into MerchOps
2. Click "Connect Shopify"
3. Complete OAuth flow with a test store

- [ ] OAuth flow initiates
- [ ] Redirected to Shopify
- [ ] Scope approval screen shows correct permissions
- [ ] After approval, redirected back to MerchOps
- [ ] Success message shown
- [ ] Dashboard shows connected store

**Verify in database:**
```sql
SELECT store_domain, status, installed_at
FROM "ShopifyConnection"
ORDER BY installed_at DESC LIMIT 1;
```

- [ ] Connection record created
- [ ] `status` is "active"
- [ ] `store_domain` matches test store
- [ ] `installed_at` is recent

### 4.3 Initial Sync

Wait for initial data sync (usually 1-5 minutes):

**Check worker logs:**
- Look for: "Starting Shopify initial sync"
- Look for: "Sync completed successfully"

- [ ] Worker logs show sync started
- [ ] No errors in sync process
- [ ] Sync completed within 5 minutes

**Verify in database:**
```sql
SELECT object_type, COUNT(*)
FROM "ShopifyObjectCache"
GROUP BY object_type;
```

- [ ] Products synced (count > 0)
- [ ] Orders synced (if store has orders)
- [ ] Customers synced (if store has customers)

### 4.4 Webhooks

Verify webhooks are registered:

1. In Shopify Admin → Settings → Notifications → Webhooks
2. Check registered webhooks

**Expected webhooks:**
- [ ] `orders/create` → `https://your-app.com/api/webhooks/shopify`
- [ ] `orders/paid` → `https://your-app.com/api/webhooks/shopify`
- [ ] `products/update` → `https://your-app.com/api/webhooks/shopify`
- [ ] `inventory_levels/update` → `https://your-app.com/api/webhooks/shopify`

All should show:
- [ ] Status: Active
- [ ] Recent delivery success (after creating test data)

### 4.5 Webhook Delivery Test

Trigger a webhook:

1. In Shopify Admin, create a test product
2. Wait 10 seconds
3. Check MerchOps logs for webhook receipt

**In logs, look for:**
```
"Webhook received"
"eventType": "products/update"
"Webhook verified successfully"
```

- [ ] Webhook received within 10 seconds
- [ ] HMAC verification passed
- [ ] Event created in database

**Verify in database:**
```sql
SELECT type, occurred_at
FROM "Event"
WHERE type = 'product_updated'
ORDER BY occurred_at DESC LIMIT 1;
```

- [ ] Event record exists
- [ ] `type` matches webhook
- [ ] `occurred_at` is recent

---

## 5. Background Jobs

### 5.1 Worker Startup

Check worker service logs:

**Expected log messages:**
```
"Worker started successfully"
"Connected to Redis"
"Listening for jobs on queues: shopify-sync, event-computation, ..."
```

- [ ] Worker started without errors
- [ ] Redis connection successful
- [ ] All queues registered:
  - [ ] `shopify-sync`
  - [ ] `shopify-webhooks`
  - [ ] `event-computation`
  - [ ] `opportunity-generation`
  - [ ] `action-execution`
  - [ ] `outcome-resolution`

### 5.2 Job Processing

Verify jobs are being processed:

**In worker logs:**
- [ ] Jobs appear in queue
- [ ] Jobs complete successfully
- [ ] No stuck jobs
- [ ] No repeated failures

**Check Redis queue:**
```bash
# Via Redis CLI
redis-cli -u $REDIS_URL

# Check queue lengths
LLEN bull:shopify-sync:waiting
LLEN bull:shopify-sync:active
LLEN bull:shopify-sync:failed

# Should see jobs moving from waiting → active → completed
```

- [ ] Waiting queue decreases over time
- [ ] Active queue shows jobs being processed
- [ ] Failed queue is empty or minimal (< 5)

### 5.3 Job Failures

Check for any failed jobs:

**In logs:**
```
"Job failed"
"error": "..."
```

- [ ] No critical job failures
- [ ] Transient failures retry successfully
- [ ] Error messages are actionable (if any)

**In Redis:**
```bash
# Get failed job count
redis-cli -u $REDIS_URL LLEN bull:shopify-sync:failed

# If > 0, inspect first failed job
redis-cli -u $REDIS_URL LRANGE bull:shopify-sync:failed 0 0
```

- [ ] Failed job count < 5
- [ ] Failed jobs have clear error messages
- [ ] No jobs failing repeatedly with same error

---

## 6. Opportunity Generation

### 6.1 Event Computation

Verify events are being computed from Shopify data:

**Check logs:**
```
"Computing events from Shopify data"
"Event computed: inventory_threshold_crossed"
```

- [ ] Event computation jobs running
- [ ] Events being created
- [ ] No computation errors

**Check database:**
```sql
SELECT type, COUNT(*)
FROM "Event"
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY type;
```

- [ ] Recent events exist
- [ ] Multiple event types present
- [ ] No duplicate events (same `dedupe_key`)

### 6.2 Opportunity Creation

Verify opportunities are being generated:

**Expected timeline:**
- Events created: immediate (< 1 minute)
- Opportunities generated: within 5 minutes of events

**Check logs:**
```
"Generating opportunity from events"
"Opportunity created: inventory_clearance"
```

- [ ] Opportunity generation jobs running
- [ ] Opportunities being created
- [ ] AI generation successful (or fallback templates used)

**Check database:**
```sql
SELECT type, priority_bucket, state, created_at
FROM "Opportunity"
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

- [ ] Recent opportunities exist
- [ ] `priority_bucket` is set (high/medium/low)
- [ ] `why_now` is not empty
- [ ] `counterfactual` is not empty
- [ ] `state` is "new"

### 6.3 Opportunity UI

Verify opportunities appear in dashboard:

1. Log into MerchOps
2. Visit `/queue`

- [ ] Opportunities visible in list
- [ ] Sorted by priority (high first)
- [ ] Each opportunity shows:
  - [ ] Title
  - [ ] Priority badge
  - [ ] Why now summary
  - [ ] Created timestamp
- [ ] Click on opportunity → detail page loads
- [ ] Detail page shows:
  - [ ] Full rationale
  - [ ] Counterfactual
  - [ ] Draft action preview

---

## 7. Action Execution

### 7.1 Draft Creation

Test action draft creation:

1. Open an opportunity
2. Click "Review Draft" or similar

- [ ] Draft action loads
- [ ] Payload preview shown
- [ ] Editable fields identified
- [ ] Approve button visible

### 7.2 Action Approval

Test action approval:

1. Review draft
2. Click "Approve"
3. Confirm approval

- [ ] Approval confirmation modal shown
- [ ] Payload displayed for final review
- [ ] After confirmation, execution starts
- [ ] UI shows "Executing..." state

**Check logs:**
```
"Action approved"
"Execution started"
"executionId": "..."
```

- [ ] Approval logged
- [ ] Execution job queued
- [ ] Idempotency key generated

### 7.3 Execution Completion

Wait for execution to complete (usually < 30 seconds):

**Check logs:**
```
"Execution completed"
"status": "succeeded"
```

- [ ] Execution completes without errors
- [ ] Shopify API call successful (if applicable)
- [ ] Email sent successfully (if applicable)
- [ ] Result stored in database

**Check database:**
```sql
SELECT status, finished_at, error_message
FROM "Execution"
WHERE started_at > NOW() - INTERVAL '1 hour'
ORDER BY started_at DESC
LIMIT 5;
```

- [ ] Execution record exists
- [ ] `status` is "succeeded"
- [ ] `finished_at` is set
- [ ] `error_message` is null

### 7.4 Execution UI

Verify execution appears in UI:

1. Return to opportunity detail page
2. Check execution status

- [ ] Status updated to "Executed"
- [ ] Execution timestamp shown
- [ ] Execution details accessible
- [ ] Opportunity moved out of queue (or marked as resolved)

---

## 8. Error Handling

### 8.1 Sentry Integration

If Sentry is configured:

1. Go to Sentry dashboard
2. Check for errors

- [ ] Sentry receiving events
- [ ] Application errors captured
- [ ] Error context includes:
  - [ ] Correlation ID
  - [ ] User context (workspace ID)
  - [ ] Environment
  - [ ] Breadcrumbs

### 8.2 Intentional Error Test

Trigger an intentional error:

```bash
# Via browser console (while logged in)
fetch('/api/admin/health/error-test', { method: 'POST' })
```

- [ ] Error captured in Sentry (if configured)
- [ ] Error logged locally
- [ ] Application continues to function
- [ ] User not exposed to stack trace

### 8.3 Rate Limiting

Test rate limiting (if enabled):

```bash
# Make 100 rapid requests
for i in {1..100}; do
  curl https://your-app.com/api/health
done
```

- [ ] Rate limit enforced (if configured)
- [ ] 429 status returned after threshold
- [ ] Application doesn't crash
- [ ] Normal requests work after cooldown

---

## 9. Performance Baseline

### 9.1 Page Load Times

Measure key page load times:

**Landing page:**
```bash
curl -w "Time: %{time_total}s\n" -o /dev/null -s https://your-app.com
```

- [ ] < 2 seconds (cold)
- [ ] < 1 second (warm)

**Dashboard (authenticated):**
- [ ] < 2 seconds (initial load)
- [ ] < 500ms (subsequent navigation)

**Opportunity detail:**
- [ ] < 1 second

### 9.2 API Response Times

Test API endpoints:

```bash
# Health check
time curl https://your-app.com/api/health

# Should be < 500ms
```

- [ ] Health endpoint: < 500ms
- [ ] Protected API endpoints: < 1s
- [ ] Database queries: < 500ms

### 9.3 Background Job Processing

Measure job processing times:

**From logs:**
- Event computation: < 5 seconds p95
- Opportunity generation: < 30 seconds p95
- Action execution: < 30 seconds p95

- [ ] Jobs complete within SLO
- [ ] No jobs taking > 60 seconds
- [ ] Queue depth stays low (< 100)

---

## 10. Security Verification

### 10.1 HTTPS Enforcement

```bash
# Try HTTP (should redirect to HTTPS)
curl -I http://your-app.com

# Expected: 301 Moved Permanently or 302 Found
# Location: https://your-app.com
```

- [ ] HTTP redirects to HTTPS
- [ ] SSL certificate valid
- [ ] No mixed content warnings

### 10.2 Authentication

Test unauthenticated access to protected routes:

```bash
# Try to access protected route without auth
curl -I https://your-app.com/queue

# Expected: 302 Found (redirect to login)
```

- [ ] Protected routes require authentication
- [ ] Unauthenticated users redirected to login
- [ ] No data leaked in error messages

### 10.3 Webhook Signature Verification

Test webhook signature verification:

```bash
# Send unsigned webhook
curl -X POST https://your-app.com/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'

# Expected: 401 Unauthorized or 403 Forbidden
```

- [ ] Unsigned webhooks rejected
- [ ] Invalid signatures rejected
- [ ] Valid signatures accepted

### 10.4 Secrets Not Exposed

Check that secrets are not exposed:

```bash
# Check JavaScript bundles for secrets
curl https://your-app.com/_next/static/* | grep -i "secret\|api_key\|password"

# Should return nothing
```

- [ ] No secrets in client bundles
- [ ] No API keys in HTML source
- [ ] No credentials in error messages
- [ ] Environment variables not exposed via API

---

## 11. Monitoring Setup

### 11.1 Platform Monitoring

Configure platform-specific monitoring:

**Render:**
- [ ] Email notifications enabled
- [ ] Service health alerts configured
- [ ] Deployment notifications enabled

**Railway:**
- [ ] Usage alerts configured
- [ ] Service status notifications enabled
- [ ] Cost alerts set

**Fly.io:**
- [ ] Metrics enabled
- [ ] Health check failures alert
- [ ] Scale event notifications

**Vercel:**
- [ ] Deployment notifications enabled
- [ ] Error alerts configured
- [ ] Performance monitoring enabled

### 11.2 Log Aggregation

Verify logs are accessible:

- [ ] Application logs visible in platform dashboard
- [ ] Worker logs separate from web logs
- [ ] Logs include correlation IDs
- [ ] Logs are structured (JSON)
- [ ] Log retention acceptable (7-30 days)

### 11.3 Uptime Monitoring

Set up external uptime monitoring:

**Options:**
- UptimeRobot (free)
- Pingdom
- Better Uptime
- StatusCake

**Configuration:**
- [ ] Monitor: `https://your-app.com/api/health`
- [ ] Interval: 5 minutes
- [ ] Alert: After 2 failed checks
- [ ] Notification: Email/SMS/Slack

### 11.4 Performance Monitoring

If using external APM:

- [ ] Sentry Performance enabled
- [ ] Slow transaction alerts configured
- [ ] Database query performance tracked
- [ ] External API call latency tracked

---

## 12. Backup and Disaster Recovery

### 12.1 Database Backups

Verify database backup configuration:

**Render:**
- [ ] Automatic backups enabled (Standard+ plan)
- [ ] Backup frequency: Daily
- [ ] Retention: 7 days minimum

**Railway:**
- [ ] Database snapshots configured
- [ ] Manual backup tested

**Fly.io:**
- [ ] Postgres backup enabled
- [ ] Snapshot schedule configured

**Vercel + External:**
- [ ] Supabase automatic backups enabled
- [ ] PITR configured (if available)

### 12.2 Manual Backup Test

Perform a manual backup:

```bash
# Backup database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Verify backup file
ls -lh backup-*.sql
# Should show file size > 0
```

- [ ] Manual backup successful
- [ ] Backup file readable
- [ ] Backup file contains data

### 12.3 Restore Test

Test restore process (on non-production data):

```bash
# Restore to test database
psql $TEST_DATABASE_URL < backup-20240123.sql

# Verify data restored
psql $TEST_DATABASE_URL -c "SELECT COUNT(*) FROM \"User\""
```

- [ ] Restore successful
- [ ] Data intact after restore
- [ ] Application works with restored database

### 12.4 Disaster Recovery Plan

Document disaster recovery procedures:

- [ ] Backup location documented
- [ ] Restore procedure documented
- [ ] RTO (Recovery Time Objective) defined: ___ hours
- [ ] RPO (Recovery Point Objective) defined: ___ hours
- [ ] Runbook created with step-by-step recovery

---

## 13. Team Handoff

### 13.1 Documentation

Ensure documentation is complete:

- [ ] README.md updated with production URL
- [ ] Deployment guide reviewed
- [ ] Environment variables documented
- [ ] Runbook created for common operations

### 13.2 Access Control

Set up team access:

- [ ] Platform access granted to team members
- [ ] Database access restricted (read-only for most)
- [ ] Secrets access limited to admins
- [ ] 2FA enabled for all team members

### 13.3 On-Call Setup

Establish on-call procedures:

- [ ] On-call rotation defined
- [ ] Escalation path documented
- [ ] Alert channels configured (Slack/PagerDuty)
- [ ] Runbooks accessible to on-call team

### 13.4 Training

Conduct team training:

- [ ] Deployment process walkthrough
- [ ] Monitoring dashboard tour
- [ ] Log access and debugging
- [ ] Incident response procedures

---

## Checklist Summary

**Total items:** ~120

**Completion status:**
- [ ] Infrastructure (10/10)
- [ ] Configuration (15/15)
- [ ] Application (15/15)
- [ ] Shopify Integration (15/15)
- [ ] Background Jobs (10/10)
- [ ] Opportunity Generation (10/10)
- [ ] Action Execution (10/10)
- [ ] Error Handling (5/5)
- [ ] Performance (10/10)
- [ ] Security (10/10)
- [ ] Monitoring (10/10)
- [ ] Backup and DR (10/10)
- [ ] Team Handoff (10/10)

**Sign-off:**

- [ ] Deployment completed successfully
- [ ] All critical checks passed
- [ ] Production ready

**Completed by:** ___________________

**Date:** ___________________

**Platform:** ___________________

**Notes:**
```
[Any issues or concerns noted during verification]
```

---

## Troubleshooting Common Issues

### Issue: Health check failing

**Symptoms:** `/api/health` returns 500 or times out

**Solutions:**
1. Check application logs for errors
2. Verify `DATABASE_URL` and `REDIS_URL` are correct
3. Restart web service
4. Check database and Redis are running

### Issue: Worker not processing jobs

**Symptoms:** Jobs stuck in queue, worker logs silent

**Solutions:**
1. Verify worker service is running
2. Check `REDIS_URL` matches web service
3. Restart worker service
4. Check Redis connection

### Issue: OAuth flow failing

**Symptoms:** Error after Shopify approval, redirect fails

**Solutions:**
1. Verify `NEXTAUTH_URL` matches actual domain
2. Check Shopify app redirect URLs
3. Verify `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`
4. Check browser console for errors

### Issue: Webhooks not arriving

**Symptoms:** No events created after Shopify changes

**Solutions:**
1. Verify webhooks registered in Shopify Admin
2. Check webhook URL matches `NEXTAUTH_URL`
3. Test webhook delivery in Shopify Admin
4. Check logs for HMAC verification errors

---

## Next Steps After Completion

1. **Monitor for 24 hours**
   - Watch error rates
   - Check performance metrics
   - Verify jobs processing normally

2. **Load testing** (optional)
   - Run load tests against production
   - Verify scaling behavior
   - Identify bottlenecks

3. **User acceptance testing**
   - Have beta users test flows
   - Collect feedback
   - Address any issues

4. **Marketing launch**
   - Announce deployment
   - Enable signups
   - Monitor onboarding funnel

---

**Deployment Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Production URL:** ___________________

**Support Contact:** ___________________
