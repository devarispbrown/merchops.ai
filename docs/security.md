# MerchOps Security Documentation

## Overview

MerchOps follows a defense-in-depth security strategy with emphasis on proactive threat mitigation, least privilege access, and comprehensive audit trails. This document outlines our security architecture, implementation patterns, and operational practices.

**Security Principles:**
1. Calm over clever - Security controls should be transparent and understandable
2. Control over automation - No security bypasses; explicit verification required
3. Explainability over opacity - All security decisions are auditable
4. Trust compounds faster than features - Security is not negotiable for velocity

---

## OAuth Scopes (Least Privilege)

### Required Scopes by Feature

MerchOps requests the **minimum necessary scopes** for each feature. Scopes are validated during OAuth installation and periodically audited.

#### Read Scopes (Base Requirements)
```
read_products        # Product catalog sync, inventory signals
read_inventory       # Stock level monitoring, out-of-stock detection
read_orders          # Order velocity analysis, customer activity
read_customers       # Customer segmentation, dormancy detection
```

#### Write Scopes (Action Execution Only)
```
write_products       # Pause/unpause products to prevent stockouts
write_price_rules    # Create discount codes for inventory reduction
```

### Scope Justification Table

| Scope | Purpose | Features Enabled | Risk Level |
|-------|---------|------------------|------------|
| `read_products` | Retrieve product catalog, monitor updates | Inventory signals, velocity tracking | Low |
| `read_inventory` | Monitor stock levels across locations | Out-of-stock detection, threshold alerts | Low |
| `read_orders` | Analyze order patterns and velocity | Spike detection, revenue impact | Low |
| `read_customers` | Segment by activity, identify dormancy | Win-back campaigns, re-engagement | Medium |
| `write_products` | Modify product status (active/paused) | Pause low-inventory products | High |
| `write_price_rules` | Create promotional discount codes | Inventory reduction discounts | High |

### Principle of Least Privilege

**Implementation:**
- Scopes are requested **only when needed** for approved actions
- Each write operation validates that the access token contains the required scope
- Scope expansion requires explicit user re-authorization via OAuth flow
- Workspace-level scope audit log tracks all scope grants and revocations

**Token Storage:**
- Access tokens stored encrypted at rest (see Secret Handling section)
- Token refresh implemented with automatic scope validation
- Revoked tokens immediately disable all write operations
- Token rotation enforced on security events

**Scope Validation:**
```typescript
// Example: Validate scope before action execution
async function validateScope(accessToken: string, requiredScope: string): Promise<boolean> {
  const tokenData = await decryptToken(accessToken);
  if (!tokenData.scopes.includes(requiredScope)) {
    logger.warn('Insufficient scope', { required: requiredScope, available: tokenData.scopes });
    throw new InsufficientScopeError(requiredScope);
  }
  return true;
}
```

---

## Webhook Verification

### HMAC-SHA256 Verification Flow

Shopify signs all webhook requests with HMAC-SHA256. **Every incoming webhook MUST be verified** before processing to prevent:
- Spoofed webhook attacks
- Replay attacks
- Data injection via forged payloads

### Verification Algorithm

1. Extract `X-Shopify-Hmac-Sha256` header from incoming request
2. Compute HMAC-SHA256 of the raw request body using the shared webhook secret
3. Compare computed HMAC with provided header using constant-time comparison
4. Reject request if signatures do not match

### Implementation

MerchOps provides a dedicated webhook verification utility at `/apps/web/server/shopify/verify-webhook.ts` with the following features:

- HMAC-SHA256 signature verification with timing-safe comparison
- Replay attack prevention via timestamp validation
- Comprehensive webhook header extraction helpers
- Dedupe key generation for idempotent processing

**Usage Example:**

```typescript
import { verifyWebhookSecure } from '@/server/shopify/verify-webhook';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = verifyWebhookSecure(
    rawBody,
    request.headers,
    process.env.SHOPIFY_API_SECRET
  );

  if (!result.verified) {
    logger.warn('Webhook verification failed', {
      error: result.error,
      shop: result.shopDomain,
      topic: result.topic,
    });
    return new Response('Unauthorized', { status: 401 });
  }

  // Process webhook safely
  const payload = JSON.parse(rawBody);
  await processWebhook(result.shopDomain, result.topic, payload);

  return new Response('OK', { status: 200 });
}
```

### Replay Attack Prevention

**Strategy:**
1. **Timestamp Validation:** Check `X-Shopify-Webhook-Timestamp` header
   - Reject webhooks older than 5 minutes
   - Prevents replay of captured requests

2. **Idempotency Keys:** Every webhook generates a dedupe key
   ```typescript
   const dedupeKey = `${workspaceId}:${topic}:${resourceId}:${timestamp}`;
   ```
   - Stored in `events` table to prevent duplicate processing
   - Enforced via unique constraint on `dedupe_key`

3. **Nonce Tracking (Optional):** For high-security environments
   - Store webhook IDs in short-lived cache (Redis, 10-minute TTL)
   - Reject duplicate webhook IDs

**Implementation:**
```typescript
async function processWebhook(req: Request): Promise<void> {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const timestamp = req.headers['x-shopify-webhook-timestamp'];
  const rawBody = await getRawBody(req);

  // Step 1: Verify HMAC signature
  if (!verifyShopifyWebhook(rawBody, hmacHeader, env.SHOPIFY_WEBHOOK_SECRET)) {
    throw new UnauthorizedError('Invalid webhook signature');
  }

  // Step 2: Check timestamp freshness (prevent replay)
  const webhookTime = parseInt(timestamp, 10) * 1000; // Convert to ms
  const now = Date.now();
  if (now - webhookTime > 5 * 60 * 1000) { // 5 minutes
    throw new WebhookExpiredError('Webhook timestamp too old');
  }

  // Step 3: Dedupe via database constraint
  const payload = JSON.parse(rawBody.toString());
  const dedupeKey = generateDedupeKey(payload);
  await createEvent({ dedupeKey, payload }); // Unique constraint on dedupe_key
}
```

### Error Handling

- **Invalid Signature:** Return 401 immediately, log security event
- **Expired Timestamp:** Return 400, log as potential replay attempt
- **Duplicate Event:** Return 200 (idempotent), do not reprocess
- **Processing Error:** Return 500, allow Shopify retry with exponential backoff

---

## Secret Handling

### Zero-Trust Secret Management

**Core Principles:**
1. Secrets exist **only in environment variables**, never hardcoded
2. Access tokens encrypted at rest using application-level encryption
3. Secrets never logged, never sent to client, never stored in version control
4. Regular key rotation enforced via automated policies

### Environment Variables Only

**Configuration Pattern:**
```bash
# Server-only secrets (NEVER prefixed with NEXT_PUBLIC_)
SHOPIFY_CLIENT_ID=<shopify-app-client-id>
SHOPIFY_CLIENT_SECRET=<shopify-app-secret>
SHOPIFY_WEBHOOK_SECRET=<webhook-signing-secret>
NEXTAUTH_SECRET=<session-signing-key>
DATABASE_URL=<postgres-connection-string>
ENCRYPTION_KEY=<aes-256-key-for-tokens>

# Client-safe configuration (public information only)
NEXT_PUBLIC_APP_URL=https://app.merchops.ai
NEXT_PUBLIC_SHOPIFY_APP_HANDLE=merchops-beta
```

**Validation:**

MerchOps provides comprehensive environment validation at `/apps/web/lib/env.ts`:

- All secrets validated at startup via Zod schema
- Application fails fast if required secrets missing
- Type-safe access prevents accidental exposure
- Strict separation of server-only and client-safe variables
- Automatic type inference for environment variables

**Usage Example:**

```typescript
import { serverEnv, clientEnv, validateEnv } from '@/lib/env';

// Validate on application startup
validateEnv();

// Type-safe access to server-only secrets
const shopifySecret = serverEnv.SHOPIFY_API_SECRET;
const encryptionKey = serverEnv.ENCRYPTION_KEY;

// Client-safe variables (exposed to browser)
const appUrl = clientEnv.NEXT_PUBLIC_APP_URL;
```

### Encryption at Rest for Access Tokens

**Algorithm:** AES-256-GCM (authenticated encryption)

**Implementation:**

MerchOps provides comprehensive cryptography utilities at `/apps/web/lib/crypto.ts`:

- AES-256-GCM authenticated encryption for tokens
- Unique IV generation for each encryption operation
- Authentication tag validation to prevent tampering
- Secure idempotency key generation
- Timing-safe comparison functions
- HMAC utilities for message authentication

**Usage Example:**

```typescript
import { encryptToken, decryptToken, generateIdempotencyKey } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';

// Encrypt access token before storing
const encryptedToken = encryptToken(
  shopifyAccessToken,
  serverEnv.ENCRYPTION_KEY
);

await prisma.shopifyConnection.create({
  data: {
    workspaceId,
    accessTokenEncrypted: encryptedToken,
  },
});

// Decrypt token when needed for API calls
const connection = await prisma.shopifyConnection.findUnique({
  where: { workspaceId },
});

const accessToken = decryptToken(
  connection.accessTokenEncrypted,
  serverEnv.ENCRYPTION_KEY
);

// Generate idempotency key for action execution
const idempotencyKey = generateIdempotencyKey('discount');
```

**Storage Pattern:**
```typescript
// Store encrypted token in database
async function storeAccessToken(workspaceId: string, accessToken: string): Promise<void> {
  const encryptedToken = encrypt(accessToken, env.ENCRYPTION_KEY);

  await prisma.shopifyConnection.upsert({
    where: { workspaceId },
    update: { accessTokenEncrypted: encryptedToken },
    create: { workspaceId, accessTokenEncrypted: encryptedToken }
  });
}

// Retrieve and decrypt token for API calls
async function getAccessToken(workspaceId: string): Promise<string> {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { workspaceId },
    select: { accessTokenEncrypted: true }
  });

  if (!connection) throw new NotFoundError('Shopify connection not found');

  return decrypt(connection.accessTokenEncrypted, env.ENCRYPTION_KEY);
}
```

### Key Rotation Strategy

**Rotation Schedule:**
- `ENCRYPTION_KEY`: Rotate every 90 days
- `NEXTAUTH_SECRET`: Rotate every 90 days
- `SHOPIFY_WEBHOOK_SECRET`: Rotate on security incident or annually
- Access tokens: Refresh via OAuth token exchange every 24 hours (if using online tokens)

**Rotation Process:**
1. Generate new encryption key
2. Decrypt all tokens with old key
3. Re-encrypt with new key
4. Update environment variable
5. Deploy with zero downtime (rolling restart)
6. Archive old key for 30-day recovery window

**Migration Script:**
```typescript
async function rotateEncryptionKey(oldKey: string, newKey: string): Promise<void> {
  const connections = await prisma.shopifyConnection.findMany({
    select: { id: true, accessTokenEncrypted: true }
  });

  for (const conn of connections) {
    const plaintext = decrypt(conn.accessTokenEncrypted, oldKey);
    const reEncrypted = encrypt(plaintext, newKey);

    await prisma.shopifyConnection.update({
      where: { id: conn.id },
      data: { accessTokenEncrypted: reEncrypted }
    });
  }

  logger.info('Encryption key rotation completed', { count: connections.length });
}
```

### Never Log Secrets

**Logging Rules:**
1. Sanitize all log output before writing
2. Redact known secret patterns (tokens, keys, passwords)
3. Never log request bodies containing secrets
4. Audit logs for accidental exposure regularly

**Safe Logging Pattern:**
```typescript
import pino from 'pino';

const logger = pino({
  // Custom serializer to redact secrets
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      // NEVER log headers containing Authorization or API keys
      headers: sanitizeHeaders(req.headers),
    }),
    err: pino.stdSerializers.err,
  },
});

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const safe = { ...headers };
  const sensitiveKeys = ['authorization', 'x-shopify-access-token', 'cookie'];

  for (const key of sensitiveKeys) {
    if (safe[key]) {
      safe[key] = '[REDACTED]';
    }
  }

  return safe;
}
```

---

## Tenant Isolation

### Workspace-Level Data Segregation

**Core Requirement:** Every database query MUST include `workspace_id` filter to prevent cross-tenant data leakage.

### Prisma Client Extension Approach

**Implementation:**

MerchOps provides comprehensive workspace scoping middleware at `/apps/web/server/middleware/workspace-scope.ts`:

- Automatic workspaceId injection into all database queries
- Prevents accidental cross-tenant data access
- Next.js route handler wrapper for easy integration
- Workspace access validation utilities
- Test helpers for verifying tenant isolation

**Usage in API Routes:**

```typescript
import { withWorkspaceScope } from '@/server/middleware/workspace-scope';

// Automatically scoped to authenticated workspace
export const GET = withWorkspaceScope(async (request, context) => {
  const { db, workspaceId } = context;

  // All queries are automatically scoped to workspaceId
  const opportunities = await db.opportunity.findMany({
    where: { state: 'new' },
    // workspaceId filter injected automatically
  });

  return Response.json(opportunities);
});
```

**Manual Scoping:**

```typescript
import { getWorkspaceScopedClient } from '@/server/middleware/workspace-scope';

export async function getOpportunities(workspaceId: string) {
  const db = getWorkspaceScopedClient(workspaceId);

  // All queries automatically include workspaceId filter
  const opportunities = await db.opportunity.findMany();

  await db.$disconnect();
  return opportunities;
}
```

### Database-Level Constraints

**Schema Enforcement:**
```prisma
model Event {
  id          String   @id @default(cuid())
  workspaceId String
  type        String
  payload     Json
  occurredAt  DateTime
  dedupeKey   String
  createdAt   DateTime @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, dedupeKey])
  @@index([workspaceId, occurredAt])
}

model Opportunity {
  id          String   @id @default(cuid())
  workspaceId String
  type        String
  priority    String
  state       String
  createdAt   DateTime @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, state, priority])
}
```

**Key Patterns:**
- Foreign key constraints enforce referential integrity
- Composite unique constraints include `workspaceId`
- Cascade deletes ensure workspace deletion removes all child data
- Indexes optimize workspace-scoped queries

### Test Strategy for Isolation

**Multi-Tenant Test Suite:**
```typescript
// tests/security/tenant-isolation.test.ts
describe('Tenant Isolation', () => {
  let workspace1: Workspace;
  let workspace2: Workspace;

  beforeEach(async () => {
    workspace1 = await createTestWorkspace();
    workspace2 = await createTestWorkspace();
  });

  test('cannot read events from other workspace', async () => {
    // Create event in workspace1
    await createEvent({ workspaceId: workspace1.id, type: 'test' });

    // Query from workspace2 context
    const prisma = getPrismaClientForWorkspace(workspace2.id);
    const events = await prisma.event.findMany();

    expect(events).toHaveLength(0); // Should not see workspace1 events
  });

  test('cannot update opportunities in other workspace', async () => {
    // Create opportunity in workspace1
    const opp = await createOpportunity({ workspaceId: workspace1.id });

    // Attempt update from workspace2 context
    const prisma = getPrismaClientForWorkspace(workspace2.id);

    await expect(
      prisma.opportunity.update({
        where: { id: opp.id },
        data: { state: 'dismissed' },
      })
    ).rejects.toThrow(); // Should fail due to workspace_id mismatch
  });

  test('raw SQL queries must include workspace filter', async () => {
    // Anti-pattern: raw query without workspace filter
    const dangerousQuery = prisma.$queryRaw`
      SELECT * FROM events WHERE type = 'order_created'
    `;

    // This test should FAIL in code review
    // All raw queries must explicitly filter by workspace_id
  });
});
```

**Code Review Checklist:**
- Every Prisma query includes explicit or middleware-injected `workspaceId`
- No raw SQL queries bypass workspace filter
- API routes extract `workspaceId` from authenticated session
- Background jobs receive `workspaceId` as job payload parameter

---

## Authentication Flow

### NextAuth Session Handling

**Session Strategy:** JWT-based sessions with secure storage and CSRF protection.

**Configuration:**
```typescript
// apps/web/server/auth/auth-config.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const user = await verifyCredentials(credentials);
        if (user) {
          return { id: user.id, email: user.email, workspaceId: user.workspaceId };
        }
        return null;
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.workspaceId = user.workspaceId;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.workspaceId = token.workspaceId;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
};
```

### CSRF Protection

**Mechanism:** NextAuth automatically includes CSRF tokens in all state-changing requests.

**Implementation:**
1. Server generates unique CSRF token per session
2. Token embedded in forms and API requests
3. Server validates token on POST/PUT/DELETE requests
4. Mismatched tokens result in 403 Forbidden

**Example:**
```typescript
// Automatic in NextAuth, but for custom routes:
import { getCsrfToken } from 'next-auth/react';

async function submitAction(payload: ActionPayload) {
  const csrfToken = await getCsrfToken();

  const response = await fetch('/api/actions/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}
```

### Session Expiry

**Policy:**
- Active session: 30 days with sliding window
- Inactive timeout: 7 days without activity
- Hard expiry: Force re-authentication after 90 days

**Validation:**
```typescript
export async function validateSession(req: Request): Promise<Session> {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new UnauthenticatedError('No active session');
  }

  // Check last activity timestamp
  const lastActivity = session.user.lastActivityAt;
  const inactiveThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

  if (Date.now() - lastActivity > inactiveThreshold) {
    await signOut();
    throw new SessionExpiredError('Session expired due to inactivity');
  }

  // Update last activity
  await updateLastActivity(session.user.id);

  return session;
}
```

---

## Client Bundle Safety

### No Secrets in NEXT_PUBLIC_* Variables

**Rule:** Only non-sensitive configuration may use `NEXT_PUBLIC_` prefix.

**Allowed:**
```bash
NEXT_PUBLIC_APP_URL=https://app.merchops.ai
NEXT_PUBLIC_SHOPIFY_APP_HANDLE=merchops-beta
NEXT_PUBLIC_SENTRY_DSN=<public-sentry-dsn>
```

**Prohibited:**
```bash
# NEVER DO THIS
NEXT_PUBLIC_SHOPIFY_CLIENT_SECRET=<secret>  # ❌ Exposed in bundle
NEXT_PUBLIC_DATABASE_URL=<url>              # ❌ Exposed in bundle
NEXT_PUBLIC_ENCRYPTION_KEY=<key>            # ❌ Exposed in bundle
```

### Server-Only Imports

**Pattern:** Use `server-only` package to enforce separation.

**Installation:**
```bash
pnpm add server-only
```

**Usage:**
```typescript
// apps/web/lib/server/shopify-api.ts
import 'server-only'; // Throws error if imported on client

export async function fetchShopifyData(workspaceId: string) {
  const accessToken = await getAccessToken(workspaceId); // Safe: server-only
  // ... Shopify API call
}
```

**Client Import Attempt:**
```typescript
// apps/web/components/ProductList.tsx
import { fetchShopifyData } from '@/lib/server/shopify-api'; // ❌ Build fails!
```

**Error Message:**
```
Error: "server-only" module cannot be imported from client code.
```

### Build Verification

**Automated Check:** CI pipeline verifies no secrets in client bundle.

**Script:**
```bash
#!/bin/bash
# scripts/verify-bundle-security.sh

echo "Verifying client bundle security..."

# Build the app
pnpm build

# Search for common secret patterns in client bundles
BUNDLE_DIR=".next/static"

# Patterns to detect (base64-encoded secrets, API keys, etc.)
PATTERNS=(
  "SHOPIFY_CLIENT_SECRET"
  "DATABASE_URL"
  "ENCRYPTION_KEY"
  "NEXTAUTH_SECRET"
  "sk_[a-zA-Z0-9]{32}"  # Stripe secret key pattern
  "xoxb-[0-9]+-[0-9]+"   # Slack token pattern
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  if grep -r "$pattern" "$BUNDLE_DIR" > /dev/null 2>&1; then
    echo "❌ SECURITY ERROR: Found secret pattern in bundle: $pattern"
    FOUND=1
  fi
done

if [ $FOUND -eq 1 ]; then
  echo "❌ Build verification failed: secrets detected in client bundle"
  exit 1
fi

echo "✅ Build verification passed: no secrets in client bundle"
```

**CI Integration:**
```yaml
# .github/workflows/ci.yml
- name: Security - Verify Bundle Safety
  run: |
    pnpm build
    ./scripts/verify-bundle-security.sh
```

---

## OWASP Top 10 Mitigations

### 1. Broken Access Control (A01:2021)

**Threat:** Users accessing resources outside their workspace or privilege level.

**Mitigation:**
- Prisma middleware enforces `workspace_id` on all queries (see Tenant Isolation)
- Server-side authorization checks on every route
- No client-side access control logic
- Admin actions require separate elevated session

**Implementation:**
```typescript
export async function authorizeAction(session: Session, resourceId: string): Promise<void> {
  const resource = await prisma.actionDraft.findUnique({
    where: { id: resourceId },
    select: { workspaceId: true },
  });

  if (!resource || resource.workspaceId !== session.user.workspaceId) {
    throw new ForbiddenError('Access denied');
  }
}
```

### 2. Cryptographic Failures (A02:2021)

**Threat:** Weak encryption, exposed secrets, insecure storage.

**Mitigation:**
- AES-256-GCM for token encryption at rest
- TLS 1.3 for all transit (enforced via CDN/load balancer)
- HTTPS-only cookies with Secure and HttpOnly flags
- No client-side cryptography for secrets

**Implementation:**
```typescript
// Session cookie configuration
cookies: {
  sessionToken: {
    name: '__Secure-next-auth.session-token',
    options: {
      httpOnly: true,
      secure: true, // HTTPS only
      sameSite: 'lax',
      path: '/',
    },
  },
}
```

### 3. Injection (A03:2021)

**Threat:** SQL injection, command injection, template injection.

**Mitigation:**
- Prisma ORM with parameterized queries (no raw SQL)
- Zod input validation on all user inputs
- Content Security Policy headers
- No dynamic code execution functions

**Implementation:**
```typescript
// Validate all inputs with Zod
import { z } from 'zod';

const CreateDiscountSchema = z.object({
  title: z.string().min(1).max(255),
  percentage: z.number().min(0).max(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function createDiscount(input: unknown) {
  const validated = CreateDiscountSchema.parse(input); // Throws if invalid
  // Safe to use validated data
}
```

### 4. Insecure Design (A04:2021)

**Threat:** Fundamental design flaws, lack of threat modeling.

**Mitigation:**
- Explicit approval required for all actions (no auto-execution)
- Immutable audit logs for all state changes
- Rate limiting on sensitive endpoints
- Graceful degradation on external service failures

**Design Principle:**
- "Calm over clever" - predictable, auditable behavior
- "Control over automation" - user always in command loop

### 5. Security Misconfiguration (A05:2021)

**Threat:** Default credentials, verbose errors, unnecessary features enabled.

**Mitigation:**
- Environment variables validated at startup (fail fast)
- Production error messages sanitized (no stack traces to client)
- Security headers configured via middleware
- Unnecessary services disabled (e.g., no GraphQL introspection in prod)

**Implementation:**
```typescript
// apps/web/middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request: Request) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );

  return response;
}
```

### 6. Vulnerable and Outdated Components (A06:2021)

**Threat:** Known vulnerabilities in dependencies.

**Mitigation:**
- Automated dependency scanning via Dependabot
- Weekly dependency audit schedule
- Pinned dependency versions in package.json
- Snyk or npm audit in CI pipeline

**CI Integration:**
```yaml
- name: Security - Audit Dependencies
  run: pnpm audit --audit-level=high
```

### 7. Identification and Authentication Failures (A07:2021)

**Threat:** Weak passwords, credential stuffing, session hijacking.

**Mitigation:**
- NextAuth with bcrypt password hashing (cost factor 12)
- Rate limiting on login endpoints (5 attempts per 15 minutes)
- Session tokens rotated on privilege escalation
- Account lockout after repeated failed attempts

**Implementation:**
```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 8. Software and Data Integrity Failures (A08:2021)

**Threat:** Unsigned updates, insecure CI/CD, tampered data.

**Mitigation:**
- Webhook HMAC verification (see Webhook Verification section)
- Immutable event store prevents retroactive tampering
- Audit logs for all data modifications
- Dependency verification via lock files (pnpm-lock.yaml)

**Integrity Check:**
```typescript
// Verify event has not been tampered with
export async function verifyEventIntegrity(event: Event): Promise<boolean> {
  const computedHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(event.payload) + event.occurredAt.toISOString())
    .digest('hex');

  return computedHash === event.integrityHash;
}
```

### 9. Security Logging and Monitoring Failures (A09:2021)

**Threat:** Insufficient logging, no alerting on security events.

**Mitigation:**
- Structured logging with Pino (all security events logged)
- Sentry for error tracking and alerting
- Correlation IDs for request tracing
- Audit log for all privileged actions

**Logging Pattern:**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'merchops-api' },
});

export function logSecurityEvent(event: SecurityEvent): void {
  logger.warn({
    type: 'security_event',
    event: event.type,
    workspaceId: event.workspaceId,
    userId: event.userId,
    ipAddress: event.ipAddress,
    timestamp: new Date().toISOString(),
  });
}
```

### 10. Server-Side Request Forgery (SSRF) (A10:2021)

**Threat:** Attacker triggers requests to internal services.

**Mitigation:**
- Shopify API calls via official SDK (no user-controlled URLs)
- Webhook URLs validated and whitelisted
- No arbitrary URL fetching based on user input
- Network segmentation (database not exposed to public internet)

**URL Validation:**
```typescript
const ALLOWED_WEBHOOK_DOMAINS = ['shopify.com', 'myshopify.com'];

export function validateWebhookUrl(url: string): boolean {
  const parsed = new URL(url);
  return ALLOWED_WEBHOOK_DOMAINS.some((domain) => parsed.hostname.endsWith(domain));
}
```

---

## Security Monitoring and Incident Response

### Monitoring

**Key Metrics:**
- Failed authentication attempts per IP
- Invalid webhook signatures
- Cross-workspace query attempts (should be zero)
- Unusual API rate spikes
- Token refresh failures

**Alerting:**
- Sentry for application errors
- CloudWatch/Datadog for infrastructure metrics
- PagerDuty for critical security incidents

### Incident Response Runbook

**Detection:**
1. Monitor alerts for security events
2. Investigate anomalies via correlation IDs
3. Query audit logs for affected resources

**Containment:**
1. Revoke compromised access tokens immediately
2. Invalidate user sessions if account compromised
3. Rate limit or block malicious IPs

**Recovery:**
1. Rotate affected secrets (encryption keys, webhook secrets)
2. Notify affected workspaces
3. Restore from backups if data integrity compromised

**Post-Incident:**
1. Document incident timeline
2. Update security controls based on lessons learned
3. Conduct blameless retrospective

---

## Compliance and Audit

### Data Retention

- Access tokens: Encrypted at rest, deleted on OAuth revocation
- Event logs: Retained indefinitely (immutable audit trail)
- User sessions: Expired after 30 days
- Webhook payloads: Retained for 90 days

### PII Minimization

- Customer data retrieved from Shopify as needed, not stored long-term
- Email addresses for win-back campaigns fetched at execution time
- No payment card data stored (violates PCI-DSS scope)

### Audit Trail

Every security-relevant action logged:
- OAuth grants and revocations
- Action approvals and executions
- Workspace access (who viewed what, when)
- Configuration changes

**Query Example:**
```sql
SELECT * FROM audit_logs
WHERE workspace_id = 'ws_abc123'
  AND action_type = 'execution_approved'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

---

## Security Checklist (Beta Release)

**Pre-Launch Verification:**

- [ ] All Shopify webhooks verified via HMAC-SHA256
- [ ] Access tokens encrypted at rest with AES-256-GCM
- [ ] No secrets in client bundle (verified via automated script)
- [ ] Tenant isolation enforced via Prisma middleware
- [ ] Multi-tenant test suite passes (no cross-workspace access)
- [ ] CSRF protection enabled on all state-changing routes
- [ ] Rate limiting configured on authentication endpoints
- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] Dependency audit clean (no high/critical vulnerabilities)
- [ ] Sentry error tracking configured
- [ ] Audit logging enabled for all privileged actions
- [ ] Incident response runbook documented
- [ ] Key rotation procedures tested

---

## Security Utilities Reference

MerchOps provides production-grade security utilities located in the following files:

### 1. Webhook Verification (`/apps/web/server/shopify/verify-webhook.ts`)

**Functions:**
- `verifyShopifyWebhook(rawBody, signature, secret)` - Basic HMAC-SHA256 verification
- `verifyWebhookSecure(rawBody, headers, secret)` - Comprehensive verification with replay protection
- `verifyWebhookTimestamp(timestamp, maxAgeSeconds)` - Prevent replay attacks
- `extractWebhookSignature(headers)` - Safe signature extraction
- `generateWebhookDedupeKey(payload, workspaceId, topic)` - Idempotent processing

**Usage:**
```typescript
import { verifyWebhookSecure } from '@/server/shopify/verify-webhook';

const result = verifyWebhookSecure(rawBody, headers, env.SHOPIFY_API_SECRET);
if (!result.verified) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 2. Environment Validation (`/apps/web/lib/env.ts`)

**Exports:**
- `serverEnv` - Validated server-only environment variables
- `clientEnv` - Validated client-safe environment variables
- `validateEnv()` - Startup validation function
- `isDevelopment()`, `isProduction()`, `isTest()` - Environment checks

**Usage:**
```typescript
import { serverEnv, validateEnv } from '@/lib/env';

validateEnv(); // Call at startup

const shopifySecret = serverEnv.SHOPIFY_API_SECRET;
const encryptionKey = serverEnv.ENCRYPTION_KEY;
```

### 3. Cryptography Utilities (`/apps/web/lib/crypto.ts`)

**Functions:**
- `encryptToken(token, key)` - AES-256-GCM encryption for secrets
- `decryptToken(encrypted, key)` - Authenticated decryption
- `generateIdempotencyKey(prefix)` - Secure idempotency keys
- `generateSecureToken(length)` - Cryptographic random tokens
- `hashValue(value)` - SHA-256 hashing for dedupe keys
- `createHmac(message, secret)` - HMAC generation
- `verifyHmac(message, signature, secret)` - Timing-safe HMAC verification
- `constantTimeEqual(a, b)` - Timing-safe string comparison
- `redactSensitive(value, visibleChars)` - Safe logging

**Usage:**
```typescript
import { encryptToken, decryptToken, generateIdempotencyKey } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';

// Encrypt token before storage
const encrypted = encryptToken(accessToken, serverEnv.ENCRYPTION_KEY);

// Decrypt for API calls
const decrypted = decryptToken(encrypted, serverEnv.ENCRYPTION_KEY);

// Generate idempotency key
const key = generateIdempotencyKey('email');
```

### 4. Workspace Scoping (`/apps/web/server/middleware/workspace-scope.ts`)

**Functions:**
- `getWorkspaceScopedClient(workspaceId)` - Returns auto-scoped Prisma client
- `withWorkspaceScope(handler)` - Next.js route handler wrapper
- `validateWorkspaceAccess(userId, workspaceId, db)` - Access validation
- `verifyResourceWorkspace(resourceId, workspaceId, model, db)` - Resource verification
- `testWorkspaceIsolation(workspaceA, workspaceB, model, data)` - Test helper

**Usage:**
```typescript
import { withWorkspaceScope } from '@/server/middleware/workspace-scope';

export const GET = withWorkspaceScope(async (request, context) => {
  const { db, workspaceId } = context;

  // All queries automatically scoped to workspaceId
  const opportunities = await db.opportunity.findMany();

  return Response.json(opportunities);
});
```

### 5. Tenant Isolation Tests (`/apps/web/tests/integration/security/tenant-isolation.test.ts`)

**Test Coverage:**
- Event isolation across workspaces
- Opportunity isolation
- Action draft isolation
- Execution isolation
- Workspace access validation
- Resource ownership verification
- Query function enforcement (findMany, count, aggregate)

**Running Tests:**
```bash
# Run all security tests
pnpm test:integration tests/integration/security

# Run tenant isolation specifically
pnpm test:integration tests/integration/security/tenant-isolation.test.ts
```

---

## Additional Resources

- [Shopify Webhook Security](https://shopify.dev/docs/apps/webhooks/configuration/https#step-5-verify-the-webhook)
- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [NextAuth Security Best Practices](https://next-auth.js.org/configuration/options#security)
- [Prisma Security](https://www.prisma.io/docs/concepts/more/security)

---

## Contact

For security concerns or to report vulnerabilities:
- Email: security@merchops.ai
- Escalation: security-incidents Slack channel

**Responsible Disclosure Policy:** We appreciate responsible disclosure of security issues. Report vulnerabilities privately before public disclosure.
