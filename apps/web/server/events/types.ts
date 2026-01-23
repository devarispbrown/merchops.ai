/**
 * Event Types and Payloads
 *
 * Defines all event types and their payload structures for the MerchOps event system.
 * Events are immutable and represent meaningful state changes in the store.
 */

import { EventType, EventSource } from '@prisma/client';

export { EventType, EventSource };

// ============================================================================
// EVENT PAYLOAD INTERFACES
// ============================================================================

/**
 * Inventory threshold crossed event
 * Triggered when inventory crosses a configured threshold (e.g., below 10 units)
 */
export interface InventoryThresholdCrossedPayload {
  product_id: string;
  variant_id: string;
  product_title: string;
  variant_title: string;
  current_inventory: number;
  threshold: number;
  previous_inventory: number;
  location_id?: string;
}

/**
 * Product out of stock event
 * Triggered when a product variant reaches zero inventory
 */
export interface ProductOutOfStockPayload {
  product_id: string;
  variant_id: string;
  product_title: string;
  variant_title: string;
  last_sale_at?: string; // ISO timestamp
  days_in_stock: number;
  location_id?: string;
}

/**
 * Product back in stock event
 * Triggered when a previously out-of-stock product is restocked
 */
export interface ProductBackInStockPayload {
  product_id: string;
  variant_id: string;
  product_title: string;
  variant_title: string;
  new_inventory: number;
  out_of_stock_duration_days: number;
  restocked_at: string; // ISO timestamp
  location_id?: string;
}

/**
 * Velocity spike event
 * Triggered when product sales velocity exceeds historical baseline
 */
export interface VelocitySpikePayload {
  product_id: string;
  variant_id?: string;
  product_title: string;
  variant_title?: string;
  baseline_units_per_day: number;
  current_units_per_day: number;
  spike_multiplier: number; // e.g., 3.5x baseline
  window_days: number; // e.g., 7 days
  units_sold_in_window: number;
  current_inventory?: number;
  estimated_days_to_stockout?: number;
}

/**
 * Customer inactivity threshold crossed event
 * Triggered when a customer crosses an inactivity threshold (30/60/90 days)
 */
export interface CustomerInactivityThresholdPayload {
  customer_id: string;
  customer_email: string;
  customer_name?: string;
  days_inactive: number;
  threshold: number; // 30, 60, or 90
  last_order_at: string; // ISO timestamp
  total_lifetime_orders: number;
  total_lifetime_value: number;
  average_order_value: number;
  preferred_product_categories?: string[];
}

// ============================================================================
// EVENT PAYLOAD UNION TYPE
// ============================================================================

export type EventPayload =
  | InventoryThresholdCrossedPayload
  | ProductOutOfStockPayload
  | ProductBackInStockPayload
  | VelocitySpikePayload
  | CustomerInactivityThresholdPayload;

// ============================================================================
// EVENT CREATION INPUT
// ============================================================================

export interface CreateEventInput {
  workspace_id: string;
  type: EventType;
  occurred_at: Date;
  payload: EventPayload;
  source: EventSource;
  dedupe_key?: string; // If not provided, will be auto-generated
}

// ============================================================================
// EVENT TYPE GUARDS
// ============================================================================

export function isInventoryThresholdCrossedPayload(
  payload: EventPayload
): payload is InventoryThresholdCrossedPayload {
  return 'threshold' in payload && 'current_inventory' in payload;
}

export function isProductOutOfStockPayload(
  payload: EventPayload
): payload is ProductOutOfStockPayload {
  return 'days_in_stock' in payload && !('new_inventory' in payload);
}

export function isProductBackInStockPayload(
  payload: EventPayload
): payload is ProductBackInStockPayload {
  return 'new_inventory' in payload && 'out_of_stock_duration_days' in payload;
}

export function isVelocitySpikePayload(
  payload: EventPayload
): payload is VelocitySpikePayload {
  return 'baseline_units_per_day' in payload && 'spike_multiplier' in payload;
}

export function isCustomerInactivityThresholdPayload(
  payload: EventPayload
): payload is CustomerInactivityThresholdPayload {
  return 'days_inactive' in payload && 'customer_id' in payload;
}
