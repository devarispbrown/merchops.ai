// Workspace Scoping Utilities
// Ensures strict multi-tenant isolation in all database queries

import { getWorkspaceId } from "./session";
import { Prisma } from "@prisma/client";

/**
 * Add workspace_id filter to Prisma query
 * Ensures all queries are automatically scoped to current workspace
 */
export async function withWorkspaceScope<T extends { workspace_id: string }>(
  baseWhere?: Prisma.SelectSubset<T, any>
) {
  const workspaceId = await getWorkspaceId();

  return {
    ...baseWhere,
    workspace_id: workspaceId,
  };
}

/**
 * Ensure workspace access middleware for API routes
 * Use at the start of API handlers to enforce workspace isolation
 */
export async function ensureWorkspaceAccess(
  workspaceId?: string
): Promise<string> {
  const currentWorkspaceId = await getWorkspaceId();

  // If specific workspace ID provided, verify access
  if (workspaceId && workspaceId !== currentWorkspaceId) {
    throw new Error("Access denied: Resource belongs to different workspace");
  }

  return currentWorkspaceId;
}

/**
 * Create a workspace-scoped Prisma client extension
 * Automatically adds workspace_id to all queries
 */
export function createWorkspaceScopedClient(prisma: any, workspaceId: string) {
  return prisma.$extends({
    query: {
      // Automatically add workspace_id to all model queries
      $allModels: {
        async findMany({ model: _model, operation: _operation, args, query }: any) {
          // Add workspace_id to where clause if model has it
          if (args.where) {
            args.where = { ...args.where, workspace_id: workspaceId };
          } else {
            args.where = { workspace_id: workspaceId };
          }

          return query(args);
        },

        async findUnique({ model: _model, operation: _operation, args, query }: any) {
          // Add workspace_id to where clause
          if (args.where) {
            args.where = { ...args.where, workspace_id: workspaceId };
          }

          return query(args);
        },

        async findFirst({ model: _model, operation: _operation, args, query }: any) {
          // Add workspace_id to where clause
          if (args.where) {
            args.where = { ...args.where, workspace_id: workspaceId };
          } else {
            args.where = { workspace_id: workspaceId };
          }

          return query(args);
        },

        async create({ model: _model, operation: _operation, args, query }: any) {
          // Automatically add workspace_id to data
          if (args.data) {
            args.data = { ...args.data, workspace_id: workspaceId };
          }

          return query(args);
        },

        async update({ model: _model, operation: _operation, args, query }: any) {
          // Verify workspace_id in where clause
          if (args.where && !args.where.workspace_id) {
            args.where = { ...args.where, workspace_id: workspaceId };
          }

          return query(args);
        },

        async updateMany({ model: _model, operation: _operation, args, query }: any) {
          // Add workspace_id to where clause
          if (args.where) {
            args.where = { ...args.where, workspace_id: workspaceId };
          } else {
            args.where = { workspace_id: workspaceId };
          }

          return query(args);
        },

        async delete({ model: _model, operation: _operation, args, query }: any) {
          // Verify workspace_id in where clause
          if (args.where && !args.where.workspace_id) {
            args.where = { ...args.where, workspace_id: workspaceId };
          }

          return query(args);
        },

        async deleteMany({ model: _model, operation: _operation, args, query }: any) {
          // Add workspace_id to where clause
          if (args.where) {
            args.where = { ...args.where, workspace_id: workspaceId };
          } else {
            args.where = { workspace_id: workspaceId };
          }

          return query(args);
        },
      },
    },
  });
}

/**
 * Validate that all items belong to the current workspace
 * Useful for batch operations
 */
export async function validateWorkspaceOwnership(
  items: Array<{ workspace_id: string }>
): Promise<boolean> {
  const workspaceId = await getWorkspaceId();

  const allValid = items.every((item) => item.workspace_id === workspaceId);

  if (!allValid) {
    throw new Error(
      "Access denied: One or more items belong to different workspace"
    );
  }

  return true;
}
