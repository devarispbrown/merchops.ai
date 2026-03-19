/**
 * Klaviyo Flow Trigger Executor
 *
 * Execution type: klaviyo_flow_trigger
 *
 * Enrolls a customer segment into a Klaviyo flow by posting a named metric
 * event for each profile in the segment.  Klaviyo flows are configured with
 * a "metric trigger" — when a profile receives an event whose metric name
 * matches the trigger, the profile enters the flow automatically.
 *
 * Batching: events are dispatched in concurrent chunks of CONCURRENCY_LIMIT
 * to stay well within Klaviyo's 75 POST/s ceiling while still processing
 * large segments in a reasonable time.
 *
 * Partial failures: individual profile failures are recorded and counted but
 * do not abort the remaining batch.  The execution is marked successful as
 * long as at least one profile was enrolled; a zero-success run is a failure.
 *
 * Expected payload shape:
 *   {
 *     metric_name:       string   // Klaviyo metric that triggers the flow
 *     recipient_segment: string   // Segment identifier ("dormant_60", etc.)
 *     flow_id?:          string   // Optional flow ID for audit reference
 *     properties?:       Record<string, unknown>  // Extra event properties
 *   }
 */

import { z } from 'zod';
import { getKlaviyoClient } from '../../klaviyo/connection';
import { KlaviyoApiError } from '../../klaviyo/client';
import { getRecipients } from './email';
import { ExecutionErrorCode, ExecutionError } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of createEvent calls to fire in parallel per batch.
 * Klaviyo allows 75 POST/s; keeping this at 10 leaves plenty of headroom
 * even when the token-bucket limiter inside KlaviyoClient is not yet
 * saturated from a previous request.
 */
const CONCURRENCY_LIMIT = 10;

// ============================================================================
// PAYLOAD SCHEMA
// ============================================================================

export const KlaviyoFlowTriggerPayloadSchema = z.object({
  metric_name: z.string().min(1),
  recipient_segment: z.string().min(1),
  flow_id: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

export type KlaviyoFlowTriggerPayload = z.infer<typeof KlaviyoFlowTriggerPayloadSchema>;

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface KlaviyoFlowTriggerProviderResponse {
  flowId: string | null;
  metricName: string;
  profileCount: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ email: string; message: string }>;
  triggeredAt: string;
}

interface ExecuteKlaviyoFlowTriggerResult {
  success: boolean;
  providerResponse: KlaviyoFlowTriggerProviderResponse | null;
  error?: ExecutionError;
}

// ============================================================================
// EXECUTOR
// ============================================================================

/**
 * Execute a klaviyo_flow_trigger action.
 *
 * @param input.workspaceId  - Workspace whose Klaviyo connection is used.
 * @param input.payload      - Validated or unvalidated payload object.
 */
export async function executeKlaviyoFlowTrigger(input: {
  workspaceId: string;
  payload: KlaviyoFlowTriggerPayload;
}): Promise<ExecuteKlaviyoFlowTriggerResult> {
  const { workspaceId, payload } = input;

  // Validate payload
  const parsed = KlaviyoFlowTriggerPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      providerResponse: null,
      error: {
        code: ExecutionErrorCode.INVALID_PAYLOAD,
        message: `Invalid payload: ${parsed.error.message}`,
        retryable: false,
        details: { zodError: parsed.error.flatten() },
      },
    };
  }

  const { metric_name, recipient_segment, flow_id, properties } = parsed.data;

  // Obtain Klaviyo client — throws if no active connection
  let client: Awaited<ReturnType<typeof getKlaviyoClient>>;
  try {
    client = await getKlaviyoClient(workspaceId);
  } catch (error: unknown) {
    return {
      success: false,
      providerResponse: null,
      error: classifyKlaviyoFlowError(error),
    };
  }

  // Resolve segment recipients from ShopifyObjectCache
  let recipients: Awaited<ReturnType<typeof getRecipients>>;
  try {
    recipients = await getRecipients(workspaceId, recipient_segment);
  } catch (error: unknown) {
    return {
      success: false,
      providerResponse: null,
      error: classifyKlaviyoFlowError(error),
    };
  }

  // eslint-disable-next-line no-console
  console.log('[Klaviyo Flow Executor] Recipients resolved', {
    workspaceId,
    recipientSegment: recipient_segment,
    profileCount: recipients.length,
  });

  // Empty segment — surface as a non-fatal, non-retryable error
  if (recipients.length === 0) {
    return {
      success: false,
      providerResponse: null,
      error: {
        code: ExecutionErrorCode.CUSTOMER_SEGMENT_EMPTY,
        message: `No customers found for segment "${recipient_segment}". No events were sent to Klaviyo.`,
        retryable: false,
        details: { segment: recipient_segment },
      },
    };
  }

  // Dispatch events in batches to respect Klaviyo's 75 POST/s rate limit
  const correlationId = `flow-trigger::${workspaceId}::${Date.now()}`;
  const profileErrors: Array<{ email: string; message: string }> = [];
  let successCount = 0;

  const emails = recipients.map((r) => r.email);

  for (let i = 0; i < emails.length; i += CONCURRENCY_LIMIT) {
    const chunk = emails.slice(i, i + CONCURRENCY_LIMIT);

    const chunkResults = await Promise.allSettled(
      chunk.map((email) =>
        client.createEvent(
          {
            metric_name,
            profile_email: email,
            properties: {
              source: 'merchops',
              segment: recipient_segment,
              ...(flow_id !== undefined && { flow_id }),
              ...properties,
            },
          },
          correlationId
        )
      )
    );

    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j];
      const email = chunk[j];

      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        const reason = result.reason;
        const message =
          reason instanceof Error ? reason.message : 'Unknown error';

        profileErrors.push({ email, message });

        console.error('[Klaviyo Flow Executor] Event failed for profile', {
          workspaceId,
          email,
          message,
        });
      }
    }
  }

  const failedCount = profileErrors.length;
  const profileCount = recipients.length;

  // eslint-disable-next-line no-console
  console.log('[Klaviyo Flow Executor] Batch complete', {
    workspaceId,
    metricName: metric_name,
    profileCount,
    successCount,
    failedCount,
  });

  const providerResponse: KlaviyoFlowTriggerProviderResponse = {
    flowId: flow_id ?? null,
    metricName: metric_name,
    profileCount,
    successCount,
    failedCount,
    errors: profileErrors,
    triggeredAt: new Date().toISOString(),
  };

  // Partial failure: succeed as long as at least one event was accepted
  if (successCount > 0) {
    if (failedCount > 0) {
      console.warn('[Klaviyo Flow Executor] Partial failure', {
        workspaceId,
        successCount,
        failedCount,
      });
    }
    return { success: true, providerResponse };
  }

  // Zero successes — classify the last error and surface it
  const lastError =
    profileErrors.length > 0
      ? new Error(profileErrors[profileErrors.length - 1].message)
      : new Error('All event submissions failed');

  return {
    success: false,
    providerResponse,
    error: classifyKlaviyoFlowError(lastError),
  };
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function classifyKlaviyoFlowError(error: unknown): ExecutionError {
  // No connection or revoked connection
  if (
    error instanceof Error &&
    (error.message.includes('No Klaviyo connection') ||
      error.message.includes('not active'))
  ) {
    return {
      code: ExecutionErrorCode.INVALID_TOKEN,
      message:
        'Klaviyo is not connected for this workspace. Please connect your Klaviyo account in Settings.',
      retryable: false,
      details: {},
    };
  }

  // Invalid API key
  if (error instanceof Error && error.message.includes('Invalid Klaviyo API key')) {
    return {
      code: ExecutionErrorCode.INVALID_TOKEN,
      message: 'Klaviyo API key is invalid. Please reconnect in Settings.',
      retryable: false,
      details: {},
    };
  }

  // Klaviyo API errors
  if (error instanceof KlaviyoApiError) {
    if (error.status === 401 || error.status === 403) {
      return {
        code: ExecutionErrorCode.INVALID_TOKEN,
        message: 'Klaviyo API key rejected. Please reconnect in Settings.',
        retryable: false,
        details: { status: error.status, errors: error.errors },
      };
    }

    if (error.status === 429) {
      return {
        code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
        message:
          'Klaviyo rate limit exceeded. The flow trigger will be retried automatically.',
        retryable: true,
        details: { status: error.status },
      };
    }

    if (error.status === 400 || error.status === 422) {
      return {
        code: ExecutionErrorCode.INVALID_PAYLOAD,
        message: `Klaviyo rejected the event request: ${error.message}`,
        retryable: false,
        details: { status: error.status, errors: error.errors },
      };
    }

    if (error.status >= 500) {
      return {
        code: ExecutionErrorCode.NETWORK_ERROR,
        message:
          'Klaviyo service is temporarily unavailable. The flow trigger will be retried.',
        retryable: true,
        details: { status: error.status },
      };
    }

    return {
      code: ExecutionErrorCode.EMAIL_PROVIDER_ERROR,
      message: error.message,
      retryable: false,
      details: { status: error.status, errors: error.errors },
    };
  }

  // Network / timeout errors
  if (
    error instanceof Error &&
    (error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('fetch failed'))
  ) {
    return {
      code: ExecutionErrorCode.NETWORK_ERROR,
      message: 'Failed to connect to Klaviyo. The flow trigger will be retried.',
      retryable: true,
      details: { originalError: error.message },
    };
  }

  return {
    code: ExecutionErrorCode.UNKNOWN_ERROR,
    message: error instanceof Error ? error.message : 'An unknown error occurred',
    retryable: false,
    details: {},
  };
}
