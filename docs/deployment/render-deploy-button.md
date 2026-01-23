# Render Deploy Button

Deploy MerchOps to Render with one click using the Blueprint.

## Deploy Now

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/your-org/merchops.ai)

**Note:** Replace `your-org/merchops.ai` with your actual GitHub repository URL.

## What Gets Deployed

The Render Blueprint (`render.yaml`) automatically provisions:

1. **Web Service** (`merchops-web`)
   - Next.js application
   - Auto-scaling enabled
   - Health check at `/api/health`
   - Automatic HTTPS

2. **Worker Service** (`merchops-worker`)
   - Background job processor
   - Connects to same database and Redis
   - Runs BullMQ workers

3. **PostgreSQL Database** (`merchops-db`)
   - Managed PostgreSQL 16
   - Automatic backups
   - Connection string auto-injected

4. **Redis Instance** (`merchops-redis`)
   - Managed Redis
   - Used for job queue and caching
   - Connection string auto-injected

## Post-Deployment Steps

After clicking the deploy button and services are provisioned:

### 1. Set Environment Variables

In the Render Dashboard, configure these variables (not auto-generated):

**Application URL:**
```bash
NEXTAUTH_URL=https://merchops-web.onrender.com
# Update with your actual Render URL or custom domain
```

**Shopify OAuth:**
```bash
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
```

Get these from:
1. [Shopify Partners Dashboard](https://partners.shopify.com)
2. Apps → Your App → App Setup
3. Copy Client ID and Client Secret

**AI Provider:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
# OR
OPENAI_API_KEY=sk-proj-...
```

Get from [Anthropic Console](https://console.anthropic.com) or [OpenAI Platform](https://platform.openai.com)

**Email Provider:**
```bash
EMAIL_PROVIDER_API_KEY=re_...
```

Get from [Resend](https://resend.com) or [SendGrid](https://sendgrid.com)

**Optional - Error Tracking:**
```bash
SENTRY_DSN=https://...@sentry.io/...
```

Get from [Sentry](https://sentry.io)

### 2. Run Database Migrations

After environment variables are set:

1. Go to `merchops-web` service in Render Dashboard
2. Click "Shell" tab
3. Run:
   ```bash
   pnpm prisma migrate deploy
   ```
4. Wait for migrations to complete

### 3. Verify Deployment

**Health Check:**
```bash
curl https://merchops-web.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-23T..."
}
```

**Application Access:**
1. Visit your Render URL: `https://merchops-web.onrender.com`
2. You should see the MerchOps landing page
3. Click "Join the beta" to sign up

**Worker Verification:**
1. Go to `merchops-worker` service in Render Dashboard
2. Click "Logs" tab
3. Look for: `Worker started successfully`

### 4. Configure Shopify App

Update your Shopify app settings to allow OAuth callbacks:

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Navigate to Apps → Your App → App Setup
3. Add to "App URL":
   ```
   https://merchops-web.onrender.com
   ```
4. Add to "Allowed redirection URL(s)":
   ```
   https://merchops-web.onrender.com/api/auth/callback/shopify
   ```
5. Save changes

### 5. Test OAuth Flow

1. Sign up for a new account on your deployed app
2. Click "Connect Shopify"
3. Complete OAuth flow with a Shopify store
4. Verify connection in dashboard

## Auto-Deploy

The Blueprint is configured for automatic deploys:

- **Trigger:** Any push to `main` branch
- **Services updated:** Both web and worker
- **Zero downtime:** Render uses rolling deploys

**To disable auto-deploy:**
1. Go to service settings in Render Dashboard
2. Uncheck "Auto-Deploy"

## Scaling

### Horizontal Scaling

**Web Service:**
1. Dashboard → `merchops-web` → Settings
2. Change instance count (e.g., 2-5 instances)
3. Render automatically load balances

**Worker Service:**
1. Dashboard → `merchops-worker` → Settings
2. Add more worker instances for higher job throughput

### Vertical Scaling

**Upgrade Plans:**

| Plan | RAM | CPU | Price | Use Case |
|------|-----|-----|-------|----------|
| Starter | 512MB | Shared | $7/mo | Testing/dev |
| Standard | 2GB | 1 CPU | $25/mo | Production |
| Pro | 4GB | 2 CPU | $85/mo | High traffic |

**Recommendations:**
- Web: Standard plan for production (2GB RAM)
- Worker: Starter for low volume, Standard for production
- Database: Standard for production (4GB RAM, daily backups)
- Redis: Standard for production (1GB memory)

**Estimated production cost:** $70-100/month

## Custom Domain

### Add Custom Domain

1. Dashboard → `merchops-web` → Settings → Custom Domains
2. Add your domain (e.g., `app.merchops.com`)
3. Update DNS records:
   ```
   Type: CNAME
   Name: app
   Value: merchops-web.onrender.com
   ```
4. Wait for DNS propagation (5-60 minutes)
5. Render automatically provisions SSL certificate

### Update Environment Variables

After custom domain is active:

```bash
NEXTAUTH_URL=https://app.merchops.com
```

Also update in Shopify app settings.

## Monitoring

### Built-in Monitoring

Render provides:
- CPU/Memory metrics
- Request logs
- Error alerts
- Uptime monitoring

**Access:**
1. Dashboard → Service → Metrics tab
2. Dashboard → Service → Logs tab

### Custom Alerts

1. Dashboard → Service → Settings → Notifications
2. Add notification channels:
   - Email
   - Slack
   - PagerDuty
   - Webhook

**Recommended alerts:**
- Service crashes
- High error rate
- Memory/CPU threshold exceeded

### External Monitoring

For comprehensive monitoring, integrate:
- **Sentry:** Error tracking and performance
- **Datadog/New Relic:** APM (via buildpack)
- **Better Stack:** Log aggregation

## Troubleshooting

### Build Failures

**Error: `Cannot find module '@prisma/client'`**

**Solution:**
Ensure build command includes `pnpm prisma:generate`:
```yaml
buildCommand: pnpm install && pnpm prisma:generate && pnpm build
```

This is already in `render.yaml`, so re-deploy should fix it.

### Database Connection Issues

**Error: `Can't reach database server`**

**Solution:**
1. Verify `DATABASE_URL` is set correctly
2. Check database service is running
3. Verify IP allowlist includes Render IPs (should be empty for all Render services)

### Worker Not Processing Jobs

**Symptom:** Jobs queued but not executing

**Solution:**
1. Check worker logs for errors
2. Verify `REDIS_URL` matches web service
3. Restart worker service
4. Ensure worker has all required environment variables

### Slow Performance

**Free Tier Limitations:**
- Services spin down after 15 minutes of inactivity
- First request after spin-down is slow (30-60 seconds)

**Solution:**
- Upgrade to paid plan (services stay running)
- Or use external uptime monitor to ping health endpoint

## Backup and Recovery

### Automated Backups

**Database:**
- Starter plan: No automatic backups
- Standard/Pro: Daily backups, 7-day retention

**Enable backups:**
1. Dashboard → `merchops-db` → Backups
2. Upgrade to Standard plan
3. Backups run daily at 3 AM UTC

### Manual Backups

```bash
# Via Render Dashboard
1. Go to database service
2. Click "Backups" tab
3. Click "Create Backup"

# Via pg_dump (external)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Recovery

**Restore from backup:**
1. Dashboard → Database → Backups
2. Select backup to restore
3. Click "Restore"
4. Confirm (this will overwrite current data)

**Restore from manual backup:**
```bash
psql $DATABASE_URL < backup-20240123.sql
```

## Security Best Practices

### Environment Variables

1. **Never commit secrets**
   - All secrets stored in Render Dashboard
   - Use `.env.example` for documentation only

2. **Rotate secrets periodically**
   - Regenerate `NEXTAUTH_SECRET` quarterly
   - Rotate API keys annually
   - Rotate `ENCRYPTION_KEY` only during planned migration

3. **Use different secrets per environment**
   - Production secrets ≠ staging secrets
   - Never reuse production secrets in development

### Access Control

1. **Limit team access**
   - Dashboard → Team → Members
   - Use "Deploy only" role for most team members
   - Restrict "Owner" role to 1-2 people

2. **Enable 2FA**
   - Dashboard → Account → Security
   - Require 2FA for all team members

### Network Security

1. **IP Allowlisting**
   - Database: Allow only Render IPs (empty list = all Render services)
   - Redis: Same as database

2. **SSL/TLS**
   - Enabled by default
   - Force HTTPS (already configured in web service)

## Performance Optimization

### Caching

**Static Assets:**
- Next.js automatically caches static files
- Served via Render CDN

**API Routes:**
```typescript
// Add caching headers
export const revalidate = 60; // Cache for 60 seconds
```

**Redis Caching:**
Already implemented for frequently accessed data.

### Database

**Connection Pooling:**
Add to `DATABASE_URL`:
```
?connection_limit=10&pool_timeout=20
```

**Indexes:**
Already defined in `prisma/schema.prisma`. No additional configuration needed.

### Worker Optimization

**Concurrency:**
Configured in `server/jobs/worker.ts`:
```typescript
// Adjust based on job type and volume
concurrency: 5 // Per worker instance
```

**Auto-scaling Workers:**
1. Monitor queue depth in logs
2. Scale workers if depth consistently > 100
3. Reduce workers if CPU idle > 80%

## Cost Optimization

### Free Tier Limits

Render Free tier includes:
- 750 hours/month of compute
- 1GB PostgreSQL
- 512MB Redis
- 100GB bandwidth

**Enough for:**
- Development/staging environments
- Low-traffic production (< 1000 req/day)

### Paid Tier Costs

**Minimal Production Setup:**
- Web (Standard): $25/month
- Worker (Starter): $7/month
- PostgreSQL (Standard): $20/month
- Redis (Standard): $10/month
- **Total:** $62/month

**Recommended Production Setup:**
- Web (Standard, 2 instances): $50/month
- Worker (Standard): $25/month
- PostgreSQL (Pro): $45/month
- Redis (Standard): $10/month
- **Total:** $130/month

### Cost Reduction Tips

1. **Use shared databases for dev/staging**
2. **Scale down non-production environments**
3. **Use auto-suspend for preview environments**
4. **Monitor bandwidth usage** (add CDN if needed)
5. **Right-size plans** based on actual metrics

## Support

### Render Support

- **Documentation:** [render.com/docs](https://render.com/docs)
- **Community:** [community.render.com](https://community.render.com)
- **Support:** support@render.com (paid plans)

### MerchOps Support

- **Documentation:** [docs/](../../docs/)
- **Issues:** GitHub Issues
- **Security:** security@merchops.ai

## Next Steps

After successful deployment:

1. **Set up monitoring** - Configure Sentry and log alerts
2. **Enable backups** - Upgrade database to Standard plan
3. **Add custom domain** - Professional appearance
4. **Load testing** - Verify performance under load
5. **Team training** - Onboard team on deployment process
6. **Runbook** - Document environment-specific details

---

**Questions?** See [Full Deployment Guide](./README.md) or open an issue.
