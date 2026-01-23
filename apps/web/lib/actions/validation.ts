/**
 * Server Action Input Validation
 *
 * Zod schema integration helpers for validating action inputs.
 * Provides consistent validation and error formatting.
 */

import { z, ZodError, ZodSchema } from 'zod';

import { logger } from '@/server/observability/logger';

import { ActionErrors } from './errors';

/**
 * Validate input against a Zod schema
 * Throws ActionError with formatted validation errors
 */
export function validateInput<T>(schema: ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      // Format validation errors for user feedback
      const details = formatZodErrors(error);

      logger.warn(
        {
          validation_errors: details,
          input: sanitizeInputForLogging(input),
        },
        'Input validation failed'
      );

      throw ActionErrors.validationError('Invalid input provided', details);
    }
    throw error;
  }
}

/**
 * Format Zod errors into user-friendly structure
 */
export function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.errors) {
    const path = issue.path.join('.');
    const message = issue.message;

    if (!formatted[path]) {
      formatted[path] = [];
    }

    formatted[path].push(message);
  }

  return formatted;
}

/**
 * Sanitize input for logging (remove sensitive fields)
 */
export function sanitizeInputForLogging(input: unknown): Record<string, unknown> | unknown {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  const sensitiveFields = [
    'password',
    'password_hash',
    'token',
    'access_token',
    'secret',
    'api_key',
    'credit_card',
    'ssn',
  ];

  const sanitized = { ...input } as Record<string, unknown>;

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Safe parse that returns result object instead of throwing
 */
export function safeValidate<T>(
  schema: ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Validation schemas for common action inputs
 */

// FormData validation helpers
export const formDataSchemas = {
  // Email field
  email: z.string().email('Invalid email address').min(1, 'Email is required'),

  // Password field (signup/signin)
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long'),

  // UUID field
  uuid: z.string().uuid('Invalid ID format'),

  // URL field
  url: z.string().url('Invalid URL format'),

  // Shopify store domain
  shopDomain: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/, 'Invalid Shopify store domain')
    .transform((val) => val.toLowerCase()),

  // Non-empty string
  nonEmptyString: z.string().min(1, 'This field is required'),

  // Positive number
  positiveNumber: z.number().positive('Must be a positive number'),

  // Date string
  dateString: z.string().datetime('Invalid date format'),
};

/**
 * Extract and validate FormData
 * Converts FormData to plain object and validates
 */
export function validateFormData<T>(schema: ZodSchema<T>, formData: FormData): T {
  const data: Record<string, unknown> = {};

  // Convert FormData to object
  for (const [key, value] of formData.entries()) {
    // Handle file uploads
    if (value instanceof File) {
      data[key] = value;
      continue;
    }

    // Handle multiple values (e.g., checkboxes)
    if (key.endsWith('[]')) {
      const cleanKey = key.slice(0, -2);
      if (!data[cleanKey]) {
        data[cleanKey] = [];
      }
      // Type assertion: we know it's an array from the check above
      (data[cleanKey] as unknown[]).push(value);
      continue;
    }

    // Handle boolean strings
    if (value === 'true') {
      data[key] = true;
      continue;
    }
    if (value === 'false') {
      data[key] = false;
      continue;
    }

    // Handle number strings
    if (!isNaN(Number(value)) && value !== '') {
      data[key] = Number(value);
      continue;
    }

    // Default: string value
    data[key] = value;
  }

  return validateInput(schema, data);
}

/**
 * Workspace ID validation
 * Common validation for workspace-scoped actions
 */
export const workspaceIdSchema = z.object({
  workspaceId: formDataSchemas.uuid,
});

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

/**
 * Date range schema
 */
export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: 'Start date must be before or equal to end date',
    path: ['startDate'],
  });

/**
 * ID array schema
 */
export const idArraySchema = z.array(formDataSchemas.uuid).min(1, 'At least one ID is required');

/**
 * Action-specific validation helpers
 */

/**
 * Validate that a value is one of the allowed enum values
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): T {
  if (typeof value !== 'string') {
    throw ActionErrors.validationError(`${fieldName} must be a string`);
  }

  if (!allowedValues.includes(value as T)) {
    throw ActionErrors.validationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    );
  }

  return value as T;
}

/**
 * Validate JSON payload
 */
export function validateJsonPayload<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  fieldName = 'payload'
): T {
  try {
    return validateInput(schema, payload);
  } catch {
    throw ActionErrors.validationError(`Invalid ${fieldName} structure`);
  }
}

/**
 * Validate array length
 */
export function validateArrayLength<T>(
  array: T[],
  min?: number,
  max?: number,
  fieldName = 'array'
): T[] {
  if (min !== undefined && array.length < min) {
    throw ActionErrors.validationError(`${fieldName} must have at least ${min} items`);
  }

  if (max !== undefined && array.length > max) {
    throw ActionErrors.validationError(`${fieldName} must have at most ${max} items`);
  }

  return array;
}

/**
 * Validate required fields exist
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  data: T,
  requiredFields: (keyof T)[]
): void {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(String(field));
    }
  }

  if (missingFields.length > 0) {
    throw ActionErrors.validationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      { missingFields }
    );
  }
}
