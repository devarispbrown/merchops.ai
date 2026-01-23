// NextAuth v5 Type Extensions
// Extend NextAuth types to include workspace information

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      workspaceId: string;
    };
  }

  interface User {
    id: string;
    email: string;
    workspace_id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    workspaceId: string;
    jti?: string; // JWT ID for future revocation capability
  }
}
