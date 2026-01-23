// NextAuth v5 Configuration
// Main auth export for NextAuth v5 (Auth.js)
// Handles authentication with workspace scoping for multi-tenant isolation

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { randomUUID } from "crypto";
import { prisma } from "../db/client";
import { credentialsProvider } from "./providers";

// Type extensions are in /types/next-auth.d.ts

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Prisma adapter for database session storage
  adapter: PrismaAdapter(prisma) as any,

  // Use JWT strategy for session management (stateless, scalable)
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days (reduced from 30 days for better security)
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
    async jwt({ token, user, trigger, session }) {
      // Initial sign in - populate token from user object
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.workspaceId = user.workspace_id;
        // Add JWT ID (JTI) for future revocation capability
        token.jti = randomUUID();
      }

      // Update session trigger (e.g., from client-side update)
      if (trigger === "update" && session) {
        token.email = session.email ?? token.email;
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
