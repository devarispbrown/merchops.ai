/**
 * Discount Outcome Resolver
 *
 * Computes outcome for discount/promotion executions
 * Compares conversion and revenue metrics vs baseline window
 */

import { prisma } from '@/server/db/client';
import {
  OutcomeType,
  OutcomeEvidence,
  OutcomeComputationInput,
  OutcomeComputationResult,
} from '../../types';

/**
 * Resolver for discount execution outcomes
 */
export class DiscountOutcomeResolver {
  private readonly BASELINE_WINDOW_DAYS = 14;
  private readonly OBSERVATION_WINDOW_DAYS = 7;
  private readonly HELPED_THRESHOLD = 0.1; // 10% improvement
  private readonly HURT_THRESHOLD = -0.05; // 5% degradation

  /**
   * Compute outcome for a discount execution
   */
  async compute(
    input: OutcomeComputationInput
  ): Promise<OutcomeComputationResult> {
    const { workspace_id, execution_payload, executed_at } = input;

    // Extract discount details from payload
    const _discountCode = execution_payload.discount_code as string;
    const targetProducts = execution_payload.target_products as string[] | undefined;

    // Define baseline window (before execution)
    const baselineEnd = new Date(executed_at);
    const baselineStart = new Date(executed_at);
    baselineStart.setDate(baselineStart.getDate() - this.BASELINE_WINDOW_DAYS);

    // Define observation window (after execution)
    const observationStart = new Date(executed_at);
    const observationEnd = new Date(executed_at);
    observationEnd.setDate(observationEnd.getDate() + this.OBSERVATION_WINDOW_DAYS);

    // Fetch baseline metrics
    const baselineMetrics = await this.fetchMetrics(
      workspace_id,
      baselineStart,
      baselineEnd,
      targetProducts
    );

    // Fetch observation metrics
    const observationMetrics = await this.fetchMetrics(
      workspace_id,
      observationStart,
      observationEnd,
      targetProducts
    );

    // Calculate deltas
    const conversionDelta =
      observationMetrics.conversion_rate - baselineMetrics.conversion_rate;
    const conversionDeltaPct =
      baselineMetrics.conversion_rate > 0
        ? conversionDelta / baselineMetrics.conversion_rate
        : 0;

    const revenueDelta =
      observationMetrics.revenue - baselineMetrics.revenue;
    const revenueDeltaPct =
      baselineMetrics.revenue > 0
        ? revenueDelta / baselineMetrics.revenue
        : 0;

    // Use the primary metric (revenue) for outcome determination
    const primaryDeltaPct = revenueDeltaPct;

    // Determine outcome
    let outcome: OutcomeType;
    if (primaryDeltaPct >= this.HELPED_THRESHOLD) {
      outcome = OutcomeType.HELPED;
    } else if (primaryDeltaPct <= this.HURT_THRESHOLD) {
      outcome = OutcomeType.HURT;
    } else {
      outcome = OutcomeType.NEUTRAL;
    }

    // Build evidence
    const evidence: OutcomeEvidence = {
      baseline_window: {
        start: baselineStart,
        end: baselineEnd,
        metric_name: 'revenue',
        value: baselineMetrics.revenue,
      },
      observation_window: {
        start: observationStart,
        end: observationEnd,
        metric_name: 'revenue',
        value: observationMetrics.revenue,
      },
      baseline_value: baselineMetrics.revenue,
      observed_value: observationMetrics.revenue,
      delta: revenueDelta,
      delta_percentage: revenueDeltaPct,
      helped_threshold: this.HELPED_THRESHOLD,
      hurt_threshold: this.HURT_THRESHOLD,
      sample_size: observationMetrics.order_count,
      notes: `Conversion rate: ${baselineMetrics.conversion_rate.toFixed(
        3
      )} → ${observationMetrics.conversion_rate.toFixed(3)} (${(
        conversionDeltaPct * 100
      ).toFixed(1)}%)`,
    };

    return {
      outcome,
      evidence,
      computed_at: new Date(),
    };
  }

  /**
   * Fetch metrics for a time window
   */
  private async fetchMetrics(
    workspace_id: string,
    start: Date,
    end: Date,
    targetProducts?: string[]
  ): Promise<{
    revenue: number;
    order_count: number;
    conversion_rate: number;
  }> {
    // Query Shopify objects cache for orders in the window
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

    // Calculate metrics
    let revenue = 0;
    let orderCount = 0;

    for (const orderRecord of ordersData) {
      const order = orderRecord.data_json as any;

      // Filter by target products if specified
      if (targetProducts && targetProducts.length > 0) {
        const orderProductIds = (order.line_items || []).map(
          (item: any) => item.product_id?.toString()
        );
        const hasTargetProduct = targetProducts.some((pid) =>
          orderProductIds.includes(pid)
        );
        if (!hasTargetProduct) {
          continue;
        }
      }

      revenue += parseFloat(order.total_price || '0');
      orderCount++;
    }

    // Fetch session/visitor count for conversion rate (simplified)
    // In production, this would come from analytics events
    const visitorCount = await this.estimateVisitorCount(
      workspace_id,
      start,
      end
    );

    const conversionRate = visitorCount > 0 ? orderCount / visitorCount : 0;

    return {
      revenue,
      order_count: orderCount,
      conversion_rate: conversionRate,
    };
  }

  /**
   * Estimate visitor count (simplified for MVP)
   * In production, this would come from analytics events or Shopify Analytics API
   */
  private async estimateVisitorCount(
    workspace_id: string,
    start: Date,
    end: Date
  ): Promise<number> {
    // Simplified: use a multiplier based on historical data
    // For MVP, assume 50:1 visitor to order ratio
    const orders = await prisma.shopifyObjectCache.count({
      where: {
        workspace_id,
        object_type: 'order',
        synced_at: {
          gte: start,
          lte: end,
        },
      },
    });

    return orders * 50;
  }
}

// ============================================================================
// EXPORTED FUNCTION
// ============================================================================

/**
 * Resolve discount outcome - exported function wrapper
 */
export async function resolveDiscountOutcome(
  input: OutcomeComputationInput
): Promise<OutcomeComputationResult> {
  const resolver = new DiscountOutcomeResolver();
  return resolver.compute(input);
}
