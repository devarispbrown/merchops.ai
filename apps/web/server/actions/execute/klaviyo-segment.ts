/**
 * Klaviyo Segment Sync Executor
 *
 * Execution type: klaviyo_segment_sync
 *
 * Syncs a named customer segment from the Shopify object cache to a
 * Klaviyo list.  The result is stored in provider_response_json so it
 * is visible in the execution history UI.
 *
 * Expected payload shape:
 *   { segment_type: string; list_name?: string }
 */

import { z } from 'zod';
import { syncSegmentToKlaviyo } from '../../klaviyo/segments';
import { KlaviyoApiError } from '../../klaviyo/client';
import { ExecutionErrorCode, ExecutionError } from '../types';

// ============================================================================
// PAYLOAD SCHEMA
// ============================================================================

export const KlaviyoSegmentSyncPayloadSchema = z.object({
  segment_type: z.string().min(1),
  list_name: z.string().optional(),
});

export type KlaviyoSegmentSyncPayload = z.infer<typeof KlaviyoSegmentSyncPayloadSchema>;

// ============================================================================
// RESULT TYPES
// ============================================================================

interface KlaviyoSegmentSyncProviderResponse {
  listId: string;
  listName: string;
  profileCount: number;
  klaviyoUrl: string;
  syncedAt: string;
}

interface ExecuteKlaviyoSegmentResult {
  success: boolean;
  providerResponse: KlaviyoSegmentSyncProviderResponse | null;
  error?: ExecutionError;
}

// ============================================================================
// EXECUTOR
// ============================================================================

/**
 * Execute a klaviyo_segment_sync action.
 */
export async function executeKlaviyoSegment(input: {
  workspaceId: string;
  payload: KlaviyoSegmentSyncPayload;
}): Promise<ExecuteKlaviyoSegmentResult> {
  const { workspaceId, payload } = input;

  // Validate payload
  const parsed = KlaviyoSegmentSyncPayloadSchema.safeParse(payload);
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

  const { segment_type, list_name } = parsed.data;

  try {
    const result = await syncSegmentToKlaviyo(workspaceId, segment_type, list_name);

    const klaviyoUrl = `https://www.klaviyo.com/lists/${result.listId}`;

    // eslint-disable-next-line no-console
    console.log('[Klaviyo Executor] Segment sync succeeded', {
      workspaceId,
      segmentType: segment_type,
      listId: result.listId,
      profileCount: result.profileCount,
    });

    return {
      success: true,
      providerResponse: {
        listId: result.listId,
        listName: result.listName,
        profileCount: result.profileCount,
        klaviyoUrl,
        syncedAt: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    const executionError = classifyKlaviyoError(error);

    console.error('[Klaviyo Executor] Segment sync failed', {
      workspaceId,
      segmentType: segment_type,
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

function classifyKlaviyoError(error: unknown): ExecutionError {
  // No connection configured
  if (
    error instanceof Error &&
    (error.message.includes('No Klaviyo connection') ||
      error.message.includes('not active'))
  ) {
    return {
      code: ExecutionErrorCode.INVALID_TOKEN,
      message: 'Klaviyo is not connected for this workspace. Please connect your Klaviyo account in Settings.',
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
        message: 'Klaviyo rate limit exceeded. The sync will be retried automatically.',
        retryable: true,
        details: { status: error.status },
      };
    }

    if (error.status === 400 || error.status === 422) {
      return {
        code: ExecutionErrorCode.INVALID_PAYLOAD,
        message: `Klaviyo rejected the request: ${error.message}`,
        retryable: false,
        details: { status: error.status, errors: error.errors },
      };
    }

    if (error.status >= 500) {
      return {
        code: ExecutionErrorCode.NETWORK_ERROR,
        message: 'Klaviyo service is temporarily unavailable. The sync will be retried.',
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
      message: 'Failed to connect to Klaviyo. The sync will be retried.',
      retryable: true,
      details: { originalError: error.message },
    };
  }

  // Empty segment
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes('no recipients')
  ) {
    return {
      code: ExecutionErrorCode.CUSTOMER_SEGMENT_EMPTY,
      message: 'No customers found for the specified segment.',
      retryable: false,
      details: {},
    };
  }

  return {
    code: ExecutionErrorCode.UNKNOWN_ERROR,
    message: error instanceof Error ? error.message : 'An unknown error occurred',
    retryable: false,
    details: {},
  };
}
