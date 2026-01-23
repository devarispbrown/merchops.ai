/**
 * Event Test Fixtures
 *
 * Sample events for all event types with proper dedupe keys and timestamps.
 */

import { EventType, EventSource } from '../../server/events/types';
import type {
  InventoryThresholdCrossedPayload,
  ProductOutOfStockPayload,
  ProductBackInStockPayload,
  VelocitySpikePayload,
  CustomerInactivityThresholdPayload,
} from '../../server/events/types';

// ============================================================================
// BASE EVENT DATA
// ============================================================================

const baseEvent = {
  workspace_id: 'workspace-test-123',
  created_at: new Date('2024-01-15T10:00:00Z'),
};

// ============================================================================
// INVENTORY THRESHOLD CROSSED EVENTS
// ============================================================================

export const inventoryThresholdCrossedLow: InventoryThresholdCrossedPayload = {
  product_id: '7890123456789',
  variant_id: '4567890123457',
  product_title: 'Cool T-Shirt',
  variant_title: 'Medium',
  current_inventory: 8,
  threshold: 10,
  previous_inventory: 15,
  location_id: '1234567890',
};

export const inventoryThresholdCrossedCritical: InventoryThresholdCrossedPayload = {
  product_id: '7890123456789',
  variant_id: '4567890123456',
  product_title: 'Cool T-Shirt',
  variant_title: 'Small',
  current_inventory: 3,
  threshold: 5,
  previous_inventory: 8,
  location_id: '1234567890',
};

export const inventoryThresholdEvent1 = {
  id: 'evt-inv-threshold-1',
  ...baseEvent,
  type: EventType.inventory_threshold_crossed,
  occurred_at: new Date('2024-01-15T09:30:00Z'),
  payload_json: inventoryThresholdCrossedLow,
  dedupe_key: 'inv-threshold:7890123456789:4567890123457:2024-01-15',
  source: EventSource.COMPUTED,
};

export const inventoryThresholdEvent2 = {
  id: 'evt-inv-threshold-2',
  ...baseEvent,
  type: EventType.inventory_threshold_crossed,
  occurred_at: new Date('2024-01-15T09:45:00Z'),
  payload_json: inventoryThresholdCrossedCritical,
  dedupe_key: 'inv-threshold:7890123456789:4567890123456:2024-01-15',
  source: EventSource.COMPUTED,
};

// ============================================================================
// PRODUCT OUT OF STOCK EVENTS
// ============================================================================

export const productOutOfStockFast: ProductOutOfStockPayload = {
  product_id: '7890123456789',
  variant_id: '4567890123458',
  product_title: 'Cool T-Shirt',
  variant_title: 'Large',
  last_sale_at: '2024-01-15T08:30:00Z',
  days_in_stock: 14,
  location_id: '1234567890',
};

export const productOutOfStockSlow: ProductOutOfStockPayload = {
  product_id: '8901234567890',
  variant_id: '5678901234568',
  product_title: 'Vintage Denim Jacket',
  variant_title: 'Large',
  last_sale_at: '2024-01-10T14:20:00Z',
  days_in_stock: 89,
  location_id: '1234567890',
};

export const productOutOfStockEvent1 = {
  id: 'evt-out-of-stock-1',
  ...baseEvent,
  type: EventType.product_out_of_stock,
  occurred_at: new Date('2024-01-15T08:30:00Z'),
  payload_json: productOutOfStockFast,
  dedupe_key: 'out-of-stock:7890123456789:4567890123458:2024-01-15',
  source: EventSource.WEBHOOK,
};

export const productOutOfStockEvent2 = {
  id: 'evt-out-of-stock-2',
  ...baseEvent,
  type: EventType.product_out_of_stock,
  occurred_at: new Date('2024-01-15T10:15:00Z'),
  payload_json: productOutOfStockSlow,
  dedupe_key: 'out-of-stock:8901234567890:5678901234568:2024-01-15',
  source: EventSource.SCHEDULED_JOB,
};

// ============================================================================
// PRODUCT BACK IN STOCK EVENTS
// ============================================================================

export const productBackInStockQuick: ProductBackInStockPayload = {
  product_id: '9012345678901',
  variant_id: '6789012345681',
  product_title: 'Premium Yoga Mat',
  variant_title: 'Purple',
  new_inventory: 45,
  out_of_stock_duration_days: 12,
  restocked_at: '2024-01-15T07:00:00Z',
  location_id: '1234567890',
};

export const productBackInStockExtended: ProductBackInStockPayload = {
  product_id: '9012345678902',
  variant_id: '6789012345682',
  product_title: 'Ceramic Planter Set',
  variant_title: 'Medium - 3 Pack',
  new_inventory: 28,
  out_of_stock_duration_days: 5,
  restocked_at: '2024-01-15T09:00:00Z',
  location_id: '1234567890',
};

export const productBackInStockEvent1 = {
  id: 'evt-back-in-stock-1',
  ...baseEvent,
  type: EventType.product_back_in_stock,
  occurred_at: new Date('2024-01-15T07:00:00Z'),
  payload_json: productBackInStockQuick,
  dedupe_key: 'back-in-stock:9012345678901:6789012345681:2024-01-15T07:00:00Z',
  source: EventSource.WEBHOOK,
};

export const productBackInStockEvent2 = {
  id: 'evt-back-in-stock-2',
  ...baseEvent,
  type: EventType.product_back_in_stock,
  occurred_at: new Date('2024-01-15T09:00:00Z'),
  payload_json: productBackInStockExtended,
  dedupe_key: 'back-in-stock:9012345678902:6789012345682:2024-01-15T09:00:00Z',
  source: EventSource.WEBHOOK,
};

// ============================================================================
// VELOCITY SPIKE EVENTS
// ============================================================================

export const velocitySpikeModerate: VelocitySpikePayload = {
  product_id: '1234567890123',
  variant_id: '3456789012345',
  product_title: 'Classic White Sneakers',
  variant_title: 'Size 9',
  baseline_units_per_day: 4.2,
  current_units_per_day: 8.5,
  spike_multiplier: 2.02,
  window_days: 7,
  units_sold_in_window: 59,
  current_inventory: 12,
  estimated_days_to_stockout: 1.4,
};

export const velocitySpikeHigh: VelocitySpikePayload = {
  product_id: '2345678901234',
  variant_id: '4567890123467',
  product_title: 'Limited Edition Print',
  variant_title: 'A3 Size',
  baseline_units_per_day: 2.8,
  current_units_per_day: 12.0,
  spike_multiplier: 4.29,
  window_days: 3,
  units_sold_in_window: 36,
  current_inventory: 18,
  estimated_days_to_stockout: 1.5,
};

export const velocitySpikeExtreme: VelocitySpikePayload = {
  product_id: '3456789012345',
  variant_id: '5678901234569',
  product_title: 'Viral TikTok Gadget',
  variant_title: 'Standard',
  baseline_units_per_day: 1.5,
  current_units_per_day: 23.0,
  spike_multiplier: 15.33,
  window_days: 2,
  units_sold_in_window: 46,
  current_inventory: 8,
  estimated_days_to_stockout: 0.3,
};

export const velocitySpikeEvent1 = {
  id: 'evt-velocity-spike-1',
  ...baseEvent,
  type: EventType.velocity_spike,
  occurred_at: new Date('2024-01-15T08:00:00Z'),
  payload_json: velocitySpikeModerate,
  dedupe_key: 'velocity-spike:1234567890123:3456789012345:2024-01-15',
  source: EventSource.COMPUTED,
};

export const velocitySpikeEvent2 = {
  id: 'evt-velocity-spike-2',
  ...baseEvent,
  type: EventType.velocity_spike,
  occurred_at: new Date('2024-01-15T09:00:00Z'),
  payload_json: velocitySpikeHigh,
  dedupe_key: 'velocity-spike:2345678901234:4567890123467:2024-01-15',
  source: EventSource.COMPUTED,
};

export const velocitySpikeEvent3 = {
  id: 'evt-velocity-spike-3',
  ...baseEvent,
  type: EventType.velocity_spike,
  occurred_at: new Date('2024-01-15T10:00:00Z'),
  payload_json: velocitySpikeExtreme,
  dedupe_key: 'velocity-spike:3456789012345:5678901234569:2024-01-15',
  source: EventSource.COMPUTED,
};

// ============================================================================
// CUSTOMER INACTIVITY THRESHOLD EVENTS
// ============================================================================

export const customerInactive30Days: CustomerInactivityThresholdPayload = {
  customer_id: '1111111111111',
  customer_email: 'alice@example.com',
  customer_name: 'Alice Johnson',
  days_inactive: 30,
  threshold: 30,
  last_order_at: '2023-12-16T10:00:00Z',
  total_lifetime_orders: 1,
  total_lifetime_value: 45.99,
  average_order_value: 45.99,
  preferred_product_categories: ['Accessories'],
};

export const customerInactive60Days: CustomerInactivityThresholdPayload = {
  customer_id: '2222222222222',
  customer_email: 'bob@example.com',
  customer_name: 'Bob Smith',
  days_inactive: 60,
  threshold: 60,
  last_order_at: '2023-11-16T14:30:00Z',
  total_lifetime_orders: 3,
  total_lifetime_value: 187.45,
  average_order_value: 62.48,
  preferred_product_categories: ['Apparel', 'Footwear'],
};

export const customerInactive90DaysHighValue: CustomerInactivityThresholdPayload = {
  customer_id: '3333333333333',
  customer_email: 'carol@example.com',
  customer_name: 'Carol Williams',
  days_inactive: 90,
  threshold: 90,
  last_order_at: '2023-10-17T09:15:00Z',
  total_lifetime_orders: 8,
  total_lifetime_value: 892.34,
  average_order_value: 111.54,
  preferred_product_categories: ['Premium Goods', 'Electronics', 'Home & Garden'],
};

export const customerInactive90DaysMediumValue: CustomerInactivityThresholdPayload = {
  customer_id: '4444444444444',
  customer_email: 'david@example.com',
  customer_name: 'David Brown',
  days_inactive: 90,
  threshold: 90,
  last_order_at: '2023-10-17T11:45:00Z',
  total_lifetime_orders: 5,
  total_lifetime_value: 324.80,
  average_order_value: 64.96,
  preferred_product_categories: ['Apparel', 'Accessories'],
};

export const customerInactiveEvent1 = {
  id: 'evt-cust-inactive-1',
  ...baseEvent,
  type: EventType.customer_inactivity_threshold,
  occurred_at: new Date('2024-01-15T00:00:00Z'),
  payload_json: customerInactive90DaysHighValue,
  dedupe_key: 'customer-inactive:3333333333333:90:2024-01-15',
  source: EventSource.COMPUTED,
};

export const customerInactiveEvent2 = {
  id: 'evt-cust-inactive-2',
  ...baseEvent,
  type: EventType.customer_inactivity_threshold,
  occurred_at: new Date('2024-01-15T00:00:00Z'),
  payload_json: customerInactive90DaysMediumValue,
  dedupe_key: 'customer-inactive:4444444444444:90:2024-01-15',
  source: EventSource.COMPUTED,
};

export const customerInactiveEvent3 = {
  id: 'evt-cust-inactive-3',
  ...baseEvent,
  type: EventType.customer_inactivity_threshold,
  occurred_at: new Date('2024-01-15T00:00:00Z'),
  payload_json: customerInactive60Days,
  dedupe_key: 'customer-inactive:2222222222222:60:2024-01-15',
  source: EventSource.COMPUTED,
};

export const customerInactiveEvent4 = {
  id: 'evt-cust-inactive-4',
  ...baseEvent,
  type: EventType.customer_inactivity_threshold,
  occurred_at: new Date('2024-01-15T00:00:00Z'),
  payload_json: customerInactive30Days,
  dedupe_key: 'customer-inactive:1111111111111:30:2024-01-15',
  source: EventSource.COMPUTED,
};

// ============================================================================
// EVENTS BY TYPE
// ============================================================================

export const eventsByType = {
  [EventType.inventory_threshold_crossed]: [
    inventoryThresholdEvent1,
    inventoryThresholdEvent2,
  ],
  [EventType.product_out_of_stock]: [
    productOutOfStockEvent1,
    productOutOfStockEvent2,
  ],
  [EventType.product_back_in_stock]: [
    productBackInStockEvent1,
    productBackInStockEvent2,
  ],
  [EventType.velocity_spike]: [
    velocitySpikeEvent1,
    velocitySpikeEvent2,
    velocitySpikeEvent3,
  ],
  [EventType.customer_inactivity_threshold]: [
    customerInactiveEvent1,
    customerInactiveEvent2,
    customerInactiveEvent3,
    customerInactiveEvent4,
  ],
};

// ============================================================================
// EVENTS BY SOURCE
// ============================================================================

export const eventsBySource = {
  [EventSource.WEBHOOK]: [
    productOutOfStockEvent1,
    productBackInStockEvent1,
    productBackInStockEvent2,
  ],
  [EventSource.SCHEDULED_JOB]: [
    productOutOfStockEvent2,
  ],
  [EventSource.COMPUTED]: [
    inventoryThresholdEvent1,
    inventoryThresholdEvent2,
    velocitySpikeEvent1,
    velocitySpikeEvent2,
    velocitySpikeEvent3,
    customerInactiveEvent1,
    customerInactiveEvent2,
    customerInactiveEvent3,
    customerInactiveEvent4,
  ],
};

// ============================================================================
// ALL EVENTS
// ============================================================================

export const allEvents = [
  inventoryThresholdEvent1,
  inventoryThresholdEvent2,
  productOutOfStockEvent1,
  productOutOfStockEvent2,
  productBackInStockEvent1,
  productBackInStockEvent2,
  velocitySpikeEvent1,
  velocitySpikeEvent2,
  velocitySpikeEvent3,
  customerInactiveEvent1,
  customerInactiveEvent2,
  customerInactiveEvent3,
  customerInactiveEvent4,
];

// ============================================================================
// DEDUPE KEY HELPERS
// ============================================================================

/**
 * Generate dedupe key for inventory threshold event
 */
export function generateInventoryThresholdDedupeKey(
  productId: string,
  variantId: string,
  date: Date
): string {
  const dateStr = date.toISOString().split('T')[0];
  return `inv-threshold:${productId}:${variantId}:${dateStr}`;
}

/**
 * Generate dedupe key for out of stock event
 */
export function generateOutOfStockDedupeKey(
  productId: string,
  variantId: string,
  date: Date
): string {
  const dateStr = date.toISOString().split('T')[0];
  return `out-of-stock:${productId}:${variantId}:${dateStr}`;
}

/**
 * Generate dedupe key for back in stock event
 */
export function generateBackInStockDedupeKey(
  productId: string,
  variantId: string,
  restockedAt: Date
): string {
  return `back-in-stock:${productId}:${variantId}:${restockedAt.toISOString()}`;
}

/**
 * Generate dedupe key for velocity spike event
 */
export function generateVelocitySpikeDedupeKey(
  productId: string,
  variantId: string,
  date: Date
): string {
  const dateStr = date.toISOString().split('T')[0];
  return `velocity-spike:${productId}:${variantId}:${dateStr}`;
}

/**
 * Generate dedupe key for customer inactivity event
 */
export function generateCustomerInactivityDedupeKey(
  customerId: string,
  threshold: number,
  date: Date
): string {
  const dateStr = date.toISOString().split('T')[0];
  return `customer-inactive:${customerId}:${threshold}:${dateStr}`;
}
