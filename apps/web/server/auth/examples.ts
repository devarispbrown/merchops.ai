// Authentication Usage Examples
// Demonstrates common patterns for using the auth system

/**
 * EXAMPLE 1: Protected Server Component
 * Redirect to login if not authenticated
 */
export async function ServerComponentExample() {
  const { requireAuth, getCurrentWorkspace } = await import('./session');

  // This will redirect to /login if not authenticated
  const session = await requireAuth();

  // Get workspace with Shopify connection status
  const workspace = await getCurrentWorkspace();

  return {
    user: session.user,
    workspace,
  };
}

/**
 * EXAMPLE 2: Protected API Route
 * Return 401 if not authenticated
 */
export async function ApiRouteExample() {
  const { ensureWorkspaceAccess } = await import('./workspace');
  const { prisma } = await import('../db/client');

  try {
    // Verify authentication and get workspace ID
    const workspaceId = await ensureWorkspaceAccess();

    // Query with automatic workspace scoping
    const opportunities = await prisma.opportunity.findMany({
      where: {
        workspace_id: workspaceId,
        state: 'new',
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 10,
    });

    return {
      success: true,
      data: opportunities,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication required',
    };
  }
}

/**
 * EXAMPLE 3: Server Action with Workspace Validation
 * Server actions for form submissions
 */
export async function ServerActionExample(formData: FormData) {
  'use server';

  const { requireAuth, getWorkspaceId } = await import('./session');
  const { prisma } = await import('../db/client');

  // Require authentication
  await requireAuth();

  // Get workspace ID
  const workspaceId = await getWorkspaceId();

  // Parse form data
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;

  // Create resource with workspace scoping
  const opportunity = await prisma.opportunity.create({
    data: {
      workspace_id: workspaceId,
      type: 'custom',
      priority_bucket: 'medium',
      why_now: description,
      rationale: title,
      impact_range: 'TBD',
      counterfactual: 'No action taken',
    },
  });

  return { success: true, id: opportunity.id };
}

/**
 * EXAMPLE 4: Batch Operation with Ownership Validation
 * Ensures all items belong to current workspace before deletion
 */
export async function BatchDeleteExample(itemIds: string[]) {
  const { validateWorkspaceOwnership } = await import('./workspace');
  const { prisma } = await import('../db/client');

  // Fetch items
  const items = await prisma.opportunity.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, workspace_id: true },
  });

  // Validate all items belong to current workspace
  await validateWorkspaceOwnership(items);

  // Safe to delete
  await prisma.opportunity.deleteMany({
    where: { id: { in: itemIds } },
  });

  return { success: true, deleted: items.length };
}

/**
 * EXAMPLE 5: Resource Access with Explicit Verification
 * Verify workspace access before returning sensitive data
 */
export async function ResourceAccessExample(opportunityId: string) {
  const { verifyWorkspaceAccess } = await import('./session');
  const { prisma } = await import('../db/client');

  // Fetch opportunity
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
  });

  if (!opportunity) {
    throw new Error('Opportunity not found');
  }

  // Verify it belongs to current workspace
  await verifyWorkspaceAccess(opportunity.workspace_id);

  // Safe to return
  return opportunity;
}

/**
 * EXAMPLE 6: Client Component with Auth Hooks
 * Use auth state in client components
 */
export function ClientComponentExample() {
  // Note: This would be in a real .tsx file
  const code = `
'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export function UserProfile() {
  const { user, isAuthenticated, isLoading } = useSession();
  const router = useRouter();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  return (
    <div>
      <h2>Profile</h2>
      <p>Email: {user.email}</p>
      <p>Workspace: {user.workspaceId}</p>
      <button onClick={signOut}>
        Sign Out
      </button>
    </div>
  );
}
  `;

  return code;
}

/**
 * EXAMPLE 7: Workspace-Scoped Prisma Extension
 * Create a client that automatically scopes all queries
 */
export async function PrismaExtensionExample() {
  const { getWorkspaceId } = await import('./session');
  const { createWorkspaceScopedClient } = await import('./workspace');
  const { prisma } = await import('../db/client');

  // Get workspace ID from session
  const workspaceId = await getWorkspaceId();

  // Create workspace-scoped client
  const scopedPrisma = createWorkspaceScopedClient(prisma, workspaceId);

  // All queries automatically include workspace_id
  const opportunities = await scopedPrisma.opportunity.findMany();
  // Equivalent to:
  // await prisma.opportunity.findMany({ where: { workspace_id: workspaceId }})

  return opportunities;
}

/**
 * EXAMPLE 8: Optional Authentication
 * Allow both authenticated and unauthenticated access
 */
export async function OptionalAuthExample() {
  const { getServerSession } = await import('./session');
  const { prisma } = await import('../db/client');

  const session = await getServerSession();

  if (session?.user) {
    // Return user-specific data
    return {
      authenticated: true,
      workspaceId: session.user.workspaceId,
      data: await prisma.opportunity.findMany({
        where: { workspace_id: session.user.workspaceId },
      }),
    };
  }

  // Return public data
  return {
    authenticated: false,
    data: null,
  };
}

/**
 * EXAMPLE 9: Error Handling Patterns
 * Proper error handling for auth failures
 */
export async function ErrorHandlingExample() {
  const { requireAuth, getWorkspaceId } = await import('./session');

  try {
    await requireAuth();
    const workspaceId = await getWorkspaceId();

    return { success: true, workspaceId };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not authenticated')) {
        // Handle authentication error
        return { success: false, error: 'Please sign in' };
      }
      if (error.message.includes('workspace')) {
        // Handle workspace error
        return { success: false, error: 'Workspace access denied' };
      }
    }

    // Generic error
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * EXAMPLE 10: Custom Middleware for API Routes
 * Reusable middleware pattern for API protection
 */
export function createAuthMiddleware() {
  return async function authMiddleware(
    handler: (workspaceId: string) => Promise<Response>
  ) {
    const { ensureWorkspaceAccess } = await import('./workspace');

    try {
      const workspaceId = await ensureWorkspaceAccess();
      return await handler(workspaceId);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}
