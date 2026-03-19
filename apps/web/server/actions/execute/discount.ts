/**
 * MerchOps Discount Execution
 * Creates Shopify price rules and discount codes via the real Shopify Admin API.
 */

import { DiscountDraftPayload, ExecutionErrorCode, ExecutionError } from "../types";
import { ShopifyClient, ShopifyApiError } from "../../shopify/client";

// ============================================================================
// TYPES
// ============================================================================

interface ExecuteDiscountInput {
  workspaceId: string;
  payload: DiscountDraftPayload;
}

interface ExecuteDiscountResult {
  success: boolean;
  providerResponse: any;
  error?: ExecutionError;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function executeDiscount(
  input: ExecuteDiscountInput
): Promise<ExecuteDiscountResult> {
  const { workspaceId, payload } = input;

  try {
    const client = await buildShopifyClient(workspaceId);

    const priceRule = await createPriceRule(client, payload);
    const priceRuleId = priceRule.id as number;

    const discountCode = await createDiscountCode(client, priceRuleId, payload);

    return {
      success: true,
      providerResponse: {
        priceRule,
        discountCode,
        provider: "shopify",
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    const executionError = classifyError(error);
    return {
      success: false,
      providerResponse: null,
      error: executionError,
    };
  }
}

// ============================================================================
// SHOPIFY API INTEGRATION
// ============================================================================

async function buildShopifyClient(workspaceId: string): Promise<ShopifyClient> {
  const { db } = await import("../../db");

  const connection = await db.shopifyConnection.findFirst({
    where: {
      workspace_id: workspaceId,
      status: "active",
    },
  });

  if (!connection) {
    throw new Error("No active Shopify connection found");
  }

  // ShopifyClient decrypts the token internally via decryptToken()
  return new ShopifyClient(connection.store_domain, connection.access_token_encrypted);
}

async function createPriceRule(
  client: ShopifyClient,
  payload: DiscountDraftPayload
): Promise<Record<string, unknown>> {
  const priceRuleBody: Record<string, unknown> = {
    title: payload.title,
    target_type: mapTargetType(payload.target_type),
    target_selection: payload.target_ids && payload.target_ids.length > 0 ? "entitled" : "all",
    allocation_method: "across",
    value_type: payload.discount_type === "percentage" ? "percentage" : "fixed_amount",
    // Shopify expects negative values for discounts; fixed_amount is in cents
    value:
      payload.discount_type === "percentage"
        ? `-${payload.value}`
        : `-${(payload.value * 100).toFixed(2)}`,
    customer_selection: payload.customer_segment ? "prerequisite" : "all",
    starts_at: payload.starts_at,
  };

  if (payload.ends_at) {
    priceRuleBody.ends_at = payload.ends_at;
  }

  if (payload.usage_limit != null) {
    priceRuleBody.usage_limit = payload.usage_limit;
  }

  if (payload.minimum_purchase_amount != null && payload.minimum_purchase_amount > 0) {
    priceRuleBody.prerequisite_subtotal_range = {
      greater_than_or_equal_to: payload.minimum_purchase_amount.toString(),
    };
  }

  if (payload.target_ids && payload.target_ids.length > 0) {
    if (payload.target_type === "product") {
      priceRuleBody.entitled_product_ids = payload.target_ids;
    } else if (payload.target_type === "collection") {
      priceRuleBody.entitled_collection_ids = payload.target_ids;
    }
  }

  const response = await client.createPriceRule(priceRuleBody);
  return response.price_rule;
}

async function createDiscountCode(
  client: ShopifyClient,
  priceRuleId: number,
  payload: DiscountDraftPayload
): Promise<Record<string, unknown>> {
  const code = payload.code || generateDiscountCode();

  const response = await client.createDiscountCode(priceRuleId, { code });
  return response.discount_code;
}

// ============================================================================
// ROLLBACK / DISABLE
// ============================================================================

export async function rollbackDiscount(params: {
  workspaceId: string;
  providerResponse: any;
}): Promise<void> {
  const { workspaceId, providerResponse } = params;

  const priceRuleId = providerResponse?.priceRule?.id as number | undefined;

  if (!priceRuleId) {
    console.warn("[ROLLBACK] No price rule ID found in provider response");
    return;
  }

  const client = await buildShopifyClient(workspaceId);
  await disableDiscount(client, priceRuleId);
}

/**
 * Deletes a Shopify price rule, which removes all associated discount codes.
 * This is the canonical rollback / disable mechanism for discount executions.
 */
async function disableDiscount(client: ShopifyClient, priceRuleId: number): Promise<void> {
  try {
    await client.deletePriceRule(priceRuleId);
    console.log("[ROLLBACK] Deleted Shopify price rule:", priceRuleId);
  } catch (error) {
    console.error("[ROLLBACK] Failed to delete price rule:", priceRuleId, error);
    throw error;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function mapTargetType(targetType: string): string {
  const mapping: Record<string, string> = {
    product: "line_item",
    collection: "line_item",
    entire_order: "line_item",
  };
  return mapping[targetType] || "line_item";
}

function generateDiscountCode(): string {
  const prefix = "SAVE";
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

function classifyError(error: any): ExecutionError {
  // Network / connectivity errors (raw Node.js codes) — check before API errors
  // because the ShopifyClient surfaces these wrapped, but raw errors can also
  // propagate if the mock or an early code path throws them directly.
  if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    return {
      code: ExecutionErrorCode.NETWORK_ERROR,
      message: "Failed to connect to Shopify API",
      retryable: true,
      details: { originalError: error.message },
    };
  }

  // Structured ShopifyApiError (from our client) — identified by name for
  // testability, since instanceof checks fail across module mock boundaries.
  if (error instanceof ShopifyApiError || error.name === "ShopifyApiError") {
    // Rate limiting
    if (error.statusCode === 429) {
      return {
        code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
        message: "Shopify API rate limit exceeded",
        retryable: true,
        details: { correlationId: error.correlationId, responseBody: error.responseBody },
      };
    }

    // Authentication
    if (error.statusCode === 401) {
      return {
        code: ExecutionErrorCode.INVALID_TOKEN,
        message: "Shopify access token is invalid or expired",
        retryable: false,
        details: { statusCode: error.statusCode, correlationId: error.correlationId },
      };
    }

    // Not found
    if (error.statusCode === 404) {
      return {
        code: ExecutionErrorCode.SHOPIFY_API_ERROR,
        message: "Shopify resource not found",
        retryable: false,
        details: { statusCode: error.statusCode, responseBody: error.responseBody },
      };
    }

    // Validation / business logic errors
    if (error.statusCode === 422) {
      return {
        code: ExecutionErrorCode.INVALID_PAYLOAD,
        message:
          extractShopifyErrorMessage(error.responseBody) || "Invalid discount configuration",
        retryable: false,
        details: { statusCode: error.statusCode, responseBody: error.responseBody },
      };
    }

    // Generic Shopify API error (5xx are retried internally by the client;
    // if they exhaust retries the error surfaces here as non-retryable)
    return {
      code: ExecutionErrorCode.SHOPIFY_API_ERROR,
      message: error.message || "Unknown Shopify API error",
      retryable: false,
      details: {
        statusCode: error.statusCode,
        correlationId: error.correlationId,
        responseBody: error.responseBody,
      },
    };
  }

  // Fallback for unexpected error shapes
  return {
    code: ExecutionErrorCode.SHOPIFY_API_ERROR,
    message: error.message || "Unknown Shopify API error",
    retryable: false,
    details: { originalError: String(error) },
  };
}

function extractShopifyErrorMessage(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const body = responseBody as Record<string, unknown>;

  // Shopify surfaces errors as { errors: { field: ["message"] } } or { errors: "string" }
  if (typeof body.errors === "string") {
    return body.errors;
  }

  if (body.errors && typeof body.errors === "object") {
    const errors = body.errors as Record<string, unknown>;
    const messages = Object.entries(errors)
      .flatMap(([field, msgs]) => {
        if (Array.isArray(msgs)) {
          return msgs.map((m) => `${field}: ${m}`);
        }
        return [`${field}: ${msgs}`];
      });
    return messages.join("; ") || null;
  }

  return null;
}
