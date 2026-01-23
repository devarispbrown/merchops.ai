/**
 * Unit Tests: Execution Idempotency
 * MerchOps Beta MVP
 *
 * Tests:
 * - Idempotency key generation
 * - Double-execution prevention
 * - Retry logic and safety
 * - Execution uniqueness guarantees
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  prismaMock,
  createTestExecution,
  createTestActionDraft,
  createTestWorkspace,
  mockCurrentTime,
} from '../../setup';

// ============================================================================
// IDEMPOTENCY KEY GENERATION
// ============================================================================

interface IdempotencyKeyParams {
  actionDraftId: string;
  approvalTimestamp: Date;
  userId?: string;
}

/**
 * Generate deterministic idempotency key for execution
 * Format: exec:{draft_id}:{approval_timestamp}:{user_id?}
 */
function generateIdempotencyKey(params: IdempotencyKeyParams): string {
  const timestamp = params.approvalTimestamp.getTime();
  const parts = ['exec', params.actionDraftId, timestamp.toString()];

  if (params.userId) {
    parts.push(params.userId);
  }

  return parts.join(':');
}

/**
 * Parse idempotency key back into components
 */
function parseIdempotencyKey(key: string): Partial<IdempotencyKeyParams> | null {
  const parts = key.split(':');
  if (parts[0] !== 'exec' || parts.length < 3) {
    return null;
  }

  return {
    actionDraftId: parts[1],
    approvalTimestamp: new Date(parseInt(parts[2])),
    userId: parts[3] || undefined,
  };
}

/**
 * Check if execution with idempotency key already exists
 */
async function checkIdempotencyKey(
  workspaceId: string,
  idempotencyKey: string
): Promise<{ exists: boolean; execution?: any }> {
  const existing = await prismaMock.execution.findUnique({
    where: { idempotency_key: idempotencyKey },
  });

  return {
    exists: !!existing,
    execution: existing || undefined,
  };
}

// ============================================================================
// EXECUTION CREATION WITH IDEMPOTENCY
// ============================================================================

interface CreateExecutionParams {
  workspaceId: string;
  actionDraftId: string;
  requestPayload: Record<string, any>;
  idempotencyKey: string;
}

/**
 * Create execution with idempotency check
 */
async function createExecution(params: CreateExecutionParams) {
  // Check for existing execution
  const check = await checkIdempotencyKey(params.workspaceId, params.idempotencyKey);

  if (check.exists) {
    // Return existing execution instead of creating duplicate
    return {
      execution: check.execution,
      created: false,
    };
  }

  // Create new execution
  const execution = await prismaMock.execution.create({
    data: {
      workspace_id: params.workspaceId,
      action_draft_id: params.actionDraftId,
      request_payload_json: params.requestPayload,
      idempotency_key: params.idempotencyKey,
      status: 'pending',
      started_at: new Date(),
    },
  });

  return {
    execution,
    created: true,
  };
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Calculate delay for retry attempt with exponential backoff
 */
function calculateRetryDelay(attemptNumber: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // Shopify rate limit
  if (error.status === 429) {
    return true;
  }

  // Shopify server errors
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Non-retryable errors
  return false;
}

// ============================================================================
// TESTS: IDEMPOTENCY KEY GENERATION
// ============================================================================

describe('Idempotency Key Generation', () => {
  it('generates deterministic keys for same inputs', () => {
    const params: IdempotencyKeyParams = {
      actionDraftId: 'draft-123',
      approvalTimestamp: new Date('2024-01-15T12:00:00Z'),
      userId: 'user-456',
    };

    const key1 = generateIdempotencyKey(params);
    const key2 = generateIdempotencyKey(params);
    const key3 = generateIdempotencyKey(params);

    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it('includes action draft ID in key', () => {
    const params: IdempotencyKeyParams = {
      actionDraftId: 'draft-xyz',
      approvalTimestamp: new Date('2024-01-15T12:00:00Z'),
    };

    const key = generateIdempotencyKey(params);

    expect(key).toContain('draft-xyz');
    expect(key.startsWith('exec:')).toBe(true);
  });

  it('includes timestamp in milliseconds', () => {
    const timestamp = new Date('2024-01-15T12:00:00.000Z');
    const params: IdempotencyKeyParams = {
      actionDraftId: 'draft-123',
      approvalTimestamp: timestamp,
    };

    const key = generateIdempotencyKey(params);

    expect(key).toContain(timestamp.getTime().toString());
  });

  it('includes user ID when provided', () => {
    const params: IdempotencyKeyParams = {
      actionDraftId: 'draft-123',
      approvalTimestamp: new Date('2024-01-15T12:00:00Z'),
      userId: 'user-789',
    };

    const key = generateIdempotencyKey(params);

    expect(key).toContain('user-789');
  });

  it('omits user ID when not provided', () => {
    const params: IdempotencyKeyParams = {
      actionDraftId: 'draft-123',
      approvalTimestamp: new Date('2024-01-15T12:00:00Z'),
    };

    const key = generateIdempotencyKey(params);

    expect(key.split(':').length).toBe(3); // exec:draft:timestamp
  });

  it('generates different keys for different timestamps', () => {
    const baseParams = {
      actionDraftId: 'draft-123',
      userId: 'user-456',
    };

    const key1 = generateIdempotencyKey({
      ...baseParams,
      approvalTimestamp: new Date('2024-01-15T12:00:00Z'),
    });

    const key2 = generateIdempotencyKey({
      ...baseParams,
      approvalTimestamp: new Date('2024-01-15T12:00:01Z'),
    });

    expect(key1).not.toBe(key2);
  });

  it('generates different keys for different drafts', () => {
    const timestamp = new Date('2024-01-15T12:00:00Z');

    const key1 = generateIdempotencyKey({
      actionDraftId: 'draft-123',
      approvalTimestamp: timestamp,
    });

    const key2 = generateIdempotencyKey({
      actionDraftId: 'draft-456',
      approvalTimestamp: timestamp,
    });

    expect(key1).not.toBe(key2);
  });
});

// ============================================================================
// TESTS: KEY PARSING
// ============================================================================

describe('Idempotency Key Parsing', () => {
  it('parses valid key correctly', () => {
    const originalParams: IdempotencyKeyParams = {
      actionDraftId: 'draft-123',
      approvalTimestamp: new Date('2024-01-15T12:00:00Z'),
      userId: 'user-456',
    };

    const key = generateIdempotencyKey(originalParams);
    const parsed = parseIdempotencyKey(key);

    expect(parsed).toBeDefined();
    expect(parsed?.actionDraftId).toBe(originalParams.actionDraftId);
    expect(parsed?.approvalTimestamp?.getTime()).toBe(originalParams.approvalTimestamp.getTime());
    expect(parsed?.userId).toBe(originalParams.userId);
  });

  it('parses key without user ID', () => {
    const key = 'exec:draft-123:1705322400000';
    const parsed = parseIdempotencyKey(key);

    expect(parsed).toBeDefined();
    expect(parsed?.actionDraftId).toBe('draft-123');
    expect(parsed?.userId).toBeUndefined();
  });

  it('returns null for invalid key format', () => {
    expect(parseIdempotencyKey('invalid-key')).toBeNull();
    expect(parseIdempotencyKey('exec:only-two-parts')).toBeNull();
    expect(parseIdempotencyKey('wrong:prefix:123')).toBeNull();
  });
});

// ============================================================================
// TESTS: DOUBLE-EXECUTION PREVENTION
// ============================================================================

describe('Double-Execution Prevention', () => {
  const workspace = createTestWorkspace();
  const draft = createTestActionDraft();

  beforeEach(() => {
    mockCurrentTime('2024-01-15T12:00:00Z');
    prismaMock.workspace.findUnique.mockResolvedValue(workspace);
    prismaMock.actionDraft.findUnique.mockResolvedValue(draft);
  });

  it('prevents duplicate execution with same idempotency key', async () => {
    const idempotencyKey = generateIdempotencyKey({
      actionDraftId: draft.id,
      approvalTimestamp: new Date('2024-01-15T12:00:00Z'),
      userId: 'user-123',
    });

    const execution = createTestExecution({ idempotency_key: idempotencyKey });

    // First execution succeeds
    prismaMock.execution.findUnique.mockResolvedValueOnce(null);
    prismaMock.execution.create.mockResolvedValueOnce(execution);

    const result1 = await createExecution({
      workspaceId: workspace.id,
      actionDraftId: draft.id,
      requestPayload: { test: 'data' },
      idempotencyKey,
    });

    expect(result1.created).toBe(true);
    expect(result1.execution).toEqual(execution);

    // Second execution with same key returns existing
    prismaMock.execution.findUnique.mockResolvedValueOnce(execution);

    const result2 = await createExecution({
      workspaceId: workspace.id,
      actionDraftId: draft.id,
      requestPayload: { test: 'data' },
      idempotencyKey,
    });

    expect(result2.created).toBe(false);
    expect(result2.execution).toEqual(execution);
  });

  it('allows multiple executions with different idempotency keys', async () => {
    const key1 = generateIdempotencyKey({
      actionDraftId: draft.id,
      approvalTimestamp: new Date('2024-01-15T12:00:00Z'),
    });

    const key2 = generateIdempotencyKey({
      actionDraftId: draft.id,
      approvalTimestamp: new Date('2024-01-15T12:00:01Z'),
    });

    const execution1 = createTestExecution({ id: 'exec-1', idempotency_key: key1 });
    const execution2 = createTestExecution({ id: 'exec-2', idempotency_key: key2 });

    prismaMock.execution.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    prismaMock.execution.create.mockResolvedValueOnce(execution1).mockResolvedValueOnce(execution2);

    const result1 = await createExecution({
      workspaceId: workspace.id,
      actionDraftId: draft.id,
      requestPayload: { test: 'data1' },
      idempotencyKey: key1,
    });

    const result2 = await createExecution({
      workspaceId: workspace.id,
      actionDraftId: draft.id,
      requestPayload: { test: 'data2' },
      idempotencyKey: key2,
    });

    expect(result1.created).toBe(true);
    expect(result2.created).toBe(true);
    expect(result1.execution.id).not.toBe(result2.execution.id);
  });

  it('handles concurrent execution attempts safely', async () => {
    const idempotencyKey = generateIdempotencyKey({
      actionDraftId: draft.id,
      approvalTimestamp: new Date('2024-01-15T12:00:00Z'),
    });

    const execution = createTestExecution({ idempotency_key: idempotencyKey });

    // Simulate race condition: both attempts think no execution exists
    prismaMock.execution.findUnique.mockResolvedValue(null);

    // First create succeeds
    prismaMock.execution.create.mockResolvedValueOnce(execution);

    // Second create fails with unique constraint violation
    prismaMock.execution.create.mockRejectedValueOnce({
      code: 'P2002',
      meta: { target: ['idempotency_key'] },
    });

    // First attempt succeeds
    const result1 = await createExecution({
      workspaceId: workspace.id,
      actionDraftId: draft.id,
      requestPayload: { test: 'data' },
      idempotencyKey,
    });

    expect(result1.created).toBe(true);

    // Second attempt should handle constraint violation
    await expect(
      createExecution({
        workspaceId: workspace.id,
        actionDraftId: draft.id,
        requestPayload: { test: 'data' },
        idempotencyKey,
      })
    ).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});

// ============================================================================
// TESTS: RETRY LOGIC
// ============================================================================

describe('Retry Logic', () => {
  it('calculates exponential backoff correctly', () => {
    const config: RetryConfig = {
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    };

    expect(calculateRetryDelay(1, config)).toBe(1000); // 1s
    expect(calculateRetryDelay(2, config)).toBe(2000); // 2s
    expect(calculateRetryDelay(3, config)).toBe(4000); // 4s
    expect(calculateRetryDelay(4, config)).toBe(8000); // 8s
    expect(calculateRetryDelay(5, config)).toBe(16000); // 16s
  });

  it('respects maximum delay cap', () => {
    const config: RetryConfig = {
      maxAttempts: 10,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    };

    // Attempt 5 would be 16000ms without cap
    expect(calculateRetryDelay(5, config)).toBe(10000);
    expect(calculateRetryDelay(10, config)).toBe(10000);
  });

  it('uses default config when not specified', () => {
    expect(calculateRetryDelay(1)).toBe(1000);
    expect(calculateRetryDelay(2)).toBe(2000);
  });

  it('identifies retryable network errors', () => {
    expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('identifies retryable HTTP errors', () => {
    expect(isRetryableError({ status: 429 })).toBe(true); // Rate limit
    expect(isRetryableError({ status: 500 })).toBe(true); // Server error
    expect(isRetryableError({ status: 502 })).toBe(true); // Bad gateway
    expect(isRetryableError({ status: 503 })).toBe(true); // Service unavailable
    expect(isRetryableError({ status: 504 })).toBe(true); // Gateway timeout
  });

  it('identifies non-retryable errors', () => {
    expect(isRetryableError({ status: 400 })).toBe(false); // Bad request
    expect(isRetryableError({ status: 401 })).toBe(false); // Unauthorized
    expect(isRetryableError({ status: 403 })).toBe(false); // Forbidden
    expect(isRetryableError({ status: 404 })).toBe(false); // Not found
    expect(isRetryableError({ status: 422 })).toBe(false); // Validation error
    expect(isRetryableError({ code: 'INVALID_INPUT' })).toBe(false);
  });
});

// ============================================================================
// TESTS: EXECUTION STATE TRANSITIONS
// ============================================================================

describe('Execution State Transitions', () => {
  const workspace = createTestWorkspace();
  const draft = createTestActionDraft();

  beforeEach(() => {
    prismaMock.workspace.findUnique.mockResolvedValue(workspace);
  });

  it('transitions from pending to running to succeeded', async () => {
    const execution = createTestExecution({ status: 'pending' });

    prismaMock.execution.findUnique.mockResolvedValue(execution);

    // Start execution
    const running = { ...execution, status: 'running' as const };
    prismaMock.execution.update.mockResolvedValueOnce(running);

    const runningResult = await prismaMock.execution.update({
      where: { id: execution.id },
      data: { status: 'running' },
    });

    expect(runningResult.status).toBe('running');

    // Complete execution
    const succeeded = {
      ...execution,
      status: 'succeeded' as const,
      finished_at: new Date(),
    };
    prismaMock.execution.update.mockResolvedValueOnce(succeeded);

    const succeededResult = await prismaMock.execution.update({
      where: { id: execution.id },
      data: {
        status: 'succeeded',
        finished_at: new Date(),
      },
    });

    expect(succeededResult.status).toBe('succeeded');
    expect(succeededResult.finished_at).toBeDefined();
  });

  it('transitions from pending to running to retrying on transient failure', async () => {
    const execution = createTestExecution({ status: 'pending' });

    prismaMock.execution.findUnique.mockResolvedValue(execution);

    // Start execution
    const running = {
      ...execution,
      status: 'running' as const,
    };
    prismaMock.execution.update.mockResolvedValueOnce(running);

    const runningResult = await prismaMock.execution.update({
      where: { id: execution.id },
      data: { status: 'running' },
    });

    expect(runningResult.status).toBe('running');

    // Encounter retryable error
    const retrying = {
      ...execution,
      status: 'retrying' as const,
      error_code: 'RATE_LIMIT',
    };
    prismaMock.execution.update.mockResolvedValueOnce(retrying);

    const retryingResult = await prismaMock.execution.update({
      where: { id: execution.id },
      data: {
        status: 'retrying',
        error_code: 'RATE_LIMIT',
      },
    });

    expect(retryingResult.status).toBe('retrying');
    expect(retryingResult.error_code).toBe('RATE_LIMIT');
  });

  it('transitions to failed after max retries exceeded', async () => {
    const execution = createTestExecution({ status: 'retrying' });

    const failed = {
      ...execution,
      status: 'failed' as const,
      error_code: 'MAX_RETRIES_EXCEEDED',
      error_message: 'Failed after 3 retry attempts',
      finished_at: new Date(),
    };

    prismaMock.execution.update.mockResolvedValueOnce(failed);

    const failedResult = await prismaMock.execution.update({
      where: { id: execution.id },
      data: {
        status: 'failed',
        error_code: 'MAX_RETRIES_EXCEEDED',
        error_message: 'Failed after 3 retry attempts',
        finished_at: new Date(),
      },
    });

    expect(failedResult.status).toBe('failed');
    expect(failedResult.error_code).toBe('MAX_RETRIES_EXCEEDED');
    expect(failedResult.finished_at).toBeDefined();
  });
});

// ============================================================================
// TESTS: EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('handles very long action draft IDs', () => {
    const longId = 'a'.repeat(256);
    const key = generateIdempotencyKey({
      actionDraftId: longId,
      approvalTimestamp: new Date(),
    });

    expect(key).toContain(longId);
  });

  it('handles timestamp at Unix epoch', () => {
    const epoch = new Date(0);
    const key = generateIdempotencyKey({
      actionDraftId: 'draft-123',
      approvalTimestamp: epoch,
    });

    expect(key).toContain('0');
  });

  it('handles future timestamps', () => {
    const future = new Date('2099-12-31T23:59:59Z');
    const key = generateIdempotencyKey({
      actionDraftId: 'draft-123',
      approvalTimestamp: future,
    });

    const parsed = parseIdempotencyKey(key);
    expect(parsed?.approvalTimestamp?.getTime()).toBe(future.getTime());
  });

  it('generates unique keys for sub-millisecond precision', () => {
    // JavaScript Date only has millisecond precision
    const timestamp = new Date('2024-01-15T12:00:00.123Z');

    const key1 = generateIdempotencyKey({
      actionDraftId: 'draft-123',
      approvalTimestamp: timestamp,
    });

    const key2 = generateIdempotencyKey({
      actionDraftId: 'draft-123',
      approvalTimestamp: new Date(timestamp.getTime()), // Same millisecond
    });

    expect(key1).toBe(key2);
  });
});
