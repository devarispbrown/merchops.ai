/**
 * MerchOps Pause Product Execution
 * Updates Shopify product status to draft (paused) and restores on rollback.
 *
 * Shopify REST Admin API version: 2024-01
 *   GET  /admin/api/2024-01/products/{id}.json  — fetch current status
 *   PUT  /admin/api/2024-01/products/{id}.json  — update status
 */

import { PauseProductPayload, ExecutionErrorCode, ExecutionError } from "../types";
import { ShopifyApiError } from "../../shopify/client";

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

/** Minimal product shape returned by Shopify REST. */
interface ShopifyProductData {
  id: number;
  title: string;
  handle: string;
  status: string;
  variants: any[];
  images?: any[];
}

interface ShopifyProductResponse {
  product: ShopifyProductData;
}

/** Per-product original state persisted for rollback. */
interface OriginalProductState {
  id: string;
  status: string;
}

/**
 * Abstraction over the two Shopify REST calls this executor needs.
 * Decoupling from ShopifyClient directly makes unit testing straightforward.
 */
export interface ProductApiClient {
  getProduct(productId: string): Promise<ShopifyProductData>;
  updateProductStatus(productId: string, status: string): Promise<ShopifyProductData>;
}

// ============================================================================
// SHOPIFY CLIENT ADAPTER
// ============================================================================

/**
 * Shape of the private ShopifyClient.request method.
 * Used only to cast `this` inside the adapter — never escapes this module.
 */
type ShopifyRequestFn = <T>(
  endpoint: string,
  options?: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown }
) => Promise<T>;

/**
 * Bridges the generic ShopifyClient (which has no product-specific methods)
 * to the ProductApiClient interface this executor needs.
 *
 * Kept local to this module so it does not modify client.ts.
 * The subclass accesses the private `request` method via a typed cast — safe
 * because the method signature in client.ts matches ShopifyRequestFn exactly.
 */
import { ShopifyClient } from "../../shopify/client";

class ShopifyProductAdapter extends ShopifyClient implements ProductApiClient {
  private get shopifyRequest(): ShopifyRequestFn {
    return (
      this as unknown as { request: ShopifyRequestFn }
    ).request.bind(this) as ShopifyRequestFn;
  }

  async getProduct(productId: string): Promise<ShopifyProductData> {
    const response = await this.shopifyRequest<ShopifyProductResponse>(
      `/products/${productId}.json`
    );
    return response.product;
  }

  async updateProductStatus(
    productId: string,
    status: string
  ): Promise<ShopifyProductData> {
    const response = await this.shopifyRequest<ShopifyProductResponse>(
      `/products/${productId}.json`,
      { method: "PUT", body: { product: { status } } }
    );
    return response.product;
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function executePauseProduct(
  input: ExecutePauseProductInput,
  /** Injected in tests; omit in production to use the real Shopify adapter. */
  clientOverride?: ProductApiClient
): Promise<ExecutePauseProductResult> {
  const { workspaceId, payload } = input;

  try {
    const client = clientOverride ?? (await buildShopifyClient(workspaceId));

    // Capture current statuses so rollback can restore them exactly.
    const originalStates = await getProductStates(client, payload.product_ids);

    // Pause every product by setting status to 'draft'.
    const pausedProducts = await pauseProducts(client, payload);

    return {
      success: true,
      providerResponse: {
        pausedProducts,
        originalStates,
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

/**
 * Build a real ShopifyProductAdapter for the given workspace.
 * Looks up the active ShopifyConnection and uses the encrypted token —
 * decryption happens inside ShopifyClient's constructor.
 */
export async function buildShopifyClient(workspaceId: string): Promise<ProductApiClient> {
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

  return new ShopifyProductAdapter(
    connection.store_domain,
    connection.access_token_encrypted
  );
}

/**
 * GET each product's current status (for rollback preservation).
 * Iterates serially to respect the rate limiter inside ShopifyClient.
 */
async function getProductStates(
  client: ProductApiClient,
  productIds: string[]
): Promise<OriginalProductState[]> {
  const states: OriginalProductState[] = [];

  for (const productId of productIds) {
    console.log("[EXECUTE] Fetching current state for Shopify product:", productId);
    const product = await client.getProduct(productId);
    states.push({ id: productId, status: product.status });
  }

  return states;
}

/**
 * PUT each product with `{ status: 'draft' }` to pause it.
 * Returns the full Shopify product response enriched with execution metadata.
 */
async function pauseProducts(
  client: ProductApiClient,
  payload: PauseProductPayload
): Promise<any[]> {
  const pausedProducts: any[] = [];

  for (const productId of payload.product_ids) {
    console.log("[EXECUTE] Pausing Shopify product:", productId);
    const product = await client.updateProductStatus(productId, "draft");
    pausedProducts.push({
      ...product,
      paused_at: new Date().toISOString(),
      reason: payload.reason,
    });
  }

  return pausedProducts;
}

// ============================================================================
// ROLLBACK
// ============================================================================

/**
 * Restore each product to the status captured in `providerResponse.originalStates`.
 * Called by the execution engine when a downstream step fails after a successful pause.
 */
export async function rollbackPauseProduct(
  params: { workspaceId: string; providerResponse: any },
  /** Injected in tests; omit in production. */
  clientOverride?: ProductApiClient
): Promise<void> {
  const { workspaceId, providerResponse } = params;

  try {
    const client = clientOverride ?? (await buildShopifyClient(workspaceId));
    const originalStates: OriginalProductState[] = providerResponse.originalStates || [];

    if (originalStates.length === 0) {
      console.warn("[ROLLBACK] No original product states found");
      return;
    }

    for (const originalState of originalStates) {
      console.log(
        "[ROLLBACK] Restoring Shopify product:",
        originalState.id,
        "→",
        originalState.status
      );
      await client.updateProductStatus(originalState.id, originalState.status);
    }
  } catch (error) {
    console.error("[ROLLBACK] Failed to rollback product pause:", error);
    throw error;
  }
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Map raw errors to the ExecutionError taxonomy consumed by the execution engine.
 *
 * ShopifyApiError carries `statusCode` (HTTP status) on the instance.
 *
 * Retryability:
 *   429 (rate limit)  → retryable
 *   404 (not found)   → non-retryable
 *   422 (validation)  → non-retryable
 *   401 (auth)        → non-retryable
 *   network errors    → retryable
 */
function classifyError(error: any): ExecutionError {
  if (error instanceof ShopifyApiError) {
    if (error.statusCode === 429) {
      return {
        code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
        message: "Shopify API rate limit exceeded",
        retryable: true,
        details: {
          statusCode: error.statusCode,
          correlationId: error.correlationId,
        },
      };
    }

    if (error.statusCode === 404) {
      return {
        code: ExecutionErrorCode.PRODUCT_NOT_FOUND,
        message: "One or more products not found",
        retryable: false,
        details: { statusCode: error.statusCode, body: error.responseBody },
      };
    }

    if (error.statusCode === 401) {
      return {
        code: ExecutionErrorCode.INVALID_TOKEN,
        message: "Shopify access token is invalid or expired",
        retryable: false,
        details: { statusCode: error.statusCode },
      };
    }

    if (error.statusCode === 422) {
      return {
        code: ExecutionErrorCode.INVALID_PAYLOAD,
        message: "Shopify rejected the product update payload",
        retryable: false,
        details: { statusCode: error.statusCode, body: error.responseBody },
      };
    }

    return {
      code: ExecutionErrorCode.SHOPIFY_API_ERROR,
      message: error.message || "Unknown Shopify API error",
      retryable: false,
      details: { statusCode: error.statusCode, body: error.responseBody },
    };
  }

  // Node.js network-level errors
  if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    return {
      code: ExecutionErrorCode.NETWORK_ERROR,
      message: "Failed to connect to Shopify API",
      retryable: true,
      details: { originalError: error.message },
    };
  }

  return {
    code: ExecutionErrorCode.SHOPIFY_API_ERROR,
    message: error.message || "Unknown Shopify API error",
    retryable: false,
    details: { originalError: error },
  };
}
