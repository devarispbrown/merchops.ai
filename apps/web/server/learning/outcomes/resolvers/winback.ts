/**
 * Win-back Outcome Resolver
 *
 * Computes outcome for win-back email campaign executions.
 * Compares open/click/conversion rates vs baseline dormant customer behavior.
 *
 * Email metrics are fetched from the originating provider:
 *   - Resend  — individual email statuses fetched via GET /emails/{id}
 *   - Klaviyo — campaign aggregate stats via campaign-values-reports
 *   - Estimated — conservative fallback when provider data is unavailable
 */

import { Resend } from 'resend';

import { prisma } from '@/server/db/client';
import { KlaviyoClient } from '@/server/klaviyo/client';
import {
  OutcomeType,
  OutcomeEvidence,
  OutcomeComputationInput,
  OutcomeComputationResult,
} from '../../types';

// ============================================================================
// EMAIL METRICS TYPES
// ============================================================================

/**
 * Normalized email engagement metrics returned by fetchEmailMetrics.
 * All counts are whole numbers; rates are derived by the caller.
 */
export interface EmailMetrics {
  sent_count: number;
  delivered_count: number;
  open_count: number;
  click_count: number;
  unsubscribe_count: number;
  /** Which system provided the data */
  source: 'resend' | 'klaviyo' | 'estimated';
  /** True when the numbers are conservative placeholders, not real provider data */
  is_estimated: boolean;
}

// ============================================================================
// PROVIDER RESPONSE SHAPES (stored in Execution.provider_response_json)
// ============================================================================

/**
 * Shape of provider_response_json when the execution used Resend.
 * Matches the object returned by sendViaResend() in execute/email.ts.
 */
interface ResendProviderResponse {
  provider: 'resend';
  messageIds: string[];
  recipientCount: number;
  successCount: number;
  failureCount: number;
  results: Array<{ id: string; to: string; error?: string }>;
  status: string;
  executedAt: string;
}

/**
 * Shape of provider_response_json when the execution used the Klaviyo path.
 * Stored by the Klaviyo campaign draft executor.
 */
interface KlaviyoProviderResponse {
  provider: 'klaviyo';
  campaignId: string;
  status: string;
  executedAt: string;
}

type ProviderResponse = ResendProviderResponse | KlaviyoProviderResponse | Record<string, unknown> | null;

// ============================================================================
// CONSERVATIVE FALLBACK ESTIMATES
// ============================================================================

const FALLBACK_OPEN_RATE = 0.20;      // 20 % industry average for winback
const FALLBACK_CLICK_RATE = 0.025;    // 2.5 %
const FALLBACK_UNSUBSCRIBE_RATE = 0.005; // 0.5 %

// ============================================================================
// RESOLVER CLASS
// ============================================================================

/**
 * Resolver for win-back email execution outcomes.
 */
export class WinbackOutcomeResolver {
  private readonly BASELINE_WINDOW_DAYS = 30;
  private readonly OBSERVATION_WINDOW_DAYS = 14;
  private readonly HELPED_THRESHOLD = 0.05; // 5% conversion improvement
  private readonly HURT_THRESHOLD = -0.02;  // 2% degradation (e.g., unsubscribes)

  /**
   * Compute outcome for a win-back email execution.
   */
  async compute(
    input: OutcomeComputationInput
  ): Promise<OutcomeComputationResult> {
    const { workspace_id, execution_payload, executed_at, execution_id } = input;

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

    // Fetch real email engagement metrics from the email provider
    const emailMetrics = await this.fetchEmailMetrics(
      workspace_id,
      campaignId,
      execution_id
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

    // Compute rates for notes (guard against divide-by-zero)
    const sentCount = emailMetrics.sent_count || targetCustomerIds.length || 1;
    const openRate = emailMetrics.open_count / sentCount;
    const clickRate = emailMetrics.click_count / sentCount;

    // Build evidence — include the raw email metrics and their source so it is
    // auditable and the UI can display real numbers.
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
        `Email opens: ${(openRate * 100).toFixed(1)}%`,
        `Email clicks: ${(clickRate * 100).toFixed(1)}%`,
        `Purchases: ${observationMetrics.purchase_count} of ${targetCustomerIds.length}`,
        emailMetrics.is_estimated ? '(email metrics estimated)' : `(source: ${emailMetrics.source})`,
      ].join(' | '),
      // Extended email engagement data stored for learning loop and UI
      context: {
        email_metrics: {
          sent_count: emailMetrics.sent_count,
          delivered_count: emailMetrics.delivered_count,
          open_count: emailMetrics.open_count,
          click_count: emailMetrics.click_count,
          unsubscribe_count: emailMetrics.unsubscribe_count,
          source: emailMetrics.source,
          is_estimated: emailMetrics.is_estimated,
        },
      },
    };

    return {
      outcome,
      evidence,
      computed_at: new Date(),
    };
  }

  // --------------------------------------------------------------------------
  // PRIVATE: CUSTOMER BEHAVIOR METRICS
  // --------------------------------------------------------------------------

  /**
   * Fetch customer behavior metrics for a time window.
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

  // --------------------------------------------------------------------------
  // PRIVATE: EMAIL METRICS — REAL PROVIDER DATA WITH SAFE FALLBACK
  // --------------------------------------------------------------------------

  /**
   * Fetch real email engagement metrics from the provider that sent the emails.
   *
   * Priority:
   *   1. Resend  — if provider_response_json indicates resend, retrieve each
   *                email's last_event via GET /emails/{id} and aggregate counts.
   *   2. Klaviyo — if the execution type is klaviyo_campaign_draft, pull
   *                campaign aggregate stats from campaign-values-reports.
   *   3. Estimated — any error, missing metadata, or unknown provider falls
   *                  through to conservative estimates. This path NEVER throws.
   */
  private async fetchEmailMetrics(
    workspace_id: string,
    campaignId: string | undefined,
    execution_id: string | undefined
  ): Promise<EmailMetrics> {
    try {
      // Load the execution record to inspect provider_response_json
      const execution = execution_id
        ? await prisma.execution.findUnique({
            where: { id: execution_id },
            select: {
              provider_response_json: true,
              action_draft: { select: { execution_type: true } },
            },
          })
        : null;

      const providerResponse = execution?.provider_response_json as ProviderResponse;
      const executionType = execution?.action_draft?.execution_type;

      // ----------------------------------------------------------------
      // Resend path
      // ----------------------------------------------------------------
      if (
        providerResponse &&
        typeof providerResponse === 'object' &&
        (providerResponse as ResendProviderResponse).provider === 'resend'
      ) {
        return await this.fetchResendMetrics(
          providerResponse as ResendProviderResponse
        );
      }

      // ----------------------------------------------------------------
      // Klaviyo path
      // ----------------------------------------------------------------
      if (
        executionType === 'klaviyo_campaign_draft' &&
        (
          campaignId ||
          (
            providerResponse &&
            typeof providerResponse === 'object' &&
            (providerResponse as KlaviyoProviderResponse).provider === 'klaviyo' &&
            (providerResponse as KlaviyoProviderResponse).campaignId
          )
        )
      ) {
        const resolvedCampaignId =
          campaignId ||
          (providerResponse as KlaviyoProviderResponse).campaignId;
        return await this.fetchKlaviyoMetrics(workspace_id, resolvedCampaignId);
      }

      // ----------------------------------------------------------------
      // Fallback — execution exists but provider is unknown or draft-only
      // ----------------------------------------------------------------
      console.warn(
        '[WinbackOutcomeResolver] fetchEmailMetrics: unknown provider or missing metadata, ' +
        'using estimated metrics',
        { execution_id, executionType, providerKey: (providerResponse as any)?.provider }
      );
      return this.buildEstimatedMetrics(
        'unknown provider or missing execution metadata'
      );
    } catch (err) {
      // Never let metric fetching break outcome resolution
      console.warn(
        '[WinbackOutcomeResolver] fetchEmailMetrics: error fetching real metrics, ' +
        'falling back to estimates',
        { execution_id, error: err instanceof Error ? err.message : String(err) }
      );
      return this.buildEstimatedMetrics('provider API unavailable');
    }
  }

  // --------------------------------------------------------------------------
  // RESEND METRICS
  // --------------------------------------------------------------------------

  /**
   * Query the Resend API for each individual email's delivery status and
   * aggregate the results into unified counts.
   *
   * Resend GET /emails/{id} returns a `last_event` field indicating the
   * final state: delivered | opened | clicked | bounced | complained | …
   *
   * We treat each status cumulatively:
   *   clicked   → also counts as opened and delivered
   *   opened    → also counts as delivered
   *   delivered → counts as delivered
   *   bounced   → not delivered
   */
  private async fetchResendMetrics(
    providerResponse: ResendProviderResponse
  ): Promise<EmailMetrics> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[WinbackOutcomeResolver] fetchResendMetrics: RESEND_API_KEY not set');
      return this.buildEstimatedMetrics('RESEND_API_KEY not configured');
    }

    const messageIds = (providerResponse.messageIds ?? []).filter(Boolean);
    if (messageIds.length === 0) {
      console.warn('[WinbackOutcomeResolver] fetchResendMetrics: no message IDs in provider response');
      return this.buildEstimatedMetrics('no Resend message IDs recorded');
    }

    const resend = new Resend(apiKey);

    let sentCount = messageIds.length;
    let deliveredCount = 0;
    let openCount = 0;
    let clickCount = 0;
    // Resend does not expose unsubscribe counts per message; track separately
    let unsubscribeCount = 0;

    // Fetch in parallel with a concurrency cap to avoid flooding the API
    const BATCH_SIZE = 20;
    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = messageIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((id) => resend.emails.get(id))
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          // Individual email fetch failed — count it as sent but unknown status
          continue;
        }

        const { data, error } = result.value;
        if (error || !data) {
          continue;
        }

        const event = data.last_event;

        // Hierarchical counting: clicked > opened > delivered
        if (event === 'clicked') {
          deliveredCount++;
          openCount++;
          clickCount++;
        } else if (event === 'opened') {
          deliveredCount++;
          openCount++;
        } else if (
          event === 'delivered' ||
          event === 'sent' ||
          event === 'queued' ||
          event === 'scheduled'
        ) {
          deliveredCount++;
        } else if (event === 'complained') {
          // Complaint is a form of engagement — count as delivered
          deliveredCount++;
          unsubscribeCount++;
        }
        // bounced / canceled / failed / delivery_delayed → not delivered
      }
    }

    return {
      sent_count: sentCount,
      delivered_count: deliveredCount,
      open_count: openCount,
      click_count: clickCount,
      unsubscribe_count: unsubscribeCount,
      source: 'resend',
      is_estimated: false,
    };
  }

  // --------------------------------------------------------------------------
  // KLAVIYO METRICS
  // --------------------------------------------------------------------------

  /**
   * Pull aggregate campaign statistics from the Klaviyo
   * campaign-values-reports endpoint.
   */
  private async fetchKlaviyoMetrics(
    workspace_id: string,
    campaignId: string
  ): Promise<EmailMetrics> {
    // Look up the Klaviyo API key for this workspace
    const connection = await prisma.klaviyoConnection.findUnique({
      where: { workspaceId: workspace_id },
      select: { apiKeyEncrypted: true, status: true },
    });

    if (!connection || connection.status !== 'active') {
      console.warn(
        '[WinbackOutcomeResolver] fetchKlaviyoMetrics: no active Klaviyo connection',
        { workspace_id }
      );
      return this.buildEstimatedMetrics('Klaviyo connection not active');
    }

    // NOTE: The key is stored encrypted; the decryption layer is handled by
    // the KlaviyoClient constructor or the connection service. For the MVP the
    // key is stored in plaintext behind the "encrypted" column name pending
    // the encryption-at-rest implementation, so we pass it directly.
    const client = new KlaviyoClient(connection.apiKeyEncrypted);

    const stats = await client.getCampaignStatistics(campaignId);

    return {
      sent_count: stats.sent_count,
      delivered_count: stats.delivered_count,
      open_count: stats.open_count,
      click_count: stats.click_count,
      unsubscribe_count: stats.unsubscribe_count,
      source: 'klaviyo',
      is_estimated: false,
    };
  }

  // --------------------------------------------------------------------------
  // FALLBACK / ESTIMATED METRICS
  // --------------------------------------------------------------------------

  /**
   * Build conservative estimated metrics when real provider data is unavailable.
   * These are industry-average ballpark figures tagged with is_estimated: true
   * so consumers can distinguish them from real data.
   */
  private buildEstimatedMetrics(reason: string): EmailMetrics {
    // We don't have an actual sent_count in the fallback; use 0 as sentinel so
    // callers know to treat rates as estimates rather than computing from counts.
    const sentCount = 0;
    const openCount = Math.round(sentCount * FALLBACK_OPEN_RATE);
    const clickCount = Math.round(sentCount * FALLBACK_CLICK_RATE);
    const unsubscribeCount = Math.round(sentCount * FALLBACK_UNSUBSCRIBE_RATE);

    console.warn(
      '[WinbackOutcomeResolver] Using estimated email metrics.',
      { reason }
    );

    return {
      sent_count: sentCount,
      delivered_count: sentCount,
      open_count: openCount,
      click_count: clickCount,
      unsubscribe_count: unsubscribeCount,
      source: 'estimated',
      is_estimated: true,
    };
  }
}

// ============================================================================
// EXPORTED FUNCTION
// ============================================================================

/**
 * Resolve winback outcome — exported function wrapper.
 */
export async function resolveWinbackOutcome(
  input: OutcomeComputationInput
): Promise<OutcomeComputationResult> {
  const resolver = new WinbackOutcomeResolver();
  return resolver.compute(input);
}
