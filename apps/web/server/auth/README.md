# MerchOps Authentication System

## Overview

The MerchOps authentication system implements NextAuth (Auth.js) with strict workspace scoping to ensure complete multi-tenant isolation. Every user has exactly one workspace, and all data access is automatically scoped to prevent cross-tenant data leakage.

## Architecture

### Core Components

1. **NextAuth Configuration** (`config.ts`)
   - JWT-based session strategy for stateless authentication
   - Session duration: 30 days
   - Custom session callbacks for workspace enrichment

2. **Credentials Provider** (`providers.ts`)
   - Email/password authentication with bcrypt
   - Input validation using Zod
   - Password requirements: 8+ characters, uppercase, lowercase, number

3. **Session Utilities** (`session.ts`)
   - Server-side session access helpers
   - Workspace access verification
   - Authentication requirement middleware

4. **Workspace Scoping** (`workspace.ts`)
   - Automatic workspace_id injection in queries
   - Cross-tenant access prevention
   - Prisma client extensions for automatic scoping

## Security Features

### Multi-Tenant Isolation

Every database query MUST include `workspace_id` to prevent data leakage:

```typescript
// BAD - No workspace scoping
const opportunities = await prisma.opportunity.findMany();

// GOOD - Workspace scoped
const workspaceId = await getWorkspaceId();
const opportunities = await prisma.opportunity.findMany({
  where: { workspace_id: workspaceId }
});

// BEST - Using helper
const opportunities = await prisma.opportunity.findMany({
  where: await withWorkspaceScope()
});
```

### CSRF Protection

The middleware (`middleware.ts`) validates CSRF tokens on all state-changing requests:
- POST, PUT, DELETE, PATCH require `x-csrf-token` header
- NextAuth routes handle their own CSRF
- Unauthenticated requests don't require CSRF

### Password Security

- **Hashing**: bcrypt with 12 rounds (cost factor)
- **Validation**: Minimum 8 characters, complexity requirements
- **Storage**: Only hashed passwords stored, never plaintext

## Usage Examples

### Server Components

```typescript
import { requireAuth, getCurrentWorkspace } from '@/server/auth/session';

export default async function DashboardPage() {
  // Redirect to login if not authenticated
  const session = await requireAuth();

  // Get workspace with Shopify connection
  const workspace = await getCurrentWorkspace();

  return <div>Welcome, {session.user.email}</div>;
}
```

### API Routes

```typescript
import { ensureWorkspaceAccess } from '@/server/auth/workspace';
import { prisma } from '@/server/db/client';

export async function GET(request: Request) {
  // Verify authentication and get workspace ID
  const workspaceId = await ensureWorkspaceAccess();

  // All queries automatically scoped
  const opportunities = await prisma.opportunity.findMany({
    where: { workspace_id: workspaceId }
  });

  return Response.json(opportunities);
}
```

### Client Components

```typescript
'use client';

import { useSession, signIn, signOut } from '@/lib/auth-client';

export function ProfileButton() {
  const { user, isAuthenticated, isLoading } = useSession();

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <button onClick={() => signIn('user@example.com', 'password')}>
      Sign In
    </button>;
  }

  return (
    <div>
      <span>{user.email}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

## API Endpoints

### Authentication

- **POST /api/auth/signin** - Sign in with credentials
- **POST /api/auth/signout** - Sign out current user
- **GET /api/auth/session** - Get current session
- **POST /api/auth/signup** - Create new user and workspace

### Signup Request

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "workspaceName": "My Store" // Optional
}
```

### Signup Response

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "workspaceId": "workspace-uuid"
  }
}
```

## Environment Variables

Required in `.env`:

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here # Generate with: openssl rand -base64 32

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/merchops
```

## Route Protection

The middleware automatically protects routes:

### Protected Routes
- `/dashboard/*` - Requires authentication
- `/api/*` (except `/api/auth/*`) - Requires authentication

### Public Routes
- `/` - Landing page
- `/login` - Login page
- `/signup` - Signup page
- `/api/auth/*` - Authentication endpoints

## Session Structure

```typescript
{
  user: {
    id: string;        // User UUID
    email: string;     // User email
    workspaceId: string; // Workspace UUID (1:1 with user)
  },
  expires: string;     // ISO timestamp
}
```

## Testing Workspace Isolation

To verify no cross-tenant data access:

```typescript
// Test: User A cannot access User B's data
const userASession = await signIn('usera@example.com', 'password');
const userBOpportunities = await prisma.opportunity.findMany({
  where: { workspace_id: userBWorkspaceId }
});

// Should throw or return empty array
expect(userBOpportunities).toHaveLength(0);
```

## Common Patterns

### Protecting Server Actions

```typescript
'use server';

import { requireAuth } from '@/server/auth/session';
import { ensureWorkspaceAccess } from '@/server/auth/workspace';

export async function createOpportunity(data: OpportunityData) {
  await requireAuth();
  const workspaceId = await ensureWorkspaceAccess();

  return prisma.opportunity.create({
    data: {
      ...data,
      workspace_id: workspaceId,
    }
  });
}
```

### Batch Operations with Validation

```typescript
import { validateWorkspaceOwnership } from '@/server/auth/workspace';

export async function deleteOpportunities(ids: string[]) {
  const opportunities = await prisma.opportunity.findMany({
    where: { id: { in: ids } }
  });

  // Verify all belong to current workspace
  await validateWorkspaceOwnership(opportunities);

  await prisma.opportunity.deleteMany({
    where: { id: { in: ids } }
  });
}
```

## Troubleshooting

### "No workspace found in session"
- User not authenticated
- Session expired
- Check `getServerSession()` is called correctly

### "Access denied: Resource belongs to different workspace"
- Attempted cross-tenant access
- Verify workspace_id in query matches session
- Check workspace scoping helpers are used

### CSRF token validation failed
- Missing `x-csrf-token` header on POST/PUT/DELETE
- Add header from session token
- Check middleware configuration

## Best Practices

1. **Always use workspace helpers** - Never query without workspace_id
2. **Verify ownership** - Use `verifyWorkspaceAccess()` for resource access
3. **Server-side validation** - Never trust client input
4. **Audit logs** - Log all authentication events
5. **Error handling** - Don't leak information in error messages
6. **Session management** - Use `requireAuth()` in protected routes
7. **CSRF protection** - Include token on state-changing requests

## Future Enhancements

- [ ] OAuth providers (Google, Shopify)
- [ ] Magic link authentication
- [ ] Multi-factor authentication (MFA)
- [ ] Session refresh tokens
- [ ] Admin roles and permissions
- [ ] Audit log for authentication events
- [ ] Rate limiting on login attempts
- [ ] Account recovery flow
