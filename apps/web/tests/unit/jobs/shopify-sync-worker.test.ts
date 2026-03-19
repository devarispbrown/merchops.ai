/**
 * Unit Tests: Shopify Sync Worker
 * MerchOps Beta MVP
 *
 * Covers:
 * - performInitialSync called with correct parameters from job data
 * - syncState transition: idle → syncing → completed on success
 * - lastSyncedAt is set when sync completes
 * - syncState transition: syncing → failed on error
 * - Original error is re-thrown on failure (allows BullMQ retry)
 * - Event compute queue is triggered after successful sync
 * - Missing / inactive connection throws before calling performInitialSync
 *
 * All external modules (performInitialSync, Prisma, queues) are mocked.
 * No network calls are made.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '../../setup';

// ============================================================================
// MODULE-LEVEL MOCKS
// ============================================================================

// performInitialSync mock — configure per test
const mockPerformInitialSync = vi.fn();

vi.mock('@/server/shopify/sync', () => ({
  performInitialSync: (...args: any[]) => mockPerformInitialSync(...args),
}));

// Event compute queue mock
const mockEventQueueAdd = vi.fn().mockResolvedValue({ id: 'mock-event-job' });
const mockEventQueue = { add: mockEventQueueAdd };

vi.mock('@/server/jobs/queues', () => ({
  getEventComputeQueue: vi.fn(() => mockEventQueue),
}));

// BullMQ Worker — skip actual Redis connection in unit tests
vi.mock('bullmq', () => ({
  Worker: vi.fn(function () {
    return { on: vi.fn(), close: vi.fn(), isRunning: vi.fn(() => false) };
  }),
  Queue: vi.fn(function () {
    return { add: vi.fn(), close: vi.fn() };
  }),
}));

// Logger — silence output during tests
vi.mock('@/server/observability/logger', () => ({
  createWorkerLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
  logJobStart: vi.fn(),
  logJobComplete: vi.fn(),
  logJobFailed: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// Sentry — no-op in unit tests
vi.mock('@/server/observability/sentry', () => ({
  captureJobError: vi.fn(),
  initializeSentry: vi.fn(),
  flushSentry: vi.fn(),
}));

// Redis config — return safe defaults
vi.mock('@/server/jobs/config', () => ({
  QUEUE_NAMES: { SHOPIFY_SYNC: 'shopify-sync', EVENT_COMPUTE: 'event-compute' },
  redisConnection: null,
  defaultWorkerOptions: {},
  isRedisConfigured: vi.fn(() => false), // prevents real Worker instantiation
}));

// ============================================================================
// IMPORT SUBJECT UNDER TEST
// All mocks must be registered above this import.
// ============================================================================

import { processShopifySync } from '@/server/jobs/workers/shopify-sync.worker';

// ============================================================================
// HELPERS
// ============================================================================

function makeJob(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'job-123',
    name: 'shopify-sync',
    attemptsMade: 0,
    data: {
      workspace_id: 'ws-abc',
      shopify_connection_id: 'conn-xyz',
      sync_type: 'initial' as const,
      correlation_id: 'corr-001',
      ...overrides,
    },
  } as any;
}

function makeConnection(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'conn-xyz',
    workspace_id: 'ws-abc',
    store_domain: 'test-store.myshopify.com',
    access_token_encrypted: 'enc-token',
    scopes: 'read_products',
    status: 'active',
    installed_at: new Date('2024-01-01'),
    revoked_at: null,
    sync_state: 'idle',
    last_synced_at: null,
    ...overrides,
  };
}

function makeProgress(overrides: Partial<Record<string, any>> = {}) {
  return {
    products: 10,
    orders: 20,
    customers: 15,
    inventoryLevels: 8,
    status: 'completed' as const,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('processShopifySync — happy path', () => {
  beforeEach(() => {
    mockPerformInitialSync.mockResolvedValue(makeProgress());

    // findFirst returns the active connection
    prismaMock.shopifyConnection.findFirst.mockResolvedValue(makeConnection() as any);

    // update is called for each setSyncState call
    prismaMock.shopifyConnection.update.mockResolvedValue(makeConnection() as any);

    mockEventQueueAdd.mockResolvedValue({ id: 'event-job-1' });
  });

  it('calls performInitialSync with workspaceId, shop, encryptedToken, and correlationId', async () => {
    const job = makeJob();
    await processShopifySync(job);

    expect(mockPerformInitialSync).toHaveBeenCalledOnce();
    expect(mockPerformInitialSync).toHaveBeenCalledWith({
      workspaceId: 'ws-abc',
      shop: 'test-store.myshopify.com',
      encryptedToken: 'enc-token',
      correlationId: 'corr-001',
    });
  });

  it('sets syncState to "syncing" before calling performInitialSync', async () => {
    const syncingOrder: string[] = [];

    // Track call order: update (syncing) should precede performInitialSync
    prismaMock.shopifyConnection.update.mockImplementation(async ({ data }: any) => {
      syncingOrder.push(`update:${data.sync_state}`);
      return makeConnection();
    });
    mockPerformInitialSync.mockImplementation(async () => {
      syncingOrder.push('performInitialSync');
      return makeProgress();
    });

    await processShopifySync(makeJob());

    expect(syncingOrder[0]).toBe('update:syncing');
    expect(syncingOrder[1]).toBe('performInitialSync');
  });

  it('sets syncState to "completed" after performInitialSync resolves', async () => {
    await processShopifySync(makeJob());

    // update is called twice: once for "syncing", once for "completed"
    const calls = prismaMock.shopifyConnection.update.mock.calls;
    const completedCall = calls.find(([{ data }]: any) => data.sync_state === 'completed');
    expect(completedCall).toBeDefined();
  });

  it('sets lastSyncedAt to a Date when sync completes', async () => {
    await processShopifySync(makeJob());

    const calls = prismaMock.shopifyConnection.update.mock.calls;
    const completedCall = calls.find(([{ data }]: any) => data.sync_state === 'completed');
    expect(completedCall).toBeDefined();
    const { data } = (completedCall as any)[0];
    expect(data.last_synced_at).toBeInstanceOf(Date);
  });

  it('returns synced counts from performInitialSync progress', async () => {
    const progress = makeProgress({ products: 5, orders: 3, customers: 7, inventoryLevels: 2 });
    mockPerformInitialSync.mockResolvedValue(progress);

    const result = await processShopifySync(makeJob());

    expect(result.synced).toEqual({
      products: 5,
      orders: 3,
      customers: 7,
      inventory_levels: 2,
    });
  });

  it('returns workspace_id and shopify_connection_id in result', async () => {
    const result = await processShopifySync(makeJob());

    expect(result.workspace_id).toBe('ws-abc');
    expect(result.shopify_connection_id).toBe('conn-xyz');
  });

  it('returns sync_type in result', async () => {
    const result = await processShopifySync(makeJob({ sync_type: 'refresh' }));
    expect(result.sync_type).toBe('refresh');
  });

  it('includes a positive duration_ms in result', async () => {
    const result = await processShopifySync(makeJob());
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('enqueues an event-compute job after successful sync', async () => {
    await processShopifySync(makeJob());

    expect(mockEventQueueAdd).toHaveBeenCalledOnce();
    expect(mockEventQueueAdd).toHaveBeenCalledWith(
      'compute-events',
      expect.objectContaining({
        workspace_id: 'ws-abc',
        trigger: 'shopify_sync_completed',
        correlation_id: 'corr-001',
      }),
      expect.objectContaining({ priority: 5 })
    );
  });
});

// ============================================================================

describe('processShopifySync — failure path', () => {
  const syncError = new Error('Shopify API unreachable');

  beforeEach(() => {
    prismaMock.shopifyConnection.findFirst.mockResolvedValue(makeConnection() as any);
    prismaMock.shopifyConnection.update.mockResolvedValue(makeConnection() as any);
    mockPerformInitialSync.mockRejectedValue(syncError);
  });

  it('sets syncState to "failed" when performInitialSync throws', async () => {
    await expect(processShopifySync(makeJob())).rejects.toThrow();

    const calls = prismaMock.shopifyConnection.update.mock.calls;
    const failedCall = calls.find(([{ data }]: any) => data.sync_state === 'failed');
    expect(failedCall).toBeDefined();
  });

  it('does NOT set lastSyncedAt on failure', async () => {
    await expect(processShopifySync(makeJob())).rejects.toThrow();

    const calls = prismaMock.shopifyConnection.update.mock.calls;
    const failedCall = calls.find(([{ data }]: any) => data.sync_state === 'failed');
    const { data } = (failedCall as any)[0];
    expect(data.last_synced_at).toBeUndefined();
  });

  it('re-throws the original error so BullMQ can retry', async () => {
    await expect(processShopifySync(makeJob())).rejects.toThrow('Shopify API unreachable');
  });

  it('does NOT enqueue event-compute when sync fails', async () => {
    await expect(processShopifySync(makeJob())).rejects.toThrow();
    expect(mockEventQueueAdd).not.toHaveBeenCalled();
  });
});

// ============================================================================

describe('processShopifySync — missing / inactive connection', () => {
  beforeEach(() => {
    // findFirst returns null — no matching active connection
    prismaMock.shopifyConnection.findFirst.mockResolvedValue(null);
    prismaMock.shopifyConnection.update.mockResolvedValue(makeConnection() as any);
  });

  it('throws when no active connection is found', async () => {
    await expect(processShopifySync(makeJob())).rejects.toThrow(
      /no active shopify connection/i
    );
  });

  it('does NOT call performInitialSync when connection is missing', async () => {
    await expect(processShopifySync(makeJob())).rejects.toThrow();
    expect(mockPerformInitialSync).not.toHaveBeenCalled();
  });

  it('sets syncState to "failed" when connection lookup fails', async () => {
    await expect(processShopifySync(makeJob())).rejects.toThrow();

    const calls = prismaMock.shopifyConnection.update.mock.calls;
    const failedCall = calls.find(([{ data }]: any) => data.sync_state === 'failed');
    expect(failedCall).toBeDefined();
  });
});
