/**
 * Environment Variable Validation and Type Safety
 *
 * Provides runtime validation of environment variables using Zod schemas.
 * Ensures that all required environment variables are present and valid
 * before the application starts.
 *
 * Security features:
 * - Strict separation of server-only and client-safe variables
 * - Client variables must be prefixed with NEXT_PUBLIC_*
 * - Runtime validation prevents silent failures
 * - Type-safe access to all environment variables
 *
 * CRITICAL SECURITY RULE:
 * Never expose server-only secrets to the client bundle!
 */

import { z } from 'zod';

/**
 * Server-side environment variables schema
 *
 * These variables are ONLY available on the server and should
 * NEVER be exposed to the client bundle.
 *
 * Includes sensitive data like:
 * - Database credentials
 * - API secrets
 * - OAuth secrets
 * - Encryption keys
 */
const serverEnvSchema = z.object({
  // Node Environment
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // NextAuth
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),

  // Shopify OAuth
  SHOPIFY_API_KEY: z.string().min(1, 'SHOPIFY_API_KEY is required'),
  SHOPIFY_API_SECRET: z.string().min(1, 'SHOPIFY_API_SECRET is required'),
  SHOPIFY_APP_URL: z.string().url('SHOPIFY_APP_URL must be a valid URL'),
  SHOPIFY_SCOPES: z.string().min(1, 'SHOPIFY_SCOPES is required'),

  // Encryption Key (for token encryption)
  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters')
    .optional()
    .transform((val) => val || process.env.NEXTAUTH_SECRET), // Fallback to NEXTAUTH_SECRET

  // Sentry (optional)
  SENTRY_DSN: z.string().url().optional(),

  // Email Provider (optional)
  EMAIL_PROVIDER_API_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // AI Providers (optional)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Webhook Secret (optional - uses SHOPIFY_API_SECRET by default)
  WEBHOOK_SECRET: z.string().optional(),
  SHOPIFY_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((val) => val || process.env.SHOPIFY_API_SECRET || process.env.WEBHOOK_SECRET),

  // Rate Limiting (optional)
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60000),

  // Session Configuration (optional)
  SESSION_MAX_AGE: z.coerce.number().positive().default(2592000), // 30 days

  // Feature Flags (optional)
  FEATURE_EMAIL_SENDING: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
  FEATURE_AUTO_EXECUTION: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
  FEATURE_LEARNING_LOOP: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('true'),
});

/**
 * Client-side environment variables schema
 *
 * These variables are exposed to the browser and should
 * NEVER contain sensitive information.
 *
 * All client variables MUST be prefixed with NEXT_PUBLIC_
 */
const clientEnvSchema = z.object({
  // Application URL (public)
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Analytics (optional, public)
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),

  // Feature Flags (public)
  NEXT_PUBLIC_ENABLE_ANALYTICS: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),

  // Environment indicator (public)
  NEXT_PUBLIC_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
});

/**
 * Validated server environment variables
 *
 * Access server-only variables through this object.
 * Will throw an error if validation fails.
 */
export const serverEnv = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
  SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
  SHOPIFY_SCOPES: process.env.SHOPIFY_SCOPES,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  EMAIL_PROVIDER_API_KEY: process.env.EMAIL_PROVIDER_API_KEY,
  LOG_LEVEL: process.env.LOG_LEVEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  SHOPIFY_WEBHOOK_SECRET: process.env.SHOPIFY_WEBHOOK_SECRET,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  SESSION_MAX_AGE: process.env.SESSION_MAX_AGE,
  FEATURE_EMAIL_SENDING: process.env.FEATURE_EMAIL_SENDING,
  FEATURE_AUTO_EXECUTION: process.env.FEATURE_AUTO_EXECUTION,
  FEATURE_LEARNING_LOOP: process.env.FEATURE_LEARNING_LOOP,
});

/**
 * Validated client environment variables
 *
 * Access client-safe variables through this object.
 * These are exposed to the browser bundle.
 */
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID,
  NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
  NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
});

/**
 * Validate environment variables on startup
 *
 * Call this function at application startup to ensure all
 * required environment variables are present and valid.
 *
 * @throws {ZodError} If validation fails
 */
export function validateEnv(): void {
  try {
    // Validate server environment
    serverEnvSchema.parse({
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
      SHOPIFY_SCOPES: process.env.SHOPIFY_SCOPES,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
      SENTRY_DSN: process.env.SENTRY_DSN,
      EMAIL_PROVIDER_API_KEY: process.env.EMAIL_PROVIDER_API_KEY,
      LOG_LEVEL: process.env.LOG_LEVEL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
      SHOPIFY_WEBHOOK_SECRET: process.env.SHOPIFY_WEBHOOK_SECRET,
      RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
      SESSION_MAX_AGE: process.env.SESSION_MAX_AGE,
      FEATURE_EMAIL_SENDING: process.env.FEATURE_EMAIL_SENDING,
      FEATURE_AUTO_EXECUTION: process.env.FEATURE_AUTO_EXECUTION,
      FEATURE_LEARNING_LOOP: process.env.FEATURE_LEARNING_LOOP,
    });

    // Validate client environment
    clientEnvSchema.parse({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID,
      NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
      NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    });

    // Use structured logger in production
    // console.log('[Environment] Validation successful');
  } catch (error) {
    console.error('[Environment] Validation failed:', error);
    throw new Error('Invalid environment configuration');
  }
}

/**
 * Get environment info (safe for logging)
 *
 * Returns non-sensitive environment information for logging
 * and diagnostics. Never includes secrets.
 */
export function getEnvInfo(): {
  nodeEnv: string;
  logLevel: string;
  features: Record<string, boolean>;
} {
  return {
    nodeEnv: serverEnv.NODE_ENV,
    logLevel: serverEnv.LOG_LEVEL,
    features: {
      emailSending: serverEnv.FEATURE_EMAIL_SENDING,
      autoExecution: serverEnv.FEATURE_AUTO_EXECUTION,
      learningLoop: serverEnv.FEATURE_LEARNING_LOOP,
    },
  };
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return serverEnv.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return serverEnv.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return serverEnv.NODE_ENV === 'test';
}

// Type exports
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Unified environment variable access
 *
 * Convenience export for accessing both server and client env vars.
 * Use this in server-side code for type-safe access to all variables.
 */
export const env = {
  ...serverEnv,
  ...clientEnv,
} as ServerEnv & ClientEnv;
