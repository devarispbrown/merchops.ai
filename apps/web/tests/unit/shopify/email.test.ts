/**
 * Unit Tests: Shopify Email Integration
 * MerchOps Beta MVP
 *
 * Tests:
 * - Successful draft creation returns correct shape and mutation variables
 * - Recipient count is resolved from segment via getRecipients()
 * - No active ShopifyConnection → ShopifyApiError with clear message
 * - Revoked ShopifyConnection → ShopifyApiError with status in message
 * - GraphQL userErrors → ShopifyApiError carrying field + message
 * - getShopifyEmailDrafts returns typed draft array
 * - getShopifyEmailDrafts with no active connection → ShopifyApiError
 *
 * Mocking strategy:
 * - ShopifyClient is fully mocked so no real HTTP calls are made
 * - decryptToken is mocked to avoid encryption key requirements at construction
 * - prisma is mocked to control ShopifyConnection lookups
 * - getRecipients is mocked to return predictable recipient arrays
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShopifyApiError } from '@/server/shopify/client';

// ============================================================================
// MODULE-LEVEL MOCKS
// ============================================================================

// Prevent decryptToken from requiring a real encryption key
vi.mock('@/server/shopify/oauth', () => ({
  decryptToken: vi.fn(() => 'shpat_decrypted_test_token'),
  encryptToken: vi.fn((v: string) => `enc:${v}`),
}));

// ShopifyClient mock — gives us full control over graphql() responses.
// We use vi.fn() so vitest can track constructor calls (toHaveBeenCalledWith),
// and set the implementation with a proper `function` body so `new` works.
const mockGraphql = vi.fn();
const MockShopifyClient = vi.fn(function MockShopifyClientImpl(this: Record<string, unknown>) {
  this.graphql = mockGraphql;
});

vi.mock('@/server/shopify/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/shopify/client')>();
  return {
    ...actual,
    // Replaced at module-load time; MockShopifyClient is a vi.fn() so it is
    // both newable and trackable.
    get ShopifyClient() {
      return MockShopifyClient;
    },
  };
});

// ---------------------------------------------------------------------------
// Prisma mock — controls ShopifyConnection lookup results
// ---------------------------------------------------------------------------

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();

vi.mock('@/server/db/client', () => ({
  prisma: {
    shopifyConnection: {
      findUnique: mockFindUnique,
    },
    shopifyObjectCache: {
      findMany: mockFindMany,
    },
  },
}));

// ---------------------------------------------------------------------------
// getRecipients mock — avoids real database queries for customer resolution
// ---------------------------------------------------------------------------

const mockGetRecipients = vi.fn();

vi.mock('@/server/actions/execute/email', () => ({
  getRecipients: mockGetRecipients,
}));

// ============================================================================
// FIXTURES
// ============================================================================

const WORKSPACE_ID = 'workspace-test-001';
const STORE_DOMAIN = 'test-store.myshopify.com';
const ENCRYPTED_TOKEN = 'enc:shpat_test_abc123';

const ACTIVE_CONNECTION = {
  store_domain: STORE_DOMAIN,
  access_token_encrypted: ENCRYPTED_TOKEN,
  status: 'active' as const,
};

const REVOKED_CONNECTION = {
  store_domain: STORE_DOMAIN,
  access_token_encrypted: ENCRYPTED_TOKEN,
  status: 'revoked' as const,
};

const DRAFT_PARAMS = {
  workspaceId: WORKSPACE_ID,
  subject: 'Win back your customers',
  previewText: 'We miss you — here is 15 % off',
  htmlBody: '<p>Hello! We have missed you.</p>',
  fromName: 'Acme Store',
  recipientSegment: 'dormant_60',
};

/** Successful emailMarketingActivityCreate response envelope */
function makeCreateMutationResponse(overrides?: Partial<{
  id: string;
  title: string;
  status: string;
  createdAt: string;
}>) {
  const node = {
    id: 'gid://shopify/EmailMarketingActivity/123',
    title: DRAFT_PARAMS.subject,
    status: 'DRAFT',
    createdAt: '2026-03-19T10:00:00Z',
    ...overrides,
  };
  return {
    emailMarketingActivityCreate: {
      emailMarketingActivity: node,
      userErrors: [],
    },
  };
}

/** Successful marketingActivities query response envelope */
function makeActivitiesQueryResponse() {
  return {
    marketingActivities: {
      edges: [
        {
          node: {
            id: 'gid://shopify/EmailMarketingActivity/101',
            title: 'Spring Sale Draft',
            status: { status: 'DRAFT' },
            createdAt: '2026-03-17T08:00:00Z',
          },
        },
        {
          node: {
            id: 'gid://shopify/EmailMarketingActivity/102',
            title: 'Win-back Campaign',
            status: { status: 'DRAFT' },
            createdAt: '2026-03-18T09:30:00Z',
          },
        },
      ],
    },
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Shopify Email Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default happy-path setup
    mockFindUnique.mockResolvedValue(ACTIVE_CONNECTION);
    mockGetRecipients.mockResolvedValue([
      { id: '1', email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith' },
      { id: '2', email: 'bob@example.com', firstName: 'Bob', lastName: 'Jones' },
      { id: '3', email: 'carol@example.com', firstName: 'Carol', lastName: 'Lee' },
    ]);
    mockGraphql.mockResolvedValue(makeCreateMutationResponse());
  });

  // --------------------------------------------------------------------------
  // createShopifyEmailDraft — success path
  // --------------------------------------------------------------------------

  describe('createShopifyEmailDraft', () => {
    it('returns the correct draft shape on success', async () => {
      const { createShopifyEmailDraft } = await import('@/server/shopify/email');

      const result = await createShopifyEmailDraft(DRAFT_PARAMS);

      expect(result.activityId).toBe('gid://shopify/EmailMarketingActivity/123');
      expect(result.title).toBe(DRAFT_PARAMS.subject);
      expect(result.status).toBe('draft');
      expect(result.recipientCount).toBe(3);
      expect(result.shopifyAdminUrl).toBe(`https://${STORE_DOMAIN}/admin/email`);
      expect(result.createdAt).toBe('2026-03-19T10:00:00Z');
    });

    it('sends the correct mutation variables to graphql()', async () => {
      const { createShopifyEmailDraft } = await import('@/server/shopify/email');

      await createShopifyEmailDraft(DRAFT_PARAMS);

      expect(mockGraphql).toHaveBeenCalledOnce();

      const [_query, variables] = mockGraphql.mock.calls[0] as [string, Record<string, unknown>];

      expect(variables).toMatchObject({
        input: {
          title: DRAFT_PARAMS.subject,
          emailBody: DRAFT_PARAMS.htmlBody,
          subject: DRAFT_PARAMS.subject,
          previewText: DRAFT_PARAMS.previewText,
          fromName: DRAFT_PARAMS.fromName,
          status: 'DRAFT',
        },
      });
    });

    it('omits fromName from variables when not supplied', async () => {
      const { createShopifyEmailDraft } = await import('@/server/shopify/email');

      const paramsNoFromName = { ...DRAFT_PARAMS, fromName: undefined };
      await createShopifyEmailDraft(paramsNoFromName);

      const [_query, variables] = mockGraphql.mock.calls[0] as [string, Record<string, unknown>];
      const input = variables.input as Record<string, unknown>;

      expect(input).not.toHaveProperty('fromName');
    });

    it('resolves recipient count from the segment via getRecipients()', async () => {
      mockGetRecipients.mockResolvedValue(
        Array.from({ length: 47 }, (_, i) => ({
          id: String(i + 1),
          email: `user${i + 1}@example.com`,
          firstName: 'User',
          lastName: String(i + 1),
        }))
      );

      const { createShopifyEmailDraft } = await import('@/server/shopify/email');
      const result = await createShopifyEmailDraft(DRAFT_PARAMS);

      expect(mockGetRecipients).toHaveBeenCalledWith(WORKSPACE_ID, DRAFT_PARAMS.recipientSegment);
      expect(result.recipientCount).toBe(47);
    });

    it('builds the shopifyAdminUrl from the stored store_domain', async () => {
      const customDomain = 'my-boutique.myshopify.com';
      mockFindUnique.mockResolvedValue({
        ...ACTIVE_CONNECTION,
        store_domain: customDomain,
      });

      const { createShopifyEmailDraft } = await import('@/server/shopify/email');
      const result = await createShopifyEmailDraft(DRAFT_PARAMS);

      expect(result.shopifyAdminUrl).toBe(`https://${customDomain}/admin/email`);
    });

    // ------------------------------------------------------------------------
    // Error: no connection
    // ------------------------------------------------------------------------

    it('throws ShopifyApiError when no ShopifyConnection exists for the workspace', async () => {
      mockFindUnique.mockResolvedValue(null);

      const { createShopifyEmailDraft } = await import('@/server/shopify/email');

      const error = await createShopifyEmailDraft(DRAFT_PARAMS).catch((e) => e);
      expect(error).toBeInstanceOf(ShopifyApiError);
      expect(error.message).toContain(WORKSPACE_ID);
    });

    it('throws ShopifyApiError when connection status is revoked', async () => {
      mockFindUnique.mockResolvedValue(REVOKED_CONNECTION);

      const { createShopifyEmailDraft } = await import('@/server/shopify/email');

      const error = await createShopifyEmailDraft(DRAFT_PARAMS).catch((e) => e);
      expect(error).toBeInstanceOf(ShopifyApiError);
      expect(error.message).toContain('revoked');
    });

    // ------------------------------------------------------------------------
    // Error: GraphQL userErrors
    // ------------------------------------------------------------------------

    it('throws ShopifyApiError with field + message when Shopify returns userErrors', async () => {
      mockGraphql.mockResolvedValue({
        emailMarketingActivityCreate: {
          emailMarketingActivity: null,
          userErrors: [
            {
              field: ['input', 'subject'],
              message: 'Subject is too long (maximum 255 characters)',
            },
          ],
        },
      });

      const { createShopifyEmailDraft } = await import('@/server/shopify/email');

      const error = await createShopifyEmailDraft(DRAFT_PARAMS).catch((e) => e);
      expect(error).toBeInstanceOf(ShopifyApiError);
      expect(error.message).toContain('input.subject');
      expect(error.message).toContain('Subject is too long');
    });

    it('throws ShopifyApiError when emailMarketingActivity node is null and no userErrors', async () => {
      mockGraphql.mockResolvedValue({
        emailMarketingActivityCreate: {
          emailMarketingActivity: null,
          userErrors: [],
        },
      });

      const { createShopifyEmailDraft } = await import('@/server/shopify/email');

      const error = await createShopifyEmailDraft(DRAFT_PARAMS).catch((e) => e);
      expect(error).toBeInstanceOf(ShopifyApiError);
      expect(error.message).toContain('returned no activity');
    });

    it('propagates ShopifyApiError thrown by graphql() (e.g. rate limit)', async () => {
      const rateLimitError = new ShopifyApiError('Rate limit exceeded', 429);
      mockGraphql.mockRejectedValue(rateLimitError);

      const { createShopifyEmailDraft } = await import('@/server/shopify/email');

      const error = await createShopifyEmailDraft(DRAFT_PARAMS).catch((e) => e);
      expect(error).toBeInstanceOf(ShopifyApiError);
      expect(error.message).toContain('Rate limit exceeded');
    });
  });

  // --------------------------------------------------------------------------
  // getShopifyEmailDrafts
  // --------------------------------------------------------------------------

  describe('getShopifyEmailDrafts', () => {
    beforeEach(() => {
      mockGraphql.mockResolvedValue(makeActivitiesQueryResponse());
    });

    it('returns a typed array of draft objects', async () => {
      const { getShopifyEmailDrafts } = await import('@/server/shopify/email');

      const drafts = await getShopifyEmailDrafts(WORKSPACE_ID);

      expect(drafts).toHaveLength(2);

      expect(drafts[0]).toMatchObject({
        activityId: 'gid://shopify/EmailMarketingActivity/101',
        title: 'Spring Sale Draft',
        status: 'DRAFT',
        createdAt: '2026-03-17T08:00:00Z',
      });

      expect(drafts[1]).toMatchObject({
        activityId: 'gid://shopify/EmailMarketingActivity/102',
        title: 'Win-back Campaign',
        status: 'DRAFT',
        createdAt: '2026-03-18T09:30:00Z',
      });
    });

    it('returns an empty array when no drafts exist', async () => {
      mockGraphql.mockResolvedValue({
        marketingActivities: { edges: [] },
      });

      const { getShopifyEmailDrafts } = await import('@/server/shopify/email');

      const drafts = await getShopifyEmailDrafts(WORKSPACE_ID);

      expect(drafts).toEqual([]);
    });

    it('throws ShopifyApiError when no active connection exists', async () => {
      mockFindUnique.mockResolvedValue(null);

      const { getShopifyEmailDrafts } = await import('@/server/shopify/email');

      const error = await getShopifyEmailDrafts(WORKSPACE_ID).catch((e) => e);
      expect(error).toBeInstanceOf(ShopifyApiError);
      expect(error.message).toContain(WORKSPACE_ID);
    });

    it('sends a query (not mutation) to graphql()', async () => {
      const { getShopifyEmailDrafts } = await import('@/server/shopify/email');

      await getShopifyEmailDrafts(WORKSPACE_ID);

      expect(mockGraphql).toHaveBeenCalledOnce();

      const [query] = mockGraphql.mock.calls[0] as [string, unknown];

      // The document must be a query, not a mutation
      expect(query).toMatch(/^\s*query/);
      expect(query).toContain('marketingActivities');
      expect(query).not.toContain('mutation');
    });
  });

  // --------------------------------------------------------------------------
  // getShopifyClientForWorkspace (helper)
  // --------------------------------------------------------------------------

  describe('getShopifyClientForWorkspace', () => {
    it('constructs ShopifyClient with the correct store_domain and token', async () => {
      const { ShopifyClient } = await import('@/server/shopify/client');
      const { getShopifyClientForWorkspace } = await import('@/server/shopify/email');

      await getShopifyClientForWorkspace(WORKSPACE_ID);

      expect(ShopifyClient).toHaveBeenCalledWith(
        STORE_DOMAIN,
        ENCRYPTED_TOKEN
      );
    });

    it('returns the store domain alongside the client', async () => {
      const { getShopifyClientForWorkspace } = await import('@/server/shopify/email');

      const { storeDomain } = await getShopifyClientForWorkspace(WORKSPACE_ID);

      expect(storeDomain).toBe(STORE_DOMAIN);
    });

    it('queries prisma with the correct workspace_id', async () => {
      const { getShopifyClientForWorkspace } = await import('@/server/shopify/email');

      await getShopifyClientForWorkspace(WORKSPACE_ID);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { workspace_id: WORKSPACE_ID },
        select: expect.objectContaining({
          store_domain: true,
          access_token_encrypted: true,
          status: true,
        }),
      });
    });
  });
});
