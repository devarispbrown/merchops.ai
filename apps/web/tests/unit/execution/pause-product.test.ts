/**
 * Unit Tests: Pause Product Executor
 * MerchOps Beta MVP
 *
 * Tests:
 * - Successful pause flow (GET then PUT draft)
 * - Successful restore/rollback flow
 * - Rate limit (429) → retryable ExecutionError
 * - Product not found (404) → non-retryable ExecutionError
 * - Additional HTTP status codes and network errors
 * - Missing Shopify connection guard
 *
 * ShopifyClient is never instantiated — tests inject a mock ProductApiClient
 * directly via the optional clientOverride parameter on both exported functions.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, createTestShopifyConnection } from "../../setup";
import { ExecutionErrorCode } from "@/server/actions/types";
import { ShopifyApiError } from "@/server/shopify/client";

// Mock the db import used inside buildShopifyClient so Prisma is replaced
// with the shared prismaMock from setup.ts.
vi.mock("@/server/db", () => ({
  db: prismaMock,
}));

import {
  executePauseProduct,
  rollbackPauseProduct,
  type ProductApiClient,
} from "@/server/actions/execute/pause-product";

// ============================================================================
// FIXTURES
// ============================================================================

const WORKSPACE_ID = "test-workspace-id";
const PRODUCT_ID_1 = "123456789";
const PRODUCT_ID_2 = "987654321";

function makeProduct(id: string, status = "active") {
  return {
    id: parseInt(id, 10),
    title: `Test Product ${id}`,
    handle: `test-product-${id}`,
    status,
    variants: [{ id: 1, price: "29.99" }],
    images: [],
  };
}

function makeMockClient(overrides: Partial<ProductApiClient> = {}): ProductApiClient {
  return {
    getProduct: vi.fn(),
    updateProductStatus: vi.fn(),
    ...overrides,
  };
}

const pausePayload = {
  product_ids: [PRODUCT_ID_1],
  reason: "Critically low inventory — pausing to prevent oversell",
  notify_customers: false as const,
  redirect_to_similar: false as const,
};

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  // Wire up an active Shopify connection for tests that exercise the real
  // buildShopifyClient path (i.e., when no clientOverride is passed).
  prismaMock.shopifyConnection.findFirst.mockResolvedValue(
    createTestShopifyConnection({
      workspace_id: WORKSPACE_ID,
      store_domain: "test-store.myshopify.com",
      access_token_encrypted: "iv:authtag:encryptedvalue",
      status: "active",
    })
  );
});

// ============================================================================
// SUCCESSFUL PAUSE FLOW
// ============================================================================

describe("executePauseProduct — successful pause", () => {
  it("fetches each product's current status before pausing", async () => {
    const client = makeMockClient({
      getProduct: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "active")),
      updateProductStatus: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "draft")),
    });

    await executePauseProduct({ workspaceId: WORKSPACE_ID, payload: pausePayload }, client);

    expect(client.getProduct).toHaveBeenCalledOnce();
    expect(client.getProduct).toHaveBeenCalledWith(PRODUCT_ID_1);
  });

  it("calls updateProductStatus with 'draft' for each product", async () => {
    const client = makeMockClient({
      getProduct: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "active")),
      updateProductStatus: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "draft")),
    });

    await executePauseProduct({ workspaceId: WORKSPACE_ID, payload: pausePayload }, client);

    expect(client.updateProductStatus).toHaveBeenCalledOnce();
    expect(client.updateProductStatus).toHaveBeenCalledWith(PRODUCT_ID_1, "draft");
  });

  it("returns success=true with pausedProducts and originalStates in providerResponse", async () => {
    const client = makeMockClient({
      getProduct: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "active")),
      updateProductStatus: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "draft")),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const { providerResponse } = result;
    expect(providerResponse.provider).toBe("shopify");
    expect(providerResponse.reason).toBe(pausePayload.reason);
    expect(providerResponse.pausedAt).toBeDefined();

    // originalStates must capture the status before the PUT
    expect(providerResponse.originalStates).toHaveLength(1);
    expect(providerResponse.originalStates[0]).toMatchObject({
      id: PRODUCT_ID_1,
      status: "active",
    });

    // pausedProducts reflects the Shopify response
    expect(providerResponse.pausedProducts).toHaveLength(1);
    expect(providerResponse.pausedProducts[0].status).toBe("draft");
    expect(providerResponse.pausedProducts[0].reason).toBe(pausePayload.reason);
    expect(providerResponse.pausedProducts[0].paused_at).toBeDefined();
  });

  it("handles multiple products and preserves each original status independently", async () => {
    const client = makeMockClient({
      getProduct: vi
        .fn()
        .mockResolvedValueOnce(makeProduct(PRODUCT_ID_1, "active"))
        .mockResolvedValueOnce(makeProduct(PRODUCT_ID_2, "archived")),
      updateProductStatus: vi
        .fn()
        .mockResolvedValueOnce(makeProduct(PRODUCT_ID_1, "draft"))
        .mockResolvedValueOnce(makeProduct(PRODUCT_ID_2, "draft")),
    });

    const payload = { ...pausePayload, product_ids: [PRODUCT_ID_1, PRODUCT_ID_2] };
    const result = await executePauseProduct({ workspaceId: WORKSPACE_ID, payload }, client);

    expect(result.success).toBe(true);
    expect(result.providerResponse.originalStates).toHaveLength(2);
    expect(result.providerResponse.originalStates[0]).toMatchObject({ id: PRODUCT_ID_1, status: "active" });
    expect(result.providerResponse.originalStates[1]).toMatchObject({ id: PRODUCT_ID_2, status: "archived" });
    expect(result.providerResponse.pausedProducts).toHaveLength(2);
  });

  it("returns a valid ISO 8601 pausedAt timestamp", async () => {
    const client = makeMockClient({
      getProduct: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "active")),
      updateProductStatus: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "draft")),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    const { pausedAt } = result.providerResponse;
    expect(new Date(pausedAt).toISOString()).toBe(pausedAt);
  });

  it("getProduct is called before updateProductStatus for each product", async () => {
    const callOrder: string[] = [];

    const client = makeMockClient({
      getProduct: vi.fn().mockImplementation(async () => {
        callOrder.push("get");
        return makeProduct(PRODUCT_ID_1, "active");
      }),
      updateProductStatus: vi.fn().mockImplementation(async () => {
        callOrder.push("update");
        return makeProduct(PRODUCT_ID_1, "draft");
      }),
    });

    await executePauseProduct({ workspaceId: WORKSPACE_ID, payload: pausePayload }, client);

    // All GETs must complete before any PUT (serial per product)
    expect(callOrder[0]).toBe("get");
    expect(callOrder[1]).toBe("update");
  });
});

// ============================================================================
// SUCCESSFUL RESTORE (ROLLBACK) FLOW
// ============================================================================

describe("rollbackPauseProduct — successful restore", () => {
  it("calls updateProductStatus with the product's original status", async () => {
    const client = makeMockClient({
      updateProductStatus: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "active")),
    });

    const providerResponse = {
      originalStates: [{ id: PRODUCT_ID_1, status: "active" }],
    };

    await rollbackPauseProduct({ workspaceId: WORKSPACE_ID, providerResponse }, client);

    expect(client.updateProductStatus).toHaveBeenCalledOnce();
    expect(client.updateProductStatus).toHaveBeenCalledWith(PRODUCT_ID_1, "active");
  });

  it("restores multiple products each to their own original status", async () => {
    const client = makeMockClient({
      updateProductStatus: vi
        .fn()
        .mockResolvedValueOnce(makeProduct(PRODUCT_ID_1, "active"))
        .mockResolvedValueOnce(makeProduct(PRODUCT_ID_2, "archived")),
    });

    const providerResponse = {
      originalStates: [
        { id: PRODUCT_ID_1, status: "active" },
        { id: PRODUCT_ID_2, status: "archived" },
      ],
    };

    await rollbackPauseProduct({ workspaceId: WORKSPACE_ID, providerResponse }, client);

    expect(client.updateProductStatus).toHaveBeenCalledTimes(2);
    expect(client.updateProductStatus).toHaveBeenNthCalledWith(1, PRODUCT_ID_1, "active");
    expect(client.updateProductStatus).toHaveBeenNthCalledWith(2, PRODUCT_ID_2, "archived");
  });

  it("resolves without calling updateProductStatus when originalStates is empty", async () => {
    const client = makeMockClient({
      updateProductStatus: vi.fn(),
    });

    await expect(
      rollbackPauseProduct({ workspaceId: WORKSPACE_ID, providerResponse: { originalStates: [] } }, client)
    ).resolves.toBeUndefined();

    expect(client.updateProductStatus).not.toHaveBeenCalled();
  });

  it("resolves without calling updateProductStatus when originalStates is missing", async () => {
    const client = makeMockClient({
      updateProductStatus: vi.fn(),
    });

    await expect(
      rollbackPauseProduct({ workspaceId: WORKSPACE_ID, providerResponse: {} }, client)
    ).resolves.toBeUndefined();

    expect(client.updateProductStatus).not.toHaveBeenCalled();
  });

  it("propagates errors thrown during a restore PUT", async () => {
    const apiError = new ShopifyApiError("Server error", 500);

    const client = makeMockClient({
      updateProductStatus: vi.fn().mockRejectedValue(apiError),
    });

    const providerResponse = {
      originalStates: [{ id: PRODUCT_ID_1, status: "active" }],
    };

    await expect(
      rollbackPauseProduct({ workspaceId: WORKSPACE_ID, providerResponse }, client)
    ).rejects.toThrow("Server error");
  });
});

// ============================================================================
// ERROR CLASSIFICATION — RATE LIMIT (429) → RETRYABLE
// ============================================================================

describe("executePauseProduct — rate limit (429) → retryable", () => {
  it("classifies 429 from getProduct as RATE_LIMIT_EXCEEDED with retryable=true", async () => {
    const rateLimitError = new ShopifyApiError("Rate limit exceeded", 429, undefined, "corr-1");
    const client = makeMockClient({
      getProduct: vi.fn().mockRejectedValue(rateLimitError),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    expect(result.success).toBe(false);
    expect(result.providerResponse).toBeNull();
    expect(result.error!.code).toBe(ExecutionErrorCode.RATE_LIMIT_EXCEEDED);
    expect(result.error!.retryable).toBe(true);
  });

  it("classifies 429 from updateProductStatus as RATE_LIMIT_EXCEEDED with retryable=true", async () => {
    const rateLimitError = new ShopifyApiError("Rate limit exceeded", 429);
    const client = makeMockClient({
      getProduct: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "active")),
      updateProductStatus: vi.fn().mockRejectedValue(rateLimitError),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe(ExecutionErrorCode.RATE_LIMIT_EXCEEDED);
    expect(result.error!.retryable).toBe(true);
  });
});

// ============================================================================
// ERROR CLASSIFICATION — PRODUCT NOT FOUND (404) → NON-RETRYABLE
// ============================================================================

describe("executePauseProduct — product not found (404) → non-retryable", () => {
  it("classifies 404 from getProduct as PRODUCT_NOT_FOUND with retryable=false", async () => {
    const notFoundError = new ShopifyApiError("Not Found", 404, { errors: "Not Found" });
    const client = makeMockClient({
      getProduct: vi.fn().mockRejectedValue(notFoundError),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    expect(result.success).toBe(false);
    expect(result.providerResponse).toBeNull();
    expect(result.error!.code).toBe(ExecutionErrorCode.PRODUCT_NOT_FOUND);
    expect(result.error!.retryable).toBe(false);
  });

  it("classifies 404 from updateProductStatus as PRODUCT_NOT_FOUND with retryable=false", async () => {
    const notFoundError = new ShopifyApiError("Not Found", 404, { errors: "Not Found" });
    const client = makeMockClient({
      getProduct: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "active")),
      updateProductStatus: vi.fn().mockRejectedValue(notFoundError),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe(ExecutionErrorCode.PRODUCT_NOT_FOUND);
    expect(result.error!.retryable).toBe(false);
  });
});

// ============================================================================
// ERROR CLASSIFICATION — ADDITIONAL STATUS CODES
// ============================================================================

describe("executePauseProduct — other HTTP error codes", () => {
  it("classifies 401 as INVALID_TOKEN, non-retryable", async () => {
    const client = makeMockClient({
      getProduct: vi.fn().mockRejectedValue(new ShopifyApiError("Unauthorized", 401)),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    expect(result.error!.code).toBe(ExecutionErrorCode.INVALID_TOKEN);
    expect(result.error!.retryable).toBe(false);
  });

  it("classifies 422 as INVALID_PAYLOAD, non-retryable", async () => {
    const client = makeMockClient({
      getProduct: vi.fn().mockResolvedValue(makeProduct(PRODUCT_ID_1, "active")),
      updateProductStatus: vi.fn().mockRejectedValue(
        new ShopifyApiError("Unprocessable Entity", 422, { errors: { status: ["is invalid"] } })
      ),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    expect(result.error!.code).toBe(ExecutionErrorCode.INVALID_PAYLOAD);
    expect(result.error!.retryable).toBe(false);
  });

  it("classifies ECONNREFUSED as NETWORK_ERROR, retryable", async () => {
    const networkError = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:80"), {
      code: "ECONNREFUSED",
    });
    const client = makeMockClient({
      getProduct: vi.fn().mockRejectedValue(networkError),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    expect(result.error!.code).toBe(ExecutionErrorCode.NETWORK_ERROR);
    expect(result.error!.retryable).toBe(true);
  });

  it("classifies unknown errors as SHOPIFY_API_ERROR, non-retryable", async () => {
    const client = makeMockClient({
      getProduct: vi.fn().mockRejectedValue(new Error("Something totally unexpected")),
    });

    const result = await executePauseProduct(
      { workspaceId: WORKSPACE_ID, payload: pausePayload },
      client
    );

    expect(result.error!.code).toBe(ExecutionErrorCode.SHOPIFY_API_ERROR);
    expect(result.error!.retryable).toBe(false);
  });
});

// ============================================================================
// CONNECTION GUARD (no clientOverride — uses real buildShopifyClient path)
// ============================================================================

describe("executePauseProduct — missing Shopify connection", () => {
  it("returns SHOPIFY_API_ERROR when no active Shopify connection exists", async () => {
    prismaMock.shopifyConnection.findFirst.mockResolvedValue(null);

    // No clientOverride → executor calls buildShopifyClient which throws.
    const result = await executePauseProduct({
      workspaceId: WORKSPACE_ID,
      payload: pausePayload,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe(ExecutionErrorCode.SHOPIFY_API_ERROR);
    expect(result.error!.message).toContain("No active Shopify connection");
  });
});
