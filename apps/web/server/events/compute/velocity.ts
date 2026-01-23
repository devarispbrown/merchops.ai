/**
 * Velocity Event Computation
 *
 * Computes velocity spike events by analyzing product sales rates
 * against historical baselines.
 */

import { prisma } from '../../db/client';
import { createEvent } from '../create';
import { VelocitySpikePayload } from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const VELOCITY_WINDOW_DAYS = 7; // Analysis window for current velocity
const BASELINE_WINDOW_DAYS = 30; // Historical baseline comparison window
const SPIKE_THRESHOLD_MULTIPLIER = 2.0; // 2x baseline = spike
const MIN_BASELINE_ORDERS = 3; // Minimum orders to establish baseline

// ============================================================================
// VELOCITY SPIKE COMPUTATION
// ============================================================================

interface VelocityData {
  product_id: string;
  variant_id?: string;
  product_title: string;
  variant_title?: string;
  current_velocity: number;
  baseline_velocity: number;
  units_sold: number;
  current_inventory?: number;
}

/**
 * Computes velocity spike events for a workspace
 * Identifies products selling faster than historical baseline
 */
export async function computeVelocitySpikeEvents(
  workspace_id: string
): Promise<void> {
  // Get velocity data for all products
  const velocityData = await calculateProductVelocities(workspace_id);

  for (const data of velocityData) {
    // Check if this is a spike
    const spikeMultiplier = data.current_velocity / data.baseline_velocity;

    if (spikeMultiplier < SPIKE_THRESHOLD_MULTIPLIER) {
      continue; // Not a spike
    }

    // Calculate estimated days to stockout
    let estimatedDaysToStockout: number | undefined;
    if (data.current_inventory && data.current_velocity > 0) {
      estimatedDaysToStockout = Math.floor(
        data.current_inventory / data.current_velocity
      );
    }

    const payload: VelocitySpikePayload = {
      product_id: data.product_id,
      variant_id: data.variant_id,
      product_title: data.product_title,
      variant_title: data.variant_title,
      baseline_units_per_day: parseFloat(data.baseline_velocity.toFixed(2)),
      current_units_per_day: parseFloat(data.current_velocity.toFixed(2)),
      spike_multiplier: parseFloat(spikeMultiplier.toFixed(2)),
      window_days: VELOCITY_WINDOW_DAYS,
      units_sold_in_window: data.units_sold,
      current_inventory: data.current_inventory,
      estimated_days_to_stockout: estimatedDaysToStockout,
    };

    await createEvent({
      workspace_id,
      type: 'velocity_spike',
      occurred_at: new Date(),
      payload,
      source: 'computed',
    });
  }
}

// ============================================================================
// VELOCITY CALCULATION
// ============================================================================

/**
 * Calculates current and baseline velocity for all products
 */
async function calculateProductVelocities(
  workspace_id: string
): Promise<VelocityData[]> {
  const now = new Date();
  const currentWindowStart = new Date(
    now.getTime() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const baselineWindowStart = new Date(
    now.getTime() - BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  // Fetch recent orders
  const orders = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'order',
      synced_at: {
        gte: baselineWindowStart,
      },
    },
  });

  // Fetch products for metadata
  const products = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'product',
    },
  });

  const productMap = new Map(
    products.map((p) => [(p.data_json as any).id, p.data_json])
  );

  // Aggregate sales by product
  const productSales = new Map<
    string,
    {
      current_units: number;
      baseline_units: number;
      product_data: any;
    }
  >();

  for (const order of orders) {
    const orderData = order.data_json as any;
    const orderDate = new Date(orderData.created_at);
    const isInCurrentWindow = orderDate >= currentWindowStart;

    // Process line items
    for (const item of orderData.line_items || []) {
      const productId = item.product_id;
      const quantity = item.quantity || 0;

      if (!productSales.has(productId)) {
        productSales.set(productId, {
          current_units: 0,
          baseline_units: 0,
          product_data: productMap.get(productId),
        });
      }

      const sales = productSales.get(productId)!;

      if (isInCurrentWindow) {
        sales.current_units += quantity;
      }
      sales.baseline_units += quantity;
    }
  }

  // Calculate velocities
  const velocities: VelocityData[] = [];

  for (const [productId, sales] of productSales) {
    if (!sales.product_data) {
      continue;
    }

    const currentVelocity = sales.current_units / VELOCITY_WINDOW_DAYS;
    const baselineVelocity = sales.baseline_units / BASELINE_WINDOW_DAYS;

    // Need minimum baseline to avoid false positives
    if (sales.baseline_units < MIN_BASELINE_ORDERS) {
      continue;
    }

    // Skip if baseline is zero
    if (baselineVelocity === 0) {
      continue;
    }

    // Get current inventory
    const inventory = await getCurrentInventory(workspace_id, productId);

    velocities.push({
      product_id: productId,
      product_title: sales.product_data.title,
      current_velocity: currentVelocity,
      baseline_velocity: baselineVelocity,
      units_sold: sales.current_units,
      current_inventory: inventory,
    });
  }

  return velocities;
}

/**
 * Gets current inventory for a product
 */
async function getCurrentInventory(
  workspace_id: string,
  product_id: string
): Promise<number | undefined> {
  const product = await prisma.shopifyObjectCache.findFirst({
    where: {
      workspace_id,
      object_type: 'product',
      shopify_id: product_id,
    },
  });

  if (!product) {
    return undefined;
  }

  const productData = product.data_json as any;

  // Sum inventory across all variants
  let totalInventory = 0;
  for (const variant of productData.variants || []) {
    totalInventory += variant.inventory_quantity || 0;
  }

  return totalInventory;
}

/**
 * Calculates velocity for a specific product
 * Useful for on-demand checks
 */
export async function calculateProductVelocity(
  workspace_id: string,
  product_id: string
): Promise<VelocityData | null> {
  const velocities = await calculateProductVelocities(workspace_id);
  return velocities.find((v) => v.product_id === product_id) || null;
}
