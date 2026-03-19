/**
 * Klaviyo Campaign Draft Executor
 *
 * Execution type: klaviyo_campaign_draft
 *
 * Creates an email campaign draft in Klaviyo for a given audience list.
 * The result is stored in provider_response_json so it is visible in the
 * execution history UI and can be followed up on inside Klaviyo.
 *
 * IMPORTANT: Campaigns are ALWAYS created in DRAFT status.
 * This executor never triggers a send. Sending requires an explicit
 * operator action inside the Klaviyo dashboard.
 *
 * Expected payload shape:
 *   {
 *     list_id: string;
 *     campaign_name: string;
 *     subject_line: string;
 *     preview_text: string;
 *     html_content: string;
 *     from_email?: string;
 *     from_name?: string;
 *   }
 */

import { z } from 'zod';
import { getKlaviyoClient } from '../../klaviyo/connection';
import { KlaviyoApiError } from '../../klaviyo/client';
import { ExecutionErrorCode, ExecutionError } from '../types';

// ============================================================================
// PAYLOAD SCHEMA
// ============================================================================

export const KlaviyoCampaignDraftPayloadSchema = z.object({
  list_id: z.string().min(1),
  campaign_name: z.string().min(1),
  subject_line: z.string().min(1),
  preview_text: z.string(),
  html_content: z.string().min(1),
  from_email: z.string().email().optional(),
  from_name: z.string().optional(),
});

export type KlaviyoCampaignDraftPayload = z.infer<typeof KlaviyoCampaignDraftPayloadSchema>;

// ============================================================================
// RESULT TYPES
// ============================================================================

interface KlaviyoCampaignDraftProviderResponse {
  campaignId: string;
  campaignName: string;
  listId: string;
  klaviyoUrl: string;
  status: 'draft';
  createdAt: string;
}

interface ExecuteKlaviyoCampaignDraftResult {
  success: boolean;
  providerResponse: KlaviyoCampaignDraftProviderResponse | null;
  error?: ExecutionError;
}

// ============================================================================
// EXECUTOR
// ============================================================================

/**
 * Execute a klaviyo_campaign_draft action.
 *
 * Creates a Klaviyo email campaign in DRAFT status. Never sends the campaign.
 */
export async function executeKlaviyoCampaignDraft(input: {
  workspaceId: string;
  payload: KlaviyoCampaignDraftPayload;
}): Promise<ExecuteKlaviyoCampaignDraftResult> {
  const { workspaceId, payload } = input;

  // Validate payload
  const parsed = KlaviyoCampaignDraftPayloadSchema.safeParse(payload);
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

  const {
    list_id,
    campaign_name,
    subject_line,
    preview_text,
    html_content,
    from_email,
    from_name,
  } = parsed.data;

  // Resolve defaults for optional sender fields
  const resolvedFromEmail = from_email ?? 'hello@example.com';
  const resolvedFromName = from_name ?? campaign_name;

  try {
    const client = await getKlaviyoClient(workspaceId);

    // Build the JSON:API campaign body.
    // We call createCampaign which posts to /api/campaigns/ and returns the
    // resource. Klaviyo creates all campaigns in Draft status by default —
    // a separate "Send Campaign" API call would be required to send it.
    // We deliberately omit that call so the campaign always stays as a draft.
    const campaign = await client.createCampaign(
      {
        name: campaign_name,
        listId: list_id,
        subject: subject_line,
        previewText: preview_text,
        htmlContent: html_content,
        fromEmail: resolvedFromEmail,
        fromName: resolvedFromName,
      },
    );

    const campaignId = campaign.id;
    const klaviyoUrl = `https://www.klaviyo.com/campaign/${campaignId}`;

    // eslint-disable-next-line no-console
    console.log('[Klaviyo Campaign Executor] Campaign draft created', {
      workspaceId,
      campaignId,
      campaignName: campaign_name,
      listId: list_id,
      status: campaign.attributes.status,
    });

    return {
      success: true,
      providerResponse: {
        campaignId,
        campaignName: campaign_name,
        listId: list_id,
        klaviyoUrl,
        status: 'draft',
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    const executionError = classifyKlaviyoCampaignError(error);

    console.error('[Klaviyo Campaign Executor] Campaign draft creation failed', {
      workspaceId,
      campaignName: campaign_name,
      listId: list_id,
      errorCode: executionError.code,
      errorMessage: executionError.message,
    });

    return {
      success: false,
      providerResponse: null,
      error: executionError,
    };
  }
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function classifyKlaviyoCampaignError(error: unknown): ExecutionError {
  // No connection configured or connection inactive — non-retryable
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

  // Invalid API key message (from connection layer) — non-retryable
  if (error instanceof Error && error.message.includes('Invalid Klaviyo API key')) {
    return {
      code: ExecutionErrorCode.INVALID_TOKEN,
      message: 'Klaviyo API key is invalid. Please reconnect in Settings.',
      retryable: false,
      details: {},
    };
  }

  // Klaviyo API errors (typed from the client)
  if (error instanceof KlaviyoApiError) {
    // 401 / 403 — authentication or permission failure — non-retryable
    if (error.status === 401 || error.status === 403) {
      return {
        code: ExecutionErrorCode.INVALID_TOKEN,
        message: 'Klaviyo API key rejected. Please reconnect in Settings.',
        retryable: false,
        details: { status: error.status, errors: error.errors },
      };
    }

    // 429 — rate limit exceeded — retryable
    if (error.status === 429) {
      return {
        code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
        message:
          'Klaviyo rate limit exceeded. The campaign draft creation will be retried automatically.',
        retryable: true,
        details: { status: error.status },
      };
    }

    // 400 / 422 — invalid request body — non-retryable
    if (error.status === 400 || error.status === 422) {
      return {
        code: ExecutionErrorCode.INVALID_PAYLOAD,
        message: `Klaviyo rejected the campaign request: ${error.message}`,
        retryable: false,
        details: { status: error.status, errors: error.errors },
      };
    }

    // 5xx — server-side issue — retryable
    if (error.status >= 500) {
      return {
        code: ExecutionErrorCode.NETWORK_ERROR,
        message:
          'Klaviyo service is temporarily unavailable. The campaign draft creation will be retried.',
        retryable: true,
        details: { status: error.status },
      };
    }

    // All other Klaviyo API errors — non-retryable
    return {
      code: ExecutionErrorCode.EMAIL_PROVIDER_ERROR,
      message: error.message,
      retryable: false,
      details: { status: error.status, errors: error.errors },
    };
  }

  // Network / timeout errors — retryable
  if (
    error instanceof Error &&
    (error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('fetch failed'))
  ) {
    return {
      code: ExecutionErrorCode.NETWORK_ERROR,
      message: 'Failed to connect to Klaviyo. The campaign draft creation will be retried.',
      retryable: true,
      details: { originalError: error.message },
    };
  }

  // Unknown fallback — non-retryable
  return {
    code: ExecutionErrorCode.UNKNOWN_ERROR,
    message:
      error instanceof Error ? error.message : 'An unknown error occurred',
    retryable: false,
    details: {},
  };
}
