/**
 * User Schemas
 *
 * Zod validation schemas for user authentication and management
 */

import { z } from 'zod';

// Base user schema matching Prisma model
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  password_hash: z.string(),
  workspace_id: z.string().uuid(),
  created_at: z.date(),
});

// Public user schema (without sensitive data)
export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  workspace_id: z.string().uuid(),
  created_at: z.date(),
});

// Schema for user registration
export const registerUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  workspaceName: z
    .string()
    .min(1, 'Workspace name is required')
    .max(255, 'Workspace name too long'),
});

// Schema for user login
export const loginUserSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

// Schema for updating user profile
export const updateUserSchema = z.object({
  email: z.string().email().toLowerCase().trim().optional(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .optional(),
});

// Schema for password reset request
export const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

// Schema for password reset
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

// Types
export type User = z.infer<typeof userSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
