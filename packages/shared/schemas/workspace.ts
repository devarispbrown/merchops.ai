/**
 * Workspace Schemas
 *
 * Zod validation schemas for workspace-related operations
 */

import { z } from 'zod';

// Base workspace schema matching Prisma model
export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  created_at: z.date(),
  updated_at: z.date(),
});

// Schema for creating a new workspace
export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(255, 'Workspace name too long'),
});

// Schema for updating a workspace
export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// Schema for workspace ID parameter
export const workspaceIdSchema = z.object({
  id: z.string().uuid('Invalid workspace ID'),
});

// Types
export type Workspace = z.infer<typeof workspaceSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type WorkspaceIdParam = z.infer<typeof workspaceIdSchema>;
