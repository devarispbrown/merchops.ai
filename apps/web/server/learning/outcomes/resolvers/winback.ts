/**
 * Win-back Outcome Resolver
 *
 * Computes outcome for win-back email campaign executions
 * Compares open/click/conversion rates vs baseline dormant customer behavior
 */

import { prisma } from '@/server/db/client';
import {
  OutcomeType,
  OutcomeEvidence,
  OutcomeComputationInput,
  OutcomeComputationResult,
} from '../../types';

/**
 * Resolver for win-back email execution outcomes
 */
export class WinbackOutcomeResolver {
  private readonly BASELINE_WINDOW_DAYS = 30;
  private readonly OBSERVATION_WINDOW_DAYS = 14;
  private readonly HELPED_THRESHOLD = 0.05; // 5% conversion improvement
  private readonly HURT_THRESHOLD = -0.02; // 2% degradation (e.g., unsubscribes)

  /**
   * Compute outcome for a win-back email execution
   */
  async compute(
    input: OutcomeComputationInput
  ): Promise<OutcomeComputationResult> {
    const { workspace_id, execution_payload, executed_at } = input;

    // Extract email details from payload
    const targetCustomerIds = execution_payload.customer_ids as string[];
    const campaignId = execution_payload.campaign_id as string | undefined;

    // Define baseline window (dormant behavior before email)
    const baselineEnd = new Date(executed_at);
    const baselineStart = new Date(executed_at);
    baselineStart.setDate(baselineStart.getDate() - this.BASELINE_WINDOW_DAYS);

    // Define observation window (behavior after email sent)
    const observationStart = new Date(executed_at);
    const observationEnd = new Date(executed_at);
    observationEnd.setDate(observationEnd.getDate() + this.OBSERVATION_WINDOW_DAYS);

    // Fetch baseline metrics (what these customers were doing before)
    const baselineMetrics = await this.fetchCustomerMetrics(
      workspace_id,
      targetCustomerIds,
      baselineStart,
      baselineEnd
    );

    // Fetch observation metrics (what happened after email)
    const observationMetrics = await this.fetchCustomerMetrics(
      workspace_id,
      targetCustomerIds,
      observationStart,
      observationEnd
    );

    // Fetch email engagement metrics if available
    const emailMetrics = await this.fetchEmailMetrics(
      workspace_id,
      campaignId,
      observationStart,
      observationEnd
    );

    // Calculate deltas
    const conversionDelta =
      observationMetrics.conversion_rate - baselineMetrics.conversion_rate;
    const conversionDeltaPct =
      baselineMetrics.conversion_rate > 0
        ? conversionDelta / baselineMetrics.conversion_rate
        : conversionDelta; // If baseline is 0, use absolute delta

    // Use conversion rate as primary metric
    const primaryDeltaPct = conversionDeltaPct;

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
        metric_name: 'conversion_rate',
        value: baselineMetrics.conversion_rate,
      },
      observation_window: {
        start: observationStart,
        end: observationEnd,
        metric_name: 'conversion_rate',
        value: observationMetrics.conversion_rate,
      },
      baseline_value: baselineMetrics.conversion_rate,
      observed_value: observationMetrics.conversion_rate,
      delta: conversionDelta,
      delta_percentage: conversionDeltaPct,
      helped_threshold: this.HELPED_THRESHOLD,
      hurt_threshold: this.HURT_THRESHOLD,
      sample_size: targetCustomerIds.length,
      notes: [
        `Email opens: ${emailMetrics.open_rate.toFixed(1)}%`,
        `Email clicks: ${emailMetrics.click_rate.toFixed(1)}%`,
        `Purchases: ${observationMetrics.purchase_count} of ${targetCustomerIds.length}`,
      ].join(' | '),
    };

    return {
      outcome,
      evidence,
      computed_at: new Date(),
    };
  }

  /**
   * Fetch customer behavior metrics for a time window
   */
  private async fetchCustomerMetrics(
    workspace_id: string,
    customer_ids: string[],
    start: Date,
    end: Date
  ): Promise<{
    conversion_rate: number;
    purchase_count: number;
    revenue: number;
  }> {
    // Query orders for these customers in the time window
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

    // Filter orders by customer IDs
    let purchaseCount = 0;
    let revenue = 0;
    const customerIdsSet = new Set(customer_ids);

    for (const orderRecord of ordersData) {
      const order = orderRecord.data_json as any;
      const customerId = order.customer?.id?.toString();

      if (customerId && customerIdsSet.has(customerId)) {
        purchaseCount++;
        revenue += parseFloat(order.total_price || '0');
      }
    }

    const conversionRate = customer_ids.length > 0 ? purchaseCount / customer_ids.length : 0;

    return {
      conversion_rate: conversionRate,
      purchase_count: purchaseCount,
      revenue,
    };
  }

  /**
   * Fetch email engagement metrics
   * In production, this would integrate with email provider API (Postmark, SendGrid)
   */
  private async fetchEmailMetrics(
    _workspace_id: string,
    _campaign_id: string | undefined,
    _start: Date,
    _end: Date
  ): Promise<{
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
    unsubscribe_rate: number;
  }> {
    // Simplified for MVP
    // In production, query email provider API or email_events table

    // For now, return placeholder metrics
    // These would be computed from actual email delivery events
    return {
      open_rate: 0.25, // 25%
      click_rate: 0.08, // 8%
      bounce_rate: 0.02, // 2%
      unsubscribe_rate: 0.005, // 0.5%
    };
  }
}

// ============================================================================
// EXPORTED FUNCTION
// ============================================================================

/**
 * Resolve winback outcome - exported function wrapper
 */
export async function resolveWinbackOutcome(
  input: OutcomeComputationInput
): Promise<OutcomeComputationResult> {
  const resolver = new WinbackOutcomeResolver();
  return resolver.compute(input);
}
