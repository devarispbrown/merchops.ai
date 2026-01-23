// NextAuth v5 Configuration (DEPRECATED - use index.ts instead)
// This file is kept for backwards compatibility but should not be used
// For NextAuth v5, import from "@/server/auth" instead

// NOTE: This file is deprecated in NextAuth v5.
// Please import { auth } from "@/server/auth" instead of using authOptions.
// The main configuration has been moved to server/auth/index.ts

import { credentialsProvider } from "./providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "../db/client";

// Type extensions are in /types/next-auth.d.ts

// This configuration object is deprecated in NextAuth v5
// Use the auth export from index.ts instead
export const authConfig = {
  // Prisma adapter for database session storage
  adapter: PrismaAdapter(prisma),

  // Use JWT strategy for session management (stateless, scalable)
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Authentication providers
  providers: [credentialsProvider],

  // Custom pages
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },

  // Callbacks for session and JWT enrichment
  callbacks: {
    // JWT callback: Enriches token with user data on sign-in
    async jwt({ token, user, trigger, session }: any) {
      // Initial sign in - populate token from user object
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.workspaceId = user.workspace_id;
      }

      // Update session trigger (e.g., from client-side update)
      if (trigger === "update" && session) {
        token.email = session.email ?? token.email;
      }

      return token;
    },

    // Session callback: Exposes token data to client
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.workspaceId = token.workspaceId;
      }

      return session;
    },
  },

  // Security configuration
  secret: process.env.NEXTAUTH_SECRET,

  // Enable debug logging in development
  debug: process.env.NODE_ENV === "development",
};
