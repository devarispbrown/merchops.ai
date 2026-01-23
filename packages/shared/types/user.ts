/**
 * User types for MerchOps
 *
 * Users belong to a single workspace in MVP.
 * Auth is handled via NextAuth with email/password or magic link.
 */

/**
 * Core user entity
 */
export interface User {
  /** Unique user identifier */
  id: string;

  /** User email address (unique) */
  email: string;

  /** Optional display name */
  name: string | null;

  /** Associated workspace ID */
  workspaceId: string;

  /** Account creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /**
   * Email verification status
   * Required for certain actions
   */
  emailVerified: Date | null;

  /**
   * User avatar/profile image URL
   * Optional, can be from OAuth provider
   */
  image: string | null;
}

/**
 * User session information
 * Returned from auth providers and used in middleware
 */
export interface UserSession {
  /** Session user data */
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };

  /** Associated workspace ID for session scoping */
  workspaceId: string;

  /** Session expiration timestamp */
  expires: string;
}

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  /** User email (required, must be unique) */
  email: string;

  /** Optional display name */
  name?: string;

  /** Password hash (for email/password auth) */
  passwordHash?: string;

  /** OAuth provider image URL */
  image?: string;
}

/**
 * Input for updating user profile
 */
export interface UpdateUserInput {
  /** New display name (optional) */
  name?: string;

  /** New avatar URL (optional) */
  image?: string;

  /** Email verification status update (optional) */
  emailVerified?: Date;
}

/**
 * Public user profile
 * Safe for client-side consumption, excludes sensitive fields
 */
export interface PublicUserProfile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: Date;
}
