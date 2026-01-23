/**
 * MerchOps Pause Product Execution
 * Updates Shopify product status to draft (paused)
 */

import { PauseProductPayload, ExecutionErrorCode, ExecutionError } from "../types";

// ============================================================================
// TYPES
// ============================================================================

interface ExecutePauseProductInput {
  workspaceId: string;
  payload: PauseProductPayload;
}

interface ExecutePauseProductResult {
  success: boolean;
  providerResponse: any;
  error?: ExecutionError;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function executePauseProduct(
  input: ExecutePauseProductInput
): Promise<ExecutePauseProductResult> {
  const { workspaceId, payload } = input;

  try {
    // Get Shopify connection
    const shopifyClient = await getShopifyClient(workspaceId);

    // Store original product states for rollback
    const originalStates = await getProductStates(shopifyClient, payload.product_ids);

    // Pause each product
    const pausedProducts = await pauseProducts(shopifyClient, payload);

    return {
      success: true,
      providerResponse: {
        pausedProducts,
        originalStates, // Store for rollback
        reason: payload.reason,
        provider: "shopify",
        pausedAt: new Date().toISOString(),
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

  return {
    storeDomain: connection.store_domain,
  };
}

async function getProductStates(_client: any, productIds: string[]): Promise<any[]> {
  const states = [];

  for (const productId of productIds) {
    // TODO: Make actual Shopify API call
    // const response = await client.get({
    //   path: `products/${productId}`,
    // });

    // Mock response
    states.push({
      id: productId,
      status: "active", // Store original status
      published_at: new Date().toISOString(),
    });
  }

  return states;
}

async function pauseProducts(_client: any, payload: PauseProductPayload): Promise<any[]> {
  const pausedProducts = [];

  for (const productId of payload.product_ids) {
    // Update product status to 'draft' (effectively pausing it)
    const _updateData = {
      id: productId,
      status: "draft",
      published_at: null, // Unpublish
    };

    // TODO: Make actual Shopify API call
    // const response = await client.put({
    //   path: `products/${productId}`,
    //   data: { product: updateData },
    // });

    // Mock response
    console.log("[EXECUTE] Pausing Shopify product:", productId);

    pausedProducts.push({
      id: productId,
      status: "draft",
      paused_at: new Date().toISOString(),
      reason: payload.reason,
    });
  }

  return pausedProducts;
}

// ============================================================================
// ROLLBACK
// ============================================================================

export async function rollbackPauseProduct(params: {
  workspaceId: string;
  providerResponse: any;
}): Promise<void> {
  const { workspaceId, providerResponse } = params;

  try {
    const _shopifyClient = await getShopifyClient(workspaceId);
    const originalStates = providerResponse.originalStates || [];

    if (originalStates.length === 0) {
      console.warn("[ROLLBACK] No original product states found");
      return;
    }

    // Restore each product to original state
    for (const originalState of originalStates) {
      // TODO: Make actual Shopify API call
      // await client.put({
      //   path: `products/${originalState.id}`,
      //   data: {
      //     product: {
      //       status: originalState.status,
      //       published_at: originalState.published_at,
      //     },
      //   },
      // });

      console.log("[ROLLBACK] Restored Shopify product:", originalState.id);
    }
  } catch (error) {
    console.error("[ROLLBACK] Failed to rollback product pause:", error);
    throw error;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

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

  // Product not found
  if (error.response?.status === 404) {
    return {
      code: ExecutionErrorCode.PRODUCT_NOT_FOUND,
      message: "One or more products not found",
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
