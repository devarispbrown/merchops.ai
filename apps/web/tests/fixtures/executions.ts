/**
 * Execution Test Fixtures
 *
 * Sample executions with success/failure status and provider responses.
 */

import {
  ExecutionStatus,
  ExecutionErrorCode,
  type ExecutionError,
} from '../../server/actions/types';
import {
  discountDraftPayloadPercentage,
  winbackEmailPayloadHighValue,
  pauseProductPayloadStockout,
} from './drafts';

// ============================================================================
// BASE EXECUTION DATA
// ============================================================================

const baseExecution = {
  workspace_id: 'workspace-test-123',
  started_at: new Date('2024-01-15T13:00:00Z'),
};

// ============================================================================
// SHOPIFY PROVIDER RESPONSES
// ============================================================================

export const shopifyDiscountSuccessResponse = {
  price_rule: {
    id: 987654321098,
    title: 'Winter Clearance - 25% Off Coats',
    target_type: 'line_item',
    target_selection: 'entitled',
    allocation_method: 'across',
    value_type: 'percentage',
    value: '-25.0',
    customer_selection: 'all',
    prerequisite_subtotal_range: {
      greater_than_or_equal_to: '50.0',
    },
    starts_at: '2024-01-16T00:00:00Z',
    ends_at: '2024-01-31T23:59:59Z',
    created_at: '2024-01-15T13:00:15Z',
    updated_at: '2024-01-15T13:00:15Z',
  },
  discount_code: {
    id: 123456789012,
    price_rule_id: 987654321098,
    code: 'WINTER25',
    usage_count: 0,
    created_at: '2024-01-15T13:00:15Z',
    updated_at: '2024-01-15T13:00:15Z',
  },
};

export const shopifyDiscountErrorResponse = {
  errors: {
    code: ['has already been taken'],
  },
};

export const shopifyPauseProductSuccessResponse = {
  product: {
    id: 1234567890123,
    title: 'Classic White Sneakers',
    status: 'draft',
    updated_at: '2024-01-15T13:00:20Z',
  },
  metafield: {
    id: 11223344556677,
    namespace: 'merchops',
    key: 'pause_reason',
    value: 'Low inventory - preventing overselling during high-velocity spike. Will restock in 5-7 days.',
    type: 'single_line_text_field',
  },
};

export const shopifyPauseProductErrorResponse = {
  errors: {
    product: ['Product not found'],
  },
};

export const shopifyProductNotFoundResponse = {
  errors: 'Not Found',
};

// ============================================================================
// EMAIL PROVIDER RESPONSES
// ============================================================================

export const emailProviderSuccessResponse = {
  message_id: 'msg_abc123xyz789',
  status: 'queued',
  recipient_count: 12,
  scheduled_for: '2024-01-15T13:00:00Z',
  campaign_id: 'camp_winback_20240115',
};

export const emailProviderErrorResponse = {
  error: {
    code: 'SEGMENT_EMPTY',
    message: 'The specified customer segment contains no recipients',
    details: {
      segment: 'inactive_90_days_high_value',
      customer_count: 0,
    },
  },
};

export const emailProviderRateLimitResponse = {
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'API rate limit exceeded. Please retry after 60 seconds.',
    retry_after: 60,
  },
};

// ============================================================================
// SUCCESSFUL EXECUTIONS
// ============================================================================

export const executionDiscountSuccess = {
  id: 'exec-discount-success-1',
  ...baseExecution,
  action_draft_id: 'draft-discount-approved-1',
  request_payload_json: discountDraftPayloadPercentage,
  provider_response_json: shopifyDiscountSuccessResponse,
  status: ExecutionStatus.SUCCEEDED,
  error_code: null,
  error_message: null,
  finished_at: new Date('2024-01-15T13:00:18Z'),
  idempotency_key: 'idem-discount-approved-1-20240115130000',
};

export const executionEmailSuccess = {
  id: 'exec-email-success-1',
  ...baseExecution,
  action_draft_id: 'draft-winback-approved-1',
  request_payload_json: winbackEmailPayloadHighValue,
  provider_response_json: emailProviderSuccessResponse,
  status: ExecutionStatus.SUCCEEDED,
  error_code: null,
  error_message: null,
  finished_at: new Date('2024-01-15T13:00:25Z'),
  idempotency_key: 'idem-winback-approved-1-20240115130000',
};

export const executionPauseSuccess = {
  id: 'exec-pause-success-1',
  ...baseExecution,
  action_draft_id: 'draft-pause-approved-1',
  request_payload_json: pauseProductPayloadStockout,
  provider_response_json: shopifyPauseProductSuccessResponse,
  status: ExecutionStatus.SUCCEEDED,
  error_code: null,
  error_message: null,
  finished_at: new Date('2024-01-15T13:00:22Z'),
  idempotency_key: 'idem-pause-approved-1-20240115130000',
};

// ============================================================================
// PENDING EXECUTIONS
// ============================================================================

export const executionPending = {
  id: 'exec-pending-1',
  ...baseExecution,
  action_draft_id: 'draft-discount-approved-2',
  request_payload_json: discountDraftPayloadPercentage,
  provider_response_json: null,
  status: ExecutionStatus.PENDING,
  error_code: null,
  error_message: null,
  finished_at: null,
  idempotency_key: 'idem-discount-approved-2-20240115130100',
};

// ============================================================================
// RUNNING EXECUTIONS
// ============================================================================

export const executionRunning = {
  id: 'exec-running-1',
  ...baseExecution,
  action_draft_id: 'draft-winback-approved-2',
  request_payload_json: winbackEmailPayloadHighValue,
  provider_response_json: null,
  status: ExecutionStatus.RUNNING,
  error_code: null,
  error_message: null,
  finished_at: null,
  idempotency_key: 'idem-winback-approved-2-20240115130200',
  started_at: new Date('2024-01-15T13:02:00Z'),
};

// ============================================================================
// FAILED EXECUTIONS - VALIDATION ERRORS
// ============================================================================

export const executionFailedInvalidPayload: ExecutionError = {
  code: ExecutionErrorCode.INVALID_PAYLOAD,
  message: 'Invalid discount value: must be between 1 and 100 for percentage discounts',
  retryable: false,
  details: {
    field: 'value',
    provided: 150,
    expected: '1-100',
  },
};

export const executionDiscountFailedValidation = {
  id: 'exec-discount-failed-val-1',
  ...baseExecution,
  action_draft_id: 'draft-discount-failed-1',
  request_payload_json: { ...discountDraftPayloadPercentage, value: 150 },
  provider_response_json: null,
  status: ExecutionStatus.FAILED,
  error_code: ExecutionErrorCode.INVALID_PAYLOAD,
  error_message: executionFailedInvalidPayload.message,
  finished_at: new Date('2024-01-15T13:00:05Z'),
  idempotency_key: 'idem-discount-failed-1-20240115130000',
};

// ============================================================================
// FAILED EXECUTIONS - BUSINESS LOGIC ERRORS
// ============================================================================

export const executionFailedDiscountExists: ExecutionError = {
  code: ExecutionErrorCode.DISCOUNT_ALREADY_EXISTS,
  message: 'A discount code with this name already exists',
  retryable: false,
  details: {
    code: 'WINTER25',
    existing_price_rule_id: 987654321097,
  },
};

export const executionDiscountFailedExists = {
  id: 'exec-discount-failed-exists-1',
  ...baseExecution,
  action_draft_id: 'draft-discount-failed-2',
  request_payload_json: discountDraftPayloadPercentage,
  provider_response_json: shopifyDiscountErrorResponse,
  status: ExecutionStatus.FAILED,
  error_code: ExecutionErrorCode.DISCOUNT_ALREADY_EXISTS,
  error_message: executionFailedDiscountExists.message,
  finished_at: new Date('2024-01-15T13:00:16Z'),
  idempotency_key: 'idem-discount-failed-2-20240115130000',
};

export const executionFailedProductNotFound: ExecutionError = {
  code: ExecutionErrorCode.PRODUCT_NOT_FOUND,
  message: 'Product with ID 1234567890123 not found in Shopify',
  retryable: false,
  details: {
    product_id: '1234567890123',
  },
};

export const executionPauseFailedNotFound = {
  id: 'exec-pause-failed-notfound-1',
  ...baseExecution,
  action_draft_id: 'draft-pause-failed-1',
  request_payload_json: pauseProductPayloadStockout,
  provider_response_json: shopifyProductNotFoundResponse,
  status: ExecutionStatus.FAILED,
  error_code: ExecutionErrorCode.PRODUCT_NOT_FOUND,
  error_message: executionFailedProductNotFound.message,
  finished_at: new Date('2024-01-15T13:00:12Z'),
  idempotency_key: 'idem-pause-failed-1-20240115130000',
};

export const executionFailedSegmentEmpty: ExecutionError = {
  code: ExecutionErrorCode.CUSTOMER_SEGMENT_EMPTY,
  message: 'The specified customer segment contains no recipients',
  retryable: false,
  details: {
    segment: 'inactive_90_days_high_value',
    customer_count: 0,
  },
};

export const executionEmailFailedSegmentEmpty = {
  id: 'exec-email-failed-empty-1',
  ...baseExecution,
  action_draft_id: 'draft-winback-failed-1',
  request_payload_json: winbackEmailPayloadHighValue,
  provider_response_json: emailProviderErrorResponse,
  status: ExecutionStatus.FAILED,
  error_code: ExecutionErrorCode.CUSTOMER_SEGMENT_EMPTY,
  error_message: executionFailedSegmentEmpty.message,
  finished_at: new Date('2024-01-15T13:00:08Z'),
  idempotency_key: 'idem-winback-failed-1-20240115130000',
};

// ============================================================================
// FAILED EXECUTIONS - NETWORK/INFRASTRUCTURE
// ============================================================================

export const executionFailedNetwork: ExecutionError = {
  code: ExecutionErrorCode.NETWORK_ERROR,
  message: 'Failed to connect to Shopify API: Connection timeout',
  retryable: true,
  details: {
    endpoint: 'https://example-store.myshopify.com/admin/api/2024-01/price_rules.json',
    timeout_ms: 30000,
  },
};

export const executionDiscountFailedNetwork = {
  id: 'exec-discount-failed-net-1',
  ...baseExecution,
  action_draft_id: 'draft-discount-failed-3',
  request_payload_json: discountDraftPayloadPercentage,
  provider_response_json: null,
  status: ExecutionStatus.FAILED,
  error_code: ExecutionErrorCode.NETWORK_ERROR,
  error_message: executionFailedNetwork.message,
  finished_at: new Date('2024-01-15T13:00:35Z'),
  idempotency_key: 'idem-discount-failed-3-20240115130000',
};

export const executionFailedTimeout: ExecutionError = {
  code: ExecutionErrorCode.TIMEOUT,
  message: 'Request to email provider timed out after 30 seconds',
  retryable: true,
  details: {
    timeout_ms: 30000,
  },
};

export const executionEmailFailedTimeout = {
  id: 'exec-email-failed-timeout-1',
  ...baseExecution,
  action_draft_id: 'draft-winback-failed-2',
  request_payload_json: winbackEmailPayloadHighValue,
  provider_response_json: null,
  status: ExecutionStatus.FAILED,
  error_code: ExecutionErrorCode.TIMEOUT,
  error_message: executionFailedTimeout.message,
  finished_at: new Date('2024-01-15T13:00:35Z'),
  idempotency_key: 'idem-winback-failed-2-20240115130000',
};

// ============================================================================
// FAILED EXECUTIONS - RATE LIMITING
// ============================================================================

export const executionFailedRateLimit: ExecutionError = {
  code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
  message: 'Shopify API rate limit exceeded. Retry after 2 seconds.',
  retryable: true,
  details: {
    retry_after_ms: 2000,
    bucket: 'REST Admin API',
  },
};

export const executionDiscountFailedRateLimit = {
  id: 'exec-discount-failed-rate-1',
  ...baseExecution,
  action_draft_id: 'draft-discount-failed-4',
  request_payload_json: discountDraftPayloadPercentage,
  provider_response_json: null,
  status: ExecutionStatus.FAILED,
  error_code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
  error_message: executionFailedRateLimit.message,
  finished_at: new Date('2024-01-15T13:00:02Z'),
  idempotency_key: 'idem-discount-failed-4-20240115130000',
};

// ============================================================================
// RETRYING EXECUTIONS
// ============================================================================

export const executionRetrying = {
  id: 'exec-retrying-1',
  ...baseExecution,
  action_draft_id: 'draft-discount-retry-1',
  request_payload_json: discountDraftPayloadPercentage,
  provider_response_json: null,
  status: ExecutionStatus.RETRYING,
  error_code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
  error_message: 'Previous attempt failed due to rate limit. Retrying...',
  finished_at: null,
  idempotency_key: 'idem-discount-retry-1-20240115130000',
  started_at: new Date('2024-01-15T13:00:00Z'),
};

// ============================================================================
// EXECUTIONS BY STATUS
// ============================================================================

export const executionsByStatus = {
  [ExecutionStatus.PENDING]: [executionPending],
  [ExecutionStatus.RUNNING]: [executionRunning],
  [ExecutionStatus.SUCCEEDED]: [
    executionDiscountSuccess,
    executionEmailSuccess,
    executionPauseSuccess,
  ],
  [ExecutionStatus.FAILED]: [
    executionDiscountFailedValidation,
    executionDiscountFailedExists,
    executionPauseFailedNotFound,
    executionEmailFailedSegmentEmpty,
    executionDiscountFailedNetwork,
    executionEmailFailedTimeout,
    executionDiscountFailedRateLimit,
  ],
  [ExecutionStatus.RETRYING]: [executionRetrying],
};

// ============================================================================
// EXECUTIONS WITH RETRYABLE ERRORS
// ============================================================================

export const retryableExecutions = [
  executionDiscountFailedNetwork,
  executionEmailFailedTimeout,
  executionDiscountFailedRateLimit,
  executionRetrying,
];

// ============================================================================
// EXECUTIONS WITH NON-RETRYABLE ERRORS
// ============================================================================

export const nonRetryableExecutions = [
  executionDiscountFailedValidation,
  executionDiscountFailedExists,
  executionPauseFailedNotFound,
  executionEmailFailedSegmentEmpty,
];

// ============================================================================
// ALL EXECUTIONS
// ============================================================================

export const allExecutions = [
  executionDiscountSuccess,
  executionEmailSuccess,
  executionPauseSuccess,
  executionPending,
  executionRunning,
  executionDiscountFailedValidation,
  executionDiscountFailedExists,
  executionPauseFailedNotFound,
  executionEmailFailedSegmentEmpty,
  executionDiscountFailedNetwork,
  executionEmailFailedTimeout,
  executionDiscountFailedRateLimit,
  executionRetrying,
];
