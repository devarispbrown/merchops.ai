/**
 * Inventory Event Computation
 *
 * Computes inventory-related events by analysing Shopify inventory level data
 * stored in ShopifyObjectCache:
 *
 *   inventory_threshold_crossed — available qty is below a configured threshold
 *   product_out_of_stock        — available qty is exactly zero
 *   product_back_in_stock       — available qty > 0 AND a prior
 *                                  product_out_of_stock exists without a
 *                                  corresponding product_back_in_stock
 *
 * All three functions are idempotent.  Deduplication is enforced at two
 * layers: an explicit pre-flight check against the event store, and the
 * database unique constraint on (workspace_id, dedupe_key).
 */

import { prisma } from '../../db/client';
import { createEvent } from '../create';
import {
  InventoryThresholdCrossedPayload,
  ProductOutOfStockPayload,
  ProductBackInStockPayload,
} from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default available-quantity threshold below which an alert fires.
 * Passed as an optional argument so callers can override per workspace.
 */
const DEFAULT_INVENTORY_THRESHOLD = 10;

// ============================================================================
// INTERNAL DATA TYPES
// ============================================================================

interface NormalisedInventoryLevel {
  /** String form of Shopify inventory_item_id */
  inventory_item_id: string;
  /** String form of Shopify location_id */
  location_id: string;
  /** Current available quantity (may be ≤ 0) */
  available: number;
}

interface ResolvedProductMeta {
  product_id: string;
  product_title: string;
  variant_id: string;
  variant_title: string;
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Loads and normalises all inventory_level records for a workspace.
 * Records without both inventory_item_id and location_id are silently skipped.
 */
async function loadInventoryLevels(
  workspace_id: string
): Promise<NormalisedInventoryLevel[]> {
  const records = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'inventory_level',
    },
  });

  const levels: NormalisedInventoryLevel[] = [];

  for (const record of records) {
    const data = record.data_json as any;

    if (data.inventory_item_id == null || data.location_id == null) {
      continue;
    }

    const available =
      typeof data.available === 'number'
        ? data.available
        : parseInt(String(data.available ?? '0'), 10);

    levels.push({
      inventory_item_id: String(data.inventory_item_id),
      location_id: String(data.location_id),
      available,
    });
  }

  return levels;
}

/**
 * Resolves human-readable product/variant titles for a given Shopify
 * inventory_item_id by scanning the product cache.
 *
 * Shopify inventory_level objects only carry inventory_item_id.  Each product
 * variant carries a matching inventory_item_id field, so we scan variants
 * across all cached products to find the right one.
 *
 * Returns safe fallback strings when no match is found so event creation is
 * never blocked on missing metadata.
 */
async function resolveProductMeta(
  workspace_id: string,
  inventory_item_id: string
): Promise<ResolvedProductMeta> {
  const products = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'product',
    },
  });

  for (const record of products) {
    const productData = record.data_json as any;
    const variants: any[] = productData.variants ?? [];

    for (const variant of variants) {
      if (String(variant.inventory_item_id ?? '') === inventory_item_id) {
        return {
          product_id: String(productData.id ?? inventory_item_id),
          product_title: String(productData.title ?? 'Unknown Product'),
          variant_id: String(variant.id ?? inventory_item_id),
          variant_title: String(variant.title ?? 'Default Title'),
        };
      }
    }
  }

  // Fallback when no product/variant match found
  return {
    product_id: inventory_item_id,
    product_title: 'Unknown Product',
    variant_id: inventory_item_id,
    variant_title: 'Default Title',
  };
}

/**
 * Returns true when an event with the given dedupe_key already exists in the
 * workspace.  Used as a fast pre-flight check to avoid unnecessary work before
 * hitting the DB unique constraint.
 */
async function eventWithDedupeKeyExists(
  workspace_id: string,
  dedupe_key: string
): Promise<boolean> {
  const count = await prisma.event.count({
    where: { workspace_id, dedupe_key },
  });
  return count > 0;
}

/**
 * Returns the calendar-date bucket (YYYY-MM-DD) for a date.
 * Back-in-stock events embed this in their dedupe_key so that the same
 * item/location pair can re-fire on a new day if a fresh out-of-stock cycle
 * occurs.
 */
function calendarDayBucket(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// COMPUTE: INVENTORY THRESHOLD CROSSED
// ============================================================================

/**
 * Fires an `inventory_threshold_crossed` event for each inventory level where
 * `available` is strictly between 0 (exclusive) and `threshold` (exclusive).
 *
 * Zero-stock items are intentionally excluded — they are handled by
 * `computeOutOfStockEvents`.
 *
 * Dedupe key: `inventory_threshold:{inventory_item_id}:{location_id}:{threshold}`
 *
 * This key does NOT include a date, so the event fires at most once per
 * (item, location, threshold) combination.  A new event will only be emitted
 * after the item restocks above the threshold and then drops again — at which
 * point a different combination (e.g. a different day's run) would create a
 * new event only if the threshold-level key were intentionally cleared or if a
 * future design includes a date rotation.
 *
 * @param workspace_id  Workspace to process
 * @param threshold     Low-stock alert threshold (default: 10)
 */
export async function computeInventoryThresholdEvents(
  workspace_id: string,
  threshold: number = DEFAULT_INVENTORY_THRESHOLD
): Promise<void> {
  const levels = await loadInventoryLevels(workspace_id);

  for (const level of levels) {
    // Must be below threshold but not at zero (zero = out-of-stock)
    if (level.available <= 0 || level.available >= threshold) {
      continue;
    }

    const dedupe_key = `inventory_threshold:${level.inventory_item_id}:${level.location_id}:${threshold}`;

    if (await eventWithDedupeKeyExists(workspace_id, dedupe_key)) {
      continue;
    }

    const meta = await resolveProductMeta(
      workspace_id,
      level.inventory_item_id
    );

    const payload: InventoryThresholdCrossedPayload = {
      product_id: meta.product_id,
      variant_id: meta.variant_id,
      product_title: meta.product_title,
      variant_title: meta.variant_title,
      current_inventory: level.available,
      threshold,
      // We do not store previous values in the cache; use threshold as a
      // conservative "was above threshold" sentinel.
      previous_inventory: threshold,
      location_id: level.location_id,
    };

    await createEvent({
      workspace_id,
      type: 'inventory_threshold_crossed',
      occurred_at: new Date(),
      payload,
      source: 'computed',
      dedupe_key,
    });
  }
}

// ============================================================================
// COMPUTE: OUT OF STOCK
// ============================================================================

/**
 * Fires a `product_out_of_stock` event for each inventory level where
 * `available` = 0 and no prior out-of-stock event exists for that
 * (inventory_item_id, location_id) pair.
 *
 * Dedupe key: `out_of_stock:{inventory_item_id}:{location_id}`
 *
 * The lack of a date component means one out-of-stock event is emitted per
 * stockout episode.  The back-in-stock logic uses the presence of this key to
 * detect that a restock has happened.
 */
export async function computeOutOfStockEvents(
  workspace_id: string
): Promise<void> {
  const levels = await loadInventoryLevels(workspace_id);

  for (const level of levels) {
    if (level.available !== 0) {
      continue;
    }

    const dedupe_key = `out_of_stock:${level.inventory_item_id}:${level.location_id}`;

    if (await eventWithDedupeKeyExists(workspace_id, dedupe_key)) {
      continue;
    }

    const meta = await resolveProductMeta(
      workspace_id,
      level.inventory_item_id
    );

    const payload: ProductOutOfStockPayload = {
      product_id: meta.product_id,
      variant_id: meta.variant_id,
      product_title: meta.product_title,
      variant_title: meta.variant_title,
      days_in_stock: 0, // Requires full inventory history; 0 is the safe default
      location_id: level.location_id,
    };

    await createEvent({
      workspace_id,
      type: 'product_out_of_stock',
      occurred_at: new Date(),
      payload,
      source: 'computed',
      dedupe_key,
    });
  }
}

// ============================================================================
// COMPUTE: BACK IN STOCK
// ============================================================================

/**
 * Fires a `product_back_in_stock` event for each inventory level where:
 *   1. `available` > 0  (currently has stock), AND
 *   2. A `product_out_of_stock` event exists with dedupe_key
 *      `out_of_stock:{inventory_item_id}:{location_id}` (was out of stock), AND
 *   3. No `product_back_in_stock` event already exists for today's date bucket.
 *
 * Dedupe key: `back_in_stock:{inventory_item_id}:{location_id}:{YYYY-MM-DD}`
 *
 * Including the calendar date in the key allows the event to re-fire on a
 * different day if the product goes out of stock and comes back in again (a
 * fresh cycle).  A second restock on the same calendar day is silently
 * deduplicated.
 */
export async function computeBackInStockEvents(
  workspace_id: string
): Promise<void> {
  const levels = await loadInventoryLevels(workspace_id);
  const now = new Date();
  const todayBucket = calendarDayBucket(now);

  for (const level of levels) {
    // Only consider items that currently have positive stock
    if (level.available <= 0) {
      continue;
    }

    // Determine whether this item/location ever went out of stock.
    // We use the exact dedupe_key that computeOutOfStockEvents would have
    // written, so the check is always consistent.
    const outOfStockDedupeKey = `out_of_stock:${level.inventory_item_id}:${level.location_id}`;
    const priorOutOfStock = await eventWithDedupeKeyExists(
      workspace_id,
      outOfStockDedupeKey
    );

    if (!priorOutOfStock) {
      // This item has never been seen as out-of-stock in the event store;
      // there is no restock to announce.
      continue;
    }

    // Date-bucketed key: allows the cycle to repeat on a new calendar day.
    const dedupe_key = `back_in_stock:${level.inventory_item_id}:${level.location_id}:${todayBucket}`;

    if (await eventWithDedupeKeyExists(workspace_id, dedupe_key)) {
      continue;
    }

    // Calculate how many days the item was out of stock by finding the most
    // recent out-of-stock event for this exact (item, location) pair.
    const outOfStockEvent = await prisma.event.findFirst({
      where: {
        workspace_id,
        type: 'product_out_of_stock',
        dedupe_key: outOfStockDedupeKey,
      },
      orderBy: { occurred_at: 'desc' },
    });

    const outOfStockDurationDays = outOfStockEvent
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() - outOfStockEvent.occurred_at.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : 0;

    const meta = await resolveProductMeta(
      workspace_id,
      level.inventory_item_id
    );

    const payload: ProductBackInStockPayload = {
      product_id: meta.product_id,
      variant_id: meta.variant_id,
      product_title: meta.product_title,
      variant_title: meta.variant_title,
      new_inventory: level.available,
      out_of_stock_duration_days: outOfStockDurationDays,
      restocked_at: now.toISOString(),
      location_id: level.location_id,
    };

    await createEvent({
      workspace_id,
      type: 'product_back_in_stock',
      occurred_at: now,
      payload,
      source: 'computed',
      dedupe_key,
    });
  }
}
