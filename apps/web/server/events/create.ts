/**
 * Event Creation
 *
 * Handles creation of immutable events with deduplication.
 * Events are never updated or deleted, ensuring complete audit trail.
 */

import { prisma } from '../db/client';
import { Event } from '@prisma/client';
import crypto from 'crypto';
import {
  CreateEventInput,
  EventType,
  EventPayload,
} from './types';

// ============================================================================
// DEDUPE KEY GENERATION
// ============================================================================

/**
 * Generates a deterministic dedupe key for an event
 * Same inputs always produce same key to prevent duplicate events
 */
export function generateDedupeKey(
  workspace_id: string,
  type: EventType,
  payload: EventPayload,
  occurred_at: Date
): string {
  // Create a stable string representation of the payload
  // Sort keys to ensure consistent ordering
  const sortedPayload = JSON.stringify(payload, Object.keys(payload).sort());

  // Include date at day precision for most events
  // This allows one event per day per condition
  const datePart = occurred_at.toISOString().split('T')[0];

  // Combine all components
  const components = [workspace_id, type, sortedPayload, datePart];

  // Hash to create a shorter, consistent key
  const hash = crypto
    .createHash('sha256')
    .update(components.join('::'))
    .digest('hex');

  return `${type}::${datePart}::${hash.substring(0, 16)}`;
}

/**
 * Generates a dedupe key for inventory threshold events
 * Includes product and variant IDs for per-product deduplication
 */
function generateInventoryDedupeKey(
  workspace_id: string,
  payload: any,
  occurred_at: Date
): string {
  const datePart = occurred_at.toISOString().split('T')[0];
  const productKey = `${payload.product_id}::${payload.variant_id}::${payload.threshold}`;

  return `inventory_threshold::${workspace_id}::${productKey}::${datePart}`;
}

/**
 * Generates a dedupe key for velocity spike events
 * Includes product ID and spike window
 */
function generateVelocityDedupeKey(
  workspace_id: string,
  payload: any,
  occurred_at: Date
): string {
  const datePart = occurred_at.toISOString().split('T')[0];
  const productKey = `${payload.product_id}::${payload.window_days}`;

  return `velocity_spike::${workspace_id}::${productKey}::${datePart}`;
}

/**
 * Generates a dedupe key for customer inactivity events
 * Includes customer ID and threshold to prevent duplicate notifications
 */
function generateCustomerInactivityDedupeKey(
  workspace_id: string,
  payload: any,
  occurred_at: Date
): string {
  const datePart = occurred_at.toISOString().split('T')[0];
  const customerKey = `${payload.customer_id}::${payload.threshold}`;

  return `customer_inactivity::${workspace_id}::${customerKey}::${datePart}`;
}

/**
 * Generates a type-specific dedupe key
 * Each event type may have different deduplication requirements
 */
export function generateSpecificDedupeKey(
  workspace_id: string,
  type: EventType,
  payload: EventPayload,
  occurred_at: Date
): string {
  switch (type) {
    case 'inventory_threshold_crossed':
    case 'product_out_of_stock':
    case 'product_back_in_stock':
      return generateInventoryDedupeKey(workspace_id, payload, occurred_at);

    case 'velocity_spike':
      return generateVelocityDedupeKey(workspace_id, payload, occurred_at);

    case 'customer_inactivity_threshold':
      return generateCustomerInactivityDedupeKey(
        workspace_id,
        payload,
        occurred_at
      );

    default:
      return generateDedupeKey(workspace_id, type, payload, occurred_at);
  }
}

// ============================================================================
// EVENT CREATION
// ============================================================================

/**
 * Creates an event with automatic deduplication
 *
 * @param input - Event creation input
 * @returns Created event or null if duplicate
 */
export async function createEvent(
  input: CreateEventInput
): Promise<Event | null> {
  const { workspace_id, type, occurred_at, payload, source, dedupe_key } =
    input;

  // TODO: Billing integration - uncomment when billing module is complete
  // import { checkLimit, incrementUsage } from '@/server/billing';
  // await checkLimit(workspace_id, 'events');

  // Generate dedupe key if not provided
  const finalDedupeKey =
    dedupe_key ||
    generateSpecificDedupeKey(workspace_id, type, payload, occurred_at);

  try {
    // Attempt to create the event
    // Unique constraint on (workspace_id, dedupe_key) prevents duplicates
    const event = await prisma.event.create({
      data: {
        workspace_id,
        type,
        occurred_at,
        payload_json: payload as any,
        dedupe_key: finalDedupeKey,
        source,
      },
    });

    // TODO: Billing integration - uncomment when billing module is complete
    // await incrementUsage(workspace_id, 'events');

    return event;
  } catch (error: any) {
    // Check if error is due to unique constraint violation
    if (
      error.code === 'P2002' &&
      error.meta?.target?.includes('dedupe_key')
    ) {
      // Event already exists, return null (not an error)
      return null;
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Creates multiple events in a batch
 * Returns array of created events (excluding duplicates)
 */
export async function createEventsBatch(
  inputs: CreateEventInput[]
): Promise<Event[]> {
  const results = await Promise.allSettled(inputs.map(createEvent));

  return results
    .filter(
      (result): result is PromiseFulfilledResult<Event | null> =>
        result.status === 'fulfilled'
    )
    .map((result) => result.value)
    .filter((event): event is Event => event !== null);
}

/**
 * Checks if an event with the given dedupe key exists
 */
export async function eventExists(
  workspace_id: string,
  dedupe_key: string
): Promise<boolean> {
  const count = await prisma.event.count({
    where: {
      workspace_id,
      dedupe_key,
    },
  });

  return count > 0;
}
