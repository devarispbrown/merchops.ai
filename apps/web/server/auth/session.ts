// Session Utilities
// Helper functions for server-side authentication and workspace access

import { auth } from "./index";
import { prisma } from "../db/client";
import { redirect } from "next/navigation";

/**
 * Get current session from server components or API routes
 * Note: In NextAuth v5, use auth() instead of getServerSession()
 */
export async function getServerSession() {
  return await auth();
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use in server components and route handlers
 */
export async function requireAuth() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

/**
 * Get current authenticated user with full details
 */
export async function getCurrentUser() {
  const session = await getServerSession();

  if (!session?.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      workspace_id: true,
      created_at: true,
    },
  });

  return user;
}

/**
 * Get current workspace with full details
 * Returns null if user not authenticated
 */
export async function getCurrentWorkspace() {
  const session = await getServerSession();

  if (!session?.user?.workspaceId) {
    return null;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
    include: {
      shopify_connections: {
        where: { status: "active" },
        take: 1,
      },
    },
  });

  return workspace;
}

/**
 * Get workspace ID from current session
 * Throws if not authenticated
 */
export async function getWorkspaceId(): Promise<string> {
  const session = await getServerSession();

  if (!session?.user?.workspaceId) {
    throw new Error("No workspace found in session");
  }

  return session.user.workspaceId;
}

/**
 * Verify that a resource belongs to the current workspace
 * Prevents cross-tenant data access
 */
export async function verifyWorkspaceAccess(resourceWorkspaceId: string) {
  const session = await getServerSession();

  if (!session?.user?.workspaceId) {
    throw new Error("Not authenticated");
  }

  if (session.user.workspaceId !== resourceWorkspaceId) {
    throw new Error("Access denied: Resource belongs to different workspace");
  }

  return true;
}
