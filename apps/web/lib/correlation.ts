/**
 * Correlation ID Management
 *
 * Generates and propagates correlation IDs across the entire request-job-execution chain
 * for distributed tracing and debugging.
 */

// Use dynamic import to avoid Edge runtime issues with async_hooks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let correlationStorage: any = null;

// Initialize AsyncLocalStorage only in Node.js environment
if (typeof globalThis.process !== 'undefined' && globalThis.process.versions?.node) {
  // We're in Node.js - use AsyncLocalStorage
  import('async_hooks').then((mod) => {
    correlationStorage = new mod.AsyncLocalStorage();
  });
}

/**
 * Generate a UUID compatible with both Edge and Node.js runtimes
 */
function generateUUID(): string {
  // Use Web Crypto API (available in Edge, Node.js 16+, browsers)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Correlation context stored in async local storage
 */
interface CorrelationContext {
  correlationId: string;
  workspaceId?: string;
  userId?: string;
  jobId?: string;
  jobName?: string;
}

/**
 * Generate a new correlation ID
 * Format: uuid-v4 for uniqueness and sortability
 */
export function generateCorrelationId(): string {
  return generateUUID();
}

/**
 * Generate a correlation ID with a prefix
 * Useful for identifying the source of the correlation
 */
export function generatePrefixedCorrelationId(prefix: string): string {
  return `${prefix}-${generateUUID()}`;
}

/**
 * Get the current correlation context
 * Returns undefined if no context is set or in Edge runtime
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage?.getStore();
}

/**
 * Get the current correlation ID
 * Returns a new ID if no context is set or in Edge runtime
 */
export function getCorrelationId(): string {
  const context = correlationStorage?.getStore();
  return context?.correlationId ?? generateCorrelationId();
}

/**
 * Get the current workspace ID from correlation context
 */
export function getCorrelationWorkspaceId(): string | undefined {
  const context = correlationStorage?.getStore();
  return context?.workspaceId;
}

/**
 * Get the current user ID from correlation context
 */
export function getCorrelationUserId(): string | undefined {
  const context = correlationStorage?.getStore();
  return context?.userId;
}

/**
 * Get the current job ID from correlation context
 */
export function getCorrelationJobId(): string | undefined {
  const context = correlationStorage?.getStore();
  return context?.jobId;
}

/**
 * Run a function with a new correlation context
 *
 * @param context - The correlation context to set
 * @param fn - The function to run with the context
 * @returns The result of the function
 */
export function runWithCorrelation<T>(
  context: Partial<CorrelationContext>,
  fn: () => T
): T {
  const fullContext: CorrelationContext = {
    correlationId: context.correlationId ?? generateCorrelationId(),
    workspaceId: context.workspaceId,
    userId: context.userId,
    jobId: context.jobId,
    jobName: context.jobName,
  };

  // In Edge runtime, just run the function without context
  if (!correlationStorage) {
    return fn();
  }

  return correlationStorage.run(fullContext, fn);
}

/**
 * Run an async function with a new correlation context
 *
 * @param context - The correlation context to set
 * @param fn - The async function to run with the context
 * @returns A promise that resolves to the result of the function
 */
export async function runWithCorrelationAsync<T>(
  context: Partial<CorrelationContext>,
  fn: () => Promise<T>
): Promise<T> {
  const fullContext: CorrelationContext = {
    correlationId: context.correlationId ?? generateCorrelationId(),
    workspaceId: context.workspaceId,
    userId: context.userId,
    jobId: context.jobId,
    jobName: context.jobName,
  };

  // In Edge runtime, just run the function without context
  if (!correlationStorage) {
    return fn();
  }

  return correlationStorage.run(fullContext, fn);
}

/**
 * Update the current correlation context with additional fields
 * Useful for adding context during the execution flow
 */
export function updateCorrelationContext(
  updates: Partial<CorrelationContext>
): void {
  if (!correlationStorage) {
    // In Edge runtime, silently ignore updates
    return;
  }
  const current = correlationStorage.getStore();
  if (!current) {
    throw new Error('No correlation context found');
  }

  // Update the current context
  Object.assign(current, updates);
}

/**
 * Extract correlation context from job data
 * Used in workers to restore correlation context from job metadata
 */
export function extractCorrelationFromJobData(data: Record<string, unknown>): Partial<CorrelationContext> {
  return {
    correlationId: typeof data._correlationId === 'string' ? data._correlationId : undefined,
    workspaceId: typeof data.workspaceId === 'string' ? data.workspaceId : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    jobId: typeof data._jobId === 'string' ? data._jobId : undefined,
    jobName: typeof data._jobName === 'string' ? data._jobName : undefined,
  };
}

/**
 * Inject correlation context into job data
 * Used when enqueuing jobs to propagate correlation
 */
export function injectCorrelationIntoJobData<T extends Record<string, unknown>>(
  data: T
): T & { _correlationId: string; _jobId?: string; _jobName?: string } {
  const context = getCorrelationContext();

  return {
    ...data,
    _correlationId: context?.correlationId ?? generateCorrelationId(),
    _jobId: context?.jobId,
    _jobName: context?.jobName,
  };
}

/**
 * Create a child correlation ID
 * Used for spawning sub-jobs or sub-operations
 */
export function createChildCorrelationId(suffix: string): string {
  const parentId = getCorrelationId();
  return `${parentId}:${suffix}`;
}

/**
 * Middleware helper to extract correlation ID from HTTP headers
 * Standard header: X-Correlation-ID
 */
export function extractCorrelationIdFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined>
): string | undefined {
  if (headers instanceof Headers) {
    return headers.get('x-correlation-id') ?? undefined;
  }

  const value = headers['x-correlation-id'];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Add correlation ID to HTTP headers
 */
export function addCorrelationIdToHeaders(
  headers: Record<string, string>,
  correlationId?: string
): Record<string, string> {
  return {
    ...headers,
    'X-Correlation-ID': correlationId ?? getCorrelationId(),
  };
}
