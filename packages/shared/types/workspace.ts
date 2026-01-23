/**
 * Workspace types for MerchOps
 *
 * A workspace represents a single Shopify store in the MVP.
 * For beta, 1 workspace = 1 store = 1 user.
 */

/**
 * Core workspace entity
 * Represents a single Shopify store and its configuration
 */
export interface Workspace {
  /** Unique workspace identifier */
  id: string;

  /** Human-readable workspace name (typically store name) */
  name: string;

  /** Workspace creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /**
   * Workspace status
   * - active: fully operational
   * - suspended: temporarily disabled (billing, abuse, etc.)
   * - deleted: soft-deleted, pending cleanup
   */
  status: 'active' | 'suspended' | 'deleted';

  /**
   * Optional metadata for workspace settings
   * Stored as JSON for extensibility
   */
  settings?: Record<string, unknown>;
}

/**
 * Workspace with associated user information
 * Used in contexts where both workspace and user data are needed
 */
export interface WorkspaceWithUser extends Workspace {
  /** Associated user */
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

/**
 * Input for creating a new workspace
 */
export interface CreateWorkspaceInput {
  /** Workspace name (required) */
  name: string;

  /** User ID to associate with workspace */
  userId: string;

  /** Optional initial settings */
  settings?: Record<string, unknown>;
}

/**
 * Input for updating an existing workspace
 */
export interface UpdateWorkspaceInput {
  /** New workspace name (optional) */
  name?: string;

  /** New status (optional) */
  status?: Workspace['status'];

  /** Updated settings (optional, merges with existing) */
  settings?: Record<string, unknown>;
}
