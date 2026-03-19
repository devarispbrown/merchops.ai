/**
 * Unit tests for getRecipients() in email.ts
 *
 * Validates segment filtering, email exclusion, and consent filtering
 * using mocked Prisma client data — no real database required.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

import { prisma } from "../../../db/client";

import { getRecipients } from "../email";

// ---------------------------------------------------------------------------
// Mock the Prisma client
// ---------------------------------------------------------------------------

vi.mock("../../../db/client", () => ({
  prisma: {
    shopifyObjectCache: {
      findMany: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build a ShopifyObjectCache row for a customer. */
function makeCustomerRow(data: {
  id: number | string;
  email?: string;
  first_name?: string;
  last_name?: string;
  email_marketing_consent?: { state: string } | null;
  last_order_at?: string | null;
}) {
  return {
    id: `row-${data.id}`,
    workspace_id: "ws-test",
    object_type: "customer" as const,
    shopify_id: String(data.id),
    data_json: data,
    version: 1,
    synced_at: new Date(),
  };
}

/** Build a ShopifyObjectCache row for an order. */
function makeOrderRow(data: {
  id: number | string;
  created_at: string;
  customer?: { id: number | string } | null;
}) {
  return {
    id: `row-order-${data.id}`,
    workspace_id: "ws-test",
    object_type: "order" as const,
    shopify_id: String(data.id),
    data_json: data,
    version: 1,
    synced_at: new Date(),
  };
}

/** Returns an ISO date string for N days ago from now. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Convenience reference to the mock
// ---------------------------------------------------------------------------

const mockFindMany = () =>
  vi.mocked(prisma.shopifyObjectCache.findMany);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getRecipients()", () => {
  const workspaceId = "ws-test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Empty / unknown segments
  // -------------------------------------------------------------------------

  describe("empty segment", () => {
    test("returns empty array when segment is an empty string", async () => {
      const result = await getRecipients(workspaceId, "");
      expect(result).toEqual([]);
      // Should short-circuit before hitting the database
      expect(prisma.shopifyObjectCache.findMany).not.toHaveBeenCalled();
    });
  });

  describe("unknown segment", () => {
    test("returns empty array for an unrecognised segment", async () => {
      mockFindMany().mockResolvedValueOnce([
        makeCustomerRow({ id: 1, email: "jane@example.com" }),
      ]);

      const result = await getRecipients(workspaceId, "vip_customers");
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // all_customers
  // -------------------------------------------------------------------------

  describe("all_customers segment", () => {
    test("returns all customers that have a valid email", async () => {
      mockFindMany().mockResolvedValueOnce([
        makeCustomerRow({ id: 1, email: "alice@example.com", first_name: "Alice", last_name: "Smith" }),
        makeCustomerRow({ id: 2, email: "bob@example.com", first_name: "Bob", last_name: "Jones" }),
      ]);

      const result = await getRecipients(workspaceId, "all_customers");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "1", email: "alice@example.com", firstName: "Alice", lastName: "Smith" });
      expect(result[1]).toEqual({ id: "2", email: "bob@example.com", firstName: "Bob", lastName: "Jones" });
    });

    test("excludes customers without an email address", async () => {
      mockFindMany().mockResolvedValueOnce([
        makeCustomerRow({ id: 1, email: "alice@example.com" }),
        makeCustomerRow({ id: 2 }), // no email
        makeCustomerRow({ id: 3, email: "" }), // empty email
      ]);

      const result = await getRecipients(workspaceId, "all_customers");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    test("returns empty array when no customers exist in the cache", async () => {
      mockFindMany().mockResolvedValueOnce([]);

      const result = await getRecipients(workspaceId, "all_customers");

      expect(result).toEqual([]);
    });

    test("uses empty strings for missing first_name and last_name", async () => {
      mockFindMany().mockResolvedValueOnce([
        makeCustomerRow({ id: 5, email: "noname@example.com" }),
      ]);

      const result = await getRecipients(workspaceId, "all_customers");

      expect(result[0].firstName).toBe("");
      expect(result[0].lastName).toBe("");
    });

    test("excludes customers with unsubscribed email marketing consent", async () => {
      mockFindMany().mockResolvedValueOnce([
        makeCustomerRow({
          id: 1,
          email: "subscribed@example.com",
          email_marketing_consent: { state: "subscribed" },
        }),
        makeCustomerRow({
          id: 2,
          email: "unsubscribed@example.com",
          email_marketing_consent: { state: "unsubscribed" },
        }),
        makeCustomerRow({
          id: 3,
          email: "pending@example.com",
          email_marketing_consent: { state: "pending" },
        }),
      ]);

      const result = await getRecipients(workspaceId, "all_customers");

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("subscribed@example.com");
    });

    test("includes customers where email_marketing_consent field is absent (consent not yet synced)", async () => {
      mockFindMany().mockResolvedValueOnce([
        // No email_marketing_consent key at all
        makeCustomerRow({ id: 1, email: "nonconsent@example.com" }),
      ]);

      const result = await getRecipients(workspaceId, "all_customers");

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("nonconsent@example.com");
    });

    test("includes customers where email_marketing_consent is null", async () => {
      mockFindMany().mockResolvedValueOnce([
        makeCustomerRow({ id: 1, email: "nullconsent@example.com", email_marketing_consent: null }),
      ]);

      const result = await getRecipients(workspaceId, "all_customers");

      expect(result).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // dormant_30
  // -------------------------------------------------------------------------

  describe("dormant_30 segment", () => {
    test("includes customers whose last order was more than 30 days ago", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 100, email: "dormant@example.com", first_name: "Dormant", last_name: "User" }),
        ])
        // order rows
        .mockResolvedValueOnce([
          makeOrderRow({ id: 1001, created_at: daysAgo(45), customer: { id: 100 } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_30");

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("dormant@example.com");
    });

    test("excludes customers whose last order was within 30 days", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 100, email: "active@example.com" }),
        ])
        .mockResolvedValueOnce([
          makeOrderRow({ id: 1001, created_at: daysAgo(10), customer: { id: 100 } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_30");

      expect(result).toEqual([]);
    });

    test("excludes customers with no orders in cache", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 100, email: "noorder@example.com" }),
        ])
        .mockResolvedValueOnce([]); // no orders

      const result = await getRecipients(workspaceId, "dormant_30");

      expect(result).toEqual([]);
    });

    test("uses most-recent order when multiple orders exist for a customer", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 200, email: "multi@example.com" }),
        ])
        .mockResolvedValueOnce([
          // Older order — 60 days ago
          makeOrderRow({ id: 2001, created_at: daysAgo(60), customer: { id: 200 } }),
          // Recent order — 15 days ago (should be used as latest)
          makeOrderRow({ id: 2002, created_at: daysAgo(15), customer: { id: 200 } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_30");

      // Most recent order is 15 days ago — not dormant for 30-day threshold
      expect(result).toEqual([]);
    });

    test("falls back to customer.last_order_at when no order rows match", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({
            id: 300,
            email: "fallback@example.com",
            last_order_at: daysAgo(40), // >30 days, so should be included
          }),
        ])
        .mockResolvedValueOnce([]); // no order rows with this customer id

      const result = await getRecipients(workspaceId, "dormant_30");

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("fallback@example.com");
    });

    test("excludes customers without an email even if dormant", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 400 }), // no email
        ])
        .mockResolvedValueOnce([
          makeOrderRow({ id: 4001, created_at: daysAgo(45), customer: { id: 400 } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_30");

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // dormant_60
  // -------------------------------------------------------------------------

  describe("dormant_60 segment", () => {
    test("includes customers whose last order was more than 60 days ago", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 500, email: "very-dormant@example.com" }),
        ])
        .mockResolvedValueOnce([
          makeOrderRow({ id: 5001, created_at: daysAgo(90), customer: { id: 500 } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_60");

      expect(result).toHaveLength(1);
    });

    test("excludes customers dormant between 30 and 60 days", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 500, email: "mild-dormant@example.com" }),
        ])
        .mockResolvedValueOnce([
          makeOrderRow({ id: 5001, created_at: daysAgo(45), customer: { id: 500 } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_60");

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // dormant_90
  // -------------------------------------------------------------------------

  describe("dormant_90 segment", () => {
    test("includes customers whose last order was more than 90 days ago", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 600, email: "lapsed@example.com" }),
        ])
        .mockResolvedValueOnce([
          makeOrderRow({ id: 6001, created_at: daysAgo(120), customer: { id: 600 } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_90");

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("lapsed@example.com");
    });

    test("excludes customers dormant between 60 and 90 days", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 600, email: "lapsed@example.com" }),
        ])
        .mockResolvedValueOnce([
          makeOrderRow({ id: 6001, created_at: daysAgo(75), customer: { id: 600 } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_90");

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Mixed customer scenarios
  // -------------------------------------------------------------------------

  describe("mixed customer data", () => {
    test("correctly segments a mixed set of customers for dormant_30", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 1, email: "dormant@example.com" }),     // dormant 45d
          makeCustomerRow({ id: 2, email: "active@example.com" }),      // active 5d
          makeCustomerRow({ id: 3 }),                                    // no email
          makeCustomerRow({ id: 4, email: "noorder@example.com" }),     // no orders
          makeCustomerRow({
            id: 5,
            email: "unsub@example.com",
            email_marketing_consent: { state: "unsubscribed" },
          }),                                                            // unsubscribed
        ])
        .mockResolvedValueOnce([
          makeOrderRow({ id: 101, created_at: daysAgo(45), customer: { id: 1 } }),
          makeOrderRow({ id: 102, created_at: daysAgo(5),  customer: { id: 2 } }),
          makeOrderRow({ id: 105, created_at: daysAgo(40), customer: { id: 5 } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_30");

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("dormant@example.com");
    });

    test("handles customers with numeric and string IDs consistently", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 999, email: "numid@example.com" }),
        ])
        .mockResolvedValueOnce([
          // order customer id as string "999" — must still match
          makeOrderRow({ id: 9001, created_at: daysAgo(35), customer: { id: "999" } }),
        ]);

      const result = await getRecipients(workspaceId, "dormant_30");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("999");
    });

    test("ignores order rows without a customer reference", async () => {
      mockFindMany()
        .mockResolvedValueOnce([
          makeCustomerRow({ id: 700, email: "orphan@example.com" }),
        ])
        .mockResolvedValueOnce([
          makeOrderRow({ id: 7001, created_at: daysAgo(50), customer: null }),
        ]);

      // The only order has no customer link — customer should be excluded
      const result = await getRecipients(workspaceId, "dormant_30");

      expect(result).toEqual([]);
    });

    test("trims whitespace from email addresses", async () => {
      mockFindMany().mockResolvedValueOnce([
        makeCustomerRow({ id: 800, email: "  spaced@example.com  " }),
      ]);

      const result = await getRecipients(workspaceId, "all_customers");

      expect(result[0].email).toBe("spaced@example.com");
    });
  });
});
