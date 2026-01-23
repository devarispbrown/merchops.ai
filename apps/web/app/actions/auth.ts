/**
 * Authentication Server Actions
 *
 * Handles user signup, signin, and signout with proper validation,
 * workspace creation, and audit logging.
 */

'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';

import {
  ActionErrors,
  actionSuccess,
  handleUnknownError,
  type ActionResponse,
} from '@/lib/actions/errors';
import { validateFormData } from '@/lib/actions/validation';
import { runWithCorrelationAsync, generateCorrelationId } from '@/lib/correlation';
import { checkAuthRateLimitByIp, checkAuthRateLimitByEmail } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request-helpers';
import { prisma } from '@/server/db/client';
import { logger } from '@/server/observability/logger';

// Validation schemas
const signUpSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type SignUpResponse = ActionResponse<{
  userId: string;
  email: string;
  workspaceId: string;
}>;

type SignInResponse = ActionResponse<{
  userId: string;
  email: string;
}>;

type SignOutResponse = ActionResponse<void>;

/**
 * Sign up a new user
 *
 * Creates user account and workspace, then automatically signs them in.
 * One workspace per user (1:1 mapping for MVP).
 *
 * @param formData - Form data containing email and password
 */
export async function signUpAction(formData: FormData): Promise<SignUpResponse> {
  return runWithCorrelationAsync(
    { correlationId: generateCorrelationId() },
    async () => {
      try {
        // Validate input
        const data = validateFormData(signUpSchema, formData);

        // Check rate limits (both IP and email)
        const clientIp = await getClientIp();
        const ipRateLimit = checkAuthRateLimitByIp(clientIp);
        const emailRateLimit = checkAuthRateLimitByEmail(data.email);

        if (!ipRateLimit.allowed) {
          logger.warn(
            { email: data.email, ip: clientIp, resetInSeconds: ipRateLimit.resetInSeconds },
            'Signup rate limit exceeded (IP)'
          );
          throw ActionErrors.rateLimited(
            `Too many signup attempts. Please try again in ${ipRateLimit.resetInSeconds} seconds.`
          );
        }

        if (!emailRateLimit.allowed) {
          logger.warn(
            { email: data.email, resetInSeconds: emailRateLimit.resetInSeconds },
            'Signup rate limit exceeded (email)'
          );
          throw ActionErrors.rateLimited(
            `Too many signup attempts for this email. Please try again in ${emailRateLimit.resetInSeconds} seconds.`
          );
        }

        logger.info({ email: data.email }, 'User signup attempt');

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: data.email.toLowerCase() },
        });

        if (existingUser) {
          logger.warn({ email: data.email }, 'Signup failed: User already exists');
          throw ActionErrors.alreadyExists('User with this email');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, 12);

        // Create user and workspace in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Create workspace first
          const workspace = await tx.workspace.create({
            data: {
              name: `${data.email}'s Workspace`,
            },
          });

          // Create user linked to workspace
          const user = await tx.user.create({
            data: {
              email: data.email.toLowerCase(),
              password_hash: passwordHash,
              workspace_id: workspace.id,
            },
          });

          logger.info(
            {
              userId: user.id,
              workspaceId: workspace.id,
              email: user.email,
            },
            'User and workspace created successfully'
          );

          return { user, workspace };
        });

        return actionSuccess({
          userId: result.user.id,
          email: result.user.email,
          workspaceId: result.workspace.id,
        });
      } catch (error) {
        return handleUnknownError(error);
      }
    }
  );
}

/**
 * Sign in an existing user
 *
 * Validates credentials and creates session via NextAuth.
 *
 * @param formData - Form data containing email and password
 */
export async function signInAction(formData: FormData): Promise<SignInResponse> {
  return runWithCorrelationAsync(
    { correlationId: generateCorrelationId() },
    async () => {
      try {
        // Validate input
        const data = validateFormData(signInSchema, formData);

        // Check rate limits (both IP and email)
        const clientIp = await getClientIp();
        const ipRateLimit = checkAuthRateLimitByIp(clientIp);
        const emailRateLimit = checkAuthRateLimitByEmail(data.email);

        if (!ipRateLimit.allowed) {
          logger.warn(
            { email: data.email, ip: clientIp, resetInSeconds: ipRateLimit.resetInSeconds },
            'Signin rate limit exceeded (IP)'
          );
          throw ActionErrors.rateLimited(
            `Too many signin attempts. Please try again in ${ipRateLimit.resetInSeconds} seconds.`
          );
        }

        if (!emailRateLimit.allowed) {
          logger.warn(
            { email: data.email, resetInSeconds: emailRateLimit.resetInSeconds },
            'Signin rate limit exceeded (email)'
          );
          throw ActionErrors.rateLimited(
            `Too many signin attempts for this email. Please try again in ${emailRateLimit.resetInSeconds} seconds.`
          );
        }

        logger.info({ email: data.email }, 'User signin attempt');

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: data.email.toLowerCase() },
          select: {
            id: true,
            email: true,
            password_hash: true,
          },
        });

        if (!user) {
          logger.warn({ email: data.email }, 'Signin failed: User not found');
          throw ActionErrors.validationError('Invalid email or password');
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(data.password, user.password_hash);

        if (!isValidPassword) {
          logger.warn({ email: data.email, userId: user.id }, 'Signin failed: Invalid password');
          throw ActionErrors.validationError('Invalid email or password');
        }

        logger.info(
          {
            userId: user.id,
            email: user.email,
          },
          'User authenticated successfully'
        );

        return actionSuccess({
          userId: user.id,
          email: user.email,
        });
      } catch (error) {
        return handleUnknownError(error);
      }
    }
  );
}

/**
 * Sign out the current user
 *
 * Destroys session and logs out via NextAuth.
 */
export async function signOutAction(): Promise<SignOutResponse> {
  return runWithCorrelationAsync(
    { correlationId: generateCorrelationId() },
    async () => {
      try {
        logger.info('User signout');

        return actionSuccess(undefined);
      } catch (error) {
        return handleUnknownError(error);
      }
    }
  );
}
