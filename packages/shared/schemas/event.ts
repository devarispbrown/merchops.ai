/**
 * Event Schemas
 *
 * Zod validation schemas for immutable event store
 */

import { z } from 'zod';

// Enum schemas
export const eventTypeSchema = z.enum([
  'inventory_threshold_crossed',
  'product_out_of_stock',
  'product_back_in_stock',
  'velocity_spike',
  'customer_inactivity_threshold',
  'order_created',
  'order_paid',
  'product_created',
  'product_updated',
]);

export const eventSourceSchema = z.enum([
  'webhook',
  'scheduled_job',
  'api_sync',
  'computed',
  'manual',
]);

// Base event schema
export const eventSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  type: eventTypeSchema,
  occurred_at: z.date(),
  payload_json: z.record(z.unknown()),
  dedupe_key: z.string().min(1, 'Dedupe key is required'),
  source: eventSourceSchema,
  created_at: z.date(),
});

// Payload schemas for specific event types
export const inventoryThresholdPayloadSchema = z.object({
  product_id: z.string(),
  product_title: z.string(),
  variant_id: z.string().optional(),
  variant_title: z.string().optional(),
  current_quantity: z.number().int(),
  threshold: z.number().int(),
  previous_quantity: z.number().int().optional(),
});

export const productOutOfStockPayloadSchema = z.object({
  product_id: z.string(),
  product_title: z.string(),
  variant_id: z.string().optional(),
  variant_title: z.string().optional(),
  last_sold_at: z.string().datetime().optional(),
});

export const productBackInStockPayloadSchema = z.object({
  product_id: z.string(),
  product_title: z.string(),
  variant_id: z.string().optional(),
  variant_title: z.string().optional(),
  new_quantity: z.number().int(),
  out_of_stock_duration_hours: z.number().optional(),
});

export const velocitySpikePayloadSchema = z.object({
  product_id: z.string(),
  product_title: z.string(),
  recent_sales_count: z.number().int(),
  baseline_sales_count: z.number().int(),
  spike_multiplier: z.number(),
  window_hours: z.number().int(),
});

export const customerInactivityPayloadSchema = z.object({
  customer_id: z.string(),
  customer_email: z.string().email(),
  customer_name: z.string().optional(),
  last_order_date: z.string().datetime(),
  days_inactive: z.number().int(),
  total_orders: z.number().int(),
  total_spent: z.number(),
  cohort: z.enum(['30_day', '60_day', '90_day']),
});

// Schema for creating events
export const createEventSchema = z.object({
  workspace_id: z.string().uuid(),
  type: eventTypeSchema,
  occurred_at: z.date(),
  payload_json: z.record(z.unknown()),
  dedupe_key: z.string().min(1, 'Dedupe key is required'),
  source: eventSourceSchema,
});

// Schema for querying events
export const queryEventsSchema = z.object({
  workspace_id: z.string().uuid(),
  type: eventTypeSchema.optional(),
  source: eventSourceSchema.optional(),
  from_date: z.date().optional(),
  to_date: z.date().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

// Schema for event deduplication check
export const checkEventDedupeSchema = z.object({
  workspace_id: z.string().uuid(),
  dedupe_key: z.string().min(1),
});

// Types
export type Event = z.infer<typeof eventSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type EventSource = z.infer<typeof eventSourceSchema>;
export type InventoryThresholdPayload = z.infer<typeof inventoryThresholdPayloadSchema>;
export type ProductOutOfStockPayload = z.infer<typeof productOutOfStockPayloadSchema>;
export type ProductBackInStockPayload = z.infer<typeof productBackInStockPayloadSchema>;
export type VelocitySpikePayload = z.infer<typeof velocitySpikePayloadSchema>;
export type CustomerInactivityPayload = z.infer<typeof customerInactivityPayloadSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type QueryEventsInput = z.infer<typeof queryEventsSchema>;
export type CheckEventDedupeInput = z.infer<typeof checkEventDedupeSchema>;
