/**
 * MerchOps Discount Execution
 * Creates Shopify price rules and discount codes
 */

import { DiscountDraftPayload, ExecutionErrorCode, ExecutionError } from "../types";

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
    // Get Shopify connection
    const shopifyClient = await getShopifyClient(workspaceId);

    // Create price rule
    const priceRule = await createPriceRule(shopifyClient, payload);

    // Create discount code
    const discountCode = await createDiscountCode(shopifyClient, priceRule.id, payload);

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

async function getShopifyClient(workspaceId: string): Promise<any> {
  // TODO: Get Shopify connection and create authenticated client
  // For now, return a mock client for type checking

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

  // TODO: Initialize Shopify API client with access token
  // const shopify = new Shopify.Clients.Rest(
  //   connection.store_domain,
  //   decryptToken(connection.access_token_encrypted)
  // );

  return {
    storeDomain: connection.store_domain,
    // Add other client methods
  };
}

async function createPriceRule(_client: any, payload: DiscountDraftPayload): Promise<any> {
  // Map our payload to Shopify's price rule format
  const priceRuleData = {
    title: payload.title,
    target_type: mapTargetType(payload.target_type),
    target_selection: payload.target_ids && payload.target_ids.length > 0 ? "entitled" : "all",
    allocation_method: "across",
    value_type: payload.discount_type === "percentage" ? "percentage" : "fixed_amount",
    value: payload.discount_type === "percentage" ? `-${payload.value}` : `-${payload.value * 100}`,
    customer_selection: payload.customer_segment ? "prerequisite" : "all",
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
    usage_limit: payload.usage_limit,
    prerequisite_subtotal_range: payload.minimum_purchase_amount
      ? {
          greater_than_or_equal_to: payload.minimum_purchase_amount.toString(),
        }
      : undefined,
  };

  // TODO: Make actual Shopify API call
  // const response = await client.post({
  //   path: 'price_rules',
  //   data: { price_rule: priceRuleData },
  // });

  // Mock response for now
  console.log("[EXECUTE] Creating Shopify price rule:", priceRuleData);

  return {
    id: `price_rule_${Date.now()}`,
    ...priceRuleData,
    created_at: new Date().toISOString(),
  };
}

async function createDiscountCode(
  _client: any,
  priceRuleId: string,
  payload: DiscountDraftPayload
): Promise<any> {
  const code = payload.code || generateDiscountCode();

  const discountCodeData = {
    code,
    usage_count: 0,
  };

  // TODO: Make actual Shopify API call
  // const response = await client.post({
  //   path: `price_rules/${priceRuleId}/discount_codes`,
  //   data: { discount_code: discountCodeData },
  // });

  // Mock response for now
  console.log("[EXECUTE] Creating Shopify discount code:", discountCodeData);

  return {
    id: `discount_code_${Date.now()}`,
    price_rule_id: priceRuleId,
    ...discountCodeData,
    created_at: new Date().toISOString(),
  };
}

// ============================================================================
// ROLLBACK
// ============================================================================

export async function rollbackDiscount(params: {
  workspaceId: string;
  providerResponse: any;
}): Promise<void> {
  const { workspaceId, providerResponse } = params;

  try {
    const _shopifyClient = await getShopifyClient(workspaceId);
    const priceRuleId = providerResponse.priceRule?.id;

    if (!priceRuleId) {
      console.warn("[ROLLBACK] No price rule ID found in provider response");
      return;
    }

    // Delete or disable the price rule
    // TODO: Make actual Shopify API call
    // await client.delete({
    //   path: `price_rules/${priceRuleId}`,
    // });

    console.log("[ROLLBACK] Deleted Shopify price rule:", priceRuleId);
  } catch (error) {
    console.error("[ROLLBACK] Failed to rollback discount:", error);
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
  // Network errors
  if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    return {
      code: ExecutionErrorCode.NETWORK_ERROR,
      message: "Failed to connect to Shopify API",
      retryable: true,
      details: { originalError: error.message },
    };
  }

  // Authentication errors
  if (error.response?.status === 401) {
    return {
      code: ExecutionErrorCode.INVALID_TOKEN,
      message: "Shopify access token is invalid or expired",
      retryable: false,
      details: { status: error.response.status },
    };
  }

  // Rate limiting
  if (error.response?.status === 429) {
    return {
      code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
      message: "Shopify API rate limit exceeded",
      retryable: true,
      details: {
        retryAfter: error.response.headers["retry-after"],
      },
    };
  }

  // Business logic errors
  if (error.response?.status === 422) {
    return {
      code: ExecutionErrorCode.INVALID_PAYLOAD,
      message: error.response.data?.errors || "Invalid discount configuration",
      retryable: false,
      details: error.response.data,
    };
  }

  // Default
  return {
    code: ExecutionErrorCode.SHOPIFY_API_ERROR,
    message: error.message || "Unknown Shopify API error",
    retryable: false,
    details: { originalError: error },
  };
}
