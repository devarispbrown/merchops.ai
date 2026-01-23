/**
 * Pause Product Outcome Resolver
 *
 * Computes outcome for product pause/unpause executions
 * Compares stockout reduction and operational metrics
 */

import { prisma } from '@/server/db/client';
import {
  OutcomeType,
  OutcomeEvidence,
  OutcomeComputationInput,
  OutcomeComputationResult,
} from '../../types';

/**
 * Resolver for pause product execution outcomes
 */
export class PauseProductOutcomeResolver {
  private readonly BASELINE_WINDOW_DAYS = 30;
  private readonly OBSERVATION_WINDOW_DAYS = 14;
  private readonly HELPED_THRESHOLD = 0.15; // 15% reduction in stockouts
  private readonly HURT_THRESHOLD = -0.1; // 10% increase (more stockouts)

  /**
   * Compute outcome for a pause product execution
   */
  async compute(
    input: OutcomeComputationInput
  ): Promise<OutcomeComputationResult> {
    const { workspace_id, execution_payload, executed_at } = input;

    // Extract product details from payload
    const productId = execution_payload.product_id as string;
    const action = execution_payload.action as 'pause' | 'unpause';

    // Define baseline window (before execution)
    const baselineEnd = new Date(executed_at);
    const baselineStart = new Date(executed_at);
    baselineStart.setDate(baselineStart.getDate() - this.BASELINE_WINDOW_DAYS);

    // Define observation window (after execution)
    const observationStart = new Date(executed_at);
    const observationEnd = new Date(executed_at);
    observationEnd.setDate(observationEnd.getDate() + this.OBSERVATION_WINDOW_DAYS);

    // Fetch baseline metrics
    const baselineMetrics = await this.fetchProductMetrics(
      workspace_id,
      productId,
      baselineStart,
      baselineEnd
    );

    // Fetch observation metrics
    const observationMetrics = await this.fetchProductMetrics(
      workspace_id,
      productId,
      observationStart,
      observationEnd
    );

    // Calculate stockout frequency delta
    const stockoutDelta =
      observationMetrics.stockout_frequency - baselineMetrics.stockout_frequency;
    const stockoutDeltaPct =
      baselineMetrics.stockout_frequency > 0
        ? stockoutDelta / baselineMetrics.stockout_frequency
        : 0;

    // For pause action, reduction in stockouts is good (negative delta)
    // For unpause, we expect stockouts to return (positive delta is neutral/expected)
    const _primaryDeltaPct = action === 'pause' ? -stockoutDeltaPct : stockoutDeltaPct;

    // Determine outcome
    let outcome: OutcomeType;
    if (action === 'pause') {
      // For pause: reduction in stockouts is helped
      if (stockoutDeltaPct <= -this.HELPED_THRESHOLD) {
        outcome = OutcomeType.HELPED;
      } else if (stockoutDeltaPct >= this.HURT_THRESHOLD) {
        outcome = OutcomeType.HURT; // Unexpected increase
      } else {
        outcome = OutcomeType.NEUTRAL;
      }
    } else {
      // For unpause: successful restoration to selling is helped
      if (observationMetrics.sale_count > 0) {
        outcome = OutcomeType.HELPED;
      } else {
        outcome = OutcomeType.NEUTRAL;
      }
    }

    // Build evidence
    const evidence: OutcomeEvidence = {
      baseline_window: {
        start: baselineStart,
        end: baselineEnd,
        metric_name: 'stockout_frequency',
        value: baselineMetrics.stockout_frequency,
      },
      observation_window: {
        start: observationStart,
        end: observationEnd,
        metric_name: 'stockout_frequency',
        value: observationMetrics.stockout_frequency,
      },
      baseline_value: baselineMetrics.stockout_frequency,
      observed_value: observationMetrics.stockout_frequency,
      delta: stockoutDelta,
      delta_percentage: stockoutDeltaPct,
      helped_threshold: this.HELPED_THRESHOLD,
      hurt_threshold: this.HURT_THRESHOLD,
      notes: [
        `Action: ${action}`,
        `Stockout events: ${baselineMetrics.stockout_count} → ${observationMetrics.stockout_count}`,
        `Sales after ${action}: ${observationMetrics.sale_count}`,
        `Avg inventory: ${baselineMetrics.avg_inventory.toFixed(0)} → ${observationMetrics.avg_inventory.toFixed(0)}`,
      ].join(' | '),
    };

    return {
      outcome,
      evidence,
      computed_at: new Date(),
    };
  }

  /**
   * Fetch product operational metrics for a time window
   */
  private async fetchProductMetrics(
    workspace_id: string,
    product_id: string,
    start: Date,
    end: Date
  ): Promise<{
    stockout_frequency: number;
    stockout_count: number;
    avg_inventory: number;
    sale_count: number;
  }> {
    // Query events for stockout occurrences
    const stockoutEvents = await prisma.event.findMany({
      where: {
        workspace_id,
        type: 'product_out_of_stock',
        occurred_at: {
          gte: start,
          lte: end,
        },
      },
      select: {
        payload_json: true,
      },
    });

    // Filter by product_id
    const relevantStockouts = stockoutEvents.filter((event) => {
      const payload = event.payload_json as any;
      return payload.product_id === product_id;
    });

    const stockoutCount = relevantStockouts.length;

    // Calculate frequency (stockouts per day)
    const daysInWindow =
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const stockoutFrequency = daysInWindow > 0 ? stockoutCount / daysInWindow : 0;

    // Query inventory levels
    const inventorySnapshots = await prisma.shopifyObjectCache.findMany({
      where: {
        workspace_id,
        object_type: 'inventory_level',
        synced_at: {
          gte: start,
          lte: end,
        },
      },
      select: {
        data_json: true,
      },
    });

    // Calculate average inventory for this product
    let totalInventory = 0;
    let inventoryCount = 0;

    for (const snapshot of inventorySnapshots) {
      const data = snapshot.data_json as any;
      if (data.product_id === product_id) {
        totalInventory += data.available || 0;
        inventoryCount++;
      }
    }

    const avgInventory = inventoryCount > 0 ? totalInventory / inventoryCount : 0;

    // Query sales in this window
    const ordersData = await prisma.shopifyObjectCache.findMany({
      where: {
        workspace_id,
        object_type: 'order',
        synced_at: {
          gte: start,
          lte: end,
        },
      },
      select: {
        data_json: true,
      },
    });

    // Count sales of this product
    let saleCount = 0;
    for (const orderRecord of ordersData) {
      const order = orderRecord.data_json as any;
      const lineItems = order.line_items || [];
      const hasSale = lineItems.some(
        (item: any) => item.product_id?.toString() === product_id
      );
      if (hasSale) {
        saleCount++;
      }
    }

    return {
      stockout_frequency: stockoutFrequency,
      stockout_count: stockoutCount,
      avg_inventory: avgInventory,
      sale_count: saleCount,
    };
  }
}

// ============================================================================
// EXPORTED FUNCTION
// ============================================================================

/**
 * Resolve pause product outcome - exported function wrapper
 */
export async function resolvePauseProductOutcome(
  input: OutcomeComputationInput
): Promise<OutcomeComputationResult> {
  const resolver = new PauseProductOutcomeResolver();
  return resolver.compute(input);
}
