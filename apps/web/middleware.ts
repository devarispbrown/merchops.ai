// Next.js Middleware
// Protects routes and handles authentication redirects with CSRF protection
// Also adds correlation IDs for request tracing

// Use Node.js runtime instead of Edge to support Prisma and process.on
export const runtime = "nodejs";

import { auth } from "@/server/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import {
  generateCorrelationId,
  extractCorrelationIdFromHeaders,
} from "./lib/correlation";

// Extend NextRequest to include auth from NextAuth v5 middleware
interface AuthenticatedRequest extends NextRequest {
  auth: Session | null;
}

// Public routes that don't require authentication
const publicRoutes = ["/", "/login", "/signup", "/verify-request"];

// API routes that don't require authentication
const publicApiRoutes = ["/api/auth", "/api/health", "/api/billing/webhooks"];

/**
 * Check if route is public
 */
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname === route);
}

/**
 * Check if API route is public
 */
function isPublicApiRoute(pathname: string): boolean {
  return publicApiRoutes.some((route) => pathname.startsWith(route));
}

/**
 * CSRF token validation for state-changing requests
 */
function validateCsrfToken(request: NextRequest): boolean {
  const method = request.method;

  // Only validate on state-changing methods
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return true;
  }

  // Skip CSRF for NextAuth routes (they handle their own CSRF)
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return true;
  }

  // Get CSRF token from header
  const csrfToken = request.headers.get("x-csrf-token");
  const sessionToken = request.cookies.get("next-auth.session-token")?.value ||
                      request.cookies.get("__Secure-next-auth.session-token")?.value;

  // Require CSRF token for authenticated requests
  if (sessionToken && !csrfToken) {
    console.warn(`CSRF token missing for ${method} ${request.nextUrl.pathname}`);
    return false;
  }

  return true;
}

/**
 * Main middleware function
 * NextAuth v5 uses auth() as middleware directly
 */
export default auth(async function middleware(request: AuthenticatedRequest) {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  // Extract or generate correlation ID
  const correlationId =
    extractCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  // Log incoming request with correlation ID
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${correlationId}] ${request.method} ${pathname}`);
  }

  // Public routes that don't need authentication checks
  if (isPublicRoute(pathname) || isPublicApiRoute(pathname)) {
    const response = NextResponse.next();
    response.headers.set('X-Correlation-ID', correlationId);
    return response;
  }

  // Validate CSRF token for state-changing requests
  if (!validateCsrfToken(request)) {
    const response = NextResponse.json(
      { error: "CSRF token validation failed" },
      { status: 403 }
    );
    response.headers.set('X-Correlation-ID', correlationId);
    return response;
  }

  // Handle authenticated users accessing auth pages
  if (session && (pathname === "/login" || pathname === "/signup")) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.headers.set('X-Correlation-ID', correlationId);
    return response;
  }

  // Handle unauthenticated users accessing protected routes
  if (!session && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set('X-Correlation-ID', correlationId);
    return response;
  }

  // Handle API routes
  if (pathname.startsWith("/api")) {
    // Public API routes already handled above

    // Protected API routes require authentication
    if (!session) {
      const response = NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
      response.headers.set('X-Correlation-ID', correlationId);
      return response;
    }
  }

  // Add correlation ID to all responses
  const response = NextResponse.next();
  response.headers.set('X-Correlation-ID', correlationId);
  return response;
});

/**
 * Middleware configuration
 * Specifies which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|public/).*)",
    "/api/:path*",
  ],
};
