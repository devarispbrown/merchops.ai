// Client-Side Authentication Utilities
// Provides hooks and helpers for authentication in client components

"use client";

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import { useSession as useNextAuthSession } from "next-auth/react";

/**
 * Custom useSession hook with type safety
 */
export function useSession() {
  const session = useNextAuthSession();

  return {
    session: session.data,
    status: session.status,
    user: session.data?.user,
    workspaceId: session.data?.user?.workspaceId,
    isAuthenticated: session.status === "authenticated",
    isLoading: session.status === "loading",
  };
}

/**
 * Sign in with credentials
 */
export async function signIn(email: string, password: string) {
  try {
    const result = await nextAuthSignIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return {
        success: false,
        error: result.error === "CredentialsSignin"
          ? "Invalid email or password"
          : result.error,
      };
    }

    if (result?.ok) {
      return {
        success: true,
        url: result.url || "/dashboard",
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred",
    };
  } catch (error) {
    console.error("Sign in error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during sign in",
    };
  }
}

/**
 * Sign out and redirect to login
 */
export async function signOut() {
  try {
    await nextAuthSignOut({
      redirect: true,
      callbackUrl: "/login",
    });
  } catch (error) {
    console.error("Sign out error:", error);
  }
}

/**
 * Sign up new user
 */
export async function signUp(
  email: string,
  password: string,
  workspaceName?: string
) {
  try {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        workspaceName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Signup failed",
        details: data.details || [],
      };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (error) {
    console.error("Sign up error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during signup",
    };
  }
}

/**
 * Check if user is authenticated (client-side only)
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useSession();

  return {
    isAuthenticated,
    isLoading,
  };
}

/**
 * Get workspace ID from session
 */
export function useWorkspaceId() {
  const { workspaceId } = useSession();
  return workspaceId;
}

/**
 * Get current user from session
 */
export function useCurrentUser() {
  const { user } = useSession();
  return user;
}
