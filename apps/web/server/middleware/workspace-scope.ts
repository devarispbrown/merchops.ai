/**
 * Workspace Scope Middleware
 *
 * Enforces tenant isolation by automatically injecting workspaceId
 * into all database queries. This is a critical security control that
 * prevents cross-tenant data access.
 *
 * Security features:
 * - Automatic workspace scoping for all queries
 * - Prevents accidental cross-tenant access
 * - Centralized authorization enforcement
 * - Works with Prisma Client Extensions
 *
 * CRITICAL SECURITY REQUIREMENT:
 * All database queries MUST go through this middleware to ensure
 * proper tenant isolation. Never bypass workspace scoping.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Workspace context for request lifecycle
 *
 * Passed to all middleware and handlers to maintain
 * workspace isolation throughout the request.
 */
export interface WorkspaceContext {
  workspaceId: string;
  userId?: string;
}

/**
 * Create a workspace-scoped Prisma client
 *
 * Returns a Prisma client that automatically injects workspaceId
 * into all queries for tables that have a workspaceId column.
 *
 * This prevents developers from accidentally querying data from
 * other workspaces, which would be a serious security violation.
 *
 * @param workspaceId - Workspace ID to scope all queries to
 * @returns Prisma client with automatic workspace scoping
 *
 * @example
 * ```typescript
 * import { getWorkspaceScopedClient } from '@/server/middleware/workspace-scope';
 *
 * export async function GET(request: Request) {
 *   const session = await getServerSession();
 *   const db = getWorkspaceScopedClient(session.user.workspaceId);
 *
 *   // This query is automatically scoped to the workspace
 *   const opportunities = await db.opportunity.findMany({
 *     where: { state: 'new' }
 *     // workspaceId filter is added automatically
 *   });
 *
 *   return Response.json(opportunities);
 * }
 * ```
 */
export function getWorkspaceScopedClient(workspaceId: string) {
  const prisma = new PrismaClient();

  // List of models that require workspace scoping
  // Add new models here as they are created
  const WORKSPACE_SCOPED_MODELS = [
    'workspace',
    'user',
    'shopifyConnection',
    'event',
    'opportunity',
    'opportunityEventLink',
    'actionDraft',
    'execution',
    'outcome',
    'aiGeneration',
  ] as const;

  // Extend Prisma client to inject workspaceId into all queries
  // Type assertion needed due to dynamic model extension
  return prisma.$extends({
    name: 'workspace-scope',
    query: Object.fromEntries(
      WORKSPACE_SCOPED_MODELS.map((model) => [
        model,
        {
          // Hook into all query methods
          async $allOperations({ operation, model: _model, args, query }: any) {
            // Operations that need workspace scoping
            const scopedOperations = [
              'findUnique',
              'findUniqueOrThrow',
              'findFirst',
              'findFirstOrThrow',
              'findMany',
              'count',
              'aggregate',
              'groupBy',
              'update',
              'updateMany',
              'upsert',
              'delete',
              'deleteMany',
            ];

            // Check if this operation needs scoping
            if (!scopedOperations.includes(operation)) {
              return query(args);
            }

            // Inject workspaceId into where clause
            args.where = {
              ...args.where,
              workspaceId,
            };

            // For create/createMany, inject workspaceId into data
            if (operation === 'create') {
              args.data = {
                ...args.data,
                workspaceId,
              };
            }

            if (operation === 'createMany') {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((item: any) => ({
                  ...item,
                  workspaceId,
                }));
              } else {
                args.data = {
                  ...args.data,
                  workspaceId,
                };
              }
            }

            // For upsert, inject into both create and update
            if (operation === 'upsert') {
              args.create = {
                ...args.create,
                workspaceId,
              };
              args.update = {
                ...args.update,
                workspaceId,
              };
            }

            return query(args);
          },
        },
      ])
    ) as any,
  });
}

/**
 * Middleware function for Next.js API routes
 *
 * Wraps API route handlers to automatically provide a workspace-scoped
 * Prisma client.
 *
 * @param handler - API route handler function
 * @returns Wrapped handler with workspace scoping
 *
 * @example
 * ```typescript
 * import { withWorkspaceScope } from '@/server/middleware/workspace-scope';
 * import { getServerSession } from '@/lib/auth-client';
 *
 * export const GET = withWorkspaceScope(async (request, context) => {
 *   const { db, workspaceId } = context;
 *
 *   // db is automatically scoped to workspaceId
 *   const opportunities = await db.opportunity.findMany({
 *     where: { state: 'new' }
 *   });
 *
 *   return Response.json(opportunities);
 * });
 * ```
 */
export function withWorkspaceScope<TResponse = Response>(
  handler: (
    request: Request,
    context: {
      db: ReturnType<typeof getWorkspaceScopedClient>;
      workspaceId: string;
      userId?: string;
    }
  ) => Promise<TResponse>
) {
  return async (request: Request, _routeContext?: unknown): Promise<TResponse> => {
    // Extract workspace context from session
    const { getServerSession } = await import('@/server/auth/session');
    const session = await getServerSession();

    if (!session?.user?.workspaceId) {
      return new Response('Unauthorized - No workspace context', {
        status: 401,
      }) as TResponse;
    }

    // Create workspace-scoped client
    const db = getWorkspaceScopedClient(session.user.workspaceId);

    // Call handler with scoped client
    try {
      return await handler(request, {
        db,
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
      });
    } finally {
      // Clean up Prisma connection
      await db.$disconnect();
    }
  };
}

/**
 * Validate workspace access
 *
 * Checks if a user has access to a specific workspace.
 * Used for additional authorization checks beyond automatic scoping.
 *
 * @param userId - User ID to check
 * @param workspaceId - Workspace ID to validate access to
 * @param db - Prisma client (can be scoped or unscoped)
 * @returns True if user has access to workspace
 *
 * @example
 * ```typescript
 * import { validateWorkspaceAccess } from '@/server/middleware/workspace-scope';
 *
 * export async function POST(request: Request) {
 *   const session = await getServerSession();
 *   const { workspaceId } = await request.json();
 *
 *   const hasAccess = await validateWorkspaceAccess(
 *     session.user.id,
 *     workspaceId,
 *     prisma
 *   );
 *
 *   if (!hasAccess) {
 *     return new Response('Forbidden', { status: 403 });
 *   }
 *
 *   // Proceed with operation
 * }
 * ```
 */
export async function validateWorkspaceAccess(
  userId: string,
  workspaceId: string,
  db: PrismaClient
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      workspace_id: true,
    },
  });

  return user?.workspace_id === workspaceId;
}

/**
 * Extract workspace ID from request
 *
 * Attempts to extract workspaceId from various sources
 * (headers, query params, session) with proper validation.
 *
 * @param request - HTTP request
 * @returns Workspace ID or null if not found
 */
export async function extractWorkspaceId(
  request: Request
): Promise<string | null> {
  // Try session first (most secure)
  const { getServerSession } = await import('@/server/auth/session');
  const session = await getServerSession();

  if (session?.user?.workspaceId) {
    return session.user.workspaceId;
  }

  // Try custom header (for API keys, webhooks)
  const headerWorkspaceId = request.headers.get('x-workspace-id');
  if (headerWorkspaceId) {
    return headerWorkspaceId;
  }

  // Try query parameter (least secure, only for public endpoints)
  const url = new URL(request.url);
  const queryWorkspaceId = url.searchParams.get('workspaceId');
  if (queryWorkspaceId) {
    return queryWorkspaceId;
  }

  return null;
}

/**
 * Workspace isolation verification helper
 *
 * Verifies that a resource belongs to the specified workspace.
 * Use this for paranoid validation of cross-references.
 *
 * @param resourceId - ID of the resource to verify
 * @param workspaceId - Expected workspace ID
 * @param model - Prisma model name
 * @param db - Prisma client
 * @returns True if resource belongs to workspace
 *
 * @example
 * ```typescript
 * // Verify opportunity belongs to workspace before updating
 * const isValid = await verifyResourceWorkspace(
 *   opportunityId,
 *   session.user.workspaceId,
 *   'opportunity',
 *   db
 * );
 *
 * if (!isValid) {
 *   return new Response('Not found', { status: 404 });
 * }
 * ```
 */
export async function verifyResourceWorkspace(
  resourceId: string,
  workspaceId: string,
  model: keyof PrismaClient,
  db: PrismaClient
): Promise<boolean> {
  try {
    const modelDelegate = db[model] as any;
    if (!modelDelegate?.findUnique) {
      return false;
    }

    const resource = await modelDelegate.findUnique({
      where: { id: resourceId },
      select: { workspaceId: true },
    });

    return resource?.workspaceId === workspaceId;
  } catch {
    return false;
  }
}

/**
 * Workspace isolation test helper
 *
 * Used in tests to verify that workspace isolation is working correctly.
 * Should be used in integration tests for all multi-tenant functionality.
 *
 * @example
 * ```typescript
 * import { testWorkspaceIsolation } from '@/server/middleware/workspace-scope';
 *
 * it('should prevent cross-workspace access', async () => {
 *   const workspaceA = 'workspace-a';
 *   const workspaceB = 'workspace-b';
 *
 *   // Create data in workspace A
 *   const dbA = getWorkspaceScopedClient(workspaceA);
 *   await dbA.opportunity.create({
 *     data: { type: 'test', workspaceId: workspaceA }
 *   });
 *
 *   // Try to access from workspace B
 *   const dbB = getWorkspaceScopedClient(workspaceB);
 *   const results = await dbB.opportunity.findMany();
 *
 *   expect(results).toHaveLength(0); // Should not see workspace A's data
 * });
 * ```
 */
export async function testWorkspaceIsolation(
  workspaceA: string,
  workspaceB: string,
  model: string,
  testData: Record<string, unknown>
): Promise<{
  canAccessOwnData: boolean;
  cannotAccessOtherData: boolean;
  success: boolean;
}> {
  const dbA = getWorkspaceScopedClient(workspaceA);
  const dbB = getWorkspaceScopedClient(workspaceB);

  try {
    // Create data in workspace A
    const modelDelegateA = (dbA as any)[model];
    await modelDelegateA.create({
      data: { ...testData, workspaceId: workspaceA },
    });

    // Verify workspace A can see its own data
    const resultsA = await modelDelegateA.findMany();
    const canAccessOwnData = resultsA.length > 0;

    // Verify workspace B cannot see workspace A's data
    const modelDelegateB = (dbB as any)[model];
    const resultsB = await modelDelegateB.findMany();
    const cannotAccessOtherData = resultsB.length === 0;

    return {
      canAccessOwnData,
      cannotAccessOtherData,
      success: canAccessOwnData && cannotAccessOtherData,
    };
  } finally {
    await dbA.$disconnect();
    await dbB.$disconnect();
  }
}
