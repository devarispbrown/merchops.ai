/**
 * Event types for MerchOps
 *
 * Events are immutable, deduped, and form the foundation of opportunity detection.
 * All events are server-computed from Shopify data and webhooks.
 */

/**
 * Event type enumeration
 * Defines all supported event types in MVP
 *
 * NOTE: These values must match the EventType enum in prisma/schema.prisma
 */
export enum EventType {
  /** Product inventory crossed below threshold */
  INVENTORY_THRESHOLD_CROSSED = 'inventory_threshold_crossed',

  /** Product completely out of stock */
  PRODUCT_OUT_OF_STOCK = 'product_out_of_stock',

  /** Product back in stock after being out */
  PRODUCT_BACK_IN_STOCK = 'product_back_in_stock',

  /** Product sales velocity spiked above baseline */
  VELOCITY_SPIKE = 'velocity_spike',

  /** Customer inactivity threshold crossed (30/60/90 days) */
  CUSTOMER_INACTIVITY_THRESHOLD = 'customer_inactivity_threshold',

  /** Order placed */
  ORDER_CREATED = 'order_created',

  /** Order paid */
  ORDER_PAID = 'order_paid',

  /** Product created in Shopify */
  PRODUCT_CREATED = 'product_created',

  /** Product updated in Shopify */
  PRODUCT_UPDATED = 'product_updated',
}

/**
 * Event source enumeration
 * Tracks where the event originated
 *
 * NOTE: These values must match the EventSource enum in prisma/schema.prisma
 */
export enum EventSource {
  /** Computed from webhook data */
  WEBHOOK = 'webhook',

  /** Computed from scheduled job */
  SCHEDULED_JOB = 'scheduled_job',

  /** Computed from API sync */
  API_SYNC = 'api_sync',

  /** Computed by event computation logic */
  COMPUTED = 'computed',

  /** Manually created (debugging/testing) */
  MANUAL = 'manual',
}

/**
 * Inventory threshold crossed event payload
 */
export interface InventoryThresholdCrossedPayload {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  currentInventory: number;
  threshold: number;
  previousInventory: number;
  locationId?: string;
}

/**
 * Product out of stock event payload
 */
export interface ProductOutOfStockPayload {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  lastKnownInventory: number;
  locationId?: string;
}

/**
 * Product back in stock event payload
 */
export interface ProductBackInStockPayload {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  currentInventory: number;
  outOfStockDuration: number; // milliseconds
  locationId?: string;
}

/**
 * Velocity spike event payload
 */
export interface VelocitySpikePayload {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  currentVelocity: number; // units per day
  baselineVelocity: number; // units per day
  spikeMultiplier: number; // e.g., 2.5x
  windowDays: number;
}

/**
 * Customer inactivity threshold crossed event payload
 */
export interface CustomerInactivityThresholdPayload {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  threshold: number; // 30, 60, or 90 days
  totalOrders: number;
  lifetimeValue: string;
}

/**
 * Order created event payload
 */
export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: number;
  customerId: string | null;
  email: string;
  totalPrice: string;
  currency: string;
  lineItemCount: number;
}

/**
 * Order paid event payload
 */
export interface OrderPaidPayload {
  orderId: string;
  orderNumber: number;
  customerId: string | null;
  email: string;
  totalPrice: string;
  currency: string;
}

/**
 * Product created event payload
 */
export interface ProductCreatedPayload {
  productId: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  variantCount: number;
}

/**
 * Product updated event payload
 */
export interface ProductUpdatedPayload {
  productId: string;
  title: string;
  handle: string;
  changedFields: string[]; // e.g., ['status', 'price', 'inventory']
}

/**
 * Union type of all event payloads
 * Used for type-safe payload handling based on event type
 */
export type EventPayload =
  | InventoryThresholdCrossedPayload
  | ProductOutOfStockPayload
  | ProductBackInStockPayload
  | VelocitySpikePayload
  | CustomerInactivityThresholdPayload
  | OrderCreatedPayload
  | OrderPaidPayload
  | ProductCreatedPayload
  | ProductUpdatedPayload;

/**
 * Core event entity
 * Immutable record of a store signal or state change
 */
export interface Event {
  /** Unique event identifier */
  id: string;

  /** Associated workspace ID */
  workspaceId: string;

  /** Event type */
  type: EventType;

  /** When the event actually occurred (not when it was created) */
  occurredAt: Date;

  /**
   * Event payload (type-specific data)
   * Stored as JSON in database
   */
  payload: EventPayload;

  /**
   * Deduplication key
   * Prevents duplicate events for same condition
   * Format: "{type}:{workspace_id}:{resource_id}:{time_window}"
   */
  dedupeKey: string;

  /** Event source/origin */
  source: EventSource;

  /** Event creation timestamp (when ingested) */
  createdAt: Date;

  /**
   * Optional metadata for debugging/auditing
   * e.g., webhook_id, job_id, correlation_id
   */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new event
 */
export interface CreateEventInput {
  /** Workspace ID (required) */
  workspaceId: string;

  /** Event type (required) */
  type: EventType;

  /** When event occurred (defaults to now if not provided) */
  occurredAt?: Date;

  /** Event payload (required) */
  payload: EventPayload;

  /** Deduplication key (required) */
  dedupeKey: string;

  /** Event source (defaults to WEBHOOK) */
  source?: EventSource;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event query filters
 */
export interface EventQueryFilters {
  /** Filter by workspace ID */
  workspaceId: string;

  /** Filter by event types */
  types?: EventType[];

  /** Filter by source */
  source?: EventSource;

  /** Filter events after this timestamp */
  occurredAfter?: Date;

  /** Filter events before this timestamp */
  occurredBefore?: Date;

  /** Pagination: limit */
  limit?: number;

  /** Pagination: offset */
  offset?: number;
}

/**
 * Event with associated opportunities
 * Used when displaying event impact
 */
export interface EventWithOpportunities extends Event {
  /** Opportunities triggered by this event */
  opportunities: Array<{
    id: string;
    type: string;
    priorityBucket: string;
    state: string;
  }>;
}
