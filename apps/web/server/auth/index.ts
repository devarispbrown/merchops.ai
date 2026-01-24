// NextAuth v5 Configuration
// Main auth export for NextAuth v5 (Auth.js)
// Handles authentication with workspace scoping for multi-tenant isolation

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "../db/client";
import { getEnabledProviders } from "./providers";

// Type extensions are in /types/next-auth.d.ts

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Prisma adapter for database session storage
  adapter: PrismaAdapter(prisma) as any,

  // Use JWT strategy for session management (stateless, scalable)
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  // Authentication providers (dynamically loaded based on env config)
  providers: getEnabledProviders(),

  // Custom pages
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
    verifyRequest: "/verify-request", // Magic link confirmation page
  },

  // Event handlers
  events: {
    // Create workspace for OAuth users on first sign in
    async createUser({ user }) {
      // Check if user already has a workspace (shouldn't happen, but safety check)
      const existingUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { workspace_id: true },
      });

      if (existingUser?.workspace_id) {
        return; // Already has workspace
      }

      // Create workspace for new OAuth user
      const workspaceName = user.email
        ? `${user.email.split("@")[0]}'s Workspace`
        : `${user.name || "My"}'s Workspace`;

      const workspace = await prisma.workspace.create({
        data: {
          name: workspaceName,
        },
      });

      // Link user to workspace
      await prisma.user.update({
        where: { id: user.id },
        data: { workspace_id: workspace.id },
      });

      console.log(`Created workspace for OAuth user: ${user.email}`);
    },
  },

  // Callbacks for session and JWT enrichment
  callbacks: {
    // Allowed to sign in check
    async signIn({ user, account }) {
      // Allow all OAuth providers
      if (account?.provider !== "credentials") {
        return true;
      }

      // For credentials, user must exist (handled by authorize)
      return !!user;
    },

    // JWT callback: Enriches token with user data on sign-in
    async jwt({ token, user, trigger, session, account }) {
      // Initial sign in - populate token from user object
      if (user) {
        token.id = user.id;
        token.email = user.email;

        // For OAuth users, we need to fetch workspace_id from database
        // since it's created in the createUser event
        if (account?.provider !== "credentials") {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { workspace_id: true },
          });
          token.workspaceId = dbUser?.workspace_id;
        } else {
          token.workspaceId = user.workspace_id;
        }

        // Add JWT ID (JTI) for future revocation capability
        token.jti = crypto.randomUUID();
      }

      // Update session trigger (e.g., from client-side update)
      if (trigger === "update" && session) {
        token.email = session.email ?? token.email;

        // Refresh workspace ID if needed
        if (!token.workspaceId && token.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { workspace_id: true },
          });
          token.workspaceId = dbUser?.workspace_id;
        }
      }

      return token;
    },

    // Session callback: Exposes token data to client
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.workspaceId = token.workspaceId as string;
      }

      return session;
    },
  },

  // Security configuration
  secret: process.env.NEXTAUTH_SECRET,

  // Enable debug logging in development
  debug: process.env.NODE_ENV === "development",
});
