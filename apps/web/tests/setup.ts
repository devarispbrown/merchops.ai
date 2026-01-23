/**
 * Vitest Setup File
 * MerchOps Beta MVP - Test Infrastructure
 *
 * Provides:
 * - Mock providers (database, Redis)
 * - Test utilities
 * - Global test configuration
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

// Mock Prisma Client
export const prismaMock = mockDeep<PrismaClient>();

// Mock the Prisma client module so all imports get the mock
vi.mock('@/server/db/client', () => ({
  prisma: prismaMock,
  disconnectPrisma: vi.fn(),
}));

// Mock Redis Client
export const redisMock = mockDeep<Redis>();

// Mock BullMQ Queue
export const queueMock = {
  add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
  process: vi.fn(),
  on: vi.fn(),
  close: vi.fn(),
  getJob: vi.fn(),
  getJobs: vi.fn().mockResolvedValue([]),
};

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

/**
 * Create a test workspace with deterministic ID
 */
export function createTestWorkspace(overrides = {}) {
  return {
    id: 'test-workspace-id',
    name: 'Test Workspace',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create a test user
 */
export function createTestUser(overrides = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    password_hash: '$2a$10$test.hash.value',
    workspace_id: 'test-workspace-id',
    created_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create a test Shopify connection
 */
export function createTestShopifyConnection(overrides = {}) {
  return {
    id: 'test-connection-id',
    workspace_id: 'test-workspace-id',
    store_domain: 'test-store.myshopify.com',
    access_token_encrypted: 'encrypted-token',
    scopes: 'read_products,write_products,read_orders',
    status: 'active' as const,
    installed_at: new Date('2024-01-01T00:00:00Z'),
    revoked_at: null,
    ...overrides,
  };
}

/**
 * Create a test event
 */
export function createTestEvent(overrides = {}) {
  return {
    id: 'test-event-id',
    workspace_id: 'test-workspace-id',
    type: 'inventory_threshold_crossed' as const,
    occurred_at: new Date('2024-01-15T12:00:00Z'),
    payload_json: {
      product_id: 'gid://shopify/Product/123456',
      current_inventory: 5,
      threshold: 10,
    },
    dedupe_key: 'inventory_threshold_crossed:123456:2024-01-15',
    source: 'computed' as const,
    created_at: new Date('2024-01-15T12:05:00Z'),
    ...overrides,
  };
}

/**
 * Create a test opportunity
 */
export function createTestOpportunity(overrides = {}) {
  return {
    id: 'test-opportunity-id',
    workspace_id: 'test-workspace-id',
    type: 'inventory_clearance',
    priority_bucket: 'high' as const,
    why_now: 'Inventory at critical threshold with 7 days until restock',
    rationale: 'Product "Test Product" has only 5 units remaining with historical sell-through of 2 units per day',
    impact_range: '5-15 units cleared, $100-$300 revenue protection',
    counterfactual: 'Without action, likely stockout in 2-3 days leading to lost sales and backorders',
    decay_at: new Date('2024-01-22T12:00:00Z'),
    confidence: 0.75,
    state: 'new' as const,
    created_at: new Date('2024-01-15T12:10:00Z'),
    updated_at: new Date('2024-01-15T12:10:00Z'),
    ...overrides,
  };
}

/**
 * Create a test action draft
 */
export function createTestActionDraft(overrides = {}) {
  return {
    id: 'test-draft-id',
    workspace_id: 'test-workspace-id',
    opportunity_id: 'test-opportunity-id',
    operator_intent: 'reduce_inventory_risk' as const,
    execution_type: 'discount_draft' as const,
    payload_json: {
      discount_code: 'CLEARANCE15',
      discount_percent: 15,
      product_ids: ['gid://shopify/Product/123456'],
      starts_at: '2024-01-16T00:00:00Z',
      ends_at: '2024-01-22T23:59:59Z',
    },
    editable_fields_json: {
      discount_code: { type: 'string', max_length: 50 },
      discount_percent: { type: 'number', min: 5, max: 50 },
      starts_at: { type: 'datetime' },
      ends_at: { type: 'datetime' },
    },
    state: 'draft' as const,
    created_at: new Date('2024-01-15T12:15:00Z'),
    updated_at: new Date('2024-01-15T12:15:00Z'),
    ...overrides,
  };
}

/**
 * Create a test execution
 */
export function createTestExecution(overrides = {}) {
  return {
    id: 'test-execution-id',
    workspace_id: 'test-workspace-id',
    action_draft_id: 'test-draft-id',
    request_payload_json: {
      discount_code: 'CLEARANCE15',
      discount_percent: 15,
      product_ids: ['gid://shopify/Product/123456'],
    },
    provider_response_json: null,
    status: 'pending' as const,
    error_code: null,
    error_message: null,
    started_at: new Date('2024-01-15T12:20:00Z'),
    finished_at: null,
    idempotency_key: 'exec:test-draft-id:1705322400000',
    ...overrides,
  };
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Mock current time for deterministic tests
 */
export function mockCurrentTime(date: Date | string) {
  const mockDate = typeof date === 'string' ? new Date(date) : date;
  vi.useFakeTimers();
  vi.setSystemTime(mockDate);
}

/**
 * Restore real timers
 */
export function restoreTime() {
  vi.useRealTimers();
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that an object matches expected shape (partial match)
 */
export function assertMatchesShape<T>(actual: T, expected: Partial<T>) {
  Object.entries(expected).forEach(([key, value]) => {
    expect(actual).toHaveProperty(key, value);
  });
}

/**
 * Assert that a date is within a time range
 */
export function assertDateWithinRange(date: Date, start: Date, end: Date) {
  const timestamp = date.getTime();
  expect(timestamp).toBeGreaterThanOrEqual(start.getTime());
  expect(timestamp).toBeLessThanOrEqual(end.getTime());
}

/**
 * Assert that an error has specific properties
 */
export function assertError(error: unknown, expectedMessage?: string, expectedCode?: string) {
  expect(error).toBeInstanceOf(Error);
  if (expectedMessage) {
    expect((error as Error).message).toContain(expectedMessage);
  }
  if (expectedCode && 'code' in (error as any)) {
    expect((error as any).code).toBe(expectedCode);
  }
}

// ============================================================================
// WORKSPACE ISOLATION UTILITIES
// ============================================================================

/**
 * Create multiple test workspaces for isolation testing
 */
export function createTestWorkspaces(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-workspace-${i + 1}`,
    name: `Test Workspace ${i + 1}`,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  }));
}

// ============================================================================
// CLEANUP
// ============================================================================

afterEach(() => {
  // Reset all mocks after each test
  mockReset(prismaMock);
  mockReset(redisMock);
  vi.clearAllMocks();
  restoreTime();
});

beforeAll(() => {
  // Global test setup
  process.env.NODE_ENV = 'test';

  // Set Shopify token encryption key for tests (64 hex characters = 32 bytes)
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
});

afterAll(() => {
  // Global test cleanup
  vi.restoreAllMocks();
});

// ============================================================================
// EXPORTS
// ============================================================================

export { vi, expect, describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
