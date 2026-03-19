/**
 * Shopify Email Draft Executor
 *
 * Execution type: shopify_email_draft
 *
 * Creates an email marketing activity draft in Shopify Email via the Admin
 * GraphQL API. The result is stored in provider_response_json so it is
 * visible in the execution history UI and the merchant can navigate directly
 * to the draft from the shopifyAdminUrl.
 *
 * IMPORTANT: Drafts are ALWAYS created with DRAFT status.
 * This executor never triggers a live send. The merchant reviews and sends
 * from inside the Shopify admin.
 *
 * Expected payload shape:
 *   {
 *     subject: string;
 *     preview_text: string;          // defaults to ''
 *     html_content: string;
 *     from_name?: string;
 *     recipient_segment: string;
 *   }
 */

import { ShopifyApiError } from '../../shopify/client';
import { createShopifyEmailDraft } from '../../shopify/email';
import { ExecutionErrorCode, ExecutionError, ShopifyEmailDraftPayloadSchema } from '../types';

// ============================================================================
// RESULT TYPES
// ============================================================================

interface ShopifyEmailDraftProviderResponse {
  activityId: string;
  title: string;
  status: 'draft';
  recipientCount: number;
  shopifyAdminUrl: string;
  createdAt: string;
}

interface ExecuteShopifyEmailDraftResult {
  success: boolean;
  providerResponse: ShopifyEmailDraftProviderResponse | null;
  error?: ExecutionError;
}

// ============================================================================
// EXECUTOR
// ============================================================================

/**
 * Execute a shopify_email_draft action.
 *
 * Creates a Shopify Email marketing activity in DRAFT status. Never sends the
 * email. The merchant uses the shopifyAdminUrl returned in providerResponse to
 * review and send the draft at their own discretion.
 */
export async function executeShopifyEmailDraft(input: {
  workspaceId: string;
  payload: unknown;
}): Promise<ExecuteShopifyEmailDraftResult> {
  const { workspaceId, payload } = input;

  // Validate payload against the schema defined in types.ts
  const parsed = ShopifyEmailDraftPayloadSchema.safeParse(payload);
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

  const { subject, preview_text, html_content, from_name, recipient_segment } = parsed.data;

  try {
    const result = await createShopifyEmailDraft({
      workspaceId,
      subject,
      previewText: preview_text,
      htmlBody: html_content,
      fromName: from_name,
      recipientSegment: recipient_segment,
    });

    // eslint-disable-next-line no-console
    console.log('[Shopify Email Executor] Draft created', {
      workspaceId,
      activityId: result.activityId,
      recipientCount: result.recipientCount,
      shopifyAdminUrl: result.shopifyAdminUrl,
      status: result.status,
    });

    return {
      success: true,
      providerResponse: {
        activityId: result.activityId,
        title: result.title,
        status: 'draft',
        recipientCount: result.recipientCount,
        shopifyAdminUrl: result.shopifyAdminUrl,
        createdAt: result.createdAt,
      },
    };
  } catch (error: unknown) {
    const executionError = classifyShopifyEmailError(error);

    console.error('[Shopify Email Executor] Draft creation failed', {
      workspaceId,
      subject,
      recipientSegment: recipient_segment,
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

function classifyShopifyEmailError(error: unknown): ExecutionError {
  // No active ShopifyConnection — non-retryable
  if (
    error instanceof Error &&
    (error.message.includes('No Shopify connection') ||
      error.message.includes('not active'))
  ) {
    return {
      code: ExecutionErrorCode.INVALID_TOKEN,
      message:
        'Shopify is not connected for this workspace. Please connect your Shopify store in Settings.',
      retryable: false,
      details: {},
    };
  }

  // Shopify API errors (typed from the client)
  if (error instanceof ShopifyApiError) {
    const statusCode = error.statusCode;

    // 401 / 403 — authentication or permission failure — non-retryable
    if (statusCode === 401 || statusCode === 403) {
      return {
        code: ExecutionErrorCode.INVALID_TOKEN,
        message:
          'Shopify access token rejected. Please reconnect your Shopify store in Settings.',
        retryable: false,
        details: { statusCode },
      };
    }

    // 429 — rate limit exceeded — retryable
    if (statusCode === 429) {
      return {
        code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
        message:
          'Shopify rate limit exceeded. The email draft creation will be retried automatically.',
        retryable: true,
        details: { statusCode },
      };
    }

    // 400 / 422 — invalid request body — non-retryable
    if (statusCode === 400 || statusCode === 422) {
      return {
        code: ExecutionErrorCode.INVALID_PAYLOAD,
        message: `Shopify rejected the email draft request: ${error.message}`,
        retryable: false,
        details: { statusCode },
      };
    }

    // 5xx — server-side issue — retryable
    if (statusCode !== undefined && statusCode >= 500) {
      return {
        code: ExecutionErrorCode.NETWORK_ERROR,
        message:
          'Shopify service is temporarily unavailable. The email draft creation will be retried.',
        retryable: true,
        details: { statusCode },
      };
    }

    // All other Shopify API errors — non-retryable
    return {
      code: ExecutionErrorCode.SHOPIFY_API_ERROR,
      message: error.message,
      retryable: false,
      details: { statusCode },
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
      message:
        'Failed to connect to Shopify. The email draft creation will be retried.',
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
