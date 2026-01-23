# Authentication System Integration Guide

## Quick Start

### 1. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Generate a secure NextAuth secret:

```bash
openssl rand -base64 32
```

Add to `.env.local`:

```bash
NEXTAUTH_SECRET="your-generated-secret-here"
NEXTAUTH_URL="http://localhost:3000"
DATABASE_URL="postgresql://user:password@localhost:5432/merchops"
```

### 2. Database Migration

Run Prisma migrations to create auth tables:

```bash
npx prisma migrate dev
```

This creates:
- `workspaces` table
- `users` table with password_hash
- Indexes for performance
- Foreign key constraints

### 3. Verify Installation

Check that all auth files are in place:

```
apps/web/
├── server/auth/
│   ├── config.ts          # NextAuth configuration
│   ├── providers.ts       # Credentials provider
│   ├── session.ts         # Session helpers
│   ├── workspace.ts       # Workspace scoping
│   ├── README.md          # Documentation
│   ├── examples.ts        # Usage examples
│   └── workspace.test.ts  # Tests
├── app/api/auth/
│   ├── [...nextauth]/route.ts
│   └── signup/route.ts
├── lib/
│   └── auth-client.ts     # Client utilities
├── components/providers/
│   └── AuthProvider.tsx   # Session provider
└── middleware.ts          # Route protection
```

### 4. Test Authentication Flow

Start the development server:

```bash
npm run dev
```

Test signup:

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "workspaceName": "Test Workspace"
  }'
```

Expected response:

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "workspaceId": "workspace-uuid"
  }
}
```

Test signin:

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

## Integration Patterns

### Server Components

```typescript
// app/dashboard/page.tsx
import { requireAuth, getCurrentWorkspace } from '@/server/auth/session';

export default async function DashboardPage() {
  const session = await requireAuth(); // Redirects if not authenticated
  const workspace = await getCurrentWorkspace();

  return (
    <div>
      <h1>Welcome, {session.user.email}</h1>
      <p>Workspace: {workspace?.name}</p>
    </div>
  );
}
```

### API Routes

```typescript
// app/api/opportunities/route.ts
import { ensureWorkspaceAccess } from '@/server/auth/workspace';
import { prisma } from '@/server/db/client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const workspaceId = await ensureWorkspaceAccess();

    const opportunities = await prisma.opportunity.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ data: opportunities });
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
}
```

### Server Actions

```typescript
// app/actions/opportunities.ts
'use server';

import { requireAuth, getWorkspaceId } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { revalidatePath } from 'next/cache';

export async function dismissOpportunity(id: string) {
  await requireAuth();
  const workspaceId = await getWorkspaceId();

  // Update with workspace verification
  const result = await prisma.opportunity.updateMany({
    where: {
      id,
      workspace_id: workspaceId, // Ensures cross-tenant protection
    },
    data: {
      state: 'dismissed',
    },
  });

  if (result.count === 0) {
    throw new Error('Opportunity not found or access denied');
  }

  revalidatePath('/dashboard');
  return { success: true };
}
```

### Client Components

```typescript
// components/profile/UserMenu.tsx
'use client';

import { useSession, signOut } from '@/lib/auth-client';

export function UserMenu() {
  const { user, isAuthenticated, isLoading } = useSession();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div>
      <span>{user.email}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

## Workspace Scoping Checklist

For every database query, verify workspace isolation:

- [ ] Direct queries include `workspace_id` in WHERE clause
- [ ] Updates include `workspace_id` verification
- [ ] Deletes are scoped to workspace
- [ ] Relations filtered by workspace
- [ ] Aggregations scoped to workspace
- [ ] Batch operations validate ownership

### Safe Query Pattern

```typescript
// ALWAYS include workspace_id
const workspaceId = await getWorkspaceId();

const items = await prisma.model.findMany({
  where: {
    workspace_id: workspaceId, // REQUIRED
    // ... other conditions
  },
});
```

### Unsafe Query Pattern

```typescript
// NEVER query without workspace_id
const items = await prisma.model.findMany({
  where: {
    // Missing workspace_id - DANGEROUS!
    status: 'active',
  },
});
```

## Testing Workspace Isolation

Run the workspace isolation tests:

```bash
npm test server/auth/workspace.test.ts
```

Tests verify:
- Users can only see their workspace data
- Updates only affect own workspace
- Deletes are scoped to workspace
- Relations respect workspace boundaries
- Batch operations validate ownership

## Security Checklist

Before deploying to production:

- [ ] `NEXTAUTH_SECRET` is strong and unique (32+ characters)
- [ ] `NEXTAUTH_URL` matches production domain
- [ ] Database credentials are secure and rotated
- [ ] All queries include workspace_id
- [ ] Middleware protects all dashboard routes
- [ ] CSRF protection enabled on state-changing requests
- [ ] Password validation enforces complexity
- [ ] Error messages don't leak sensitive info
- [ ] Audit logging for authentication events
- [ ] Rate limiting on login attempts (future)

## Common Issues

### Issue: "No workspace found in session"

**Cause**: User not authenticated or session expired

**Solution**:
```typescript
// Ensure requireAuth() is called before getWorkspaceId()
await requireAuth();
const workspaceId = await getWorkspaceId();
```

### Issue: "Access denied: Resource belongs to different workspace"

**Cause**: Attempting to access another workspace's data

**Solution**:
```typescript
// Always include workspace_id in queries
const workspaceId = await getWorkspaceId();
const item = await prisma.model.findFirst({
  where: {
    id: itemId,
    workspace_id: workspaceId, // Verify ownership
  },
});
```

### Issue: "CSRF token validation failed"

**Cause**: Missing CSRF token on POST/PUT/DELETE request

**Solution**:
```typescript
// Add CSRF token header
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': getCsrfToken(), // From session
  },
  body: JSON.stringify(data),
});
```

### Issue: Middleware not protecting routes

**Cause**: Route not matched in middleware config

**Solution**: Verify route pattern in `middleware.ts`:
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public/).*)',
    '/api/:path*',
  ],
};
```

## Performance Considerations

### Database Indexes

Ensure indexes exist on workspace_id for all tables:

```prisma
model Opportunity {
  // ...
  @@index([workspace_id, state])
  @@index([workspace_id, created_at])
}
```

### Session Caching

Sessions are cached via JWT (stateless):
- No database query per request
- 30-day expiration
- Client-side session caching via SessionProvider

### Query Optimization

```typescript
// Good: Single query with workspace scope
const opportunities = await prisma.opportunity.findMany({
  where: { workspace_id: workspaceId },
  include: {
    event_links: {
      include: { event: true },
    },
  },
});

// Bad: Multiple queries without optimization
const opportunities = await prisma.opportunity.findMany({
  where: { workspace_id: workspaceId },
});

for (const opp of opportunities) {
  const events = await prisma.event.findMany({
    where: { /* ... */ },
  }); // N+1 query problem
}
```

## Migration from Other Auth Systems

If migrating from another auth system:

1. Export users with hashed passwords
2. Create migration script:

```typescript
// scripts/migrate-users.ts
import { prisma } from '@/server/db/client';
import bcrypt from 'bcryptjs';

async function migrateUsers(users: LegacyUser[]) {
  for (const user of users) {
    // Create workspace
    const workspace = await prisma.workspace.create({
      data: { name: `${user.name}'s Workspace` },
    });

    // Create user with existing password hash
    await prisma.user.create({
      data: {
        email: user.email,
        password_hash: user.password_hash, // Already hashed
        workspace_id: workspace.id,
      },
    });
  }
}
```

3. Run migration
4. Test authentication
5. Decommission old system

## Next Steps

1. Implement login/signup UI components
2. Add session refresh mechanism
3. Implement password reset flow
4. Add OAuth providers (Google, Shopify)
5. Enable MFA (multi-factor authentication)
6. Add audit logging for auth events
7. Implement rate limiting
8. Add session management UI

## Support

For issues or questions:
1. Check README.md for usage examples
2. Review examples.ts for patterns
3. Run workspace isolation tests
4. Check environment variables
5. Verify database migrations

## Resources

- NextAuth Documentation: https://next-auth.js.org/
- Prisma Documentation: https://www.prisma.io/docs
- OWASP Authentication Cheatsheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
