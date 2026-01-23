# Security Fixes Validation Checklist

Run this checklist to verify all security fixes are working correctly in your environment.

## Pre-Deployment Validation

### 1. Rate Limiting Verification

**Test Authentication Rate Limiting:**

```bash
# Test rate limiting on signin (should block after 5 attempts)
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-token" \
  -d '{"email": "test@example.com", "password": "wrong"}' \
  --repeat 6

# Expected: First 5 return 400 (invalid credentials), 6th returns 429 (rate limited)
```

**Manual Testing:**
- [ ] Navigate to `/login`
- [ ] Try to login with wrong password 5 times
- [ ] 6th attempt should show: "Too many signin attempts. Please try again in X seconds."
- [ ] Wait for timeout and verify you can try again

### 2. Security Headers Verification

**Check Headers in Browser:**
```bash
curl -I http://localhost:3000
```

**Verify Response Contains:**
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- [ ] `Content-Security-Policy: default-src 'self'...`

**Browser DevTools Check:**
1. [ ] Open browser DevTools (F12)
2. [ ] Go to Network tab
3. [ ] Refresh page
4. [ ] Click on main document request
5. [ ] Check Response Headers section
6. [ ] Verify all security headers present

### 3. Health Endpoint Security

**Test Public Health Endpoint:**
```bash
# Should work without authentication
curl http://localhost:3000/api/health

# Expected: { "status": "ok", "timestamp": "..." }
```

**Test Admin Health Endpoint:**
```bash
# Should require authentication
curl http://localhost:3000/api/admin/health

# Expected: 401 Unauthorized
# { "error": "Authentication required for detailed health information" }
```

**Manual Testing:**
- [ ] Visit `/api/health` (should work, minimal response)
- [ ] Visit `/api/admin/health` without login (should return 401)
- [ ] Login and visit `/api/admin/health` (should show full diagnostics)

### 4. Webhook Replay Protection

**Test Webhook Deduplication:**

This is harder to test manually, but you can verify in logs:

```bash
# Send same webhook twice (requires Shopify webhook setup)
# Check logs for "Webhook validation failed - possible replay attack"
```

**Verification in Code:**
- [ ] Check webhook route at `/apps/web/app/api/shopify/webhooks/route.ts`
- [ ] Verify `validateWebhook()` is called before processing
- [ ] Confirm duplicate webhooks logged as "Webhook validation failed"

### 5. JWT Session Security

**Test Session Duration:**
1. [ ] Login to the application
2. [ ] Note the session expiry time
3. [ ] Verify it expires in 7 days (not 30 days)

**Check JWT Token:**
```javascript
// In browser console after login:
const session = await fetch('/api/auth/session').then(r => r.json());
console.log('Session maxAge:', session);

// Or decode JWT from cookie (use jwt.io)
// Verify 'exp' claim is ~7 days from 'iat'
```

**Verification Steps:**
- [ ] JWT maxAge is 7 days (604,800 seconds)
- [ ] JWT includes `jti` field (unique ID)
- [ ] Session expires after 7 days

### 6. HMAC Timing Attack Protection

**Code Review:**
- [ ] Open `/apps/web/server/shopify/oauth.ts`
- [ ] Find `verifyHmac()` function
- [ ] Verify length check before `timingSafeEqual()`
- [ ] Confirm try-catch around comparison

**Test Shopify OAuth:**
1. [ ] Initiate Shopify OAuth connection
2. [ ] Verify OAuth callback succeeds
3. [ ] Check logs for no HMAC errors
4. [ ] Connection should complete successfully

---

## Automated Testing

### Run All Tests
```bash
pnpm test
```

**Expected Results:**
- [ ] 24 test files passing
- [ ] 592+ tests passing
- [ ] 0 failures
- [ ] Security fixes test file passes all 30 tests

### Run Security Tests Only
```bash
pnpm vitest run tests/unit/security-fixes.test.ts
```

**Expected Results:**
- [ ] 30 tests passing
- [ ] 0 failures
- [ ] All rate limiting tests pass (11)
- [ ] All webhook protection tests pass (12)
- [ ] All HMAC tests pass (3)
- [ ] All JWT tests pass (4)

### Type Checking
```bash
pnpm typecheck
```

**Expected Results:**
- [ ] No type errors
- [ ] All workspaces pass type checking

### Linting
```bash
pnpm lint
```

**Expected Results:**
- [ ] No errors
- [ ] Only warnings are documented (console.log with eslint-disable)

### Build
```bash
pnpm build
```

**Expected Results:**
- [ ] Build completes successfully
- [ ] No compilation errors
- [ ] All routes built correctly

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] All automated tests passing
- [ ] Manual validation completed
- [ ] Security headers verified in staging
- [ ] Rate limiting tested in staging
- [ ] JWT session duration confirmed
- [ ] Webhook protection tested (if applicable)

### Environment Variables
Verify all required variables are set:
- [ ] `NEXTAUTH_SECRET` (existing)
- [ ] `SHOPIFY_API_SECRET` (existing)
- [ ] `SHOPIFY_TOKEN_ENCRYPTION_KEY` (existing)
- [ ] No new environment variables required

### Post-Deployment Verification
- [ ] Check security headers in production (curl -I your-domain.com)
- [ ] Test rate limiting with production domain
- [ ] Verify health endpoints work correctly
- [ ] Monitor logs for any rate limit triggers
- [ ] Monitor logs for webhook validation

### Monitoring Setup
Add these alerts to your monitoring system:

1. **Rate Limiting:**
   - Alert if rate limit store grows > 1000 entries
   - Alert if >100 IPs blocked per hour
   - Alert if any single IP makes >50 blocked attempts

2. **Webhooks:**
   - Alert if >10 duplicate webhooks per hour
   - Alert if >5 expired webhooks per hour
   - Alert if webhook validation failure rate >5%

3. **Authentication:**
   - Alert if HMAC verification failure rate >1%
   - Alert if session creation fails
   - Monitor JTI uniqueness (should be 100% unique)

---

## Rollback Plan

If issues are discovered after deployment:

### Immediate Rollback (Emergency)
```bash
git revert HEAD  # If single commit
# OR
git reset --hard <previous-commit>
git push --force
```

### Selective Rollback (By Feature)

**Disable Rate Limiting:**
```typescript
// In auth.ts, comment out rate limit checks
// if (!ipRateLimit.allowed) { ... }  // Comment this out
```

**Disable Security Headers:**
```javascript
// In next.config.mjs
// Comment out or remove headers() function
```

**Disable Webhook Protection:**
```typescript
// In webhooks/route.ts
// Comment out validateWebhook() check
```

**Revert JWT Changes:**
```typescript
// In server/auth/index.ts
maxAge: 30 * 24 * 60 * 60, // Revert to 30 days
// Remove jti generation
```

---

## Support & Troubleshooting

### Common Issues

**1. Rate Limiting Too Aggressive**
```typescript
// Temporarily increase limits in production
AUTH_RATE_LIMIT = {
  maxAttempts: 10,  // Increase from 5
  windowMs: 15 * 60 * 1000,
}
```

**2. CSP Blocking Resources**
Check browser console for CSP violations:
```
Content Security Policy: The page's settings blocked the loading of a resource
```
Fix by updating CSP in `next.config.mjs`

**3. Webhook Deduplication False Positives**
If legitimate webhooks are rejected:
- Check server time is synchronized (NTP)
- Verify webhook timestamps are correct
- Adjust MAX_WEBHOOK_AGE_MS if needed

**4. Session Expiring Too Quickly**
If 7 days is too short for your use case:
- Increase maxAge in `server/auth/index.ts`
- Document reason for longer sessions
- Consider using refresh tokens

### Debug Logs

Enable detailed security logging:
```typescript
// Add to .env.local
LOG_LEVEL=debug
```

Check logs for:
- `[RateLimit]` - Rate limiting activity
- `[WebhookDedup]` - Webhook validation
- `HMAC verification failed` - OAuth issues
- `Authentication required` - Health endpoint access

---

## Sign-Off

### Development Team
- [ ] All automated tests passing
- [ ] Manual testing completed
- [ ] Code review completed
- [ ] Documentation reviewed

### Security Team
- [ ] Security fixes verified
- [ ] Compliance requirements met
- [ ] Monitoring setup confirmed
- [ ] Incident response plan reviewed

### Operations Team
- [ ] Deployment plan reviewed
- [ ] Rollback plan tested
- [ ] Monitoring configured
- [ ] On-call team briefed

### Product Team
- [ ] User-facing changes reviewed
- [ ] Error messages approved
- [ ] Rate limit UX validated
- [ ] Help documentation updated

---

**Date:** __________
**Validated By:** __________
**Approved By:** __________
**Deployed By:** __________
