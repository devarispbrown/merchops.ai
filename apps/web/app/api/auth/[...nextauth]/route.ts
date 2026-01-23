// NextAuth v5 Route Handler
// Handles all authentication routes: /api/auth/signin, /api/auth/signout, etc.

import { handlers } from "@/server/auth";

// Export the handlers for GET and POST requests
export const { GET, POST } = handlers;
