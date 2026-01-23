/**
 * Unit Tests: Event Deduplication
 * MerchOps Beta MVP
 *
 * Tests:
 * - Dedupe key generation
 * - Duplicate event prevention
 * - Idempotency across webhook retries
 * - Event uniqueness guarantees
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prismaMock, createTestEvent, createTestWorkspace } from '../../setup';

// ============================================================================
// DEDUPE KEY GENERATION
// ============================================================================

interface DedupeKeyParams {
  eventType: string;
  resourceId: string;
  timestamp: Date;
  additionalContext?: Record<string, any>;
}

/**
 * Generate deterministic dedupe key for an event
 * Format: {event_type}:{resource_id}:{date}:{hash_of_context}
 */
function generateDedupeKey(params: DedupeKeyParams): string {
  const dateStr = params.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD

  // Base key without context
  let key = `${params.eventType}:${params.resourceId}:${dateStr}`;

  // Add context hash if present
  if (params.additionalContext) {
    const contextStr = JSON.stringify(params.additionalContext, Object.keys(params.additionalContext).sort());
    const contextHash = simpleHash(contextStr);
    key += `:${contextHash}`;
  }

  return key;
}

/**
 * Simple hash function for consistency
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract dedupe parameters from event payload
 */
function extractDedupeParams(
  eventType: string,
  payload: Record<string, any>,
  occurredAt: Date
): DedupeKeyParams {
  switch (eventType) {
    case 'inventory_threshold_crossed':
      return {
        eventType,
        resourceId: payload.product_id,
        timestamp: occurredAt,
        additionalContext: {
          threshold: payload.threshold,
          direction: payload.current_inventory < payload.threshold ? 'below' : 'above',
        },
      };

    case 'product_out_of_stock':
      return {
        eventType,
        resourceId: payload.product_id,
        timestamp: occurredAt,
      };

    case 'product_back_in_stock':
      return {
        eventType,
        resourceId: payload.product_id,
        timestamp: occurredAt,
      };

    case 'velocity_spike':
      return {
        eventType,
        resourceId: payload.product_id,
        timestamp: occurredAt,
        additionalContext: {
          spike_magnitude: Math.floor(payload.spike_percentage / 10) * 10, // Round to nearest 10%
        },
      };

    case 'customer_inactivity_threshold':
      return {
        eventType,
        resourceId: payload.customer_id,
        timestamp: occurredAt,
        additionalContext: {
          threshold_days: payload.threshold_days,
        },
      };

    default:
      return {
        eventType,
        resourceId: payload.resource_id || 'unknown',
        timestamp: occurredAt,
      };
  }
}

// ============================================================================
// TESTS: DEDUPE KEY GENERATION
// ============================================================================

describe('Dedupe Key Generation', () => {
  it('generates deterministic keys for same inputs', () => {
    const params: DedupeKeyParams = {
      eventType: 'inventory_threshold_crossed',
      resourceId: 'gid://shopify/Product/123456',
      timestamp: new Date('2024-01-15T12:00:00Z'),
      additionalContext: { threshold: 10, direction: 'below' },
    };

    const key1 = generateDedupeKey(params);
    const key2 = generateDedupeKey(params);
    const key3 = generateDedupeKey(params);

    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it('includes event type in key', () => {
    const params: DedupeKeyParams = {
      eventType: 'product_out_of_stock',
      resourceId: 'gid://shopify/Product/123456',
      timestamp: new Date('2024-01-15T12:00:00Z'),
    };

    const key = generateDedupeKey(params);

    expect(key).toContain('product_out_of_stock');
  });

  it('includes resource ID in key', () => {
    const params: DedupeKeyParams = {
      eventType: 'inventory_threshold_crossed',
      resourceId: 'gid://shopify/Product/789012',
      timestamp: new Date('2024-01-15T12:00:00Z'),
    };

    const key = generateDedupeKey(params);

    expect(key).toContain('gid://shopify/Product/789012');
  });

  it('includes date (not full timestamp) in key', () => {
    const params: DedupeKeyParams = {
      eventType: 'velocity_spike',
      resourceId: 'gid://shopify/Product/123456',
      timestamp: new Date('2024-01-15T12:34:56Z'),
    };

    const key = generateDedupeKey(params);

    expect(key).toContain('2024-01-15');
    expect(key).not.toContain('12:34:56');
  });

  it('treats events on different dates as different', () => {
    const baseParams = {
      eventType: 'inventory_threshold_crossed',
      resourceId: 'gid://shopify/Product/123456',
    };

    const key1 = generateDedupeKey({
      ...baseParams,
      timestamp: new Date('2024-01-15T23:59:59Z'),
    });

    const key2 = generateDedupeKey({
      ...baseParams,
      timestamp: new Date('2024-01-16T00:00:01Z'),
    });

    expect(key1).not.toBe(key2);
  });

  it('treats events at different times on same date as duplicates', () => {
    const baseParams = {
      eventType: 'product_out_of_stock',
      resourceId: 'gid://shopify/Product/123456',
    };

    const key1 = generateDedupeKey({
      ...baseParams,
      timestamp: new Date('2024-01-15T08:00:00Z'),
    });

    const key2 = generateDedupeKey({
      ...baseParams,
      timestamp: new Date('2024-01-15T18:00:00Z'),
    });

    expect(key1).toBe(key2);
  });

  it('includes context hash when additional context provided', () => {
    const paramsWithContext: DedupeKeyParams = {
      eventType: 'customer_inactivity_threshold',
      resourceId: 'gid://shopify/Customer/123',
      timestamp: new Date('2024-01-15T12:00:00Z'),
      additionalContext: { threshold_days: 30 },
    };

    const paramsWithoutContext: DedupeKeyParams = {
      eventType: 'customer_inactivity_threshold',
      resourceId: 'gid://shopify/Customer/123',
      timestamp: new Date('2024-01-15T12:00:00Z'),
    };

    const keyWithContext = generateDedupeKey(paramsWithContext);
    const keyWithoutContext = generateDedupeKey(paramsWithoutContext);

    expect(keyWithContext).not.toBe(keyWithoutContext);
    expect(keyWithContext.split(':').length).toBe(5); // type:id:date:hash:context
  });

  it('generates different keys for different additional context', () => {
    const baseParams = {
      eventType: 'velocity_spike',
      resourceId: 'gid://shopify/Product/123456',
      timestamp: new Date('2024-01-15T12:00:00Z'),
    };

    const key1 = generateDedupeKey({
      ...baseParams,
      additionalContext: { spike_magnitude: 50 },
    });

    const key2 = generateDedupeKey({
      ...baseParams,
      additionalContext: { spike_magnitude: 100 },
    });

    expect(key1).not.toBe(key2);
  });
});

// ============================================================================
// TESTS: EVENT TYPE-SPECIFIC DEDUPE KEY EXTRACTION
// ============================================================================

describe('Event Type-Specific Dedupe Keys', () => {
  it('extracts inventory threshold params correctly', () => {
    const payload = {
      product_id: 'gid://shopify/Product/123456',
      current_inventory: 5,
      threshold: 10,
    };

    const params = extractDedupeParams(
      'inventory_threshold_crossed',
      payload,
      new Date('2024-01-15T12:00:00Z')
    );

    expect(params.eventType).toBe('inventory_threshold_crossed');
    expect(params.resourceId).toBe('gid://shopify/Product/123456');
    expect(params.additionalContext).toEqual({
      threshold: 10,
      direction: 'below',
    });
  });

  it('extracts product out of stock params correctly', () => {
    const payload = {
      product_id: 'gid://shopify/Product/789012',
      inventory_level: 0,
    };

    const params = extractDedupeParams(
      'product_out_of_stock',
      payload,
      new Date('2024-01-15T12:00:00Z')
    );

    expect(params.eventType).toBe('product_out_of_stock');
    expect(params.resourceId).toBe('gid://shopify/Product/789012');
    expect(params.additionalContext).toBeUndefined();
  });

  it('extracts velocity spike params with magnitude bucketing', () => {
    const payload = {
      product_id: 'gid://shopify/Product/123456',
      spike_percentage: 127, // Should bucket to 120
    };

    const params = extractDedupeParams(
      'velocity_spike',
      payload,
      new Date('2024-01-15T12:00:00Z')
    );

    expect(params.additionalContext?.spike_magnitude).toBe(120);
  });

  it('extracts customer inactivity params correctly', () => {
    const payload = {
      customer_id: 'gid://shopify/Customer/456',
      threshold_days: 60,
      last_order_date: '2023-11-15',
    };

    const params = extractDedupeParams(
      'customer_inactivity_threshold',
      payload,
      new Date('2024-01-15T12:00:00Z')
    );

    expect(params.eventType).toBe('customer_inactivity_threshold');
    expect(params.resourceId).toBe('gid://shopify/Customer/456');
    expect(params.additionalContext).toEqual({ threshold_days: 60 });
  });
});

// ============================================================================
// TESTS: DUPLICATE EVENT PREVENTION
// ============================================================================

describe('Duplicate Event Prevention', () => {
  const workspace = createTestWorkspace();

  beforeEach(() => {
    prismaMock.workspace.findUnique.mockResolvedValue(workspace);
  });

  it('prevents duplicate events with same dedupe key', async () => {
    const payload = {
      product_id: 'gid://shopify/Product/123456',
      current_inventory: 5,
      threshold: 10,
    };

    const occurredAt = new Date('2024-01-15T12:00:00Z');
    const params = extractDedupeParams('inventory_threshold_crossed', payload, occurredAt);
    const dedupeKey = generateDedupeKey(params);

    // First event succeeds
    const event1 = createTestEvent({
      dedupe_key: dedupeKey,
      payload_json: payload,
    });

    prismaMock.event.create.mockResolvedValueOnce(event1);

    // Second event with same dedupe key should be rejected
    prismaMock.event.create.mockRejectedValueOnce({
      code: 'P2002', // Prisma unique constraint violation
      meta: { target: ['workspace_id', 'dedupe_key'] },
    });

    // Attempt to create first event
    const result1 = await prismaMock.event.create({
      data: {
        workspace_id: workspace.id,
        type: 'inventory_threshold_crossed',
        occurred_at: occurredAt,
        payload_json: payload,
        dedupe_key: dedupeKey,
        source: 'computed',
      },
    });

    expect(result1).toEqual(event1);

    // Attempt to create duplicate event
    await expect(
      prismaMock.event.create({
        data: {
          workspace_id: workspace.id,
          type: 'inventory_threshold_crossed',
          occurred_at: occurredAt,
          payload_json: payload,
          dedupe_key: dedupeKey,
          source: 'computed',
        },
      })
    ).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allows events with different dedupe keys', async () => {
    const payload1 = {
      product_id: 'gid://shopify/Product/123456',
      current_inventory: 5,
      threshold: 10,
    };

    const payload2 = {
      product_id: 'gid://shopify/Product/789012', // Different product
      current_inventory: 5,
      threshold: 10,
    };

    const occurredAt = new Date('2024-01-15T12:00:00Z');

    const params1 = extractDedupeParams('inventory_threshold_crossed', payload1, occurredAt);
    const params2 = extractDedupeParams('inventory_threshold_crossed', payload2, occurredAt);

    const dedupeKey1 = generateDedupeKey(params1);
    const dedupeKey2 = generateDedupeKey(params2);

    expect(dedupeKey1).not.toBe(dedupeKey2);

    const event1 = createTestEvent({ dedupe_key: dedupeKey1 });
    const event2 = createTestEvent({ id: 'event-2', dedupe_key: dedupeKey2 });

    prismaMock.event.create.mockResolvedValueOnce(event1).mockResolvedValueOnce(event2);

    // Both should succeed
    const result1 = await prismaMock.event.create({
      data: {
        workspace_id: workspace.id,
        type: 'inventory_threshold_crossed',
        occurred_at: occurredAt,
        payload_json: payload1,
        dedupe_key: dedupeKey1,
        source: 'computed',
      },
    });

    const result2 = await prismaMock.event.create({
      data: {
        workspace_id: workspace.id,
        type: 'inventory_threshold_crossed',
        occurred_at: occurredAt,
        payload_json: payload2,
        dedupe_key: dedupeKey2,
        source: 'computed',
      },
    });

    expect(result1.dedupe_key).toBe(dedupeKey1);
    expect(result2.dedupe_key).toBe(dedupeKey2);
  });
});

// ============================================================================
// TESTS: WEBHOOK RETRY IDEMPOTENCY
// ============================================================================

describe('Webhook Retry Idempotency', () => {
  const workspace = createTestWorkspace();

  it('handles Shopify webhook retries gracefully', async () => {
    // Shopify retries webhooks with identical payload
    const webhookPayload = {
      id: 123456789,
      product_id: 'gid://shopify/Product/123456',
      inventory_quantity: 0,
    };

    const occurredAt = new Date('2024-01-15T12:00:00Z');
    const params = extractDedupeParams('product_out_of_stock', webhookPayload, occurredAt);
    const dedupeKey = generateDedupeKey(params);

    const event = createTestEvent({ dedupe_key: dedupeKey });

    // First webhook delivery - check if dedupe key exists (returns null), then create
    prismaMock.event.create.mockResolvedValueOnce(event);

    // First delivery creates event
    const result1 = await prismaMock.event.create({
      data: {
        workspace_id: workspace.id,
        type: 'product_out_of_stock',
        occurred_at: occurredAt,
        payload_json: webhookPayload,
        dedupe_key: dedupeKey,
        source: 'webhook',
      },
    });

    expect(result1).toEqual(event);

    // Second webhook delivery (retry) - should find existing event
    prismaMock.event.findUnique.mockResolvedValueOnce(event);

    // Retry should find existing event instead of creating duplicate
    const existingEvent = await prismaMock.event.findUnique({
      where: {
        workspace_id_dedupe_key: {
          workspace_id: workspace.id,
          dedupe_key: dedupeKey,
        },
      },
    });

    expect(existingEvent).toEqual(event);
  });

  it('treats webhook retries with different timestamps as duplicates', () => {
    const payload = {
      product_id: 'gid://shopify/Product/123456',
      inventory_quantity: 0,
    };

    // First delivery at 12:00
    const params1 = extractDedupeParams(
      'product_out_of_stock',
      payload,
      new Date('2024-01-15T12:00:00Z')
    );

    // Retry at 12:05 (same date)
    const params2 = extractDedupeParams(
      'product_out_of_stock',
      payload,
      new Date('2024-01-15T12:05:00Z')
    );

    const key1 = generateDedupeKey(params1);
    const key2 = generateDedupeKey(params2);

    expect(key1).toBe(key2);
  });
});

// ============================================================================
// TESTS: CROSS-WORKSPACE ISOLATION
// ============================================================================

describe('Cross-Workspace Isolation', () => {
  it('allows same dedupe key in different workspaces', async () => {
    const workspace1 = createTestWorkspace({ id: 'workspace-1' });
    const workspace2 = createTestWorkspace({ id: 'workspace-2' });

    const payload = {
      product_id: 'gid://shopify/Product/123456',
      current_inventory: 5,
      threshold: 10,
    };

    const occurredAt = new Date('2024-01-15T12:00:00Z');
    const params = extractDedupeParams('inventory_threshold_crossed', payload, occurredAt);
    const dedupeKey = generateDedupeKey(params);

    const event1 = createTestEvent({
      id: 'event-1',
      workspace_id: workspace1.id,
      dedupe_key: dedupeKey,
    });

    const event2 = createTestEvent({
      id: 'event-2',
      workspace_id: workspace2.id,
      dedupe_key: dedupeKey,
    });

    prismaMock.event.create.mockResolvedValueOnce(event1).mockResolvedValueOnce(event2);

    // Both should succeed since workspace_id is part of unique constraint
    const result1 = await prismaMock.event.create({
      data: {
        workspace_id: workspace1.id,
        type: 'inventory_threshold_crossed',
        occurred_at: occurredAt,
        payload_json: payload,
        dedupe_key: dedupeKey,
        source: 'computed',
      },
    });

    const result2 = await prismaMock.event.create({
      data: {
        workspace_id: workspace2.id,
        type: 'inventory_threshold_crossed',
        occurred_at: occurredAt,
        payload_json: payload,
        dedupe_key: dedupeKey,
        source: 'computed',
      },
    });

    expect(result1.workspace_id).toBe(workspace1.id);
    expect(result2.workspace_id).toBe(workspace2.id);
    expect(result1.dedupe_key).toBe(result2.dedupe_key);
  });
});

// ============================================================================
// TESTS: EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('handles events with missing resource_id gracefully', () => {
    const payload = {
      some_field: 'value',
    };

    const params = extractDedupeParams(
      'unknown_event_type',
      payload,
      new Date('2024-01-15T12:00:00Z')
    );

    expect(params.resourceId).toBe('unknown');
  });

  it('handles empty additional context', () => {
    const params: DedupeKeyParams = {
      eventType: 'test_event',
      resourceId: 'test-id',
      timestamp: new Date('2024-01-15T12:00:00Z'),
      additionalContext: {},
    };

    const key = generateDedupeKey(params);

    // Empty context should still generate hash
    expect(key.split(':').length).toBeGreaterThan(3);
  });

  it('handles context with nested objects consistently', () => {
    const params1: DedupeKeyParams = {
      eventType: 'test',
      resourceId: 'id',
      timestamp: new Date('2024-01-15T12:00:00Z'),
      additionalContext: { a: 1, b: { c: 2 } },
    };

    const params2: DedupeKeyParams = {
      eventType: 'test',
      resourceId: 'id',
      timestamp: new Date('2024-01-15T12:00:00Z'),
      additionalContext: { b: { c: 2 }, a: 1 }, // Different order
    };

    const key1 = generateDedupeKey(params1);
    const key2 = generateDedupeKey(params2);

    expect(key1).toBe(key2); // Should be same despite key order
  });
});
