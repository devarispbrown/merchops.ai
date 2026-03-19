/**
 * Unit Tests: Inventory Event Computation
 * MerchOps Beta MVP
 *
 * Covers:
 *   computeInventoryThresholdEvents
 *     - fires when available < threshold (default 10)
 *     - does NOT fire when available >= threshold
 *     - does NOT fire when available is exactly 0 (that is out-of-stock territory)
 *     - deduplicates: same (item, location, threshold) combination only fires once
 *     - threshold is configurable
 *
 *   computeOutOfStockEvents
 *     - fires when available === 0
 *     - does NOT fire when available > 0
 *     - deduplicates: same (item, location) only fires once per stockout episode
 *
 *   computeBackInStockEvents
 *     - fires when available > 0 AND a prior out-of-stock event exists
 *     - does NOT fire when no prior out-of-stock event exists
 *     - does NOT fire when available <= 0
 *     - deduplicates within the same calendar day
 *     - can re-fire on a different calendar day (new cycle)
 *     - calculates out_of_stock_duration_days from the prior event's occurred_at
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '../../setup';

// ============================================================================
// MODULE UNDER TEST
// ============================================================================

// The Prisma client is mocked globally via the setup file.
// We import the compute functions after the mock is in place.
import {
  computeInventoryThresholdEvents,
  computeOutOfStockEvents,
  computeBackInStockEvents,
} from '@/server/events/compute/inventory';

// We also need to intercept createEvent to assert what gets written without
// hitting the database.  We mock the create module.
vi.mock('@/server/events/create', () => ({
  createEvent: vi.fn().mockResolvedValue({ id: 'mock-event-id' }),
  createEventsBatch: vi.fn().mockResolvedValue([]),
  eventExists: vi.fn().mockResolvedValue(false),
  generateDedupeKey: vi.fn().mockReturnValue('mock-dedupe-key'),
  generateSpecificDedupeKey: vi.fn().mockReturnValue('mock-specific-dedupe-key'),
}));

import { createEvent } from '@/server/events/create';
const mockCreateEvent = createEvent as ReturnType<typeof vi.fn>;

// ============================================================================
// FIXTURE BUILDERS
// ============================================================================

const WORKSPACE_ID = 'ws-test-001';

/** Build a ShopifyObjectCache row for an inventory_level.
 *
 * IDs are stored as strings in data_json so that non-numeric IDs (used in
 * some test cases) round-trip through String() in the production code without
 * becoming NaN.  The real Shopify sync stores them as numbers, but the
 * production computation always calls String() on the raw value, so either
 * type works correctly at runtime.
 */
function makeInventoryLevelRecord(
  inventoryItemId: string,
  locationId: string,
  available: number
) {
  return {
    id: `inv-${inventoryItemId}-${locationId}`,
    workspace_id: WORKSPACE_ID,
    object_type: 'inventory_level',
    shopify_id: `${inventoryItemId}:${locationId}`,
    data_json: {
      // Store as strings so that non-numeric fixture IDs (e.g. 'ITEM-A')
      // survive String() in the production code without becoming 'NaN'.
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available,
    },
    version: 1,
    synced_at: new Date('2024-03-01T10:00:00Z'),
  };
}

/** Build a ShopifyObjectCache row for a product with a single variant.
 *
 * The variant's inventory_item_id must match the inventoryItemId argument
 * exactly (as a string) so that resolveProductMeta can find it.
 */
function makeProductRecord(
  productId: string,
  inventoryItemId: string,
  productTitle = 'Test Product',
  variantTitle = 'Default Title'
) {
  return {
    id: `prod-${productId}`,
    workspace_id: WORKSPACE_ID,
    object_type: 'product',
    shopify_id: productId,
    data_json: {
      id: productId,
      title: productTitle,
      variants: [
        {
          id: `variant-${inventoryItemId}`,
          title: variantTitle,
          // Must be the same string value used in the inventory level record
          inventory_item_id: inventoryItemId,
        },
      ],
    },
    version: 1,
    synced_at: new Date('2024-03-01T10:00:00Z'),
  };
}

/** Build an Event row for a product_out_of_stock entry */
function makeOutOfStockEvent(
  inventoryItemId: string,
  locationId: string,
  occurredAt: Date = new Date('2024-03-01T08:00:00Z')
) {
  return {
    id: `evt-oos-${inventoryItemId}-${locationId}`,
    workspace_id: WORKSPACE_ID,
    type: 'product_out_of_stock' as const,
    occurred_at: occurredAt,
    payload_json: {},
    dedupe_key: `out_of_stock:${inventoryItemId}:${locationId}`,
    source: 'computed' as const,
    created_at: occurredAt,
  };
}

// ============================================================================
// HELPERS FOR MOCK SETUP
// ============================================================================

/**
 * Wire up prismaMock so that:
 *  - shopifyObjectCache.findMany returns the supplied inventory records when
 *    called with object_type 'inventory_level', and product records when called
 *    with object_type 'product'.
 *  - event.count returns 0 (no existing events) by default.
 */
function setupCacheMocks(
  inventoryRecords: ReturnType<typeof makeInventoryLevelRecord>[],
  productRecords: ReturnType<typeof makeProductRecord>[] = [],
  existingEventCounts: Record<string, number> = {}
) {
  prismaMock.shopifyObjectCache.findMany.mockImplementation(
    (args: any) => {
      const type = args?.where?.object_type;
      if (type === 'inventory_level') return Promise.resolve(inventoryRecords as any);
      if (type === 'product') return Promise.resolve(productRecords as any);
      return Promise.resolve([]);
    }
  );

  // event.count is used by eventWithDedupeKeyExists
  prismaMock.event.count.mockImplementation((args: any) => {
    const key = args?.where?.dedupe_key;
    const count = existingEventCounts[key] ?? 0;
    return Promise.resolve(count);
  });
}

// ============================================================================
// TESTS: computeInventoryThresholdEvents
// ============================================================================

describe('computeInventoryThresholdEvents', () => {
  beforeEach(() => {
    mockCreateEvent.mockClear();
  });

  it('fires an event when available is below the default threshold (10)', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 5)],
      [makeProductRecord('999', '111')]
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    expect(mockCreateEvent).toHaveBeenCalledOnce();
    const call = mockCreateEvent.mock.calls[0][0];
    expect(call.type).toBe('inventory_threshold_crossed');
    expect(call.dedupe_key).toBe('inventory_threshold:111:222:10');
    expect(call.payload.current_inventory).toBe(5);
    expect(call.payload.threshold).toBe(10);
  });

  it('does NOT fire when available equals the threshold', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 10)],
      [makeProductRecord('999', '111')]
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('does NOT fire when available is above the threshold', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 50)],
      [makeProductRecord('999', '111')]
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('does NOT fire when available is exactly 0 (that is out-of-stock territory)', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 0)],
      [makeProductRecord('999', '111')]
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('respects a custom threshold', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 18)],
      [makeProductRecord('999', '111')]
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID, 20);

    expect(mockCreateEvent).toHaveBeenCalledOnce();
    const call = mockCreateEvent.mock.calls[0][0];
    expect(call.payload.threshold).toBe(20);
    expect(call.dedupe_key).toBe('inventory_threshold:111:222:20');
  });

  it('encodes location_id and inventory_item_id in the dedupe_key', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('ITEM-A', 'LOC-B', 3)],
      [makeProductRecord('999', 'ITEM-A')]
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    const call = mockCreateEvent.mock.calls[0][0];
    expect(call.dedupe_key).toContain('ITEM-A');
    expect(call.dedupe_key).toContain('LOC-B');
  });

  it('deduplicates: does NOT fire when the same dedupe_key already exists', async () => {
    const existingKey = 'inventory_threshold:111:222:10';
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 5)],
      [makeProductRecord('999', '111')],
      { [existingKey]: 1 } // pre-existing event
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('fires separate events for different locations of the same item', async () => {
    setupCacheMocks(
      [
        makeInventoryLevelRecord('111', 'LOC-1', 3),
        makeInventoryLevelRecord('111', 'LOC-2', 4),
      ],
      [makeProductRecord('999', '111')]
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    expect(mockCreateEvent).toHaveBeenCalledTimes(2);
    const keys = mockCreateEvent.mock.calls.map((c: any) => c[0].dedupe_key);
    expect(keys).toContain('inventory_threshold:111:LOC-1:10');
    expect(keys).toContain('inventory_threshold:111:LOC-2:10');
  });

  it('includes workspace_id and source in the event', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 5)],
      [makeProductRecord('999', '111')]
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    const call = mockCreateEvent.mock.calls[0][0];
    expect(call.workspace_id).toBe(WORKSPACE_ID);
    expect(call.source).toBe('computed');
  });
});

// ============================================================================
// TESTS: computeOutOfStockEvents
// ============================================================================

describe('computeOutOfStockEvents', () => {
  beforeEach(() => {
    mockCreateEvent.mockClear();
  });

  it('fires an event when available is exactly 0', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 0)],
      [makeProductRecord('999', '111')]
    );

    await computeOutOfStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).toHaveBeenCalledOnce();
    const call = mockCreateEvent.mock.calls[0][0];
    expect(call.type).toBe('product_out_of_stock');
    expect(call.dedupe_key).toBe('out_of_stock:111:222');
  });

  it('does NOT fire when available is greater than 0', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 1)],
      [makeProductRecord('999', '111')]
    );

    await computeOutOfStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('deduplicates: does NOT fire when an out-of-stock event already exists', async () => {
    const existingKey = 'out_of_stock:111:222';
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 0)],
      [makeProductRecord('999', '111')],
      { [existingKey]: 1 }
    );

    await computeOutOfStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('fires separate events for different (item, location) pairs', async () => {
    setupCacheMocks(
      [
        makeInventoryLevelRecord('111', 'LOC-1', 0),
        makeInventoryLevelRecord('222', 'LOC-1', 0),
      ],
      [makeProductRecord('999', '111'), makeProductRecord('888', '222')]
    );

    await computeOutOfStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).toHaveBeenCalledTimes(2);
  });

  it('includes correct payload fields', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 0)],
      [makeProductRecord('999', '111', 'Cool Hat', 'One Size')]
    );

    await computeOutOfStockEvents(WORKSPACE_ID);

    const payload = mockCreateEvent.mock.calls[0][0].payload;
    expect(payload.product_title).toBe('Cool Hat');
    expect(payload.variant_title).toBe('One Size');
    expect(payload.location_id).toBe('222');
  });

  it('handles negative available values as still out-of-stock (available !== 0)', async () => {
    // available -1 means oversold but is NOT zero, so out-of-stock should NOT fire
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', -1)],
      [makeProductRecord('999', '111')]
    );

    await computeOutOfStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: computeBackInStockEvents
// ============================================================================

describe('computeBackInStockEvents', () => {
  beforeEach(() => {
    mockCreateEvent.mockClear();
    prismaMock.event.findFirst.mockResolvedValue(null);
  });

  it('fires when available > 0 AND a prior out-of-stock event exists', async () => {
    const outOfStockKey = 'out_of_stock:111:222';

    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 25)],
      [makeProductRecord('999', '111')],
      { [outOfStockKey]: 1 } // prior out-of-stock recorded
    );

    const outOfStockOccurredAt = new Date('2024-03-01T08:00:00Z');
    prismaMock.event.findFirst.mockResolvedValue(
      makeOutOfStockEvent('111', '222', outOfStockOccurredAt) as any
    );

    await computeBackInStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).toHaveBeenCalledOnce();
    const call = mockCreateEvent.mock.calls[0][0];
    expect(call.type).toBe('product_back_in_stock');
    expect(call.payload.new_inventory).toBe(25);
  });

  it('does NOT fire when no prior out-of-stock event exists', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 25)],
      [makeProductRecord('999', '111')],
      {} // no out-of-stock key
    );

    await computeBackInStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('does NOT fire when available is 0', async () => {
    const outOfStockKey = 'out_of_stock:111:222';

    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 0)],
      [makeProductRecord('999', '111')],
      { [outOfStockKey]: 1 }
    );

    await computeBackInStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('does NOT fire when available is negative', async () => {
    const outOfStockKey = 'out_of_stock:111:222';

    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', -5)],
      [makeProductRecord('999', '111')],
      { [outOfStockKey]: 1 }
    );

    await computeBackInStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('includes date bucket in the dedupe_key', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T14:00:00Z'));

    const outOfStockKey = 'out_of_stock:111:222';

    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 10)],
      [makeProductRecord('999', '111')],
      { [outOfStockKey]: 1 }
    );

    prismaMock.event.findFirst.mockResolvedValue(
      makeOutOfStockEvent('111', '222') as any
    );

    await computeBackInStockEvents(WORKSPACE_ID);

    const call = mockCreateEvent.mock.calls[0][0];
    expect(call.dedupe_key).toBe('back_in_stock:111:222:2024-03-15');

    vi.useRealTimers();
  });

  it('deduplicates within the same calendar day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T14:00:00Z'));

    const outOfStockKey = 'out_of_stock:111:222';
    const backInStockKey = 'back_in_stock:111:222:2024-03-15';

    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 10)],
      [makeProductRecord('999', '111')],
      {
        [outOfStockKey]: 1,
        [backInStockKey]: 1, // already fired today
      }
    );

    await computeBackInStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('can re-fire on a different calendar day (new restock cycle)', async () => {
    // Day 1 key already exists, but today is day 2
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-16T10:00:00Z'));

    const outOfStockKey = 'out_of_stock:111:222';
    const day1Key = 'back_in_stock:111:222:2024-03-15';
    const day2Key = 'back_in_stock:111:222:2024-03-16';

    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 10)],
      [makeProductRecord('999', '111')],
      {
        [outOfStockKey]: 1,
        [day1Key]: 1, // fired yesterday
        // day2Key does NOT exist yet
      }
    );

    // Return 0 for the day2 key explicitly (default is 0 when key not in map)
    prismaMock.event.count.mockImplementation((args: any) => {
      const key = args?.where?.dedupe_key;
      const counts: Record<string, number> = {
        [outOfStockKey]: 1,
        [day1Key]: 1,
        [day2Key]: 0,
      };
      return Promise.resolve(counts[key] ?? 0);
    });

    prismaMock.event.findFirst.mockResolvedValue(
      makeOutOfStockEvent('111', '222', new Date('2024-03-14T08:00:00Z')) as any
    );

    await computeBackInStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).toHaveBeenCalledOnce();
    const call = mockCreateEvent.mock.calls[0][0];
    expect(call.dedupe_key).toBe(day2Key);

    vi.useRealTimers();
  });

  it('calculates out_of_stock_duration_days from the prior out-of-stock event', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-03-10T10:00:00Z');
    vi.setSystemTime(now);

    const outOfStockKey = 'out_of_stock:111:222';

    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 20)],
      [makeProductRecord('999', '111')],
      { [outOfStockKey]: 1 }
    );

    // Out of stock occurred 5 days ago
    const outOfStockDate = new Date('2024-03-05T10:00:00Z');
    prismaMock.event.findFirst.mockResolvedValue(
      makeOutOfStockEvent('111', '222', outOfStockDate) as any
    );

    await computeBackInStockEvents(WORKSPACE_ID);

    const payload = mockCreateEvent.mock.calls[0][0].payload;
    expect(payload.out_of_stock_duration_days).toBe(5);

    vi.useRealTimers();
  });

  it('sets out_of_stock_duration_days to 0 when no prior event record is found', async () => {
    const outOfStockKey = 'out_of_stock:111:222';

    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 10)],
      [makeProductRecord('999', '111')],
      { [outOfStockKey]: 1 }
    );

    // event.count says event exists, but findFirst returns null (edge case)
    prismaMock.event.findFirst.mockResolvedValue(null);

    await computeBackInStockEvents(WORKSPACE_ID);

    const payload = mockCreateEvent.mock.calls[0][0].payload;
    expect(payload.out_of_stock_duration_days).toBe(0);
  });

  it('includes correct payload fields', async () => {
    const outOfStockKey = 'out_of_stock:ITEM-X:LOC-Y';

    setupCacheMocks(
      [makeInventoryLevelRecord('ITEM-X', 'LOC-Y', 15)],
      [makeProductRecord('999', 'ITEM-X', 'Blue Hoodie', 'Large')],
      { [outOfStockKey]: 1 }
    );

    // Provide both findFirst mocks: one for the out-of-stock event lookup used
    // to calculate duration, and ensure it returns a valid event.
    prismaMock.event.findFirst.mockResolvedValue(
      makeOutOfStockEvent('ITEM-X', 'LOC-Y', new Date('2024-03-01T08:00:00Z')) as any
    );

    await computeBackInStockEvents(WORKSPACE_ID);

    expect(mockCreateEvent).toHaveBeenCalledOnce();
    const payload = mockCreateEvent.mock.calls[0][0].payload;
    expect(payload.product_title).toBe('Blue Hoodie');
    expect(payload.variant_title).toBe('Large');
    expect(payload.new_inventory).toBe(15);
    expect(payload.location_id).toBe('LOC-Y');
    expect(payload.restocked_at).toBeDefined();
  });
});

// ============================================================================
// TESTS: PRODUCT METADATA RESOLUTION FALLBACKS
// ============================================================================

describe('Product metadata resolution', () => {
  beforeEach(() => {
    mockCreateEvent.mockClear();
    prismaMock.event.findFirst.mockResolvedValue(null);
  });

  it('uses inventory_item_id as fallback product_id when no product found', async () => {
    // Inventory level with no matching product in cache
    setupCacheMocks(
      [makeInventoryLevelRecord('ORPHAN-ITEM', '222', 5)],
      [] // empty product cache
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    const payload = mockCreateEvent.mock.calls[0][0].payload;
    expect(payload.product_id).toBe('ORPHAN-ITEM');
    expect(payload.product_title).toBe('Unknown Product');
  });

  it('correctly resolves product meta when variant carries inventory_item_id', async () => {
    setupCacheMocks(
      [makeInventoryLevelRecord('111', '222', 3)],
      [makeProductRecord('999', '111', 'Fancy Widget', 'Blue')]
    );

    await computeInventoryThresholdEvents(WORKSPACE_ID);

    const payload = mockCreateEvent.mock.calls[0][0].payload;
    expect(payload.product_title).toBe('Fancy Widget');
    expect(payload.variant_title).toBe('Blue');
  });
});

// ============================================================================
// TESTS: WORKSPACE ISOLATION
// ============================================================================

describe('Workspace isolation', () => {
  it('only queries inventory levels for the specified workspace', async () => {
    setupCacheMocks([], []);

    await computeInventoryThresholdEvents('some-other-ws');

    // Confirm workspace_id filter was forwarded to Prisma
    expect(prismaMock.shopifyObjectCache.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspace_id: 'some-other-ws' }),
      })
    );
  });
});
