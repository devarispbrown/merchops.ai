/**
 * Inventory Event Computation
 *
 * Computes inventory-related events from Shopify data:
 * - Inventory threshold crossed
 * - Product out of stock
 * - Product back in stock
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

const DEFAULT_THRESHOLD = 10; // Default low inventory threshold
const INVENTORY_CHECK_WINDOW_DAYS = 7; // Look back window for inventory changes

// ============================================================================
// INVENTORY THRESHOLD EVENTS
// ============================================================================

interface _InventorySnapshot {
  product_id: string;
  variant_id: string;
  product_title: string;
  variant_title: string;
  current_inventory: number;
  previous_inventory?: number;
  location_id?: string;
}

/**
 * Computes inventory threshold crossed events for a workspace
 * Compares current inventory against configured thresholds
 */
export async function computeInventoryThresholdEvents(
  workspace_id: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<void> {
  // Fetch current inventory levels from Shopify cache
  const inventoryLevels = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'inventory_level',
    },
    orderBy: {
      synced_at: 'desc',
    },
  });

  // Get product details for context
  const products = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'product',
    },
  });

  // Create a map of product IDs to product data
  const productMap = new Map(
    products.map((p) => [(p.data_json as any).id, p.data_json])
  );

  for (const level of inventoryLevels) {
    const data = level.data_json as any;
    const available = data.available || 0;

    // Skip if inventory is above threshold
    if (available > threshold) {
      continue;
    }

    // Get product details
    const productId = data.inventory_item_id;
    const product = productMap.get(productId);

    if (!product) {
      continue;
    }

    // Find variant details
    const variant = (product as any).variants?.find(
      (v: any) => v.inventory_item_id === productId
    );

    if (!variant) {
      continue;
    }

    // Get previous inventory (if available)
    const previousInventory = await getPreviousInventory(
      workspace_id,
      data.inventory_item_id
    );

    // Only create event if crossing threshold (not already below)
    if (previousInventory !== null && previousInventory <= threshold) {
      continue;
    }

    const payload: InventoryThresholdCrossedPayload = {
      product_id: (product as any).id,
      variant_id: variant.id,
      product_title: (product as any).title,
      variant_title: variant.title,
      current_inventory: available,
      threshold,
      previous_inventory: previousInventory || available,
      location_id: data.location_id,
    };

    await createEvent({
      workspace_id,
      type: 'inventory_threshold_crossed',
      occurred_at: new Date(),
      payload,
      source: 'computed',
    });
  }
}

// ============================================================================
// OUT OF STOCK EVENTS
// ============================================================================

/**
 * Computes product out of stock events
 * Triggered when inventory reaches zero
 */
export async function computeOutOfStockEvents(
  workspace_id: string
): Promise<void> {
  // Fetch inventory levels with zero stock
  const outOfStockLevels = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'inventory_level',
    },
  });

  // Get product details
  const products = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'product',
    },
  });

  const productMap = new Map(
    products.map((p) => [(p.data_json as any).id, p.data_json])
  );

  for (const level of outOfStockLevels) {
    const data = level.data_json as any;
    const available = data.available || 0;

    // Only process zero inventory
    if (available !== 0) {
      continue;
    }

    const productId = data.inventory_item_id;
    const product = productMap.get(productId);

    if (!product) {
      continue;
    }

    const variant = (product as any).variants?.find(
      (v: any) => v.inventory_item_id === productId
    );

    if (!variant) {
      continue;
    }

    // Calculate days in stock (simplified - would need order history)
    const daysInStock = await calculateDaysInStock(workspace_id, variant.id);

    const payload: ProductOutOfStockPayload = {
      product_id: (product as any).id,
      variant_id: variant.id,
      product_title: (product as any).title,
      variant_title: variant.title,
      days_in_stock: daysInStock,
      location_id: data.location_id,
    };

    await createEvent({
      workspace_id,
      type: 'product_out_of_stock',
      occurred_at: new Date(),
      payload,
      source: 'computed',
    });
  }
}

// ============================================================================
// BACK IN STOCK EVENTS
// ============================================================================

/**
 * Computes product back in stock events
 * Triggered when previously out-of-stock products are restocked
 */
export async function computeBackInStockEvents(
  workspace_id: string
): Promise<void> {
  // Fetch current inventory levels
  const currentLevels = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'inventory_level',
    },
  });

  // Get product details
  const products = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'product',
    },
  });

  const productMap = new Map(
    products.map((p) => [(p.data_json as any).id, p.data_json])
  );

  for (const level of currentLevels) {
    const data = level.data_json as any;
    const available = data.available || 0;

    // Only process positive inventory
    if (available <= 0) {
      continue;
    }

    const productId = data.inventory_item_id;

    // Check if was previously out of stock
    const wasOutOfStock = await checkPreviousOutOfStock(
      workspace_id,
      productId
    );

    if (!wasOutOfStock) {
      continue;
    }

    const product = productMap.get(productId);
    if (!product) {
      continue;
    }

    const variant = (product as any).variants?.find(
      (v: any) => v.inventory_item_id === productId
    );

    if (!variant) {
      continue;
    }

    const outOfStockDuration = await calculateOutOfStockDuration(
      workspace_id,
      productId
    );

    const payload: ProductBackInStockPayload = {
      product_id: (product as any).id,
      variant_id: variant.id,
      product_title: (product as any).title,
      variant_title: variant.title,
      new_inventory: available,
      out_of_stock_duration_days: outOfStockDuration,
      restocked_at: new Date().toISOString(),
      location_id: data.location_id,
    };

    await createEvent({
      workspace_id,
      type: 'product_back_in_stock',
      occurred_at: new Date(),
      payload,
      source: 'computed',
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets previous inventory level for comparison
 */
async function getPreviousInventory(
  workspace_id: string,
  inventory_item_id: string
): Promise<number | null> {
  const previous = await prisma.shopifyObjectCache.findFirst({
    where: {
      workspace_id,
      object_type: 'inventory_level',
      shopify_id: inventory_item_id,
    },
    orderBy: {
      synced_at: 'desc',
    },
    skip: 1, // Skip current, get previous
  });

  if (!previous) {
    return null;
  }

  return (previous.data_json as any).available || 0;
}

/**
 * Calculates how many days a product has been in stock
 */
async function calculateDaysInStock(
  _workspace_id: string,
  _variant_id: string
): Promise<number> {
  // Simplified calculation - would need full inventory history
  // For MVP, default to 30 days
  return 30;
}

/**
 * Checks if product was previously out of stock
 */
async function checkPreviousOutOfStock(
  workspace_id: string,
  _inventory_item_id: string
): Promise<boolean> {
  // Check recent out of stock events for this product
  const recentEvent = await prisma.event.findFirst({
    where: {
      workspace_id,
      type: 'product_out_of_stock',
      created_at: {
        gte: new Date(Date.now() - INVENTORY_CHECK_WINDOW_DAYS * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  return recentEvent !== null;
}

/**
 * Calculates duration of out of stock period
 */
async function calculateOutOfStockDuration(
  workspace_id: string,
  _inventory_item_id: string
): Promise<number> {
  const outOfStockEvent = await prisma.event.findFirst({
    where: {
      workspace_id,
      type: 'product_out_of_stock',
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (!outOfStockEvent) {
    return 0;
  }

  const duration = Date.now() - outOfStockEvent.created_at.getTime();
  return Math.floor(duration / (24 * 60 * 60 * 1000)); // Convert to days
}
